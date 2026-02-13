import { describe, it, expect } from "vitest";
import {
    checkPerTxLimit,
    checkDailyLimit,
    checkWalletBalance,
    checkWalletLoadLimit,
    validateOfflinePayment,
    isTransactionExpired,
    getExpiryTimestamp,
    PER_OFFLINE_TX_LIMIT,
    OFFLINE_WALLET_MAX_BALANCE,
    OFFLINE_DAILY_SPEND_LIMIT,
    OFFLINE_SYNC_DEADLINE_MS,
    SETTLEMENT_STATES,
} from "./offline-policy";

describe("offline-policy", () => {
    describe("constants", () => {
        it("has sensible defaults", () => {
            expect(PER_OFFLINE_TX_LIMIT).toBe(500);
            expect(OFFLINE_WALLET_MAX_BALANCE).toBe(2000);
            expect(OFFLINE_DAILY_SPEND_LIMIT).toBe(4000);
            expect(OFFLINE_SYNC_DEADLINE_MS).toBe(96 * 60 * 60 * 1000);
        });

        it("has all 6 settlement states", () => {
            expect(SETTLEMENT_STATES).toHaveLength(6);
            expect(SETTLEMENT_STATES).toContain("accepted_offline");
            expect(SETTLEMENT_STATES).toContain("sync_pending");
            expect(SETTLEMENT_STATES).toContain("settled");
            expect(SETTLEMENT_STATES).toContain("rejected");
            expect(SETTLEMENT_STATES).toContain("reversed");
            expect(SETTLEMENT_STATES).toContain("expired");
        });
    });

    describe("checkPerTxLimit", () => {
        it("allows amounts within limit", () => {
            expect(checkPerTxLimit(100).allowed).toBe(true);
            expect(checkPerTxLimit(500).allowed).toBe(true);
        });

        it("rejects amounts exceeding limit", () => {
            const result = checkPerTxLimit(501);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("exceeds per-transaction limit");
        });

        it("rejects zero and negative amounts", () => {
            expect(checkPerTxLimit(0).allowed).toBe(false);
            expect(checkPerTxLimit(-10).allowed).toBe(false);
        });
    });

    describe("checkDailyLimit", () => {
        it("allows spending within daily limit", () => {
            expect(checkDailyLimit(0, 500).allowed).toBe(true);
            expect(checkDailyLimit(3500, 500).allowed).toBe(true);
        });

        it("rejects spending exceeding daily limit", () => {
            const result = checkDailyLimit(3500, 501);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("Daily offline limit reached");
        });
    });

    describe("checkWalletBalance", () => {
        it("allows if sufficient balance", () => {
            expect(checkWalletBalance(500, 500).allowed).toBe(true);
            expect(checkWalletBalance(1000, 500).allowed).toBe(true);
        });

        it("rejects if insufficient balance", () => {
            const result = checkWalletBalance(499, 500);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("Insufficient SaralPay balance");
        });
    });

    describe("checkWalletLoadLimit", () => {
        it("allows loading within max", () => {
            expect(checkWalletLoadLimit(0, 2000).allowed).toBe(true);
            expect(checkWalletLoadLimit(1000, 1000).allowed).toBe(true);
        });

        it("rejects if would exceed max", () => {
            const result = checkWalletLoadLimit(1500, 600);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("exceed wallet max");
        });
    });

    describe("validateOfflinePayment", () => {
        it("passes when all limits are satisfied", () => {
            const result = validateOfflinePayment({
                amount: 200,
                walletBalance: 1000,
                todaySpent: 0,
            });
            expect(result.allowed).toBe(true);
        });

        it("fails on per-tx limit first", () => {
            const result = validateOfflinePayment({
                amount: 600,
                walletBalance: 1000,
                todaySpent: 0,
            });
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("per-transaction limit");
        });

        it("fails on daily limit second", () => {
            const result = validateOfflinePayment({
                amount: 400,
                walletBalance: 1000,
                todaySpent: 3700,
            });
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("Daily offline limit");
        });

        it("fails on wallet balance third", () => {
            const result = validateOfflinePayment({
                amount: 400,
                walletBalance: 300,
                todaySpent: 0,
            });
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("Insufficient SaralPay");
        });
    });

    describe("expiry", () => {
        it("correctly detects expired transactions", () => {
            const oldTimestamp = Date.now() - OFFLINE_SYNC_DEADLINE_MS - 1000;
            expect(isTransactionExpired(oldTimestamp)).toBe(true);
        });

        it("correctly detects non-expired transactions", () => {
            const recentTimestamp = Date.now() - 1000;
            expect(isTransactionExpired(recentTimestamp)).toBe(false);
        });

        it("getExpiryTimestamp returns correct future time", () => {
            const now = Date.now();
            const expiry = getExpiryTimestamp(now);
            expect(expiry).toBe(now + OFFLINE_SYNC_DEADLINE_MS);
        });
    });
});
