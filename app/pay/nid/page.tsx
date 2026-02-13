"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/wallet-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteGuard } from "@/components/route-guard";
import { formatCurrency } from "@/lib/utils";
import { NIDCard } from "@/types";
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
} from "lucide-react";
import { toast } from "sonner";

export default function NIDPaymentPage() {
    return (
        <RouteGuard allowedRoles={["citizen"]}>
            <NIDPayment />
        </RouteGuard>
    );
}

type NFCState = "idle" | "scanning" | "verified" | "error";
type PaySource = "bank" | "esewa" | "khalti";

const MOCK_WALLETS: Record<string, { name: string; id: string; balance: number; color: string; icon: string }> = {
    esewa: { name: "eSewa", id: "9841-XXXXX-12", balance: 12500, color: "bg-green-500", icon: "#60BB46" },
    khalti: { name: "Khalti", id: "9812-XXXXX-98", balance: 8200, color: "bg-purple-600", icon: "#5C2D91" },
};

function NIDPayment() {
    const router = useRouter();
    const { linkNID, nid, linkedBank, balance, updateBalance, addTransaction, deductFromBank } = useWallet();
    const [nfcState, setNfcState] = useState<NFCState>(nid ? "verified" : "idle");
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

    // Simulate NFC tap
    const handleNFCTap = async () => {
        setNfcState("scanning");
        setIsLoading(true);

        // Simulate NFC animation + reading delay
        await new Promise((r) => setTimeout(r, 2000));

        // Pick Ram's NID for demo
        const demoNID = "RAM-KTM-1990-4521";
        await verifyNID(demoNID);
    };

    // Manual NID entry
    const handleManualVerify = async () => {
        if (!manualNID.trim()) {
            toast.error("Enter a NID number");
            return;
        }
        setIsLoading(true);
        setNfcState("scanning");
        await verifyNID(manualNID.trim());
    };

    // Verify NID via API
    const verifyNID = async (nidNumber: string) => {
        try {
            const res = await fetch("/api/nid", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nidNumber }),
            });

            const data = await res.json();

            if (data.success && data.nid) {
                const linked = linkNID(data.nid.nidNumber);
                if (linked) {
                    setVerifiedNID(linked);
                    setNfcState("verified");
                    toast.success(`NID Verified: ${data.nid.fullName}`);
                } else {
                    setNfcState("error");
                    toast.error("NID not in local database");
                }
            } else {
                setNfcState("error");
                toast.error(data.error || "NID verification failed");
            }
        } catch {
            setNfcState("error");
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
        try {
            // Simulate processing
            await new Promise((r) => setTimeout(r, 1500));

            if (paySource === "bank") {
                deductFromBank(amt);
            } else {
                // Mock deduction from digital wallet
                MOCK_WALLETS[paySource].balance -= amt;
            }
            updateBalance(amt);

            const sourceName = paySource === "bank"
                ? linkedBank?.bankName || "Bank"
                : MOCK_WALLETS[paySource].name;
            const sourceType = paySource === "bank" ? "nid_bank" : paySource;

            const txId = `UPA-2026-${String(Date.now()).slice(-5)}`;
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
                mode: "nfc",
                payment_source: sourceType,
                bank_name: sourceName,
                nonce: `nid-${Date.now()}`,
                timestamp: Date.now(),
                settledAt: Date.now(),
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
        <div className="p-4 md:p-6 space-y-5 max-w-lg mx-auto">
            <div className="flex items-center gap-3 mb-2">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
                <h1 className="text-lg font-bold">NID / NFC Payment</h1>
            </div>

            {/* NFC Tap Area */}
            {nfcState === "idle" && (
                <>
                    <Card className="border-2 border-dashed border-purple-300 bg-purple-50/50">
                        <CardContent className="p-8 text-center">
                            <div className="mx-auto w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                                <Smartphone className="h-10 w-10 text-purple-600" />
                            </div>
                            <h2 className="text-lg font-semibold mb-2">Tap NID Card</h2>
                            <p className="text-sm text-muted-foreground mb-6">
                                Hold your National ID card near the device to read via NFC
                            </p>
                            <Button size="lg" className="w-full bg-purple-600 hover:bg-purple-700" onClick={handleNFCTap}>
                                <CreditCard className="h-5 w-5 mr-2" />
                                Simulate NFC Tap
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
                                placeholder="NID Number (e.g., RAM-KTM-1990-4521)"
                                value={manualNID}
                                onChange={(e) => setManualNID(e.target.value.toUpperCase())}
                            />
                            <div className="flex flex-wrap gap-2">
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

            {/* Scanning Animation */}
            {nfcState === "scanning" && (
                <Card className="border-purple-300">
                    <CardContent className="p-8 text-center">
                        <div className="mx-auto w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
                            <Loader2 className="h-10 w-10 text-purple-600 animate-spin" />
                        </div>
                        <h2 className="text-lg font-semibold mb-2">Reading NID Card...</h2>
                        <p className="text-sm text-muted-foreground">Verifying identity with National ID database</p>
                    </CardContent>
                </Card>
            )}

            {/* Verified NID Display */}
            {nfcState === "verified" && verifiedNID && (
                <>
                    <Card className="border-green-200 bg-green-50/50">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <span className="font-semibold text-green-700">NID Verified</span>
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-auto">Active</span>
                            </div>

                            {/* NID Card Display */}
                            <div className="bg-white rounded-lg border p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                                        {verifiedNID.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-base">{verifiedNID.fullName}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{verifiedNID.nidNumber}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-muted-foreground">DOB:</span>
                                        <span className="font-medium">{verifiedNID.dateOfBirth}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-muted-foreground">District:</span>
                                        <span className="font-medium">{verifiedNID.district}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 col-span-2">
                                        <User className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-muted-foreground">UPA:</span>
                                        <span className="font-medium font-mono">{verifiedNID.linkedUPA}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Linked Bank */}
                            {linkedBank && (
                                <div className="mt-3 bg-white rounded-lg border p-3 flex items-center gap-3">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{linkedBank.bankName}</p>
                                        <p className="text-xs text-muted-foreground">Account: {linkedBank.accountNumber}</p>
                                    </div>
                                    <Shield className="h-4 w-4 text-green-600" />
                                </div>
                            )}
                        </CardContent>
                    </Card>

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
                    <Button variant="outline" className="w-full" onClick={() => { setNfcState("idle"); setVerifiedNID(null); }}>
                        Scan Different NID
                    </Button>
                </>
            )}

            {/* Error State */}
            {nfcState === "error" && (
                <Card className="border-red-200 bg-red-50/50">
                    <CardContent className="p-6 text-center">
                        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                        <h2 className="font-semibold text-red-700 mb-2">Verification Failed</h2>
                        <p className="text-sm text-red-600 mb-4">NID card not found or is inactive.</p>
                        <Button onClick={() => setNfcState("idle")}>Try Again</Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
