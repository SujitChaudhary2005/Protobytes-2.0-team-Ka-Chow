/**
 * Demo Seed Data — Call seedDemoData() to populate realistic transactions
 * for all demo user accounts so dashboards are never empty.
 *
 * DEMO-ONLY: Remove this file before production.
 */

import type { Transaction } from "@/types";

const SEED_KEY = "upa_demo_seeded_v4";

/** All seeded transactions for Ram (citizen) */
function ramTransactions(): Transaction[] {
    const now = Date.now();
    return [
        {
            id: "tx_seed_001",
            tx_id: "TX-2026-0001",
            tx_type: "payment",
            recipient: "traffic@nepal.gov",
            recipientName: "Nepal Traffic Police",
            fromUPA: "ram@upa.np",
            amount: 500,
            intent: "Traffic Fine",
            intentCategory: "fine",
            metadata: { license: "BA 1 KHA 9876", violation: "Speeding", officer: "OFF-4521" },
            status: "settled",
            mode: "online",
            payment_source: "wallet",
            nonce: "n_seed_001",
            timestamp: now - 86400000 * 1, // 1 day ago
            settledAt: now - 86400000 * 1 + 5000,
            walletProvider: "upa_pay",
        },
        // ... (existing online txs) ...
        {
            id: "tx_seed_offline_01",
            tx_id: "TX-OFF-2026-001",
            tx_type: "merchant_purchase",
            recipient: "hari@upa.np",
            recipientName: "Hari Kirana Pasal",
            fromUPA: "ram@upa.np",
            amount: 250,
            intent: "Grocery Purchase",
            intentCategory: "purchase",
            metadata: {
                items: "Rice, Dal, Salt",
                mode: "cross-device-offline",
                dualSigned: "true",
                offlineQueued: "true"
            },
            status: "settled",
            mode: "offline",
            payment_source: "wallet",
            nonce: "n_seed_off_01",
            timestamp: now - 3600000 * 4, // 4 hours ago
            settledAt: now - 3600000 * 3, // synced 1 hour later
            walletProvider: "upa_pay",
            settlement_state: "settled",
        },
        {
            id: "tx_seed_offline_02",
            tx_id: "TX-OFF-2026-002",
            tx_type: "merchant_purchase",
            recipient: "cafe@thamel.np",
            recipientName: "Thamel Eco Cafe",
            fromUPA: "ram@upa.np",
            amount: 450,
            intent: "Coffee & Muffin",
            intentCategory: "purchase",
            metadata: {
                mode: "cross-device-offline",
                dualSigned: "true"
            },
            status: "settled",
            mode: "offline",
            payment_source: "wallet",
            nonce: "n_seed_off_02",
            timestamp: now - 86400000 * 2 - 3600000 * 2, // 2 days 2 hours ago
            settledAt: now - 86400000 * 2,
            walletProvider: "upa_pay",
            settlement_state: "settled",
        },
        {
            id: "tx_seed_002",
            tx_id: "TX-2026-0002",
            tx_type: "payment",
            recipient: "revenue@kathmandu.gov.np",
            recipientName: "Kathmandu Metropolitan City",
            fromUPA: "ram@upa.np",
            amount: 15000,
            intent: "Property Tax",
            intentCategory: "tax",
            metadata: { ward: "Ward 10", fiscalYear: "2082/83" },
            status: "settled",
            mode: "online",
            payment_source: "wallet",
            nonce: "n_seed_002",
            timestamp: now - 86400000 * 2, // 2 days ago
            settledAt: now - 86400000 * 2 + 3000,
            walletProvider: "upa_pay",
        },
        {
            id: "tx_seed_003",
            tx_id: "TX-2026-0003",
            tx_type: "bill_payment",
            recipient: "nea@utility.np",
            recipientName: "Nepal Electricity Authority",
            fromUPA: "ram@upa.np",
            amount: 2450,
            intent: "Electricity Bill",
            intentCategory: "utility",
            metadata: { accountNumber: "012-345-678-9", period: "January 2026", units: "230 kWh" },
            status: "settled",
            mode: "online",
            payment_source: "wallet",
            nonce: "n_seed_003",
            timestamp: now - 86400000 * 3, // 3 days ago
            settledAt: now - 86400000 * 3 + 2000,
            walletProvider: "upa_pay",
        },
        {
            id: "tx_seed_004",
            tx_id: "TX-2026-0004",
            tx_type: "c2c",
            recipient: "anita@upa.np",
            recipientName: "Anita Gurung",
            fromUPA: "ram@upa.np",
            amount: 1200,
            intent: "Lunch Split",
            intentCategory: "personal",
            metadata: { fromUPA: "ram@upa.np", toUPA: "anita@upa.np", message: "Yesterday's momo" },
            status: "settled",
            mode: "online",
            payment_source: "wallet",
            nonce: "n_seed_004",
            timestamp: now - 86400000 * 1 - 3600000 * 5, // 1.2 days ago
            settledAt: now - 86400000 * 1 - 3600000 * 5 + 1500,
            walletProvider: "upa_pay",
            message: "Yesterday's momo",
        },
        {
            id: "tx_seed_005",
            tx_id: "TX-2026-0005",
            tx_type: "bill_payment",
            recipient: "nwsc@utility.np",
            recipientName: "Nepal Water Supply Corp",
            fromUPA: "ram@upa.np",
            amount: 450,
            intent: "Water Bill",
            intentCategory: "utility",
            metadata: { accountNumber: "WAT-KTM-9922", period: "January 2026" },
            status: "settled",
            mode: "online",
            payment_source: "wallet",
            nonce: "n_seed_005",
            timestamp: now - 86400000 * 5,
            settledAt: now - 86400000 * 5 + 2500,
            walletProvider: "upa_pay",
        },
        {
            id: "tx_seed_006",
            tx_id: "TX-2026-0006",
            tx_type: "payment",
            recipient: "license@dotm.gov.np",
            recipientName: "Dept of Transport Management",
            fromUPA: "ram@upa.np",
            amount: 3000,
            intent: "License Renewal",
            intentCategory: "fee",
            metadata: { licenseClass: "B" },
            status: "settled",
            mode: "offline",
            payment_source: "wallet",
            nonce: "n_seed_006",
            timestamp: now - 86400000 * 7,
            settledAt: now - 86400000 * 7 + 60000,
            walletProvider: "upa_pay",
            settlement_state: "settled"
        },
        {
            id: "tx_seed_007",
            tx_id: "TX-2026-0007",
            tx_type: "c2c",
            recipient: "sita@upa.np",
            recipientName: "Sita Sharma",
            fromUPA: "ram@upa.np",
            amount: 2500,
            intent: "Rent Share",
            intentCategory: "personal",
            metadata: { fromUPA: "ram@upa.np", toUPA: "sita@upa.np", message: "Feb rent share" },
            status: "settled",
            mode: "online",
            payment_source: "wallet",
            nonce: "n_seed_007",
            timestamp: now - 86400000 * 4,
            settledAt: now - 86400000 * 4 + 2000,
            walletProvider: "upa_pay",
            message: "Feb rent share",
        },
        {
            id: "tx_seed_008",
            tx_id: "TX-2026-0008",
            tx_type: "payment",
            recipient: "himalayan-java@merchant.np",
            recipientName: "Himalayan Java Coffee",
            fromUPA: "ram@upa.np",
            amount: 650,
            intent: "Coffee Order",
            intentCategory: "purchase",
            metadata: { items: "2x Cappuccino, 1x Croissant" },
            status: "settled",
            mode: "online",
            payment_source: "wallet",
            nonce: "n_seed_008",
            timestamp: now - 86400000 * 0.5, // 12 hours ago
            settledAt: now - 86400000 * 0.5 + 1000,
            walletProvider: "upa_pay",
        },
    ];
}

