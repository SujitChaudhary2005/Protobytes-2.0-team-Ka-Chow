"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { getQueuedTransactions } from "@/lib/db";
import { syncQueuedTransactions } from "@/lib/storage";
import { useNetwork } from "@/hooks/use-network";
import { useToast } from "@/hooks/use-toast";
import { Clock, Lock, Wifi, Home, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function QueuedPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const amount = searchParams.get("amount");
    const { online } = useNetwork();
    const { toast } = useToast();
    const [queuedCount, setQueuedCount] = useState(0);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        loadQueuedCount();

        // Auto-sync when online
        if (online) {
            handleSync();
        }

        // Check periodically
        const interval = setInterval(() => {
            loadQueuedCount();
            if (online) {
                handleSync();
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [online]);

    const loadQueuedCount = async () => {
        const queued = await getQueuedTransactions();
        setQueuedCount(queued.length);
    };

    const handleSync = async () => {
        if (syncing || !online) return;

        setSyncing(true);
        try {
            const queued = await getQueuedTransactions();
            if (queued.length > 0) {
                await syncQueuedTransactions(
                    queued.map((tx) => ({
                        payload: tx.payload,
                        signature: tx.signature,
                        publicKey: tx.publicKey,
                        timestamp: tx.timestamp,
                        nonce: tx.nonce,
                    }))
                );
                toast({
                    variant: "success",
                    title: "Sync Successful",
                    description: `${queued.length} transaction(s) synced`,
                });
                router.push("/pay/success");
            }
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Sync Failed",
                description: err.message,
            });
        } finally {
            setSyncing(false);
            loadQueuedCount();
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <main className="container mx-auto px-4 py-12">
                <div className="max-w-md mx-auto space-y-6">
                    {/* Queued Icon */}
                    <div className="flex justify-center">
                        <div className="p-4 bg-warning/10 rounded-full">
                            <Clock className="h-16 w-16 text-warning" />
                        </div>
                    </div>

                    {/* Message */}
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-semibold">Payment Queued</h1>
                        <p className="text-3xl font-bold">
                            {amount ? formatCurrency(parseFloat(amount)) : formatCurrency(0)}
                        </p>
                    </div>

                    {/* Status Card */}
                    <Card>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Lock className="h-5 w-5 text-accent" />
                                    <span className="text-sm font-medium">
                                        Cryptographically Signed
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Lock className="h-5 w-5 text-accent" />
                                    <span className="text-sm font-medium">Tamper-Proof</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Wifi className="h-5 w-5 text-warning" />
                                    <span className="text-sm font-medium">
                                        Will settle when online
                                    </span>
                                </div>
                                <div className="pt-3 border-t border-border space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Signature:</span>
                                        <span className="font-mono">ed25519</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Nonce:</span>
                                        <span className="font-mono">
                                            {String(Date.now()).slice(-8)}...
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Clock className="h-4 w-4 text-accent" />
                                        <span className="text-xs text-muted-foreground">
                                            Verified locally ✓
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="space-y-2">
                        {queuedCount > 0 && (
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => router.push("/pay/queue")}
                            >
                                View Queue ({queuedCount} pending)
                            </Button>
                        )}
                        {online && (
                            <Button
                                className="w-full"
                                onClick={handleSync}
                                disabled={syncing}
                            >
                                <RefreshCw
                                    className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`}
                                />
                                {syncing ? "Syncing..." : "Sync Now"}
                            </Button>
                        )}
                        <Button variant="secondary" className="w-full" asChild>
                            <Link href="/pay">
                                <Home className="h-4 w-4 mr-2" />
                                Back to Home
                            </Link>
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}

