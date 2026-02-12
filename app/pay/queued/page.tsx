"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNetwork } from "@/hooks/use-network";
import { getQueuedTransactions, updateTransactionStatus, db } from "@/lib/db";
import type { QueuedTransaction } from "@/lib/db";
import { Clock, RefreshCw, Wifi, WifiOff, ArrowLeft, Loader2, AlertTriangle, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { requestBackgroundSync } from "@/hooks/use-service-worker";

function QueuedContent() {
    const router = useRouter();
    const { online } = useNetwork();
    const [queuedItems, setQueuedItems] = useState<QueuedTransaction[]>([]);
    const [failedItems, setFailedItems] = useState<QueuedTransaction[]>([]);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        loadAll();

        // Listen for background sync completion
        const handler = () => loadAll();
        window.addEventListener("upa-sync-complete", handler);
        return () => window.removeEventListener("upa-sync-complete", handler);
    }, []);

    const loadAll = async () => {
        try {
            const queued = await getQueuedTransactions();
            setQueuedItems(queued);

            // Also load failed transactions
            const failed = await db.transactions
                .where("status")
                .equals("failed")
                .toArray();
            setFailedItems(failed);
        } catch {
            setQueuedItems([]);
            setFailedItems([]);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            // First try Background Sync API
            await requestBackgroundSync();

            // Also do manual sync as fallback
            const items = await getQueuedTransactions();
            if (items.length === 0) {
                toast.info("No transactions to sync");
                setSyncing(false);
                return;
            }

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

            // Update local status based on server results
            let settled = 0;
            let failed = 0;

            if (result.results && Array.isArray(result.results)) {
                for (let i = 0; i < items.length; i++) {
                    const serverResult = result.results[i];
                    if (serverResult?.status === "settled") {
                        await updateTransactionStatus(items[i].id!, "settled");
                        settled++;
                    } else {
                        const reason = serverResult?.reason || "unknown_error";
                        await updateTransactionStatus(items[i].id!, "failed", getConflictMessage(reason));
                        failed++;
                    }
                }
            }

            if (settled > 0) {
                toast.success(`${settled} transaction${settled > 1 ? "s" : ""} settled`);
            }
            if (failed > 0) {
                toast.error(`${failed} transaction${failed > 1 ? "s" : ""} failed`, {
                    description: "Check details below for resolution",
                });
            }

            await loadAll();
        } catch (err: any) {
            toast.error("Sync failed", { description: err.message });
        } finally {
            setSyncing(false);
        }
    };

    const handleRetry = async (item: QueuedTransaction) => {
        if (!item.id) return;
        await updateTransactionStatus(item.id, "queued");
        await loadAll();
        toast.info("Marked for retry");
    };

    const handleDiscard = async (item: QueuedTransaction) => {
        if (!item.id) return;
        await db.transactions.delete(item.id);
        await loadAll();
        toast.success("Transaction discarded");
    };

    const totalQueued = queuedItems.length;
    const totalFailed = failedItems.length;

    return (
        <div className="p-4 md:p-6 space-y-6">
            <Card>
                <CardContent className="p-8 text-center space-y-6">
                    <div className="mx-auto w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center">
                        <Clock className="h-10 w-10 text-warning" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold">
                            {totalQueued > 0 ? "Payments Queued" : "Queue Empty"}
                        </h2>
                        <p className="text-muted-foreground mt-1">
                            {totalQueued > 0
                                ? "Your payments are saved offline and will be settled when synced."
                                : "All payments have been processed."}
                        </p>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Queued</span>
                            <span className="font-bold">{totalQueued}</span>
                        </div>
                        {totalFailed > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Failed</span>
                                <span className="font-bold text-destructive">{totalFailed}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Connection</span>
                            <span className={`flex items-center gap-1 text-sm ${online ? "text-success" : "text-warning"}`}>
                                {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                {online ? "Online" : "Offline"}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Button
                            className="w-full"
                            onClick={handleSync}
                            disabled={!online || syncing || totalQueued === 0}
                        >
                            {syncing ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            {online ? "Sync Now" : "Go Online to Sync"}
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Home
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Failed Transactions — Conflict Resolution */}
            {totalFailed > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Failed Transactions ({totalFailed})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {failedItems.map((item) => (
                            <div
                                key={item.id}
                                className="border rounded-lg p-4 space-y-3"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-medium text-sm">{item.recipient}</p>
                                        <p className="text-xs text-muted-foreground">
                                            NPR {item.amount.toLocaleString()} · {item.intent}
                                        </p>
                                    </div>
                                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                                </div>
                                {item.error && (
                                    <div className="bg-destructive/5 border border-destructive/20 rounded-md p-2">
                                        <p className="text-xs text-destructive">{item.error}</p>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => handleRetry(item)}
                                    >
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Retry
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="flex-1"
                                        onClick={() => handleDiscard(item)}
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Discard
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

/** Map server rejection reasons to user-friendly messages */
function getConflictMessage(reason: string): string {
    switch (reason) {
        case "invalid_signature":
            return "Cryptographic signature verification failed. The QR code may have been tampered with.";
        case "signature_verification_error":
            return "Could not verify the payment signature. Please request a new QR code.";
        case "qr_expired":
            return "This QR code has expired (>1 hour). Request a new one from the issuing officer.";
        case "nonce_reused":
            return "This payment has already been settled (duplicate nonce). No action needed.";
        case "insufficient_funds":
            return "Insufficient funds in the linked account. Please top up and retry.";
        default:
            return `Sync failed: ${reason}. Try again or discard.`;
    }
}

export default function QueuedPage() {
    return (
        <Suspense fallback={
            <div className="p-4 md:p-6 flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        }>
            <QueuedContent />
        </Suspense>
    );
}

