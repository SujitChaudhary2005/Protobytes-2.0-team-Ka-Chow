"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/wallet-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Transaction } from "@/types";
import {
    ScanLine,
    ArrowRight,
    Clock,
    CheckCircle2,
    XCircle,
    Shield,
    RefreshCw,
    Wifi,
    WifiOff,
} from "lucide-react";

export default function CitizenHome() {
    const router = useRouter();
    const { wallet, balance } = useWallet();
    const [upaAddress, setUpaAddress] = useState("");
    const [mounted, setMounted] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { setMounted(true); }, []);

    const loadTransactions = useCallback(async () => {
        try {
            const res = await fetch("/api/transactions");
            if (res.ok) {
                const result = await res.json();
                if (result.data && Array.isArray(result.data)) {
                    setTransactions(result.data.map((tx: any) => ({
                        id: tx.id,
                        tx_id: tx.tx_id,
                        recipient: tx.upa_address || tx.recipient || tx.upa_id || "",
                        recipientName: tx.entity_name || tx.recipientName || "",
                        amount: tx.amount,
                        intent: tx.intent_label || tx.intent || "",
                        intentCategory: tx.intent_category || tx.intentCategory || "",
                        metadata: tx.metadata || {},
                        status: tx.status,
                        mode: tx.mode || "online",
                        nonce: tx.nonce,
                        timestamp: new Date(tx.issued_at || tx.created_at || tx.timestamp || Date.now()).getTime(),
                        settledAt: tx.settled_at ? new Date(tx.settled_at).getTime() : undefined,
                        walletProvider: tx.wallet_provider,
                    })));
                    return;
                }
            }
        } catch { /* fall back */ }
        try {
            const stored = localStorage.getItem("upa_transactions");
            if (stored) setTransactions(JSON.parse(stored));
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        const load = async () => { setLoading(true); await loadTransactions(); setLoading(false); };
        load();
        const interval = setInterval(loadTransactions, 5000);
        return () => clearInterval(interval);
    }, [loadTransactions]);

    const totalSpent = transactions.filter((t) => t.status === "settled").reduce((sum, t) => sum + t.amount, 0);
    const recentTx = transactions.slice(0, 8);

    if (!mounted) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Balance */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                            <p className="text-4xl font-bold tracking-tight">{formatCurrency(balance)}</p>
                            <p className="text-sm text-muted-foreground mt-1">{wallet?.name || "Demo Wallet"}</p>
                        </div>
                        <div className="p-3 bg-primary/10 rounded-2xl">
                            <Shield className="h-8 w-8 text-primary" />
                        </div>
                    </div>
                    <div className="flex items-center gap-6 pt-3 border-t">
                        <div>
                            <p className="text-xs text-muted-foreground">Total Spent</p>
                            <p className="text-lg font-semibold">{formatCurrency(totalSpent)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Payments</p>
                            <p className="text-lg font-semibold">{transactions.length}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
                <Button className="h-20 flex-col gap-2" onClick={() => router.push("/pay/scan")}>
                    <ScanLine className="h-5 w-5" />
                    <span className="font-semibold text-sm">Scan & Pay</span>
                </Button>
                <Button variant="secondary" className="h-20 flex-col gap-2" onClick={() => router.push("/pay/queued")}>
                    <Clock className="h-5 w-5" />
                    <span className="font-semibold text-sm">Queued Payments</span>
                </Button>
            </div>

            {/* UPA Direct Pay */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Enter UPA (e.g., traffic@nepal.gov)"
                            value={upaAddress}
                            onChange={(e) => setUpaAddress(e.target.value)}
                            className="flex-1"
                        />
                        <Button onClick={() => {
                            if (upaAddress) router.push(`/pay/confirm?recipient=${encodeURIComponent(upaAddress)}`);
                        }}>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* My Payments */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">My Payments</h3>
                <Button variant="outline" size="sm" onClick={() => { setLoading(true); loadTransactions().finally(() => setLoading(false)); }} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardContent className="pt-4">
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                            <p className="text-sm">Loading...</p>
                        </div>
                    ) : recentTx.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p className="text-sm">No payments yet. Scan a QR to get started!</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentTx.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className="font-medium text-sm">{tx.intent}</p>
                                            {tx.status === "settled" ? (
                                                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                                            ) : tx.status === "queued" || tx.status === "pending" ? (
                                                <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
                                            ) : (
                                                <XCircle className="h-3.5 w-3.5 text-danger shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">{tx.recipientName || tx.recipient}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-xs text-muted-foreground">{formatDate(new Date(tx.timestamp))}</p>
                                            {tx.mode === "offline" ? (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full">
                                                    <WifiOff className="h-2.5 w-2.5" /> Offline
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full">
                                                    <Wifi className="h-2.5 w-2.5" /> Online
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right ml-3">
                                        <p className="font-semibold text-sm">-{formatCurrency(tx.amount)}</p>
                                        <p className={`text-xs capitalize ${tx.status === "settled" ? "text-success" : tx.status === "queued" || tx.status === "pending" ? "text-warning" : "text-danger"}`}>
                                            {tx.status}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
