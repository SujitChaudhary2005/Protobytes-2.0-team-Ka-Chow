"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/wallet-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Transaction } from "@/types";
import { useAutoSync } from "@/hooks/use-auto-sync";
import { recoverFromWAL } from "@/lib/acid-transaction";
import { Area, AreaChart, Bar, BarChart as RechartsBarChart, CartesianGrid, Pie, PieChart as RechartsPieChart, XAxis, YAxis } from "recharts";
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    Camera,
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
    TrendingUp,
    BarChart3,
    DollarSign,
} from "lucide-react";
import { useNetwork } from "@/hooks/use-network";

export function CitizenHome() {
    const router = useRouter();
    const { wallet, balance, nid, linkedBank, offlineWallet, saralPayBalance, transactions: walletTransactions, user, addTransaction, updateBalance, canSpendOffline, spendFromSaralPay } = useWallet();
    const { online } = useNetwork();
    useAutoSync(!!wallet, offlineWallet);
    const [upaAddress, setUpaAddress] = useState("");
    const [mounted, setMounted] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setMounted(true);
        // ACID Durability: Recover any incomplete transactions from WAL on startup
        const { recovered, failed } = recoverFromWAL();
        if (recovered > 0) {
            console.log(`[ACID] WAL recovery: ${recovered} transaction(s) recovered, ${failed} failed`);
        }
    }, []);

    // Determine the current user's UPA for detecting incoming vs outgoing
    const myUPA = nid?.linkedUPA || user?.upa_id || "";

    const loadTransactions = useCallback(async () => {
        // Try API first (prioritize Supabase data)
        try {
            const res = await fetch("/api/transactions");
            if (res.ok) {
                const result = await res.json();
                if (result.data && Array.isArray(result.data) && result.data.length > 0) {
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
        } catch (err) { 
            console.error("Failed to load transactions from API:", err);
        }
        
        // Fallback to wallet context if API fails or returns no data
        if (walletTransactions && walletTransactions.length > 0) {
            setTransactions(walletTransactions);
        }
    }, [walletTransactions]);

    useEffect(() => {
        const load = async () => { setLoading(true); await loadTransactions(); setLoading(false); };
        load();
        const interval = setInterval(loadTransactions, 5000);
        return () => clearInterval(interval);
    }, [loadTransactions]);

    const totalSpent = transactions
        .filter((t) => t.status === "settled")
        .filter((t) => {
            // Exclude incoming C2C from "spent" total
            if (t.tx_type === "c2c" && t.fromUPA !== myUPA && t.metadata?.fromUPA !== myUPA && (t.fromUPA || t.metadata?.fromUPA)) return false;
            return true;
        })
        .reduce((sum, t) => sum + t.amount, 0);
    const recentTx = transactions.slice(0, 8);

    // ─── Spending stats ─────────────────────────────────────────────────
    const settledCount = transactions.filter((t) => t.status === "settled").length;
    const pendingCount = transactions.filter((t) => t.status === "pending" || t.status === "queued").length;
    const todaySpent = transactions.filter((t) => {
        const d = new Date(t.timestamp); const now = new Date();
        return t.status === "settled" && d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, t) => s + t.amount, 0);

    // ─── Spending trend chart ───────────────────────────────────────────
    const [chartTimeRange, setChartTimeRange] = useState("90d");

    const spendingChartConfig: ChartConfig = {
        spent: { label: "Spent", color: "hsl(var(--chart-1))" },
        pending: { label: "Pending", color: "hsl(var(--chart-3))" },
    };

    const spendingChartData = useMemo(() => {
        const byDate: Record<string, { spent: number; pending: number }> = {};
        transactions.forEach((tx) => {
            const d = new Date(tx.timestamp);
            const key = d.toISOString().split("T")[0];
            if (!byDate[key]) byDate[key] = { spent: 0, pending: 0 };
            if (tx.status === "settled") byDate[key].spent += tx.amount;
            else byDate[key].pending += tx.amount;
        });
        return Object.entries(byDate)
            .map(([date, v]) => ({ date, ...v }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [transactions]);

    const filteredChartData = useMemo(() => {
        if (spendingChartData.length === 0) return [];
        const refDate = new Date(spendingChartData[spendingChartData.length - 1].date);
        let days = 90;
        if (chartTimeRange === "30d") days = 30;
        else if (chartTimeRange === "7d") days = 7;
        const start = new Date(refDate);
        start.setDate(start.getDate() - days);
        return spendingChartData.filter((item) => new Date(item.date) >= start);
    }, [spendingChartData, chartTimeRange]);

    // ─── Category pie chart data ────────────────────────────────────────
    const PIE_COLORS = ["hsl(221, 83%, 53%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(280, 65%, 60%)", "hsl(0, 84%, 60%)", "hsl(190, 80%, 45%)"];

    const categoryPieData = useMemo(() => {
        const byType: Record<string, number> = {};
        transactions.filter(t => t.status === "settled").forEach(tx => {
            const key = tx.tx_type === "c2c" ? "transfers"
                : (tx.intentCategory === "bill_payment" || tx.intent?.toLowerCase().includes("bill") || tx.intent?.toLowerCase().includes("electric") || tx.intent?.toLowerCase().includes("water")) ? "bills"
                    : tx.tx_type === "merchant_purchase" ? "merchant" : "payments";
            byType[key] = (byType[key] || 0) + tx.amount;
        });
        return Object.entries(byType).map(([name, value]) => ({ name, value, fill: `var(--color-${name})` })).sort((a, b) => b.value - a.value);
    }, [transactions]);

    const categoryPieConfig: ChartConfig = useMemo(() => {
        const labels: Record<string, string> = { payments: "QR Payments", transfers: "Transfers", bills: "Bills", merchant: "Merchant" };
        const cfg: ChartConfig = { value: { label: "Amount" } };
        categoryPieData.forEach((d, i) => { cfg[d.name] = { label: labels[d.name] || d.name, color: PIE_COLORS[i % PIE_COLORS.length] }; });
        return cfg;
    }, [categoryPieData]);

    // ─── Online vs Offline bar chart ────────────────────────────────────
    const modeBarData = useMemo(() => {
        const getWeekKey = (d: Date) => { const s = new Date(d); s.setDate(s.getDate() - s.getDay()); return s.toISOString().split("T")[0]; };
        const byWeek: Record<string, { online: number; offline: number }> = {};
        transactions.filter(t => t.status === "settled").forEach(tx => {
            const key = getWeekKey(new Date(tx.timestamp));
            if (!byWeek[key]) byWeek[key] = { online: 0, offline: 0 };
            if (tx.mode === "offline") byWeek[key].offline += tx.amount;
            else byWeek[key].online += tx.amount;
        });
        return Object.entries(byWeek)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-6)
            .map(([key, v]) => ({ week: new Date(key).toLocaleDateString("en-US", { month: "short", day: "numeric" }), ...v }));
    }, [transactions]);

    const modeBarConfig: ChartConfig = {
        online: { label: "Online", color: "hsl(142, 71%, 45%)" },
        offline: { label: "Offline", color: "hsl(38, 92%, 50%)" },
    };

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
        <div className="p-4 md:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Dashboard</h2>
            </div>

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

            {/* Payment Methods Grid */}
            <div className="grid grid-cols-2 gap-3">
                <Button
                    variant="outline"
                    className="h-20 flex-col gap-1.5 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                    onClick={() => router.push("/pay?mode=qr")}
                >
                    <ScanLine className="h-5 w-5 text-blue-600" />
                    <span className="text-xs font-medium text-gray-700">QR Payment</span>
                </Button>
                <Button
                    variant="outline"
                    className="h-20 flex-col gap-1.5 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700"
                    onClick={() => router.push("/pay?mode=nfc")}
                >
                    <Smartphone className="h-5 w-5 text-purple-600" />
                    <span className="text-xs font-medium text-gray-700">NFC Payment</span>
                </Button>
                <Button
                    variant="outline"
                    className="h-20 flex-col gap-1.5 hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                    onClick={() => router.push("/pay/c2c")}
                >
                    <Users className="h-5 w-5 text-green-600" />
                    <span className="text-xs font-medium text-gray-700">Send to Contact</span>
                </Button>
                <Button
                    variant="outline"
                    className="h-20 flex-col gap-1.5 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700"
                    onClick={() => router.push("/pay/bills")}
                >
                    <Zap className="h-5 w-5 text-amber-600" />
                    <span className="text-xs font-medium text-gray-700">Pay Bills</span>
                </Button>
            </div>

            {/* Quick Pay — simulate common payments without camera */}
            <Card>
                <CardContent className="p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Pay</p>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: "Traffic Fine", upa: "traffic@nepal.gov", entity: "Nepal Traffic Police", intent: "traffic_fine", cat: "fine", amount: 500, icon: Car },
                            { label: "Electricity Bill", upa: "billing@nea.gov.np", entity: "Nepal Electricity Authority", intent: "electricity_bill", cat: "bill_payment", amount: 1200, icon: Zap },
                            { label: "Water Bill", upa: "billing@khanepani.gov.np", entity: "Kathmandu Upatyaka Khanepani", intent: "water_bill", cat: "bill_payment", amount: 350, icon: Droplets },
                            { label: "Property Tax", upa: "revenue@kathmandu.gov.np", entity: "Kathmandu Metropolitan", intent: "property_tax", cat: "tax", amount: 2500, icon: Landmark },
                        ].map((item) => (
                            <Button
                                key={item.intent}
                                variant="outline"
                                size="sm"
                                className="h-10 text-xs justify-start gap-2"
                                onClick={() => {
                                    const payload = {
                                        version: "1.0",
                                        upa: item.upa,
                                        entity_name: item.entity,
                                        intent: { id: item.intent, category: item.cat, label: item.label },
                                        amount_type: "fixed",
                                        amount: item.amount,
                                        currency: "NPR",
                                        metadata_schema: {},
                                    };
                                    router.push(`/pay/confirm?data=${encodeURIComponent(JSON.stringify(payload))}&method=qr`);
                                }}
                            >
                                <item.icon className="h-3.5 w-3.5 shrink-0" />
                                {item.label}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Offline Payment */}
            <Button
                variant="outline"
                className="w-full h-12 gap-2 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700"
                onClick={() => router.push("/pay/offline")}
            >
                <WifiOff className="h-5 w-5 text-rose-600" />
                <span className="text-sm font-medium text-gray-700">Cross-Device Offline Payment</span>
            </Button>

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

            {/* SaralPay Offline Wallet Card */}
            <Card className={`${offlineWallet.loaded ? "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50" : "border-dashed"}`}>
                <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <WifiOff className={`h-3.5 w-3.5 ${offlineWallet.loaded ? "text-amber-600" : "text-muted-foreground"}`} />
                            <p className={`text-xs font-medium ${offlineWallet.loaded ? "text-amber-800" : "text-muted-foreground"}`}>SaralPay Wallet</p>
                            {offlineWallet.loaded && (
                                <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Active</span>
                            )}
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => router.push("/pay/settings")}>
                            <Settings className="h-3 w-3 mr-1" />
                            {offlineWallet.loaded ? "Manage" : "Load"}
                        </Button>
                    </div>
                    {offlineWallet.loaded ? (
                        <div className="space-y-3 mt-1">
                            <div className="flex items-center gap-3">
                                <p className="text-lg font-bold text-amber-700">{formatCurrency(saralPayBalance)}</p>
                                <span className="text-[10px] text-amber-600">offline balance</span>
                            </div>
                            <Button
                                size="sm"
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs shadow-sm border border-indigo-200"
                                onClick={() => router.push("/pay/offline")}
                            >
                                <Smartphone className="h-3.5 w-3.5 mr-1.5" />
                                Scan Cross-Device QR
                            </Button>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Load your SaralPay wallet for offline NFC payments
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* ─── Spending Summary Cards ────────────────────────────── */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <Card className="border-l-4 border-l-primary">
                    <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Total Spent</p>
                        <p className="text-lg font-bold">{formatCurrency(totalSpent)}</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Today</p>
                        <p className="text-lg font-bold text-emerald-600">{formatCurrency(todaySpent)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Settled</p>
                        <p className="text-lg font-bold">{settledCount}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Pending</p>
                        <p className="text-lg font-bold text-amber-500">{pendingCount}</p>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Spending Trend Chart ────────────────────────────────── */}
            <Card className="pt-0">
                <CardHeader className="flex items-center gap-2 space-y-0 border-b py-4 sm:flex-row">
                    <div className="grid flex-1 gap-1">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            Spending Trend
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Your payment activity over time
                        </CardDescription>
                    </div>
                    <Select value={chartTimeRange} onValueChange={setChartTimeRange}>
                        <SelectTrigger
                            className="w-[140px] rounded-lg text-xs h-8 sm:ml-auto"
                            aria-label="Select time range"
                        >
                            <SelectValue placeholder="Last 3 months" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="90d" className="rounded-lg">Last 3 months</SelectItem>
                            <SelectItem value="30d" className="rounded-lg">Last 30 days</SelectItem>
                            <SelectItem value="7d" className="rounded-lg">Last 7 days</SelectItem>
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                    {filteredChartData.length > 0 ? (
                        <ChartContainer config={spendingChartConfig} className="aspect-auto h-[220px] w-full">
                            <AreaChart data={filteredChartData}>
                                <defs>
                                    <linearGradient id="fillSpent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-spent)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="var(--color-spent)" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="fillPendingCitizen" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-pending)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="var(--color-pending)" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    minTickGap={32}
                                    tickFormatter={(value) => {
                                        const date = new Date(value);
                                        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                                    }}
                                />
                                <ChartTooltip
                                    cursor={false}
                                    content={
                                        <ChartTooltipContent
                                            labelFormatter={(value) =>
                                                new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                            }
                                            indicator="dot"
                                        />
                                    }
                                />
                                <Area dataKey="pending" type="natural" fill="url(#fillPendingCitizen)" stroke="var(--color-pending)" stackId="a" />
                                <Area dataKey="spent" type="natural" fill="url(#fillSpent)" stroke="var(--color-spent)" stackId="a" />
                                <ChartLegend content={<ChartLegendContent />} />
                            </AreaChart>
                        </ChartContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
                            <BarChart3 className="h-10 w-10 opacity-20 mb-2" />
                            <p className="text-sm">No spending data yet</p>
                            <p className="text-xs mt-1">Make payments to see your spending trend</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ─── Pie + Bar Analytics Row ────────────────────────────── */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-primary" />
                            Spending Distribution
                        </CardTitle>
                        <CardDescription className="text-xs">Breakdown by payment type</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {categoryPieData.length > 0 ? (
                            <ChartContainer config={categoryPieConfig} className="mx-auto aspect-square max-h-[250px]">
                                <RechartsPieChart>
                                    <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                                    <Pie data={categoryPieData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5} />
                                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                                </RechartsPieChart>
                            </ChartContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                                <DollarSign className="h-10 w-10 opacity-20 mb-2" />
                                <p className="text-sm">No spending data yet</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Online vs Offline
                        </CardTitle>
                        <CardDescription className="text-xs">Weekly payment mode comparison</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {modeBarData.length > 0 ? (
                            <ChartContainer config={modeBarConfig} className="aspect-auto h-[250px] w-full">
                                <RechartsBarChart data={modeBarData}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="online" fill="var(--color-online)" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="offline" fill="var(--color-offline)" radius={[4, 4, 0, 0]} />
                                    <ChartLegend content={<ChartLegendContent />} />
                                </RechartsBarChart>
                            </ChartContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                                <BarChart3 className="h-10 w-10 opacity-20 mb-2" />
                                <p className="text-sm">No data yet</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

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
                                                    ? (tx.fromUPA === myUPA || tx.metadata?.fromUPA === myUPA
                                                        ? `→ Sent to ${tx.metadata?.toUPA || tx.recipient}`
                                                        : `← Received from ${tx.fromUPA || tx.metadata?.fromUPA || tx.recipient}`)
                                                    : tx.recipientName || tx.recipient}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <p className="text-[10px] text-muted-foreground">{formatDate(new Date(tx.timestamp))}</p>
                                                {tx.mode === "offline" ? (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded">
                                                        <WifiOff className="h-2 w-2" /> Offline
                                                    </span>
                                                ) : tx.mode === "camera" ? (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded">
                                                        <Camera className="h-2 w-2" /> Camera
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
                                        {(() => {
                                            const isIncoming = tx.tx_type === "c2c" && tx.fromUPA !== myUPA && tx.metadata?.fromUPA !== myUPA && (tx.fromUPA || tx.metadata?.fromUPA);
                                            return (
                                                <>
                                                    <p className={`font-semibold text-xs ${isIncoming ? "text-green-600" : ""}`}>
                                                        {isIncoming ? "+" : "-"}{formatCurrency(tx.amount)}
                                                    </p>
                                                    <p className={`text-[10px] capitalize ${tx.status === "settled" ? "text-emerald-500" : tx.status === "queued" || tx.status === "pending" ? "text-amber-500" : "text-red-500"}`}>
                                                        {tx.status}
                                                    </p>
                                                </>
                                            );
                                        })()}
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
