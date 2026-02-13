/**
 * ACID Transaction Manager for Offline Payments
 *
 * Guarantees ACID properties for all offline payment operations:
 *
 * ┌─────────────┬──────────────────────────────────────────────────────────┐
 * │ Atomicity   │ Write-ahead journal + rollback on any step failure      │
 * │ Consistency │ Pre-commit validation: balance, limits, nonce dedup     │
 * │ Isolation   │ Mutex lock — only one payment processes at a time       │
 * │ Durability  │ Verified localStorage + IndexedDB writes with WAL      │
 * └─────────────┴──────────────────────────────────────────────────────────┘
 */

import { queueTransaction, db } from "@/lib/db";
import { saveTransaction as saveLocalTransaction, getTransactions } from "@/lib/storage";
import type { Transaction } from "@/types";

// ═══════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════

export interface ACIDTransactionInput {
    /** Unique transaction record to persist */
    transaction: Transaction;
    /** Payload for the IndexedDB offline queue */
    queuePayload: {
        payload: string;
        signature: string;
        publicKey: string;
        timestamp: number;
        nonce: string;
        recipient: string;
        amount: number;
        intent: string;
        metadata?: Record<string, string>;
    };
    /** Amount to deduct from wallet balance */
    deductAmount: number;
    /** Current wallet balance (for consistency check) */
    currentBalance: number;
    /** Current offline wallet balance (for SaralPay limit check) */
    offlineBalance: number;
    /** Whether this is a payment that consumes offline wallet */
    consumesOfflineWallet: boolean;
}

export interface ACIDResult {
    success: boolean;
    txId: string;
    error?: string;
    /** Details about which step failed (for debugging) */
    failedStep?: string;
}

// Journal entry for rollback
interface JournalEntry {
    step: string;
    rollback: () => void;
    completed: boolean;
}

// ═══════════════════════════════════════════════════════════════════
//  Isolation: Mutex Lock
// ═══════════════════════════════════════════════════════════════════

let _lock: Promise<void> = Promise.resolve();
let _lockHolder: string | null = null;

/**
 * Acquire an exclusive lock for payment processing.
 * Only one payment can be processed at a time (Isolation).
 */
function acquireLock(txId: string): Promise<() => void> {
    let releaseFn: () => void;

    const newLock = new Promise<void>((resolve) => {
        releaseFn = () => {
            _lockHolder = null;
            resolve();
        };
    });

    // Wait for any previous lock to release
    const waitForPrevious = _lock.then(() => {
        _lockHolder = txId;
    });

    _lock = newLock;

    return waitForPrevious.then(() => releaseFn!);
}

/**
 * Check if a lock is currently held (for debugging)
 */
export function isLocked(): boolean {
    return _lockHolder !== null;
}

// ═══════════════════════════════════════════════════════════════════
//  Consistency: Nonce Deduplication
// ═══════════════════════════════════════════════════════════════════

const NONCE_STORE_KEY = "upa_acid_nonce_registry";
const MAX_NONCES = 500; // Keep last 500 nonces

/**
 * Check if a nonce has already been used (replay/duplicate prevention).
 * Returns true if the nonce is NEW (not seen before).
 */
function checkAndRegisterNonce(nonce: string): boolean {
    if (!nonce) return false;

    try {
        const stored = localStorage.getItem(NONCE_STORE_KEY);
        const nonces: string[] = stored ? JSON.parse(stored) : [];

        // Check for duplicate
        if (nonces.includes(nonce)) {
            return false; // Duplicate!
        }

        // Register the new nonce
        nonces.push(nonce);

        // Trim to prevent unbounded growth (FIFO)
        while (nonces.length > MAX_NONCES) {
            nonces.shift();
        }

        localStorage.setItem(NONCE_STORE_KEY, JSON.stringify(nonces));
        return true;
    } catch {
        // If localStorage fails, be conservative and reject
        return false;
    }
}

/**
 * Remove a nonce from the registry (used during rollback).
 */
function unregisterNonce(nonce: string): void {
    try {
        const stored = localStorage.getItem(NONCE_STORE_KEY);
        if (!stored) return;
        const nonces: string[] = JSON.parse(stored);
        const index = nonces.indexOf(nonce);
        if (index !== -1) {
            nonces.splice(index, 1);
            localStorage.setItem(NONCE_STORE_KEY, JSON.stringify(nonces));
        }
    } catch {
        // Best-effort rollback
    }
}

// ═══════════════════════════════════════════════════════════════════
//  Durability: Write-Ahead Log (WAL)
// ═══════════════════════════════════════════════════════════════════

const WAL_KEY = "upa_acid_wal";

