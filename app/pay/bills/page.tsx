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
import { BILL_TYPES } from "@/types";
import {
    Zap,
    Droplets,
    Globe,
    Smartphone,
    ArrowRight,
    Loader2,
    CheckCircle2,
    Receipt,
    Wifi,
    WifiOff,
} from "lucide-react";
import { toast } from "sonner";

const BILL_ICONS: Record<string, React.ReactNode> = {
    electricity: <Zap className="h-5 w-5 text-amber-600" />,
    water: <Droplets className="h-5 w-5 text-blue-600" />,
    internet: <Globe className="h-5 w-5 text-green-600" />,
    mobile: <Smartphone className="h-5 w-5 text-purple-600" />,
};

// Mock bill data
const MOCK_BILLS: Record<string, { accountNumber: string; amount: number; dueDate: string; period: string; details: string }> = {
    "012-345-678-9": { accountNumber: "012-345-678-9", amount: 2500, dueDate: "2026-02-25", period: "February 2026", details: "245 kWh consumed" },
    "WAT-KTM-9922": { accountNumber: "WAT-KTM-9922", amount: 450, dueDate: "2026-02-20", period: "February 2026", details: "12 cubic meters" },
    "WL-PKR-4521": { accountNumber: "WL-PKR-4521", amount: 1100, dueDate: "2026-02-28", period: "February 2026", details: "100 Mbps Unlimited" },
    "9841000001": { accountNumber: "9841000001", amount: 500, dueDate: "", period: "", details: "NTC Prepaid Recharge" },
};

export default function BillPaymentPage() {
    return (
        <RouteGuard allowedRoles={["citizen"]}>
            <BillPayment />
        </RouteGuard>
    );
}

type BillStep = "select" | "account" | "confirm" | "success";

