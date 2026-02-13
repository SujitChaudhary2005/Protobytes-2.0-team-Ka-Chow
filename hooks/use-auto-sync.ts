"use client";

import { useEffect, useRef } from "react";
import { useNetwork } from "@/hooks/use-network";
import { getQueuedTransactions, updateTransactionStatus } from "@/lib/db";
import { updateTransactionStatus as updateLocalTxStatus, getTransactions as getLocalTransactions } from "@/lib/storage";
import { toast } from "sonner";

/**
 * Auto-sync hook — triggers background sync when transitioning from offline → online.
 * Shows toasts with sync progress and results.
 * Also updates wallet context & localStorage to reflect settled status.
 */
export function useAutoSync() {
    const { online } = useNetwork();
    const wasOffline = useRef(false);
    const syncing = useRef(false);

    useEffect(() => {
        if (!online) {
            wasOffline.current = true;
            return;
        }

        // We just came back online
        if (wasOffline.current && !syncing.current) {
            wasOffline.current = false;
            syncQueued();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [online]);

    // Also listen for SW sync complete events
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.synced > 0) {
                toast.success(`${detail.synced} payment${detail.synced > 1 ? "s" : ""} settled via background sync!`);
                // Update local storage to reflect settled
                updateLocalQueuedToSettled();
            }
            if (detail?.failed > 0) {
                toast.error(`${detail.failed} payment${detail.failed > 1 ? "s" : ""} failed to sync`);
            }
        };
        window.addEventListener("upa-sync-complete", handler);
        return () => window.removeEventListener("upa-sync-complete", handler);
    }, []);

    const syncQueued = async () => {
        if (syncing.current) return;
        syncing.current = true;

        try {
            const items = await getQueuedTransactions();
            if (items.length === 0) {
                syncing.current = false;
                return;
            }

            // Show dramatic syncing toast
            const syncToastId = toast.loading(
                `🔄 Connection restored! Syncing ${items.length} queued payment${items.length > 1 ? "s" : ""}...`,
                { duration: 10000 }
            );

            const payments = items.map((item) => ({
                qrPayload: JSON.parse(item.payload),
                signature: item.signature,
                nonce: item.nonce,
                publicKey: item.publicKey,
            }));

            const res = await fetch("/api/transactions/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payments }),
            });
            const result = await res.json();

            if (!res.ok) throw new Error(result.error || "Sync failed");

            let settled = 0;
            let failed = 0;
            let totalAmount = 0;

            if (result.results && Array.isArray(result.results)) {
                for (let i = 0; i < items.length; i++) {
                    const serverResult = result.results[i];
                    if (serverResult?.status === "settled") {
                        await updateTransactionStatus(items[i].id!, "settled");
                        settled++;
                        totalAmount += items[i].amount || 0;

                        // Show individual payment settlement toast with staggered timing
                        const intent = items[i].intent || "Payment";
                        const amount = items[i].amount || 0;
                        setTimeout(() => {
                            toast.success(
                                `✅ Settled: NPR ${amount.toLocaleString()} — ${intent}`,
                                { duration: 4000 }
                            );
                        }, settled * 600); // stagger each toast by 600ms
                    } else {
                        const reason = serverResult?.reason || "unknown_error";
                        await updateTransactionStatus(items[i].id!, "failed", reason);
                        failed++;
                    }
                }
            }

            // Update localStorage transactions to reflect new statuses
            updateLocalQueuedToSettled();

            // Also update the upa_transactions key that the wallet context uses
            updateWalletContextTransactions(settled > 0);

            // Dismiss the loading toast
            toast.dismiss(syncToastId);

            if (settled > 0) {
                // Show summary toast after individual ones
                setTimeout(() => {
                    toast.success(
                        `🎉 All ${settled} payment${settled > 1 ? "s" : ""} settled! Total: NPR ${totalAmount.toLocaleString()}`,
                        { duration: 6000 }
                    );
                }, (settled + 1) * 600);
            }
            if (failed > 0) {
                toast.error(`${failed} payment${failed > 1 ? "s" : ""} failed to sync`);
            }
        } catch (err: any) {
            console.error("[AutoSync] Failed:", err);
            toast.error("Auto-sync failed", { description: err.message });
        } finally {
            syncing.current = false;
        }
    };

    return { syncQueued };
}

/**
 * Update queued→settled in the upa_transactions_db localStorage
 */
function updateLocalQueuedToSettled() {
    try {
        const txs = getLocalTransactions();
        let changed = false;
        for (const tx of txs) {
            if (tx.status === "queued") {
                tx.status = "settled";
                // @ts-ignore
                tx.mode = "offline"; // Keep mode as offline to show it was synced
                changed = true;
            }
        }
        if (changed) {
            localStorage.setItem("upa_transactions_db", JSON.stringify(txs));
        }
    } catch { /* ignore */ }
}

/**
 * Get the active user ID from session for scoped storage
 */
function getActiveUserId(): string | null {
    try {
        const session = localStorage.getItem("upa_auth_session");
        if (session) {
            const s = JSON.parse(session);
            return s.user?.id ?? null;
        }
    } catch { /* ignore */ }
    return null;
}

/**
 * Update queued→settled in the upa_transactions key (wallet context)
 */
function updateWalletContextTransactions(hasSettled: boolean) {
    if (!hasSettled) return;
    try {
        const uid = getActiveUserId();
        const key = uid ? `upa_transactions:${uid}` : "upa_transactions";
        const stored = localStorage.getItem(key);
        if (!stored) return;
        const txs = JSON.parse(stored);
        let changed = false;
        for (const tx of txs) {
            if (tx.status === "queued") {
                tx.status = "settled";
                tx.settledAt = Date.now();
                // Keep mode as "offline" so it shows the sync badge
                changed = true;
            }
        }
        if (changed) {
            localStorage.setItem(key, JSON.stringify(txs));
            // Dispatch event so the home page knows to refresh
            window.dispatchEvent(new CustomEvent("upa-transactions-updated"));
        }
    } catch { /* ignore */ }
}
