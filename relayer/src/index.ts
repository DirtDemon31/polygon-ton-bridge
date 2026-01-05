// relayer/src/index.ts
import { ethers } from "ethers";
import {
    POLYGON_RPC,
    BRIDGE_ADDRESS,
    RELAYER_PRIVATE_KEY,
    POLL_INTERVAL,
} from "./config";
import { POLYGON_BRIDGE_ABI } from "./abi";
import { sendNativeTon } from "./tonService";

async function main() {
    if (!RELAYER_PRIVATE_KEY) {
        throw new Error("Set PRIVATE_KEY in your .env for the relayer");
    }

    console.log("🔗 Connecting to Polygon Amoy RPC:", POLYGON_RPC);
    const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
    const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

    console.log("Relayer address:", await wallet.getAddress());
    console.log("Bridge address: ", BRIDGE_ADDRESS, "\n");

    const bridge = new ethers.Contract(
        BRIDGE_ADDRESS,
        POLYGON_BRIDGE_ABI,
        wallet
    );

    let lastBlock = await provider.getBlockNumber();
    console.log("Starting from block:", lastBlock, "\n");

    async function poll() {
        try {
            const current = await provider.getBlockNumber();
            if (current <= lastBlock) {
                return;
            }

            const from = lastBlock + 1;
            const to = current;
            lastBlock = current;

            console.log(`🔎 Scanning blocks [${from}, ${to}] for bridge events…`);

            const filter = {
                address: BRIDGE_ADDRESS,
                fromBlock: from,
                toBlock: to,
                topics: [
                    ethers.id(
                        "BridgeInitiated(bytes32,address,address,uint256,string,uint256)"
                    ),
                ],
            };

            const logs = await provider.getLogs(filter);
            if (logs.length === 0) {
                console.log("No BridgeInitiated events in this range.\n");
                return;
            }

            for (const log of logs) {
                const parsed = bridge.interface.parseLog(log);
                if (!parsed) continue;

                const {
                    transferId,
                    sender,
                    token,
                    amount,
                    tonRecipient,
                    fee,
                } = parsed.args as any;

                console.log("📦 New BridgeInitiated event:");
                console.log("  transferId:   ", transferId);
                console.log("  sender:       ", sender);
                console.log("  token:        ", token);
                console.log("  amount (net): ", ethers.formatEther(amount));
                console.log("  tonRecipient: ", tonRecipient);
                console.log("  fee:          ", ethers.formatEther(fee), "\n");

                // 1) Read full on-chain transfer struct (for debugging / safety)
                const t = await bridge.getTransfer(transferId);
                console.log("  ↳ On-chain Transfer struct:");
                console.log("     sender:        ", t.sender);
                console.log("     token:         ", t.token);
                console.log("     amount:        ", ethers.formatEther(t.amount));
                console.log("     tonRecipient:  ", t.tonRecipient);
                console.log("     timestamp:     ", t.timestamp.toString());
                console.log("     confirmations: ", t.confirmations.toString());
                console.log("     completed:     ", t.completed, "\n");

                if (t.completed) {
                    console.log("  ↳ Transfer already completed on Polygon. Skipping.\n");
                    continue;
                }

                // 2) TON side: send native TON (stubbed)
                const amountTon = ethers.formatEther(t.amount); // interpret 1 POL as 1 TON for now
                const tonResult = await sendNativeTon(t.tonRecipient, amountTon);

                if (!tonResult.success) {
                    console.log(
                        "⚠️  TON transfer failed or not confirmed. Skipping confirmTransfer for now.\n"
                    );
                    continue;
                }

                console.log(
                    "✅ [TON] Transfer simulated with tx id:",
                    tonResult.tonTxId,
                    "\n"
                );

                // 3) Confirm transfer on Polygon as relayer
                console.log("✅ Calling confirmTransfer on Polygon...");
                const confirmTx = await bridge.confirmTransfer(transferId);
                const confirmReceipt = await confirmTx.wait();
                console.log("   confirmTransfer tx hash:", confirmReceipt?.hash);

                const tAfter = await bridge.getTransfer(transferId);
                console.log("  ↳ Transfer after confirmation:");
                console.log("     confirmations: ", tAfter.confirmations.toString());
                console.log("     completed:     ", tAfter.completed, "\n");
            }
        } catch (err: any) {
            console.error("Poll error:", err.message || err);
        }
    }

    setInterval(poll, POLL_INTERVAL);
}

main().catch((err) => {
    console.error("Fatal relayer error:", err);
    process.exit(1);
});
