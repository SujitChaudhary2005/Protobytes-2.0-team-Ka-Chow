"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/wallet-context";
import { useNetwork } from "@/hooks/use-network";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteGuard } from "@/components/route-guard";
import { formatCurrency } from "@/lib/utils";
import { generateNonce, signPayload, hexToKey } from "@/lib/crypto";
import { SecureKeyStore } from "@/lib/secure-storage";
import { queueTransaction } from "@/lib/db";
import { saveTransaction as saveLocalTransaction } from "@/lib/storage";
import { C2C_INTENTS } from "@/types";
import {
    Users,
    ArrowRight,
    Loader2,
    CheckCircle2,
    MessageSquare,
    User,
    Wifi,
    WifiOff,
} from "lucide-react";
import { toast } from "sonner";

// Quick contacts for demo
const DEMO_CONTACTS = [
    { name: "Sita Sharma", upa: "sita@upa.np", icon: "sita" },
    { name: "Hari Prasad", upa: "hari@upa.np", icon: "hari" },
    { name: "Ram Thapa", upa: "ram@upa.np", icon: "ram" },
];

export default function C2CPaymentPage() {
    return (
        <RouteGuard allowedRoles={["citizen"]}>
            <C2CPayment />
        </RouteGuard>
    );
}

function C2CPayment() {
    const router = useRouter();
    const { balance, updateBalance, addTransaction, user, nid, wallet, canSpendOffline, useOfflineLimit: consumeOfflineLimit, offlineLimit } = useWallet();
    const { online } = useNetwork();
    const [toUPA, setToUPA] = useState("");
    const [amount, setAmount] = useState("");
    const [selectedIntent, setSelectedIntent] = useState("");
    const [message, setMessage] = useState("");
    const [paying, setPaying] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const senderUPA = nid?.linkedUPA || "ram@upa.np";

    const handleSend = async () => {
        const amt = Number(amount);
        if (!toUPA || amt <= 0) {
            toast.error("Enter recipient and amount");
            return;
        }
        if (amt > balance) {
            toast.error("Insufficient balance");
            return;
        }
        if (toUPA === senderUPA) {
            toast.error("Cannot send to yourself");
            return;
        }

        setPaying(true);
        const nonce = generateNonce();
        const intentLabel = selectedIntent || "Transfer";
        const now = new Date();

        try {
            if (online) {
                // ── ONLINE: settle via API ──
                const res = await fetch("/api/transactions/c2c", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        fromUPA: senderUPA,
                        toUPA,
                        amount: amt,
                        intent: intentLabel,
                        message,
                        walletProvider: "upa_pay",
                        payerName: user?.name || nid?.fullName || "Citizen",
                        nonce,
                    }),
                });

                const data = await res.json();

                if (data.success) {
                    updateBalance(amt);
                    addTransaction({
                        id: data.transaction.txId,
                        tx_id: data.transaction.txId,
                        tx_type: "c2c",
                        recipient: toUPA,
                        recipientName: DEMO_CONTACTS.find(c => c.upa === toUPA)?.name || toUPA,
                        fromUPA: senderUPA,
                        amount: amt,
                        intent: intentLabel,
                        intentCategory: "personal",
                        status: "settled",
                        mode: "online",
                        payment_source: "wallet",
                        message,
                        nonce,
                        timestamp: Date.now(),
                        settledAt: Date.now(),
                        walletProvider: "upa_pay",
                        metadata: { fromUPA: senderUPA, toUPA, intent: selectedIntent, message },
                    });
                    saveLocalTransaction({
                        id: data.transaction.txId,
                        recipient: toUPA,
                        recipientName: DEMO_CONTACTS.find(c => c.upa === toUPA)?.name || toUPA,
                        amount: amt,
                        intent: intentLabel,
                        metadata: { fromUPA: senderUPA, toUPA, intent: selectedIntent, message },
                        status: "settled",
                        mode: "online",
                        nonce,
                        timestamp: Date.now(),
                        walletProvider: "upa_pay",
                    });

                    toast.success(`Sent ${formatCurrency(amt)} to ${toUPA}`);
                    setTimeout(() => {
                        const recipientName = DEMO_CONTACTS.find(c => c.upa === toUPA)?.name || toUPA;
                        toast.info(`${recipientName} received ${formatCurrency(amt)} for: ${intentLabel}`);
                    }, 2000);

                    router.push(`/pay/success?amount=${amt}&recipient=${encodeURIComponent(toUPA)}&txId=${data.transaction.txId}&type=c2c&intent=${encodeURIComponent(intentLabel)}`);
                } else {
                    toast.error(data.error || "Transfer failed");
                }
            } else {
                // ── OFFLINE: enforce limit, sign with Ed25519, queue ──
                if (!canSpendOffline(amt)) {
                    const remaining = offlineLimit.maxAmount - offlineLimit.currentUsed;
                    toast.error(`Offline limit exceeded. Remaining: NPR ${remaining.toLocaleString()}`);
                    setPaying(false);
                    return;
                }

                const offlinePayload = {
                    version: "1.0" as const,
                    upa: toUPA,
                    intent: { id: "c2c_transfer", category: "personal", label: intentLabel },
                    amount: amt,
                    currency: "NPR",
                    metadata: { fromUPA: senderUPA, toUPA, intent: selectedIntent, message, payerName: user?.name || "", payerId: user?.id || "" },
                    payer_name: user?.name || nid?.fullName || "Citizen",
                    payer_id: user?.id || "",
                    issuedAt: now.toISOString(),
                    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
                    nonce,
                    type: "offline" as const,
                };

                // Sign with Ed25519
                let signature = "";
                let publicKey = wallet?.publicKey || "";
                try {
                    const privKeyHex = await SecureKeyStore.get("upa_private_key");
                    if (privKeyHex) {
                        signature = signPayload(offlinePayload, hexToKey(privKeyHex));
                    }
                } catch { /* signing optional */ }

                await queueTransaction({
                    payload: JSON.stringify(offlinePayload),
                    signature,
                    publicKey,
                    nonce,
                    recipient: toUPA,
                    amount: amt,
                    intent: intentLabel,
                    metadata: { fromUPA: senderUPA, toUPA, intent: selectedIntent, message },
                    timestamp: Date.now(),
                });

                const queuedTxId = `queued_${Date.now()}`;
                updateBalance(amt);
                consumeOfflineLimit(amt);
                addTransaction({
                    id: queuedTxId,
                    tx_id: queuedTxId,
                    tx_type: "c2c",
                    recipient: toUPA,
                    recipientName: DEMO_CONTACTS.find(c => c.upa === toUPA)?.name || toUPA,
                    fromUPA: senderUPA,
                    amount: amt,
                    intent: intentLabel,
                    intentCategory: "personal",
                    status: "queued",
                    mode: "offline",
                    payment_source: "wallet",
                    message,
                    nonce,
                    timestamp: Date.now(),
                    walletProvider: "upa_pay",
                    metadata: { fromUPA: senderUPA, toUPA, intent: selectedIntent, message },
                });
                saveLocalTransaction({
                    id: queuedTxId,
                    recipient: toUPA,
                    recipientName: DEMO_CONTACTS.find(c => c.upa === toUPA)?.name || toUPA,
                    amount: amt,
                    intent: intentLabel,
                    metadata: { fromUPA: senderUPA, toUPA, intent: selectedIntent, message },
                    status: "queued",
                    mode: "offline",
                    nonce,
                    timestamp: Date.now(),
                    walletProvider: "upa_pay",
                });

                toast.info(`Transfer queued offline — will settle when online`);
                router.push("/pay/queued");
            }
        } catch {
            toast.error("Transfer failed. Check connection.");
        } finally {
            setPaying(false);
        }
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
            <div className="flex items-center gap-3 mb-2">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
                <h1 className="text-lg font-bold">Send to Friend</h1>
            </div>

            {/* Connection Status */}
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${online ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                {online ? "Online — will settle instantly" : "Offline — will queue for later sync"}
            </div>

            {/* Quick Contacts */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Quick Contacts</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3">
                        {DEMO_CONTACTS.filter(c => c.upa !== senderUPA).map((contact) => (
                            <button
                                key={contact.upa}
                                onClick={() => setToUPA(contact.upa)}
                                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center flex-1 transition-colors ${toUPA === contact.upa ? "bg-green-50 border-green-300" : "hover:bg-muted/30"}`}
                            >
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <User className="h-5 w-5 text-blue-600" />
                                </div>
                                <span className="text-xs font-medium">{contact.name.split(" ")[0]}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">{contact.upa}</span>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Recipient */}
            <Card>
                <CardContent className="p-4 space-y-4">
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                            <User className="h-3 w-3 inline mr-1" />
                            Recipient UPA Address
                        </label>
                        <Input
                            placeholder="e.g., sita@upa.np"
                            value={toUPA}
                            onChange={(e) => setToUPA(e.target.value)}
                        />
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Amount (NPR)</label>
                        <Input
                            type="number"
                            placeholder="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="text-2xl font-bold h-14"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Balance: {formatCurrency(balance)}</p>
                    </div>

                    {/* Intent Selection */}
                    <div>
                        <label className="text-xs text-muted-foreground mb-2 block">What&apos;s it for?</label>
                        <div className="flex flex-wrap gap-2">
                            {C2C_INTENTS.map((intent) => (
                                <button
                                    key={intent}
                                    onClick={() => setSelectedIntent(intent)}
                                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${selectedIntent === intent
                                            ? "bg-green-100 border-green-400 text-green-700"
                                            : "hover:bg-muted/50"
                                        }`}
                                >
                                    {intent}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Message */}
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                            <MessageSquare className="h-3 w-3 inline mr-1" />
                            Message (optional)
                        </label>
                        <Input
                            placeholder="Thanks for lunch!"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Summary */}
            {toUPA && Number(amount) > 0 && (
                <Card className="bg-green-50/50 border-green-200">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700">Transfer Summary</span>
                        </div>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">From:</span>
                                <span className="font-mono text-xs">{senderUPA}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">To:</span>
                                <span className="font-mono text-xs">{toUPA}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Amount:</span>
                                <span className="font-bold">{formatCurrency(Number(amount))}</span>
                            </div>
                            {selectedIntent && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">For:</span>
                                    <span className="font-medium">{selectedIntent}</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Send Button */}
            <Button
                className="w-full h-12 bg-green-600 hover:bg-green-700"
                onClick={handleSend}
                disabled={paying || !toUPA || !amount || Number(amount) <= 0}
            >
                {paying ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                ) : (
                    <>
                        <Users className="h-4 w-4 mr-2" />
                        Send Money <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                )}
            </Button>
        </div>
    );
}
