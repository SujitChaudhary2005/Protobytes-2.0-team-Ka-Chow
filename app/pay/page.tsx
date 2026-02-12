"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/wallet-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import {
    ScanLine,
    ArrowRight,
    Clock,
    CheckCircle2,
    XCircle,
    QrCode,
    History,
    TrendingUp,
    Shield,
} from "lucide-react";
import Link from "next/link";

export default function PayPage() {
    const router = useRouter();
    const { wallet, transactions, balance } = useWallet();
    const [upaAddress, setUpaAddress] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const recentTransactions = transactions.slice(0, 5);
    const totalSpent = transactions
        .filter((t) => t.status === "settled")
        .reduce((sum, t) => sum + t.amount, 0);

    if (!mounted) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center">
                    <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Balance Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-primary via-primary/90 to-accent text-white overflow-hidden">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm opacity-90 mb-1">Available Balance</p>
                            <p className="text-4xl font-bold tracking-tight">
                                {formatCurrency(balance)}
                            </p>
                            <p className="text-sm opacity-80 mt-1">
                                {wallet?.name || "Demo Wallet"}
                            </p>
                        </div>
                        <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                            <Shield className="h-8 w-8" />
                        </div>
                    </div>
                    <div className="flex items-center gap-6 pt-3 border-t border-white/20">
                        <div>
                            <p className="text-xs opacity-80">Total Spent</p>
                            <p className="text-lg font-semibold">{formatCurrency(totalSpent)}</p>
                        </div>
                        <div>
                            <p className="text-xs opacity-80">Transactions</p>
                            <p className="text-lg font-semibold">{transactions.length}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
                <Button
                    className="h-20 flex-col gap-2 shadow-md"
                    onClick={() => router.push("/pay/scan")}
                >
                    <ScanLine className="h-5 w-5" />
                    <span className="font-semibold text-sm">Scan & Pay</span>
                </Button>
                <Button
                    variant="outline"
                    className="h-20 flex-col gap-2 border-2 hover:bg-accent/10 hover:border-accent shadow-md"
                    onClick={() => router.push("/officer")}
                >
                    <QrCode className="h-5 w-5" />
                    <span className="font-semibold text-sm">Generate QR</span>
                </Button>
            </div>

            {/* UPA Direct Pay */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Enter UPA address (e.g., traffic@nepal.gov)"
                            value={upaAddress}
                            onChange={(e) => setUpaAddress(e.target.value)}
                            className="flex-1"
                        />
                        <Button
                            onClick={() => {
                                if (upaAddress) {
                                    router.push(
                                        `/pay/confirm?recipient=${encodeURIComponent(upaAddress)}`
                                    );
                                }
                            }}
                        >
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Recent Activity */}
            {recentTransactions.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <History className="h-4 w-4 text-primary" />
                                Recent Activity
                            </CardTitle>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/dashboard">View All</Link>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-2">
                            {recentTransactions.map((tx) => (
                                <div
                                    key={tx.id}
                                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border"
                                    onClick={() => router.push("/dashboard")}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div
                                            className={`p-1.5 rounded-md ${
                                                tx.status === "settled"
                                                    ? "bg-success/10"
                                                    : tx.status === "queued"
                                                    ? "bg-warning/10"
                                                    : "bg-danger/10"
                                            }`}
                                        >
                                            {tx.status === "settled" ? (
                                                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                            ) : tx.status === "queued" ? (
                                                <Clock className="h-3.5 w-3.5 text-warning" />
                                            ) : (
                                                <XCircle className="h-3.5 w-3.5 text-danger" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-sm truncate">{tx.intent}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {tx.recipientName || tx.recipient}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right ml-2">
                                        <p className="font-semibold text-sm">
                                            -{formatCurrency(tx.amount)}
                                        </p>
                                        <p
                                            className={`text-xs capitalize ${
                                                tx.status === "settled"
                                                    ? "text-success"
                                                    : tx.status === "queued"
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
                    </CardContent>
                </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="border-l-4 border-l-success">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Successful</p>
                                <p className="text-2xl font-bold text-success">
                                    {transactions.filter((t) => t.status === "settled").length}
                                </p>
                            </div>
                            <TrendingUp className="h-6 w-6 text-success/50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-warning">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Pending</p>
                                <p className="text-2xl font-bold text-warning">
                                    {transactions.filter((t) => t.status === "queued").length}
                                </p>
                            </div>
                            <Clock className="h-6 w-6 text-warning/50" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
