"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { QRCodeDisplay, uploadQRToStorage } from "@/components/qr-code";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Transaction } from "@/types";
import { RouteGuard } from "@/components/route-guard";
import { useWallet } from "@/contexts/wallet-context";
import { MerchantRegistration } from "@/components/merchant-registration";
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
    Store,
    CreditCard,
    PieChart,
    Receipt,
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { UPA, StaticQRPayload } from "@/types";

export default function MerchantPageWrapper() {
    return (
        <RouteGuard allowedRoles={["citizen", "merchant"]}>
            <MerchantPage />
        </RouteGuard>
    );
}

function MerchantPage() {
    const { role, merchantProfile } = useWallet();
    const [registered, setRegistered] = useState(false);

    // Citizens need to register first; dedicated merchant accounts skip registration
    const needsRegistration = role === "citizen" && !merchantProfile && !registered;

    if (needsRegistration) {
        return <MerchantRegistration onRegistered={() => setRegistered(true)} />;
    }

    return <MerchantDashboard />;
}

function MerchantDashboard() {
    const [upas, setUpas] = useState<UPA[]>([]);
    const [selectedUpa, setSelectedUpa] = useState<UPA | null>(null);
    const [selectedIntentCode, setSelectedIntentCode] = useState<string>("");
    const [qrData, setQrData] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "qr">("overview");
    const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const selectedIntent = selectedUpa?.intents.find((i) => i.intent_code === selectedIntentCode) || null;

    // Filter UPAs to show only merchants/institutions
    const merchantUpas = upas.filter((u) => u.entity_type === "merchant" || u.entity_type === "institution");

    useEffect(() => {
        fetch("/api/upas")
            .then((r) => r.json())
            .then((res) => {
                setUpas(res.data || []);
                const merchants = (res.data || []).filter((u: UPA) => u.entity_type === "merchant" || u.entity_type === "institution");
                if (merchants[0]) {
                    setSelectedUpa(merchants[0]);
                    if (merchants[0].intents?.[0]) setSelectedIntentCode(merchants[0].intents[0].intent_code);
                } else if (res.data?.[0]) {
                    setSelectedUpa(res.data[0]);
                    if (res.data[0].intents?.[0]) setSelectedIntentCode(res.data[0].intents[0].intent_code);
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
    }, []);

    useEffect(() => {
        const load = async () => { setLoading(true); await loadTransactions(); setLoading(false); };
        load();
        const interval = setInterval(loadTransactions, 5000);
        return () => clearInterval(interval);
    }, [loadTransactions]);

    const handleUpaSelect = (address: string) => {
        const upa = upas.find((u) => u.address === address);
        if (upa) { setSelectedUpa(upa); setSelectedIntentCode(upa.intents?.[0]?.intent_code || ""); setQrData(null); }
    };

    const handleGenerateQR = () => {
        if (!selectedUpa || !selectedIntent) { toast.error("Select entity and payment type"); return; }
        const payload: StaticQRPayload = {
            version: "1.0", upa: selectedUpa.address, entity_name: selectedUpa.entity_name,
            intent: { id: selectedIntent.intent_code, category: selectedIntent.category, label: selectedIntent.label },
            amount_type: selectedIntent.amount_type, currency: "NPR", metadata_schema: selectedIntent.metadata_schema || {},
        };
        if (selectedIntent.amount_type === "fixed") payload.amount = selectedIntent.fixed_amount!;
        else if (selectedIntent.amount_type === "range") { payload.min_amount = selectedIntent.min_amount!; payload.max_amount = selectedIntent.max_amount!; }
        setQrData(JSON.stringify(payload));
        setQrImageUrl(null);
        toast.success("QR Code Generated");
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

    const handleCopyQR = async () => { if (qrData) { await navigator.clipboard.writeText(qrData); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success("Copied!"); } };
    const handleDownloadQR = () => {
        const canvas = document.querySelector("#merchant-qr canvas") as HTMLCanvasElement;
        if (canvas) { const link = document.createElement("a"); link.download = `Merchant-QR-${selectedUpa?.address}.png`; link.href = canvas.toDataURL("image/png"); link.click(); }
    };

    // Merchant-specific stats
    const merchantTx = selectedUpa ? transactions.filter((tx) => tx.recipient === selectedUpa.address || tx.recipientName === selectedUpa.entity_name) : transactions;
    const stats = {
        totalRevenue: merchantTx.filter((t) => t.status === "settled").reduce((s, t) => s + t.amount, 0),
        totalPayments: merchantTx.length,
        settled: merchantTx.filter((t) => t.status === "settled").length,
        pending: merchantTx.filter((t) => t.status === "queued" || t.status === "pending").length,
        todayRevenue: merchantTx.filter((t) => {
            const d = new Date(t.timestamp); const now = new Date();
            return t.status === "settled" && d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((s, t) => s + t.amount, 0),
    };

    const intentBreakdown = merchantTx.reduce((acc, tx) => {
        const intent = tx.intent || "Other";
        if (!acc[intent]) acc[intent] = { count: 0, amount: 0 };
        acc[intent].count++; acc[intent].amount += tx.amount;
        return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    // Tax calculation (Nepal VAT 13%)
    const VAT_RATE = 0.13;
    const grossRevenue = stats.totalRevenue;
    const vatAmount = Math.round(grossRevenue * VAT_RATE / (1 + VAT_RATE));
    const netRevenue = grossRevenue - vatAmount;

    const [expandedTx, setExpandedTx] = useState<string | null>(null);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold flex items-center gap-2">
                        <Store className="h-6 w-6 text-primary" /> Merchant Dashboard
                    </h2>
                    <p className="text-sm text-muted-foreground">{selectedUpa?.entity_name || "Business Payment Management"}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setLoading(true); loadTransactions().finally(() => setLoading(false)); }} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {/* Revenue Cards */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <Card className="border-l-4 border-l-primary">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
                        <p className="text-xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-success">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Today</p>
                        <p className="text-xl font-bold text-success">{formatCurrency(stats.todayRevenue)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Payments</p>
                        <p className="text-xl font-bold">{stats.totalPayments}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Pending</p>
                        <p className="text-xl font-bold text-warning">{stats.pending}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-2">
                <Button variant={activeTab === "overview" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("overview")}>
                    <CreditCard className="h-4 w-4 mr-1.5" /> Sales & Payments
                </Button>
                <Button variant={activeTab === "qr" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("qr")}>
                    <QrCode className="h-4 w-4 mr-1.5" /> Payment QR
                </Button>
            </div>

            {activeTab === "overview" ? (
                <div className="space-y-6">
                    {/* Revenue by Service */}
                    {Object.keys(intentBreakdown).length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <PieChart className="h-4 w-4 text-primary" /> Revenue by Service
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="space-y-3">
                                    {Object.entries(intentBreakdown).sort((a, b) => b[1].amount - a[1].amount).map(([intent, data]) => {
                                        const pct = stats.totalRevenue > 0 ? Math.round((data.amount / stats.totalRevenue) * 100) : 0;
                                        return (
                                            <div key={intent}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-medium">{intent}</span>
                                                    <span className="text-sm font-bold">{formatCurrency(data.amount)}</span>
                                                </div>
                                                <div className="w-full bg-muted rounded-full h-2">
                                                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                </div>
                                                <div className="flex justify-between mt-1">
                                                    <span className="text-xs text-muted-foreground">{data.count} payments</span>
                                                    <span className="text-xs text-muted-foreground">{pct}%</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Tax Summary */}
                    <Card className="bg-amber-50/50 border-amber-100">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-amber-600" /> Tax Summary (VAT 13%)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Gross Revenue</span>
                                <span className="font-medium">{formatCurrency(grossRevenue)}</span>
                            </div>
                            <div className="flex justify-between text-red-600">
                                <span>VAT (13%)</span>
                                <span className="font-medium">- {formatCurrency(vatAmount)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t font-bold">
                                <span>Net Revenue</span>
                                <span>{formatCurrency(netRevenue)}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground pt-1">Auto-calculated. IRD-ready report.</p>
                        </CardContent>
                    </Card>

                    {/* Recent Payments */}
                    <Card>
                        <CardHeader className="pb-3"><CardTitle className="text-base">Recent Payments Received</CardTitle></CardHeader>
                        <CardContent className="pt-0">
                            {merchantTx.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Store className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No payments received yet</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {merchantTx.slice(0, 10).map((tx) => {
                                        const txVat = Math.round(tx.amount * VAT_RATE / (1 + VAT_RATE));
                                        const txNet = tx.amount - txVat;
                                        const isExpanded = expandedTx === tx.id;
                                        return (
                                            <div key={tx.id} className="border rounded-lg overflow-hidden">
                                                <div
                                                    className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                                                    onClick={() => setExpandedTx(isExpanded ? null : tx.id)}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <p className="font-medium text-sm">{tx.metadata?.payerName || "Customer"}</p>
                                                            {tx.status === "settled" ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                                                                : <Clock className="h-3.5 w-3.5 text-warning shrink-0" />}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">{tx.intent} &middot; {formatDate(new Date(tx.timestamp))}</p>
                                                    </div>
                                                    <div className="text-right ml-3">
                                                        <p className="font-semibold text-sm text-success">+{formatCurrency(tx.amount)}</p>
                                                        <p className="text-xs text-muted-foreground capitalize">{tx.status}</p>
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div className="border-t bg-muted/20 p-3 space-y-1.5 text-xs">
                                                        <p className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Itemized Receipt</p>
                                                        <div className="flex justify-between">
                                                            <span>Service: {tx.intent || "Payment"}</span>
                                                            <span>{formatCurrency(txNet)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-muted-foreground">
                                                            <span>VAT (13%)</span>
                                                            <span>{formatCurrency(txVat)}</span>
                                                        </div>
                                                        <div className="flex justify-between font-bold border-t pt-1">
                                                            <span>Total</span>
                                                            <span>{formatCurrency(tx.amount)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-muted-foreground pt-1">
                                                            <span>TX: <span className="font-mono">{(tx.tx_id || tx.id).slice(0, 14)}...</span></span>
                                                            <span>{tx.mode === "offline" ? <><WifiOff className="h-3 w-3 inline" /> Offline</> : <><Wifi className="h-3 w-3 inline" /> Online</>}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            ) : (
                /* QR Tab */
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Generate Payment QR</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Your Business</Label>
                                <Select value={selectedUpa?.address || ""} onValueChange={handleUpaSelect}>
                                    <SelectTrigger><SelectValue placeholder="Select business" /></SelectTrigger>
                                    <SelectContent>
                                        {(merchantUpas.length > 0 ? merchantUpas : upas).map((upa) => (
                                            <SelectItem key={upa.address} value={upa.address}>{upa.entity_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Service / Fee Type</Label>
                                <Select value={selectedIntentCode} onValueChange={(c) => { setSelectedIntentCode(c); setQrData(null); }}>
                                    <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                                    <SelectContent>
                                        {(selectedUpa?.intents || []).map((i) => (
                                            <SelectItem key={i.intent_code} value={i.intent_code}>{i.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {selectedIntent && (
                                <div className="rounded-lg border bg-muted/30 p-3">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Price</p>
                                    {selectedIntent.amount_type === "fixed" ? (
                                        <p className="text-lg font-semibold">NPR {selectedIntent.fixed_amount?.toLocaleString()}</p>
                                    ) : selectedIntent.amount_type === "range" ? (
                                        <p className="text-lg font-semibold">NPR {selectedIntent.min_amount?.toLocaleString()} – {selectedIntent.max_amount?.toLocaleString()}</p>
                                    ) : (
                                        <p className="text-lg font-semibold text-muted-foreground">Customer enters amount</p>
                                    )}
                                </div>
                            )}
                            <Button className="w-full" onClick={handleGenerateQR}>
                                <QrCode className="h-4 w-4 mr-2" /> Generate QR
                            </Button>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-base">Your Payment QR</CardTitle></CardHeader>
                        <CardContent>
                            {qrData ? (
                                <div className="space-y-4">
                                    <div id="merchant-qr" className="flex flex-col items-center p-6 bg-white rounded-lg border">
                                        <QRCodeDisplay value={qrData} size={240} onRendered={handleQRRendered} />
                                        <div className="mt-4 text-center">
                                            <p className="font-semibold text-foreground">{selectedUpa?.entity_name}</p>
                                            <p className="text-sm text-muted-foreground">{selectedIntent?.label}</p>
                                            <p className="text-xs text-muted-foreground mt-2 font-mono">{selectedUpa?.address}</p>
                                        </div>
                                    </div>
                                    {uploading && !qrImageUrl && <p className="text-xs text-muted-foreground text-center">Saving to cloud...</p>}
                                    {qrImageUrl && (
                                        <div className="text-center space-y-1">
                                            <p className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Stored in cloud</p>
                                            <a href={qrImageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline break-all">Open QR Image</a>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1" size="sm" onClick={handleDownloadQR}><Download className="h-4 w-4 mr-1.5" /> Download</Button>
                                        <Button variant="outline" className="flex-1" size="sm" onClick={handleCopyQR}>{copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}{copied ? "Copied!" : "Copy"}</Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-56 text-muted-foreground gap-2">
                                    <QrCode className="h-12 w-12 opacity-20" />
                                    <p className="text-sm">Select a service to generate QR</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
