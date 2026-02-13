"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/wallet-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteGuard } from "@/components/route-guard";
import { formatCurrency } from "@/lib/utils";
import { generateNonce } from "@/lib/crypto";
import { saveTransaction as saveLocalTransaction } from "@/lib/storage";
import { NIDCard } from "@/types";
import { NIDCameraScanner } from "@/components/nid-camera-scanner";
import { NIDCardDisplay, NIDCardSkeleton } from "@/components/nid-card-display";
import {
    Smartphone,
    CreditCard,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    Loader2,
    Shield,
    Building2,
    User,
    MapPin,
    Calendar,
    Wallet,
    Camera,
    Database,
} from "lucide-react";
import { toast } from "sonner";

export default function NIDPaymentPage() {
    return (
        <RouteGuard allowedRoles={["citizen"]}>
            <NIDPayment />
        </RouteGuard>
    );
}

type ScanState = "idle" | "camera" | "scanning" | "verified" | "error";
type PaySource = "bank" | "esewa" | "khalti";

const MOCK_WALLETS: Record<string, { name: string; id: string; balance: number; color: string; icon: string }> = {
    esewa: { name: "eSewa", id: "9841-XXXXX-12", balance: 12500, color: "bg-green-500", icon: "#60BB46" },
    khalti: { name: "Khalti", id: "9812-XXXXX-98", balance: 8200, color: "bg-purple-600", icon: "#5C2D91" },
};

