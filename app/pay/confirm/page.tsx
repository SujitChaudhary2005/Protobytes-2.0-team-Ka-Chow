"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/contexts/wallet-context";
import { useNetwork } from "@/hooks/use-network";
import { generateNonce } from "@/lib/crypto";
import { queueTransaction } from "@/lib/db";
import { saveTransaction as saveLocalTransaction } from "@/lib/storage";
import type { StaticQRPayload } from "@/types";
import { Shield, Wifi, WifiOff, Loader2, AlertTriangle } from "lucide-react";

function ConfirmContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { wallet, addTransaction, updateBalance } = useWallet();
    const { online } = useNetwork();

    const [staticPayload, setStaticPayload] = useState<StaticQRPayload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    // Citizen-entered fields
    const [payerName, setPayerName] = useState("");
    const [payerId, setPayerId] = useState("");
    const [amount, setAmount] = useState("");
    const [metadata, setMetadata] = useState<Record<string, string>>({});

    useEffect(() => {
        const data = searchParams.get("data");
        if (!data) {
            setError("No payment data received");
            return;
        }
        try {
            const parsed = JSON.parse(decodeURIComponent(data)) as StaticQRPayload;
            setStaticPayload(parsed);

            // Pre-fill amount if fixed
            if (parsed.amount_type === "fixed" && parsed.amount) {
                setAmount(String(parsed.amount));
            }

            // Initialize metadata fields from schema
            if (parsed.metadata_schema) {
                const initial: Record<string, string> = {};
                Object.keys(parsed.metadata_schema).forEach((key) => {
                    initial[key] = "";
                });
                setMetadata(initial);
            }
        } catch {
            setError("Invalid payment data");
        }
    }, [searchParams]);

    const isFormValid = useCallback(() => {
        if (!payerName.trim() || !payerId.trim()) return false;
        if (!amount || parseFloat(amount) <= 0) return false;

        // Validate range
        if (staticPayload?.amount_type === "range") {
            const amt = parseFloat(amount);
            if (staticPayload.min_amount && amt < staticPayload.min_amount) return false;
            if (staticPayload.max_amount && amt > staticPayload.max_amount) return false;
        }

        // Validate required metadata
        if (staticPayload?.metadata_schema) {
            for (const [key, field] of Object.entries(staticPayload.metadata_schema)) {
                if (field.required && !metadata[key]?.trim()) return false;
            }
        }

        return true;
    }, [payerName, payerId, amount, metadata, staticPayload]);

    const handlePay = async () => {
        if (!staticPayload || !wallet) return;
        if (!isFormValid()) {
            setError("Please fill in all required fields");
            return;
        }

        setProcessing(true);
        setError(null);

        const parsedAmount = parseFloat(amount);
        const nonce = generateNonce();
        const now = new Date();
        const intentLabel = staticPayload.intent.label || staticPayload.intent.id;

        // Build full transaction payload at payment time
        const fullPayload = {
            version: staticPayload.version,
            upa: staticPayload.upa,
            intent: staticPayload.intent,
            amount: parsedAmount,
            currency: staticPayload.currency,
            metadata: { ...metadata, payerName, payerId },
            payer_name: payerName,
            payer_id: payerId,
            issuedAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
            nonce,
            type: "online" as const,
        };

        try {
            if (online) {
                const res = await fetch("/api/transactions/settle", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        payerUpa: wallet.address,
                        payload: fullPayload,
                    }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || "Settlement failed");

                const txId = result.transaction?.txId || `UPA-${Date.now()}`;

                updateBalance(parsedAmount);
                addTransaction({
                    id: txId,
                    tx_id: txId,
                    recipient: staticPayload.upa,
                    recipientName: staticPayload.entity_name,
                    amount: parsedAmount,
                    intent: intentLabel,
                    intentCategory: staticPayload.intent.category,
                    metadata: { ...metadata, payerName, payerId },
                    status: "settled",
                    mode: "online",
                    nonce,
                    timestamp: Date.now(),
                    settledAt: Date.now(),
                    walletProvider: "upa_pay",
                });
                saveLocalTransaction({
                    id: txId,
                    recipient: staticPayload.upa,
                    recipientName: staticPayload.entity_name,
                    amount: parsedAmount,
                    intent: intentLabel,
                    metadata: { ...metadata, payerName, payerId },
                    status: "settled",
                    mode: "online",
                    nonce,
                    timestamp: Date.now(),
                    walletProvider: "upa_pay",
                });

                router.push(
                    `/pay/success?txId=${txId}&amount=${parsedAmount}&intent=${encodeURIComponent(intentLabel)}&recipient=${encodeURIComponent(staticPayload.upa)}`
                );
            } else {
                // Offline queue
                await queueTransaction({
                    payload: JSON.stringify(fullPayload),
                    signature: "",
                    publicKey: "",
                    nonce,
                    recipient: staticPayload.upa,
                    amount: parsedAmount,
                    intent: intentLabel,
                    metadata: { ...metadata, payerName, payerId },
                    timestamp: Date.now(),
                });

                updateBalance(parsedAmount);
                addTransaction({
                    id: `queued_${Date.now()}`,
                    recipient: staticPayload.upa,
                    recipientName: staticPayload.entity_name,
                    amount: parsedAmount,
                    intent: intentLabel,
                    intentCategory: staticPayload.intent.category,
                    metadata: { ...metadata, payerName, payerId },
                    status: "queued",
                    mode: "offline",
                    nonce,
                    timestamp: Date.now(),
                    walletProvider: "upa_pay",
                });
                saveLocalTransaction({
                    id: `queued_${Date.now()}`,
                    recipient: staticPayload.upa,
                    recipientName: staticPayload.entity_name,
                    amount: parsedAmount,
                    intent: intentLabel,
                    metadata: { ...metadata, payerName, payerId },
                    status: "queued",
                    mode: "offline",
                    nonce,
                    timestamp: Date.now(),
                    walletProvider: "upa_pay",
                });

                router.push("/pay/queued");
            }
        } catch (err: any) {
            setError(err.message || "Payment failed");
        } finally {
            setProcessing(false);
        }
    };

    if (error && !staticPayload) {
        return (
            <div className="p-4 md:p-6">
                <Card className="border-destructive/50">
                    <CardContent className="p-6 text-center space-y-4">
                        <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
                        <p className="text-destructive">{error}</p>
                        <Button variant="outline" onClick={() => router.push("/pay/scan")}>
                            Try Again
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!staticPayload) {
        return (
            <div className="p-4 md:p-6 flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div>
                <h2 className="text-2xl font-semibold">Confirm Payment</h2>
                <p className="text-sm text-muted-foreground">
                    Fill in your details and confirm
                </p>
            </div>

            {/* Connection Status */}
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                online ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
            }`}>
                {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                {online ? "Online — will settle instantly" : "Offline — will queue for later"}
            </div>

            {/* Recipient Info (from QR) */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Paying to</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Entity</span>
                        <span className="font-medium">{staticPayload.entity_name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">UPA</span>
                        <span className="font-mono text-sm">{staticPayload.upa}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment Type</span>
                        <span className="capitalize">{staticPayload.intent.label}</span>
                    </div>
                    {staticPayload.amount_type === "fixed" && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="text-xl font-bold">NPR {staticPayload.amount?.toLocaleString()}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Citizen Input Form */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Your Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Full Name <span className="text-destructive">*</span></Label>
                            <Input
                                value={payerName}
                                onChange={(e) => setPayerName(e.target.value)}
                                placeholder="Ram Thapa"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>ID / License # <span className="text-destructive">*</span></Label>
                            <Input
                                value={payerId}
                                onChange={(e) => setPayerId(e.target.value)}
                                placeholder="LIC-ABC-1234"
                            />
                        </div>
                    </div>

                    {/* Amount (only if not fixed) */}
                    {staticPayload.amount_type !== "fixed" && (
                        <div className="space-y-2">
                            <Label>
                                Amount (NPR) <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={
                                    staticPayload.amount_type === "range"
                                        ? `${staticPayload.min_amount} – ${staticPayload.max_amount}`
                                        : "Enter amount"
                                }
                            />
                            {staticPayload.amount_type === "range" && (
                                <p className="text-xs text-muted-foreground">
                                    Range: NPR {staticPayload.min_amount?.toLocaleString()} – {staticPayload.max_amount?.toLocaleString()}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Dynamic Metadata Fields from QR schema */}
                    {staticPayload.metadata_schema && Object.keys(staticPayload.metadata_schema).length > 0 && (
                        <div className="space-y-3 pt-3 border-t">
                            {Object.entries(staticPayload.metadata_schema).map(([key, field]) => (
                                <div key={key} className="space-y-2">
                                    <Label className="text-sm">
                                        {field.label}
                                        {field.required && <span className="text-destructive ml-1">*</span>}
                                    </Label>
                                    <Input
                                        value={metadata[key] || ""}
                                        onChange={(e) => setMetadata({ ...metadata, [key]: e.target.value })}
                                        placeholder={field.label}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Error */}
            {error && (
                <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-4 text-sm text-destructive">
                        {error}
                    </CardContent>
                </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => router.back()}>
                    Cancel
                </Button>
                <Button
                    className="flex-1"
                    onClick={handlePay}
                    disabled={processing || !isFormValid()}
                >
                    {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {online ? `Pay NPR ${amount || "0"}` : "Queue Payment"}
                </Button>
            </div>
        </div>
    );
}

export default function ConfirmPage() {
    return (
        <Suspense fallback={
            <div className="p-4 md:p-6 flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        }>
            <ConfirmContent />
        </Suspense>
    );
}

