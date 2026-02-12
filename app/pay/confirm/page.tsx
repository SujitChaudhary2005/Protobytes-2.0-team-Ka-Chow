"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useWallet } from "@/contexts/wallet-context";
import { useNetwork } from "@/hooks/use-network";
import { verifySignature } from "@/lib/crypto";
import { queueTransaction } from "@/lib/db";
import { saveTransaction as saveLocalTransaction } from "@/lib/storage";
import { VerificationPanel } from "@/components/verification-panel";
import type { QRPayload, OfflineQRPayload } from "@/types";
import { Shield, Wifi, WifiOff, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

function ConfirmContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { wallet, addTransaction, updateBalance } = useWallet();
    const { online } = useNetwork();

    const [payload, setPayload] = useState<QRPayload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [verified, setVerified] = useState<boolean | null>(null);

    useEffect(() => {
        const data = searchParams.get("data");
        if (!data) {
            setError("No payment data received");
            return;
        }
        try {
            const parsed = JSON.parse(decodeURIComponent(data)) as QRPayload;

            // Check QR expiry (1 hour)
            if (parsed.expiresAt) {
                const expiresAt = new Date(parsed.expiresAt).getTime();
                if (Date.now() > expiresAt) {
                    setError("This QR code has expired. Please request a new one.");
                    return;
                }
            }

            setPayload(parsed);
            // Auto-verify offline payloads
            if (parsed.type === "offline" && (parsed as OfflineQRPayload).signature) {
                const offlinePayload = parsed as OfflineQRPayload;
                try {
                    const isValid = verifySignature(offlinePayload, offlinePayload.signature, offlinePayload.publicKey);
                    setVerified(isValid);
                } catch {
                    setVerified(false);
                }
            }
        } catch {
            setError("Invalid payment data");
        }
    }, [searchParams]);

    const handlePay = async () => {
        if (!payload || !wallet) return;
        setProcessing(true);
        setError(null);

        try {
            if (online) {
                // Online settlement
                const res = await fetch("/api/transactions/settle", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        payerUpa: wallet.address,
                        payload,
                    }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || "Settlement failed");

                const txId = result.transaction?.txId || result.txId || `UPA-${Date.now()}`;

                // Deduct balance and record transaction locally
                updateBalance(payload.amount);
                const intentLabel = typeof payload.intent === "string" ? payload.intent : payload.intent.label || payload.intent.id;
                addTransaction({
                    id: txId,
                    tx_id: txId,
                    recipient: payload.upa,
                    recipientName: payload.upa,
                    amount: payload.amount,
                    intent: intentLabel,
                    intentCategory: typeof payload.intent === "string" ? "" : payload.intent.category,
                    metadata: payload.metadata,
                    status: "settled",
                    mode: "online",
                    nonce: payload.nonce,
                    timestamp: Date.now(),
                    settledAt: Date.now(),
                    walletProvider: "upa_pay",
                });
                // Also save to localStorage for admin/dashboard
                saveLocalTransaction({
                    id: txId,
                    recipient: payload.upa,
                    recipientName: payload.upa,
                    amount: payload.amount,
                    intent: intentLabel,
                    metadata: payload.metadata,
                    status: "settled",
                    mode: "online",
                    nonce: payload.nonce,
                    timestamp: Date.now(),
                    walletProvider: "upa_pay",
                });

                router.push(
                    `/pay/success?txId=${txId}&amount=${payload.amount}&intent=${encodeURIComponent(intentLabel)}&recipient=${encodeURIComponent(payload.upa)}`
                );
            } else {
                // Offline queue
                const offlinePayload = payload as OfflineQRPayload;
                await queueTransaction({
                    payload: JSON.stringify(payload),
                    signature: offlinePayload.signature || "",
                    publicKey: offlinePayload.publicKey || "",
                    nonce: offlinePayload.nonce || `nonce_${Date.now()}`,
                    recipient: payload.upa,
                    amount: payload.amount,
                    intent: typeof payload.intent === "string" ? payload.intent : payload.intent.label || payload.intent.id,
                    metadata: payload.metadata,
                    timestamp: Date.now(),
                });

                // Deduct balance and record as queued
                updateBalance(payload.amount);
                const intentLabel = typeof payload.intent === "string" ? payload.intent : payload.intent.label || payload.intent.id;
                addTransaction({
                    id: `queued_${Date.now()}`,
                    recipient: payload.upa,
                    recipientName: payload.upa,
                    amount: payload.amount,
                    intent: intentLabel,
                    intentCategory: typeof payload.intent === "string" ? "" : payload.intent.category,
                    metadata: payload.metadata,
                    status: "queued",
                    mode: "offline",
                    nonce: offlinePayload.nonce,
                    timestamp: Date.now(),
                    walletProvider: "upa_pay",
                });
                saveLocalTransaction({
                    id: `queued_${Date.now()}`,
                    recipient: payload.upa,
                    recipientName: payload.upa,
                    amount: payload.amount,
                    intent: intentLabel,
                    metadata: payload.metadata,
                    status: "queued",
                    mode: "offline",
                    nonce: offlinePayload.nonce,
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

    if (error && !payload) {
        return (
            <div className="p-4 md:p-6">
                <Card className="border-danger/50">
                    <CardContent className="p-6 text-center space-y-4">
                        <AlertTriangle className="h-10 w-10 text-danger mx-auto" />
                        <p className="text-danger">{error}</p>
                        <Button variant="outline" onClick={() => router.push("/pay/scan")}>
                            Try Again
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!payload) {
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
                    Review and confirm this transaction
                </p>
            </div>

            {/* Connection Status */}
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                online
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning"
            }`}>
                {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                {online ? "Online — will settle instantly" : "Offline — will queue for later"}
            </div>

            {/* Payment Details */}
            <Card>
                <CardHeader>
                    <CardTitle>Payment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Recipient</span>
                        <span className="font-mono text-sm">{payload.upa}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="text-2xl font-bold">NPR {payload.amount}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Intent</span>
                        <span className="capitalize">{payload.intent.label || payload.intent.id}</span>
                    </div>
                    {payload.payer_name && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Payer Name</span>
                            <span>{payload.payer_name}</span>
                        </div>
                    )}
                    {payload.payer_id && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Payer ID</span>
                            <span>{payload.payer_id}</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Mode</span>
                        <span className="capitalize flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            {payload.type}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Verification Panel for Offline Payloads */}
            {payload.type === "offline" && (
                <VerificationPanel
                    signature={(payload as OfflineQRPayload).signature}
                    publicKey={(payload as OfflineQRPayload).publicKey}
                    nonce={payload.nonce}
                    timestamp={Date.parse(payload.issuedAt)}
                    verified={verified ?? false}
                />
            )}

            {/* Error */}
            {error && (
                <Card className="border-danger/50 bg-danger/5">
                    <CardContent className="p-4 text-sm text-danger">
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
                    disabled={processing || (payload.type === "offline" && verified === false)}
                >
                    {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {online ? "Pay Now" : "Queue Payment"}
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

