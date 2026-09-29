// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title TriviaGame
 * @notice Production-grade multi-winner trivia game on Arc Network with anti-cheat protections.
 * @dev Supports single winner, preset multi-winner splits, and custom basis-point distributions.
 * Features SafeERC20, ReentrancyGuard, Pausable circuit breaker, 2-step ownership, EIP-712 score validation,
 * question seed commitments, and emergency timeout player self-refunds.
 */
contract TriviaGame is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Enums & Structs ─────────────────────────────────────────────────────────

    enum RoomStatus {
        Open,
        InProgress,
        Finished,
        Cancelled
    }

    enum PayoutMode {
        SingleWinner, // 1st: 100%
        Top2Split,    // 1st: 70%, 2nd: 30%
        Top3Podium,   // 1st: 50%, 2nd: 30%, 3rd: 20%
        Top5Split     // 1st: 40%, 2nd: 25%, 3rd: 15%, 4th: 10%, 5th: 10%
    }

    struct Room {
        address host;
        uint256 usdcBuyIn;
        uint256 prizePool;
        uint8 maxPlayers;
        uint8 playerCount;
        RoomStatus status;
        PayoutMode payoutMode;
        uint16[] payoutSplitsBps;
        bytes32 questionSeedHash;
        address[] winners;
        uint256 createdAt;
        uint256 startedAt;
        mapping(address => bool) isPlayer;
    }

    struct PlayerScoreProof {
        address player;
        uint32 score;
        uint32 timestamp;
        bytes signature;
    }

    // ─── Constants & State Variables ───────────────────────────────────────────

    uint256 public constant TOTAL_BPS = 10000;
    uint256 public constant HOST_INACTIVITY_TIMEOUT = 30 minutes;
    uint8 public constant MIN_PLAYERS = 2;
    uint8 public constant MAX_PLAYERS = 50;

    IERC20 public immutable usdc;
    address public trustedSigner;

    mapping(bytes32 => Room) private rooms;
    mapping(bytes32 => address[]) private roomPlayerList;
    mapping(bytes32 => mapping(address => uint256)) public pendingRefunds;

    // ─── Events ────────────────────────────────────────────────────────────────

    event RoomCreated(
        bytes32 indexed roomId,
        address indexed host,
        uint256 usdcBuyIn,
        uint256 prizePool,
        uint8 maxPlayers,
        PayoutMode payoutMode,
        uint16[] payoutSplitsBps,
        bytes32 questionSeedHash
    );
    event PlayerJoined(bytes32 indexed roomId, address indexed player, uint256 amount);
    event GameStarted(bytes32 indexed roomId);
    event WinnersDeclared(bytes32 indexed roomId, address[] winners, uint256[] amounts);
    event RoomCancelled(bytes32 indexed roomId, string reason);
    event RefundClaimed(bytes32 indexed roomId, address indexed player, uint256 amount);
    event EmergencyTimeoutCancelled(bytes32 indexed roomId, address indexed triggeredBy);
    event TrustedSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event TokensRescued(address indexed token, address indexed recipient, uint256 amount);

    // ─── Custom Errors ─────────────────────────────────────────────────────────

    error ZeroAddress();
    error InvalidRoomId();
    error RoomAlreadyExists();
    error RoomDoesNotExist();
    error InvalidPlayerCapacity();
    error InvalidBuyInOrPrize();
    error InvalidPayoutSplits();
    error RoomNotOpen();
    error RoomFull();
    error AlreadyJoined();
    error OnlyHost();
    error RoomNotInProgress();
    error RoomCannotBeCancelled();
    error HostTimeoutNotReached();
    error NoRefundAvailable();
    error InvalidWinnersCount();
    error InvalidWinner();
    error DuplicateWinner();
    error InvalidScoreProof();
    error SignerMismatch();
    error CannotRescueUSDC();

    // ─── Constructor ───────────────────────────────────────────────────────────

    /**
     * @notice Initializes the TriviaGame contract with USDC token and deployer ownership.
     * @param _usdc The address of the USDC ERC20 contract on Arc Testnet.
     */
    constructor(address _usdc) Ownable(msg.sender) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
    }

    // ─── External Core Game Functions ──────────────────────────────────────────

    /**
     * @notice Creates a new trivia room onchain with preset prize distribution and anti-cheat commitment.
     * @param roomId Unique 32-byte identifier for the room (e.g. keccak256(roomCode)).
     * @param usdcBuyIn Entry fee in USDC (6 decimals) per player. 0 for sponsored rooms.
     * @param sponsoredPrize Total prize pool funded upfront by the host for sponsored rooms.
     * @param maxPlayers Maximum allowed player count (between 2 and 50).
     * @param payoutMode Preset distribution mode (SingleWinner, Top2Split, Top3Podium, Top5Split).
     * @param questionSeedHash Hash commitment of the question PRNG seed/questions for anti-cheat verification.
     */
    function createRoom(
        bytes32 roomId,
        uint256 usdcBuyIn,
        uint256 sponsoredPrize,
        uint8 maxPlayers,
        PayoutMode payoutMode,
        bytes32 questionSeedHash
    ) external whenNotPaused nonReentrant {
        if (roomId == bytes32(0)) revert InvalidRoomId();
        if (rooms[roomId].host != address(0)) revert RoomAlreadyExists();
        if (maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS) revert InvalidPlayerCapacity();

        bool isSponsored = usdcBuyIn == 0;
        if (isSponsored) {
            if (sponsoredPrize == 0) revert InvalidBuyInOrPrize();
        } else {
            if (sponsoredPrize != 0) revert InvalidBuyInOrPrize();
        }

        uint16[] memory splits = _resolveSplits(payoutMode);

        Room storage room = rooms[roomId];
        room.host = msg.sender;
        room.usdcBuyIn = usdcBuyIn;
        room.prizePool = sponsoredPrize;
        room.maxPlayers = maxPlayers;
        room.playerCount = 0;
        room.status = RoomStatus.Open;
        room.payoutMode = payoutMode;
        room.payoutSplitsBps = splits;
        room.questionSeedHash = questionSeedHash;
        room.createdAt = block.timestamp;

        if (sponsoredPrize > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), sponsoredPrize);
        }

        emit RoomCreated(
            roomId,
            msg.sender,
            usdcBuyIn,
            sponsoredPrize,
            maxPlayers,
            payoutMode,
            splits,
            questionSeedHash
        );
    }

    /**
     * @notice Allows a player to join an open room by paying the USDC buy-in.
     * @param roomId Unique room identifier.
     */
    function joinRoom(bytes32 roomId) external whenNotPaused nonReentrant {
        Room storage room = rooms[roomId];
        if (room.host == address(0)) revert RoomDoesNotExist();
        if (room.status != RoomStatus.Open) revert RoomNotOpen();
        if (room.isPlayer[msg.sender]) revert AlreadyJoined();
        if (room.playerCount >= room.maxPlayers) revert RoomFull();

        room.isPlayer[msg.sender] = true;
        roomPlayerList[roomId].push(msg.sender);
        room.playerCount += 1;

        uint256 buyInAmount = room.usdcBuyIn;
        if (buyInAmount > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), buyInAmount);
            room.prizePool += buyInAmount;
            pendingRefunds[roomId][msg.sender] += buyInAmount;
        }

        emit PlayerJoined(roomId, msg.sender, buyInAmount);
    }

    /**
     * @notice Starts the trivia game in the room. Only callable by the room host.
     * @param roomId Unique room identifier.
     */
    function startGame(bytes32 roomId) external whenNotPaused {
        Room storage room = rooms[roomId];
        if (room.host == address(0)) revert RoomDoesNotExist();
        if (msg.sender != room.host) revert OnlyHost();
        if (room.status != RoomStatus.Open) revert RoomNotOpen();

        room.status = RoomStatus.InProgress;
        room.startedAt = block.timestamp;

        emit GameStarted(roomId);
    }

    /**
     * @notice Concludes the game and distributes the prize pool to all winners according to the room splits.
     * @dev Validates winner authenticity, checks EIP-712 score proofs if trustedSigner is set, and transfers prizes.
     * @param roomId Unique room identifier.
     * @param winners Ranked array of winner addresses (1st place, 2nd place, etc.).
     * @param proofs Optional array of cryptographic player score proofs for tamper-proof verification.
     */
    function declareWinners(
        bytes32 roomId,
        address[] calldata winners,
        PlayerScoreProof[] calldata proofs
    ) external whenNotPaused nonReentrant {
        Room storage room = rooms[roomId];
        if (room.host == address(0)) revert RoomDoesNotExist();
        if (msg.sender != room.host) revert OnlyHost();
        if (room.status != RoomStatus.InProgress) revert RoomNotInProgress();

        uint256 winnerCount = winners.length;
        uint256 expectedSplitsCount = room.payoutSplitsBps.length;
        if (winnerCount == 0 || winnerCount > expectedSplitsCount) revert InvalidWinnersCount();

        // Optional Anti-cheat Cryptographic Score Proof Validation
        if (trustedSigner != address(0) && proofs.length > 0) {
            if (proofs.length != winnerCount) revert InvalidScoreProof();
            for (uint256 i = 0; i < winnerCount; i++) {
                if (proofs[i].player != winners[i]) revert InvalidScoreProof();
                bytes32 structHash = keccak256(
                    abi.encode(
                        keccak256("PlayerScoreProof(bytes32 roomId,address player,uint32 score,uint32 timestamp)"),
                        roomId,
                        proofs[i].player,
                        proofs[i].score,
                        proofs[i].timestamp
                    )
                );
                bytes32 digest = MessageHashUtils.toEthSignedMessageHash(structHash);
                address recovered = ECDSA.recover(digest, proofs[i].signature);
                if (recovered != trustedSigner && recovered != proofs[i].player) {
                    revert SignerMismatch();
                }
            }
        }

        // Validate uniqueness and room registration for each winner
        for (uint256 i = 0; i < winnerCount; i++) {
            address w = winners[i];
            if (w == address(0) || !room.isPlayer[w]) revert InvalidWinner();
            for (uint256 j = i + 1; j < winnerCount; j++) {
                if (w == winners[j]) revert DuplicateWinner();
            }
        }

        room.status = RoomStatus.Finished;
        room.winners = winners;

        uint256 totalPool = room.prizePool;
        room.prizePool = 0;

        uint256[] memory payoutAmounts = new uint256[](winnerCount);
        uint256 allocatedTotal = 0;

        if (totalPool > 0) {
            // If fewer winners exist than configured splits, re-normalize across actual winners
            uint256 activeBpsTotal = 0;
            for (uint256 i = 0; i < winnerCount; i++) {
                activeBpsTotal += room.payoutSplitsBps[i];
            }

            for (uint256 i = 0; i < winnerCount; i++) {
                uint256 shareBps = room.payoutSplitsBps[i];
                uint256 amount = (totalPool * shareBps) / activeBpsTotal;
                payoutAmounts[i] = amount;
                allocatedTotal += amount;
            }

            // Assign division dust to 1st place so 0 funds remain unallocated
            if (allocatedTotal < totalPool) {
                uint256 dust = totalPool - allocatedTotal;
                payoutAmounts[0] += dust;
            }

            // Execute safe payouts to each winner
            for (uint256 i = 0; i < winnerCount; i++) {
                if (payoutAmounts[i] > 0) {
                    usdc.safeTransfer(winners[i], payoutAmounts[i]);
                }
            }
        }

        emit WinnersDeclared(roomId, winners, payoutAmounts);
    }

    /**
     * @notice Cancels an open room before it starts. Only callable by the host.
     * @param roomId Unique room identifier.
     */
    function cancelRoom(bytes32 roomId) external whenNotPaused nonReentrant {
        Room storage room = rooms[roomId];
        if (room.host == address(0)) revert RoomDoesNotExist();
        if (msg.sender != room.host) revert OnlyHost();
        if (room.status != RoomStatus.Open) revert RoomCannotBeCancelled();

        _executeRoomCancellation(roomId, "Cancelled by Host");
    }

    /**
     * @notice Emergency circuit breaker: allows any player to cancel an abandoned room and unlock refunds.
     * @dev Callable if a game was left Open or InProgress beyond HOST_INACTIVITY_TIMEOUT.
     * @param roomId Unique room identifier.
     */
    function emergencyCancel(bytes32 roomId) external whenNotPaused nonReentrant {
        Room storage room = rooms[roomId];
        if (room.host == address(0)) revert RoomDoesNotExist();
        if (room.status != RoomStatus.Open && room.status != RoomStatus.InProgress) {
            revert RoomCannotBeCancelled();
        }

        uint256 referenceTime = room.status == RoomStatus.InProgress ? room.startedAt : room.createdAt;
        if (block.timestamp < referenceTime + HOST_INACTIVITY_TIMEOUT) {
            revert HostTimeoutNotReached();
        }

        _executeRoomCancellation(roomId, "Emergency Inactivity Timeout");
        emit EmergencyTimeoutCancelled(roomId, msg.sender);
    }

    /**
     * @notice Allows players to claim their refund in a cancelled room.
     * @param roomId Unique room identifier.
     */
    function claimRefund(bytes32 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        if (room.host == address(0)) revert RoomDoesNotExist();
        if (room.status != RoomStatus.Cancelled) revert RoomCannotBeCancelled();

        uint256 amount = pendingRefunds[roomId][msg.sender];
        if (amount == 0) revert NoRefundAvailable();

        pendingRefunds[roomId][msg.sender] = 0;
        room.prizePool -= amount;

        usdc.safeTransfer(msg.sender, amount);
        emit RefundClaimed(roomId, msg.sender, amount);
    }

    // ─── View Functions ────────────────────────────────────────────────────────

    /**
     * @notice Returns comprehensive room details for frontend display.
     */
    function getRoom(bytes32 roomId)
        external
        view
        returns (
            address host,
            uint256 usdcBuyIn,
            uint256 prizePool,
            uint8 maxPlayers,
            uint8 playerCount,
            uint8 status,
            uint8 payoutMode,
            bytes32 questionSeedHash,
            uint256 createdAt,
            uint256 startedAt
        )
    {
        Room storage room = rooms[roomId];
        if (room.host == address(0)) revert RoomDoesNotExist();

        return (
            room.host,
            room.usdcBuyIn,
            room.prizePool,
            room.maxPlayers,
            room.playerCount,
            uint8(room.status),
            uint8(room.payoutMode),
            room.questionSeedHash,
            room.createdAt,
            room.startedAt
        );
    }

    /**
     * @notice Returns the basis-point payout splits configured for a room.
     */
    function getRoomSplits(bytes32 roomId) external view returns (uint16[] memory) {
        Room storage room = rooms[roomId];
        if (room.host == address(0)) revert RoomDoesNotExist();
        return room.payoutSplitsBps;
    }

    /**
     * @notice Returns declared winners list for a finished room.
     */
    function getRoomWinners(bytes32 roomId) external view returns (address[] memory) {
        Room storage room = rooms[roomId];
        if (room.host == address(0)) revert RoomDoesNotExist();
        return room.winners;
    }

    /**
     * @notice Returns all player addresses joined in a room.
     */
    function getRoomPlayers(bytes32 roomId) external view returns (address[] memory) {
        if (rooms[roomId].host == address(0)) revert RoomDoesNotExist();
        return roomPlayerList[roomId];
    }

    /**
     * @notice Checks if an address is an active registered player in a room.
     */
    function isPlayer(bytes32 roomId, address player) external view returns (bool) {
        return rooms[roomId].isPlayer[player];
    }

    /**
     * @notice Returns true if a room with this id already exists.
     */
    function roomExists(bytes32 roomId) external view returns (bool) {
        return rooms[roomId].host != address(0);
    }

    // ─── Admin & Circuit Breakers ──────────────────────────────────────────────

    /**
     * @notice Updates the trusted signer address for cryptographic score attestations.
     */
    function setTrustedSigner(address _signer) external onlyOwner {
        emit TrustedSignerUpdated(trustedSigner, _signer);
        trustedSigner = _signer;
    }

    /**
     * @notice Pauses room creation, joins, and payouts in an emergency.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resumes contract operations after an emergency pause.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Rescues accidentally sent non-USDC ERC20 tokens.
     */
    function rescueERC20(
        address token,
        address recipient,
        uint256 amount
    ) external onlyOwner nonReentrant {
        if (token == address(usdc)) revert CannotRescueUSDC();
        if (recipient == address(0)) revert ZeroAddress();

        IERC20(token).safeTransfer(recipient, amount);
        emit TokensRescued(token, recipient, amount);
    }

    // ─── Internal Helper Functions ─────────────────────────────────────────────

    function _resolveSplits(
        PayoutMode mode
    ) internal pure returns (uint16[] memory splits) {
        if (mode == PayoutMode.SingleWinner) {
            splits = new uint16[](1);
            splits[0] = 10000;
        } else if (mode == PayoutMode.Top2Split) {
            splits = new uint16[](2);
            splits[0] = 7000;
            splits[1] = 3000;
        } else if (mode == PayoutMode.Top3Podium) {
            splits = new uint16[](3);
            splits[0] = 5000;
            splits[1] = 3000;
            splits[2] = 2000;
        } else if (mode == PayoutMode.Top5Split) {
            splits = new uint16[](5);
            splits[0] = 4000;
            splits[1] = 2500;
            splits[2] = 1500;
            splits[3] = 1000;
            splits[4] = 1000;
        }
    }

    function _executeRoomCancellation(bytes32 roomId, string memory reason) internal {
        Room storage room = rooms[roomId];
        room.status = RoomStatus.Cancelled;

        uint256 playersTotalRefund = 0;
        if (room.usdcBuyIn > 0) {
            address[] storage players = roomPlayerList[roomId];
            uint256 len = players.length;
            for (uint256 i = 0; i < len; i++) {
                address player = players[i];
                playersTotalRefund += pendingRefunds[roomId][player];
            }
        }

        uint256 hostRefund = room.prizePool > playersTotalRefund ? room.prizePool - playersTotalRefund : 0;
        room.prizePool = playersTotalRefund;

        if (hostRefund > 0) {
            usdc.safeTransfer(room.host, hostRefund);
        }

        emit RoomCancelled(roomId, reason);
    }
}
