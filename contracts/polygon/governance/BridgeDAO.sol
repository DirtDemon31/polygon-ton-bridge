// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorTimelockControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title BridgeDAO
 * @notice Decentralized governance for the Polygon-TON bridge protocol
 * @dev Full OpenZeppelin Governor implementation with timelock
 * 
 * Features:
 * - Token-based voting (wTON or governance token)
 * - Proposal creation and voting
 * - Timelock for security
 * - Quorum requirements
 * - Upgradeable bridge parameters
 * - Relayer management via governance
 */
contract BridgeDAO is
    Initializable,
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorCountingSimpleUpgradeable,
    GovernorVotesUpgradeable,
    GovernorVotesQuorumFractionUpgradeable,
    GovernorTimelockControlUpgradeable
{
    /// @notice Events
    event RelayerProposed(address indexed relayer, bool add);
    event BridgeParameterChanged(string parameter, uint256 oldValue, uint256 newValue);
    event EmergencyActionExecuted(address indexed target, bytes data);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the DAO
     * @param _token Governance token address (wTON or governance token)
     * @param _timelock Timelock controller address
     */
    function initialize(
        IVotes _token,
        TimelockControllerUpgradeable _timelock
    ) external initializer {
        __Governor_init("BridgeDAO");
        __GovernorSettings_init(
            7200,      // 1 day voting delay (assuming 12s blocks)
            50400,     // 1 week voting period
            1000e18    // 1000 token proposal threshold
        );
        __GovernorCountingSimple_init();
        __GovernorVotes_init(_token);
        __GovernorVotesQuorumFraction_init(4); // 4% quorum
        __GovernorTimelockControl_init(_timelock);
    }

    /**
     * @notice Create proposal to add/remove relayer
     * @param relayer Relayer address
     * @param add True to add, false to remove
     * @return proposalId Proposal identifier
     */
    function proposeRelayerChange(
        address relayer,
        bool add,
        address bridge,
        string memory description
    ) external returns (uint256) {
        require(relayer != address(0), "Invalid relayer");

        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        targets[0] = bridge;
        values[0] = 0;

        if (add) {
            calldatas[0] = abi.encodeWithSignature(
                "grantRole(bytes32,address)",
                keccak256("RELAYER_ROLE"),
                relayer
            );
        } else {
            calldatas[0] = abi.encodeWithSignature(
                "revokeRole(bytes32,address)",
                keccak256("RELAYER_ROLE"),
                relayer
            );
        }

        emit RelayerProposed(relayer, add);

        return propose(targets, values, calldatas, description);
    }

    /**
     * @notice Create proposal to update bridge configuration
     * @param bridge Bridge contract address
     * @param minAmount New minimum bridge amount
     * @param maxAmount New maximum bridge amount
     * @param feeBps New fee in basis points
     * @param threshold New relayer threshold
     * @param description Proposal description
     */
    function proposeBridgeConfigUpdate(
        address bridge,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 feeBps,
        uint256 threshold,
        string memory description
    ) external returns (uint256) {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        targets[0] = bridge;
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature(
            "updateConfig((uint256,uint256,uint256,uint256,bool))",
            minAmount,
            maxAmount,
            feeBps,
            threshold,
            true
        );

        return propose(targets, values, calldatas, description);
    }

    // Required overrides

    function votingDelay()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(GovernorUpgradeable, GovernorVotesQuorumFractionUpgradeable)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function state(uint256 proposalId)
        public
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function proposalThreshold()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(GovernorUpgradeable, GovernorTimelockControlUpgradeable) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(GovernorUpgradeable, GovernorTimelockControlUpgradeable) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(GovernorUpgradeable, GovernorTimelockControlUpgradeable) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (address)
    {
        return super._executor();
    }
}
