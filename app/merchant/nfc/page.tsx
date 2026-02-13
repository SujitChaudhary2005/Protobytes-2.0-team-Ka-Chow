"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { useWallet } from "@/contexts/wallet-context";
import { RouteGuard } from "@/components/route-guard";
import { saveTransaction as saveLocalTransaction } from "@/lib/storage";

type TerminalStatus = "ready" | "detecting" | "processing" | "success";

interface CustomerDevice {
    id: string;
    name: string;
    isNearby: boolean;
    lastSeen: number;
}

export default function MerchantNFCWrapper() {
    return (
        <RouteGuard allowedRoles={["citizen", "merchant"]}>
            <MerchantNFCTerminal />
        </RouteGuard>
    );
}

function MerchantNFCTerminal() {
    const router = useRouter();
    const { user, merchantProfile, addTransaction, role } = useWallet();
    const channelRef = useRef<BroadcastChannel | null>(null);
    const nfcReaderRef = useRef<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const [hasNativeNFC, setHasNativeNFC] = useState(false);
    const [businessName, setBusinessName] = useState(
        merchantProfile?.businessName || user?.name || "My Business"
    );
    const [businessId] = useState(
        () => `biz-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    );
    const [status, setStatus] = useState<TerminalStatus>("ready");
    const [nearbyCustomers, setNearbyCustomers] = useState<CustomerDevice[]>([]);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [dailyTotal, setDailyTotal] = useState(0);
    const [todaysTransactions, setTodaysTransactions] = useState(0);

    // Check NFC
    useEffect(() => {
        if (typeof window !== "undefined" && "NDEFReader" in window) {
            setHasNativeNFC(true);
        }
    }, []);

    // Load today's totals from storage
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const stored = localStorage.getItem("upa_merchant_nfc_daily");
            if (stored) {
                const data = JSON.parse(stored);
                const today = new Date().toDateString();
                if (data.date === today) {
                    setDailyTotal(data.total);
                    setTodaysTransactions(data.count);
                }
            }
        } catch { /* ignore */ }
    }, []);

    const saveDailyStats = (total: number, count: number) => {
        try {
            localStorage.setItem(
                "upa_merchant_nfc_daily",
                JSON.stringify({ date: new Date().toDateString(), total, count })
            );
        } catch { /* ignore */ }
    };

    // ─── BroadcastChannel ─────────────────────────────────
    useEffect(() => {
        if (typeof window === "undefined") return;

        channelRef.current = new BroadcastChannel("citizen-nfc-channel");

        channelRef.current.onmessage = (event) => {
            handleMessage(event.data);
        };

        return () => {
            channelRef.current?.close();
        };
    }, [businessId]);

    // Broadcast merchant presence
    useEffect(() => {
        const interval = setInterval(() => {
            channelRef.current?.postMessage({
                type: "business_presence",
                businessId,
                businessName,
                isAcceptingPayments: true,
                timestamp: Date.now(),
            });
        }, 2000);

        return () => clearInterval(interval);
    }, [businessId, businessName]);

    // Cleanup stale customers
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setNearbyCustomers((prev) => prev.filter((c) => now - c.lastSeen < 10000));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleMessage = useCallback(
        (data: any) => {
            switch (data.type) {
                case "customer_presence":
                    setNearbyCustomers((prev) => {
                        const existing = prev.find((c) => c.id === data.customerId);
                        const customer: CustomerDevice = {
                            id: data.customerId,
                            name: data.customerName,
                            isNearby: true,
                            lastSeen: data.timestamp,
                        };
                        if (existing) return prev.map((c) => (c.id === data.customerId ? customer : c));
                        return [...prev, customer];
                    });
                    if (status === "ready") setStatus("detecting");
                    break;

                case "payment_approval":
                    if (data.businessId === businessId) {
                        handlePaymentSuccess(data);
                    }
                    break;

                case "payment_decline":
                    if (data.businessId === businessId) {
                        setStatus("ready");
                        toast.error("Payment declined by customer");
                    }
                    break;
            }
        },
        [businessId, status]
    );

    const requestPayment = (customerId: string) => {
        const amount = Number(paymentAmount);
        if (!amount || amount <= 0) {
            toast.error("Enter a valid amount");
            return;
        }

        channelRef.current?.postMessage({
            type: "payment_request",
            businessId,
            paymentData: {
                amount,
                businessName,
                customerId,
                businessId,
                timestamp: Date.now(),
            },
            targetCustomer: customerId,
        });

        setStatus("processing");
        toast("Payment request sent to customer...");
    };

    const handlePaymentSuccess = (data: any) => {
        setStatus("success");
        const newTotal = dailyTotal + data.amount;
        const newCount = todaysTransactions + 1;
        setDailyTotal(newTotal);
        setTodaysTransactions(newCount);
        saveDailyStats(newTotal, newCount);

        const txId = `UPA-BIZ-${String(Date.now()).slice(-6)}`;
        const nonce = `biz-nfc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const txRecord = {
            id: txId,
            recipient: businessName,
            recipientName: businessName,
            amount: data.amount,
            intent: "NFC Payment Received",
            metadata: {
                customerName: data.customerName || "Customer",
                businessId,
                paymentType: "nfc_business",
                mode: "nfc",
            },
            status: "settled" as const,
            mode: "nfc" as const,
            nonce,
            timestamp: Date.now(),
            walletProvider: "upa_pay",
        };

        saveLocalTransaction(txRecord);

        // Persist via API
        fetch("/api/transactions/settle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                payload: {
                    version: "1.0",
                    upa: `${businessName.toLowerCase().replace(/\s+/g, "-")}@merchant.np`,
                    intent: { id: "nfc_purchase", category: "purchase", label: "NFC Payment Received" },
                    amount: data.amount,
                    currency: "NPR",
                    metadata: txRecord.metadata,
                    payer_name: data.customerName || "Customer",
                    payer_id: data.customerId || "unknown",
                    issuedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 3600000).toISOString(),
                    nonce,
                    type: "online",
                },
            }),
        }).catch(() => { /* best-effort */ });

        if (addTransaction) {
            addTransaction({ ...txRecord, tx_id: txId, payment_source: "wallet" });
        }

        if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
        toast.success(`Received ${formatCurrency(data.amount)} from ${data.customerName || "Customer"}`);

        setTimeout(() => {
            setStatus("ready");
            setNearbyCustomers([]);
        }, 4000);
    };

    // ─── Native NFC Write (for NFC tag-based terminals) ────
    const writeNFCTag = async () => {
        if (!hasNativeNFC || !("NDEFReader" in window)) {
            toast.error("NFC write not supported on this device");
            return;
        }

        const amount = Number(paymentAmount);
        if (!amount || amount <= 0) {
            toast.error("Enter amount first");
            return;
        }

        try {
            const NDEFReaderClass = (window as any).NDEFReader;
            const writer = new NDEFReaderClass();
            await writer.write({
                records: [
                    {
                        recordType: "text",
                        data: JSON.stringify({
                            type: "upa_payment",
                            merchantName: businessName,
                            merchantId: businessId,
                            upa: `${businessName.toLowerCase().replace(/\s+/g, "-")}@merchant.np`,
                            amount,
                            currency: "NPR",
                            timestamp: Date.now(),
                        }),
                    },
                ],
            });
            toast.success("NFC tag written! Customer can tap to pay.");
        } catch (err: any) {
            toast.error(`NFC write failed: ${err.message}`);
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
                    <h1 className="text-lg font-bold">NFC Payment Terminal</h1>
                    <p className="text-xs text-muted-foreground">Accept contactless payments</p>
                </div>
                <Badge variant={hasNativeNFC ? "default" : "secondary"} className="text-[10px]">
                    {hasNativeNFC ? "NFC Ready" : "Proximity Mode"}
                </Badge>
            </div>

            {/* NFC Support Banner */}
            {hasNativeNFC && (
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-3 flex items-start gap-3">
                        <Smartphone className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-green-800">NFC Terminal Active</p>
                            <p className="text-xs text-green-700 mt-1">
                                This device has NFC. You can write payment data to NFC tags or accept
                                proximity payments from customers.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Business Setup */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Terminal Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Business Name</label>
                        <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Your business name" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Charge Amount (NPR)</label>
                        <Input
                            type="number"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder="Enter amount to charge"
                        />
                    </div>
                    {hasNativeNFC && (
                        <Button variant="outline" size="sm" className="w-full" onClick={writeNFCTag}>
                            <CreditCard className="h-4 w-4 mr-2" />
                            Write to NFC Tag
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Today's Sales */}
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

            {/* Detection Area */}
            <Card
                className={`transition-all duration-500 ${
                    status === "detecting"
                        ? "border-blue-400 bg-blue-50"
                        : status === "processing"
                        ? "border-amber-400 bg-amber-50"
                        : status === "success"
                        ? "border-green-400 bg-green-50"
                        : "border-dashed"
                }`}
            >
                <CardContent className="p-8 text-center">
                    {status === "ready" && (
                        <>
                            <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <Phone className="h-10 w-10 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Waiting for Customers</h3>
                            <p className="text-sm text-muted-foreground">
                                Customers with NFC or UPA Pay app will appear here
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
                                                <span className="text-xs font-bold text-blue-600">
                                                    {customer.name.charAt(0)}
                                                </span>
                                            </div>
                                            <span className="text-sm font-medium">{customer.name}</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={() => requestPayment(customer.id)}
                                            disabled={!paymentAmount || Number(paymentAmount) <= 0}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            Charge {paymentAmount ? formatCurrency(Number(paymentAmount)) : "—"}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {status === "processing" && (
                        <>
                            <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                                <Zap className="h-10 w-10 text-amber-600 animate-spin" />
                            </div>
                            <h3 className="text-lg font-semibold text-amber-700 mb-1">Processing Payment...</h3>
                            <p className="text-sm text-amber-600">Waiting for customer approval</p>
                        </>
                    )}

                    {status === "success" && (
                        <>
                            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="h-10 w-10 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-green-700 mb-1">Payment Received!</h3>
                            <p className="text-sm text-green-600">Transaction completed successfully</p>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Instructions */}
            <Card className="border-dashed">
                <CardContent className="p-4">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Terminal Setup
                    </h4>
                    <div className="text-xs text-muted-foreground space-y-1.5">
                        <p>1. Set your business name and the charge amount</p>
                        <p>2. Keep this page open — customers will be detected automatically</p>
                        <p>3. When a customer appears, tap &quot;Charge&quot; to send the request</p>
                        <p>4. The customer approves on their device and payment is settled instantly</p>
                        {hasNativeNFC && <p>5. You can also write payment data to NFC tags for tap-to-pay</p>}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
