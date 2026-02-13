import Dexie, { Table } from "dexie";
import type { OfflineAcceptedTx, SettlementState } from "@/types";

// ── Queued transaction (existing, extended) ────────────────────────

export interface QueuedTransaction {
    id?: number;
    client_tx_id?: string;       // Stable UUID for idempotent sync
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
    settlement_state?: SettlementState;
    syncedAt?: number;
    error?: string;
    sync_attempts?: number;
}

// ── Dexie Database ─────────────────────────────────────────────────

class OfflineDB extends Dexie {
    transactions!: Table<QueuedTransaction>;
    offlineAcceptedTxs!: Table<OfflineAcceptedTx>;

    constructor() {
        super("UPAOfflineDB");

        // Version 1: original schema
        this.version(1).stores({
            transactions: "++id, timestamp, status, recipient",
        });

        // Version 2: add offline accepted txs table + new indexes
        this.version(2).stores({
            transactions: "++id, timestamp, status, recipient, nonce, client_tx_id, settlement_state",
            offlineAcceptedTxs: "++id, client_tx_id, settlement_state, acceptedAt, expiresAt, senderUPA, receiverUPA",
        });
    }
}

export const db = new OfflineDB();

// ── Queue Operations ───────────────────────────────────────────────

/**
 * Queue a transaction for offline sync
 */
export async function queueTransaction(
    transaction: Omit<QueuedTransaction, "id" | "status">
): Promise<number> {
    return (await db.transactions.add({
        ...transaction,
        status: "queued",
        settlement_state: "sync_pending",
        sync_attempts: 0,
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

// ── Offline Accepted Tx Operations ─────────────────────────────────

/**
 * Save an offline accepted transaction (sender or receiver side)
 */
export async function saveOfflineAcceptedTx(
    tx: Omit<OfflineAcceptedTx, "id">
): Promise<number> {
    return (await db.offlineAcceptedTxs.add(tx)) as number;
}

/**
 * Get all offline accepted txs that need syncing
 */
export async function getOfflineTxsToSync(): Promise<OfflineAcceptedTx[]> {
    return await db.offlineAcceptedTxs
        .where("settlement_state")
        .anyOf(["accepted_offline", "sync_pending"])
        .toArray();
}

/**
 * Update settlement state of an offline accepted tx by client_tx_id
 */
export async function updateOfflineTxState(
    clientTxId: string,
    state: SettlementState,
    extra?: Partial<OfflineAcceptedTx>
): Promise<void> {
    const items = await db.offlineAcceptedTxs
        .where("client_tx_id")
        .equals(clientTxId)
        .toArray();

    for (const item of items) {
        await db.offlineAcceptedTxs.update(item.id!, {
            settlement_state: state,
            ...extra,
        });
    }
}

/**
 * Get daily offline spend for a user (by sender UPA)
 */
export async function getDailyOfflineSpend(senderUPA: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startMs = startOfDay.getTime();

    const txs = await db.offlineAcceptedTxs
        .where("senderUPA")
        .equals(senderUPA)
        .filter((tx) =>
            tx.acceptedAt >= startMs &&
            tx.settlement_state !== "reversed" &&
            tx.settlement_state !== "rejected" &&
            tx.settlement_state !== "expired"
        )
        .toArray();

    return txs.reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Check for expired offline transactions and mark them
 */
export async function markExpiredOfflineTxs(): Promise<OfflineAcceptedTx[]> {
    const now = Date.now();
    const expired = await db.offlineAcceptedTxs
        .where("settlement_state")
        .anyOf(["accepted_offline", "sync_pending"])
        .filter((tx) => tx.expiresAt < now)
        .toArray();

    for (const tx of expired) {
        await db.offlineAcceptedTxs.update(tx.id!, {
            settlement_state: "expired",
            rejection_reason: "sync_deadline_exceeded",
        });
    }

    return expired;
}

/**
 * Get an offline accepted tx by client_tx_id
 */
export async function getOfflineTxByClientId(
    clientTxId: string
): Promise<OfflineAcceptedTx | undefined> {
    return await db.offlineAcceptedTxs
        .where("client_tx_id")
        .equals(clientTxId)
        .first();
}
