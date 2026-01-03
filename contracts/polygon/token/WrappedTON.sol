// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract WrappedTON is 
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    address public bridge;

    event BridgeUpdated(address indexed oldBridge, address indexed newBridge);
    event TokensMinted(address indexed to, uint256 amount, bytes32 tonTxHash);
    event TokensBurned(address indexed from, uint256 amount, string tonRecipient);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _admin, address _bridge) external initializer {
        require(_admin != address(0), "Invalid admin");

        __ERC20_init("Wrapped TON", "wTON");
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);

        if (_bridge != address(0)) {
            _grantRole(MINTER_ROLE, _bridge);
            bridge = _bridge;
        }
    }

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

    function burnForBridge(uint256 amount, string calldata tonRecipient) external {
        require(bytes(tonRecipient).length > 0, "Invalid recipient");
        require(amount > 0, "Invalid amount");

        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount, tonRecipient);
    }

    function updateBridge(address newBridge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newBridge != address(0), "Invalid bridge");
        
        address oldBridge = bridge;
        
        if (oldBridge != address(0)) {
            _revokeRole(MINTER_ROLE, oldBridge);
        }
        
        _grantRole(MINTER_ROLE, newBridge);
        bridge = newBridge;

        emit BridgeUpdated(oldBridge, newBridge);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function decimals() public pure override returns (uint8) {
        return 9;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        super._update(from, to, value);
    }
}
