"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/wallet-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Transaction } from "@/types";
import { RouteGuard } from "@/components/route-guard";
import { useAutoSync } from "@/hooks/use-auto-sync";
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
    Smartphone,
    Users,
    Zap,
    ShoppingBag,
    Landmark,
    CreditCard,
    Settings,
    Droplets,
    Globe,
    Car,
    GraduationCap,
    Home,
    ShoppingCart,
    Coffee,
    UtensilsCrossed,
    Pill,
    FileText,
    IdCard,
    Building2,
} from "lucide-react";

export default function CitizenPage() {
    return (
        <RouteGuard allowedRoles={["citizen"]}>
            <CitizenHome />
        </RouteGuard>
    );
}

function CitizenHome() {
    const router = useRouter();
    const { wallet, balance, nid, linkedBank, offlineLimit } = useWallet();
    useAutoSync();
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
                        tx_type: tx.tx_type || "payment",
                        recipient: tx.upa_address || tx.recipient || tx.upa_id || "",
                        recipientName: tx.entity_name || tx.recipientName || "",
                        fromUPA: tx.metadata?.fromUPA || undefined,
                        amount: tx.amount,
                        intent: tx.intent_label || tx.intent || tx.metadata?.intent || "",
                        intentCategory: tx.intent_category || tx.intentCategory || "",
                        metadata: tx.metadata || {},
                        status: tx.status,
                        mode: tx.mode || "online",
                        payment_source: tx.payment_source || "wallet",
                        nonce: tx.nonce,
                        timestamp: new Date(tx.issued_at || tx.created_at || tx.timestamp || Date.now()).getTime(),
                        settledAt: tx.settled_at ? new Date(tx.settled_at).getTime() : undefined,
                        walletProvider: tx.wallet_provider,
                        message: tx.metadata?.message || undefined,
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
    const offlinePct = offlineLimit.maxAmount > 0 ? Math.round((offlineLimit.currentUsed / offlineLimit.maxAmount) * 100) : 0;

    // Intent icon mapping
    const getIntentIcon = (tx: Transaction): ReactNode => {
        const cat = tx.intentCategory || tx.tx_type || "";
        const intent = tx.intent?.toLowerCase() || "";
        if (tx.tx_type === "c2c") return <Users className="h-4 w-4 text-purple-500" />;
        if (cat === "bill_payment" || intent.includes("electricity")) return <Zap className="h-4 w-4 text-amber-500" />;
        if (intent.includes("water")) return <Droplets className="h-4 w-4 text-blue-500" />;
        if (intent.includes("internet")) return <Globe className="h-4 w-4 text-green-500" />;
        if (cat === "fine" || intent.includes("traffic")) return <Car className="h-4 w-4 text-red-500" />;
        if (cat === "tuition" || intent.includes("school") || intent.includes("tuition")) return <GraduationCap className="h-4 w-4 text-indigo-500" />;
        if (cat === "tax" || intent.includes("property")) return <Home className="h-4 w-4 text-teal-500" />;
        if (cat === "merchant" || tx.tx_type === "merchant_purchase") return <ShoppingCart className="h-4 w-4 text-green-600" />;
        if (intent.includes("coffee")) return <Coffee className="h-4 w-4 text-amber-700" />;
        if (intent.includes("restaurant") || intent.includes("dal bhat")) return <UtensilsCrossed className="h-4 w-4 text-orange-500" />;
        if (intent.includes("pharmacy")) return <Pill className="h-4 w-4 text-pink-500" />;
        if (intent.includes("passport")) return <FileText className="h-4 w-4 text-blue-600" />;
        return <CreditCard className="h-4 w-4 text-gray-500" />;
    };

    if (!mounted) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-lg mx-auto">
            {/* Balance Card */}
            <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0">
                <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-blue-100 text-sm mb-1">{wallet?.name || "UPA Pay"}</p>
                            <p className="text-3xl font-bold tracking-tight">{formatCurrency(balance)}</p>
                        </div>
                        <div className="p-3 bg-white/10 rounded-2xl">
                            <Shield className="h-7 w-7 text-white" />
                        </div>
                    </div>

                    {/* NID + Bank Row */}
                    <div className="flex items-center gap-3 pt-3 border-t border-white/20 text-sm">
                        {nid ? (
                            <span className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-md text-xs">
                                <IdCard className="h-3 w-3" /> NID: {nid.nidNumber.split("-").slice(0, 2).join("-")}...
                            </span>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-100 hover:text-white hover:bg-white/10 text-xs h-7 px-2"
                                onClick={() => router.push("/pay/nid")}
                            >
                                + Link NID
                            </Button>
                        )}
                        {linkedBank ? (
                            <span className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-md text-xs">
                                <Building2 className="h-3 w-3" /> {linkedBank.bankName.split(" ")[0]} {linkedBank.accountNumber}
                            </span>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-6 pt-3 text-blue-100">
                        <div>
                            <p className="text-[10px] uppercase tracking-wider">Spent</p>
                            <p className="text-sm font-semibold text-white">{formatCurrency(totalSpent)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-wider">Payments</p>
                            <p className="text-sm font-semibold text-white">{transactions.length}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Payment Methods Grid — 6 buttons */}
            <div className="grid grid-cols-3 gap-3">
                <Button
                    variant="outline"
                    className="h-20 flex-col gap-1.5 hover:bg-blue-50 hover:border-blue-300"
                    onClick={() => router.push("/pay/scan")}
                >
                    <ScanLine className="h-5 w-5 text-blue-600" />
                    <span className="text-xs font-medium">Scan QR</span>
                </Button>
                <Button
                    variant="outline"
                    className="h-20 flex-col gap-1.5 hover:bg-purple-50 hover:border-purple-300"
                    onClick={() => router.push("/pay/nid")}
                >
                    <Smartphone className="h-5 w-5 text-purple-600" />
                    <span className="text-xs font-medium">NFC Tap</span>
                </Button>
                <Button
                    variant="outline"
                    className="h-20 flex-col gap-1.5 hover:bg-green-50 hover:border-green-300"
                    onClick={() => router.push("/pay/c2c")}
                >
                    <Users className="h-5 w-5 text-green-600" />
                    <span className="text-xs font-medium">Send C2C</span>
                </Button>
                <Button
                    variant="outline"
                    className="h-20 flex-col gap-1.5 hover:bg-amber-50 hover:border-amber-300"
                    onClick={() => router.push("/pay/bills")}
                >
                    <Zap className="h-5 w-5 text-amber-600" />
                    <span className="text-xs font-medium">Pay Bills</span>
                </Button>
                <Button
                    variant="outline"
                    className="h-20 flex-col gap-1.5 hover:bg-rose-50 hover:border-rose-300"
                    onClick={() => router.push("/pay/scan")}
                >
                    <ShoppingBag className="h-5 w-5 text-rose-600" />
                    <span className="text-xs font-medium">Shop</span>
                </Button>
                <Button
                    variant="outline"
                    className="h-20 flex-col gap-1.5 hover:bg-slate-50 hover:border-slate-300"
                    onClick={() => router.push("/pay/scan")}
                >
                    <Landmark className="h-5 w-5 text-slate-600" />
                    <span className="text-xs font-medium">Govt Pay</span>
                </Button>
            </div>

            {/* UPA Direct Pay */}
            <Card>
                <CardContent className="p-3">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Enter UPA (e.g., traffic@nepal.gov)"
                            value={upaAddress}
                            onChange={(e) => setUpaAddress(e.target.value)}
                            className="flex-1 h-9 text-sm"
                        />
                        <Button size="sm" className="h-9" onClick={() => {
                            if (upaAddress) router.push(`/pay/confirm?recipient=${encodeURIComponent(upaAddress)}`);
                        }}>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Offline Spending Limit Bar */}
            <Card>
                <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-xs font-medium text-muted-foreground">Offline Limit</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => router.push("/pay/settings")}>
                            <Settings className="h-3 w-3 mr-1" />
                            Adjust
                        </Button>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                            <div
                                className={`h-2.5 rounded-full transition-all ${offlinePct > 80 ? "bg-red-500" : offlinePct > 50 ? "bg-amber-500" : "bg-green-500"}`}
                                style={{ width: `${Math.min(offlinePct, 100)}%` }}
                            />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatCurrency(offlineLimit.currentUsed)} / {formatCurrency(offlineLimit.maxAmount)}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Queued Payments notice */}
            {transactions.some((t) => t.status === "queued") && (
                <div className="w-full h-12 flex items-center justify-center gap-2 rounded-md bg-secondary px-4">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-sm">
                        {transactions.filter((t) => t.status === "queued").length} Queued Payments — Will auto-sync when online
                    </span>
                </div>
            )}

            {/* Recent Activity */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Recent Activity</h3>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setLoading(true); loadTransactions().finally(() => setLoading(false)); }} disabled={loading}>
                    <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardContent className="pt-3 pb-2">
                    {loading ? (
                        <div className="text-center py-6 text-muted-foreground">
                            <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                            <p className="text-xs">Loading...</p>
                        </div>
                    ) : recentTx.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                            <p className="text-xs">No payments yet. Scan a QR to get started!</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {recentTx.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between p-2.5 border rounded-lg hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">{getIntentIcon(tx)}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <p className="font-medium text-xs truncate">
                                                    {tx.tx_type === "c2c" ? tx.intent || "Transfer" : tx.intent}
                                                </p>
                                                {tx.status === "settled" ? (
                                                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                                ) : tx.status === "queued" || tx.status === "pending" ? (
                                                    <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                                                ) : (
                                                    <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground truncate">
                                                {tx.tx_type === "c2c"
                                                    ? `→ ${tx.metadata?.toUPA || tx.recipient}`
                                                    : tx.recipientName || tx.recipient}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <p className="text-[10px] text-muted-foreground">{formatDate(new Date(tx.timestamp))}</p>
                                                {tx.mode === "offline" ? (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded">
                                                        <WifiOff className="h-2 w-2" /> Offline
                                                    </span>
                                                ) : tx.mode === "nfc" ? (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] bg-purple-50 text-purple-600 px-1 py-0.5 rounded">
                                                        <CreditCard className="h-2 w-2" /> NFC
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded">
                                                        <Wifi className="h-2 w-2" /> Online
                                                    </span>
                                                )}
                                                {tx.payment_source === "nid_bank" && (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded"><Building2 className="h-2 w-2" /> Bank</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right ml-2">
                                        <p className="font-semibold text-xs">-{formatCurrency(tx.amount)}</p>
                                        <p className={`text-[10px] capitalize ${tx.status === "settled" ? "text-emerald-500" : tx.status === "queued" || tx.status === "pending" ? "text-amber-500" : "text-red-500"}`}>
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
