"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@/contexts/wallet-context";
import { NetworkStatus } from "@/components/network-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { verifySignature, createSignedPaymentRequest } from "@/lib/crypto";
import { queueTransaction, getQueuedTransactions } from "@/lib/db";
import { submitTransaction, syncQueuedTransactions } from "@/lib/storage";
import { useNetwork } from "@/hooks/use-network";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft,
    Building2,
    CheckCircle2,
    Lock,
    AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { VerificationPanel } from "@/components/verification-panel";

export default function ConfirmPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { wallet, updateBalance, addTransaction } = useWallet();
    const { online } = useNetwork();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [paymentData, setPaymentData] = useState<{
        recipient: string;
        recipientName: string;
        amount: number;
        intent: string;
        metadata?: Record<string, string>;
        signature?: string;
        publicKey?: string;
    } | null>(null);
    const [signatureVerified, setSignatureVerified] = useState(false);
    const [verificationDetails, setVerificationDetails] = useState<{
        signature: string;
        publicKey: string;
        nonce: string;
        timestamp: number;
    } | null>(null);

    useEffect(() => {
        // Parse payment data from URL or QR
        const qrData = searchParams.get("data");
        const qr = searchParams.get("qr");
        const recipient = searchParams.get("recipient");

        if (qrData) {
            try {
                const parsed = JSON.parse(decodeURIComponent(qrData));
                setPaymentData(parsed);
                if (parsed.signature && parsed.publicKey) {
                    verifyPaymentSignature(parsed);
                }
            } catch (err) {
                console.error("Parse error:", err);
                toast({
                    variant: "destructive",
                    title: "Invalid QR Code",
                    description: "Could not parse payment data",
                });
                router.push("/pay");
            }
        } else if (recipient) {
            // Manual entry - create basic payment
            setPaymentData({
                recipient: decodeURIComponent(recipient),
                recipientName: "Recipient",
                amount: 0,
                intent: "Payment",
            });
        }
    }, [searchParams, router, toast]);

    const verifyPaymentSignature = async (data: any) => {
        if (!data.signature || !data.publicKey) return;

        try {
            const payload = JSON.stringify({
                recipient: data.recipient,
                amount: data.amount,
                intent: data.intent,
                metadata: data.metadata,
                timestamp: data.timestamp,
                nonce: data.nonce,
            });

            const verified = await verifySignature(
                payload,
                data.signature,
                data.publicKey
            );
            setSignatureVerified(verified);
            setVerificationDetails({
                signature: data.signature,
                publicKey: data.publicKey,
                nonce: data.nonce || "",
                timestamp: data.timestamp || Date.now(),
            });
        } catch (err) {
            console.error("Verification error:", err);
            setSignatureVerified(false);
        }
    };

    const handleConfirm = async () => {
        if (!paymentData || !wallet) return;

        setLoading(true);

        try {
            // Get private key from wallet (in production, use secure storage)
            const privateKeyHex = localStorage.getItem("upa_private_key") || "";
            if (!privateKeyHex) {
                throw new Error("Wallet not initialized");
            }
            const privateKey = new Uint8Array(
                privateKeyHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
            );

            if (privateKey.length === 0) {
                throw new Error("Wallet not initialized");
            }

            const signedRequest = await createSignedPaymentRequest(
                {
                    recipient: paymentData.recipient,
                    amount: paymentData.amount,
                    intent: paymentData.intent,
                    metadata: paymentData.metadata,
                },
                privateKey
            );

            if (online) {
                // Online: Submit directly
                await submitTransaction(signedRequest);
                updateBalance(paymentData.amount);
                addTransaction({
                    id: `tx_${Date.now()}`,
                    recipient: paymentData.recipient,
                    recipientName: paymentData.recipientName,
                    amount: paymentData.amount,
                    intent: paymentData.intent,
                    metadata: paymentData.metadata,
                    status: "settled",
                    timestamp: Date.now(),
                });

                router.push(`/pay/success?amount=${paymentData.amount}&intent=${encodeURIComponent(paymentData.intent)}`);
            } else {
                // Offline: Queue for sync
                await queueTransaction({
                    ...signedRequest,
                    recipient: paymentData.recipient,
                    amount: paymentData.amount,
                    intent: paymentData.intent,
                    metadata: paymentData.metadata,
                });

                router.push(`/pay/queued?amount=${paymentData.amount}`);
            }
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Payment Failed",
                description: err.message || "An error occurred",
            });
        } finally {
            setLoading(false);
        }
    };

    if (!paymentData) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <p>Loading payment details...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-10 border-b border-border bg-surface">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/pay">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <h1 className="text-xl font-semibold">Confirm Payment</h1>
                    <div className="w-10" />
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 space-y-6">
                {/* Recipient Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Paying to:</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Building2 className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <p className="font-medium">{paymentData.recipientName}</p>
                                <p className="text-sm text-muted-foreground">
                                    {paymentData.recipient}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Intent Details */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Intent: {paymentData.intent}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {paymentData.metadata &&
                            Object.entries(paymentData.metadata).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                    <span className="text-sm text-muted-foreground capitalize">
                                        {key.replace(/_/g, " ")}:
                                    </span>
                                    <span className="text-sm font-medium">{value}</span>
                                </div>
                            ))}
                    </CardContent>
                </Card>

                {/* Amount */}
                <Card>
                    <CardContent className="p-6">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-2">Amount</p>
                            <p className="text-4xl font-bold">
                                {formatCurrency(paymentData.amount)}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Cryptographic Verification Panel */}
                {paymentData.signature && verificationDetails && (
                    <VerificationPanel
                        signature={verificationDetails.signature}
                        publicKey={verificationDetails.publicKey}
                        nonce={verificationDetails.nonce}
                        timestamp={verificationDetails.timestamp}
                        verified={signatureVerified}
                    />
                )}

                {/* Simple Signature Status (fallback) */}
                {paymentData.signature && !verificationDetails && (
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                                {signatureVerified ? (
                                    <>
                                        <CheckCircle2 className="h-5 w-5 text-accent" />
                                        <span className="text-sm font-medium text-accent">
                                            Signature Verified
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="h-5 w-5 text-warning" />
                                        <span className="text-sm font-medium text-warning">
                                            Signature Verification Failed
                                        </span>
                                    </>
                                )}
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <Lock className="h-3 w-3" />
                                <span>Intent Locked — Cannot be altered after payment</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Network Status */}
                <div className="flex items-center justify-center">
                    <NetworkStatus />
                </div>

                {/* Actions */}
                <div className="space-y-2">
                    <Button
                        className="w-full h-12"
                        onClick={handleConfirm}
                        disabled={loading || (!online && !signatureVerified)}
                    >
                        {loading ? "Processing..." : "Confirm Payment"}
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => router.back()}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                </div>
            </main>
        </div>
    );
}

