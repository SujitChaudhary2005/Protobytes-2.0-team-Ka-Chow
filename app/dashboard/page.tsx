"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getTransactions } from "@/lib/storage";
import { Transaction } from "@/types";
import {
    CheckCircle2,
    Clock,
    XCircle,
    RefreshCw,
    Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "settled" | "pending" | "failed">(
        "all"
    );

    useEffect(() => {
        loadTransactions();
        // Auto-refresh every 5 seconds
        const interval = setInterval(loadTransactions, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadTransactions = () => {
        try {
            const data = getTransactions();
            setTransactions(
                data.map((tx) => ({
                    ...tx,
                    txHash: tx.id,
                }))
            );
        } catch (err) {
            console.error("Load error:", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredTransactions = transactions.filter((tx) => {
        if (filter === "all") return true;
        return tx.status === filter;
    });

    const stats = {
        total: transactions.length,
        settled: transactions.filter((t) => t.status === "settled").length,
        pending: transactions.filter((t) => t.status === "pending").length,
        failed: transactions.filter((t) => t.status === "failed").length,
        totalAmount: transactions
            .filter((t) => t.status === "settled")
            .reduce((sum, t) => sum + t.amount, 0),
    };

    // Group transactions by intent
    const intentGroups = transactions.reduce((acc, tx) => {
        const intent = tx.intent || "Other";
        if (!acc[intent]) {
            acc[intent] = { count: 0, amount: 0, transactions: [] };
        }
        acc[intent].count++;
        acc[intent].amount += tx.amount;
        acc[intent].transactions.push(tx);
        return acc;
    }, {} as Record<string, { count: number; amount: number; transactions: Transaction[] }>);

    const reconciliationRate =
        stats.total > 0
            ? Math.round((stats.settled / stats.total) * 100)
            : 100;

    // Intent icons mapping
    const intentIcons: Record<string, string> = {
        "Traffic Violation Fine": "🚗",
        "Traffic Fine": "🚗",
        "Property Tax": "🏠",
        "Tuition Fee": "🎓",
        "License Fee": "📄",
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border bg-surface">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold">Reconciliation Dashboard</h1>
                            <p className="text-sm text-muted-foreground">
                                Real-time transaction monitoring
                            </p>
                        </div>
                        <Button variant="outline" onClick={loadTransactions} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6">
                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-4 mb-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Transactions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{stats.total}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Settled
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-accent">{stats.settled}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Pending
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-warning">{stats.pending}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Amount
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">
                                {formatCurrency(stats.totalAmount)}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Reconciliation by Intent */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Reconciliation by Intent</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {Object.entries(intentGroups).map(([intent, data]) => {
                                const icon = intentIcons[intent] || "📋";
                                return (
                                    <div
                                        key={intent}
                                        className="flex items-center justify-between p-3 border border-border rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{icon}</span>
                                            <div>
                                                <p className="font-medium">{intent}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {data.count} transaction{data.count !== 1 ? "s" : ""}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">
                                                {formatCurrency(data.amount)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {Math.round((data.count / stats.total) * 100)}% of total
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-4 pt-4 border-t border-border">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Total Reconciled:</span>
                                <span className="text-lg font-bold text-accent">
                                    {stats.settled}/{stats.total} ({reconciliationRate}%)
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Filters */}
                <div className="flex gap-2 mb-4">
                    <Button
                        variant={filter === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter("all")}
                    >
                        All
                    </Button>
                    <Button
                        variant={filter === "settled" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter("settled")}
                    >
                        Settled
                    </Button>
                    <Button
                        variant={filter === "pending" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter("pending")}
                    >
                        Pending
                    </Button>
                    <Button
                        variant={filter === "failed" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter("failed")}
                    >
                        Failed
                    </Button>
                </div>

                {/* Transactions Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Loading...
                            </div>
                        ) : filteredTransactions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No transactions found
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredTransactions.map((tx) => (
                                    <div
                                        key={tx.id}
                                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/5 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-medium">{tx.intent}</p>
                                                {tx.status === "settled" ? (
                                                    <CheckCircle2 className="h-4 w-4 text-accent" />
                                                ) : tx.status === "pending" ? (
                                                    <Clock className="h-4 w-4 text-warning" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-danger" />
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {tx.recipientName || tx.recipient}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {formatDate(new Date(tx.timestamp))} • {tx.txHash}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Wallet: UPA Pay • Mode: {tx.metadata?.mode || "Online"}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">
                                                {formatCurrency(tx.amount)}
                                            </p>
                                            <p
                                                className={`text-xs ${tx.status === "settled"
                                                    ? "text-accent"
                                                    : tx.status === "pending"
                                                        ? "text-warning"
                                                        : "text-danger"
                                                    }`}
                                            >
                                                {tx.status}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