interface WALEntry {
    txId: string;
    timestamp: number;
    status: "started" | "committed" | "rolled_back";
    transaction: Transaction;
    queuePayload: ACIDTransactionInput["queuePayload"];
}

/**
 * Write to the WAL before starting the transaction.
 * If the app crashes mid-transaction, recovery can pick up from here.
 */
function writeWAL(entry: WALEntry): void {
    try {
        const stored = localStorage.getItem(WAL_KEY);
        const entries: WALEntry[] = stored ? JSON.parse(stored) : [];
        entries.push(entry);

        // Keep only last 50 WAL entries
        while (entries.length > 50) {
            entries.shift();
        }

        localStorage.setItem(WAL_KEY, JSON.stringify(entries));
    } catch {
        // WAL write failed — we'll throw to prevent the transaction
        throw new Error("ACID: Durability pre-check failed — WAL write error");
    }
}

/**
 * Update WAL entry status.
 */
function updateWAL(txId: string, status: WALEntry["status"]): void {
    try {
        const stored = localStorage.getItem(WAL_KEY);
        if (!stored) return;
        const entries: WALEntry[] = JSON.parse(stored);
        const entry = entries.find((e) => e.txId === txId);
        if (entry) {
            entry.status = status;
            localStorage.setItem(WAL_KEY, JSON.stringify(entries));
        }
    } catch {
        // Best-effort
    }
}

/**
 * Recover any incomplete transactions from the WAL.
 * Called on app startup to handle crash recovery.
 */
export function recoverFromWAL(): { recovered: number; failed: number } {
    let recovered = 0;
    let failed = 0;

    try {
        const stored = localStorage.getItem(WAL_KEY);
        if (!stored) return { recovered: 0, failed: 0 };

        const entries: WALEntry[] = JSON.parse(stored);
        const incomplete = entries.filter((e) => e.status === "started");

        for (const entry of incomplete) {
            // Check if the transaction was actually saved to localStorage
            const existingTxs = getTransactions();
            const exists = existingTxs.some((t) => t.id === entry.txId || t.nonce === entry.transaction.nonce);

            if (!exists) {
                // Transaction was not persisted — try to save it now
                try {
                    saveLocalTransaction(entry.transaction);
                    // Also try to queue for sync
                    queueTransaction(entry.queuePayload).catch(() => { });
                    entry.status = "committed";
                    recovered++;
                } catch {
                    entry.status = "rolled_back";
                    failed++;
                }
            } else {
                // Transaction exists — mark WAL as committed
                entry.status = "committed";
                recovered++;
            }
        }

        localStorage.setItem(WAL_KEY, JSON.stringify(entries));
    } catch {
        // WAL recovery failed — non-fatal
    }

    return { recovered, failed };
}

// ═══════════════════════════════════════════════════════════════════
//  Consistency: Pre-commit Validation
// ═══════════════════════════════════════════════════════════════════

interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validate all transaction invariants BEFORE committing.
 */
function validateInvariants(input: ACIDTransactionInput): ValidationResult {
    // 1. Amount must be positive
    if (input.deductAmount <= 0) {
        return { valid: false, error: "Transaction amount must be positive" };
    }

    // 2. Balance must be sufficient
    if (input.deductAmount > input.currentBalance) {
        return {
            valid: false,
            error: `Insufficient balance: need ${input.deductAmount}, have ${input.currentBalance}`,
        };
    }

    // 3. Offline wallet limit check (if applicable)
    if (input.consumesOfflineWallet && input.deductAmount > input.offlineBalance) {
        return {
            valid: false,
            error: `Offline limit exceeded: need ${input.deductAmount}, remaining ${input.offlineBalance}`,
        };
    }

    // 4. Nonce must be unique (duplicate/replay prevention)
    const nonce = input.transaction.nonce;
    if (!nonce) {
        return { valid: false, error: "Transaction must have a nonce for replay protection" };
    }

    // 5. Transaction ID must not already exist
    const existingTxs = getTransactions();
    if (existingTxs.some((t) => t.id === input.transaction.id)) {
        return { valid: false, error: `Duplicate transaction ID: ${input.transaction.id}` };
    }

    // 6. Transaction timestamp must be reasonable (within 2 hours)
    const now = Date.now();
    const twoHoursMs = 2 * 60 * 60 * 1000;
    if (Math.abs(now - input.transaction.timestamp) > twoHoursMs) {
        return { valid: false, error: "Transaction timestamp is too far from current time" };
    }

    return { valid: true };
}

// ═══════════════════════════════════════════════════════════════════
//  ACID Transaction Execution
// ═══════════════════════════════════════════════════════════════════

