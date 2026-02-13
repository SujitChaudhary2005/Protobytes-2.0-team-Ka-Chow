"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getTransactions, Transaction } from "@/lib/storage";
import { isSupabaseConfigured, subscribeToTransactions } from "@/lib/supabase";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";
import { useAutoSync } from "@/hooks/use-auto-sync";
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
    TrendingUp,
    DollarSign,
    CheckCircle2,
    Clock,
    XCircle,
    Activity,
    Download,
    Search,
    BarChart3,
    PieChart,
    FileCheck,
    AlertTriangle,
    Loader2,
    Building2,
    Wifi,
    WifiOff,
    Globe,
    Users,
    CreditCard,
    RefreshCw,
    Smartphone,
    Store,
    Receipt,
    IdCard,
    Coins,
} from "lucide-react";

export default function AdminPageWrapper() {
    return (
        <RouteGuard allowedRoles={["admin"]}>
            <AdminDashboard />
        </RouteGuard>
    );
}

function AdminDashboard() {
    useAutoSync(); // Auto-sync queued offline payments when coming back online
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "settled" | "pending" | "failed">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [reconciling, setReconciling] = useState(false);
    const [reconReport, setReconReport] = useState<any>(null);

    // UPA ID lookup state
    const [upaLookupQuery, setUpaLookupQuery] = useState("");
    const [lookupResults, setLookupResults] = useState<Transaction[]>([]);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupFilter, setLookupFilter] = useState<"all" | "settled" | "pending" | "failed">("all");
    const [hasSearched, setHasSearched] = useState(false);

    const loadTransactions = useCallback(async () => {
        try {
            const res = await fetch("/api/transactions");
            if (res.ok) {
                const result = await res.json();
                if (result.data && Array.isArray(result.data) && result.data.length > 0) {
                    setTransactions(result.data.map((tx: any) => ({
                        id: tx.id || tx.tx_id,
                        recipient: tx.recipient || tx.upa_address || tx.upa_id || "",
                        recipientName: tx.recipientName || tx.entity_name || "",
                        amount: tx.amount,
                        intent: tx.intent || tx.intent_label || "",
                        metadata: tx.metadata || {},
                        status: tx.status,
                        mode: tx.mode || "online",
                        signature: tx.signature,
                        publicKey: tx.publicKey,
                        timestamp: tx.timestamp || new Date(tx.issued_at || tx.created_at || Date.now()).getTime(),
                        nonce: tx.nonce,
                        walletProvider: tx.walletProvider || tx.wallet_provider,
                    })));
                    return;
                }
            }
        } catch { /* ignore */ }
        try { setTransactions(getTransactions()); } catch { /* ignore */ }
    }, []);

    // Initial load
    useEffect(() => {
        const load = async () => { setLoading(true); await loadTransactions(); setLoading(false); };
        load();
    }, [loadTransactions]);

    // Auto-refresh: Supabase Realtime (primary) + event + storage listeners (fallback)
    useEffect(() => {
        // React to `upa-transactions-updated` dispatched by auto-sync hook
        const onTxUpdate = () => {
            loadTransactions();
        };
        window.addEventListener("upa-transactions-updated", onTxUpdate);

        // Also react to storage events (cross-tab sync)
        const onStorage = (e: StorageEvent) => {
            if (e.key?.includes("upa_transactions")) {
                loadTransactions();
            }
        };
        window.addEventListener("storage", onStorage);

        // ── Supabase Realtime ────────────────────────────────────
        // When active, reload on every INSERT/UPDATE — no polling needed.
        const channel = subscribeToTransactions(
            () => loadTransactions(),   // onInsert
            () => loadTransactions(),   // onUpdate
        );

        // Fallback polling: 30s if Supabase Realtime is active, 10s if not
        const pollInterval = channel ? 30_000 : 10_000;
        const interval = setInterval(loadTransactions, pollInterval);

        return () => {
            window.removeEventListener("upa-transactions-updated", onTxUpdate);
            window.removeEventListener("storage", onStorage);
            clearInterval(interval);
            // Clean up Supabase channel
            if (channel) {
                channel.unsubscribe();
            }
        };
    }, [loadTransactions]);

    const filteredTransactions = transactions.filter((tx) => {
        if (filter !== "all" && tx.status !== filter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return tx.recipient?.toLowerCase().includes(q) || tx.intent?.toLowerCase().includes(q) || tx.id?.toLowerCase().includes(q) || tx.recipientName?.toLowerCase().includes(q);
        }
        return true;
    });

    // Lookup transactions by UPA ID
    const handleUpaLookup = async () => {
        if (!upaLookupQuery.trim()) { toast.error("Please enter a UPA ID to search"); return; }
        setLookupLoading(true);
        setHasSearched(true);
        try {
            const res = await fetch(`/api/transactions?upa_id=${encodeURIComponent(upaLookupQuery.trim())}`);
            if (res.ok) {
                const result = await res.json();
                if (result.data && Array.isArray(result.data)) {
                    setLookupResults(result.data.map((tx: any) => ({
                        id: tx.id || tx.tx_id,
                        recipient: tx.recipient || tx.upa_address || tx.upa_id || "",
                        recipientName: tx.recipientName || tx.entity_name || "",
                        amount: tx.amount,
                        intent: tx.intent || tx.intent_label || "",
                        metadata: tx.metadata || {},
                        status: tx.status,
                        mode: tx.mode || "online",
                        signature: tx.signature,
                        publicKey: tx.publicKey,
                        timestamp: tx.timestamp || new Date(tx.issued_at || tx.created_at || Date.now()).getTime(),
                        nonce: tx.nonce,
                        walletProvider: tx.walletProvider || tx.wallet_provider,
                    })));
                } else { setLookupResults([]); }
            } else { setLookupResults([]); toast.error("Failed to fetch"); }
        } catch { setLookupResults([]); toast.error("Lookup failed"); }
        finally { setLookupLoading(false); }
    };

    const filteredLookupResults = lookupResults.filter((tx) => {
        if (lookupFilter !== "all" && tx.status !== lookupFilter) return false;
        return true;
    });

    const lookupStats = {
        total: lookupResults.length,
        settled: lookupResults.filter(t => t.status === "settled").length,
        pending: lookupResults.filter(t => t.status === "pending" || t.status === "queued").length,
        totalAmount: lookupResults.filter(t => t.status === "settled").reduce((s, t) => s + t.amount, 0),
    };

    const stats = {
        total: transactions.length,
        settled: transactions.filter((t) => t.status === "settled").length,
        pending: transactions.filter((t) => t.status === "pending" || t.status === "queued").length,
        failed: transactions.filter((t) => t.status === "failed").length,
        totalRevenue: transactions.filter((t) => t.status === "settled").reduce((sum, t) => sum + t.amount, 0),
        todayRevenue: transactions.filter((t) => {
            const d = new Date(t.timestamp); const now = new Date();
            return t.status === "settled" && d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((sum, t) => sum + t.amount, 0),
        onlineCount: transactions.filter((t) => t.mode === "online").length,
        offlineCount: transactions.filter((t) => t.mode === "offline").length,
    };

    // Group by entity (recipient)
    const entityGroups = transactions.reduce((acc, tx) => {
        const entity = tx.recipientName || tx.recipient || "Unknown";
        if (!acc[entity]) acc[entity] = { count: 0, amount: 0, settled: 0 };
        acc[entity].count++;
        acc[entity].amount += tx.amount;
        if (tx.status === "settled") acc[entity].settled++;
        return acc;
    }, {} as Record<string, { count: number; amount: number; settled: number }>);

    // Group by intent
    const intentGroups = transactions.reduce((acc, tx) => {
        const intent = tx.intent || "Other";
        if (!acc[intent]) acc[intent] = { count: 0, amount: 0 };
        acc[intent].count++;
        acc[intent].amount += tx.amount;
        return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    const reconciliationRate = stats.total > 0 ? Math.round((stats.settled / stats.total) * 100) : 100;

    // ─── Chart: Revenue trend by day ───────────────────────────────────
    const [chartTimeRange, setChartTimeRange] = useState("90d");

    const chartConfig: ChartConfig = {
        settled: { label: "Settled", color: "hsl(var(--chart-1))" },
        pending: { label: "Pending", color: "hsl(var(--chart-3))" },
    };

    const chartData = useMemo(() => {
        // Group transactions by date
        const byDate: Record<string, { settled: number; pending: number }> = {};
        transactions.forEach((tx) => {
            const d = new Date(tx.timestamp);
            const key = d.toISOString().split("T")[0]; // YYYY-MM-DD
            if (!byDate[key]) byDate[key] = { settled: 0, pending: 0 };
            if (tx.status === "settled") byDate[key].settled += tx.amount;
            else byDate[key].pending += tx.amount;
        });
        return Object.entries(byDate)
            .map(([date, v]) => ({ date, ...v }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [transactions]);

    const filteredChartData = useMemo(() => {
        if (chartData.length === 0) return [];
        const refDate = new Date(chartData[chartData.length - 1].date);
        let days = 90;
        if (chartTimeRange === "30d") days = 30;
        else if (chartTimeRange === "7d") days = 7;
        const start = new Date(refDate);
        start.setDate(start.getDate() - days);
        return chartData.filter((item) => new Date(item.date) >= start);
    }, [chartData, chartTimeRange]);

    // Group by tx_type
    const txTypeGroups = transactions.reduce((acc, tx) => {
        const type = (tx as any).tx_type || "payment";
        if (!acc[type]) acc[type] = { count: 0, amount: 0 };
        acc[type].count++;
        acc[type].amount += tx.amount;
        return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    const TX_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
        payment: { label: "QR Payments", icon: <Smartphone className="h-5 w-5 text-blue-500" />, color: "bg-blue-500" },
        merchant_purchase: { label: "Merchant", icon: <Store className="h-5 w-5 text-green-500" />, color: "bg-green-500" },
        c2c: { label: "C2C Transfers", icon: <Users className="h-5 w-5 text-purple-500" />, color: "bg-purple-500" },
        bill_payment: { label: "Bill Payments", icon: <Receipt className="h-5 w-5 text-amber-500" />, color: "bg-amber-500" },
        nid_payment: { label: "NID/NFC", icon: <IdCard className="h-5 w-5 text-red-500" />, color: "bg-red-500" },
    };

    // Mock ministry allocation (derived from transaction data)
    const ministryAllocation = [
        { name: "Ministry of Finance", share: 35, amount: Math.round(stats.totalRevenue * 0.35) },
        { name: "Ministry of Energy", share: 25, amount: Math.round(stats.totalRevenue * 0.25) },
        { name: "Local Government", share: 20, amount: Math.round(stats.totalRevenue * 0.20) },
        { name: "Ministry of Communication", share: 12, amount: Math.round(stats.totalRevenue * 0.12) },
        { name: "Others", share: 8, amount: Math.round(stats.totalRevenue * 0.08) },
    ];

    // Revenue periods
    const now = new Date();
    const monthRevenue = transactions.filter(t => {
        const d = new Date(t.timestamp);
        return t.status === "settled" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, t) => s + t.amount, 0);

    const yearRevenue = transactions.filter(t => {
        const d = new Date(t.timestamp);
        return t.status === "settled" && d.getFullYear() === now.getFullYear();
    }).reduce((s, t) => s + t.amount, 0);

    // ─── Revenue by Type Bar Chart ──────────────────────────────────────
    const typeBarData = useMemo(() => {
        const byType: Record<string, { settled: number; pending: number }> = {};
        transactions.forEach(tx => {
            const type = (tx as any).tx_type || "payment";
            if (!byType[type]) byType[type] = { settled: 0, pending: 0 };
            if (tx.status === "settled") byType[type].settled += tx.amount;
            else byType[type].pending += tx.amount;
        });
        const labels: Record<string, string> = { payment: "QR Pay", c2c: "Transfer", merchant_purchase: "Merchant", bill_payment: "Bills", nid_payment: "NID/NFC" };
        return Object.entries(byType).map(([type, v]) => ({ type: labels[type] || type, ...v }));
    }, [transactions]);

    const typeBarConfig: ChartConfig = {
        settled: { label: "Settled", color: "hsl(142, 71%, 45%)" },
        pending: { label: "Pending", color: "hsl(38, 92%, 50%)" },
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-primary" /> Nepal Government Dashboard
                    </h2>
                    <p className="text-sm text-muted-foreground">National UPA Payment Oversight & Reconciliation</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                        if (transactions.length === 0) { toast.error("No transactions to export"); return; }
                        const headers = ["Tx ID", "Recipient", "Amount", "Intent", "Status", "Mode", "Date"];
                        const rows = transactions.map(t => [
                            t.id, t.recipient || "", t.amount, t.intent || "", t.status, t.mode || "online",
                            new Date(t.timestamp).toISOString()
                        ]);
                        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `upa-transactions-${Date.now()}.csv`; a.click();
                        URL.revokeObjectURL(url);
                        toast.success(`Exported ${transactions.length} transactions`);
                    }}><Download className="h-4 w-4 mr-2" /> Export</Button>
                    <Button onClick={loadTransactions} disabled={loading} size="sm">
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                </div>
            </div>

            {/* National Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-primary">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total National Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground mt-1">{stats.settled} settled across all entities</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-success">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Today&apos;s Revenue</CardTitle>
                        <TrendingUp className="h-4 w-4 text-success" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-success">{formatCurrency(stats.todayRevenue)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Real-time collection</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-warning">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pending Settlement</CardTitle>
                        <Clock className="h-4 w-4 text-warning" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-warning">{stats.pending}</div>
                        <p className="text-xs text-muted-foreground mt-1">Offline + queued</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-accent">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Reconciliation Rate</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reconciliationRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">{stats.settled}/{stats.total} settled</p>
                    </CardContent>
                </Card>
            </div>

            {/* Entity + Intent Breakdown */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Revenue by Entity */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Globe className="h-4 w-4 text-primary" /> Revenue by Entity
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-3">
                            {Object.entries(entityGroups).sort((a, b) => b[1].amount - a[1].amount).slice(0, 6).map(([entity, data]) => {
                                const pct = stats.totalRevenue > 0 ? Math.round((data.amount / stats.totalRevenue) * 100) : 0;
                                return (
                                    <div key={entity}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium truncate mr-2">{entity}</span>
                                            <span className="text-sm font-bold shrink-0">{formatCurrency(data.amount)}</span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2">
                                            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">{data.count} txns &middot; {data.settled} settled</p>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Revenue by Intent */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <PieChart className="h-4 w-4 text-primary" /> Revenue by Payment Type
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-3">
                            {Object.entries(intentGroups).sort((a, b) => b[1].amount - a[1].amount).slice(0, 6).map(([intent, data]) => {
                                const pct = stats.totalRevenue > 0 ? Math.round((data.amount / stats.totalRevenue) * 100) : 0;
                                return (
                                    <div key={intent} className="flex items-center justify-between p-2 border rounded-lg">
                                        <div>
                                            <p className="font-medium text-sm">{intent}</p>
                                            <p className="text-xs text-muted-foreground">{data.count} payments</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-sm">{formatCurrency(data.amount)}</p>
                                            <p className="text-xs text-muted-foreground">{pct}%</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Network Mode Split */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Wifi className="h-4 w-4 text-success" />
                                <span className="text-sm"><span className="font-bold">{stats.onlineCount}</span> Online</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <WifiOff className="h-4 w-4 text-warning" />
                                <span className="text-sm"><span className="font-bold">{stats.offlineCount}</span> Offline</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm"><span className="font-bold">{Object.keys(entityGroups).length}</span> Entities</span>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm"><span className="font-bold">{stats.total}</span> Total Transactions</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Revenue Time Periods */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-green-50/50 border-green-100">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Today</p>
                        <p className="text-xl font-bold text-green-700">{formatCurrency(stats.todayRevenue)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50/50 border-blue-100">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">This Month</p>
                        <p className="text-xl font-bold text-blue-700">{formatCurrency(monthRevenue)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-purple-50/50 border-purple-100">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">This Year</p>
                        <p className="text-xl font-bold text-purple-700">{formatCurrency(yearRevenue)}</p>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Revenue Trend Chart ─────────────────────────────── */}
            <Card className="pt-0">
                <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
                    <div className="grid flex-1 gap-1">
                        <CardTitle>Revenue Trend</CardTitle>
                        <CardDescription>Settled vs pending amounts over time</CardDescription>
                    </div>
                    <Select value={chartTimeRange} onValueChange={setChartTimeRange}>
                        <SelectTrigger className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex" aria-label="Select time range">
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
                        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
                            <AreaChart data={filteredChartData}>
                                <defs>
                                    <linearGradient id="fillSettled" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-settled)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="var(--color-settled)" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="fillPending" x1="0" y1="0" x2="0" y2="1">
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
                                            labelFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            indicator="dot"
                                        />
                                    }
                                />
                                <Area dataKey="pending" type="natural" fill="url(#fillPending)" stroke="var(--color-pending)" stackId="a" />
                                <Area dataKey="settled" type="natural" fill="url(#fillSettled)" stroke="var(--color-settled)" stackId="a" />
                                <ChartLegend content={<ChartLegendContent />} />
                            </AreaChart>
                        </ChartContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                            <BarChart3 className="h-10 w-10 opacity-20 mb-2" />
                            <p className="text-sm">No transaction data for chart</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ─── Revenue by Transaction Type (Bar Chart) ──────────── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" /> Revenue by Transaction Type
                    </CardTitle>
                    <CardDescription className="text-xs">Settled vs pending amounts per payment category</CardDescription>
                </CardHeader>
                <CardContent>
                    {typeBarData.length > 0 ? (
                        <ChartContainer config={typeBarConfig} className="aspect-auto h-[280px] w-full">
                            <RechartsBarChart data={typeBarData}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="type" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                                <YAxis tickLine={false} axisLine={false} width={55} fontSize={11} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="settled" fill="var(--color-settled)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="pending" fill="var(--color-pending)" radius={[4, 4, 0, 0]} />
                                <ChartLegend content={<ChartLegendContent />} />
                            </RechartsBarChart>
                        </ChartContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
                            <BarChart3 className="h-10 w-10 opacity-20 mb-2" />
                            <p className="text-sm">No transaction data for chart</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Transaction Type Breakdown + Ministry Allocation */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" /> Transaction Type Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                        {Object.entries(txTypeGroups).sort((a, b) => b[1].amount - a[1].amount).map(([type, data]) => {
                            const info = TX_TYPE_LABELS[type] || { label: type, icon: <Coins className="h-5 w-5 text-gray-500" />, color: "bg-gray-500" };
                            const pct = stats.totalRevenue > 0 ? Math.round((data.amount / stats.totalRevenue) * 100) : 0;
                            return (
                                <div key={type} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                                    {info.icon}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium">{info.label}</span>
                                            <span className="text-sm font-bold">{formatCurrency(data.amount)}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                            <div className={`${info.color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{data.count} transactions &middot; {pct}%</p>
                                    </div>
                                </div>
                            );
                        })}
                        {Object.keys(txTypeGroups).length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">No transaction data</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" /> Ministry Allocation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                        {ministryAllocation.map((m) => (
                            <div key={m.name} className="flex items-center justify-between p-2 border rounded-lg">
                                <div>
                                    <p className="text-sm font-medium">{m.name}</p>
                                    <p className="text-xs text-muted-foreground">{m.share}% allocation</p>
                                </div>
                                <p className="text-sm font-bold">{formatCurrency(m.amount)}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* Ledger Reconciliation */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <FileCheck className="h-5 w-5 text-primary" /> Ledger Reconciliation
                        </CardTitle>
                        <Button size="sm" onClick={async () => {
                            setReconciling(true);
                            try {
                                const res = await fetch("/api/transactions/reconcile");
                                const data = await res.json();
                                if (data.success) { setReconReport(data.report); toast.success("Reconciliation complete"); }
                            } catch { toast.error("Reconciliation failed"); }
                            finally { setReconciling(false); }
                        }} disabled={reconciling}>
                            {reconciling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}
                            Run Reconciliation
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {reconReport ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-success/10 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-success">{reconReport.summary.matchedCount}</p>
                                    <p className="text-xs text-muted-foreground">Matched</p>
                                </div>
                                <div className="bg-destructive/10 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-destructive">{reconReport.summary.unmatchedCount}</p>
                                    <p className="text-xs text-muted-foreground">Unmatched</p>
                                </div>
                                <div className="bg-warning/10 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-warning">{reconReport.summary.disputedCount}</p>
                                    <p className="text-xs text-muted-foreground">Disputed</p>
                                </div>
                                <div className="bg-primary/10 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-primary">{reconReport.summary.reconciliationRate}%</p>
                                    <p className="text-xs text-muted-foreground">Match Rate</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="flex justify-between p-2 bg-muted/30 rounded">
                                    <span className="text-muted-foreground">Online Revenue</span>
                                    <span className="font-medium">NPR {reconReport.summary.onlineAmount?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between p-2 bg-muted/30 rounded">
                                    <span className="text-muted-foreground">Offline Revenue</span>
                                    <span className="font-medium">NPR {reconReport.summary.offlineAmount?.toLocaleString()}</span>
                                </div>
                            </div>
                            {reconReport.disputed.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-warning" /> Disputed</p>
                                    {reconReport.disputed.map((d: any, i: number) => (
                                        <div key={i} className="text-xs bg-warning/5 border border-warning/20 rounded p-2">
                                            <span className="font-mono">{d.tx_id}</span>
                                            <span className="text-muted-foreground ml-2">— {d.disputeReason}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Run reconciliation to compare offline-synced with central ledger</p>
                    )}
                </CardContent>
            </Card>

            {/* Transaction Lookup by UPA ID */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Search className="h-4 w-4 text-primary" /> Transaction Lookup by UPA ID
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">Enter a UPA address to view transactions for a specific entity</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Search Bar */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="e.g. traffic@nepal.gov, revenue@lalitpur.gov.np ..."
                                value={upaLookupQuery}
                                onChange={(e) => setUpaLookupQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleUpaLookup(); }}
                                className="pl-9"
                            />
                        </div>
                        <Button onClick={handleUpaLookup} disabled={lookupLoading}>
                            {lookupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                            Search
                        </Button>
                    </div>

                    {/* Quick UPA ID suggestions */}
                    <div className="flex flex-wrap gap-1.5">
                        <span className="text-xs text-muted-foreground mr-1 self-center">Quick:</span>
                        {["traffic@nepal.gov", "revenue@lalitpur.gov.np", "fee@tribhuvan.edu.np", "license@dotm.gov.np", "ward5@kathmandu.gov.np"].map((upa) => (
                            <Button key={upa} variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => { setUpaLookupQuery(upa); }}>
                                {upa}
                            </Button>
                        ))}
                    </div>

                    {/* Results */}
                    {hasSearched && (
                        <>
                            {/* Lookup summary */}
                            {lookupResults.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold">{lookupStats.total}</p>
                                        <p className="text-[10px] text-muted-foreground">Transactions</p>
                                    </div>
                                    <div className="bg-success/5 border border-success/10 rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-success">{lookupStats.settled}</p>
                                        <p className="text-[10px] text-muted-foreground">Settled</p>
                                    </div>
                                    <div className="bg-warning/5 border border-warning/10 rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-warning">{lookupStats.pending}</p>
                                        <p className="text-[10px] text-muted-foreground">Pending</p>
                                    </div>
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-blue-700">{formatCurrency(lookupStats.totalAmount)}</p>
                                        <p className="text-[10px] text-muted-foreground">Revenue</p>
                                    </div>
                                </div>
                            )}

                            {/* Status filter */}
                            {lookupResults.length > 0 && (
                                <div className="flex gap-1.5">
                                    {(["all", "settled", "pending", "failed"] as const).map((f) => (
                                        <Button key={f} variant={lookupFilter === f ? "default" : "outline"} size="sm" onClick={() => setLookupFilter(f)}>
                                            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                                        </Button>
                                    ))}
                                </div>
                            )}

                            {lookupLoading ? (
                                <div className="text-center py-10 text-muted-foreground"><Activity className="h-6 w-6 animate-spin mx-auto mb-2" /> Searching...</div>
                            ) : filteredLookupResults.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground">
                                    <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No transactions found for &quot;{upaLookupQuery}&quot;</p>
                                    <p className="text-xs mt-1">Try a different UPA ID or check the address</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredLookupResults.map((tx) => (
                                        <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className="font-medium text-sm">{tx.intent}</p>
                                                    {tx.status === "settled" ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                                                        : tx.status === "pending" || tx.status === "queued" ? <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
                                                            : <XCircle className="h-3.5 w-3.5 text-danger shrink-0" />}
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tx.status === "settled" ? "bg-success/10 text-success" : tx.status === "pending" || tx.status === "queued" ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"}`}>{tx.status}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate">{tx.recipientName || tx.recipient}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-muted-foreground">{formatDate(new Date(tx.timestamp))}</span>
                                                    <span className="text-xs text-muted-foreground font-mono">{tx.id.slice(0, 10)}...</span>
                                                    {tx.mode === "offline" ? (
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full"><WifiOff className="h-2.5 w-2.5" /> Offline</span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full"><Wifi className="h-2.5 w-2.5" /> Online</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-2 sm:mt-0 sm:text-right ml-3">
                                                <p className="font-bold text-sm">{formatCurrency(tx.amount)}</p>
                                                {tx.walletProvider && <p className="text-xs text-muted-foreground">{tx.walletProvider}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Initial state - no search yet */}
                    {!hasSearched && (
                        <div className="text-center py-10 text-muted-foreground">
                            <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
                            <p className="text-sm font-medium">Enter a UPA ID to look up transactions</p>
                            <p className="text-xs mt-1">Search by entity UPA address to view their payment history</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

