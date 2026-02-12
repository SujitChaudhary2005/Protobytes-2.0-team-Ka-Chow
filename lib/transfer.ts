/**
 * Fund Transfer Abstraction Layer
 *
 * Provides a unified interface for actual money movement.
 * In production, this integrates with:
 *   - Nepal Clearing House (connectIPS)
 *   - Banking Switch API (NRB)
 *   - eSewa / Khalti payment gateways
 *
 * For the MVP, it simulates the transfer and returns
 * realistic response objects matching the connectIPS spec.
 */

export type TransferStatus =
    | "initiated"
    | "processing"
    | "completed"
    | "failed"
    | "reversed";

export interface TransferRequest {
    /** Unique transaction reference from UPA Pay */
    txId: string;
    /** Source: payer's bank account or wallet */
    source: {
        accountNumber?: string;
        walletId?: string;
        provider: "connectIPS" | "esewa" | "khalti" | "upa_wallet";
    };
    /** Destination: government entity's account */
    destination: {
        upaAddress: string;
        accountNumber?: string;
        bankCode?: string;
    };
    /** Amount in NPR (paisa precision) */
    amount: number;
    currency: "NPR";
    /** Purpose/intent of the payment */
    purpose: string;
    /** Payer identity */
    payerName: string;
    payerId: string;
}

export interface TransferResponse {
    /** Unique transfer reference from the clearing house */
    transferId: string;
    /** UPA Pay transaction ID */
    txId: string;
    status: TransferStatus;
    /** Reference number from the bank */
    bankReference?: string;
    /** Timestamp when the transfer was completed */
    completedAt?: string;
    /** Error message if failed */
    errorMessage?: string;
    /** Fee charged for the transfer */
    fee: number;
    /** Net amount transferred (after fees) */
    netAmount: number;
}

export interface TransferProvider {
    name: string;
    initiate(request: TransferRequest): Promise<TransferResponse>;
    checkStatus(transferId: string): Promise<TransferResponse>;
    reverse(transferId: string, reason: string): Promise<TransferResponse>;
}

// ─── connectIPS Integration (Production) ─────────────────────
class ConnectIPSProvider implements TransferProvider {
    name = "connectIPS";

    async initiate(request: TransferRequest): Promise<TransferResponse> {
        // In production: POST to connectIPS API
        // const response = await fetch('https://api.connectips.com/transfers', {
        //   method: 'POST',
        //   headers: {
        //     'Authorization': `Bearer ${process.env.CONNECTIPS_API_KEY}`,
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify({
        //     debitAccount: request.source.accountNumber,
        //     creditAccount: request.destination.accountNumber,
        //     amount: request.amount,
        //     purpose: request.purpose,
        //     remarks: `UPA Pay - ${request.txId}`,
        //   }),
        // });

        // Simulate processing delay
        await new Promise((r) => setTimeout(r, 500));

        const transferId = `CIP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const fee = Math.min(request.amount * 0.005, 50); // 0.5% fee, max NPR 50

        return {
            transferId,
            txId: request.txId,
            status: "completed",
            bankReference: `NRB/${new Date().getFullYear()}/${transferId.slice(-5)}`,
            completedAt: new Date().toISOString(),
            fee,
            netAmount: request.amount - fee,
        };
    }

    async checkStatus(transferId: string): Promise<TransferResponse> {
        return {
            transferId,
            txId: "",
            status: "completed",
            completedAt: new Date().toISOString(),
            fee: 0,
            netAmount: 0,
        };
    }

    async reverse(transferId: string, reason: string): Promise<TransferResponse> {
        await new Promise((r) => setTimeout(r, 300));
        return {
            transferId: `REV-${transferId}`,
            txId: "",
            status: "reversed",
            fee: 0,
            netAmount: 0,
            errorMessage: `Reversed: ${reason}`,
        };
    }
}

// ─── Demo Provider (MVP) ──────────────────────────────────────
class DemoProvider implements TransferProvider {
    name = "demo";

    async initiate(request: TransferRequest): Promise<TransferResponse> {
        await new Promise((r) => setTimeout(r, 300));

        const transferId = `DEMO-${Date.now()}`;
        return {
            transferId,
            txId: request.txId,
            status: "completed",
            bankReference: `DEMO-REF-${Math.random().toString(36).slice(2, 7)}`,
            completedAt: new Date().toISOString(),
            fee: 0,
            netAmount: request.amount,
        };
    }

    async checkStatus(transferId: string): Promise<TransferResponse> {
        return {
            transferId,
            txId: "",
            status: "completed",
            completedAt: new Date().toISOString(),
            fee: 0,
            netAmount: 0,
        };
    }

    async reverse(transferId: string, reason: string): Promise<TransferResponse> {
        return {
            transferId: `REV-${transferId}`,
            txId: "",
            status: "reversed",
            fee: 0,
            netAmount: 0,
            errorMessage: `Reversed: ${reason}`,
        };
    }
}

// ─── Factory ──────────────────────────────────────────────────

const providers: Record<string, TransferProvider> = {
    connectIPS: new ConnectIPSProvider(),
    demo: new DemoProvider(),
};

/**
 * Get the active transfer provider.
 * Reads from env or falls back to demo.
 */
export function getTransferProvider(): TransferProvider {
    const providerName = process.env.NEXT_PUBLIC_TRANSFER_PROVIDER || "demo";
    return providers[providerName] || providers.demo;
}

/**
 * Initiate a fund transfer
 */
export async function initiateTransfer(
    request: TransferRequest
): Promise<TransferResponse> {
    const provider = getTransferProvider();
    return provider.initiate(request);
}

/**
 * Check transfer status
 */
export async function checkTransferStatus(
    transferId: string
): Promise<TransferResponse> {
    const provider = getTransferProvider();
    return provider.checkStatus(transferId);
}

/**
 * Reverse a transfer
 */
export async function reverseTransfer(
    transferId: string,
    reason: string
): Promise<TransferResponse> {
    const provider = getTransferProvider();
    return provider.reverse(transferId, reason);
}