function NIDPayment() {
    const router = useRouter();
    const { linkNID, nid, linkedBank, balance, updateBalance, addTransaction, deductFromBank, wallet, user } = useWallet();
    const [scanState, setScanState] = useState<ScanState>(nid ? "verified" : "idle");
    const [manualNID, setManualNID] = useState("");
    const [verifiedNID, setVerifiedNID] = useState<NIDCard | null>(nid);
    const [isLoading, setIsLoading] = useState(false);
    const [paymentTarget, setPaymentTarget] = useState("");
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentIntent, setPaymentIntent] = useState("");
    const [paying, setPaying] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [paySource, setPaySource] = useState<PaySource>("bank");

    useEffect(() => { setMounted(true); }, []);

    // Open camera scanner
    const handleOpenCamera = () => {
        setScanState("camera");
    };

    // Handle NID detected from camera
    const handleNIDDetected = async (nidNumber: string) => {
        setScanState("scanning");
        setIsLoading(true);
        toast.info(`Detected: ${nidNumber}`);
        // Add a small delay to show "processing" state
        await new Promise(r => setTimeout(r, 500));
        await verifyNID(nidNumber);
    };

    // Cancel camera scanning
    const handleCancelCamera = () => {
        setScanState("idle");
    };

    // Manual NID entry
    const handleManualVerify = async () => {
        if (!manualNID.trim()) {
            toast.error("Enter a NID number");
            return;
        }
        setIsLoading(true);
        setScanState("scanning");
        await verifyNID(manualNID.trim());
    };

    // Verify NID via API
    const verifyNID = async (nidNumber: string) => {
        try {
            // Show fetching state
            toast.loading("Querying National ID Registry...", { id: "nid-verify" });
            
            const res = await fetch("/api/nid", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nidNumber }),
            });

            const data = await res.json();
            toast.dismiss("nid-verify");

            if (data.success && data.nid) {
                // Simulate database lookup delay for realism
                await new Promise(r => setTimeout(r, 300));
                
                const linked = linkNID(data.nid.nidNumber);
                if (linked) {
                    setVerifiedNID(linked);
                    setScanState("verified");
                    toast.success(`✓ Verified: ${data.nid.fullName}`, { duration: 3000 });
                } else {
                    setScanState("error");
                    toast.error("NID not in local database");
                }
            } else {
                setScanState("error");
                toast.error(data.error || "NID verification failed");
            }
        } catch {
            toast.dismiss("nid-verify");
            setScanState("error");
            toast.error("Verification failed. Check connection.");
        } finally {
            setIsLoading(false);
        }
    };

    // Pay via selected source (bank / eSewa / Khalti)
    const handlePay = async () => {
        if (!paymentTarget || !paymentAmount || Number(paymentAmount) <= 0) {
            toast.error("Enter payment details");
            return;
        }

        const amt = Number(paymentAmount);

        // Validate balance for digital wallets
        if (paySource !== "bank") {
            const w = MOCK_WALLETS[paySource];
            if (amt > w.balance) {
                toast.error(`Insufficient ${w.name} balance (NPR ${w.balance.toLocaleString()})`);
                return;
            }
        }

        setPaying(true);
        const nonce = generateNonce();
        const now = new Date();

        try {
            const sourceName = paySource === "bank"
                ? linkedBank?.bankName || "Bank"
                : MOCK_WALLETS[paySource].name;
            const sourceType = paySource === "bank" ? "nid_bank" : paySource;

            // Build payload for API settlement
            const payload = {
                version: "1.0" as const,
                upa: paymentTarget,
                intent: { id: "nid_payment", category: "payment", label: paymentIntent || "NID Payment" },
                amount: amt,
                currency: "NPR",
                metadata: {
                    payerName: verifiedNID?.fullName || user?.name || "Citizen",
                    payerId: user?.id || "",
                    paymentSource: sourceType,
                    bankName: sourceName,
                    nidNumber: verifiedNID?.nidNumber || "",
                },
                payer_name: verifiedNID?.fullName || user?.name || "Citizen",
                payer_id: user?.id || "",
                issuedAt: now.toISOString(),
                expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
                nonce,
                type: "online" as const,
            };

            // Settle via API to persist to central ledger
            const res = await fetch("/api/transactions/settle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payerUpa: verifiedNID?.linkedUPA || wallet?.address, payload }),
            });
            const result = await res.json();

            const txId = result.transaction?.txId || `UPA-2026-${String(Date.now()).slice(-5)}`;

            if (paySource === "bank") {
                deductFromBank(amt);
            } else {
                // Mock deduction from digital wallet
                MOCK_WALLETS[paySource].balance -= amt;
            }
            updateBalance(amt);

            addTransaction({
                id: txId,
                tx_id: txId,
                tx_type: "nid_payment",
                recipient: paymentTarget,
                recipientName: paymentTarget,
                amount: amt,
                intent: paymentIntent || "NID Payment",
                intentCategory: "payment",
                status: "settled",
                mode: "camera",
                payment_source: sourceType,
                bank_name: sourceName,
                nonce,
                timestamp: Date.now(),
                settledAt: Date.now(),
                walletProvider: "upa_pay",
            });

            // Also save to local storage DB for admin/dashboard reads
            saveLocalTransaction({
                id: txId,
                recipient: paymentTarget,
                recipientName: paymentTarget,
                amount: amt,
                intent: paymentIntent || "NID Payment",
                metadata: {
                    paymentSource: sourceType,
                    bankName: sourceName,
                    nidNumber: verifiedNID?.nidNumber || "",
                },
                status: "settled",
                mode: "camera",
                nonce,
                timestamp: Date.now(),
                walletProvider: "upa_pay",
            });

            toast.success(`Paid ${formatCurrency(amt)} via ${sourceName}`);
            router.push(`/pay/success?amount=${amt}&recipient=${encodeURIComponent(paymentTarget)}&txId=${txId}&source=${sourceType}&bank=${encodeURIComponent(sourceName)}`);
        } catch {
            toast.error("Payment failed");
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
        <div className="p-4 md:p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
                <h1 className="text-lg font-bold">NID / Camera Payment</h1>
            </div>

            {/* Camera Scanner */}
            {scanState === "camera" && (
                <NIDCameraScanner 
                    onNIDDetected={handleNIDDetected}
                    onCancel={handleCancelCamera}
                />
            )}

            {/* Initial State - Show Camera Option */}
            {scanState === "idle" && (
                <>
                    <Card className="border-2 border-dashed border-blue-300 bg-blue-50/50">
                        <CardContent className="p-8 text-center">
                            <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                                <Camera className="h-10 w-10 text-blue-600" />
                            </div>
                            <h2 className="text-lg font-semibold mb-2">Scan NID Card</h2>
                            <p className="text-sm text-muted-foreground mb-6">
                                Use your camera to scan and read your National ID card
                            </p>
                            <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleOpenCamera}>
                                <Camera className="h-5 w-5 mr-2" />
                                Open Camera Scanner
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Manual Entry */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Or Enter NID Manually</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Input
                                placeholder="NID Number (e.g., 123-456-789 or RAM-KTM-1990-4521)"
                                value={manualNID}
                                onChange={(e) => setManualNID(e.target.value.toUpperCase())}
                            />
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" className="text-xs" onClick={() => setManualNID("123-456-789")}>
                                    123-456-789
                                </Button>
                                {["RAM-KTM-1990-4521", "SITA-PKR-1995-7832", "HARI-LTP-1988-3214"].map((nid) => (
                                    <Button key={nid} variant="outline" size="sm" className="text-xs" onClick={() => setManualNID(nid)}>
                                        {nid.split("-").slice(0, 2).join("-")}...
                                    </Button>
                                ))}
                            </div>
                            <Button className="w-full" onClick={handleManualVerify} disabled={!manualNID}>
                                Verify NID
                            </Button>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Scanning Animation - Shows NID card skeleton while fetching */}
            {scanState === "scanning" && (
                <div className="space-y-4">
                    <NIDCardSkeleton />
                    <Card className="border-blue-200 bg-blue-50/50">
                        <CardContent className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2 text-blue-600">
                                <Database className="h-4 w-4" />
                                <span className="text-sm font-medium">Querying National ID Registry</span>
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Verified NID Display — Nagarik-style card */}
            {scanState === "verified" && verifiedNID && (
                <>
                    {/* Verification Badge */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="font-semibold text-green-700">NID Verified</span>
                        </div>
                        <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">Active</span>
                    </div>

                    {/* NID Card — Nagarik app style */}
                    <NIDCardDisplay nid={verifiedNID} />

                    {/* Linked Bank */}
                    {linkedBank && (
                        <Card className="border-blue-100">
                            <CardContent className="p-3 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{linkedBank.bankName}</p>
                                    <p className="text-xs text-muted-foreground">Account: {linkedBank.accountNumber}</p>
                                </div>
                                <Shield className="h-4 w-4 text-green-600" />
                            </CardContent>
                        </Card>
                    )}

                    {/* Payment Source Selector */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Choose Payment Source</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {/* Bank */}
                            <button
                                onClick={() => setPaySource("bank")}
                                className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                                    paySource === "bank" ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "hover:bg-muted/50"
                                }`}
                            >
                                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{linkedBank?.bankName || "Nepal Bank"}</p>
                                    <p className="text-xs text-muted-foreground">{linkedBank?.accountNumber || "****2341"}</p>
                                </div>
                                {paySource === "bank" && <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />}
                            </button>

                            {/* eSewa */}
                            <button
                                onClick={() => setPaySource("esewa")}
                                className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                                    paySource === "esewa" ? "border-green-500 bg-green-50 ring-1 ring-green-500" : "hover:bg-muted/50"
                                }`}
                            >
                                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                                    <Wallet className="h-5 w-5 text-green-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">eSewa</p>
                                    <p className="text-xs text-muted-foreground">ID: {MOCK_WALLETS.esewa.id} &middot; Bal: NPR {MOCK_WALLETS.esewa.balance.toLocaleString()}</p>
                                </div>
                                {paySource === "esewa" && <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />}
                            </button>

                            {/* Khalti */}
                            <button
                                onClick={() => setPaySource("khalti")}
                                className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                                    paySource === "khalti" ? "border-purple-500 bg-purple-50 ring-1 ring-purple-500" : "hover:bg-muted/50"
                                }`}
                            >
                                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                    <Wallet className="h-5 w-5 text-purple-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">Khalti</p>
                                    <p className="text-xs text-muted-foreground">ID: {MOCK_WALLETS.khalti.id} &middot; Bal: NPR {MOCK_WALLETS.khalti.balance.toLocaleString()}</p>
                                </div>
                                {paySource === "khalti" && <CheckCircle2 className="h-5 w-5 text-purple-600 shrink-0" />}
                            </button>
                        </CardContent>
                    </Card>

                    {/* Payment Form */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Payment Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Pay To (UPA Address)</label>
                                <Input
                                    placeholder="e.g., traffic@nepal.gov"
                                    value={paymentTarget}
                                    onChange={(e) => setPaymentTarget(e.target.value)}
                                />
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {["traffic@nepal.gov", "coffee@himalayanjava.np", "nea@utility.np"].map((upa) => (
                                        <Button key={upa} variant="outline" size="sm" className="text-[10px] h-6 px-2" onClick={() => setPaymentTarget(upa)}>
                                            {upa}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Amount (NPR)</label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Purpose</label>
                                <Input
                                    placeholder="e.g., Traffic Fine, Coffee"
                                    value={paymentIntent}
                                    onChange={(e) => setPaymentIntent(e.target.value)}
                                />
                            </div>

                            <div className={`rounded-lg p-3 text-xs ${
                                paySource === "bank" ? "bg-blue-50" : paySource === "esewa" ? "bg-green-50" : "bg-purple-50"
                            }`}>
                                <p className={`font-medium ${
                                    paySource === "bank" ? "text-blue-700" : paySource === "esewa" ? "text-green-700" : "text-purple-700"
                                }`}>
                                    Source: {paySource === "bank" ? linkedBank?.bankName : MOCK_WALLETS[paySource].name}
                                </p>
                                <p className={`mt-1 ${
                                    paySource === "bank" ? "text-blue-600" : paySource === "esewa" ? "text-green-600" : "text-purple-600"
                                }`}>
                                    {paySource === "bank"
                                        ? `${linkedBank?.accountNumber} → Bank debit`
                                        : `${MOCK_WALLETS[paySource].id} → Wallet debit (Bal: NPR ${MOCK_WALLETS[paySource].balance.toLocaleString()})`
                                    }
                                </p>
                            </div>

                            <Button
                                className={`w-full h-12 ${
                                    paySource === "bank" ? "bg-blue-600 hover:bg-blue-700" : paySource === "esewa" ? "bg-green-600 hover:bg-green-700" : "bg-purple-600 hover:bg-purple-700"
                                }`}
                                onClick={handlePay}
                                disabled={paying || !paymentTarget || !paymentAmount}
                            >
                                {paying ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                                ) : (
                                    <>
                                        Pay via {paySource === "bank" ? "Bank" : MOCK_WALLETS[paySource].name} <ArrowRight className="h-4 w-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Re-scan button */}
                    <Button variant="outline" className="w-full" onClick={() => { setScanState("idle"); setVerifiedNID(null); }}>
                        Scan Different NID
                    </Button>
                </>
            )}

            {/* Error State */}
            {scanState === "error" && (
                <Card className="border-red-200 bg-red-50/50">
                    <CardContent className="p-6 text-center">
                        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                        <h2 className="font-semibold text-red-700 mb-2">Verification Failed</h2>
                        <p className="text-sm text-red-600 mb-4">NID card not found or is inactive.</p>
                        <Button onClick={() => setScanState("idle")}>Try Again</Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
