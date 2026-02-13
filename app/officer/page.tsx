"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { QRCodeDisplay, uploadQRToStorage } from "@/components/qr-code";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Transaction } from "@/types";
import { RouteGuard } from "@/components/route-guard";
import { signPayload, generateNonce, hexToKey, getPublicKeyHex } from "@/lib/crypto";
import { SecureKeyStore } from "@/lib/secure-storage";
import { useNetwork } from "@/hooks/use-network";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
    QrCode,
    Download,
    Copy,
    Check,
    RefreshCw,
    CheckCircle2,
    Clock,
    XCircle,
    Wifi,
    WifiOff,
    TrendingUp,
    Users,
    Lock,
    ShieldCheck,
    Loader2,
    Code2,
    ChevronDown,
    BarChart3,
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { UPA, StaticQRPayload } from "@/types";

export default function OfficerPageWrapper() {
    return (
        <RouteGuard allowedRoles={["officer"]}>
            <OfficerPage />
        </RouteGuard>
    );
}

function OfficerPage() {
    const { online } = useNetwork();
    const [upas, setUpas] = useState<UPA[]>([]);
    const [selectedUpa, setSelectedUpa] = useState<UPA | null>(null);
    const [selectedIntentCode, setSelectedIntentCode] = useState<string>("");
    const [qrData, setQrData] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"qr" | "collections">("qr");
    const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const [signing, setSigning] = useState(false);
    const [showUpaSelection, setShowUpaSelection] = useState(false);

    const selectedIntent = selectedUpa?.intents.find((i) => i.intent_code === selectedIntentCode) || null;

    // Load stored QR image from Supabase when entity+intent changes
    useEffect(() => {
        if (!selectedUpa || !selectedIntentCode) return;
        setQrImageUrl(null);
        fetch(`/api/qr/upload?upa=${encodeURIComponent(selectedUpa.address)}&intent=${encodeURIComponent(selectedIntentCode)}`)
            .then((r) => r.json())
            .then((res) => {
                if (res.exists && res.url) {
                    setQrImageUrl(res.url);
                }
            })
            .catch(() => { });
    }, [selectedUpa, selectedIntentCode]);

    useEffect(() => {
        fetch("/api/upas")
            .then((r) => r.json())
            .then((res) => {
                setUpas(res.data || []);

                // Check if officer has previously selected a UPA
                const storedUpaAddress = localStorage.getItem("upa_officer_selected_office");

                if (storedUpaAddress) {
                    const storedUpa = res.data?.find((u: UPA) => u.address === storedUpaAddress);
                    if (storedUpa) {
                        setSelectedUpa(storedUpa);
                        if (storedUpa.intents?.[0]) {
                            setSelectedIntentCode(storedUpa.intents[0].intent_code);
                        }
                        return;
                    }
                }

                // First time login - show selection dialog
                if (res.data && res.data.length > 0) {
                    setShowUpaSelection(true);
                }
            })
            .catch(console.error);
    }, []);

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
        } catch { /* ignore */ }
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

    const handleUpaSelect = (address: string, saveToStorage = false) => {
        const upa = upas.find((u) => u.address === address);
        if (upa) {
            setSelectedUpa(upa);
            setSelectedIntentCode(upa.intents?.[0]?.intent_code || "");
            setQrData(null);
            if (saveToStorage) {
                localStorage.setItem("upa_officer_selected_office", address);
            }
        }
    };

    const handleInitialUpaSelection = (address: string) => {
        handleUpaSelect(address, true);
        setShowUpaSelection(false);
        toast.success("Gov Office Selected", {
            description: `You are now managing ${upas.find(u => u.address === address)?.entity_name}`
        });
    };

    const handleGenerateQR = async () => {
        if (!selectedUpa || !selectedIntent) {
            toast.error("Missing Selection", { description: "Please select an entity and payment type" });
            return;
        }
        // Build compact payload — strip metadata_schema to keep QR small & scannable
        const payload: StaticQRPayload = {
            version: "1.0",
            upa: selectedUpa.address,
            entity_name: selectedUpa.entity_name,
            intent: { id: selectedIntent.intent_code, category: selectedIntent.category, label: selectedIntent.label },
            amount_type: selectedIntent.amount_type,
            currency: "NPR",
            metadata_schema: {},
        };
        if (selectedIntent.amount_type === "fixed") payload.amount = selectedIntent.fixed_amount!;
        else if (selectedIntent.amount_type === "range") {
            payload.min_amount = selectedIntent.min_amount!;
            payload.max_amount = selectedIntent.max_amount!;
        }

        if (isOfflineMode) {
            // Sign the payload with officer's Ed25519 private key
            setSigning(true);
            try {
                const privateKeyHex = await SecureKeyStore.get("upa_private_key");
                if (!privateKeyHex) {
                    toast.error("No signing key found", { description: "Please ensure your wallet is initialized" });
                    setSigning(false);
                    return;
                }
                const privateKey = hexToKey(privateKeyHex);
                const nonce = generateNonce();
                const now = new Date();
                const signablePayload = {
                    ...payload,
                    nonce,
                    issuedAt: now.toISOString(),
                    expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
                };
                const signature = signPayload(signablePayload, privateKey);
                const publicKey = getPublicKeyHex(privateKey);
                const signedPayload: StaticQRPayload = {
                    ...signablePayload,
                    signature,
                    publicKey,
                    signed: true,
                };
                setQrData(JSON.stringify(signedPayload));
                setQrImageUrl(null);
                toast.success("Signed Offline QR Generated", {
                    description: "Ed25519 cryptographic signature applied",
                });
            } catch (err: any) {
                toast.error("Signing failed", { description: err.message || "Could not sign payload" });
            } finally {
                setSigning(false);
            }
        } else {
            setQrData(JSON.stringify(payload));
            setQrImageUrl(null);
            toast.success("QR Code Generated");
        }
    };

    const handleQRRendered = async (dataUrl: string) => {
        if (!selectedUpa || !selectedIntent) return;
        setUploading(true);
        const url = await uploadQRToStorage(dataUrl, selectedUpa.address, selectedIntent.intent_code);
        if (url) {
            setQrImageUrl(url);
            toast.success("QR saved to cloud storage");
        }
        setUploading(false);
    };

    const handleCopyQR = async () => {
        if (qrData) {
            await navigator.clipboard.writeText(qrData);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success("Copied!");
        }
    };

    const handleDownloadQR = () => {
        const canvas = document.querySelector("#qr-canvas canvas") as HTMLCanvasElement;
        if (canvas) {
            const link = document.createElement("a");
            link.download = `UPA-QR-${selectedUpa?.address}-${selectedIntent?.intent_code}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            toast.success("Downloaded");
        }
    };

    // Stats for this officer's entity
    const entityTx = selectedUpa
        ? transactions.filter((tx) => tx.recipient === selectedUpa.address || tx.recipientName === selectedUpa.entity_name)
        : transactions;
    const stats = {
        total: entityTx.length,
        settled: entityTx.filter((t) => t.status === "settled").length,
        queued: entityTx.filter((t) => t.status === "queued" || t.status === "pending").length,
        totalCollected: entityTx.filter((t) => t.status === "settled").reduce((s, t) => s + t.amount, 0),
        todayCount: entityTx.filter((t) => {
            const d = new Date(t.timestamp);
            const now = new Date();
            return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length,
        onlineCount: entityTx.filter((t) => t.mode === "online").length,
        offlineCount: entityTx.filter((t) => t.mode === "offline").length,
    };

    // ─── Collections trend chart ───────────────────────────────────────
    const [chartTimeRange, setChartTimeRange] = useState("90d");

    const collectionChartConfig: ChartConfig = {
        settled: { label: "Settled", color: "var(--chart-2)" },
        pending: { label: "Pending", color: "var(--chart-3)" },
    };

    const collectionChartData = useMemo(() => {
        const byDate: Record<string, { settled: number; pending: number }> = {};
        entityTx.forEach((tx) => {
            const d = new Date(tx.timestamp);
            const key = d.toISOString().split("T")[0];
            if (!byDate[key]) byDate[key] = { settled: 0, pending: 0 };
            if (tx.status === "settled") byDate[key].settled += tx.amount;
            else byDate[key].pending += tx.amount;
        });
        return Object.entries(byDate)
            .map(([date, v]) => ({ date, ...v }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [entityTx]);

    const filteredCollectionChartData = useMemo(() => {
        if (collectionChartData.length === 0) return [];
        const refDate = new Date(collectionChartData[collectionChartData.length - 1].date);
        let days = 90;
        if (chartTimeRange === "30d") days = 30;
        else if (chartTimeRange === "7d") days = 7;
        const start = new Date(refDate);
        start.setDate(start.getDate() - days);
        return collectionChartData.filter((item) => new Date(item.date) >= start);
    }, [collectionChartData, chartTimeRange]);

    // ─── Collection Status Pie ──────────────────────────────────────────
    const statusPieData = useMemo(() => {
        const settledAmt = entityTx.filter(t => t.status === "settled").reduce((s, t) => s + t.amount, 0);
        const queuedAmt = entityTx.filter(t => t.status === "queued" || t.status === "pending").reduce((s, t) => s + t.amount, 0);
        const failedAmt = entityTx.filter(t => t.status === "failed").reduce((s, t) => s + t.amount, 0);
        return [
            { name: "settled", value: settledAmt, fill: "var(--color-settled)" },
            { name: "queued", value: queuedAmt, fill: "var(--color-queued)" },
            { name: "failed", value: failedAmt, fill: "var(--color-failed)" },
        ].filter(d => d.value > 0);
    }, [entityTx]);

    const statusPieConfig: ChartConfig = {
        value: { label: "Amount" },
        settled: { label: "Settled", color: "hsl(142, 71%, 45%)" },
        queued: { label: "Queued/Pending", color: "hsl(38, 92%, 50%)" },
        failed: { label: "Failed", color: "hsl(0, 84%, 60%)" },
    };

    // ─── Online vs Offline Bar ──────────────────────────────────────────
    const modeBarData = useMemo(() => {
        const getWeekKey = (d: Date) => { const s = new Date(d); s.setDate(s.getDate() - s.getDay()); return s.toISOString().split("T")[0]; };
        const byWeek: Record<string, { online: number; offline: number }> = {};
        entityTx.filter(t => t.status === "settled").forEach(tx => {
            const key = getWeekKey(new Date(tx.timestamp));
            if (!byWeek[key]) byWeek[key] = { online: 0, offline: 0 };
            if (tx.mode === "offline") byWeek[key].offline += tx.amount;
            else byWeek[key].online += tx.amount;
        });
        return Object.entries(byWeek)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-6)
            .map(([key, v]) => ({ week: new Date(key).toLocaleDateString("en-US", { month: "short", day: "numeric" }), ...v }));
    }, [entityTx]);

    const modeBarConfig: ChartConfig = {
        online: { label: "Online", color: "hsl(142, 71%, 45%)" },
        offline: { label: "Offline", color: "hsl(38, 92%, 50%)" },
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Initial UPA Selection Dialog */}
            <Dialog open={showUpaSelection} onOpenChange={setShowUpaSelection}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Select Your Government Office</DialogTitle>
                        <DialogDescription>
                            Choose which government office you are managing. This will be your default office.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 mt-4">
                        {upas.map((upa) => (
                            <button
                                key={upa.address}
                                onClick={() => handleInitialUpaSelection(upa.address)}
                                className="w-full text-left p-4 border rounded-lg hover:bg-muted transition-colors"
                            >
                                <p className="font-semibold">{upa.entity_name}</p>
                                <p className="text-sm text-muted-foreground">{upa.address}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {upa.entity_type} • {upa.intents?.length || 0} payment types
                                </p>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <div>
                <h2 className="text-2xl font-semibold">Gov Office Portal</h2>
                <p className="text-sm text-muted-foreground">
                    {selectedUpa?.entity_name || "Government Payment Collection"}
                </p>
            </div>

            {/* Stats Row */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Collected</p>
                        <p className="text-xl font-bold">{formatCurrency(stats.totalCollected)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Today</p>
                        <p className="text-xl font-bold">{stats.todayCount} <span className="text-sm font-normal text-muted-foreground">payments</span></p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Settled</p>
                        <p className="text-xl font-bold text-success">{stats.settled}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Queued</p>
                        <p className="text-xl font-bold text-warning">{stats.queued}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-2">
                <Button variant={activeTab === "qr" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("qr")}>
                    <QrCode className="h-4 w-4 mr-1.5" /> Generate QR
                </Button>
                <Button variant={activeTab === "collections" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("collections")}>
                    <TrendingUp className="h-4 w-4 mr-1.5" /> Collections
                </Button>
            </div>

            {activeTab === "qr" ? (
                <div className="grid gap-6 md:grid-cols-2">
                    {/* QR Form */}
                    <Card>
                        <CardHeader><CardTitle className="text-base">Create Payment QR</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Government Entity</Label>
                                <Select value={selectedUpa?.address || ""} onValueChange={handleUpaSelect}>
                                    <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
                                    <SelectContent>
                                        {upas.map((upa) => (
                                            <SelectItem key={upa.address} value={upa.address}>
                                                {upa.entity_name} ({upa.address})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Payment Type</Label>
                                <Select value={selectedIntentCode} onValueChange={(c) => { setSelectedIntentCode(c); setQrData(null); }}>
                                    <SelectTrigger><SelectValue placeholder="Select payment type" /></SelectTrigger>
                                    <SelectContent>
                                        {(selectedUpa?.intents || []).map((i) => (
                                            <SelectItem key={i.intent_code} value={i.intent_code}>{i.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {selectedIntent && (
                                <div className="rounded-lg border bg-muted/30 p-3">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</p>
                                    {selectedIntent.amount_type === "fixed" ? (
                                        <p className="text-lg font-semibold">NPR {selectedIntent.fixed_amount?.toLocaleString()}</p>
                                    ) : selectedIntent.amount_type === "range" ? (
                                        <p className="text-lg font-semibold">NPR {selectedIntent.min_amount?.toLocaleString()} – {selectedIntent.max_amount?.toLocaleString()}</p>
                                    ) : (
                                        <p className="text-lg font-semibold text-muted-foreground">Citizen enters amount</p>
                                    )}
                                </div>
                            )}
                            {selectedIntent?.metadata_schema && Object.keys(selectedIntent.metadata_schema).length > 0 && (
                                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Citizen fills in</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(selectedIntent.metadata_schema).map(([key, field]) => (
                                            <span key={key} className="text-xs bg-background border rounded-md px-2 py-1">{field.label}{field.required && " *"}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Offline Mode Toggle */}
                            <div className="rounded-lg border p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {isOfflineMode ? (
                                            <Lock className="h-4 w-4 text-warning" />
                                        ) : (
                                            <Wifi className="h-4 w-4 text-success" />
                                        )}
                                        <span className="text-sm font-medium">
                                            {isOfflineMode ? "Offline Mode — Signed QR" : "Online Mode — Standard QR"}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={isOfflineMode}
                                        onClick={() => setIsOfflineMode(!isOfflineMode)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isOfflineMode ? "bg-warning" : "bg-muted"
                                            }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOfflineMode ? "translate-x-6" : "translate-x-1"
                                            }`} />
                                    </button>
                                </div>
                                {isOfflineMode && (
                                    <p className="text-xs text-muted-foreground">
                                        QR will be cryptographically signed with Ed25519. Citizens can verify offline without any server.
                                    </p>
                                )}
                            </div>

                            <Button className="w-full" onClick={handleGenerateQR} disabled={signing}>
                                {signing ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : isOfflineMode ? (
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                ) : (
                                    <QrCode className="h-4 w-4 mr-2" />
                                )}
                                {signing ? "Signing..." : isOfflineMode ? "Generate Signed QR" : "Generate QR Code"}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* QR Display */}
                    <Card>
                        <CardHeader><CardTitle className="text-base">Payment QR Code</CardTitle></CardHeader>
                        <CardContent>
                            {qrData ? (
                                <div className="space-y-4">
                                    <div id="qr-canvas" className="flex flex-col items-center p-6 bg-white rounded-lg border">
                                        <QRCodeDisplay value={qrData} size={260} onRendered={handleQRRendered} />
                                        <div className="mt-4 text-center">
                                            {qrData && JSON.parse(qrData).signed && (
                                                <div className="inline-flex items-center gap-1.5 bg-warning/10 text-warning text-xs font-medium px-3 py-1 rounded-full mb-2">
                                                    <ShieldCheck className="h-3.5 w-3.5" />
                                                    Ed25519 Signed — Offline Ready
                                                </div>
                                            )}
                                            <p className="font-semibold text-foreground">{selectedUpa?.entity_name}</p>
                                            <p className="text-sm text-muted-foreground">{selectedIntent?.label}</p>
                                            {selectedIntent?.amount_type === "fixed" && (
                                                <p className="text-lg font-bold text-foreground mt-1">NPR {selectedIntent.fixed_amount?.toLocaleString()}</p>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-2 font-mono">{selectedUpa?.address}</p>
                                        </div>
                                    </div>
                                    {uploading && !qrImageUrl && <p className="text-xs text-muted-foreground text-center">Saving to cloud...</p>}
                                    {qrImageUrl && (
                                        <div className="text-center space-y-1">
                                            <p className="text-xs text-success flex items-center justify-center gap-1"><CheckCircle2 className="h-3 w-3" /> Stored in cloud</p>
                                            <a href={qrImageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline break-all">Open QR Image</a>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1" size="sm" onClick={handleDownloadQR}>
                                            <Download className="h-4 w-4 mr-1.5" /> Download
                                        </Button>
                                        <Button variant="outline" className="flex-1" size="sm" onClick={handleCopyQR}>
                                            {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                                            {copied ? "Copied!" : "Copy"}
                                        </Button>
                                    </div>

                                    {/* QR Payload Reveal — Demo Element #6 */}
                                    {(() => {
                                        let parsed: any = null;
                                        try { parsed = JSON.parse(qrData); } catch { }
                                        if (!parsed) return null;
                                        return (
                                            <div className="border rounded-lg overflow-hidden">
                                                <button
                                                    onClick={() => {
                                                        const el = document.getElementById('qr-payload-reveal');
                                                        if (el) el.classList.toggle('hidden');
                                                        const chevron = document.getElementById('qr-payload-chevron');
                                                        if (chevron) chevron.classList.toggle('rotate-180');
                                                    }}
                                                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Code2 className="h-4 w-4 text-primary" />
                                                        <span>View QR Payload</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            ({Object.keys(parsed).length} fields • {qrData.length} bytes)
                                                        </span>
                                                    </div>
                                                    <ChevronDown id="qr-payload-chevron" className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
                                                </button>
                                                <div id="qr-payload-reveal" className="hidden border-t">
                                                    <div className="p-3 bg-muted/30">
                                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                                            {parsed.signed && (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                                                                    <ShieldCheck className="h-3 w-3" /> Ed25519 Signed
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                                                                v{parsed.version || '1'}
                                                            </span>
                                                            <span className="text-[10px] font-medium bg-purple-500/10 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">
                                                                {parsed.intent?.id || 'unknown'}
                                                            </span>
                                                        </div>
                                                        <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto bg-background rounded-lg p-3 border max-h-72 overflow-y-auto">
                                                            {JSON.stringify(parsed, null, 2)}
                                                        </pre>
                                                        <div className="flex gap-2 mt-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-xs h-7"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
                                                                    toast.success('Payload JSON copied');
                                                                }}
                                                            >
                                                                <Copy className="h-3 w-3 mr-1" /> Copy JSON
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-xs h-7"
                                                                onClick={() => {
                                                                    const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
                                                                    const url = URL.createObjectURL(blob);
                                                                    const a = document.createElement('a');
                                                                    a.href = url; a.download = 'qr-payload.json'; a.click();
                                                                    URL.revokeObjectURL(url);
                                                                }}
                                                            >
                                                                <Download className="h-3 w-3 mr-1" /> Export
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : qrImageUrl ? (
                                <div className="space-y-4">
                                    <div className="flex flex-col items-center p-6 bg-white rounded-lg border">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={qrImageUrl} alt="Stored QR Code" className="w-[260px] h-[260px]" />
                                        <div className="mt-4 text-center">
                                            <p className="font-semibold text-foreground">{selectedUpa?.entity_name}</p>
                                            <p className="text-sm text-muted-foreground">{selectedIntent?.label}</p>
                                            {selectedIntent?.amount_type === "fixed" && (
                                                <p className="text-lg font-bold text-foreground mt-1">NPR {selectedIntent.fixed_amount?.toLocaleString()}</p>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-2 font-mono">{selectedUpa?.address}</p>
                                        </div>
                                    </div>
                                    <div className="text-center space-y-1">
                                        <p className="text-xs text-success flex items-center justify-center gap-1"><CheckCircle2 className="h-3 w-3" /> Previously stored in cloud</p>
                                        <a href={qrImageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline break-all">Open QR Image</a>
                                    </div>
                                    <p className="text-xs text-muted-foreground text-center">Click &quot;Generate&quot; to create a fresh QR</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                                    <QrCode className="h-12 w-12 opacity-20" />
                                    <p className="text-sm">Select entity & type to generate QR</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            ) : (
                /* Collections Tab */
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{entityTx.length} payments collected</p>
                        <Button variant="outline" size="sm" onClick={() => { setLoading(true); loadTransactions().finally(() => setLoading(false)); }} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
                        </Button>
                    </div>

                    {/* Collections Trend Chart */}
                    <Card className="pt-0">
                        <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
                            <div className="grid flex-1 gap-1">
                                <CardTitle className="text-base">Collection Trend</CardTitle>
                                <CardDescription>Daily settled vs pending collections</CardDescription>
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
                            {filteredCollectionChartData.length > 0 ? (
                                <ChartContainer config={collectionChartConfig} className="aspect-auto h-[220px] w-full">
                                    <AreaChart data={filteredCollectionChartData}>
                                        <defs>
                                            <linearGradient id="fillOfficerSettled" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--color-settled)" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="var(--color-settled)" stopOpacity={0.1} />
                                            </linearGradient>
                                            <linearGradient id="fillOfficerPending" x1="0" y1="0" x2="0" y2="1">
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
                                            tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
                                        <Area dataKey="pending" type="natural" fill="url(#fillOfficerPending)" stroke="var(--color-pending)" stackId="a" />
                                        <Area dataKey="settled" type="natural" fill="url(#fillOfficerSettled)" stroke="var(--color-settled)" stackId="a" />
                                        <ChartLegend content={<ChartLegendContent />} />
                                    </AreaChart>
                                </ChartContainer>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
                                    <BarChart3 className="h-10 w-10 opacity-20 mb-2" />
                                    <p className="text-sm">No collection data for chart</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ─── Pie + Bar Analytics Row ──────────────────────── */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-primary" />
                                    Collection Status
                                </CardTitle>
                                <CardDescription className="text-xs">Settled vs queued amounts</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {statusPieData.length > 0 ? (
                                    <ChartContainer config={statusPieConfig} className="mx-auto aspect-square max-h-[250px]">
                                        <RechartsPieChart>
                                            <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                                            <Pie data={statusPieData} dataKey="value" nameKey="name" innerRadius={55} strokeWidth={5} />
                                            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                                        </RechartsPieChart>
                                    </ChartContainer>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                                        <BarChart3 className="h-10 w-10 opacity-20 mb-2" />
                                        <p className="text-sm">No collection data</p>
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
                                <CardDescription className="text-xs">Weekly collection mode comparison</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {modeBarData.length > 0 ? (
                                    <ChartContainer config={modeBarConfig} className="aspect-auto h-[250px] w-full">
                                        <RechartsBarChart data={modeBarData}>
                                            <CartesianGrid vertical={false} />
                                            <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                                            <YAxis tickLine={false} axisLine={false} width={50} fontSize={11} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
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

                    <Card>
                        <CardContent className="pt-4">
                            {loading ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                                    <p className="text-sm">Loading...</p>
                                </div>
                            ) : entityTx.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No collections yet</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {entityTx.slice(0, 15).map((tx) => (
                                        <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className="font-medium text-sm">{tx.metadata?.payerName || tx.intent}</p>
                                                    {tx.status === "settled" ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                                                        : tx.status === "queued" || tx.status === "pending" ? <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
                                                            : <XCircle className="h-3.5 w-3.5 text-danger shrink-0" />}
                                                </div>
                                                <p className="text-xs text-muted-foreground">{tx.intent} &middot; {formatDate(new Date(tx.timestamp))}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {tx.mode === "offline" ? (
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full">
                                                            <WifiOff className="h-2.5 w-2.5" /> Offline
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full">
                                                            <Wifi className="h-2.5 w-2.5" /> Online
                                                        </span>
                                                    )}
                                                    {tx.metadata?.payerId && <span className="text-[10px] text-muted-foreground">ID: {tx.metadata.payerId}</span>}
                                                </div>
                                            </div>
                                            <p className="font-semibold text-sm ml-3">{formatCurrency(tx.amount)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