/** Anita (citizen2) transactions */
function anitaTransactions(): Transaction[] {
    const now = Date.now();
    return [
        {
            id: "tx_seed_a01",
            tx_id: "TX-2026-A001",
            tx_type: "c2c",
            recipient: "anita@upa.np",
            recipientName: "Ram Thapa",
            fromUPA: "ram@upa.np",
            amount: 1200,
            intent: "Lunch Split",
            intentCategory: "personal",
            metadata: { fromUPA: "ram@upa.np", toUPA: "anita@upa.np", message: "Yesterday's momo" },
            status: "settled",
            mode: "online",
            payment_source: "wallet",
            nonce: "n_seed_004-received",
            timestamp: now - 86400000 * 1 - 3600000 * 5,
            settledAt: now - 86400000 * 1 - 3600000 * 5 + 1500,
            walletProvider: "upa_pay",
            message: "Yesterday's momo",
        },
        {
            id: "tx_seed_a02",
            tx_id: "TX-2026-A002",
            tx_type: "bill_payment",
            recipient: "worldlink@isp.np",
            recipientName: "WorldLink Internet",
            fromUPA: "anita@upa.np",
            amount: 1100,
            intent: "Internet Bill",
            intentCategory: "utility",
            metadata: { accountNumber: "WL-PKR-4521", period: "February 2026" },
            status: "settled",
            mode: "online",
            payment_source: "wallet",
            nonce: "n_seed_a02",
            timestamp: now - 86400000 * 2,
            settledAt: now - 86400000 * 2 + 2000,
            walletProvider: "upa_pay",
        },
        {
            id: "tx_seed_a03",
            tx_id: "TX-2026-A003",
            tx_type: "payment",
            recipient: "revenue@ird.gov.np",
            recipientName: "Inland Revenue Department",
            fromUPA: "anita@upa.np",
            amount: 5000,
            intent: "Income Tax",
            intentCategory: "tax",
            metadata: {},
            status: "settled",
            mode: "online",
            payment_source: "wallet",
            nonce: "n_seed_a03",
            timestamp: now - 86400000 * 6,
            settledAt: now - 86400000 * 6 + 3000,
            walletProvider: "upa_pay",
        },
    ];
}

/** Seed function: checks if data was already seeded, if not injects it for each user */
export function seedDemoData(): boolean {
    if (typeof window === "undefined") return false;

    // Check if already seeded
    if (localStorage.getItem(SEED_KEY)) return false;

    const userTransactions: Record<string, Transaction[]> = {
        "c1000000-0000-0000-0000-000000000001": ramTransactions(),   // Ram
        "c1000000-0000-0000-0000-000000000005": anitaTransactions(), // Anita
    };

    for (const [userId, txs] of Object.entries(userTransactions)) {
        const key = `upa_transactions:${userId}`;
        const existing = localStorage.getItem(key);
        let current: Transaction[] = [];
        if (existing) {
            try { current = JSON.parse(existing); } catch { current = []; }
        }

        // Only add transactions that don't already exist (by id)
        const existingIds = new Set(current.map(t => t.id));
        const newTxs = txs.filter(t => !existingIds.has(t.id));

        if (newTxs.length > 0) {
            const merged = [...newTxs, ...current];
            localStorage.setItem(key, JSON.stringify(merged));
        }
    }

    localStorage.setItem(SEED_KEY, String(Date.now()));
    return true;
}

/** Clear all demo seed data (for reset) */
export function clearDemoSeed(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(SEED_KEY);
}

/** Force re-seed: clears marker and re-seeds */
export function resetDemoData(): void {
    clearDemoSeed();
    seedDemoData();
}
