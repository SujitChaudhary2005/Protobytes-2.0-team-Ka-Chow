"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRCodeDisplay } from "@/components/qr-code";
import {
    verifyPaymentRequest,
    createSignedReceipt,
    encodeForQR,
    decodeFromQR,
    isPaymentRequest,
    type SignedPaymentRequest,
    type SignedPaymentReceipt,
} from "@/lib/offline-handshake";
import {
    Smartphone,
    QrCode,
    Shield,
    CheckCircle2,
    AlertCircle,
    Loader2,
    ArrowRight,
    WifiOff,
    Store,
    Copy,
    Camera,
    Wallet,
    Radio,
    X,
} from "lucide-react";
import { toast } from "sonner";

/* ================================================================
   CUSTOMER — NFC Offline Demo
   ================================================================
   Receives payment request via NFC tap or QR scan.
   Verifies Ed25519 signature locally (no server).
   Counter-signs with own Ed25519 key.
   Returns receipt via NFC tap or QR display.
   ================================================================ */

type Step = "idle" | "received" | "approved" | "complete";
type Transport = "nfc" | "qr";

export default function CustomerNFCDemo() {
    const [step, setStep] = useState<Step>("idle");
    const [transport, setTransport] = useState<Transport>("qr");
    const [nfcSupported, setNfcSupported] = useState(false);
    const [request, setRequest] = useState<SignedPaymentRequest | null>(null);
    const [receipt, setReceipt] = useState<SignedPaymentReceipt | null>(null);
    const [receiptQR, setReceiptQR] = useState("");
    const [approving, setApproving] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [nfcListening, setNfcListening] = useState(false);
    const [mounted, setMounted] = useState(false);
    const nfcAbort = useRef<AbortController | null>(null);
    const scannerRef = useRef<any>(null);

    // Mock SaralPay balance for demo
    const [saralPayBalance, setSaralPayBalance] = useState(5000);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined" && "NDEFReader" in window) {
            setNfcSupported(true);
            setTransport("nfc");
        }
    }, []);

    // ── NFC Listen: Wait for merchant's payment request tap ────
    const startNFCListen = async () => {
        if (!("NDEFReader" in window)) return;
        setNfcListening(true);
        try {
            const ndef = new (window as any).NDEFReader();
            nfcAbort.current = new AbortController();
            await ndef.scan({ signal: nfcAbort.current.signal });
            toast.success("NFC listening — tap merchant's phone");
            ndef.onreading = (event: any) => {
                for (const record of event.message.records) {
                    if (record.recordType === "text") {
                        const decoder = new TextDecoder();
                        const data = decoder.decode(record.data);
                        processRequest(data);
                    }
                }
            };
        } catch (err: any) {
            if (err.name !== "AbortError") {
                toast.error("NFC failed — use QR scanner");
                setTransport("qr");
                setNfcListening(false);
            }
        }
    };

    // ── QR Scanner: Scan merchant's payment request QR ─────────
    const startQRScanner = useCallback(async () => {
        setShowScanner(true);
        try {
            const { Html5Qrcode } = await import("html5-qrcode");
            const scanner = new Html5Qrcode("customer-qr-reader");
            scannerRef.current = scanner;
            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 280, height: 280 } },
                (decodedText: string) => {
                    processRequest(decodedText);
                    scanner.stop().catch(() => {});
                    setShowScanner(false);
                },
                () => {}
            );
        } catch {
            toast.error("Camera access required to scan QR");
            setShowScanner(false);
        }
    }, []);

    // ── Process incoming request (from NFC or QR) ──────────────
    const processRequest = (data: string) => {
        try {
            const decoded = decodeFromQR(data);
            if (!decoded || !isPaymentRequest(decoded)) {
                toast.error("Invalid QR — not a UPA payment request");
                return;
            }
            const typedRequest = decoded as SignedPaymentRequest;

            // Verify Ed25519 signature LOCALLY (no server)
            const verification = verifyPaymentRequest(typedRequest);
            if (!verification.valid) {
                toast.error(`Signature verification failed: ${verification.error}`);
                return;
            }

            setRequest(typedRequest);
            setStep("received");
            setNfcListening(false);
            nfcAbort.current?.abort();
            toast.success("Payment request verified — Ed25519 signature valid!");
        } catch {
            toast.error("Failed to process payment request");
        }
    };

    // ── Approve & counter-sign ─────────────────────────────────
    const handleApprove = async () => {
        if (!request) return;

        // Check balance
        if (request.amount > saralPayBalance) {
            toast.error(`Insufficient SaralPay balance (NPR ${saralPayBalance.toLocaleString()})`);
            return;
        }

        setApproving(true);
        try {
            const { signature, ...requestWithoutSig } = request;

            const signedReceipt = await createSignedReceipt({
                originalRequest: requestWithoutSig,
                merchantSignature: signature,
                payerUPA: "anita@upa.np",
                payerName: "Anita Gurung",
            });

            setReceipt(signedReceipt);
            const payload = encodeForQR(signedReceipt);
            setReceiptQR(payload);
            setStep("approved");

            // Deduct from SaralPay balance
            setSaralPayBalance((prev) => prev - request.amount);

            if (transport === "nfc") {
                startNFCWriteReceipt(payload);
            }

            toast.success("Receipt signed — show to merchant");
        } catch (err) {
            toast.error("Failed to create receipt");
            console.error(err);
        } finally {
            setApproving(false);
        }
    };

    // ── NFC Write: Push receipt back to merchant ───────────────
    const startNFCWriteReceipt = async (payload: string) => {
        if (!("NDEFReader" in window)) return;
        try {
            const ndef = new (window as any).NDEFReader();
            nfcAbort.current = new AbortController();
            await ndef.write(
                { records: [{ recordType: "text", data: payload }] },
                { signal: nfcAbort.current.signal }
            );
            toast.success("Tap merchant's phone to send receipt");
        } catch (err: any) {
            if (err.name !== "AbortError") {
                toast.error("NFC write failed — merchant can scan QR instead");
                setTransport("qr");
            }
        }
    };

    // ── Decline ────────────────────────────────────────────────
    const handleDecline = () => {
        setRequest(null);
        setStep("idle");
        toast.info("Payment declined");
    };

    // Mark complete after merchant scans
    const handleComplete = () => {
        setStep("complete");
    };

    // Cleanup
    useEffect(() => {
        return () => {
            nfcAbort.current?.abort();
            scannerRef.current?.stop?.().catch(() => {});
        };
    }, []);

    if (!mounted) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 md:p-6">
            <div className="max-w-md mx-auto space-y-5">
                {/* Header */}
                <div className="text-center pt-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 rounded-full mb-3">
                        <WifiOff className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">Offline Mode</span>
                    </div>
                    <h1 className="text-xl font-bold">Customer Wallet</h1>
                    <p className="text-sm text-muted-foreground mt-1">NFC + Ed25519 Offline Payment</p>
                </div>

                {/* SaralPay Balance */}
                <Card className="border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-blue-100">SaralPay Offline Wallet</p>
                                <p className="text-2xl font-bold mt-1">NPR {saralPayBalance.toLocaleString()}</p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                                <Wallet className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-blue-100">
                            <Shield className="h-3 w-3" />
                            <span>Pre-funded for offline spending</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Transport selector */}
                <Card>
                    <CardContent className="p-3">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setTransport("nfc")}
                                disabled={!nfcSupported}
                                className={`flex-1 flex items-center justify-center gap-2 rounded-lg p-2.5 text-sm font-medium transition-all ${
                                    transport === "nfc"
                                        ? "bg-blue-500 text-white shadow-md"
                                        : nfcSupported
                                        ? "bg-muted hover:bg-muted/80"
                                        : "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                                }`}
                            >
                                <Radio className="h-4 w-4" />
                                NFC Tap
                            </button>
                            <button
                                onClick={() => setTransport("qr")}
                                className={`flex-1 flex items-center justify-center gap-2 rounded-lg p-2.5 text-sm font-medium transition-all ${
                                    transport === "qr"
                                        ? "bg-blue-500 text-white shadow-md"
                                        : "bg-muted hover:bg-muted/80"
                                }`}
                            >
                                <QrCode className="h-4 w-4" />
                                QR Code
                            </button>
                        </div>
                        {!nfcSupported && (
                            <p className="text-[10px] text-muted-foreground text-center mt-2">
                                NFC not available on this device/browser. Using QR mode.
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-2 text-xs">
                    {(["idle", "received", "approved"] as const).map((s, i) => {
                        const stepOrder: Record<Step, number> = { idle: 0, received: 1, approved: 2, complete: 3 };
                        const currentIdx = stepOrder[step];
                        const isActive = step === s;
                        const isDone = currentIdx > i;
                        return (
                        <div key={s} className="flex items-center gap-1.5">
                            <div
                                className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    isActive
                                        ? "bg-blue-500 text-white"
                                        : isDone
                                        ? "bg-green-500 text-white"
                                        : "bg-muted text-muted-foreground"
                                }`}
                            >
                                {isDone ? "✓" : i + 1}
                            </div>
                            <span className="hidden sm:inline text-muted-foreground">
                                {s === "idle" ? "Receive" : s === "received" ? "Verify" : "Pay"}
                            </span>
                            {i < 2 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        );
                    })}
                </div>

                {/* ══ Step 1: Idle — Wait for payment request ══ */}
                {step === "idle" && (
                    <Card className="border-blue-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Smartphone className="h-4 w-4 text-blue-600" />
                                Receive Payment Request
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {transport === "nfc" ? (
                                <div className="text-center space-y-4 py-4">
                                    {nfcListening ? (
                                        <>
                                            <div className="relative mx-auto w-24 h-24">
                                                <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-30" />
                                                <div className="absolute inset-2 bg-blue-300 rounded-full animate-ping opacity-20" style={{ animationDelay: "150ms" }} />
                                                <div className="relative h-24 w-24 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <Radio className="h-10 w-10 text-blue-600" />
                                                </div>
                                            </div>
                                            <p className="text-sm font-medium">Listening for NFC...</p>
                                            <p className="text-xs text-muted-foreground">Hold your phone near the merchant&apos;s device</p>
                                            <Button variant="outline" size="sm" onClick={() => { nfcAbort.current?.abort(); setNfcListening(false); }}>
                                                Cancel
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="h-24 w-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                                                <Radio className="h-10 w-10 text-blue-600" />
                                            </div>
                                            <Button className="bg-blue-500 hover:bg-blue-600" onClick={startNFCListen}>
                                                Start NFC Listening
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => setTransport("qr")} className="text-xs">
                                                Or scan QR code instead
                                            </Button>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="text-center py-2">
                                        <Camera className="h-12 w-12 text-blue-400 mx-auto mb-2" />
                                        <p className="text-sm font-medium">Scan merchant&apos;s payment QR code</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            The merchant shows a QR code with a signed payment request
                                        </p>
                                    </div>
                                    {!showScanner ? (
                                        <Button className="w-full h-12 bg-blue-500 hover:bg-blue-600" onClick={startQRScanner}>
                                            <Camera className="h-4 w-4 mr-2" />
                                            Open Camera to Scan
                                        </Button>
                                    ) : (
                                        <div className="space-y-2">
                                            <div id="customer-qr-reader" className="rounded-lg overflow-hidden" />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full"
                                                onClick={() => {
                                                    scannerRef.current?.stop?.().catch(() => {});
                                                    setShowScanner(false);
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* ══ Step 2: Received — Verify & Approve ══ */}
                {step === "received" && request && (
                    <Card className="border-blue-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Shield className="h-4 w-4 text-green-600" />
                                Payment Request Verified
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Verification badge */}
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 border border-green-200">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="text-xs font-medium text-green-800">
                                    Ed25519 signature verified locally — no server needed
                                </span>
                            </div>

                            {/* Payment details */}
                            <div className="text-center p-5 bg-blue-50 rounded-xl">
                                <p className="text-xs text-muted-foreground">Amount Requested</p>
                                <p className="text-4xl font-bold text-blue-700 mt-1">NPR {request.amount.toLocaleString()}</p>
                                <p className="text-sm text-muted-foreground mt-1">{request.intent}</p>
                            </div>

                            {/* Merchant info */}
                            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Store className="h-4 w-4 text-orange-600" />
                                    <span className="text-sm font-medium">{request.merchantName}</span>
                                </div>
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <p>UPA: <span className="font-mono">{request.merchantUPA}</span></p>
                                    <p>PubKey: <span className="font-mono">{request.merchantPubKey.slice(0, 20)}...</span></p>
                                    <p>Nonce: <span className="font-mono">{request.nonce.slice(0, 16)}...</span></p>
                                </div>
                            </div>

                            {/* Balance check */}
                            <div className={`flex items-center gap-2 p-3 rounded-lg text-xs ${
                                request.amount <= saralPayBalance
                                    ? "bg-green-50 text-green-800 border border-green-200"
                                    : "bg-red-50 text-red-800 border border-red-200"
                            }`}>
                                <Wallet className="h-4 w-4 shrink-0" />
                                <span>
                                    SaralPay Balance: NPR {saralPayBalance.toLocaleString()}
                                    {request.amount <= saralPayBalance
                                        ? " — Sufficient funds"
                                        : " — Insufficient funds!"}
                                </span>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                                    onClick={handleDecline}
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Decline
                                </Button>
                                <Button
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                    onClick={handleApprove}
                                    disabled={approving || request.amount > saralPayBalance}
                                >
                                    {approving ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing...</>
                                    ) : (
                                        <><CheckCircle2 className="h-4 w-4 mr-2" /> Approve &amp; Sign</>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ══ Step 3: Approved — Show receipt QR / NFC ══ */}
                {step === "approved" && receipt && (
                    <>
                        <Card className="border-green-200 bg-green-50/30">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    {transport === "nfc" ? (
                                        <><Radio className="h-4 w-4 text-green-600" /> Tap Merchant&apos;s Phone</>
                                    ) : (
                                        <><QrCode className="h-4 w-4 text-green-600" /> Merchant Scans This Receipt</>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-center p-3 bg-green-100 rounded-xl">
                                    <p className="text-xs text-green-700">Payment Approved</p>
                                    <p className="text-2xl font-bold text-green-800">NPR {receipt.originalRequest.amount.toLocaleString()}</p>
                                    <p className="text-xs text-green-600 mt-1">→ {receipt.originalRequest.merchantName}</p>
                                </div>

                                {transport === "nfc" ? (
                                    <div className="text-center space-y-3 py-4">
                                        <div className="relative mx-auto w-24 h-24">
                                            <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-30" />
                                            <div className="relative h-24 w-24 bg-green-100 rounded-full flex items-center justify-center">
                                                <Radio className="h-10 w-10 text-green-600" />
                                            </div>
                                        </div>
                                        <p className="text-sm font-medium">Tap merchant&apos;s phone to send receipt</p>
                                        <Button variant="outline" size="sm" onClick={() => setTransport("qr")} className="text-xs">
                                            Show QR code instead
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex justify-center">
                                        <div className="bg-white p-3 rounded-xl shadow-sm border border-green-200">
                                            <QRCodeDisplay value={receiptQR} size={240} />
                                        </div>
                                    </div>
                                )}

                                {/* Dual signatures */}
                                <div className="bg-white rounded-lg p-3 border border-green-200 space-y-2">
                                    <h4 className="text-xs font-semibold text-green-800">Dual Ed25519 Signatures</h4>
                                    <div className="flex items-center gap-2 text-[10px]">
                                        <Store className="h-3 w-3 text-orange-600 shrink-0" />
                                        <span className="text-muted-foreground">Merchant:</span>
                                        <span className="font-mono truncate">{receipt.merchantSignature.slice(0, 24)}...</span>
                                        <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px]">
                                        <Smartphone className="h-3 w-3 text-blue-600 shrink-0" />
                                        <span className="text-muted-foreground">Customer:</span>
                                        <span className="font-mono truncate">{receipt.payerSignature.slice(0, 24)}...</span>
                                        <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                                    </div>
                                </div>

                                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleComplete}>
                                    Done — Merchant Received Receipt
                                </Button>
                            </CardContent>
                        </Card>
                    </>
                )}

                {/* ══ Step 4: Complete ══ */}
                {step === "complete" && receipt && (
                    <Card className="border-green-200 bg-green-50/30">
                        <CardContent className="p-6 space-y-5">
                            <div className="text-center">
                                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-3">
                                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                                </div>
                                <h2 className="text-lg font-bold text-green-900">Payment Complete!</h2>
                                <p className="text-sm text-green-700 mt-1">Offline transaction recorded</p>
                            </div>

                            <div className="text-center p-4 bg-white rounded-xl border border-green-200">
                                <p className="text-xs text-muted-foreground">Amount Paid</p>
                                <p className="text-3xl font-bold text-green-700">
                                    NPR {receipt.originalRequest.amount.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    → {receipt.originalRequest.merchantName}
                                </p>
                            </div>

                            <div className="bg-white rounded-lg p-3 border border-green-100">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <p className="text-muted-foreground">New Balance</p>
                                        <p className="font-bold text-blue-700">NPR {saralPayBalance.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Time</p>
                                        <p className="font-medium">{new Date(receipt.approvedAt).toLocaleTimeString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Payer</p>
                                        <p className="font-medium">{receipt.payerName}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Status</p>
                                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">
                                            Queued (offline)
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-100 text-xs text-green-800">
                                <WifiOff className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>
                                    Transaction recorded locally with dual Ed25519 signatures. Will auto-sync when back online.
                                </span>
                            </div>

                            <Button
                                className="w-full bg-blue-500 hover:bg-blue-600"
                                onClick={() => {
                                    setStep("idle");
                                    setRequest(null);
                                    setReceipt(null);
                                    setReceiptQR("");
                                }}
                            >
                                Ready for Next Payment
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}