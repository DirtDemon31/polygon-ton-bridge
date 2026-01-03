// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PolygonBridge is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    struct BridgeConfig {
        uint256 minBridgeAmount;
        uint256 maxBridgeAmount;
        uint256 feeBasisPoints;
        uint256 relayerThreshold;
        bool enabled;
    }

    struct Transfer {
        address sender;
        address token;
        uint256 amount;
        string tonRecipient;
        uint256 timestamp;
        uint256 confirmations;
        bool completed;
    }

    BridgeConfig public config;
    address public wrappedTON;
    uint256 public transferNonce;
    
    mapping(address => bool) public supportedTokens;
    mapping(bytes32 => Transfer) public transfers;
    mapping(bytes32 => mapping(address => bool)) public hasConfirmed;

    event BridgeInitiated(
        bytes32 indexed transferId,
        address indexed sender,
        address indexed token,
        uint256 amount,
        string tonRecipient,
        uint256 fee
    );
    event BridgeConfirmed(bytes32 indexed transferId, address indexed relayer);
    event BridgeCompleted(bytes32 indexed transferId);
    event TokenSupported(address indexed token, bool supported);
    event ConfigUpdated(BridgeConfig newConfig);

    error InsufficientAmount();
    error ExceedsMaxAmount();
    error UnsupportedToken();
    error TransferNotFound();
    error AlreadyConfirmed();
    error AlreadyCompleted();
    error BridgeDisabled();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _wrappedTON,
        BridgeConfig memory _config
    ) external initializer {
        require(_admin != address(0), "Invalid admin");
        require(_wrappedTON != address(0), "Invalid wTON");

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);

        wrappedTON = _wrappedTON;
        config = _config;

        supportedTokens[address(0)] = true;
    }

    function bridgeToTON(
        string calldata tonRecipient,
        address token,
        uint256 amount
    ) external payable whenNotPaused nonReentrant {
        if (!config.enabled) revert BridgeDisabled();
        if (!supportedTokens[token]) revert UnsupportedToken();
        if (amount < config.minBridgeAmount) revert InsufficientAmount();
        if (amount > config.maxBridgeAmount) revert ExceedsMaxAmount();

        uint256 fee = (amount * config.feeBasisPoints) / 10000;
        uint256 netAmount = amount - fee;

        if (token == address(0)) {
            require(msg.value == amount, "Incorrect ETH amount");
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        bytes32 transferId = keccak256(
            abi.encodePacked(msg.sender, token, amount, tonRecipient, transferNonce++)
        );

        transfers[transferId] = Transfer({
            sender: msg.sender,
            token: token,
            amount: netAmount,
            tonRecipient: tonRecipient,
            timestamp: block.timestamp,
            confirmations: 0,
            completed: false
        });

        emit BridgeInitiated(transferId, msg.sender, token, netAmount, tonRecipient, fee);
    }

    function confirmTransfer(bytes32 transferId) external onlyRole(RELAYER_ROLE) {
        Transfer storage transfer = transfers[transferId];
        if (transfer.timestamp == 0) revert TransferNotFound();
        if (transfer.completed) revert AlreadyCompleted();
        if (hasConfirmed[transferId][msg.sender]) revert AlreadyConfirmed();

        hasConfirmed[transferId][msg.sender] = true;
        transfer.confirmations++;

        emit BridgeConfirmed(transferId, msg.sender);

        if (transfer.confirmations >= config.relayerThreshold) {
            transfer.completed = true;
            emit BridgeCompleted(transferId);
        }
    }

    function updateConfig(BridgeConfig calldata newConfig) external onlyRole(DEFAULT_ADMIN_ROLE) {
        config = newConfig;
        emit ConfigUpdated(newConfig);
    }

    function setSupportedToken(address token, bool supported) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function getTransfer(bytes32 transferId) external view returns (Transfer memory) {
        return transfers[transferId];
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
