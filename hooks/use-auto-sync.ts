"use client";

import { useEffect, useRef } from "react";
import { useNetwork } from "@/hooks/use-network";
import {
    getQueuedTransactions,
    updateTransactionStatus,
    getOfflineTxsToSync,
    updateOfflineTxState,
    markExpiredOfflineTxs,
} from "@/lib/db";
import { updateTransactionStatus as updateLocalTxStatus, getTransactions as getLocalTransactions } from "@/lib/storage";
import { toast } from "sonner";
import type { OfflineWallet, SettlementState } from "@/types";

/**
 * Auto-sync hook — triggers background sync when transitioning from offline → online.
 * Shows toasts with sync progress and results.
 *
 * FIX: Uses deterministic per-client_tx_id settlement from server.
 * No blanket queued→settled conversion — each tx is handled individually.
 */
export function useAutoSync(
    isAuthenticated: boolean,
    offlineWallet: OfflineWallet,
    reverseOfflineTx?: (amount: number) => void
) {
    const { online } = useNetwork();
    const wasOfflineRef = useRef(false);
    const isSyncingRef = useRef(false);

    // Track offline→online transition
    useEffect(() => {
        if (!online) {
            wasOfflineRef.current = true;
        }
    }, [online]);

    // Main sync effect
    useEffect(() => {
        if (!online || !isAuthenticated) return;
        if (!wasOfflineRef.current) return;
        if (isSyncingRef.current) return;

        wasOfflineRef.current = false;

        const doSync = async () => {
            isSyncingRef.current = true;
            try {
                // Step 1: Check for expired offline txs first
                const expired = await markExpiredOfflineTxs();
                if (expired.length > 0) {
                    // Reverse each expired tx locally
                    for (const tx of expired) {
                        if (reverseOfflineTx) {
                            reverseOfflineTx(tx.amount);
                        }
                    }
                    toast.error(`${expired.length} offline transaction(s) expired and were reversed.`);
                }

                // Step 2: Get queued transactions from Dexie
                const queued = await getQueuedTransactions();

                // Step 3: Get offline accepted txs that need syncing
                const offlineTxs = await getOfflineTxsToSync();

                const totalToSync = queued.length + offlineTxs.length;
                if (totalToSync === 0) {
                    isSyncingRef.current = false;
                    return;
                }

                toast.info(`Syncing ${totalToSync} offline transaction(s)...`);

                // ── Sync queued transactions (legacy Dexie queue) ──
                if (queued.length > 0) {
                    await syncQueuedLegacy(queued);
                }

                // ── Sync offline accepted txs (new settlement model) ──
                if (offlineTxs.length > 0) {
                    await syncOfflineAccepted(offlineTxs, reverseOfflineTx);
                }
            } catch (error) {
                console.error("[AutoSync] Sync failed:", error);
                toast.error("Sync failed — will retry on next reconnect.");
            } finally {
                isSyncingRef.current = false;
            }
        };

        // Small delay to ensure network is stable
        const timer = setTimeout(doSync, 1500);
        return () => clearTimeout(timer);
    }, [online, isAuthenticated, offlineWallet, reverseOfflineTx]);
}

/**
 * Sync legacy queued transactions (from Dexie transactions table).
 * These go through the existing /api/transactions/sync endpoint.
 */
