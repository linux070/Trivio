// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TriviaGame is ReentrancyGuard {
    enum Status {
        Open,
        InProgress,
        Finished,
        Cancelled
    }

    struct Room {
        address host;
        uint256 usdcBuyIn;
        uint256 prizePool;
        uint8 maxPlayers;
        uint8 playerCount;
        Status status;
        address winner;
        mapping(address => bool) players;
    }

    address public immutable usdc;

    mapping(bytes32 roomId => Room) private rooms;
    mapping(bytes32 roomId => mapping(address player => uint256 amount)) public pendingRefunds;
    mapping(bytes32 roomId => address[]) private roomPlayerList;

    event RoomCreated(bytes32 indexed roomId, address indexed host, uint256 usdcBuyIn, uint256 prizePool, uint8 maxPlayers);
    event PlayerJoined(bytes32 indexed roomId, address indexed player, uint256 amount);
    event GameStarted(bytes32 indexed roomId);
    event WinnerDeclared(bytes32 indexed roomId, address indexed winner, uint256 prize);
    event RoomCancelled(bytes32 indexed roomId);
    event RefundClaimed(bytes32 indexed roomId, address indexed player, uint256 amount);

    constructor(address _usdc) {
        require(_usdc != address(0), "USDC zero address");
        usdc = _usdc;
    }

    function createRoom(bytes32 roomId, uint256 usdcBuyIn, uint256 sponsoredPrize, uint8 maxPlayers) external nonReentrant {
        require(roomId != bytes32(0), "Invalid roomId");
        require(rooms[roomId].host == address(0), "Room exists");
        require(maxPlayers >= 2 && maxPlayers <= 20, "maxPlayers out of range");

        bool sponsoredMode = usdcBuyIn == 0;
        if (sponsoredMode) {
            require(sponsoredPrize > 0, "Sponsored prize required");
        } else {
            require(sponsoredPrize == 0, "No sponsored prize in buy-in mode");
        }

        Room storage room = rooms[roomId];
        room.host = msg.sender;
        room.usdcBuyIn = usdcBuyIn;
        room.prizePool = sponsoredPrize;
        room.maxPlayers = maxPlayers;
        room.playerCount = 0;
        room.status = Status.Open;
        room.winner = address(0);

        if (sponsoredPrize > 0) {
            require(IERC20(usdc).transferFrom(msg.sender, address(this), sponsoredPrize), "USDC transferFrom failed");
        }

        emit RoomCreated(roomId, msg.sender, usdcBuyIn, room.prizePool, maxPlayers);
    }

    function joinRoom(bytes32 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        require(room.host != address(0), "Room does not exist");
        require(room.status == Status.Open, "Room not open");
        require(!room.players[msg.sender], "Already joined");
        require(room.playerCount < room.maxPlayers, "Room full");

        room.players[msg.sender] = true;
        roomPlayerList[roomId].push(msg.sender);
        room.playerCount += 1;

        uint256 amount = room.usdcBuyIn;
        if (amount > 0) {
            require(IERC20(usdc).transferFrom(msg.sender, address(this), amount), "USDC transferFrom failed");
            room.prizePool += amount;
            pendingRefunds[roomId][msg.sender] += amount;
        }

        emit PlayerJoined(roomId, msg.sender, amount);
    }

    function startGame(bytes32 roomId) external {
        Room storage room = rooms[roomId];
        require(room.host != address(0), "Room does not exist");
        require(msg.sender == room.host, "Only host");
        require(room.status == Status.Open, "Room not open");

        room.status = Status.InProgress;
        emit GameStarted(roomId);
    }

    function declareWinner(bytes32 roomId, address winner) external nonReentrant {
        Room storage room = rooms[roomId];
        require(room.host != address(0), "Room does not exist");
        require(msg.sender == room.host, "Only host");
        require(room.status == Status.InProgress, "Room not in progress");
        require(winner != address(0), "Winner zero address");
        require(room.players[winner], "Winner not in room");

        room.status = Status.Finished;
        room.winner = winner;

        uint256 prize = room.prizePool;
        room.prizePool = 0;

        require(IERC20(usdc).transfer(winner, prize), "USDC transfer failed");

        emit WinnerDeclared(roomId, winner, prize);
    }

    function cancelRoom(bytes32 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        require(room.host != address(0), "Room does not exist");
        require(msg.sender == room.host, "Only host");
        require(room.status == Status.Open || room.status == Status.InProgress, "Cannot cancel");

        room.status = Status.Cancelled;

        uint256 playersTotalRefund;
        if (room.usdcBuyIn > 0) {
            address[] storage players = roomPlayerList[roomId];
            uint256 length = players.length;
            for (uint256 i = 0; i < length; i++) {
                address player = players[i];
                uint256 refundAmount = pendingRefunds[roomId][player];
                playersTotalRefund += refundAmount;
            }
        }

        uint256 hostRefund = room.prizePool - playersTotalRefund;
        room.prizePool = playersTotalRefund;

        if (hostRefund > 0) {
            require(IERC20(usdc).transfer(room.host, hostRefund), "USDC transfer failed");
        }

        emit RoomCancelled(roomId);
    }

    function claimRefund(bytes32 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        require(room.host != address(0), "Room does not exist");
        require(room.status == Status.Cancelled, "Room not cancelled");

        uint256 amount = pendingRefunds[roomId][msg.sender];
        require(amount > 0, "No refund");

        pendingRefunds[roomId][msg.sender] = 0;
        room.prizePool -= amount;

        require(IERC20(usdc).transfer(msg.sender, amount), "USDC transfer failed");

        emit RefundClaimed(roomId, msg.sender, amount);
    }

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
            address winner
        )
    {
        Room storage room = rooms[roomId];
        require(room.host != address(0), "Room does not exist");

        return (
            room.host,
            room.usdcBuyIn,
            room.prizePool,
            room.maxPlayers,
            room.playerCount,
            uint8(room.status),
            room.winner
        );
    }

    function isPlayer(bytes32 roomId, address player) external view returns (bool) {
        Room storage room = rooms[roomId];
        require(room.host != address(0), "Room does not exist");
        return room.players[player];
    }

    /** Returns true if a room with this id already exists */
    function roomExists(bytes32 roomId) external view returns (bool) {
        return rooms[roomId].host != address(0);
    }
}