function BillPayment() {
    const router = useRouter();
    const { balance, updateBalance, addTransaction, user, nid, wallet, canSpendOffline, spendFromSaralPay, offlineWallet, saralPayBalance } = useWallet();
    const { online } = useNetwork();
    const [step, setStep] = useState<BillStep>("select");
    const [selectedBill, setSelectedBill] = useState<typeof BILL_TYPES[number] | null>(null);
    const [accountNumber, setAccountNumber] = useState("");
    const [amount, setAmount] = useState("");
    const [billDetails, setBillDetails] = useState<typeof MOCK_BILLS[string] | null>(null);
    const [looking, setLooking] = useState(false);
    const [paying, setPaying] = useState(false);
    const [txId, setTxId] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const handleSelectBill = (bill: typeof BILL_TYPES[number]) => {
        setSelectedBill(bill);
        setStep("account");
        setAccountNumber("");
        setAmount("");
        setBillDetails(null);
    };

    const handleLookup = async () => {
        if (!accountNumber.trim()) {
            toast.error("Enter account number");
            return;
        }
        setLooking(true);
        await new Promise((r) => setTimeout(r, 1000));

        const found = MOCK_BILLS[accountNumber.trim()];
        if (found) {
            setBillDetails(found);
            setAmount(String(found.amount));
            toast.success("Account found!");
        } else {
            setBillDetails(null);
            toast.error("Account not found. Enter amount manually.");
        }
        setLooking(false);
    };

    const handlePay = async () => {
        const amt = Number(amount);
        if (amt <= 0 || !selectedBill) return;
        if (amt > balance) {
            toast.error("Insufficient balance");
            return;
        }

        setPaying(true);
        const nonce = generateNonce();
        const intentLabel = selectedBill.label.replace(/[^\w\s]/g, "").trim();
        const now = new Date();

        try {
            if (online) {
                // ── ONLINE: settle instantly via API ──
                const payload = {
                    version: "1.0" as const,
                    upa: selectedBill.billerUPA,
                    intent: { id: selectedBill.id, category: "bill_payment", label: intentLabel },
                    amount: amt,
                    currency: "NPR",
                    metadata: { accountNumber, period: billDetails?.period || "", details: billDetails?.details || "", billerUPA: selectedBill.billerUPA, payerName: user?.name || "", payerId: user?.id || "" },
                    payer_name: user?.name || "",
                    payer_id: user?.id || "",
                    issuedAt: now.toISOString(),
                    expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
                    nonce,
                    type: "online" as const,
                };

                const res = await fetch("/api/transactions/settle", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ payerUpa: wallet?.address, payload }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || "Settlement failed");

                const newTxId = result.transaction?.txId || `UPA-2026-${String(Date.now()).slice(-5)}`;
                setTxId(newTxId);

                updateBalance(amt);
                addTransaction({
                    id: newTxId,
                    tx_id: newTxId,
                    tx_type: "bill_payment",
                    recipient: selectedBill.billerUPA,
                    recipientName: selectedBill.billerName,
                    amount: amt,
                    intent: intentLabel,
                    intentCategory: "bill_payment",
                    status: "settled",
                    mode: "online",
                    payment_source: "wallet",
                    metadata: { accountNumber, period: billDetails?.period || "", details: billDetails?.details || "", billerUPA: selectedBill.billerUPA },
                    nonce,
                    timestamp: Date.now(),
                    settledAt: Date.now(),
                    walletProvider: "upa_pay",
                });
                saveLocalTransaction({
                    id: newTxId,
                    recipient: selectedBill.billerUPA,
                    recipientName: selectedBill.billerName,
                    amount: amt,
                    intent: intentLabel,
                    metadata: { accountNumber, period: billDetails?.period || "", details: billDetails?.details || "", billerUPA: selectedBill.billerUPA },
                    status: "settled",
                    mode: "online",
                    nonce,
                    timestamp: Date.now(),
                    walletProvider: "upa_pay",
                });

                toast.success(`${selectedBill.label} paid successfully!`);
                setStep("success");
            } else {
                // ── OFFLINE: enforce SaralPay wallet balance ──
                if (!offlineWallet.loaded) {
                    toast.error("SaralPay wallet not loaded! Go to Settings to load funds.");
                    setPaying(false);
                    return;
                }
                if (!canSpendOffline(amt)) {
                    toast.error(`Insufficient SaralPay balance. Remaining: NPR ${saralPayBalance.toLocaleString()}`);
                    setPaying(false);
                    return;
                }

                // Build signable payload
                const offlinePayload = {
                    version: "1.0" as const,
                    upa: selectedBill.billerUPA,
                    intent: { id: selectedBill.id, category: "bill_payment", label: intentLabel },
                    amount: amt,
                    currency: "NPR",
                    metadata: { accountNumber, period: billDetails?.period || "", details: billDetails?.details || "", billerUPA: selectedBill.billerUPA, payerName: user?.name || "", payerId: user?.id || "" },
                    payer_name: user?.name || "",
                    payer_id: user?.id || "",
                    issuedAt: now.toISOString(),
                    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 24h for offline
                    nonce,
                    type: "offline" as const,
                };

                // Sign with Ed25519 private key
                let signature = "";
                let publicKey = wallet?.publicKey || "";
                try {
                    const privKeyHex = await SecureKeyStore.get("upa_private_key");
                    if (privKeyHex) {
                        signature = signPayload(offlinePayload, hexToKey(privKeyHex));
                    }
                } catch { /* signing optional for demo */ }

                // Queue in IndexedDB for background sync
                await queueTransaction({
                    payload: JSON.stringify(offlinePayload),
                    signature,
                    publicKey,
                    nonce,
                    recipient: selectedBill.billerUPA,
                    amount: amt,
                    intent: intentLabel,
                    metadata: { accountNumber, period: billDetails?.period || "", details: billDetails?.details || "", billerUPA: selectedBill.billerUPA },
                    timestamp: Date.now(),
                });

                const queuedTxId = `queued_${Date.now()}`;
                setTxId(queuedTxId);

                updateBalance(amt);
                spendFromSaralPay(amt);
                addTransaction({
                    id: queuedTxId,
                    tx_id: queuedTxId,
                    tx_type: "bill_payment",
                    recipient: selectedBill.billerUPA,
                    recipientName: selectedBill.billerName,
                    amount: amt,
                    intent: intentLabel,
                    intentCategory: "bill_payment",
                    status: "queued",
                    mode: "offline",
                    payment_source: "wallet",
                    metadata: { accountNumber, period: billDetails?.period || "", details: billDetails?.details || "", billerUPA: selectedBill.billerUPA },
                    nonce,
                    timestamp: Date.now(),
                    walletProvider: "upa_pay",
                });
                saveLocalTransaction({
                    id: queuedTxId,
                    recipient: selectedBill.billerUPA,
                    recipientName: selectedBill.billerName,
                    amount: amt,
                    intent: intentLabel,
                    metadata: { accountNumber, period: billDetails?.period || "", details: billDetails?.details || "", billerUPA: selectedBill.billerUPA },
                    status: "queued",
                    mode: "offline",
                    nonce,
                    timestamp: Date.now(),
                    walletProvider: "upa_pay",
                });

                toast.info(`Bill queued offline — will auto-sync when online`);
                setStep("success");
            }
        } catch (err: any) {
            toast.error(err.message || "Payment failed");
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
                <Button variant="ghost" size="sm" onClick={() => {
                    if (step === "account") setStep("select");
                    else if (step === "confirm") setStep("account");
                    else router.back();
                }}>← Back</Button>
                <h1 className="text-lg font-bold">Pay Bills</h1>
            </div>

            {/* Connection Status */}
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${online ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                {online ? "Online — will settle instantly" : "Offline — will queue for later sync"}
            </div>

            {/* Step 1: Select Bill Type */}
            {step === "select" && (
                <div className="grid grid-cols-2 gap-3">
                    {BILL_TYPES.map((bill) => (
                        <Card
                            key={bill.id}
                            className="cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                            onClick={() => handleSelectBill(bill)}
                        >
                            <CardContent className="p-5 text-center">
                                <div className="mx-auto w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                                    {BILL_ICONS[bill.id]}
                                </div>
                                <p className="text-sm font-medium">{bill.label.replace(/[^\w\s]/g, "").trim()}</p>
                                <p className="text-[10px] text-muted-foreground mt-1 font-mono">{bill.billerUPA}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Step 2: Account Number */}
            {step === "account" && selectedBill && (
                <>
                    <Card className="bg-blue-50/50 border-blue-200">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                                {BILL_ICONS[selectedBill.id]}
                            </div>
                            <div>
                                <p className="font-semibold text-sm">{selectedBill.billerName}</p>
                                <p className="text-xs text-muted-foreground font-mono">{selectedBill.billerUPA}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4 space-y-4">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Account / Customer Number</label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder={selectedBill.id === "mobile" ? "Mobile number" : "Account number"}
                                        value={accountNumber}
                                        onChange={(e) => setAccountNumber(e.target.value)}
                                        className="flex-1"
                                    />
                                    <Button onClick={handleLookup} disabled={looking || !accountNumber}>
                                        {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
                                    </Button>
                                </div>
                                {/* Quick fill buttons */}
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {selectedBill.id === "electricity" && (
                                        <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => setAccountNumber("012-345-678-9")}>012-345-678-9</Button>
                                    )}
                                    {selectedBill.id === "water" && (
                                        <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => setAccountNumber("WAT-KTM-9922")}>WAT-KTM-9922</Button>
                                    )}
                                    {selectedBill.id === "internet" && (
                                        <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => setAccountNumber("WL-PKR-4521")}>WL-PKR-4521</Button>
                                    )}
                                    {selectedBill.id === "mobile" && (
                                        <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => setAccountNumber("9841000001")}>9841000001</Button>
                                    )}
                                </div>
                            </div>

                            {/* Bill Details (if found) */}
                            {billDetails && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1.5">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        <span className="text-xs font-medium text-green-700">Account Found</span>
                                    </div>
                                    <div className="text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Period:</span>
                                            <span>{billDetails.period}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Details:</span>
                                            <span>{billDetails.details}</span>
                                        </div>
                                        {billDetails.dueDate && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Due Date:</span>
                                                <span className="text-red-600 font-medium">{billDetails.dueDate}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between pt-1 border-t">
                                            <span className="font-medium">Amount Due:</span>
                                            <span className="font-bold">{formatCurrency(billDetails.amount)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Amount */}
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Amount (NPR)</label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="text-xl font-bold h-12"
                                />
                            </div>

                            <Button
                                className="w-full h-12"
                                onClick={() => setStep("confirm")}
                                disabled={!accountNumber || !amount || Number(amount) <= 0}
                            >
                                Continue <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Step 3: Confirm */}
            {step === "confirm" && selectedBill && (
                <>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Receipt className="h-4 w-4" />
                                Bill Payment Confirmation
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Biller:</span>
                                    <span className="font-medium">{selectedBill.billerName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">UPA:</span>
                                    <span className="font-mono text-xs">{selectedBill.billerUPA}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Account:</span>
                                    <span className="font-mono text-xs">{accountNumber}</span>
                                </div>
                                {billDetails?.period && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Period:</span>
                                        <span>{billDetails.period}</span>
                                    </div>
                                )}
                                <div className="flex justify-between pt-2 border-t text-base">
                                    <span className="font-medium">Total:</span>
                                    <span className="font-bold">{formatCurrency(Number(amount))}</span>
                                </div>
                            </div>

                            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                                <p className="font-medium">Intent-Locked Payment</p>
                                <p className="mt-1">This payment is tagged to account <strong>{accountNumber}</strong>. Auto-matched to your utility billing record. No screenshot needed.</p>
                            </div>

                            <Button
                                className="w-full h-12 bg-green-600 hover:bg-green-700"
                                onClick={handlePay}
                                disabled={paying}
                            >
                                {paying ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                                ) : (
                                    <>Pay {formatCurrency(Number(amount))} <ArrowRight className="h-4 w-4 ml-2" /></>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Step 4: Success */}
            {step === "success" && selectedBill && (
                <Card className="border-green-200 bg-green-50/50">
                    <CardContent className="p-6 text-center">
                        <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Bill Paid!</h2>
                        <p className="text-2xl font-bold mb-1">{formatCurrency(Number(amount))}</p>
                        <p className="text-sm text-muted-foreground mb-4">{selectedBill.billerName}</p>
                        <div className="bg-white rounded-lg border p-3 text-xs space-y-1 text-left mb-4">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">TX ID:</span>
                                <span className="font-mono">{txId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Account:</span>
                                <span className="font-mono">{accountNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Status:</span>
                                {txId.startsWith("queued_") ? (
                                    <span className="text-amber-600 font-medium flex items-center gap-1"><WifiOff className="h-3 w-3" /> Queued (Offline)</span>
                                ) : (
                                    <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Settled</span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => { setStep("select"); setSelectedBill(null); }}>
                                Pay Another Bill
                            </Button>
                            <Button className="flex-1" onClick={() => router.push("/")}>
                                Home
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
