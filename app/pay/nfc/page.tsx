"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Smartphone,
    Zap,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Shield,
    Building2,
    Users,
    ArrowLeft,
    Fingerprint,
    AlertTriangle,
    Landmark,
    WifiOff,
    Wifi,
    CloudOff,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { useWallet } from "@/contexts/wallet-context";
import { useNetwork } from "@/hooks/use-network";
import { RouteGuard } from "@/components/route-guard";
import { saveTransaction as saveLocalTransaction } from "@/lib/storage";
import { queueTransaction } from "@/lib/db";
import { createSignalChannel } from "@/lib/nfc-signal";
import { CitizenOfflinePay } from "@/components/cross-device-offline";

type NFCStatus =
    | "checking"
    | "ready"
    | "scanning"
    | "found"
    | "confirming"
    | "processing"
    | "success"
    | "error";

type TxMode = "c2b" | "c2c" | "c2g" | "xdevice";

interface DetectedDevice {
    id: string;
    name: string;
    type: "merchant" | "citizen" | "government";
    upa?: string;
    amount?: number;
    lastSeen: number;
}

// Pre-defined government entities for C2G demo
const GOV_ENTITIES = [
    { id: "gov-traffic", name: "Nepal Traffic Police", upa: "traffic@nepal.gov", category: "fine" },
    { id: "gov-revenue", name: "Inland Revenue Dept", upa: "revenue@ird.gov.np", category: "tax" },
    { id: "gov-metro", name: "Kathmandu Metropolitan", upa: "revenue@kathmandu.gov.np", category: "tax" },
    { id: "gov-transport", name: "Dept of Transport Mgmt", upa: "license@dotm.gov.np", category: "fee" },
];

export default function NFCPayPageWrapper() {
    return (
        <RouteGuard allowedRoles={["citizen"]}>
            <NFCPayPage />
        </RouteGuard>
    );
}

