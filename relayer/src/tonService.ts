// relayer/src/tonService.ts

// This module represents the TON side of the bridge.
// For now it is a stub that only logs what would happen.
// Later it can be replaced with real TON SDK (e.g. @ton/ton, tonweb, TonAPI, etc.) [web:380][web:382]

export interface TonTransferResult {
    success: boolean;
    tonTxId: string; // placeholder for TON transaction / hash / lt
}

/**
 * Simulate sending native TON to a recipient.
 *
 * In a real implementation, this function would:
 *  - Derive a TON wallet from a mnemonic or private key.
 *  - Build a transfer message to `tonRecipient`.
 *  - Sign and send it via a TON RPC provider (Toncenter, TonAPI, QuickNode, etc.). [web:384][web:386]
 *  - Wait for finalization, then return the tx reference.
 */
export async function sendNativeTon(
    tonRecipient: string,
    amountTon: string
): Promise<TonTransferResult> {
    console.log("🚀 [TON] Simulating native TON transfer...");
    console.log("    to:    ", tonRecipient);
    console.log("    amount:", amountTon, "TON\n");

    // TODO: replace with real TON transfer logic
    // For now, return a fake tx id so the relayer flow is wired.
    const fakeTxId = `simulated-ton-tx-${Date.now()}`;

    return {
        success: true,
        tonTxId: fakeTxId,
    };
}
