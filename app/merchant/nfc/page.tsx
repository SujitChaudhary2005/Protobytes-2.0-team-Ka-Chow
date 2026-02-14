"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Building2,
    Zap,
    CheckCircle2,
    RefreshCw,
    Phone,
    Users,
    Shield,
    ArrowLeft,
    Smartphone,
    AlertTriangle,
    CreditCard,
    Landmark,
    Send,
    ArrowDownLeft,
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
import { executeACIDTransaction, executeMerchantACIDTransaction } from "@/lib/acid-transaction";
import { createSignalChannel } from "@/lib/nfc-signal";
import { MerchantOfflineCharge } from "@/components/cross-device-offline";
import { QRCodeDisplay } from "@/components/qr-code";
import { QrCode } from "lucide-react";
import { useMemo } from "react";

type TerminalStatus = "ready" | "detecting" | "processing" | "success";
type BizTxMode = "charge" | "b2c" | "b2g" | "xdevice";

interface CustomerDevice {
    id: string;
    name: string;
    upa?: string;
    isNearby: boolean;
    lastSeen: number;
}

// Government entities for B2G payments
const GOV_ENTITIES = [
    { id: "gov-ird", name: "Inland Revenue Dept", upa: "revenue@ird.gov.np", category: "tax" },
    { id: "gov-metro", name: "Kathmandu Metropolitan", upa: "revenue@kathmandu.gov.np", category: "tax" },
    { id: "gov-customs", name: "Dept of Customs", upa: "customs@nepal.gov", category: "fee" },
    { id: "gov-cro", name: "Company Registrar Office", upa: "cro@moics.gov.np", category: "fee" },
];

export default function MerchantNFCWrapper() {
    return (
        <RouteGuard allowedRoles={["citizen", "merchant"]}>
            <MerchantNFCTerminal />
        </RouteGuard>
    );
}

