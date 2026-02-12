"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Transaction } from "@/types";
import {
    CheckCircle2,
    Clock,
    XCircle,
    RefreshCw,
    Wifi,
    WifiOff,
} from "lucide-react";

type FilterType = "all" | "settled" | "queued" | "pending" | "failed";

export default function DashboardPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>("all");

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
                        signature: tx.signature,
                        nonce: tx.nonce,
                        timestamp: new Date(tx.issued_at || tx.created_at || tx.timestamp || Date.now()).getTime(),
                        settledAt: tx.settled_at ? new Date(tx.settled_at).getTime() : undefined,
                        walletProvider: tx.wallet_provider,
                    })));
                    return;
                }
            }
        } catch {
            // API failed, fall back
        }

        try {
            const stored = localStorage.getItem("upa_transactions");
            if (stored) setTransactions(JSON.parse(stored));
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await loadTransactions();
            setLoading(false);
        };
        load();
        const interval = setInterval(loadTransactions, 5000);
        return () => clearInterval(interval);
    }, [loadTransactions]);

    const filteredTransactions = transactions.filter((tx) => {
        if (filter === "all") return true;
        return tx.status === filter;
    });

    const stats = {
        total: transactions.length,
        settled: transactions.filter((t) => t.status === "settled").length,
        queued: transactions.filter((t) => t.status === "queued" || t.status === "pending").length,
        failed: transactions.filter((t) => t.status === "failed").length,
        totalAmount: transactions.filter((t) => t.status === "settled").reduce((sum, t) => sum + t.amount, 0),
        onlineCount: transactions.filter((t) => t.mode === "online").length,
        offlineCount: transactions.filter((t) => t.mode === "offline").length,
    };

    const intentGroups = transactions.reduce((acc, tx) => {
        const intent = tx.intent || "Other";
        if (!acc[intent]) acc[intent] = { count: 0, amount: 0 };
        acc[intent].count++;
        acc[intent].amount += tx.amount;
        return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    const reconciliationRate = stats.total > 0 ? Math.round((stats.settled / stats.total) * 100) : 100;

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold">Reconciliation Dashboard</h2>
                    <p className="text-sm text-muted-foreground">Real-time transaction monitoring</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setLoading(true); loadTransactions().finally(() => setLoading(false)); }}
                    disabled={loading}
                >
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Total</p>
                        <p className="text-2xl font-bold">{stats.total}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Settled</p>
                        <p className="text-2xl font-bold text-success">{stats.settled}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Queued</p>
                        <p className="text-2xl font-bold text-warning">{stats.queued}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Amount</p>
                        <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Online / Offline</p>
                        <div className="flex items-center gap-1.5">
                            <Wifi className="h-3.5 w-3.5 text-success" />
                            <span className="font-bold">{stats.onlineCount}</span>
                            <span className="text-muted-foreground">/</span>
                            <WifiOff className="h-3.5 w-3.5 text-warning" />
                            <span className="font-bold">{stats.offlineCount}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Reconciliation by Intent */}
            {Object.keys(intentGroups).length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Reconciliation by Intent</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-2">
                            {Object.entries(intentGroups).map(([intent, data]) => (
                                <div key={intent} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div>
                                        <p className="font-medium text-sm">{intent}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {data.count} transaction{data.count !== 1 ? "s" : ""}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-sm">{formatCurrency(data.amount)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {stats.total > 0 ? Math.round((data.count / stats.total) * 100) : 0}%
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 pt-3 border-t flex items-center justify-between">
                            <span className="text-sm font-medium">Reconciled:</span>
                            <span className="text-sm font-bold text-success">
                                {stats.settled}/{stats.total} ({reconciliationRate}%)
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filters + Transactions */}
            <div className="flex gap-2 flex-wrap">
                {(["all", "settled", "queued", "failed"] as FilterType[]).map((f) => (
                    <Button
                        key={f}
                        variant={filter === f ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(f)}
                    >
                        {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                    </Button>
                ))}
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Transactions</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                            <p className="text-sm">Loading...</p>
                        </div>
                    ) : filteredTransactions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p className="text-sm">No transactions found</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredTransactions.map((tx) => (
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
                                        <p className="text-xs text-muted-foreground truncate">
                                            {tx.recipientName || tx.recipient}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-xs text-muted-foreground">
                                                {formatDate(new Date(tx.timestamp))}
                                            </p>
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
                                        <p className="font-semibold text-sm">{formatCurrency(tx.amount)}</p>
                                        <p className={`text-xs capitalize ${
                                            tx.status === "settled" ? "text-success"
                                            : tx.status === "queued" || tx.status === "pending" ? "text-warning"
                                            : "text-danger"
                                        }`}>
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