function NFCPayPage() {
    const router = useRouter();
    const { wallet, balance, nid, user, addTransaction, updateBalance, creditUser, offlineWallet, saralPayBalance, canSpendOffline, spendFromSaralPay } = useWallet();
    const { online } = useNetwork();
    const channelRef = useRef<{ send: (msg: any) => void; close: () => void } | null>(null);

    const [nfcStatus, setNfcStatus] = useState<NFCStatus>("checking");
    const nfcStatusRef = useRef<NFCStatus>("checking");
    const [hasNativeNFC, setHasNativeNFC] = useState(false);
    const [nearbyDevices, setNearbyDevices] = useState<DetectedDevice[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<DetectedDevice | null>(null);
    const [payAmount, setPayAmount] = useState("");
    const [txMode, setTxMode] = useState<TxMode>("c2b");
    const [lastTxId, setLastTxId] = useState<string | null>(null);
    const [lastTxType, setLastTxType] = useState<string>("");

    const myId = useRef(`nfc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`);
    const myName = user?.name || nid?.fullName || "Citizen";
    const myUPA = nid?.linkedUPA || user?.upa_id || "";

    // Keep ref in sync
    useEffect(() => { nfcStatusRef.current = nfcStatus; }, [nfcStatus]);

    // ─── Check NFC Support ─────────────────────────────────────
    useEffect(() => {
        if (typeof window === "undefined") return;
        if ("NDEFReader" in window) setHasNativeNFC(true);
        setNfcStatus("ready");
    }, []);

    // ─── Signal Channel (BroadcastChannel + Supabase Realtime) ──
    useEffect(() => {
        if (typeof window === "undefined") return;

        const signal = createSignalChannel((data) => {
            if (!data?.type) return;

            switch (data.type) {
                case "business_presence": {
                    setNearbyDevices((prev) => {
                        const device: DetectedDevice = {
                            id: data.businessId,
                            name: data.businessName,
                            type: "merchant",
                            upa: data.upa,
                            lastSeen: data.timestamp,
                        };
                        const idx = prev.findIndex((d) => d.id === data.businessId);
                        if (idx >= 0) { const copy = [...prev]; copy[idx] = device; return copy; }
                        return [...prev, device];
                    });
                    const s = nfcStatusRef.current;
                    if (s === "scanning" || s === "found") {
                        setNfcStatus("found");
                    }
                    break;
                }

                case "customer_presence": {
                    if (data.customerId === myId.current) return;
                    setNearbyDevices((prev) => {
                        const device: DetectedDevice = {
                            id: data.customerId,
                            name: data.customerName,
                            type: "citizen",
                            upa: data.upa,
                            lastSeen: data.timestamp,
                        };
                        const idx = prev.findIndex((d) => d.id === data.customerId);
                        if (idx >= 0) { const copy = [...prev]; copy[idx] = device; return copy; }
                        return [...prev, device];
                    });
                    const s = nfcStatusRef.current;
                    if (s === "scanning" || s === "found") {
                        setNfcStatus("found");
                    }
                    break;
                }

                case "payment_request": {
                    if (data.targetCustomer === myId.current) {
                        setSelectedDevice({
                            id: data.businessId,
                            name: data.paymentData.businessName,
                            type: "merchant",
                            upa: data.paymentData.upa,
                            amount: data.paymentData.amount,
                            lastSeen: Date.now(),
                        });
                        setNfcStatus("confirming");
                        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                        toast(`Payment request: ${formatCurrency(data.paymentData.amount)} from ${data.paymentData.businessName}`);
                    }
                    break;
                }

                case "b2c_payment_received": {
                    if (data.targetCitizen === myId.current || data.targetUPA === myUPA) {
                        handleIncomingB2C(data);
                    }
                    break;
                }

                case "c2c_payment_complete": {
                    if (data.toCitizenId === myId.current || data.toUPA === myUPA) {
                        handleIncomingC2C(data);
                    }
                    break;
                }
            }
        });
        channelRef.current = signal;

        // Broadcast presence
        const interval = setInterval(() => {
            signal.send({
                type: "customer_presence",
                customerId: myId.current,
                customerName: myName,
                upa: myUPA,
                walletBalance: balance,
                timestamp: Date.now(),
            });
        }, 2000);

        return () => {
            clearInterval(interval);
            signal.close();
            channelRef.current = null;
        };
    }, [myName, balance, myUPA]);

    // Cleanup stale detections
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setNearbyDevices((prev) => prev.filter((d) => now - d.lastSeen < 10000));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // ─── Incoming handlers ──────────────────────────────────────
    const handleIncomingB2C = (data: any) => {
        const txId = `UPA-B2C-R-${String(Date.now()).slice(-6)}`;
        const txRecord = {
            id: txId, tx_id: txId, tx_type: "b2c" as any,
            recipient: myUPA || myName, recipientName: myName,
            fromUPA: data.businessUPA, amount: data.amount,
            intent: `Received from ${data.businessName}`,
            intentCategory: "transfer",
            metadata: { businessName: data.businessName, paymentType: "b2c", mode: "nfc", direction: "incoming" },
            status: "settled" as const, mode: "nfc" as const,
            nonce: `b2c-r-${Date.now()}`, timestamp: Date.now(), settledAt: Date.now(),
            walletProvider: "upa_pay", payment_source: "wallet" as const,
        };
        addTransaction(txRecord);
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        toast.success(`Received ${formatCurrency(data.amount)} from ${data.businessName} [B2C]`);
    };

    const handleIncomingC2C = (data: any) => {
        const txId = `UPA-C2C-R-${String(Date.now()).slice(-6)}`;
        const txRecord = {
            id: txId, tx_id: txId, tx_type: "c2c" as any,
            recipient: myUPA || myName, recipientName: myName,
            fromUPA: data.fromUPA, amount: data.amount,
            intent: `Received from ${data.fromCitizenName}`,
            intentCategory: "transfer",
            metadata: { senderName: data.fromCitizenName, paymentType: "c2c", mode: "nfc", direction: "incoming" },
            status: "settled" as const, mode: "nfc" as const,
            nonce: `c2c-r-${Date.now()}`, timestamp: Date.now(), settledAt: Date.now(),
            walletProvider: "upa_pay", payment_source: "wallet" as const,
        };
        addTransaction(txRecord);
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        toast.success(`Received ${formatCurrency(data.amount)} from ${data.fromCitizenName} [C2C]`);
    };

    // ─── Start/Stop NFC Scan ────────────────────────────────────
    const startNFCScan = async () => {
        setNfcStatus("scanning");

        // For C2G: inject gov entities immediately
        if (txMode === "c2g") {
            setTimeout(() => {
                setNearbyDevices((prev) => {
                    const govDevices: DetectedDevice[] = GOV_ENTITIES.map((g) => ({
                        id: g.id, name: g.name, type: "government" as const, upa: g.upa, lastSeen: Date.now(),
                    }));
                    return [...prev.filter((d) => d.type !== "government"), ...govDevices];
                });
                setNfcStatus("found");
            }, 800);
        }

        if (hasNativeNFC && "NDEFReader" in window) {
            try {
                const NDEFReaderClass = (window as any).NDEFReader;
                const reader = new NDEFReaderClass();
                await reader.scan();
                toast.success("NFC scanning active — hold near a terminal");
                reader.addEventListener("reading", ({ serialNumber, message }: any) => {
                    let tagData: any = {};
                    for (const record of message.records) {
                        if (record.recordType === "text") {
                            const td = new TextDecoder();
                            try { tagData = JSON.parse(td.decode(record.data)); } catch { tagData = { upa: td.decode(record.data) }; }
                        }
                    }
                    setSelectedDevice({
                        id: serialNumber || `nfc-${Date.now()}`, name: tagData.merchantName || tagData.upa || "NFC Terminal",
                        type: "merchant", upa: tagData.upa, amount: tagData.amount, lastSeen: Date.now(),
                    });
                    setNfcStatus("confirming");
                    if (navigator.vibrate) navigator.vibrate([200]);
                });
            } catch (err: any) {
                if (err.name !== "AbortError") toast.error(`NFC Error: ${err.message}`);
                setNfcStatus("ready");
            }
        } else {
            toast("Scanning for nearby devices...");
        }
    };

    const stopNFCScan = () => {
        setNfcStatus("ready");
        setNearbyDevices([]);
    };

    const selectForPayment = (device: DetectedDevice, amt?: number) => {
        const amount = amt || Number(payAmount);
        if (!amount || amount <= 0) { toast.error("Enter a valid amount first"); return; }
        if (amount > balance) { toast.error("Insufficient balance"); return; }
        setSelectedDevice({ ...device, amount });
        setNfcStatus("confirming");
    };

    // ─── Approve Payment ────────────────────────────────────────
    const approvePayment = async () => {
        if (!selectedDevice) return;
        const amount = selectedDevice.amount || Number(payAmount);
        if (!amount || amount <= 0) { toast.error("Invalid amount"); return; }
        if (amount > balance) { toast.error("Insufficient balance"); return; }

        // ── Offline guard: check SaralPay wallet balance ──
        if (!online) {
            if (!offlineWallet.loaded) {
                toast.error("SaralPay wallet not loaded! Go to Settings to load funds for offline payments.");
                return;
            }
            if (!canSpendOffline(amount)) {
                toast.error(`Insufficient SaralPay balance! Remaining: ${formatCurrency(saralPayBalance)}`);
                return;
            }
        }

        setNfcStatus("processing");

        // Simulate biometric
        await new Promise((r) => setTimeout(r, 1200));

        // Determine tx type
        let txType: string, intentLabel: string, intentCategory: string, intentId: string;
        if (selectedDevice.type === "government") {
            txType = "c2g";
            intentLabel = `Govt Payment — ${selectedDevice.name}`;
            intentCategory = GOV_ENTITIES.find((g) => g.id === selectedDevice.id)?.category || "fee";
            intentId = "nfc_gov_payment";
        } else if (selectedDevice.type === "merchant") {
            txType = "merchant_purchase";
            intentLabel = `NFC Payment — ${selectedDevice.name}`;
            intentCategory = "purchase";
            intentId = "nfc_purchase";
        } else {
            txType = "c2c";
            intentLabel = `NFC Transfer — ${selectedDevice.name}`;
            intentCategory = "transfer";
            intentId = "nfc_transfer";
        }

        const isOffline = !online;
        const txId = `UPA-${txType.toUpperCase().replace("MERCHANT_PURCHASE", "C2B")}-${String(Date.now()).slice(-6)}`;
        const nonce = `nfc-${txType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const txRecord = {
            id: txId, tx_id: txId, tx_type: txType as any,
            recipient: selectedDevice.upa || selectedDevice.name,
            recipientName: selectedDevice.name, fromUPA: myUPA, amount,
            intent: intentLabel, intentCategory,
            metadata: {
                payerName: myName, payerUPA: myUPA,
                paymentType: txType, deviceType: selectedDevice.type, mode: "nfc",
                nfcNative: hasNativeNFC ? "true" : "false",
                offlineQueued: isOffline ? "true" : "false",
            },
            status: (isOffline ? "queued" : "settled") as "queued" | "settled",
            mode: (isOffline ? "offline" : "nfc") as "offline" | "nfc",
            nonce, timestamp: Date.now(),
            settledAt: isOffline ? undefined : Date.now(),
            walletProvider: "upa_pay", payment_source: "wallet" as const,
        };

        // 1) Save locally
        saveLocalTransaction(txRecord);

        // 2) Deduct from wallet
        updateBalance(amount);

        // 3) If offline, deduct from SaralPay wallet & queue to IndexedDB for later sync
        if (isOffline) {
            spendFromSaralPay(amount);
            try {
                await queueTransaction({
                    payload: JSON.stringify({
                        version: "1.0", upa: selectedDevice.upa || selectedDevice.name,
                        intent: { id: intentId, category: intentCategory, label: intentLabel },
                        tx_type: txType, amount, currency: "NPR", metadata: txRecord.metadata,
                        payer_name: myName, payer_id: myUPA || myId.current,
                        issuedAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + 3600000).toISOString(),
                        nonce, type: "offline",
                    }),
                    signature: "offline-nfc-" + txId,
                    publicKey: wallet?.publicKey || "",
                    timestamp: Date.now(),
                    nonce,
                    recipient: selectedDevice.upa || selectedDevice.name,
                    amount,
                    intent: intentLabel,
                    metadata: txRecord.metadata,
                });
            } catch { /* queue best-effort */ }

            // Request background sync when connectivity returns
            if ("serviceWorker" in navigator && "SyncManager" in window) {
                try {
                    const reg = await navigator.serviceWorker.ready;
                    await (reg as any).sync.register("sync-transactions");
                } catch { /* ignore */ }
            }
        }

        // 4) Signal channel notifications (BroadcastChannel works offline for same-device!)
        if (channelRef.current) {
            if (selectedDevice.type === "merchant") {
                channelRef.current.send({
                    type: "payment_approval",
                    customerId: myId.current, customerName: myName, customerUPA: myUPA,
                    businessId: selectedDevice.id, amount, txId, txType,
                    isOffline,
                });
            } else if (selectedDevice.type === "citizen") {
                channelRef.current.send({
                    type: "c2c_payment_complete",
                    fromCitizenId: myId.current, fromCitizenName: myName, fromUPA: myUPA,
                    toCitizenId: selectedDevice.id, toUPA: selectedDevice.upa,
                    amount, txId, isOffline,
                });
                if (selectedDevice.upa) creditUser(selectedDevice.upa, amount, txRecord);
            }
        }

        // 5) Persist via API — only when online (best-effort)
        if (!isOffline) {
            try {
                if (txType === "c2c") {
                    await fetch("/api/transactions/c2c", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ fromUPA: myUPA, toUPA: selectedDevice.upa, amount, intent: intentLabel, message: `NFC ${txType}`, payerName: myName, nonce }),
                    });
                } else {
                    await fetch("/api/transactions/settle", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            payload: {
                                version: "1.0", upa: selectedDevice.upa || selectedDevice.name,
                                intent: { id: intentId, category: intentCategory, label: intentLabel },
                                tx_type: txType, amount, currency: "NPR", metadata: txRecord.metadata,
                                payer_name: myName, payer_id: myUPA || myId.current,
                                issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
                                nonce, type: "online",
                            },
                        }),
                    });
                }
            } catch { /* best-effort */ }
        }

        // 6) Add to wallet context
        addTransaction(txRecord);

        setLastTxId(txId);
        setLastTxType(txType);
        setNfcStatus("success");
        if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);

        if (isOffline) {
            toast.success(`${formatCurrency(amount)} queued for ${selectedDevice.name} [${txType.toUpperCase()}] — will sync when online`);
        } else {
            toast.success(`${formatCurrency(amount)} sent to ${selectedDevice.name} [${txType.toUpperCase()}]`);
        }
    };

    const declinePayment = () => {
        if (selectedDevice && channelRef.current) {
            channelRef.current.send({ type: "payment_decline", customerId: myId.current, businessId: selectedDevice.id });
        }
        setSelectedDevice(null);
        setNfcStatus("ready");
        toast("Payment declined");
    };

    const resetState = () => {
        stopNFCScan();
        setSelectedDevice(null);
        setPayAmount("");
        setLastTxId(null);
        setLastTxType("");
    };

    // ─── Filter lists ───────────────────────────────────────────
    const merchants = nearbyDevices.filter((d) => d.type === "merchant");
    const citizens = nearbyDevices.filter((d) => d.type === "citizen");
    const govEntities = nearbyDevices.filter((d) => d.type === "government");

    const modeLabel: Record<TxMode, string> = { c2b: "Pay Merchant", c2c: "Send to Person", c2g: "Pay Government", xdevice: "Cross-Device Offline" };

    const txTypeLabel = (t: string) => {
        switch (t) {
            case "c2c": return "C2C — Citizen → Citizen";
            case "c2g": return "C2G — Citizen → Government";
            case "merchant_purchase": return "C2B — Citizen → Business";
            case "b2c": return "B2C — Business → Citizen";
            default: return t.toUpperCase();
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-4 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold">NFC Tap & Pay</h1>
                    <p className="text-xs text-muted-foreground">
                        {hasNativeNFC ? "Native NFC" : "Cross-Device Signal"}
                        {!online && " • Offline Mode"}
                    </p>
                </div>
                <div className="flex items-center gap-1.5">
                    <Badge variant={online ? "default" : "outline"} className={`text-[10px] ${!online ? "border-amber-400 text-amber-700 bg-amber-50" : ""}`}>
                        {online ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                        {online ? "Online" : "Offline"}
                    </Badge>
                    <Badge variant={hasNativeNFC ? "default" : "secondary"} className="text-[10px]">
                        {hasNativeNFC ? "NFC" : "BC"}
                    </Badge>
                </div>
            </div>

            {/* Offline Banner — SaralPay Wallet */}
            {!online && (
                <Card className={`${offlineWallet.loaded ? "border-amber-300 bg-amber-50" : "border-red-300 bg-red-50"}`}>
                    <CardContent className="p-3 flex items-start gap-3">
                        <WifiOff className={`h-5 w-5 mt-0.5 shrink-0 ${offlineWallet.loaded ? "text-amber-600" : "text-red-600"}`} />
                        <div className="flex-1">
                            <p className={`text-sm font-medium ${offlineWallet.loaded ? "text-amber-800" : "text-red-800"}`}>
                                {offlineWallet.loaded ? "SaralPay Offline Wallet" : "SaralPay Not Loaded"}
                            </p>
                            {offlineWallet.loaded ? (
                                <>
                                    <p className="text-xs text-amber-700 mt-1">
                                        Payments will be deducted from your SaralPay wallet and queued for sync.
                                    </p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 font-bold">
                                            <CloudOff className="h-3 w-3 mr-1" />
                                            SaralPay Balance: {formatCurrency(saralPayBalance)}
                                        </Badge>
                                    </div>
                                </>
                            ) : (
                                <p className="text-xs text-red-700 mt-1">
                                    Load your SaralPay wallet before going offline. Go to Settings → SaralPay to load funds.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}


            {/* Balance — shows SaralPay when offline */}
            {!online && offlineWallet.loaded ? (
                <Card className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs text-white/70">SaralPay Offline Wallet</p>
                                <p className="text-2xl font-bold">{formatCurrency(saralPayBalance)}</p>
                                <p className="text-[10px] text-white/50 mt-1">{myUPA || "No UPA linked"}</p>
                            </div>
                            <div className="p-3 bg-white/10 rounded-2xl"><WifiOff className="h-6 w-6" /></div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs text-white/70">Available Balance</p>
                                <p className="text-2xl font-bold">{formatCurrency(balance)}</p>
                                <p className="text-[10px] text-white/50 mt-1">{myUPA || "No UPA linked"}</p>
                            </div>
                            <div className="p-3 bg-white/10 rounded-2xl"><Smartphone className="h-6 w-6" /></div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Mode Selector */}
            <div className="flex gap-2">
                {(["c2b", "c2c", "c2g"] as TxMode[]).map((mode) => (
                    <Button
                        key={mode}
                        variant={txMode === mode ? "default" : "outline"}
                        size="sm" className="flex-1"
                        onClick={() => { setTxMode(mode); resetState(); }}
                    >
                        {mode === "c2b" && <Building2 className="h-4 w-4 mr-1" />}
                        {mode === "c2c" && <Users className="h-4 w-4 mr-1" />}
                        {mode === "c2g" && <Landmark className="h-4 w-4 mr-1" />}
                        <span className="text-xs">{mode === "c2b" ? "Merchant" : mode === "c2c" ? "Person" : "Govt"}</span>
                    </Button>
                ))}
                <Button
                    variant={txMode === "xdevice" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setTxMode("xdevice"); resetState(); }}
                    className={`flex-1 ${txMode === "xdevice" ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                >
                    <Smartphone className="h-4 w-4 mr-1" />
                    <span className="text-xs">X-Device</span>
                </Button>
            </div>

            {/* Cross-Device Offline Mode */}
            {txMode === "xdevice" ? (
                <CitizenOfflinePay />
            ) : (
            <>
            {/* Amount input */}
            {!["confirming", "processing", "success"].includes(nfcStatus) && (
                <Card>
                    <CardContent className="p-3">
                        <label className="text-xs text-muted-foreground mb-1 block">Amount (NPR) — {modeLabel[txMode]}</label>
                        <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Enter amount" />
                    </CardContent>
                </Card>
            )}

            {/* ─── NFC Action Area ─── */}
            <Card className={`transition-all duration-500 ${
                nfcStatus === "scanning" || nfcStatus === "found" ? "border-blue-400 bg-blue-50/50"
                : nfcStatus === "confirming" ? "border-amber-400 bg-amber-50/50"
                : nfcStatus === "processing" ? "border-purple-400 bg-purple-50/50"
                : nfcStatus === "success" ? "border-green-400 bg-green-50/50"
                : nfcStatus === "error" ? "border-red-400 bg-red-50/50"
                : "border-dashed"
            }`}>
                <CardContent className="p-6 text-center">
                    {/* Ready */}
                    {nfcStatus === "ready" && (
                        <>
                            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-4">
                                {txMode === "c2g" ? <Landmark className="h-12 w-12 text-purple-600" />
                                    : txMode === "c2c" ? <Users className="h-12 w-12 text-purple-600" />
                                    : <Smartphone className="h-12 w-12 text-purple-600" />}
                            </div>
                            <h3 className="text-lg font-semibold mb-1">{modeLabel[txMode]}</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                {txMode === "c2b" ? "Open /merchant/nfc on another device or tab"
                                    : txMode === "c2c" ? "Another citizen opens /pay/nfc on their phone"
                                    : "Scan to see government payment entities"}
                            </p>
                            <Button onClick={startNFCScan} className="bg-purple-600 hover:bg-purple-700">
                                <Smartphone className="h-4 w-4 mr-2" />
                                Start Scanning
                            </Button>
                        </>
                    )}

                    {/* Scanning, no devices */}
                    {nfcStatus === "scanning" && nearbyDevices.length === 0 && (
                        <>
                            <div className="mx-auto w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-4 relative">
                                <Smartphone className="h-12 w-12 text-blue-600" />
                                <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-30" />
                                <span className="absolute inset-[-8px] rounded-full border border-blue-300 animate-ping opacity-20" style={{ animationDelay: "0.5s" }} />
                            </div>
                            <h3 className="text-lg font-semibold text-blue-700 mb-1">Scanning...</h3>
                            <p className="text-sm text-blue-600 mb-4">
                                {txMode === "c2b" ? "Open /merchant/nfc on another device"
                                    : txMode === "c2c" ? "Other citizen opens /pay/nfc on their device"
                                    : "Loading government entities..."}
                            </p>
                            <Button variant="outline" size="sm" onClick={stopNFCScan}>Cancel</Button>
                        </>
                    )}

                    {/* Found devices */}
                    {(nfcStatus === "scanning" || nfcStatus === "found") && nearbyDevices.length > 0 && (
                        <>
                            <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                <Zap className="h-10 w-10 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-blue-700 mb-3">
                                {txMode === "c2b" ? "Merchants Found" : txMode === "c2c" ? "People Nearby" : "Government Entities"}
                            </h3>
                            <div className="space-y-2 text-left">
                                {txMode === "c2b" && merchants.map((d) => (
                                    <div key={d.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-blue-600" />
                                            <div>
                                                <span className="text-sm font-medium">{d.name}</span>
                                                {d.upa && <p className="text-[10px] text-muted-foreground">{d.upa}</p>}
                                            </div>
                                        </div>
                                        {payAmount && Number(payAmount) > 0 ? (
                                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs" onClick={() => selectForPayment(d)}>
                                                Pay {formatCurrency(Number(payAmount))}
                                            </Button>
                                        ) : <Badge variant="outline" className="text-[10px]">Enter amount</Badge>}
                                    </div>
                                ))}

                                {txMode === "c2c" && citizens.map((d) => (
                                    <div key={d.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-green-600" />
                                            <div>
                                                <span className="text-sm font-medium">{d.name}</span>
                                                {d.upa && <p className="text-[10px] text-muted-foreground">{d.upa}</p>}
                                            </div>
                                        </div>
                                        {payAmount && Number(payAmount) > 0 ? (
                                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" onClick={() => selectForPayment(d)}>
                                                Send {formatCurrency(Number(payAmount))}
                                            </Button>
                                        ) : <Badge variant="outline" className="text-[10px]">Enter amount</Badge>}
                                    </div>
                                ))}

                                {txMode === "c2g" && govEntities.map((d) => (
                                    <div key={d.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                                        <div className="flex items-center gap-2">
                                            <Landmark className="h-4 w-4 text-red-600" />
                                            <div>
                                                <span className="text-sm font-medium">{d.name}</span>
                                                {d.upa && <p className="text-[10px] text-muted-foreground">{d.upa}</p>}
                                            </div>
                                        </div>
                                        {payAmount && Number(payAmount) > 0 ? (
                                            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-xs" onClick={() => selectForPayment(d)}>
                                                Pay {formatCurrency(Number(payAmount))}
                                            </Button>
                                        ) : <Badge variant="outline" className="text-[10px]">Enter amount</Badge>}
                                    </div>
                                ))}
                            </div>
                            <Button variant="outline" size="sm" className="mt-4" onClick={stopNFCScan}>Cancel</Button>
                        </>
                    )}

                    {/* Confirm */}
                    {nfcStatus === "confirming" && selectedDevice && (
                        <>
                            <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                                <Fingerprint className="h-10 w-10 text-amber-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-amber-800 mb-1">Confirm Payment</h3>
                            <div className="bg-white rounded-xl border p-4 my-4 text-left space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">To:</span>
                                    <span className="font-medium">{selectedDevice.name}</span>
                                </div>
                                {selectedDevice.upa && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">UPA:</span>
                                        <span className="text-xs font-mono">{selectedDevice.upa}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Amount:</span>
                                    <span className="font-bold text-lg">{formatCurrency(selectedDevice.amount || 0)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Type:</span>
                                    <Badge variant="secondary" className="text-[10px]">
                                        {selectedDevice.type === "merchant" ? "C2B" : selectedDevice.type === "government" ? "C2G" : "C2C"}
                                    </Badge>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Balance after:</span>
                                    <span>{formatCurrency(balance - (selectedDevice.amount || 0))}</span>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={declinePayment}>Decline</Button>
                                <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={approvePayment}>
                                    <Fingerprint className="h-4 w-4 mr-2" /> Approve
                                </Button>
                            </div>
                        </>
                    )}

                    {/* Processing */}
                    {nfcStatus === "processing" && (
                        <>
                            <div className="mx-auto w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                                <RefreshCw className="h-12 w-12 text-purple-600 animate-spin" />
                            </div>
                            <h3 className="text-lg font-semibold text-purple-700 mb-1">Processing...</h3>
                            <p className="text-sm text-purple-600">Authenticating & settling payment</p>
                        </>
                    )}

                    {/* Success */}
                    {nfcStatus === "success" && (
                        <>
                            <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-4 ${!online ? "bg-amber-100" : "bg-green-100"}`}>
                                {!online ? (
                                    <CloudOff className="h-14 w-14 text-amber-600" />
                                ) : (
                                    <CheckCircle2 className="h-14 w-14 text-green-600" />
                                )}
                            </div>
                            <h3 className={`text-lg font-semibold mb-1 ${!online ? "text-amber-700" : "text-green-700"}`}>
                                {!online ? "Payment Queued!" : "Payment Successful!"}
                            </h3>
                            <p className={`text-sm mb-1 ${!online ? "text-amber-600" : "text-green-600"}`}>
                                {formatCurrency(selectedDevice?.amount || 0)} {!online ? "queued for" : "sent to"} {selectedDevice?.name}
                            </p>
                            {!online && (
                                <p className="text-xs text-amber-500 mb-2">
                                    Will auto-settle when you&apos;re back online
                                </p>
                            )}
                            {lastTxId && (
                                <div className="my-3 bg-white rounded-lg border p-3 text-left space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">TX ID:</span>
                                        <span className="font-mono">{lastTxId}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Type:</span>
                                        <Badge variant="outline" className="text-[10px]">{txTypeLabel(lastTxType)}</Badge>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Status:</span>
                                        {!online ? (
                                            <Badge className="bg-amber-100 text-amber-700 text-[10px]">Queued (Offline)</Badge>
                                        ) : (
                                            <Badge className="bg-green-100 text-green-700 text-[10px]">Settled</Badge>
                                        )}
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Mode:</span>
                                        <span>{!online ? "NFC (Offline)" : "NFC"}</span>
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-3 justify-center">
                                <Button variant="outline" size="sm" onClick={resetState}>New Payment</Button>
                                <Button size="sm" onClick={() => router.push("/pay")}>Home</Button>
                            </div>
                        </>
                    )}

                    {/* Error */}
                    {nfcStatus === "error" && (
                        <>
                            <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <XCircle className="h-10 w-10 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-red-700 mb-1">Payment Failed</h3>
                            <p className="text-sm text-red-600 mb-4">Something went wrong.</p>
                            <Button variant="outline" onClick={resetState}>Try Again</Button>
                        </>
                    )}
                </CardContent>
            </Card>

            </>
            )}

            {/* Instructions */}
            <Card className="border-dashed">
                <CardContent className="p-4">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" /> NFC Demo Guide
                    </h4>
                    <div className="text-xs text-muted-foreground space-y-1.5">
                        <p><strong>C2B</strong> — Open <code>/merchant/nfc</code> in Tab 2 → Merchant charges you</p>
                        <p><strong>C2C</strong> — Open <code>/pay/nfc</code> in Tab 2 (different user) → Send money</p>
                        <p><strong>C2G</strong> — Select Govt mode → Scan → Pick entity → Pay</p>
                        <p><strong>B2C</strong> — Merchant refunds you from their terminal</p>
                        <p><strong>B2G</strong> — Merchant pays govt from their terminal</p>
                        <p><strong>X-Device</strong> — Two-phone Ed25519 QR handshake — fully offline, cross-device!</p>
                        <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                            <p className="text-amber-800 font-medium flex items-center gap-1">
                                <WifiOff className="h-3 w-3" /> SaralPay Offline Wallet
                            </p>
                            <p className="text-amber-700 mt-1">
                                Load your SaralPay wallet before going offline. Payments deduct from your SaralPay balance
                                and auto-sync when reconnected. Works via BroadcastChannel (same-device tabs).
                            </p>
                        </div>
                        <p className="mt-2 text-primary font-medium">All transactions logged with proper tx_type in wallet & API.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