function MerchantNFCTerminal() {
    const router = useRouter();
    const { user, merchantProfile, addTransaction, updateBalance, balance, creditUser, offlineWallet, saralPayBalance, canSpendOffline, spendFromSaralPay } = useWallet();
    const { online } = useNetwork();
    const channelRef = useRef<{ send: (msg: any) => void; close: () => void } | null>(null);

    const [hasNativeNFC, setHasNativeNFC] = useState(false);
    const [businessName, setBusinessName] = useState(
        merchantProfile?.businessName || user?.name || "My Business"
    );
    const businessUPA = merchantProfile?.upaAddress || `${businessName.toLowerCase().replace(/\s+/g, "-")}@merchant.np`;
    const [businessId] = useState(() => `biz-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`);

    const [status, setStatus] = useState<TerminalStatus>("ready");
    const [nearbyCustomers, setNearbyCustomers] = useState<CustomerDevice[]>([]);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [dailyTotal, setDailyTotal] = useState(0);
    const [todaysTransactions, setTodaysTransactions] = useState(0);
    const [txMode, setTxMode] = useState<BizTxMode>("charge");
    const [lastTxId, setLastTxId] = useState<string | null>(null);
    const [lastTxType, setLastTxType] = useState<string>("");
    const [txLog, setTxLog] = useState<Array<{ id: string; type: string; amount: number; counterparty: string; time: number }>>([]);

    // Check NFC
    useEffect(() => {
        if (typeof window !== "undefined" && "NDEFReader" in window) setHasNativeNFC(true);
    }, []);

    // Load daily stats
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const stored = localStorage.getItem("upa_merchant_nfc_daily");
            if (stored) {
                const data = JSON.parse(stored);
                if (data.date === new Date().toDateString()) {
                    setDailyTotal(data.total);
                    setTodaysTransactions(data.count);
                }
            }
        } catch { /* ignore */ }
    }, []);

    const saveDailyStats = (total: number, count: number) => {
        try {
            localStorage.setItem("upa_merchant_nfc_daily", JSON.stringify({ date: new Date().toDateString(), total, count }));
        } catch { /* ignore */ }
    };

    // ─── Signal Channel (BroadcastChannel + Supabase Realtime) ─────
    useEffect(() => {
        if (typeof window === "undefined") return;

        const signal = createSignalChannel((data) => {
            if (!data?.type) return;

            switch (data.type) {
                case "customer_presence": {
                    setNearbyCustomers((prev) => {
                        const customer: CustomerDevice = {
                            id: data.customerId,
                            name: data.customerName,
                            upa: data.upa,
                            isNearby: true,
                            lastSeen: data.timestamp,
                        };
                        const idx = prev.findIndex((c) => c.id === data.customerId);
                        if (idx >= 0) { const copy = [...prev]; copy[idx] = customer; return copy; }
                        return [...prev, customer];
                    });
                    if (status === "ready") setStatus("detecting");
                    break;
                }

                case "payment_approval": {
                    if (data.businessId === businessId) {
                        handlePaymentSuccess(data);
                    }
                    break;
                }

                case "payment_decline": {
                    if (data.businessId === businessId) {
                        setStatus("ready");
                        toast.error("Payment declined by customer");
                    }
                    break;
                }
            }
        });
        channelRef.current = signal;

        return () => {
            signal.close();
            channelRef.current = null;
        };
    }, [businessId, status]);

    // Broadcast merchant presence
    useEffect(() => {
        const interval = setInterval(() => {
            channelRef.current?.send({
                type: "business_presence",
                businessId,
                businessName,
                upa: businessUPA,
                isAcceptingPayments: true,
                timestamp: Date.now(),
            });
        }, 2000);
        return () => clearInterval(interval);
    }, [businessId, businessName, businessUPA]);

    // Cleanup stale customers
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setNearbyCustomers((prev) => prev.filter((c) => now - c.lastSeen < 10000));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Auto-detect nearby customers when no real devices respond
    useEffect(() => {
        if (txMode !== "charge" && txMode !== "b2c") return;
        const timer = setTimeout(() => {
            setNearbyCustomers((prev) => {
                if (prev.length > 0) return prev;
                return [
                    { id: "ctz-ram", name: "Ram Bahadur Thapa", upa: "ram.thapa@upa.np", isNearby: true, lastSeen: Date.now() + 60000 },
                    { id: "ctz-anita", name: "Anita Gurung", upa: "anita.gurung@upa.np", isNearby: true, lastSeen: Date.now() + 60000 },
                ];
            });
            if (status === "ready") setStatus("detecting");
        }, 2000);
        return () => clearTimeout(timer);
    }, [txMode, status]);

    // ─── Charge customer (C2B from merchant side) ───────────
    const requestPayment = (customerId: string) => {
        const amount = Number(paymentAmount);
        if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }

        channelRef.current?.send({
            type: "payment_request",
            businessId,
            paymentData: { amount, businessName, upa: businessUPA, customerId, businessId, timestamp: Date.now() },
            targetCustomer: customerId,
        });

        setStatus("processing");
        toast("Payment request sent to customer...");

        // Auto-approve for simulated customers
        if (customerId.startsWith("ctz-")) {
            const customer = nearbyCustomers.find((c) => c.id === customerId);
            setTimeout(() => {
                handlePaymentSuccess({
                    amount,
                    customerName: customer?.name || "Customer",
                    customerUPA: customer?.upa || "",
                    businessId,
                    txType: "merchant_purchase",
                    isOffline: !online,
                });
            }, 1500);
        }
    };

    const handlePaymentSuccess = (data: any) => {
        setStatus("success");
        const amount = data.amount;
        const isOffline = !online || data.isOffline;
        const newTotal = dailyTotal + amount;
        const newCount = todaysTransactions + 1;
        setDailyTotal(newTotal);
        setTodaysTransactions(newCount);
        saveDailyStats(newTotal, newCount);

        const txId = data.txId || `UPA-BIZ-${String(Date.now()).slice(-6)}`;
        const nonce = `biz-nfc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const txType = data.txType || "merchant_purchase";

        const txRecord = {
            id: txId, tx_id: txId, tx_type: txType as any,
            recipient: businessName, recipientName: businessName,
            fromUPA: data.customerUPA || data.customerName || "Customer",
            amount: data.amount,
            intent: "NFC Payment Received",
            intentCategory: "purchase",
            metadata: {
                customerName: data.customerName || "Customer",
                customerUPA: data.customerUPA || "",
                businessId, paymentType: "nfc_business", mode: "nfc", direction: "incoming",
                offlineQueued: isOffline ? "true" : "false",
            },
            status: (isOffline ? "queued" : "settled") as "queued" | "settled",
            mode: (isOffline ? "offline" : "nfc") as "offline" | "nfc",
            nonce, timestamp: Date.now(),
            settledAt: isOffline ? undefined : Date.now(),
            walletProvider: "upa_pay", payment_source: "wallet" as const,
        };

        saveLocalTransaction(txRecord);
        addTransaction(txRecord);

        // Persist via API — only when online (best-effort)
        if (!isOffline) {
            fetch("/api/transactions/settle", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    payload: {
                        version: "1.0", upa: businessUPA,
                        intent: { id: "nfc_purchase", category: "purchase", label: "NFC Payment Received" },
                        tx_type: "merchant_purchase", amount, currency: "NPR",
                        metadata: txRecord.metadata,
                        payer_name: data.customerName || "Customer", payer_id: data.customerUPA || "unknown",
                        issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
                        nonce, type: "online",
                    },
                }),
            }).catch(() => { /* best-effort */ });
        } else {
            // ACID-guaranteed offline queueing
            const queuePayload = {
                payload: JSON.stringify({
                    version: "1.0", upa: businessUPA,
                    intent: { id: "nfc_purchase", category: "purchase", label: "NFC Payment Received" },
                    tx_type: "merchant_purchase", amount, currency: "NPR",
                    metadata: txRecord.metadata,
                    payer_name: data.customerName || "Customer", payer_id: data.customerUPA || "unknown",
                    issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
                    nonce, type: "offline",
                }),
                signature: "offline-nfc-merchant-" + txId,
                publicKey: "",
                timestamp: Date.now(),
                nonce,
                recipient: businessUPA,
                amount,
                intent: "NFC Payment Received",
                metadata: txRecord.metadata,
            };

            executeMerchantACIDTransaction(
                { transaction: txRecord, queuePayload },
                { addTransaction }
            ).then(result => {
                if (!result.success) {
                    console.error(`[ACID] Merchant NFC TX failed: ${result.error}`);
                }
            });
        }

        // Log
        setTxLog((prev) => [{ id: txId, type: isOffline ? "C2B (offline)" : "C2B (received)", amount, counterparty: data.customerName || "Customer", time: Date.now() }, ...prev]);
        setLastTxId(txId);
        setLastTxType(isOffline ? "C2B (Offline)" : "C2B");

        if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
        if (isOffline) {
            toast.success(`Received ${formatCurrency(amount)} from ${data.customerName || "Customer"} [C2B Offline] — will sync later`);
        } else {
            toast.success(`Received ${formatCurrency(amount)} from ${data.customerName || "Customer"} [C2B]`);
        }

        setTimeout(() => { setStatus("ready"); }, 3000);
    };

    // ─── B2C: Send money to a customer (refund, payout) ─────
    const sendToCustomer = async (customer: CustomerDevice) => {
        const amount = Number(paymentAmount);
        if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
        if (amount > balance) { toast.error("Insufficient business balance"); return; }

        const isOffline = !online;

        // Offline guard: check SaralPay wallet
        if (isOffline) {
            if (!offlineWallet.loaded) {
                toast.error("SaralPay wallet not loaded! Load funds for offline payments.");
                return;
            }
            if (!canSpendOffline(amount)) {
                toast.error(`Insufficient SaralPay balance! Remaining: ${formatCurrency(saralPayBalance)}`);
                return;
            }
        }

        setStatus("processing");
        await new Promise((r) => setTimeout(r, 1000));

        const txId = `UPA-B2C-${String(Date.now()).slice(-6)}`;
        const nonce = `b2c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const txRecord = {
            id: txId, tx_id: txId, tx_type: "b2c" as any,
            recipient: customer.upa || customer.name, recipientName: customer.name,
            fromUPA: businessUPA, amount,
            intent: `B2C Payment to ${customer.name}`,
            intentCategory: "transfer",
            metadata: {
                businessName, businessUPA,
                customerName: customer.name, customerUPA: customer.upa || "",
                paymentType: "b2c", mode: "nfc", direction: "outgoing",
                offlineQueued: isOffline ? "true" : "false",
            },
            status: (isOffline ? "queued" : "settled") as "queued" | "settled",
            mode: (isOffline ? "offline" : "nfc") as "offline" | "nfc",
            nonce, timestamp: Date.now(),
            settledAt: isOffline ? undefined : Date.now(),
            walletProvider: "upa_pay", payment_source: "wallet" as const,
        };

        if (isOffline) {
            // ACID-guaranteed offline B2C payment
            const queuePayload = {
                payload: JSON.stringify({
                    version: "1.0", upa: customer.upa || customer.name,
                    intent: { id: "b2c_payment", category: "transfer", label: `B2C Payment to ${customer.name}` },
                    tx_type: "b2c", amount, currency: "NPR", metadata: txRecord.metadata,
                    payer_name: businessName, payer_id: businessUPA,
                    issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
                    nonce, type: "offline",
                }),
                signature: "offline-b2c-" + txId,
                publicKey: "",
                timestamp: Date.now(),
                nonce,
                recipient: customer.upa || customer.name,
                amount,
                intent: `B2C Payment to ${customer.name}`,
                metadata: txRecord.metadata,
            };

            const acidResult = await executeACIDTransaction(
                {
                    transaction: txRecord,
                    queuePayload,
                    deductAmount: amount,
                    currentBalance: balance,
                    offlineBalance: saralPayBalance,
                    consumesOfflineWallet: true,
                },
                { addTransaction, updateBalance, spendFromSaralPay }
            );

            if (!acidResult.success) {
                setStatus("ready");
                toast.error(`B2C payment failed: ${acidResult.error}`);
                return;
            }
        } else {
            // Online: direct writes
            saveLocalTransaction(txRecord);
            updateBalance(amount);
            addTransaction(txRecord);
        }

        // Notify citizen via signal channel (BroadcastChannel works offline for same-device!)
        channelRef.current?.send({
            type: "b2c_payment_received",
            businessId, businessName, businessUPA,
            targetCitizen: customer.id, targetUPA: customer.upa,
            amount, txId, isOffline,
        });

        // Credit receiver
        if (customer.upa) creditUser(customer.upa, amount, txRecord);

        // Log
        setTxLog((prev) => [{ id: txId, type: isOffline ? "B2C (offline)" : "B2C (sent)", amount, counterparty: customer.name, time: Date.now() }, ...prev]);
        setLastTxId(txId);
        setLastTxType(isOffline ? "B2C (Offline)" : "B2C");

        // API — only when online
        if (!isOffline) {
            fetch("/api/transactions/settle", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    payload: {
                        version: "1.0", upa: customer.upa || customer.name,
                        intent: { id: "b2c_payment", category: "transfer", label: `B2C Payment to ${customer.name}` },
                        tx_type: "b2c", amount, currency: "NPR", metadata: txRecord.metadata,
                        payer_name: businessName, payer_id: businessUPA,
                        issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
                        nonce, type: "online",
                    },
                }),
            }).catch(() => { /* best-effort */ });
        }

        setStatus("success");
        if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
        if (isOffline) {
            toast.success(`Sent ${formatCurrency(amount)} to ${customer.name} [B2C Offline] — will sync later`);
        } else {
            toast.success(`Sent ${formatCurrency(amount)} to ${customer.name} [B2C]`);
        }

        setTimeout(() => setStatus("ready"), 3000);
    };

    // ─── B2G: Pay government entity ─────────────────────────
    const payGovernment = async (gov: typeof GOV_ENTITIES[0]) => {
        const amount = Number(paymentAmount);
        if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
        if (amount > balance) { toast.error("Insufficient business balance"); return; }

        const isOffline = !online;

        // Offline guard: check SaralPay wallet
        if (isOffline) {
            if (!offlineWallet.loaded) {
                toast.error("SaralPay wallet not loaded! Load funds for offline payments.");
                return;
            }
            if (!canSpendOffline(amount)) {
                toast.error(`Insufficient SaralPay balance! Remaining: ${formatCurrency(saralPayBalance)}`);
                return;
            }
        }

        setStatus("processing");
        await new Promise((r) => setTimeout(r, 1000));

        const txId = `UPA-B2G-${String(Date.now()).slice(-6)}`;
        const nonce = `b2g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const txRecord = {
            id: txId, tx_id: txId, tx_type: "b2g" as any,
            recipient: gov.upa, recipientName: gov.name,
            fromUPA: businessUPA, amount,
            intent: `B2G Payment — ${gov.name}`,
            intentCategory: gov.category,
            metadata: {
                businessName, businessUPA,
                govEntity: gov.name, govUPA: gov.upa,
                paymentType: "b2g", mode: "nfc", direction: "outgoing",
                offlineQueued: isOffline ? "true" : "false",
            },
            status: (isOffline ? "queued" : "settled") as "queued" | "settled",
            mode: (isOffline ? "offline" : "nfc") as "offline" | "nfc",
            nonce, timestamp: Date.now(),
            settledAt: isOffline ? undefined : Date.now(),
            walletProvider: "upa_pay", payment_source: "wallet" as const,
        };

        if (isOffline) {
            // ACID-guaranteed offline B2G payment
            const queuePayload = {
                payload: JSON.stringify({
                    version: "1.0", upa: gov.upa,
                    intent: { id: `b2g_${gov.category}`, category: gov.category, label: `B2G Payment — ${gov.name}` },
                    tx_type: "b2g", amount, currency: "NPR", metadata: txRecord.metadata,
                    payer_name: businessName, payer_id: businessUPA,
                    issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
                    nonce, type: "offline",
                }),
                signature: "offline-b2g-" + txId,
                publicKey: "",
                timestamp: Date.now(),
                nonce,
                recipient: gov.upa,
                amount,
                intent: `B2G Payment — ${gov.name}`,
                metadata: txRecord.metadata,
            };

            const acidResult = await executeACIDTransaction(
                {
                    transaction: txRecord,
                    queuePayload,
                    deductAmount: amount,
                    currentBalance: balance,
                    offlineBalance: saralPayBalance,
                    consumesOfflineWallet: true,
                },
                { addTransaction, updateBalance, spendFromSaralPay }
            );

            if (!acidResult.success) {
                setStatus("ready");
                toast.error(`B2G payment failed: ${acidResult.error}`);
                return;
            }
        } else {
            // Online: direct writes
            saveLocalTransaction(txRecord);
            updateBalance(amount);
            addTransaction(txRecord);
        }

        // Log
        setTxLog((prev) => [{ id: txId, type: isOffline ? "B2G (offline)" : "B2G (sent)", amount, counterparty: gov.name, time: Date.now() }, ...prev]);
        setLastTxId(txId);
        setLastTxType(isOffline ? "B2G (Offline)" : "B2G");

        // API — only when online
        if (!isOffline) {
            fetch("/api/transactions/settle", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    payload: {
                        version: "1.0", upa: gov.upa,
                        intent: { id: `b2g_${gov.category}`, category: gov.category, label: `B2G Payment — ${gov.name}` },
                        tx_type: "b2g", amount, currency: "NPR", metadata: txRecord.metadata,
                        payer_name: businessName, payer_id: businessUPA,
                        issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
                        nonce, type: "online",
                    },
                }),
            }).catch(() => { /* best-effort */ });
        }

        setStatus("success");
        if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
        if (isOffline) {
            toast.success(`Paid ${formatCurrency(amount)} to ${gov.name} [B2G Offline] — will sync later`);
        } else {
            toast.success(`Paid ${formatCurrency(amount)} to ${gov.name} [B2G]`);
        }

        setTimeout(() => setStatus("ready"), 3000);
    };

    // ─── NFC Tag Write (native) ─────────────────────────────
    const writeNFCTag = async () => {
        if (!hasNativeNFC) { toast.error("NFC write not supported"); return; }
        const amount = Number(paymentAmount);
        if (!amount || amount <= 0) { toast.error("Enter amount first"); return; }
        try {
            const NDEFReaderClass = (window as any).NDEFReader;
            const writer = new NDEFReaderClass();
            await writer.write({
                records: [{
                    recordType: "text",
                    data: JSON.stringify({
                        type: "upa_payment", merchantName: businessName, merchantId: businessId,
                        upa: businessUPA, amount, currency: "NPR", timestamp: Date.now(),
                    }),
                }],
            });
            toast.success("NFC tag written — customer can tap to pay");
        } catch (err: any) {
            toast.error(`NFC write failed: ${err.message}`);
        }
    };

    const modeLabels: Record<BizTxMode, string> = { charge: "Charge Customer (C2B)", b2c: "Send to Customer (B2C)", b2g: "Pay Government (B2G)", xdevice: "Cross-Device Offline" };

    return (
        <div className="p-4 md:p-6 space-y-4 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold">Merchant NFC Terminal</h1>
                    <p className="text-xs text-muted-foreground">
                        Accept & send contactless payments
                        {!online && " • Offline Mode"}
                    </p>
                </div>
                <div className="flex items-center gap-1.5">
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
                                        Offline payments deduct from your SaralPay wallet and queue for sync.
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

            {/* NFC Banner */}
            {hasNativeNFC && online && (
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-3 flex items-start gap-3">
                        <Smartphone className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-green-800">NFC Terminal Active</p>
                            <p className="text-xs text-green-700 mt-1">This device supports NFC. You can write payment tags.</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Business balance — shows SaralPay when offline */}
            {!online && offlineWallet.loaded ? (
                <Card className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs text-white/70">SaralPay Offline Wallet</p>
                                <p className="text-2xl font-bold">{formatCurrency(saralPayBalance)}</p>
                                <p className="text-[10px] text-white/50 mt-1">{businessUPA}</p>
                            </div>
                            <div className="p-3 bg-white/10 rounded-2xl"><WifiOff className="h-6 w-6" /></div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-0">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs text-white/70">Business Balance</p>
                                <p className="text-2xl font-bold">{formatCurrency(balance)}</p>
                                <p className="text-[10px] text-white/50 mt-1">{businessUPA}</p>
                            </div>
                            <div className="p-3 bg-white/10 rounded-2xl"><Building2 className="h-6 w-6" /></div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Mode Selector */}
            <div className="flex gap-2">
                <Button variant={txMode === "charge" ? "default" : "outline"} size="sm" className="flex-1"
                    onClick={() => setTxMode("charge")}>
                    <ArrowDownLeft className="h-4 w-4 mr-1" />
                    <span className="text-xs">Charge</span>
                </Button>
                <Button variant={txMode === "b2c" ? "default" : "outline"} size="sm" className="flex-1"
                    onClick={() => setTxMode("b2c")}>
                    <Send className="h-4 w-4 mr-1" />
                    <span className="text-xs">B2C</span>
                </Button>
                <Button variant={txMode === "b2g" ? "default" : "outline"} size="sm" className="flex-1"
                    onClick={() => setTxMode("b2g")}>
                    <Landmark className="h-4 w-4 mr-1" />
                    <span className="text-xs">B2G</span>
                </Button>
                <Button variant={txMode === "xdevice" ? "default" : "outline"} size="sm"
                    onClick={() => setTxMode("xdevice")}
                    className={`flex-1 ${txMode === "xdevice" ? "bg-purple-600 hover:bg-purple-700" : ""}`}>
                    <Smartphone className="h-4 w-4 mr-1" />
                    <span className="text-xs">X-Device</span>
                </Button>
            </div>

            {/* Cross-Device Offline Mode */}
            {txMode === "xdevice" ? (
                <MerchantOfflineCharge businessName={businessName || merchantProfile?.businessName || "My Business"} businessUPA={businessUPA} />
            ) : (
                <>
                    {/* Business Setup */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Building2 className="h-4 w-4" /> Terminal — {modeLabels[txMode]}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Business Name</label>
                                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Your business name" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Amount (NPR)</label>
                                <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Enter amount" />
                            </div>
                            {hasNativeNFC && txMode === "charge" && (
                                <Button variant="outline" size="sm" className="w-full" onClick={writeNFCTag}>
                                    <CreditCard className="h-4 w-4 mr-2" /> Write to NFC Tag
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {/* QR Code Display for Charge Mode */}
                    {txMode === "charge" && paymentAmount && Number(paymentAmount) > 0 && (
                        <Card className="border-primary/20">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <QrCode className="h-4 w-4 text-primary" />
                                    Payment QR Code
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-xs text-muted-foreground text-center">
                                    Customer can scan this QR code to pay {formatCurrency(Number(paymentAmount))}
                                </p>
                                <div className="flex justify-center bg-white rounded-lg p-4 border">
                                    <QRCodeDisplay
                                        value={JSON.stringify({
                                            version: "1.0",
                                            type: "merchant_charge",
                                            merchantName: businessName,
                                            merchantUPA: businessUPA,
                                            amount: Number(paymentAmount),
                                            currency: "NPR",
                                            timestamp: Date.now(),
                                        })}
                                        size={200}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground text-center">
                                    Works offline — customer scans with /pay?mode=qr
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Daily Stats */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">Today&apos;s Revenue</p>
                                    <p className="text-xl font-bold text-green-600">{formatCurrency(dailyTotal)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Transactions</p>
                                    <p className="text-xl font-bold">{todaysTransactions}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ─── Detection / Action Area ─── */}
                    <Card className={`transition-all duration-500 ${status === "detecting" ? "border-blue-400 bg-blue-50"
                        : status === "processing" ? "border-amber-400 bg-amber-50"
                            : status === "success" ? "border-green-400 bg-green-50"
                                : "border-dashed"
                        }`}>
                        <CardContent className="p-6 text-center">
                            {/* --- CHARGE MODE (C2B) --- */}
                            {txMode === "charge" && (
                                <>
                                    {status === "ready" && (
                                        <>
                                            <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                                <Phone className="h-10 w-10 text-gray-400" />
                                            </div>
                                            <h3 className="text-lg font-semibold mb-2">Waiting for Customers</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Customers on <code>/pay?mode=nfc</code> (any device) will appear here
                                            </p>
                                        </>
                                    )}

                                    {status === "detecting" && nearbyCustomers.length > 0 && (
                                        <>
                                            <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                                <Users className="h-10 w-10 text-blue-600" />
                                            </div>
                                            <h3 className="text-lg font-semibold mb-3 text-blue-700">
                                                {nearbyCustomers.length} Customer{nearbyCustomers.length > 1 ? "s" : ""} Nearby
                                            </h3>
                                            <div className="space-y-2">
                                                {nearbyCustomers.map((customer) => (
                                                    <div key={customer.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                                <span className="text-xs font-bold text-blue-600">{customer.name.charAt(0)}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-sm font-medium">{customer.name}</span>
                                                                {customer.upa && <p className="text-[10px] text-muted-foreground">{customer.upa}</p>}
                                                            </div>
                                                        </div>
                                                        <Button size="sm" onClick={() => requestPayment(customer.id)}
                                                            disabled={!paymentAmount || Number(paymentAmount) <= 0}
                                                            className="bg-blue-600 hover:bg-blue-700">
                                                            Charge {paymentAmount ? formatCurrency(Number(paymentAmount)) : "—"}
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}

                            {/* --- B2C MODE --- */}
                            {txMode === "b2c" && (
                                <>
                                    {(status === "ready" || status === "detecting") && nearbyCustomers.length === 0 && (
                                        <>
                                            <div className="mx-auto w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                                                <Send className="h-10 w-10 text-purple-400" />
                                            </div>
                                            <h3 className="text-lg font-semibold mb-2">B2C — Send to Customer</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Customers on <code>/pay?mode=nfc</code> (any device) will appear here for refunds/payouts
                                            </p>
                                        </>
                                    )}

                                    {nearbyCustomers.length > 0 && (status === "ready" || status === "detecting") && (
                                        <>
                                            <div className="mx-auto w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                                <Send className="h-10 w-10 text-purple-600" />
                                            </div>
                                            <h3 className="text-lg font-semibold mb-3 text-purple-700">Send to Customer (B2C)</h3>
                                            <div className="space-y-2">
                                                {nearbyCustomers.map((customer) => (
                                                    <div key={customer.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                                                                <span className="text-xs font-bold text-purple-600">{customer.name.charAt(0)}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-sm font-medium">{customer.name}</span>
                                                                {customer.upa && <p className="text-[10px] text-muted-foreground">{customer.upa}</p>}
                                                            </div>
                                                        </div>
                                                        <Button size="sm" onClick={() => sendToCustomer(customer)}
                                                            disabled={!paymentAmount || Number(paymentAmount) <= 0}
                                                            className="bg-purple-600 hover:bg-purple-700">
                                                            Send {paymentAmount ? formatCurrency(Number(paymentAmount)) : "—"}
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}

                            {/* --- B2G MODE --- */}
                            {txMode === "b2g" && (status === "ready" || status === "detecting") && (
                                <>
                                    <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                        <Landmark className="h-10 w-10 text-red-600" />
                                    </div>
                                    <h3 className="text-lg font-semibold mb-3 text-red-700">Pay Government (B2G)</h3>
                                    <div className="space-y-2 text-left">
                                        {GOV_ENTITIES.map((gov) => (
                                            <div key={gov.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                                                <div className="flex items-center gap-2">
                                                    <Landmark className="h-4 w-4 text-red-600" />
                                                    <div>
                                                        <span className="text-sm font-medium">{gov.name}</span>
                                                        <p className="text-[10px] text-muted-foreground">{gov.upa}</p>
                                                    </div>
                                                </div>
                                                <Button size="sm" onClick={() => payGovernment(gov)}
                                                    disabled={!paymentAmount || Number(paymentAmount) <= 0}
                                                    className="bg-red-600 hover:bg-red-700 text-xs">
                                                    Pay {paymentAmount ? formatCurrency(Number(paymentAmount)) : "—"}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Processing (all modes) */}
                            {status === "processing" && (
                                <>
                                    <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                                        <RefreshCw className="h-10 w-10 text-amber-600 animate-spin" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-amber-700 mb-1">Processing...</h3>
                                    <p className="text-sm text-amber-600">
                                        {txMode === "charge" ? "Waiting for customer approval" : "Settling payment..."}
                                    </p>
                                </>
                            )}

                            {/* Success (all modes) */}
                            {status === "success" && (
                                <>
                                    <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 ${!online ? "bg-amber-100" : "bg-green-100"}`}>
                                        {!online ? (
                                            <CloudOff className="h-10 w-10 text-amber-600" />
                                        ) : (
                                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                                        )}
                                    </div>
                                    <h3 className={`text-lg font-semibold mb-1 ${!online ? "text-amber-700" : "text-green-700"}`}>
                                        {!online
                                            ? (txMode === "charge" ? "Payment Queued!" : txMode === "b2c" ? "Transfer Queued!" : "Payment Queued!")
                                            : (txMode === "charge" ? "Payment Received!" : txMode === "b2c" ? "Money Sent!" : "Tax/Fee Paid!")
                                        }
                                    </h3>
                                    {lastTxId && (
                                        <div className="my-2 bg-white rounded-lg border p-2 text-left space-y-1 mx-auto max-w-xs">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">TX:</span>
                                                <span className="font-mono text-[10px]">{lastTxId}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">Type:</span>
                                                <Badge variant="outline" className="text-[10px]">{lastTxType}</Badge>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">Status:</span>
                                                {!online ? (
                                                    <Badge className="bg-amber-100 text-amber-700 text-[10px]">Queued (Offline)</Badge>
                                                ) : (
                                                    <Badge className="bg-green-100 text-green-700 text-[10px]">Settled</Badge>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <p className={`text-sm ${!online ? "text-amber-600" : "text-green-600"}`}>
                                        {!online ? "Will auto-sync when back online ⏳" : "Transaction settled ✓"}
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Transaction Log */}
                    {txLog.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">NFC Transaction Log</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {txLog.slice(0, 10).map((tx) => (
                                    <div key={tx.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-2 border text-xs">
                                        <div>
                                            <span className="font-mono text-[10px]">{tx.id}</span>
                                            <p className="text-muted-foreground">{tx.counterparty}</p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant={tx.type.includes("received") || tx.type.includes("C2B") ? "default" : "secondary"} className="text-[10px] mb-1">
                                                {tx.type}
                                            </Badge>
                                            <p className={tx.type.includes("received") || tx.type.includes("C2B") ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                                {tx.type.includes("received") || tx.type.includes("C2B") ? "+" : "-"}{formatCurrency(tx.amount)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                </>
            )}

            {/* Instructions */}
            <Card className="border-dashed">
                <CardContent className="p-4">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" /> Merchant Terminal Guide
                    </h4>
                    <div className="text-xs text-muted-foreground space-y-1.5">
                        <p><strong>Charge (C2B):</strong> Customer opens /pay?mode=nfc on their phone → appears here → tap Charge</p>
                        <p><strong>B2C (Refund/Payout):</strong> Switch to B2C → select customer → Send</p>
                        <p><strong>B2G (Tax/Fee):</strong> Switch to B2G → select govt entity → Pay</p>
                        <p><strong>X-Device (Offline):</strong> Two-phone Ed25519 QR handshake — zero internet needed!</p>
                        <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                            <p className="text-amber-800 font-medium flex items-center gap-1">
                                <WifiOff className="h-3 w-3" /> SaralPay Offline Wallet
                            </p>
                            <p className="text-amber-700 mt-1">
                                Load your SaralPay wallet for offline payments. Transactions queue locally
                                and auto-sync when connectivity is restored. Payments deduct from SaralPay balance.
                            </p>
                        </div>
                        <p className="mt-2 text-primary font-medium">Works across devices via Supabase Realtime — true mobile-to-mobile!</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