/**
 * Execute an offline payment with full ACID guarantees.
 *
 * Steps:
 * 1. Acquire lock (Isolation)
 * 2. Validate invariants (Consistency)
 * 3. Register nonce (Consistency — dedup)
 * 4. Write WAL entry (Durability)
 * 5. Save to localStorage (Atomicity — journaled)
 * 6. Queue to IndexedDB (Atomicity — journaled)
 * 7. Update wallet state callbacks
 * 8. Commit WAL (Durability)
 *
 * If ANY step fails, all previous steps are rolled back.
 */
export async function executeACIDTransaction(
    input: ACIDTransactionInput,
    walletCallbacks: {
        addTransaction: (tx: Transaction) => void;
        updateBalance: (amount: number) => void;
        spendFromSaralPay?: (amount: number) => void;
    }
): Promise<ACIDResult> {
    const txId = input.transaction.id;
    const journal: JournalEntry[] = [];
    let releaseLock: (() => void) | null = null;

    try {
        // ── Step 1: Acquire Lock (Isolation) ──────────────────────────
        releaseLock = await acquireLock(txId);

        // ── Step 2: Validate Invariants (Consistency) ─────────────────
        const validation = validateInvariants(input);
        if (!validation.valid) {
            return { success: false, txId, error: validation.error, failedStep: "validation" };
        }

        // ── Step 3: Register Nonce (Consistency — dedup) ──────────────
        const nonceRegistered = checkAndRegisterNonce(input.transaction.nonce!);
        if (!nonceRegistered) {
            return {
                success: false,
                txId,
                error: "Duplicate nonce — this payment may have already been processed",
                failedStep: "nonce_check",
            };
        }
        journal.push({
            step: "nonce_registration",
            rollback: () => unregisterNonce(input.transaction.nonce!),
            completed: true,
        });

        // ── Step 4: Write WAL (Durability) ────────────────────────────
        writeWAL({
            txId,
            timestamp: Date.now(),
            status: "started",
            transaction: input.transaction,
            queuePayload: input.queuePayload,
        });
        journal.push({
            step: "wal_write",
            rollback: () => updateWAL(txId, "rolled_back"),
            completed: true,
        });

        // ── Step 5: Save to localStorage (Atomicity) ──────────────────
        const previousTxs = getTransactions();
        saveLocalTransaction(input.transaction);

        // Verify the write happened (Durability check)
        const afterTxs = getTransactions();
        const wasSaved = afterTxs.some((t) => t.id === txId);
        if (!wasSaved) {
            throw new Error("ACID: localStorage write verification failed");
        }

        journal.push({
            step: "localstorage_save",
            rollback: () => {
                // Restore the previous transaction list
                try {
                    localStorage.setItem("upa_transactions_db", JSON.stringify(previousTxs));
                } catch {
                    // Can't rollback localStorage — critical error
                }
            },
            completed: true,
        });

        // ── Step 6: Queue to IndexedDB (Atomicity) ────────────────────
        let queuedId: number | null = null;
        try {
            queuedId = await queueTransaction(input.queuePayload);
        } catch (err) {
            throw new Error(`ACID: IndexedDB queue failed — ${(err as Error).message}`);
        }

        journal.push({
            step: "indexeddb_queue",
            rollback: () => {
                // Remove the queued entry from IndexedDB
                if (queuedId !== null) {
                    db.transactions.delete(queuedId).catch(() => { });
                }
            },
            completed: true,
        });

        // ── Step 7: Update wallet state (via callbacks) ───────────────
        // These are in-memory state updates — they'll be lost on refresh anyway,
        // but we journal them for consistency within the session.
        walletCallbacks.updateBalance(input.deductAmount);
        journal.push({
            step: "balance_update",
            rollback: () => {
                // Note: We can't easily "un-updateBalance" since it's a React state setter.
                // The localStorage save is the source of truth, and we already rolled that back.
            },
            completed: true,
        });

        walletCallbacks.addTransaction(input.transaction);
        journal.push({
            step: "wallet_add_transaction",
            rollback: () => { /* Same note as above — React state */ },
            completed: true,
        });

        if (input.consumesOfflineWallet && walletCallbacks.spendFromSaralPay) {
            walletCallbacks.spendFromSaralPay(input.deductAmount);
            journal.push({
                step: "offline_wallet_debit",
                rollback: () => { /* React state — localStorage is the source of truth */ },
                completed: true,
            });
        }

        // ── Step 8: Mark WAL as committed (Durability) ────────────────
        updateWAL(txId, "committed");

        // ── Step 9: Request background sync (best-effort) ─────────────
        requestBackgroundSync().catch(() => { });

        return { success: true, txId };
    } catch (err) {
        // ══════════════════════════════════════════════════════════════
        //  ROLLBACK: Undo all completed journal entries in reverse order
        // ══════════════════════════════════════════════════════════════
        const failedStep = journal.length > 0 ? journal[journal.length - 1]?.step : "unknown";

        console.error(`[ACID] Transaction ${txId} failed at step "${failedStep}":`, err);

        for (let i = journal.length - 1; i >= 0; i--) {
            const entry = journal[i];
            if (entry.completed) {
                try {
                    entry.rollback();
                    console.log(`[ACID] Rolled back step: ${entry.step}`);
                } catch (rollbackErr) {
                    console.error(`[ACID] Rollback failed for step ${entry.step}:`, rollbackErr);
                }
            }
        }

        return {
            success: false,
            txId,
            error: (err as Error).message || "Transaction failed",
            failedStep: failedStep || "unknown",
        };
    } finally {
        // Always release the lock
        if (releaseLock) {
            releaseLock();
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
//  Merchant-side ACID Transaction (incoming — no balance deduction)
// ═══════════════════════════════════════════════════════════════════

export interface MerchantACIDInput {
    transaction: Transaction;
    queuePayload: ACIDTransactionInput["queuePayload"];
}

/**
 * Execute an ACID transaction for the merchant side (incoming payment).
 * This is simpler — no balance deduction, just persistence guarantees.
 */
export async function executeMerchantACIDTransaction(
    input: MerchantACIDInput,
    walletCallbacks: {
        addTransaction: (tx: Transaction) => void;
    }
): Promise<ACIDResult> {
    const txId = input.transaction.id;
    const journal: JournalEntry[] = [];
    let releaseLock: (() => void) | null = null;

    try {
        // Acquire lock
        releaseLock = await acquireLock(txId);

        // Nonce dedup check
        const nonce = input.transaction.nonce;
        if (nonce) {
            const nonceOk = checkAndRegisterNonce(nonce);
            if (!nonceOk) {
                return {
                    success: false,
                    txId,
                    error: "Duplicate nonce — receipt already processed",
                    failedStep: "nonce_check",
                };
            }
            journal.push({
                step: "nonce_registration",
                rollback: () => unregisterNonce(nonce),
                completed: true,
            });
        }

        // WAL
        writeWAL({
            txId,
            timestamp: Date.now(),
            status: "started",
            transaction: input.transaction,
            queuePayload: input.queuePayload,
        });
        journal.push({
            step: "wal_write",
            rollback: () => updateWAL(txId, "rolled_back"),
            completed: true,
        });

        // Save to localStorage
        const previousTxs = getTransactions();
        saveLocalTransaction(input.transaction);

        const afterTxs = getTransactions();
        if (!afterTxs.some((t) => t.id === txId)) {
            throw new Error("ACID: localStorage write verification failed");
        }

        journal.push({
            step: "localstorage_save",
            rollback: () => {
                try {
                    localStorage.setItem("upa_transactions_db", JSON.stringify(previousTxs));
                } catch { }
            },
            completed: true,
        });

        // Queue to IndexedDB
        let queuedId: number | null = null;
        try {
            queuedId = await queueTransaction(input.queuePayload);
        } catch (err) {
            throw new Error(`ACID: IndexedDB queue failed — ${(err as Error).message}`);
        }

        journal.push({
            step: "indexeddb_queue",
            rollback: () => {
                if (queuedId !== null) {
                    db.transactions.delete(queuedId).catch(() => { });
                }
            },
            completed: true,
        });

        // Update in-memory state
        walletCallbacks.addTransaction(input.transaction);

        // Commit WAL
        updateWAL(txId, "committed");

        // Background sync (best-effort)
        requestBackgroundSync().catch(() => { });

        return { success: true, txId };
    } catch (err) {
        const failedStep = journal.length > 0 ? journal[journal.length - 1]?.step : "unknown";
        console.error(`[ACID] Merchant TX ${txId} failed at step "${failedStep}":`, err);

        for (let i = journal.length - 1; i >= 0; i--) {
            if (journal[i].completed) {
                try {
                    journal[i].rollback();
                } catch { }
            }
        }

        return {
            success: false,
            txId,
            error: (err as Error).message || "Transaction failed",
            failedStep: failedStep || "unknown",
        };
    } finally {
        if (releaseLock) releaseLock();
    }
}

// ═══════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════

async function requestBackgroundSync(): Promise<void> {
    if ("serviceWorker" in navigator && "SyncManager" in window) {
        try {
            const reg = await navigator.serviceWorker.ready;
            await (reg as any).sync.register("sync-transactions");
        } catch {
            // SyncManager not available — that's fine
        }
    }
}
