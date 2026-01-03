// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title WrappedTON
 * @notice ERC20 representation of TON tokens on Polygon
 * @dev Implements mint/burn mechanism for bridge operations
 * 
 * Features:
 * - Mintable by bridge contract only
 * - Burnable for bridging back to TON
 * - Pausable for emergencies
 * - Role-based access control
 * - Gas-optimized ERC20 implementation
 */
contract WrappedTON is 
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable
{
    /// @notice Role identifiers
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Bridge contract address
    address public bridge;

    /// @notice Events
    event BridgeUpdated(address indexed oldBridge, address indexed newBridge);
    event TokensMinted(address indexed to, uint256 amount, bytes32 tonTxHash);
    event TokensBurned(address indexed from, uint256 amount, string tonRecipient);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the WrappedTON token
     * @param _admin Admin address
     * @param _bridge Bridge contract address
     */
    function initialize(address _admin, address _bridge) external initializer {
        require(_admin != address(0), "Invalid admin");
        require(_bridge != address(0), "Invalid bridge");

        __ERC20_init("Wrapped TON", "wTON");
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MINTER_ROLE, _bridge);
        _grantRole(PAUSER_ROLE, _admin);

        bridge = _bridge;
    }

    /**
     * @notice Mint wrapped TON tokens (called by bridge)
     * @param to Recipient address
     * @param amount Amount to mint
     * @param tonTxHash Originating TON transaction hash
     */
    function mint(
        address to,
        uint256 amount,
        bytes32 tonTxHash
    ) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");

        _mint(to, amount);
        emit TokensMinted(to, amount, tonTxHash);
    }

    /**
     * @notice Burn tokens to bridge back to TON
     * @param amount Amount to burn
     * @param tonRecipient TON recipient address (base64)
     */
    function burnForBridge(uint256 amount, string calldata tonRecipient) external {
        require(bytes(tonRecipient).length > 0, "Invalid recipient");
        require(amount > 0, "Invalid amount");

        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount, tonRecipient);
    }

    /**
     * @notice Update bridge address
     * @param newBridge New bridge contract address
     */
    function updateBridge(address newBridge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newBridge != address(0), "Invalid bridge");
        
        address oldBridge = bridge;
        
        // Revoke old bridge minter role
        _revokeRole(MINTER_ROLE, oldBridge);
        
        // Grant new bridge minter role
        _grantRole(MINTER_ROLE, newBridge);
        
        bridge = newBridge;

        emit BridgeUpdated(oldBridge, newBridge);
    }

    /**
     * @notice Pause token transfers
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause token transfers
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Decimals (9 to match TON)
     */
    function decimals() public pure override returns (uint8) {
        return 9;
    }

    /**
     * @dev Required override for multiple inheritance
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        super._update(from, to, value);
    }
}
