"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Smartphone,
    CheckCircle2,
    XCircle,
    Shield,
    Fingerprint,
    Camera,
    QrCode,
    Loader2,
    ArrowRight,
    ArrowLeft,
    WifiOff,
    Zap,
    Lock,
    ShieldCheck,
    Copy,
    Check,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { useWallet } from "@/contexts/wallet-context";
import { queueTransaction } from "@/lib/db";
import { saveTransaction as saveLocalTransaction } from "@/lib/storage";
import {
    createSignedPaymentRequest,
    verifyPaymentRequest,
    createSignedReceipt,
    verifyReceipt,
    encodeForQR,
    decodeFromQR,
    isPaymentRequest,
    isPaymentReceipt,
    type SignedPaymentRequest,
    type SignedPaymentReceipt,
} from "@/lib/offline-handshake";
import { QRCodeDisplay } from "@/components/qr-code";

// ═══════════════════════════════════════════════════════════════════
//  MERCHANT SIDE: Generate signed QR → Scan receipt QR
// ═══════════════════════════════════════════════════════════════════

type MerchantPhase = "input" | "showing_qr" | "scanning_receipt" | "verifying" | "success" | "error";

interface MerchantOfflineChargeProps {
    businessName: string;
    businessUPA: string;
}

export function MerchantOfflineCharge({ businessName, businessUPA }: MerchantOfflineChargeProps) {
    const { addTransaction, balance, offlineWallet, canSpendOffline } = useWallet();
    const [phase, setPhase] = useState<MerchantPhase>("input");
    const [amount, setAmount] = useState("");
    const [qrData, setQrData] = useState("");
    const [receipt, setReceipt] = useState<SignedPaymentReceipt | null>(null);
    const [error, setError] = useState("");
    const [generating, setGenerating] = useState(false);
    const scannerRef = useRef<any>(null);
    const scannerContainerId = "merchant-offline-scanner";

    // Cleanup scanner on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
                scannerRef.current = null;
            }
        };
    }, []);

    // ── Step 1: Generate signed QR ──────────────────────────────────
    const generateQR = async () => {
        const amt = Number(amount);
        if (!amt || amt <= 0) {
            toast.error("Enter a valid amount");
            return;
        }

        setGenerating(true);
        setError("");

        try {
            const signedRequest = await createSignedPaymentRequest({
                merchantUPA: businessUPA,
                merchantName: businessName,
                amount: amt,
                intent: "Cross-Device NFC Purchase",
            });

            setQrData(encodeForQR(signedRequest));
            setPhase("showing_qr");
            toast.success("Signed payment QR generated!");
        } catch (err: any) {
            setError(err.message || "Failed to generate QR");
            toast.error("Failed to generate QR");
        } finally {
            setGenerating(false);
        }
    };

    // ── Step 2: Start scanning for citizen receipt QR ────────────────
    const startReceiptScan = async () => {
        setPhase("scanning_receipt");
        setError("");

        try {
            // Wait for DOM to render the container
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

            const { Html5Qrcode } = await import("html5-qrcode");

            if (scannerRef.current) {
                try { await scannerRef.current.stop(); } catch {}
            }

            const scanner = new Html5Qrcode(scannerContainerId);
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: "environment" },
                { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                (decodedText) => {
                    handleReceiptScanned(decodedText);
                    scanner.stop().catch(() => {});
                    scannerRef.current = null;
                },
                () => {}
            );
        } catch (err: any) {
            setError(err.message || "Camera failed");
            setPhase("showing_qr");
        }
    };

    // ── Step 3: Verify receipt ───────────────────────────────────────
    const handleReceiptScanned = (data: string) => {
        setPhase("verifying");

        try {
            const decoded = decodeFromQR(data);
            if (!decoded || !isPaymentReceipt(decoded)) {
                setError("Invalid QR — not a payment receipt");
                setPhase("error");
                return;
            }

            const result = verifyReceipt(decoded);
            if (!result.valid) {
                setError(result.error || "Receipt verification failed");
                setPhase("error");
                return;
            }

            // Both signatures verified!
            setReceipt(decoded);
            recordMerchantTransaction(decoded);
            setPhase("success");

            if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
            toast.success("Dual-signature verified! Payment recorded.");
        } catch (err: any) {
            setError(err.message || "Failed to verify receipt");
            setPhase("error");
        }
    };

    // ── Record transaction on merchant side ──────────────────────────
    const recordMerchantTransaction = (rcpt: SignedPaymentReceipt) => {
        const req = rcpt.originalRequest;
        const txId = `UPA-XDEV-M-${String(Date.now()).slice(-6)}`;
        const nonce = req.nonce;

        const txRecord = {
            id: txId,
            tx_id: txId,
            tx_type: "merchant_purchase" as any,
            recipient: businessUPA,
            recipientName: businessName,
            fromUPA: rcpt.payerUPA,
            amount: req.amount,
            intent: "Cross-Device Offline Payment (Received)",
            intentCategory: "purchase",
            metadata: {
                payerName: rcpt.payerName,
                payerUPA: rcpt.payerUPA,
                payerPubKey: rcpt.payerPubKey,
                merchantPubKey: req.merchantPubKey,
                merchantSignature: rcpt.merchantSignature,
                payerSignature: rcpt.payerSignature,
                paymentType: "xdevice_offline",
                mode: "cross-device-offline",
                direction: "incoming",
                dualSigned: "true",
            },
            status: "queued" as const,
            mode: "offline" as const,
            nonce,
            timestamp: Date.now(),
            walletProvider: "upa_pay",
            payment_source: "wallet" as const,
        };

        saveLocalTransaction(txRecord);
        addTransaction(txRecord);

        // Queue for background sync
        queueTransaction({
            payload: JSON.stringify({
                version: "1.0",
                upa: businessUPA,
                intent: { id: "xdevice_purchase", category: "purchase", label: "Cross-Device Offline Payment" },
                tx_type: "merchant_purchase",
                amount: req.amount,
                currency: "NPR",
                metadata: txRecord.metadata,
                payer_name: rcpt.payerName,
                payer_id: rcpt.payerUPA,
                issuedAt: req.issuedAt,
                expiresAt: req.expiresAt,
                nonce,
                type: "offline",
            }),
            signature: rcpt.merchantSignature,
            publicKey: req.merchantPubKey,
            timestamp: Date.now(),
            nonce,
            recipient: businessUPA,
            amount: req.amount,
            intent: "Cross-Device Offline Payment",
            metadata: txRecord.metadata,
        }).catch(() => {});
    };

    const reset = () => {
        setPhase("input");
        setAmount("");
        setQrData("");
        setReceipt(null);
        setError("");
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => {});
            scannerRef.current = null;
        }
    };

    // ── Render ───────────────────────────────────────────────────────
    return (
        <Card className="border-2 border-dashed border-purple-300 bg-purple-50/30">
            <CardContent className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-xl">
                        <Smartphone className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-purple-800">Cross-Device Offline</h3>
                        <p className="text-[10px] text-purple-600">Ed25519 dual-signed QR handshake</p>
                    </div>
                    <Badge variant="outline" className="ml-auto text-[10px] border-purple-300 text-purple-700">
                        <WifiOff className="h-3 w-3 mr-1" /> No Network
                    </Badge>
                </div>

                {/* Phase: Input */}
                {phase === "input" && (
                    <div className="space-y-3">
                        <div className="text-center py-4">
                            <div className="mx-auto w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                                <QrCode className="h-10 w-10 text-purple-600" />
                            </div>
                            <p className="text-sm font-medium text-purple-800">Generate Signed Payment QR</p>
                            <p className="text-xs text-purple-600 mt-1">
                                Customer scans this with their camera — no internet needed
                            </p>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Amount (NPR)</label>
                            <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Enter amount"
                            />
                        </div>
                        <Button
                            onClick={generateQR}
                            disabled={generating || !amount || Number(amount) <= 0}
                            className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                            {generating ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Lock className="h-4 w-4 mr-2" />
                            )}
                            Sign & Generate QR
                        </Button>
                    </div>
                )}

                {/* Phase: Showing QR */}
                {phase === "showing_qr" && (
                    <div className="space-y-4">
                        <div className="text-center">
                            <Badge className="bg-purple-100 text-purple-700 mb-3">
                                <Lock className="h-3 w-3 mr-1" /> Ed25519 Signed
                            </Badge>
                            <p className="text-sm font-medium">Customer: Scan this QR</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Amount: <strong>{formatCurrency(Number(amount))}</strong>
                            </p>
                        </div>

                        <div className="flex justify-center">
                            <div className="bg-white rounded-xl p-3 shadow-lg border-2 border-purple-200">
                                <QRCodeDisplay value={qrData} size={220} />
                            </div>
                        </div>

                        {/* Signature preview */}
                        <div className="bg-purple-50 rounded-lg p-3 border border-purple-200 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-purple-700">
                                <ShieldCheck className="h-3.5 w-3.5" /> Cryptographic Details
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div>
                                    <span className="text-muted-foreground">Algorithm:</span>
                                    <span className="font-mono ml-1">Ed25519</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Merchant:</span>
                                    <span className="font-mono ml-1">{businessUPA}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={reset}>
                                <ArrowLeft className="h-4 w-4 mr-1" /> Back
                            </Button>
                            <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={startReceiptScan}>
                                <Camera className="h-4 w-4 mr-1" /> Scan Receipt
                            </Button>
                        </div>
                    </div>
                )}

                {/* Phase: Scanning receipt */}
                {phase === "scanning_receipt" && (
                    <div className="space-y-3">
                        <div className="text-center">
                            <p className="text-sm font-medium text-purple-800">Scan Customer&apos;s Receipt QR</p>
                            <p className="text-xs text-purple-600 mt-1">
                                Point camera at the customer&apos;s signed receipt QR
                            </p>
                        </div>
                        <div
                            id={scannerContainerId}
                            className="w-full rounded-lg overflow-hidden border-2 border-purple-300"
                            style={{ minHeight: 280 }}
                        />
                        <Button variant="outline" className="w-full" onClick={() => { setPhase("showing_qr"); if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current = null; } }}>
                            Cancel Scan
                        </Button>
                    </div>
                )}

                {/* Phase: Verifying */}
                {phase === "verifying" && (
                    <div className="text-center py-8">
                        <Loader2 className="h-12 w-12 text-purple-600 animate-spin mx-auto mb-3" />
                        <p className="text-sm font-medium text-purple-800">Verifying dual signatures...</p>
                        <p className="text-xs text-purple-600 mt-1">Ed25519 verification in progress</p>
                    </div>
                )}

                {/* Phase: Success */}
                {phase === "success" && receipt && (
                    <div className="space-y-4">
                        <div className="text-center py-4">
                            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-3">
                                <CheckCircle2 className="h-12 w-12 text-green-600" />
                            </div>
                            <h3 className="text-lg font-bold text-green-700">Payment Verified!</h3>
                            <p className="text-sm text-green-600">Dual Ed25519 signatures confirmed</p>
                        </div>

                        {/* Transaction details */}
                        <div className="bg-white rounded-xl border p-4 space-y-2.5">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Amount:</span>
                                <span className="font-bold text-lg">{formatCurrency(receipt.originalRequest.amount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">From:</span>
                                <span className="font-medium">{receipt.payerName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Payer UPA:</span>
                                <span className="font-mono text-xs">{receipt.payerUPA}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Status:</span>
                                <Badge className="bg-amber-100 text-amber-700 text-[10px]">Queued (Offline)</Badge>
                            </div>
                        </div>

                        {/* Dual signature proof */}
                        <DualSignatureProof
                            merchantPubKey={receipt.originalRequest.merchantPubKey}
                            merchantSig={receipt.merchantSignature}
                            payerPubKey={receipt.payerPubKey}
                            payerSig={receipt.payerSignature}
                        />

                        <Button onClick={reset} className="w-full bg-green-600 hover:bg-green-700">
                            New Payment
                        </Button>
                    </div>
                )}

                {/* Phase: Error */}
                {phase === "error" && (
                    <div className="text-center py-6 space-y-3">
                        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                            <XCircle className="h-10 w-10 text-red-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-red-700">Verification Failed</h3>
                        <p className="text-sm text-red-600">{error}</p>
                        <Button variant="outline" onClick={reset}>Try Again</Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  CITIZEN SIDE: Scan merchant QR → Verify → Approve → Show receipt QR
// ═══════════════════════════════════════════════════════════════════

type CitizenPhase = "scanning" | "verifying" | "confirming" | "generating_receipt" | "showing_receipt" | "success" | "error";

export function CitizenOfflinePay() {
    const {
        wallet, balance, user, nid,
        addTransaction, updateBalance,
        offlineWallet, canSpendOffline, spendFromSaralPay,
    } = useWallet();

    const [phase, setPhase] = useState<CitizenPhase>("scanning");
    const [request, setRequest] = useState<SignedPaymentRequest | null>(null);
    const [receiptQR, setReceiptQR] = useState("");
    const [error, setError] = useState("");
    const [sigVerified, setSigVerified] = useState(false);
    const scannerRef = useRef<any>(null);
    const scannerContainerId = "citizen-offline-scanner";

    const myUPA = nid?.linkedUPA || user?.upa_id || wallet?.address || "citizen@upa.np";
    const myName = user?.name || nid?.fullName || "Citizen";

    // Start scanning on mount
    useEffect(() => {
        startScanning();
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
                scannerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startScanning = async () => {
        setPhase("scanning");
        setError("");
        setRequest(null);
        setSigVerified(false);

        try {
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

            const { Html5Qrcode } = await import("html5-qrcode");

            if (scannerRef.current) {
                try { await scannerRef.current.stop(); } catch {}
            }

            const scanner = new Html5Qrcode(scannerContainerId);
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: "environment" },
                { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                (decodedText) => {
                    handleMerchantQRScanned(decodedText);
                    scanner.stop().catch(() => {});
                    scannerRef.current = null;
                },
                () => {}
            );
        } catch (err: any) {
            setError(err.message || "Camera failed to start");
            setPhase("error");
        }
    };

    // ── Verify merchant QR ───────────────────────────────────────────
    const handleMerchantQRScanned = (data: string) => {
        setPhase("verifying");

        try {
            const decoded = decodeFromQR(data);
            if (!decoded || !isPaymentRequest(decoded)) {
                setError("Invalid QR — not a cross-device payment request");
                setPhase("error");
                return;
            }

            const result = verifyPaymentRequest(decoded);
            if (!result.valid) {
                setError(result.error || "Signature verification failed");
                setSigVerified(false);
                setPhase("error");
                return;
            }

            // Signature is valid!
            setSigVerified(true);
            setRequest(decoded);
            setPhase("confirming");

            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            toast.success("Merchant signature verified!");
        } catch (err: any) {
            setError(err.message || "Failed to verify QR");
            setPhase("error");
        }
    };

    // ── Approve and generate receipt ─────────────────────────────────
    const approvePayment = async () => {
        if (!request) return;

        // Balance check
        if (request.amount > balance) {
            toast.error("Insufficient balance");
            return;
        }

        // Offline limit check
        if (!canSpendOffline(request.amount)) {
            toast.error(`Offline limit exceeded! Remaining: ${formatCurrency(offlineWallet.balance)}`);
            return;
        }

        setPhase("generating_receipt");

        try {
            // Extract the request without signature for the receipt
            const { signature: merchantSig, ...requestPayload } = request;

            const signedReceipt = await createSignedReceipt({
                originalRequest: requestPayload,
                merchantSignature: merchantSig,
                payerUPA: myUPA,
                payerName: myName,
            });

            // Record transaction locally
            const txId = `UPA-XDEV-C-${String(Date.now()).slice(-6)}`;
            const txRecord = {
                id: txId,
                tx_id: txId,
                tx_type: "merchant_purchase" as any,
                recipient: request.merchantUPA,
                recipientName: request.merchantName,
                fromUPA: myUPA,
                amount: request.amount,
                intent: "Cross-Device Offline Payment",
                intentCategory: "purchase",
                metadata: {
                    payerName: myName,
                    payerUPA: myUPA,
                    merchantPubKey: request.merchantPubKey,
                    payerPubKey: signedReceipt.payerPubKey,
                    merchantSignature: merchantSig,
                    payerSignature: signedReceipt.payerSignature,
                    paymentType: "xdevice_offline",
                    mode: "cross-device-offline",
                    direction: "outgoing",
                    dualSigned: "true",
                },
                status: "queued" as const,
                mode: "offline" as const,
                nonce: request.nonce,
                timestamp: Date.now(),
                walletProvider: "upa_pay",
                payment_source: "wallet" as const,
            };

            // Deduct balance, consume offline limit
            updateBalance(request.amount);
            spendFromSaralPay(request.amount);
            saveLocalTransaction(txRecord);
            addTransaction(txRecord);

            // Queue for sync
            await queueTransaction({
                payload: JSON.stringify({
                    version: "1.0",
                    upa: request.merchantUPA,
                    intent: { id: "xdevice_purchase", category: "purchase", label: "Cross-Device Offline Payment" },
                    tx_type: "merchant_purchase",
                    amount: request.amount,
                    currency: "NPR",
                    metadata: txRecord.metadata,
                    payer_name: myName,
                    payer_id: myUPA,
                    issuedAt: request.issuedAt,
                    expiresAt: request.expiresAt,
                    nonce: request.nonce,
                    type: "offline",
                }),
                signature: signedReceipt.payerSignature,
                publicKey: signedReceipt.payerPubKey,
                timestamp: Date.now(),
                nonce: request.nonce,
                recipient: request.merchantUPA,
                amount: request.amount,
                intent: "Cross-Device Offline Payment",
                metadata: txRecord.metadata,
            }).catch(() => {});

            // Request background sync when connectivity returns
            if ("serviceWorker" in navigator && "SyncManager" in window) {
                try {
                    const reg = await navigator.serviceWorker.ready;
                    await (reg as any).sync.register("sync-transactions");
                } catch {}
            }

            // Generate receipt QR for merchant to scan
            setReceiptQR(encodeForQR(signedReceipt));
            setPhase("showing_receipt");

            if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
            toast.success("Payment approved! Show receipt to merchant.");
        } catch (err: any) {
            setError(err.message || "Failed to generate receipt");
            setPhase("error");
        }
    };

    const declinePayment = () => {
        toast("Payment declined");
        startScanning();
    };

    const reset = () => {
        setReceiptQR("");
        setRequest(null);
        setSigVerified(false);
        setError("");
        startScanning();
    };

    // ── Render ───────────────────────────────────────────────────────
    return (
        <Card className="border-2 border-dashed border-indigo-300 bg-indigo-50/30">
            <CardContent className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-xl">
                        <Camera className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-indigo-800">Cross-Device Offline Pay</h3>
                        <p className="text-[10px] text-indigo-600">Scan merchant QR &rarr; verify &rarr; approve</p>
                    </div>
                    <Badge variant="outline" className="ml-auto text-[10px] border-indigo-300 text-indigo-700">
                        <WifiOff className="h-3 w-3 mr-1" /> No Network
                    </Badge>
                </div>

                {/* Phase: Scanning */}
                {phase === "scanning" && (
                    <div className="space-y-3">
                        <div className="text-center">
                            <p className="text-sm font-medium text-indigo-800">Scan Merchant&apos;s Payment QR</p>
                            <p className="text-xs text-indigo-600 mt-1">
                                Point camera at the merchant&apos;s Ed25519-signed QR code
                            </p>
                        </div>
                        <div
                            id={scannerContainerId}
                            className="w-full rounded-lg overflow-hidden border-2 border-indigo-300"
                            style={{ minHeight: 280 }}
                        />
                        <div className="flex items-center justify-center gap-2 text-xs text-indigo-600">
                            <Shield className="h-3.5 w-3.5" />
                            Signature will be verified locally — no server needed
                        </div>
                    </div>
                )}

                {/* Phase: Verifying */}
                {phase === "verifying" && (
                    <div className="text-center py-8">
                        <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mx-auto mb-3" />
                        <p className="text-sm font-medium text-indigo-800">Verifying Ed25519 signature...</p>
                        <p className="text-xs text-indigo-600 mt-1">No network required</p>
                    </div>
                )}

                {/* Phase: Confirming */}
                {phase === "confirming" && request && (
                    <div className="space-y-4">
                        {/* Verification badge */}
                        <div className="flex items-center justify-center">
                            <div className="px-4 py-2 rounded-full bg-emerald-100 flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                                </span>
                                <span className="text-sm font-bold text-emerald-700">Ed25519 Signature VERIFIED</span>
                            </div>
                        </div>

                        {/* Payment details */}
                        <div className="bg-white rounded-xl border p-4 space-y-2.5">
                            <div className="flex items-center gap-2 mb-2">
                                <Fingerprint className="h-5 w-5 text-indigo-600" />
                                <h4 className="font-semibold">Confirm Payment</h4>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">To:</span>
                                <span className="font-medium">{request.merchantName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Merchant UPA:</span>
                                <span className="font-mono text-xs">{request.merchantUPA}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Amount:</span>
                                <span className="font-bold text-xl">{formatCurrency(request.amount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Balance after:</span>
                                <span>{formatCurrency(balance - request.amount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Mode:</span>
                                <Badge variant="outline" className="text-[10px]">
                                    <WifiOff className="h-3 w-3 mr-1" /> Cross-Device Offline
                                </Badge>
                            </div>
                        </div>

                        {/* Crypto proof */}
                        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                                <ShieldCheck className="h-3.5 w-3.5" /> Verified Locally (Ed25519)
                            </div>
                            <div className="text-[10px] font-mono text-emerald-600 break-all">
                                Merchant Key: {request.merchantPubKey.slice(0, 16)}...{request.merchantPubKey.slice(-8)}
                            </div>
                        </div>

                        {/* Offline limit warning */}
                        {!canSpendOffline(request.amount) && (
                            <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-sm text-red-700">
                                Offline limit exceeded! Remaining: {formatCurrency(offlineWallet.balance)}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={declinePayment}>
                                Decline
                            </Button>
                            <Button
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                                onClick={approvePayment}
                                disabled={request.amount > balance || !canSpendOffline(request.amount)}
                            >
                                <Fingerprint className="h-4 w-4 mr-2" />
                                Approve & Sign
                            </Button>
                        </div>
                    </div>
                )}

                {/* Phase: Generating receipt */}
                {phase === "generating_receipt" && (
                    <div className="text-center py-8">
                        <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mx-auto mb-3" />
                        <p className="text-sm font-medium text-indigo-800">Signing receipt with Ed25519...</p>
                        <p className="text-xs text-indigo-600 mt-1">Creating dual-signed proof</p>
                    </div>
                )}

                {/* Phase: Showing receipt QR */}
                {phase === "showing_receipt" && request && (
                    <div className="space-y-4">
                        <div className="text-center">
                            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                                <CheckCircle2 className="h-10 w-10 text-green-600" />
                            </div>
                            <h3 className="text-base font-bold text-green-700">Payment Approved!</h3>
                            <p className="text-xs text-green-600 mt-1">
                                Show this receipt QR to the merchant
                            </p>
                        </div>

                        {/* Amount */}
                        <div className="text-center">
                            <span className="text-2xl font-bold">{formatCurrency(request.amount)}</span>
                            <p className="text-xs text-muted-foreground">to {request.merchantName}</p>
                        </div>

                        {/* Receipt QR */}
                        <div className="flex justify-center">
                            <div className="bg-white rounded-xl p-3 shadow-lg border-2 border-green-200">
                                <QRCodeDisplay value={receiptQR} size={220} />
                            </div>
                        </div>

                        <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
                            <p className="text-xs text-green-700 font-medium">
                                <Lock className="h-3 w-3 inline mr-1" />
                                Dual-signed: Merchant + Your Ed25519 signatures
                            </p>
                            <p className="text-[10px] text-green-600 mt-1">
                                Merchant scans this to complete the handshake
                            </p>
                        </div>

                        <Badge className="w-full justify-center bg-amber-100 text-amber-700">
                            Queued — will auto-sync when online
                        </Badge>

                        <Button onClick={reset} variant="outline" className="w-full">
                            Done — New Payment
                        </Button>
                    </div>
                )}

                {/* Phase: Error */}
                {phase === "error" && (
                    <div className="text-center py-6 space-y-3">
                        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                            <XCircle className="h-10 w-10 text-red-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-red-700">Verification Failed</h3>
                        <p className="text-sm text-red-600">{error}</p>
                        <Button variant="outline" onClick={reset}>Try Again</Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  SHARED: Dual Signature Proof Display
// ═══════════════════════════════════════════════════════════════════

function DualSignatureProof({
    merchantPubKey,
    merchantSig,
    payerPubKey,
    payerSig,
}: {
    merchantPubKey: string;
    merchantSig: string;
    payerPubKey: string;
    payerSig: string;
}) {
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 1500);
    };

    return (
        <Card className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-100">
                        <Shield className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className="text-sm font-bold text-emerald-800">Dual Ed25519 Signatures</span>
                    <Badge className="ml-auto bg-emerald-100 text-emerald-700 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Both Valid
                    </Badge>
                </div>

                {/* Merchant signature */}
                <div className="bg-white/60 rounded-lg p-2.5 border border-emerald-200 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-emerald-700">Merchant Signature</span>
                        <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            <button onClick={() => copyToClipboard(merchantSig, "msig")} className="text-muted-foreground hover:text-foreground">
                                {copiedField === "msig" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </button>
                        </div>
                    </div>
                    <p className="font-mono text-[9px] text-emerald-600 break-all">{merchantSig.slice(0, 32)}...</p>
                    <p className="text-[9px] text-muted-foreground">
                        Key: {merchantPubKey.slice(0, 12)}...{merchantPubKey.slice(-8)}
                    </p>
                </div>

                {/* Payer signature */}
                <div className="bg-white/60 rounded-lg p-2.5 border border-emerald-200 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-emerald-700">Citizen Signature</span>
                        <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            <button onClick={() => copyToClipboard(payerSig, "csig")} className="text-muted-foreground hover:text-foreground">
                                {copiedField === "csig" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </button>
                        </div>
                    </div>
                    <p className="font-mono text-[9px] text-emerald-600 break-all">{payerSig.slice(0, 32)}...</p>
                    <p className="text-[9px] text-muted-foreground">
                        Key: {payerPubKey.slice(0, 12)}...{payerPubKey.slice(-8)}
                    </p>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-2 pt-1 text-xs text-emerald-700">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="font-medium">Non-repudiation: both parties cryptographically committed</span>
                </div>
            </CardContent>
        </Card>
    );
}

