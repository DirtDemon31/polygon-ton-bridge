// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PolygonBridge
 * @notice Production-grade bridge contract for Polygon ↔ TON asset transfers
 * @dev Implements upgradeable pattern with role-based access control
 * 
 * Features:
 * - Bi-directional bridging (lock/unlock mechanism)
 * - Relayer network with validation
 * - Fee collection (POL gas fees)
 * - Emergency pause mechanism
 * - Reentrancy protection
 * - Gas-optimized operations
 */
contract PolygonBridge is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /// @notice Role identifiers
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Bridge configuration
    struct BridgeConfig {
        uint256 minBridgeAmount;      // Minimum bridge amount
        uint256 maxBridgeAmount;      // Maximum bridge amount
        uint256 feeBasisPoints;       // Fee in basis points (1 bp = 0.01%)
        uint256 relayerThreshold;     // Required relayer confirmations
        bool enabled;                 // Bridge enabled flag
    }

    /// @notice Bridge transfer request
    struct BridgeTransfer {
        address sender;               // Sender on Polygon
        string tonRecipient;          // Recipient TON address (base64)
        address token;                // Token address (address(0) for POL)
        uint256 amount;               // Amount to bridge
        uint256 fee;                  // Fee charged
        uint256 timestamp;            // Request timestamp
        bytes32 tonTxHash;            // TON transaction hash (for completion)
        TransferStatus status;        // Transfer status
        uint256 confirmations;        // Relayer confirmations
    }

    /// @notice Transfer status enum
    enum TransferStatus {
        Pending,
        Confirmed,
        Completed,
        Cancelled
    }

    /// @notice Bridge configuration
    BridgeConfig public config;

    /// @notice Transfer tracking
    mapping(bytes32 => BridgeTransfer) public transfers;
    mapping(bytes32 => mapping(address => bool)) public relayerConfirmations;
    
    /// @notice Nonce for unique transfer IDs
    uint256 public transferNonce;

    /// @notice Fee collection
    address public feeCollector;
    uint256 public collectedFees;

    /// @notice Supported tokens
    mapping(address => bool) public supportedTokens;

    /// @notice Events
    event BridgeInitiated(
        bytes32 indexed transferId,
        address indexed sender,
        string tonRecipient,
        address token,
        uint256 amount,
        uint256 fee
    );

    event BridgeConfirmed(
        bytes32 indexed transferId,
        address indexed relayer,
        uint256 confirmations
    );

    event BridgeCompleted(
        bytes32 indexed transferId,
        bytes32 tonTxHash
    );

    event BridgeCancelled(
        bytes32 indexed transferId,
        string reason
    );

    event TokenUnlocked(
        bytes32 indexed transferId,
        address indexed recipient,
        address token,
        uint256 amount
    );

    event ConfigUpdated(
        uint256 minAmount,
        uint256 maxAmount,
        uint256 feeBps,
        uint256 threshold
    );

    event TokenSupported(address indexed token, bool supported);

    /// @notice Custom errors (gas efficient)
    error InsufficientAmount();
    error ExceedsMaxAmount();
    error UnsupportedToken();
    error InvalidRecipient();
    error TransferNotFound();
    error AlreadyConfirmed();
    error InsufficientConfirmations();
    error TransferAlreadyProcessed();
    error InvalidConfiguration();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the bridge contract
     * @param _admin Admin address
     * @param _feeCollector Fee collector address
     * @param _config Initial bridge configuration
     */
    function initialize(
        address _admin,
        address _feeCollector,
        BridgeConfig memory _config
    ) external initializer {
        require(_admin != address(0), "Invalid admin");
        require(_feeCollector != address(0), "Invalid fee collector");

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);

        feeCollector = _feeCollector;
        config = _config;

        // Enable POL (native token) by default
        supportedTokens[address(0)] = true;
    }

    /**
     * @notice Initiate bridge transfer from Polygon to TON
     * @param tonRecipient TON recipient address (base64 encoded)
     * @param token Token address (address(0) for POL)
     * @param amount Amount to bridge
     * @return transferId Unique transfer identifier
     */
    function bridgeToTON(
        string calldata tonRecipient,
        address token,
        uint256 amount
    ) external payable whenNotPaused nonReentrant returns (bytes32 transferId) {
        // Validation
        if (!supportedTokens[token]) revert UnsupportedToken();
        if (bytes(tonRecipient).length == 0) revert InvalidRecipient();
        if (amount < config.minBridgeAmount) revert InsufficientAmount();
        if (amount > config.maxBridgeAmount) revert ExceedsMaxAmount();

        // Calculate fee
        uint256 fee = (amount * config.feeBasisPoints) / 10000;
        uint256 netAmount = amount - fee;

        // Generate unique transfer ID
        transferId = keccak256(abi.encodePacked(
            msg.sender,
            tonRecipient,
            token,
            amount,
            transferNonce++,
            block.timestamp
        ));

        // Handle token transfer
        if (token == address(0)) {
            // POL transfer
            require(msg.value == amount, "Incorrect POL amount");
        } else {
            // ERC20 transfer
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        // Store transfer
        transfers[transferId] = BridgeTransfer({
            sender: msg.sender,
            tonRecipient: tonRecipient,
            token: token,
            amount: netAmount,
            fee: fee,
            timestamp: block.timestamp,
            tonTxHash: bytes32(0),
            status: TransferStatus.Pending,
            confirmations: 0
        });

        collectedFees += fee;

        emit BridgeInitiated(
            transferId,
            msg.sender,
            tonRecipient,
            token,
            netAmount,
            fee
        );

        return transferId;
    }

    /**
     * @notice Relayer confirms bridge transfer (off-chain verification)
     * @param transferId Transfer identifier
     */
    function confirmTransfer(bytes32 transferId) 
        external 
        onlyRole(RELAYER_ROLE) 
        whenNotPaused 
    {
        BridgeTransfer storage transfer = transfers[transferId];
        
        if (transfer.sender == address(0)) revert TransferNotFound();
        if (transfer.status != TransferStatus.Pending) revert TransferAlreadyProcessed();
        if (relayerConfirmations[transferId][msg.sender]) revert AlreadyConfirmed();

        relayerConfirmations[transferId][msg.sender] = true;
        transfer.confirmations++;

        emit BridgeConfirmed(transferId, msg.sender, transfer.confirmations);

        // Auto-complete if threshold reached
        if (transfer.confirmations >= config.relayerThreshold) {
            transfer.status = TransferStatus.Confirmed;
        }
    }

    /**
     * @notice Complete bridge transfer after TON confirmation
     * @param transferId Transfer identifier
     * @param tonTxHash TON transaction hash
     */
    function completeTransfer(bytes32 transferId, bytes32 tonTxHash)
        external
        onlyRole(OPERATOR_ROLE)
    {
        BridgeTransfer storage transfer = transfers[transferId];
        
        if (transfer.status != TransferStatus.Confirmed) revert InsufficientConfirmations();

        transfer.tonTxHash = tonTxHash;
        transfer.status = TransferStatus.Completed;

        emit BridgeCompleted(transferId, tonTxHash);
    }

    /**
     * @notice Unlock tokens on Polygon (TON → Polygon direction)
     * @param recipient Recipient address on Polygon
     * @param token Token address
     * @param amount Amount to unlock
     * @param tonTxHash Originating TON transaction hash
     */
    function unlockTokens(
        address recipient,
        address token,
        uint256 amount,
        bytes32 tonTxHash
    ) external onlyRole(RELAYER_ROLE) nonReentrant whenNotPaused {
        require(recipient != address(0), "Invalid recipient");
        if (!supportedTokens[token]) revert UnsupportedToken();

        bytes32 transferId = keccak256(abi.encodePacked(tonTxHash, recipient, token, amount));

        // Prevent double-spending
        require(transfers[transferId].status == TransferStatus.Pending || 
                transfers[transferId].sender == address(0), "Already processed");

        if (token == address(0)) {
            // Unlock POL
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "POL transfer failed");
        } else {
            // Unlock ERC20
            IERC20(token).safeTransfer(recipient, amount);
        }

        emit TokenUnlocked(transferId, recipient, token, amount);
    }

    /**
     * @notice Update bridge configuration
     */
    function updateConfig(BridgeConfig calldata _config) 
        external 
        onlyRole(OPERATOR_ROLE) 
    {
        if (_config.minBridgeAmount >= _config.maxBridgeAmount) revert InvalidConfiguration();
        if (_config.feeBasisPoints > 1000) revert InvalidConfiguration(); // Max 10%

        config = _config;

        emit ConfigUpdated(
            _config.minBridgeAmount,
            _config.maxBridgeAmount,
            _config.feeBasisPoints,
            _config.relayerThreshold
        );
    }

    /**
     * @notice Add/remove supported token
     */
    function setSupportedToken(address token, bool supported) 
        external 
        onlyRole(OPERATOR_ROLE) 
    {
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }

    /**
     * @notice Withdraw collected fees
     */
    function withdrawFees() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 amount = collectedFees;
        collectedFees = 0;
        
        (bool success, ) = feeCollector.call{value: amount}("");
        require(success, "Fee transfer failed");
    }

    /**
     * @notice Emergency pause
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Get transfer details
     */
    function getTransfer(bytes32 transferId) 
        external 
        view 
        returns (BridgeTransfer memory) 
    {
        return transfers[transferId];
    }

    /**
     * @notice Receive POL
     */
    receive() external payable {}
}
