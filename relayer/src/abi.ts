// relayer/src/abi.ts

// Minimal ABI for PolygonBridge used by the relayer.
// Matches contracts/polygon/bridge/PolygonBridge.sol exactly.

export const POLYGON_BRIDGE_ABI = [
    // Events
    "event BridgeInitiated(bytes32 indexed transferId, address indexed sender, address indexed token, uint256 amount, string tonRecipient, uint256 fee)",
    "event BridgeConfirmed(bytes32 indexed transferId, address indexed relayer)",
    "event BridgeCompleted(bytes32 indexed transferId)",
    "event TokenSupported(address indexed token, bool supported)",
    "event ConfigUpdated((uint256 minBridgeAmount,uint256 maxBridgeAmount,uint256 feeBasisPoints,uint256 relayerThreshold,bool enabled) newConfig)",

    // Read-only functions
    "function RELAYER_ROLE() view returns (bytes32)",
    "function PAUSER_ROLE() view returns (bytes32)",
    "function config() view returns (uint256 minBridgeAmount,uint256 maxBridgeAmount,uint256 feeBasisPoints,uint256 relayerThreshold,bool enabled)",
    "function wrappedTON() view returns (address)",
    "function transferNonce() view returns (uint256)",
    "function supportedTokens(address token) view returns (bool)",
    "function hasConfirmed(bytes32 transferId, address relayer) view returns (bool)",
    "function getTransfer(bytes32 transferId) view returns (address sender,address token,uint256 amount,string tonRecipient,uint256 timestamp,uint256 confirmations,bool completed)",

    // State-changing functions the relayer / admin may use
    "function bridgeToTON(string tonRecipient, address token, uint256 amount) payable",
    "function confirmTransfer(bytes32 transferId)",
    "function updateConfig((uint256 minBridgeAmount,uint256 maxBridgeAmount,uint256 feeBasisPoints,uint256 relayerThreshold,bool enabled) newConfig)",
    "function setSupportedToken(address token, bool supported)",
    "function pause()",
    "function unpause()",
];
