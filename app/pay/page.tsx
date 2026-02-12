"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WalletProvider, useWallet } from "@/contexts/wallet-context";
import { NetworkStatus } from "@/components/network-status";
import { OfflineToggle } from "@/components/offline-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
    Wallet,
    ScanLine,
    ArrowRight,
    Clock,
    CheckCircle2,
    XCircle,
    Menu,
    Send,
    QrCode,
    History,
    TrendingUp,
    Shield,
} from "lucide-react";
import Link from "next/link";

function PayContent() {
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
            <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
                <div className="text-center">
                    <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading UPA Pay...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
            {/* Premium Header */}
            <header className="sticky top-0 z-50 border-b border-border/40 bg-surface/80 backdrop-blur-lg shadow-sm">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-primary to-accent rounded-xl shadow-lg">
                                <Wallet className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                                    UPA Pay
                                </h1>
                                <p className="text-xs text-muted-foreground">Unified Payment Address</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <OfflineToggle />
                            <NetworkStatus />
                            <Button variant="ghost" size="icon" asChild>
                                <Link href="/admin">
                                    <Menu className="h-5 w-5" />
                                </Link>
                            </Button>
                            <Button variant="ghost" size="icon" asChild>
                                <Link href="/dashboard">
                                    <History className="h-5 w-5" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Premium Balance Card */}
        <Card className="border-0 shadow-2xl bg-gradient-to-br from-primary via-primary/90 to-accent text-white overflow-hidden relative">
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}
          />
                    <CardContent className="p-6 relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm opacity-90 mb-1">Available Balance</p>
                                <p className="text-4xl font-bold">{formatCurrency(balance)}</p>
                                <p className="text-sm opacity-80 mt-2">{wallet?.name || "Demo Wallet"}</p>
                            </div>
                            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
                                <Shield className="h-10 w-10 text-white" />
                            </div>
                        </div>
                        <div className="flex items-center gap-4 pt-4 border-t border-white/20">
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
                        className="h-24 flex-col gap-2 bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg"
                        onClick={() => router.push("/pay/scan")}
                    >
                        <ScanLine className="h-6 w-6" />
                        <span className="font-semibold">Scan & Pay</span>
                    </Button>
                    <Button
                        variant="outline"
                        className="h-24 flex-col gap-2 border-2 hover:bg-accent/10 hover:border-accent shadow-lg"
                        onClick={() => router.push("/officer")}
                    >
                        <QrCode className="h-6 w-6" />
                        <span className="font-semibold">Generate QR</span>
                    </Button>
                </div>

                {/* UPA Address Input */}
                <Card className="shadow-lg border-2">
                    <CardContent className="p-4">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter UPA address (e.g., traffic@nepal.gov)"
                                value={upaAddress}
                                onChange={(e) => setUpaAddress(e.target.value)}
                                className="flex-1"
                            />
                            <Button
                                variant="default"
                                onClick={() => {
                                    if (upaAddress) {
                                        router.push(`/pay/confirm?recipient=${encodeURIComponent(upaAddress)}`);
                                    }
                                }}
                                className="bg-gradient-to-r from-primary to-accent"
                            >
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Activity */}
                {recentTransactions.length > 0 && (
                    <Card className="shadow-lg">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <History className="h-5 w-5 text-primary" />
                                    Recent Activity
                                </CardTitle>
                                <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
                                    View All
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {recentTransactions.map((tx) => (
                                    <div
                                        key={tx.id}
                                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-primary/5 hover:border-primary/20 transition-all cursor-pointer"
                                        onClick={() => router.push("/dashboard")}
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <div
                                                className={`p-2 rounded-lg ${tx.status === "settled"
                                                        ? "bg-success/10"
                                                        : tx.status === "queued"
                                                            ? "bg-warning/10"
                                                            : "bg-danger/10"
                                                    }`}
                                            >
                                                {tx.status === "settled" ? (
                                                    <CheckCircle2 className="h-4 w-4 text-success" />
                                                ) : tx.status === "queued" ? (
                                                    <Clock className="h-4 w-4 text-warning" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-danger" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{tx.intent}</p>
                                                <p className="text-sm text-muted-foreground truncate">
                                                    {tx.recipientName || tx.recipient}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDate(new Date(tx.timestamp))}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-primary">-{formatCurrency(tx.amount)}</p>
                                            <p
                                                className={`text-xs ${tx.status === "settled"
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

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <Card className="shadow-lg border-l-4 border-l-success">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Successful</p>
                                    <p className="text-2xl font-bold text-success">
                                        {transactions.filter((t) => t.status === "settled").length}
                                    </p>
                                </div>
                                <TrendingUp className="h-8 w-8 text-success opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="shadow-lg border-l-4 border-l-warning">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Pending</p>
                                    <p className="text-2xl font-bold text-warning">
                                        {transactions.filter((t) => t.status === "queued").length}
                                    </p>
                                </div>
                                <Clock className="h-8 w-8 text-warning opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}

export default function PayPage() {
    return (
        <WalletProvider>
            <PayContent />
        </WalletProvider>
    );
}
