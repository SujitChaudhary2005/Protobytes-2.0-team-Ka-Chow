// Local storage-based data management (replaces Supabase)

export interface Transaction {
  id: string;
  recipient: string;
  recipientName?: string;
  amount: number;
  intent: string;
  metadata?: Record<string, string>;
  status: "pending" | "settled" | "failed" | "queued";
  signature?: string;
  publicKey?: string;
  timestamp: number;
  nonce?: string;
  walletProvider?: string;
  mode?: "online" | "offline";
}

export interface PaymentRequest {
  id: string;
  recipient: string;
  recipient_name?: string;
  amount: number;
  intent: string;
  metadata?: Record<string, string>;
  qr_data: string;
  signature: string;
  public_key: string;
  expires_at: string;
  created_at: string;
}

const STORAGE_KEYS = {
  transactions: "upa_transactions_db",
  paymentRequests: "upa_payment_requests_db",
};

/**
 * Get all transactions from local storage
 */
export function getTransactions(): Transaction[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.transactions);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Save transaction
 */
export function saveTransaction(transaction: Transaction): void {
  if (typeof window === "undefined") return;
  
  const transactions = getTransactions();
  transactions.unshift(transaction);
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
}

/**
 * Update transaction status
 */
export function updateTransactionStatus(
  id: string,
  status: Transaction["status"]
): void {
  if (typeof window === "undefined") return;
  
  const transactions = getTransactions();
  const index = transactions.findIndex((t) => t.id === id);
  if (index !== -1) {
    transactions[index].status = status;
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
  }
}

/**
 * Submit a transaction (mock)
 */
export async function submitTransaction(
  signedPayload: {
    payload: string;
    signature: string;
    publicKey: string;
    timestamp: number;
    nonce: string;
  }
): Promise<Transaction> {
  const payload = JSON.parse(signedPayload.payload);
  
  const transaction: Transaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    recipient: payload.recipient,
    recipientName: payload.recipientName,
    amount: payload.amount,
    intent: payload.intent,
    metadata: payload.metadata,
    status: "settled",
    signature: signedPayload.signature,
    publicKey: signedPayload.publicKey,
    timestamp: signedPayload.timestamp,
    nonce: signedPayload.nonce,
    walletProvider: "UPA Pay",
    mode: "online",
  };

  saveTransaction(transaction);
  return transaction;
}

/**
 * Sync queued transactions
 */
export async function syncQueuedTransactions(
  transactions: Array<{
    payload: string;
    signature: string;
    publicKey: string;
    timestamp: number;
    nonce: string;
  }>
): Promise<void> {
  transactions.forEach((tx) => {
    const payload = JSON.parse(tx.payload);
    const transaction: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recipient: payload.recipient,
      recipientName: payload.recipientName,
      amount: payload.amount,
      intent: payload.intent,
      metadata: payload.metadata,
      status: "settled",
      signature: tx.signature,
      publicKey: tx.publicKey,
      timestamp: tx.timestamp,
      nonce: tx.nonce,
      walletProvider: "UPA Pay",
      mode: "offline",
    };
    saveTransaction(transaction);
  });
}

/**
 * Create a payment request
 */
export async function createPaymentRequest(
  request: Omit<PaymentRequest, "id" | "created_at">
): Promise<PaymentRequest> {
  const paymentRequest: PaymentRequest = {
    ...request,
    id: `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.paymentRequests);
      const requests = stored ? JSON.parse(stored) : [];
      requests.push(paymentRequest);
      localStorage.setItem(STORAGE_KEYS.paymentRequests, JSON.stringify(requests));
    } catch {
      // Ignore errors
    }
  }

  return paymentRequest;
}

/**
 * Get payment request by ID
 */
export async function getPaymentRequest(
  id: string
): Promise<PaymentRequest | null> {
  if (typeof window === "undefined") return null;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.paymentRequests);
    if (!stored) return null;
    const requests: PaymentRequest[] = JSON.parse(stored);
    return requests.find((r) => r.id === id) || null;
  } catch {
    return null;
  }
}

