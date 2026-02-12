"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNetwork } from "@/hooks/use-network";
import { getQueuedTransactions } from "@/lib/db";
import { Clock, RefreshCw, Wifi, WifiOff, ArrowLeft, Loader2 } from "lucide-react";

function QueuedContent() {
    const router = useRouter();
    const { online } = useNetwork();
    const [queuedCount, setQueuedCount] = useState(0);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);

    useEffect(() => {
        loadCount();
    }, []);

    const loadCount = async () => {
        try {
            const items = await getQueuedTransactions();
            setQueuedCount(items.length);
        } catch {
            setQueuedCount(0);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await fetch("/api/transactions/sync", { method: "POST" });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Sync failed");
            setSyncResult(`Synced ${result.synced || 0} transactions`);
            await loadCount();
        } catch (err: any) {
            setSyncResult(err.message || "Sync failed");
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <Card>
                <CardContent className="p-8 text-center space-y-6">
                    <div className="mx-auto w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center">
                        <Clock className="h-10 w-10 text-warning" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold">Payment Queued</h2>
                        <p className="text-muted-foreground mt-1">
                            Your payment has been saved offline and will be settled when you&apos;re back online.
                        </p>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Queued Transactions</span>
                            <span className="font-bold">{queuedCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Connection</span>
                            <span className={`flex items-center gap-1 text-sm ${online ? "text-success" : "text-warning"}`}>
                                {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                {online ? "Online" : "Offline"}
                            </span>
                        </div>
                    </div>

                    {syncResult && (
                        <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                            {syncResult}
                        </p>
                    )}

                    <div className="space-y-3">
                        <Button
                            className="w-full"
                            onClick={handleSync}
                            disabled={!online || syncing}
                        >
                            {syncing ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            {online ? "Sync Now" : "Go Online to Sync"}
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => router.push("/pay")}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Home
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
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

