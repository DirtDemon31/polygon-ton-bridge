// scripts/testBridge.local.ts
import hre from "hardhat";
const { ethers } = hre;
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

async function main() {
    console.log("🧪 Starting local bridge test (bytes32 id)…\n");

    const [deployer, user, relayer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("User:    ", user.address);
    console.log("Relayer: ", relayer.address, "\n");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const deploymentsPath = path.join(
        __dirname,
        "..",
        "deployments",
        "hardhat-31337.json"
    );

    if (!fs.existsSync(deploymentsPath)) {
        throw new Error(
            "Run npm run deploy:local first to create hardhat-31337.json"
        );
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));

    const wrappedTON = await ethers.getContractAt(
        "WrappedTON",
        deployment.wrappedTONProxy
    );
    const bridge = await ethers.getContractAt(
        "PolygonBridge",
        deployment.polygonBridgeProxy
    );

    console.log("WrappedTON proxy:", await wrappedTON.getAddress());
    console.log("PolygonBridge proxy:", await bridge.getAddress(), "\n");

    // 1. Fund user
    console.log("💰 Funding user with native token...");
    await deployer.sendTransaction({
        to: user.address,
        value: ethers.parseEther("10"),
    });

    const userBalBefore = await ethers.provider.getBalance(user.address);
    console.log(
        "User balance before bridge:",
        ethers.formatEther(userBalBefore),
        "ETH\n"
    );

    // 2. User calls bridgeToTON
    const bridgeAsUser = bridge.connect(user);
    const amount = ethers.parseEther("1");
    const tonRecipient = "EQC_example_TON_address_base64url";

    console.log("🌉 Calling bridgeToTON (using first bytes32 id = 0x00..00)...");
    const tx = await bridgeAsUser.bridgeToTON(
        tonRecipient,
        ethers.ZeroAddress, // native token
        amount,
        { value: amount }
    );
    const receipt = await tx.wait();
    console.log("bridgeToTON tx hash:", receipt?.hash, "\n");

    const userBalAfter = await ethers.provider.getBalance(user.address);
    console.log(
        "User balance after bridge:",
        ethers.formatEther(userBalAfter),
        "ETH\n"
    );

    // 3. Assume first transfer uses zero bytes32 as id
    const zeroId = ethers.ZeroHash; // 0x0000....0000 (32 bytes)

    console.log("📦 Reading transfer with id 0x00…00…");
    const transfer0 = await bridge.getTransfer(zeroId);

    console.log("  sender:       ", transfer0.sender);
    console.log("  token:        ", transfer0.token);
    console.log("  amount:       ", ethers.formatEther(transfer0.amount));
    console.log("  tonRecipient: ", transfer0.tonRecipient);
    console.log("  confirmations:", transfer0.confirmations.toString());
    console.log("  completed:    ", transfer0.completed, "\n");

    if (transfer0.sender === ethers.ZeroAddress) {
        throw new Error(
            "Transfer(0x00..00) has sender=0x0. Either transfers use a different id scheme or nothing was recorded."
        );
    }

    // 4. Grant relayer role and confirm the transfer
    const RELAYER_ROLE = await bridge.RELAYER_ROLE();
    console.log("Granting RELAYER_ROLE to relayer...");
    await bridge.grantRole(RELAYER_ROLE, relayer.address);

    const bridgeAsRelayer = bridge.connect(relayer);
    console.log("✅ Confirming transfer 0x00…00 as relayer…");
    const confirmTx = await bridgeAsRelayer.confirmTransfer(zeroId);
    await confirmTx.wait();

    const transfer0After = await bridge.getTransfer(zeroId);
    console.log("\n📦 Transfer 0x00…00 after confirmation:");
    console.log("  confirmations:", transfer0After.confirmations.toString());
    console.log("  completed:    ", transfer0After.completed);

    console.log("\n🎉 Local bridge flow (bytes32 id) executed successfully.\n");
}

main().catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});
