export interface PaymentIntent {
    recipient: string;
    recipientName: string;
    amount: number;
    intent: string;
    metadata?: Record<string, string>;
    signature?: string;
    publicKey?: string;
    timestamp?: number;
    nonce?: string;
}

export interface Wallet {
    id: string;
    name: string;
    balance: number;
    address: string;
    publicKey: string;
}

export interface Transaction {
    id: string;
    recipient: string;
    recipientName?: string;
    amount: number;
    intent: string;
    metadata?: Record<string, string>;
    status: "pending" | "settled" | "failed" | "queued";
    timestamp: number;
    txHash?: string;
}

export interface BankAccount {
    id: string;
    bankName: string;
    accountNumber: string;
    accountType: string;
    balance?: number;
    linkedAt: string;
}

export interface QRType {
    type: "UPA-NP" | "eSewa" | "Khalti" | "IME Pay" | "Bank QR";
    cost: number;
    available: boolean;
}

export interface NetworkStatus {
    online: boolean;
    lastChecked: number;
}

