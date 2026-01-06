// relayer/src/tonService.ts
import { TonClient, WalletContractV4, internal, toNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { Address } from "@ton/core";
import dotenv from "dotenv";
import path from "path";

// Load root .env so TON_* vars are available
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

export interface TonTransferResult {
    success: boolean;
    tonTxId: string;
    errorMessage?: string;
}

async function createClient(): Promise<TonClient> {
    const endpoint =
        process.env.TON_RPC_URL || "https://testnet.toncenter.com/api/v2/jsonRPC";
    console.log("🔗 [TON] Connecting to endpoint:", endpoint);
    return new TonClient({ endpoint });
}

/**
 * Send native TON from a relayer-controlled wallet to the given recipient.
 *
 * Environment variables required:
 *  - TON_RPC_URL: TON HTTP JSON-RPC endpoint (Toncenter, QuickNode, etc.)
 *  - TON_MNEMONIC: space-separated 24-word mnemonic for the relayer wallet
 */
export async function sendNativeTon(
    tonRecipient: string,
    amountTon: string
): Promise<TonTransferResult> {
    const mnemonic = process.env.TON_MNEMONIC;

    if (!mnemonic) {
        throw new Error("TON_MNEMONIC is not set in .env");
    }

    const words = mnemonic.trim().split(/\s+/);
    const keyPair = await mnemonicToPrivateKey(words);

    const workchain = 0;
    const wallet = WalletContractV4.create({
        workchain,
        publicKey: keyPair.publicKey,
    });

    const client = await createClient();
    const walletContract = client.open(wallet);
    const walletAddress = walletContract.address;
    console.log("[TON] Relayer wallet address:", walletAddress.toString());

    const recipient = Address.parse(tonRecipient);

    // Simple retry loop for transient RPC errors (e.g. 429 rate limit).
    const maxRetries = 3;
    const baseDelayMs = 2_000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const seqno = await walletContract.getSeqno();
            console.log("[TON] Current wallet seqno:", seqno.toString());

            const amountNano = toNano(amountTon);
            console.log("[TON] Sending TON...");
            console.log("     to:    ", recipient.toString());
            console.log("     amount:", amountTon, "TON");
            console.log("     attempt:", attempt, "/", maxRetries, "\n");

            await walletContract.sendTransfer({
                secretKey: keyPair.secretKey,
                seqno,
                messages: [
                    internal({
                        to: recipient,
                        value: amountNano,
                        body: null,
                    }),
                ],
            });

            const pseudoTxId = `ton-${walletAddress.toString()}-${seqno}`;
            console.log("[TON] Transfer sent. Reference:", pseudoTxId, "\n");

            return {
                success: true,
                tonTxId: pseudoTxId,
            };
        } catch (err: any) {
            const msg = err?.message || String(err);
            console.log("[TON] Error during send attempt:", msg);

            // If this is the last attempt, give up.
            if (attempt === maxRetries) {
                console.log("[TON] Max retries reached. Giving up on TON send.\n");
                return {
                    success: false,
                    tonTxId: "",
                    errorMessage: msg,
                };
            }

            // Backoff before retrying (handles 429 rate limits from Toncenter).
            const delayMs = baseDelayMs * attempt;
            console.log(
                `[TON] Will retry in ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1
                } of ${maxRetries})...\n`
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    // Should never reach here, but TypeScript wants a return.
    return {
        success: false,
        tonTxId: "",
        errorMessage: "Unknown TON send failure",
    };
}