async function syncQueuedLegacy(
    queued: Awaited<ReturnType<typeof getQueuedTransactions>>
) {
    // Mark as syncing
    for (const tx of queued) {
        await updateTransactionStatus(tx.id!, "syncing");
    }

    const payments = queued.map((tx) => ({
        payload: tx.payload,
        signature: tx.signature,
        publicKey: tx.publicKey,
        timestamp: tx.timestamp,
        nonce: tx.nonce,
        client_tx_id: tx.client_tx_id || undefined,
    }));

    try {
        const response = await fetch("/api/transactions/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payments }),
        });

        if (response.ok) {
            const data = await response.json();

            if (data.results && Array.isArray(data.results)) {
                // Deterministic per-item handling
                let settled = 0;
                let failed = 0;
                for (let i = 0; i < data.results.length; i++) {
                    const result = data.results[i];
                    const originalTx = queued[i];
                    if (!originalTx) continue;

                    if (result.status === "settled" || result.status === "success") {
                        await updateTransactionStatus(originalTx.id!, "settled");

                        // Update local storage tx status
                        const localTxs = getLocalTransactions();
                        const match = localTxs.find(
                            (t) =>
                                t.nonce === originalTx.nonce ||
                                (originalTx.client_tx_id && t.client_tx_id === originalTx.client_tx_id)
                        );
                        if (match) {
                            updateLocalTxStatus(match.id, "settled");
                        }
                        settled++;
                    } else {
                        await updateTransactionStatus(
                            originalTx.id!,
                            "failed",
                            result.error || "Settlement rejected"
                        );
                        failed++;
                    }
                }
                toast.success(`Synced: ${settled} settled, ${failed} failed`);
            } else {
                // Fallback: mark all as settled (old server format)
                for (const tx of queued) {
                    await updateTransactionStatus(tx.id!, "settled");
                }
                toast.success(`${queued.length} transaction(s) synced`);
            }
        } else {
            // Server error — keep them queued for retry
            for (const tx of queued) {
                await updateTransactionStatus(tx.id!, "queued", "Server error during sync");
            }
            toast.error("Sync failed — server error");
        }
    } catch (error) {
        // Network error — revert to queued
        for (const tx of queued) {
            await updateTransactionStatus(tx.id!, "queued", "Network error");
        }
        toast.error("Sync failed — will retry later");
        throw error;
    }
}

/**
 * Sync offline accepted transactions (new settlement model).
 * These go through the new /api/transactions/sync endpoint with full proof.
 */
async function syncOfflineAccepted(
    offlineTxs: Awaited<ReturnType<typeof getOfflineTxsToSync>>,
    reverseOfflineTx?: (amount: number) => void
) {
    // Mark as sync_pending
    for (const tx of offlineTxs) {
        await updateOfflineTxState(tx.client_tx_id, "sync_pending", {
            sync_attempts: (tx.sync_attempts || 0) + 1,
        });
    }

    const payments = offlineTxs.map((tx) => ({
        client_tx_id: tx.client_tx_id,
        nonce: tx.nonce,
        senderUPA: tx.senderUPA,
        receiverUPA: tx.receiverUPA,
        amount: tx.amount,
        intent: tx.intent,
        acceptedAt: tx.acceptedAt,
        expiresAt: tx.expiresAt,
        sender_signature: tx.sender_signature,
        receiver_signature: tx.receiver_signature,
        sender_device_id: tx.sender_device_id,
        receiver_device_id: tx.receiver_device_id,
        proof: tx.proof,
        // Construct a payload string for backward compatibility
        payload: JSON.stringify({
            recipient: tx.receiverUPA,
            recipientName: tx.receiverName,
            amount: tx.amount,
            intent: tx.intent,
            fromUPA: tx.senderUPA,
        }),
        signature: tx.sender_signature,
        publicKey: "", // Will be validated via proof
        timestamp: tx.acceptedAt,
    }));

    try {
        const response = await fetch("/api/transactions/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payments }),
        });

        if (response.ok) {
            const data = await response.json();

            if (data.results && Array.isArray(data.results)) {
                let settled = 0;
                let rejected = 0;
                for (const result of data.results) {
                    const clientId = result.client_tx_id;
                    if (!clientId) continue;

                    const origTx = offlineTxs.find((t) => t.client_tx_id === clientId);
                    if (!origTx) continue;

                    if (result.status === "settled" || result.status === "success") {
                        await updateOfflineTxState(clientId, "settled" as SettlementState, {
                            syncedAt: Date.now(),
                        });
                        settled++;
                    } else {
                        const state: SettlementState = result.status === "expired" ? "expired" : "rejected";
                        await updateOfflineTxState(clientId, state, {
                            rejection_reason: result.error || result.reason || "Unknown",
                        });
                        // Reverse the local ledger
                        if (reverseOfflineTx) {
                            reverseOfflineTx(origTx.amount);
                        }
                        rejected++;
                    }
                }
                if (settled > 0) toast.success(`${settled} offline tx(s) settled`);
                if (rejected > 0) toast.error(`${rejected} offline tx(s) rejected/expired`);
            }
        } else {
            // Server error — keep as sync_pending for retry
            toast.error("Sync failed — will retry later");
        }
    } catch {
        toast.error("Sync failed — network error");
    }
}
