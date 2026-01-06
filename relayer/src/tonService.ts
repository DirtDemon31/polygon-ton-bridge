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
    const endpoint =
        process.env.TON_RPC_URL || "https://toncenter.com/api/v2/jsonRPC";
    const mnemonic = process.env.TON_MNEMONIC;

    if (!mnemonic) {
        throw new Error("TON_MNEMONIC is not set in .env");
    }

    console.log("🔗 [TON] Connecting to endpoint:", endpoint);

    const client = new TonClient({ endpoint });

    // Derive key pair from mnemonic
    const words = mnemonic.trim().split(/\s+/);
    const keyPair = await mnemonicToPrivateKey(words);

    const workchain = 0;
    const wallet = WalletContractV4.create({
        workchain,
        publicKey: keyPair.publicKey,
    });

    const walletContract = client.open(wallet);
    const walletAddress = walletContract.address;
    console.log("[TON] Relayer wallet address:", walletAddress.toString());

    const recipient = Address.parse(tonRecipient);

    const seqno = await walletContract.getSeqno();
    console.log("[TON] Current wallet seqno:", seqno.toString());

    const amountNano = toNano(amountTon);
    console.log("[TON] Sending TON...");
    console.log("     to:    ", recipient.toString());
    console.log("     amount:", amountTon, "TON\n");

    const txResult = await walletContract.sendTransfer({
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

    // txResult is not a hash, but we can log seqno+address as reference
    const pseudoTxId = `ton-${walletAddress.toString()}-${seqno}`;

    console.log("[TON] Transfer sent. Reference:", pseudoTxId, "\n");

    return {
        success: true,
        tonTxId: pseudoTxId,
    };
}
