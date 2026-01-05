// scripts/bridgeOnAmoy.ts
import hre from "hardhat";
const { ethers } = hre;

async function main() {
    console.log("🌉 Starting bridgeToTON on Polygon Amoy...\n");

    // Your PolygonBridge proxy on Amoy
    const BRIDGE_ADDRESS = "0x0855Ea23Bdec73dE3741F3A34259DCb8b400930B";

    const [signer] = await ethers.getSigners();
    console.log("Using signer:", signer.address);

    const bridge = await ethers.getContractAt("PolygonBridge", BRIDGE_ADDRESS);

    // Small amount of native POL to bridge (0.1)
    const amount = ethers.parseEther("0.1");
    const tonRecipient = "EQC_example_TON_address_base64url";

    console.log("Calling bridgeToTON...");
    console.log("  tonRecipient:", tonRecipient);
    console.log("  token:       native (address(0))");
    console.log("  amount:      ", ethers.formatEther(amount), "POL\n");

    const tx = await bridge.bridgeToTON(
        tonRecipient,
        ethers.ZeroAddress, // native token
        amount,
        { value: amount }
    );

    console.log("Tx sent, waiting for confirmation...");
    const receipt = await tx.wait();

    console.log("\n✅ bridgeToTON mined.");
    console.log("  tx hash:", receipt?.hash);
    console.log("  block:  ", receipt?.blockNumber, "\n");
}

main().catch((err) => {
    console.error("❌ Error in bridgeOnAmoy script:", err);
    process.exit(1);
});
