import Dexie, { Table } from "dexie";

export interface QueuedTransaction {
    id?: number;
    payload: string;
    signature: string;
    publicKey: string;
    timestamp: number;
    nonce: string;
    recipient: string;
    amount: number;
    intent: string;
    metadata?: Record<string, string>;
    status: "queued" | "syncing" | "settled" | "failed";
    syncedAt?: number;
    error?: string;
}

class OfflineDB extends Dexie {
    transactions!: Table<QueuedTransaction>;

    constructor() {
        super("UPAOfflineDB");
        this.version(1).stores({
            transactions: "++id, timestamp, status, recipient",
        });
    }
}

export const db = new OfflineDB();

/**
 * Queue a transaction for offline sync
 */
export async function queueTransaction(
    transaction: Omit<QueuedTransaction, "id" | "status">
): Promise<number> {
    return (await db.transactions.add({
        ...transaction,
        status: "queued",
    })) as number;
}

/**
 * Get all queued transactions
 */
export async function getQueuedTransactions(): Promise<QueuedTransaction[]> {
    return await db.transactions
        .where("status")
        .anyOf(["queued", "syncing"])
        .sortBy("timestamp");
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
    id: number,
    status: QueuedTransaction["status"],
    error?: string
): Promise<void> {
    await db.transactions.update(id, {
        status,
        syncedAt: status === "settled" ? Date.now() : undefined,
        error,
    });
}

/**
 * Clear settled transactions older than 7 days
 */
export async function clearOldTransactions(): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  await db.transactions
    .where("timestamp")
    .below(sevenDaysAgo)
    .and((tx) => tx.status === "settled")
    .delete();
}

/**
 * Get all transactions for sync
 */
export async function getAllTransactionsForSync(): Promise<QueuedTransaction[]> {
  return await db.transactions
    .where("status")
    .anyOf(["queued", "syncing"])
    .toArray();
}

