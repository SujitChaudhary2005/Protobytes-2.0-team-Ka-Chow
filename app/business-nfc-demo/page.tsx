"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QRCodeDisplay } from "@/components/qr-code";
import {
    createSignedPaymentRequest,
    verifyReceipt,
    encodeForQR,
    decodeFromQR,
    isPaymentReceipt,
    type SignedPaymentRequest,
    type SignedPaymentReceipt,
} from "@/lib/offline-handshake";
import {
    Smartphone,
    QrCode,
    Shield,
    CheckCircle2,
    Loader2,
    ArrowRight,
    WifiOff,
    Store,
    Copy,
    Camera,
    Zap,
    Radio,
} from "lucide-react";
import { toast } from "sonner";

/* ================================================================
   MERCHANT — NFC Offline Demo
   ================================================================
   Two transport modes for data exchange:
   1. Web NFC (NDEFReader) — tap phones together (Android Chrome)
   2. QR Code — show/scan QR codes (universal fallback)
   Both use the same Ed25519 offline handshake protocol.
   ================================================================ */

type Step = "setup" | "waiting" | "receipt" | "complete";
type Transport = "nfc" | "qr";

export default function BusinessNFCDemo() {
    const [step, setStep] = useState<Step>("setup");
    const [transport, setTransport] = useState<Transport>("qr");
    const [nfcSupported, setNfcSupported] = useState(false);
    const [amount, setAmount] = useState("250");
    const [intent, setIntent] = useState("Coffee");
    const [signedRequest, setSignedRequest] = useState<SignedPaymentRequest | null>(null);
    const [qrPayload, setQrPayload] = useState("");
    const [receipt, setReceipt] = useState<SignedPaymentReceipt | null>(null);
    const [generating, setGenerating] = useState(false);
    const [nfcListening, setNfcListening] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [mounted, setMounted] = useState(false);
    const nfcAbort = useRef<AbortController | null>(null);
    const scannerRef = useRef<any>(null);

    useEffect(() => {
        setMounted(true);
        // Check Web NFC support
        if (typeof window !== "undefined" && "NDEFReader" in window) {
            setNfcSupported(true);
            setTransport("nfc");
        }
    }, []);

    // ── Step 1: Generate signed payment request ───────────────
    const handleGenerate = async () => {
        const amt = Number(amount);
        if (!amt || amt <= 0) {
            toast.error("Enter a valid amount");
            return;
        }
        setGenerating(true);
        try {
            const req = await createSignedPaymentRequest({
                merchantUPA: "shop@himalayanjava.np",
                merchantName: "Himalayan Java Coffee",
                amount: amt,
                intent: intent || "Payment",
            });
            setSignedRequest(req);
            const payload = encodeForQR(req);
            setQrPayload(payload);
            setStep("waiting");

            if (transport === "nfc") {
                startNFCWrite(payload);
            }
        } catch (err) {
            toast.error("Failed to create payment request");
            console.error(err);
        } finally {
            setGenerating(false);
        }
    };

    // ── NFC Write: Push payment request when customer taps ─────
    const startNFCWrite = async (payload: string) => {
        if (!("NDEFReader" in window)) return;
        try {
            const ndef = new (window as any).NDEFReader();
            nfcAbort.current = new AbortController();
            // Write the signed request as an NDEF text record
            await ndef.write(
                { records: [{ recordType: "text", data: payload }] },
                { signal: nfcAbort.current.signal }
            );
            toast.success("NFC ready — ask customer to tap their phone");
            // After writing, start listening for the receipt
            startNFCRead();
        } catch (err: any) {
            if (err.name !== "AbortError") {
                toast.error("NFC write failed — use QR fallback");
                setTransport("qr");
            }
        }
    };

    // ── NFC Read: Listen for customer's receipt tap ────────────
    const startNFCRead = async () => {
        if (!("NDEFReader" in window)) return;
        setNfcListening(true);
        try {
            const ndef = new (window as any).NDEFReader();
            nfcAbort.current = new AbortController();
            await ndef.scan({ signal: nfcAbort.current.signal });
            ndef.onreading = (event: any) => {
                for (const record of event.message.records) {
                    if (record.recordType === "text") {
                        const decoder = new TextDecoder();
                        const data = decoder.decode(record.data);
                        processReceipt(data);
                    }
                }
            };
        } catch (err: any) {
            if (err.name !== "AbortError") {
                setNfcListening(false);
            }
        }
    };

    // ── QR Scanner: Scan customer's receipt QR ─────────────────
    const startQRScanner = useCallback(async () => {
        setShowScanner(true);
        try {
            const { Html5Qrcode } = await import("html5-qrcode");
            const scanner = new Html5Qrcode("merchant-qr-reader");
            scannerRef.current = scanner;
            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 280, height: 280 } },
                (decodedText: string) => {
                    processReceipt(decodedText);
                    scanner.stop().catch(() => {});
                    setShowScanner(false);
                },
                () => {}
            );
        } catch {
            toast.error("Camera access required to scan receipt QR");
            setShowScanner(false);
        }
    }, []);

    // ── Process incoming receipt (from NFC or QR) ──────────────
    const processReceipt = (data: string) => {
        try {
            const decoded = decodeFromQR(data);
            if (!decoded || !isPaymentReceipt(decoded)) {
                toast.error("Invalid receipt — not a UPA payment receipt");
                return;
            }
            const typedReceipt = decoded as SignedPaymentReceipt;
            const verification = verifyReceipt(typedReceipt);
            if (!verification.valid) {
                toast.error(`Receipt verification failed: ${verification.error}`);
                return;
            }
            setReceipt(typedReceipt);
            setStep("complete");
            setNfcListening(false);
            nfcAbort.current?.abort();
            toast.success("Payment verified with dual Ed25519 signatures!");
        } catch {
            toast.error("Failed to process receipt");
        }
    };

    // Cleanup on unmount
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
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4 md:p-6">
            <div className="max-w-md mx-auto space-y-5">
                {/* Header */}
                <div className="text-center pt-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-100 rounded-full mb-3">
                        <WifiOff className="h-3.5 w-3.5 text-orange-600" />
                        <span className="text-xs font-medium text-orange-700">Offline Mode</span>
                    </div>
                    <h1 className="text-xl font-bold">Merchant Terminal</h1>
                    <p className="text-sm text-muted-foreground mt-1">NFC + Ed25519 Offline Payment</p>
                </div>

                {/* Transport selector */}
                <Card>
                    <CardContent className="p-3">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setTransport("nfc")}
                                disabled={!nfcSupported}
                                className={`flex-1 flex items-center justify-center gap-2 rounded-lg p-2.5 text-sm font-medium transition-all ${
                                    transport === "nfc"
                                        ? "bg-orange-500 text-white shadow-md"
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
                                        ? "bg-orange-500 text-white shadow-md"
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
                    {(["setup", "waiting", "complete"] as const).map((s, i) => (
                        <div key={s} className="flex items-center gap-1.5">
                            <div
                                className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    step === s || (step === "receipt" && s === "waiting")
                                        ? "bg-orange-500 text-white"
                                        : step === "complete" || (step === "waiting" && i === 0) || (step === "receipt" && i === 0)
                                        ? "bg-green-500 text-white"
                                        : "bg-muted text-muted-foreground"
                                }`}
                            >
                                {step === "complete" || (step === "waiting" && i === 0) || (step === "receipt" && i === 0)
                                    ? "✓"
                                    : i + 1}
                            </div>
                            <span className="hidden sm:inline text-muted-foreground">
                                {s === "setup" ? "Create" : s === "waiting" ? "Send" : "Verify"}
                            </span>
                            {i < 2 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                        </div>
                    ))}
                </div>

                {/* ══ Step 1: Setup ══ */}
                {step === "setup" && (
                    <Card className="border-orange-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Store className="h-4 w-4 text-orange-600" />
                                Create Payment Request
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Amount (NPR)</label>
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="text-lg font-semibold"
                                    placeholder="0"
                                />
                                <div className="flex gap-2 mt-2">
                                    {[100, 250, 500, 1000].map((a) => (
                                        <Button key={a} variant="outline" size="sm" className="text-xs flex-1" onClick={() => setAmount(String(a))}>
                                            {a}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Purpose</label>
                                <Input value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="e.g., Coffee" />
                            </div>
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 text-xs text-orange-800">
                                <Shield className="h-4 w-4 shrink-0" />
                                <span>Payment request will be signed with your Ed25519 private key for cryptographic verification.</span>
                            </div>
                            <Button
                                className="w-full h-12 bg-orange-500 hover:bg-orange-600"
                                onClick={handleGenerate}
                                disabled={generating || !amount}
                            >
                                {generating ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing...</>
                                ) : (
                                    <><Zap className="h-4 w-4 mr-2" /> Generate Signed Request</>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* ══ Step 2: Waiting — Show QR / NFC ══ */}
                {step === "waiting" && signedRequest && (
                    <>
                        <Card className="border-orange-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    {transport === "nfc" ? (
                                        <><Radio className="h-4 w-4 text-orange-600" /> Tap Customer&apos;s Phone</>
                                    ) : (
                                        <><QrCode className="h-4 w-4 text-orange-600" /> Customer Scans This QR</>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Amount display */}
                                <div className="text-center p-4 bg-orange-50 rounded-xl">
                                    <p className="text-xs text-muted-foreground">Amount</p>
                                    <p className="text-3xl font-bold text-orange-700">NPR {Number(amount).toLocaleString()}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{intent}</p>
                                </div>

                                {transport === "nfc" ? (
                                    <div className="text-center space-y-3 py-4">
                                        <div className="relative mx-auto w-24 h-24">
                                            <div className="absolute inset-0 bg-orange-200 rounded-full animate-ping opacity-30" />
                                            <div className="absolute inset-2 bg-orange-300 rounded-full animate-ping opacity-20" style={{ animationDelay: "150ms" }} />
                                            <div className="relative h-24 w-24 bg-orange-100 rounded-full flex items-center justify-center">
                                                <Radio className="h-10 w-10 text-orange-600" />
                                            </div>
                                        </div>
                                        <p className="text-sm font-medium">Hold phones together</p>
                                        <p className="text-xs text-muted-foreground">Customer taps their phone to receive payment request</p>
                                        <Button variant="outline" size="sm" onClick={() => setTransport("qr")} className="text-xs">
                                            Switch to QR Code
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex justify-center">
                                        <div className="bg-white p-3 rounded-xl shadow-sm border">
                                            <QRCodeDisplay value={qrPayload} size={240} />
                                        </div>
                                    </div>
                                )}

                                {/* Signature info */}
                                <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                                    <div className="flex items-center gap-2 text-xs">
                                        <Shield className="h-3.5 w-3.5 text-green-600" />
                                        <span className="font-medium text-green-700">Ed25519 Signed</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                                        <span>Sig:</span>
                                        <span className="truncate">{signedRequest.signature.slice(0, 32)}...</span>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(signedRequest.signature); toast.success("Copied"); }}
                                            className="shrink-0"
                                        >
                                            <Copy className="h-3 w-3" />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        PubKey: {signedRequest.merchantPubKey.slice(0, 16)}...
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Receive receipt */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Camera className="h-4 w-4" />
                                    Step 2: Receive Customer Receipt
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {transport === "nfc" && nfcListening ? (
                                    <div className="text-center py-4">
                                        <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto mb-2" />
                                        <p className="text-sm">Waiting for customer&apos;s NFC receipt tap...</p>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-xs text-muted-foreground">
                                            After the customer approves, {transport === "nfc" ? "they'll tap back" : "scan their receipt QR"}:
                                        </p>
                                        {!showScanner ? (
                                            <Button variant="outline" className="w-full" onClick={startQRScanner}>
                                                <Camera className="h-4 w-4 mr-2" />
                                                Scan Receipt QR
                                            </Button>
                                        ) : (
                                            <div className="space-y-2">
                                                <div id="merchant-qr-reader" className="rounded-lg overflow-hidden" />
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
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Button variant="ghost" size="sm" className="w-full" onClick={() => { setStep("setup"); setSignedRequest(null); }}>
                            ← Start Over
                        </Button>
                    </>
                )}

                {/* ══ Step 3: Complete ══ */}
                {step === "complete" && receipt && (
                    <Card className="border-green-200 bg-green-50/30">
                        <CardContent className="p-6 space-y-5">
                            <div className="text-center">
                                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-3">
                                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                                </div>
                                <h2 className="text-lg font-bold text-green-900">Payment Verified!</h2>
                                <p className="text-sm text-green-700 mt-1">Dual Ed25519 signatures confirmed</p>
                            </div>

                            <div className="text-center p-4 bg-white rounded-xl border border-green-200">
                                <p className="text-xs text-muted-foreground">Amount Received</p>
                                <p className="text-3xl font-bold text-green-700">
                                    NPR {receipt.originalRequest.amount.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">{receipt.originalRequest.intent}</p>
                            </div>

                            {/* Proof */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-semibold text-green-800 uppercase tracking-wider">Cryptographic Proof</h3>

                                {/* Merchant Signature */}
                                <div className="bg-white rounded-lg p-3 border border-green-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Store className="h-3.5 w-3.5 text-orange-600" />
                                        <span className="text-xs font-medium">Merchant Signature</span>
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 ml-auto" />
                                    </div>
                                    <p className="text-[10px] font-mono text-muted-foreground break-all">
                                        {receipt.merchantSignature.slice(0, 48)}...
                                    </p>
                                </div>

                                {/* Customer Signature */}
                                <div className="bg-white rounded-lg p-3 border border-green-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Smartphone className="h-3.5 w-3.5 text-blue-600" />
                                        <span className="text-xs font-medium">Customer Signature</span>
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 ml-auto" />
                                    </div>
                                    <p className="text-[10px] font-mono text-muted-foreground break-all">
                                        {receipt.payerSignature.slice(0, 48)}...
                                    </p>
                                </div>

                                {/* Payer info */}
                                <div className="bg-white rounded-lg p-3 border border-green-100">
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <p className="text-muted-foreground">Payer</p>
                                            <p className="font-medium">{receipt.payerName}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">UPA</p>
                                            <p className="font-medium font-mono text-[11px]">{receipt.payerUPA}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Time</p>
                                            <p className="font-medium">{new Date(receipt.approvedAt).toLocaleTimeString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Status</p>
                                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">
                                                Queued (offline)
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-100 text-xs text-green-800">
                                <WifiOff className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>
                                    Transaction recorded locally. Will auto-sync to the central ledger when back online via service worker.
                                </span>
                            </div>

                            <Button
                                className="w-full bg-orange-500 hover:bg-orange-600"
                                onClick={() => {
                                    setStep("setup");
                                    setSignedRequest(null);
                                    setReceipt(null);
                                    setQrPayload("");
                                }}
                            >
                                New Payment
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}