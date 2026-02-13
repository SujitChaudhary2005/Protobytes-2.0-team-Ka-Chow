/**
 * Offline Payment Policy — Single Source of Truth
 *
 * All offline payment limits, expiry windows, and settlement states
 * are defined here. Values are configurable via environment variables
 * with sensible defaults.
 */

// ── Configurable Limits ────────────────────────────────────────────

/** Maximum amount per offline transaction (NPR) */
export const PER_OFFLINE_TX_LIMIT = Number(
    process.env.NEXT_PUBLIC_OFFLINE_TX_LIMIT ?? 500
);

/** Maximum total balance in the offline (SaralPay) wallet (NPR) */
export const OFFLINE_WALLET_MAX_BALANCE = Number(
    process.env.NEXT_PUBLIC_OFFLINE_WALLET_MAX ?? 2000
);

/** Maximum daily spend via offline transactions (NPR) */
export const OFFLINE_DAILY_SPEND_LIMIT = Number(
    process.env.NEXT_PUBLIC_OFFLINE_DAILY_LIMIT ?? 4000
);

/** Hours before an unsynced offline tx expires and is auto-reversed */
export const OFFLINE_SYNC_DEADLINE_HOURS = Number(
    process.env.NEXT_PUBLIC_OFFLINE_SYNC_DEADLINE_HOURS ?? 96 // 4 days
);

/** Sync deadline in milliseconds */
export const OFFLINE_SYNC_DEADLINE_MS =
    OFFLINE_SYNC_DEADLINE_HOURS * 60 * 60 * 1000;

// ── Settlement State Machine ───────────────────────────────────────

export type SettlementState =
    | "accepted_offline"  // Locally accepted by both sender/receiver
    | "sync_pending"      // In the sync queue, waiting for connectivity
    | "settled"           // Successfully settled on the server
    | "rejected"          // Server rejected (bad sig, over limit, etc.)
    | "reversed"          // Locally reversed after server rejection/expiry
    | "expired";          // Past the sync deadline, auto-reversed

/**
 * All valid settlement states as an array (useful for DB CHECK constraints)
 */
export const SETTLEMENT_STATES: SettlementState[] = [
    "accepted_offline",
    "sync_pending",
    "settled",
    "rejected",
    "reversed",
    "expired",
];

// ── Validation Helpers ─────────────────────────────────────────────

export interface OfflineLimitCheck {
    allowed: boolean;
    reason?: string;
}

/**
 * Check if a single offline transaction amount is within policy limits.
 */
export function checkPerTxLimit(amount: number): OfflineLimitCheck {
    if (amount <= 0) {
        return { allowed: false, reason: "Amount must be positive" };
    }
    if (amount > PER_OFFLINE_TX_LIMIT) {
        return {
            allowed: false,
            reason: `Amount NPR ${amount} exceeds per-transaction limit of NPR ${PER_OFFLINE_TX_LIMIT}`,
        };
    }
    return { allowed: true };
}

/**
 * Check daily spend against the daily limit.
 * @param todaySpent  Total already spent offline today (NPR)
 * @param newAmount   The new transaction amount
 */
export function checkDailyLimit(
    todaySpent: number,
    newAmount: number
): OfflineLimitCheck {
    if (todaySpent + newAmount > OFFLINE_DAILY_SPEND_LIMIT) {
        return {
            allowed: false,
            reason: `Daily offline limit reached. Spent today: NPR ${todaySpent}, limit: NPR ${OFFLINE_DAILY_SPEND_LIMIT}`,
        };
    }
    return { allowed: true };
}

/**
 * Check if the offline wallet balance supports the new amount.
 */
export function checkWalletBalance(
    currentBalance: number,
    amount: number
): OfflineLimitCheck {
    if (amount > currentBalance) {
        return {
            allowed: false,
            reason: `Insufficient SaralPay balance. Available: NPR ${currentBalance}`,
        };
    }
    return { allowed: true };
}

/**
 * Check if loading an amount would exceed the offline wallet max.
 */
export function checkWalletLoadLimit(
    currentBalance: number,
    loadAmount: number
): OfflineLimitCheck {
    if (currentBalance + loadAmount > OFFLINE_WALLET_MAX_BALANCE) {
        return {
            allowed: false,
            reason: `Loading NPR ${loadAmount} would exceed wallet max of NPR ${OFFLINE_WALLET_MAX_BALANCE}. Current balance: NPR ${currentBalance}`,
        };
    }
    return { allowed: true };
}

/**
 * Check if a transaction has expired (past the sync deadline).
 */
export function isTransactionExpired(acceptedAtMs: number): boolean {
    return Date.now() - acceptedAtMs > OFFLINE_SYNC_DEADLINE_MS;
}

/**
 * Get the expiry timestamp for a newly created offline transaction.
 */
export function getExpiryTimestamp(acceptedAtMs: number = Date.now()): number {
    return acceptedAtMs + OFFLINE_SYNC_DEADLINE_MS;
}

/**
 * Comprehensive pre-flight check before accepting an offline payment.
 * Runs all limit checks in order and returns the first failure or success.
 */
export function validateOfflinePayment(params: {
    amount: number;
    walletBalance: number;
    todaySpent: number;
}): OfflineLimitCheck {
    const { amount, walletBalance, todaySpent } = params;

    const txCheck = checkPerTxLimit(amount);
    if (!txCheck.allowed) return txCheck;

    const dailyCheck = checkDailyLimit(todaySpent, amount);
    if (!dailyCheck.allowed) return dailyCheck;

    const balanceCheck = checkWalletBalance(walletBalance, amount);
    if (!balanceCheck.allowed) return balanceCheck;

    return { allowed: true };
}
