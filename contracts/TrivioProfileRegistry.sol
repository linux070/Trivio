// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title TrivioProfileRegistry
 * @notice Production-grade onchain profile & username registry for Trivio on Arc Network.
 * @dev Enforces uniqueness, format hygiene, pausable circuit breaker, 2-step ownership, and moderation capabilities.
 */
contract TrivioProfileRegistry {
    struct Profile {
        string username;
        string avatarUrl;
        string avatarSeed;
        string avatarStyle;
        uint256 updatedAt;
    }

    // Contract Ownership (2-step transfer pattern)
    address public owner;
    address public pendingOwner;

    // Emergency Pause Circuit Breaker
    bool public paused;

    // Mapping from wallet address to their profile
    mapping(address => Profile) private _profiles;

    // Mapping from normalized (lowercased) username hash to owner address
    mapping(bytes32 => address) public usernameHashToOwner;

    // Mapping from wallet address to their current registered username
    mapping(address => string) public addressToUsername;

    // Events
    event ProfileUpdated(
        address indexed user,
        string username,
        string avatarUrl,
        string avatarSeed,
        string avatarStyle,
        uint256 updatedAt
    );
    event UsernameClaimed(address indexed user, string username);
    event UsernameReleased(address indexed user, string username);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PauseStateChanged(bool isPaused);

    // Custom Errors
    error OnlyOwner();
    error OnlyPendingOwner();
    error ContractIsPaused();
    error InvalidUsernameLength();
    error InvalidUsernameCharacters();
    error InvalidUsernameBoundary();
    error ReservedUsername();
    error UsernameAlreadyTaken();
    error InputTooLong();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractIsPaused();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
     * @notice Register or update a profile onchain.
     * @param username The display username (2-24 chars, alphanumeric + '_' + '-')
     * @param avatarUrl The image or DiceBear avatar URL (max 512 chars)
     * @param avatarSeed The seed string (max 64 chars)
     * @param avatarStyle The avatar style (max 64 chars)
     */
    function setProfile(
        string calldata username,
        string calldata avatarUrl,
        string calldata avatarSeed,
        string calldata avatarStyle
    ) external whenNotPaused {
        bytes memory usernameBytes = bytes(username);
        uint256 len = usernameBytes.length;

        if (len < 2 || len > 24) revert InvalidUsernameLength();
        if (bytes(avatarUrl).length > 512) revert InputTooLong();
        if (bytes(avatarSeed).length > 64) revert InputTooLong();
        if (bytes(avatarStyle).length > 64) revert InputTooLong();

        // Validate first and last character hygiene (must be alphanumeric)
        if (!_isAlphaNumeric(usernameBytes[0]) || !_isAlphaNumeric(usernameBytes[len - 1])) {
            revert InvalidUsernameBoundary();
        }

        // Validate characters & normalize to lowercase
        bytes memory lowerBytes = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            bytes1 b = usernameBytes[i];
            if (b >= 0x41 && b <= 0x5A) {
                lowerBytes[i] = bytes1(uint8(b) + 32); // Convert A-Z to a-z
            } else if (
                (b >= 0x61 && b <= 0x7A) || // a-z
                (b >= 0x30 && b <= 0x39) || // 0-9
                b == 0x5F ||                // _
                b == 0x2D                   // -
            ) {
                lowerBytes[i] = b;
            } else {
                revert InvalidUsernameCharacters();
            }
        }

        bytes32 newHash = keccak256(lowerBytes);

        // Impersonation protection for system names (unless set by owner)
        if (msg.sender != owner && _isReservedName(newHash)) {
            revert ReservedUsername();
        }

        address currentOwner = usernameHashToOwner[newHash];
        if (currentOwner != address(0) && currentOwner != msg.sender) {
            revert UsernameAlreadyTaken();
        }

        // Release old username if renaming
        string memory oldUsername = addressToUsername[msg.sender];
        if (bytes(oldUsername).length > 0) {
            bytes memory oldLowerBytes = _toLowerCase(oldUsername);
            bytes32 oldHash = keccak256(oldLowerBytes);
            if (oldHash != newHash) {
                delete usernameHashToOwner[oldHash];
                emit UsernameReleased(msg.sender, oldUsername);
            }
        }

        // Claim new username
        usernameHashToOwner[newHash] = msg.sender;
        addressToUsername[msg.sender] = username;

        _profiles[msg.sender] = Profile({
            username: username,
            avatarUrl: avatarUrl,
            avatarSeed: avatarSeed,
            avatarStyle: avatarStyle,
            updatedAt: block.timestamp
        });

        emit UsernameClaimed(msg.sender, username);
        emit ProfileUpdated(
            msg.sender,
            username,
            avatarUrl,
            avatarSeed,
            avatarStyle,
            block.timestamp
        );
    }

    /**
     * @notice Voluntarily clear your profile and release your username.
     */
    function clearProfile() external whenNotPaused {
        string memory current = addressToUsername[msg.sender];
        if (bytes(current).length > 0) {
            bytes32 h = keccak256(_toLowerCase(current));
            delete usernameHashToOwner[h];
            delete addressToUsername[msg.sender];
            delete _profiles[msg.sender];
            emit UsernameReleased(msg.sender, current);
        }
    }

    /**
     * @notice Admin moderation to release an abusive/offensive username.
     */
    function adminReleaseUsername(string calldata username) external onlyOwner {
        bytes32 h = keccak256(_toLowerCase(username));
        address user = usernameHashToOwner[h];
        if (user != address(0)) {
            delete usernameHashToOwner[h];
            delete addressToUsername[user];
            delete _profiles[user];
            emit UsernameReleased(user, username);
        }
    }

    /**
     * @notice Emergency toggle to pause or unpause contract updates.
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PauseStateChanged(_paused);
    }

    /**
     * @notice Step 1 of 2-step ownership transfer.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /**
     * @notice Step 2 of 2-step ownership transfer: new owner accepts ownership.
     */
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert OnlyPendingOwner();
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    /**
     * @notice Get user profile.
     */
    function getProfile(address user)
        external
        view
        returns (
            string memory username,
            string memory avatarUrl,
            string memory avatarSeed,
            string memory avatarStyle,
            uint256 updatedAt
        )
    {
        Profile memory p = _profiles[user];
        return (p.username, p.avatarUrl, p.avatarSeed, p.avatarStyle, p.updatedAt);
    }

    /**
     * @notice Check if a username is available.
     */
    function isUsernameAvailable(string calldata username) external view returns (bool) {
        bytes memory b = bytes(username);
        uint256 len = b.length;
        if (len < 2 || len > 24) return false;
        if (!_isAlphaNumeric(b[0]) || !_isAlphaNumeric(b[len - 1])) return false;

        bytes32 h = keccak256(_toLowerCase(username));
        if (msg.sender != owner && _isReservedName(h)) return false;

        address user = usernameHashToOwner[h];
        return user == address(0) || user == msg.sender;
    }

    /**
     * @notice Resolve a username to its owner address.
     */
    function resolveUsername(string calldata username) external view returns (address) {
        bytes memory lower = _toLowerCase(username);
        return usernameHashToOwner[keccak256(lower)];
    }

    /**
     * @dev Check if character is alphanumeric [a-zA-Z0-9]
     */
    function _isAlphaNumeric(bytes1 b) internal pure returns (bool) {
        return (
            (b >= 0x41 && b <= 0x5A) || // A-Z
            (b >= 0x61 && b <= 0x7A) || // a-z
            (b >= 0x30 && b <= 0x39)    // 0-9
        );
    }

    /**
     * @dev Check if a hash matches reserved system words
     */
    function _isReservedName(bytes32 h) internal pure returns (bool) {
        return (
            h == keccak256("admin") ||
            h == keccak256("administrator") ||
            h == keccak256("trivio") ||
            h == keccak256("official") ||
            h == keccak256("support") ||
            h == keccak256("arc") ||
            h == keccak256("system") ||
            h == keccak256("mod") ||
            h == keccak256("moderator")
        );
    }

    /**
     * @dev Internal helper for lowercasing strings
     */
    function _toLowerCase(string memory str) internal pure returns (bytes memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);
        for (uint256 i = 0; i < bStr.length; i++) {
            bytes1 b = bStr[i];
            if (b >= 0x41 && b <= 0x5A) {
                bLower[i] = bytes1(uint8(b) + 32);
            } else {
                bLower[i] = b;
            }
        }
        return bLower;
    }
}
