"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Smartphone,
    Wifi,
    WifiOff,
    Zap,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Shield,
    CreditCard,
    Building2,
    Users,
    ArrowLeft,
    Fingerprint,
    AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { useWallet } from "@/contexts/wallet-context";
import { RouteGuard } from "@/components/route-guard";
import { saveTransaction as saveLocalTransaction } from "@/lib/storage";

type NFCStatus = "checking" | "unsupported" | "ready" | "scanning" | "found" | "confirming" | "processing" | "success" | "error";

interface DetectedDevice {
    id: string;
    name: string;
    type: "merchant" | "citizen";
    upa?: string;
    amount?: number;
    lastSeen: number;
}

export default function NFCPayPageWrapper() {
    return (
        <RouteGuard allowedRoles={["citizen"]}>
            <NFCPayPage />
        </RouteGuard>
    );
}

function NFCPayPage() {
    const router = useRouter();
    const { wallet, balance, nid, user, addTransaction } = useWallet();
    const channelRef = useRef<BroadcastChannel | null>(null);
    const nfcReaderRef = useRef<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const [nfcStatus, setNfcStatus] = useState<NFCStatus>("checking");
    const [hasNativeNFC, setHasNativeNFC] = useState(false);
    const [nearbyDevices, setNearbyDevices] = useState<DetectedDevice[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<DetectedDevice | null>(null);
    const [payAmount, setPayAmount] = useState("");
    const [paymentMode, setPaymentMode] = useState<"pay_merchant" | "send_citizen">("pay_merchant");
    const [lastTxId, setLastTxId] = useState<string | null>(null);

    const myId = useRef(`nfc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`);
    const myName = user?.name || nid?.fullName || "Citizen";
    const myUPA = nid?.linkedUPA || user?.upa_id || "";

    // ─── Check NFC Support ─────────────────────────────────────
    useEffect(() => {
        if (typeof window === "undefined") return;

        const checkNFC = async () => {
            // Check for Web NFC API (Chrome on Android 89+)
            if ("NDEFReader" in window) {
                setHasNativeNFC(true);
                setNfcStatus("ready");
                return;
            }

            // Fallback: check if device might have NFC via media queries / user agent
            const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
            if (isMobile) {
                // Mobile without Web NFC API — use BroadcastChannel fallback
                setHasNativeNFC(false);
                setNfcStatus("ready");
            } else {
                // Desktop — use BroadcastChannel simulation
                setHasNativeNFC(false);
                setNfcStatus("ready");
            }
        };

        checkNFC();
    }, []);

    // ─── BroadcastChannel for cross-tab/device discovery ───────
    useEffect(() => {
        if (typeof window === "undefined") return;

        channelRef.current = new BroadcastChannel("citizen-nfc-channel");

        channelRef.current.onmessage = (event) => {
            handleChannelMessage(event.data);
        };

        // Broadcast our presence
        const interval = setInterval(() => {
            channelRef.current?.postMessage({
                type: "customer_presence",
                customerId: myId.current,
                customerName: myName,
                walletBalance: balance,
                paymentMode,
                hasWallet: true,
                timestamp: Date.now(),
            });
        }, 2000);

        return () => {
            clearInterval(interval);
            channelRef.current?.close();
        };
    }, [myName, balance, paymentMode]);

    // Cleanup old detections
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setNearbyDevices((prev) => prev.filter((d) => now - d.lastSeen < 10000));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleChannelMessage = useCallback((data: any) => {
        switch (data.type) {
            case "business_presence":
                setNearbyDevices((prev) => {
                    const existing = prev.find((d) => d.id === data.businessId);
                    const device: DetectedDevice = {
                        id: data.businessId,
                        name: data.businessName,
                        type: "merchant",
                        lastSeen: data.timestamp,
                    };
                    if (existing) return prev.map((d) => (d.id === data.businessId ? device : d));
                    return [...prev, device];
                });
                if (nfcStatus === "ready" || nfcStatus === "scanning") setNfcStatus("found");
                break;

            case "customer_presence":
                if (data.customerId === myId.current) return;
                if (paymentMode === "send_citizen") {
                    setNearbyDevices((prev) => {
                        const existing = prev.find((d) => d.id === data.customerId);
                        const device: DetectedDevice = {
                            id: data.customerId,
                            name: data.customerName,
                            type: "citizen",
                            lastSeen: data.timestamp,
                        };
                        if (existing) return prev.map((d) => (d.id === data.customerId ? device : d));
                        return [...prev, device];
                    });
                    if (nfcStatus === "ready" || nfcStatus === "scanning") setNfcStatus("found");
                }
                break;

            case "payment_request":
                // Incoming payment request from merchant
                if (data.targetCustomer === myId.current) {
                    setSelectedDevice({
                        id: data.businessId,
                        name: data.paymentData.businessName,
                        type: "merchant",
                        amount: data.paymentData.amount,
                        lastSeen: Date.now(),
                    });
                    setNfcStatus("confirming");
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                    toast(`Payment request: ${formatCurrency(data.paymentData.amount)} from ${data.paymentData.businessName}`);
                }
                break;

            case "money_request":
                if (data.targetCitizen === myId.current) {
                    setSelectedDevice({
                        id: data.fromCitizenId,
                        name: data.fromCitizenName,
                        type: "citizen",
                        amount: data.amount,
                        lastSeen: Date.now(),
                    });
                    setNfcStatus("confirming");
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                    toast(`Money request: ${formatCurrency(data.amount)} from ${data.fromCitizenName}`);
                }
                break;
        }
    }, [nfcStatus, paymentMode]);

    // ─── Native NFC Read ────────────────────────────────────────
    const startNFCScan = async () => {
        setNfcStatus("scanning");

        if (hasNativeNFC && "NDEFReader" in window) {
            try {
                abortControllerRef.current = new AbortController();
                const NDEFReaderClass = (window as any).NDEFReader;
                const reader = new NDEFReaderClass();
                nfcReaderRef.current = reader;

                await reader.scan({ signal: abortControllerRef.current.signal });
                toast.success("NFC scanning active — hold near a terminal");

                reader.addEventListener("reading", ({ serialNumber, message }: any) => {
                    // Parse NFC tag data (NDEF records)
                    let tagData: any = {};
                    for (const record of message.records) {
                        if (record.recordType === "text") {
                            const textDecoder = new TextDecoder();
                            const text = textDecoder.decode(record.data);
                            try {
                                tagData = JSON.parse(text);
                            } catch {
                                tagData = { upa: text, serialNumber };
                            }
                        } else if (record.recordType === "url") {
                            const textDecoder = new TextDecoder();
                            tagData.url = textDecoder.decode(record.data);
                        }
                    }

                    // Found an NFC tag — could be merchant terminal
                    setSelectedDevice({
                        id: serialNumber || `nfc-${Date.now()}`,
                        name: tagData.merchantName || tagData.upa || "NFC Terminal",
                        type: "merchant",
                        upa: tagData.upa,
                        amount: tagData.amount,
                        lastSeen: Date.now(),
                    });
                    setNfcStatus("confirming");
                    if (navigator.vibrate) navigator.vibrate([200]);
                    toast.success(`NFC Terminal detected: ${tagData.merchantName || tagData.upa || "Unknown"}`);
                });

                reader.addEventListener("readingerror", () => {
                    toast.error("NFC read failed — try holding closer");
                });
            } catch (err: any) {
                if (err.name === "AbortError") return;
                console.error("NFC Error:", err);
                toast.error(`NFC Error: ${err.message}`);
                setNfcStatus("ready");
            }
        } else {
            // BroadcastChannel mode — just show we're scanning
            toast("Scanning for nearby devices...");
        }
    };

    const stopNFCScan = () => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setNfcStatus("ready");
        setNearbyDevices([]);
    };

    // ─── Approve / Process Payment ──────────────────────────────
    const approvePayment = async () => {
        if (!selectedDevice) return;

        const amount = selectedDevice.amount || Number(payAmount);
        if (!amount || amount <= 0) {
            toast.error("Invalid amount");
            return;
        }
        if (amount > balance) {
            toast.error("Insufficient balance");
            return;
        }

        setNfcStatus("processing");

        // Simulate biometric auth delay
        await new Promise((r) => setTimeout(r, 1200));

        const txId = `UPA-NFC-${String(Date.now()).slice(-6)}`;
        const nonce = `nfc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const txRecord = {
            id: txId,
            tx_type: (selectedDevice.type === "merchant" ? "merchant_purchase" : "c2c") as "merchant_purchase" | "c2c",
            recipient: selectedDevice.upa || selectedDevice.name,
            recipientName: selectedDevice.name,
            fromUPA: myUPA,
            amount,
            intent: selectedDevice.type === "merchant" ? "NFC Payment" : "NFC Money Transfer",
            intentCategory: selectedDevice.type === "merchant" ? "merchant" : "transfer",
            metadata: {
                payerName: myName,
                paymentType: selectedDevice.type,
                mode: "nfc",
                nfcNative: hasNativeNFC ? "true" : "false",
            },
            status: "settled" as const,
            mode: "nfc" as const,
            nonce,
            timestamp: Date.now(),
            walletProvider: "upa_pay",
        };

        // Save locally
        saveLocalTransaction(txRecord);

        // Notify via BroadcastChannel
        if (channelRef.current) {
            if (selectedDevice.type === "merchant") {
                channelRef.current.postMessage({
                    type: "payment_approval",
                    customerId: myId.current,
                    businessId: selectedDevice.id,
                    amount,
                    customerName: myName,
                });
            } else {
                channelRef.current.postMessage({
                    type: "money_received",
                    fromCitizen: myId.current,
                    toCitizen: selectedDevice.id,
                    amount,
                    customerName: myName,
                });
            }
        }

        // Write via NFC if supported
        if (hasNativeNFC && "NDEFReader" in window) {
            try {
                const NDEFReaderClass = (window as any).NDEFReader;
                const writer = new NDEFReaderClass();
                await writer.write({
                    records: [
                        {
                            recordType: "text",
                            data: JSON.stringify({
                                txId,
                                amount,
                                payer: myUPA,
                                payerName: myName,
                                status: "settled",
                                timestamp: Date.now(),
                            }),
                        },
                    ],
                });
            } catch {
                // NFC write is optional — payment still goes through
            }
        }

        // Persist via API
        try {
            await fetch("/api/transactions/settle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    payload: {
                        version: "1.0",
                        upa: selectedDevice.upa || selectedDevice.name,
                        intent: {
                            id: selectedDevice.type === "merchant" ? "nfc_purchase" : "nfc_transfer",
                            category: selectedDevice.type === "merchant" ? "purchase" : "transfer",
                            label: txRecord.intent,
                        },
                        amount,
                        currency: "NPR",
                        metadata: txRecord.metadata,
                        payer_name: myName,
                        payer_id: myId.current,
                        issuedAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + 3600000).toISOString(),
                        nonce,
                        type: "online",
                    },
                }),
            });
        } catch {
            /* best-effort */
        }

        // Add to wallet context
        if (addTransaction) {
            addTransaction({
                ...txRecord,
                tx_id: txId,
                payment_source: "wallet",
            });
        }

        setLastTxId(txId);
        setNfcStatus("success");
        if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
        toast.success(`Payment of ${formatCurrency(amount)} sent to ${selectedDevice.name}`);
    };

    const declinePayment = () => {
        if (selectedDevice && channelRef.current) {
            channelRef.current.postMessage({
                type: "payment_decline",
                customerId: myId.current,
                businessId: selectedDevice.id,
            });
        }
        setSelectedDevice(null);
        setNfcStatus("ready");
        toast("Payment declined");
    };

    const resetState = () => {
        stopNFCScan();
        setSelectedDevice(null);
        setNearbyDevices([]);
        setNfcStatus("ready");
        setPayAmount("");
        setLastTxId(null);
    };

    // Send money to nearby citizen
    const sendToCitizen = (device: DetectedDevice) => {
        const amt = Number(payAmount);
        if (!amt || amt <= 0) {
            toast.error("Enter a valid amount");
            return;
        }
        if (amt > balance) {
            toast.error("Insufficient balance");
            return;
        }
        setSelectedDevice({ ...device, amount: amt });
        setNfcStatus("confirming");
    };

    // ─── Rendering ──────────────────────────────────────────────
    const merchants = nearbyDevices.filter((d) => d.type === "merchant");
    const citizens = nearbyDevices.filter((d) => d.type === "citizen");

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
                        {hasNativeNFC ? "Native NFC supported" : "Proximity pay mode"}
                    </p>
                </div>
                <Badge
                    variant={hasNativeNFC ? "default" : "secondary"}
                    className="text-[10px]"
                >
                    {hasNativeNFC ? "NFC Active" : "BroadcastChannel"}
                </Badge>
            </div>

            {/* NFC Support Banner */}
            {!hasNativeNFC && (
                <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-3 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-amber-800">Web NFC not available</p>
                            <p className="text-xs text-amber-700 mt-1">
                                Web NFC requires Chrome on Android. Currently using proximity pay mode via
                                BroadcastChannel for nearby device detection.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Balance Card */}
            <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0">
                <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-xs text-white/70">Available Balance</p>
                            <p className="text-2xl font-bold">{formatCurrency(balance)}</p>
                        </div>
                        <div className="p-3 bg-white/10 rounded-2xl">
                            <Smartphone className="h-6 w-6" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Mode Selector */}
            <div className="flex gap-2">
                <Button
                    variant={paymentMode === "pay_merchant" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                        setPaymentMode("pay_merchant");
                        resetState();
                    }}
                >
                    <Building2 className="h-4 w-4 mr-2" />
                    Pay Merchant
                </Button>
                <Button
                    variant={paymentMode === "send_citizen" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                        setPaymentMode("send_citizen");
                        resetState();
                    }}
                >
                    <Users className="h-4 w-4 mr-2" />
                    Send Money
                </Button>
            </div>

            {/* Amount input for send mode */}
            {paymentMode === "send_citizen" && nfcStatus !== "confirming" && nfcStatus !== "processing" && nfcStatus !== "success" && (
                <Card>
                    <CardContent className="p-3">
                        <label className="text-xs text-muted-foreground mb-1 block">Amount (NPR)</label>
                        <Input
                            type="number"
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder="Enter amount to send"
                        />
                    </CardContent>
                </Card>
            )}

            {/* ─── NFC Action Area ─── */}
            <Card
                className={`transition-all duration-500 ${
                    nfcStatus === "scanning" || nfcStatus === "found"
                        ? "border-blue-400 bg-blue-50/50"
                        : nfcStatus === "confirming"
                        ? "border-amber-400 bg-amber-50/50"
                        : nfcStatus === "processing"
                        ? "border-purple-400 bg-purple-50/50"
                        : nfcStatus === "success"
                        ? "border-green-400 bg-green-50/50"
                        : nfcStatus === "error"
                        ? "border-red-400 bg-red-50/50"
                        : "border-dashed"
                }`}
            >
                <CardContent className="p-6 text-center">
                    {/* Ready */}
                    {nfcStatus === "ready" && (
                        <>
                            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-4">
                                <Smartphone className="h-12 w-12 text-purple-600" />
                            </div>
                            <h3 className="text-lg font-semibold mb-1">
                                {paymentMode === "pay_merchant" ? "Ready to Pay" : "Ready to Send"}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                {hasNativeNFC
                                    ? "Tap your phone on a merchant's NFC terminal"
                                    : paymentMode === "pay_merchant"
                                    ? "Open merchant terminal nearby to detect"
                                    : "Nearby users will appear automatically"}
                            </p>
                            <Button onClick={startNFCScan} className="bg-purple-600 hover:bg-purple-700">
                                <Smartphone className="h-4 w-4 mr-2" />
                                {hasNativeNFC ? "Start NFC Scan" : "Start Scanning"}
                            </Button>
                        </>
                    )}

                    {/* Scanning */}
                    {nfcStatus === "scanning" && nearbyDevices.length === 0 && (
                        <>
                            <div className="mx-auto w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-4 relative">
                                <Smartphone className="h-12 w-12 text-blue-600" />
                                {/* Pulse rings */}
                                <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-30" />
                                <span className="absolute inset-[-8px] rounded-full border border-blue-300 animate-ping opacity-20" style={{ animationDelay: "0.5s" }} />
                            </div>
                            <h3 className="text-lg font-semibold text-blue-700 mb-1">Scanning...</h3>
                            <p className="text-sm text-blue-600 mb-4">
                                {hasNativeNFC ? "Hold phone near NFC terminal" : "Looking for nearby devices"}
                            </p>
                            <Button variant="outline" size="sm" onClick={stopNFCScan}>
                                Cancel
                            </Button>
                        </>
                    )}

                    {/* Found nearby devices */}
                    {(nfcStatus === "scanning" || nfcStatus === "found") && nearbyDevices.length > 0 && (
                        <>
                            <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                <Zap className="h-10 w-10 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-blue-700 mb-3">
                                {paymentMode === "pay_merchant" ? "Merchants Found" : "People Nearby"}
                            </h3>
                            <div className="space-y-2 text-left">
                                {paymentMode === "pay_merchant" &&
                                    merchants.map((d) => (
                                        <div key={d.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-blue-600" />
                                                <span className="text-sm font-medium">{d.name}</span>
                                            </div>
                                            <Badge variant="secondary" className="text-[10px]">
                                                Waiting for charge
                                            </Badge>
                                        </div>
                                    ))}
                                {paymentMode === "send_citizen" &&
                                    citizens.map((d) => (
                                        <div key={d.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-green-600" />
                                                <span className="text-sm font-medium">{d.name}</span>
                                            </div>
                                            {payAmount && Number(payAmount) > 0 ? (
                                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" onClick={() => sendToCitizen(d)}>
                                                    Send {formatCurrency(Number(payAmount))}
                                                </Button>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px]">
                                                    Enter amount above
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                            </div>
                            <Button variant="outline" size="sm" className="mt-4" onClick={stopNFCScan}>
                                Cancel
                            </Button>
                        </>
                    )}

                    {/* Confirm Payment */}
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
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Amount:</span>
                                    <span className="font-bold text-lg">{formatCurrency(selectedDevice.amount || 0)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Type:</span>
                                    <span>{selectedDevice.type === "merchant" ? "Merchant Payment" : "Money Transfer"}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Remaining:</span>
                                    <span>{formatCurrency(balance - (selectedDevice.amount || 0))}</span>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={declinePayment}>
                                    Decline
                                </Button>
                                <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={approvePayment}>
                                    <Fingerprint className="h-4 w-4 mr-2" />
                                    Approve
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
                            <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="h-14 w-14 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-green-700 mb-1">Payment Successful!</h3>
                            <p className="text-sm text-green-600 mb-1">
                                {formatCurrency(selectedDevice?.amount || 0)} sent to {selectedDevice?.name}
                            </p>
                            {lastTxId && (
                                <p className="text-xs text-muted-foreground mb-4">TX: {lastTxId}</p>
                            )}
                            <div className="flex gap-3 justify-center">
                                <Button variant="outline" size="sm" onClick={resetState}>
                                    New Payment
                                </Button>
                                <Button size="sm" onClick={() => router.push("/")}>
                                    Home
                                </Button>
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
                            <p className="text-sm text-red-600 mb-4">Something went wrong. Please try again.</p>
                            <Button variant="outline" onClick={resetState}>
                                Try Again
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="border-dashed">
                <CardContent className="p-4">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        How NFC Tap & Pay Works
                    </h4>
                    <div className="text-xs text-muted-foreground space-y-1.5">
                        {hasNativeNFC ? (
                            <>
                                <p>1. Tap &quot;Start NFC Scan&quot; to activate your NFC reader</p>
                                <p>2. Hold your phone near a merchant&apos;s NFC terminal</p>
                                <p>3. Confirm the amount and authenticate with biometrics</p>
                                <p>4. Payment is settled in under 2 seconds</p>
                            </>
                        ) : (
                            <>
                                <p>1. Tap &quot;Start Scanning&quot; to detect nearby devices</p>
                                <p>2. Open the merchant terminal on another tab or device</p>
                                <p>3. The merchant will send a payment request</p>
                                <p>4. Confirm and authenticate to complete the payment</p>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
