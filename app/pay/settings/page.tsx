"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/wallet-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteGuard } from "@/components/route-guard";
import { formatCurrency } from "@/lib/utils";
import {
    Wallet,
    RefreshCcw,
    AlertTriangle,
    CheckCircle2,
    Info,
    WifiOff,
    ArrowRight,
    IdCard,
    Building2,
    ArrowDownToLine,
    ArrowUpFromLine,
    Zap,
    Clock,
} from "lucide-react";
import { toast } from "sonner";

import { OFFLINE_WALLET_MAX_BALANCE } from "@/lib/offline-policy";

const PRESETS = [500, 1000, 1500, 2000];

export default function SettingsPage() {
    return (
        <RouteGuard allowedRoles={["citizen"]}>
            <SaralPaySettings />
        </RouteGuard>
    );
}

function SaralPaySettings() {
    const router = useRouter();
    const { offlineWallet, saralPayBalance, loadSaralPay, unloadSaralPay, balance, nid, linkedBank } = useWallet();
    const [customAmount, setCustomAmount] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const usedPercent = offlineWallet.initialLoadAmount > 0
        ? Math.min(100, Math.round(((offlineWallet.initialLoadAmount - offlineWallet.balance) / offlineWallet.initialLoadAmount) * 100))
        : 0;

    const getBarColor = () => {
        if (usedPercent >= 90) return "bg-red-500";
        if (usedPercent >= 70) return "bg-amber-500";
        return "bg-emerald-500";
    };

    const handleLoad = (amt: number) => {
        if (amt <= 0) {
            toast.error("Enter a valid amount");
            return;
        }
        if (amt > balance) {
            toast.error(`Insufficient main balance. Available: ${formatCurrency(balance)}`);
            return;
        }
        if (offlineWallet.balance + amt > OFFLINE_WALLET_MAX_BALANCE) {
            toast.error(`Cannot exceed wallet limit of ${formatCurrency(OFFLINE_WALLET_MAX_BALANCE)}. Current: ${formatCurrency(offlineWallet.balance)}`);
            return;
        }

        const ok = loadSaralPay(amt);
        if (ok) {
            toast.success(`Loaded ${formatCurrency(amt)} into SaralPay Wallet`);
        } else {
            toast.error("Failed to load SaralPay wallet");
        }
    };

    const handleCustomLoad = () => {
        const amt = Number(customAmount);
        if (amt <= 0 || amt > 2000) {
            toast.error("Enter an amount between 1 and 2,000");
            return;
        }
        handleLoad(amt);
        setCustomAmount("");
    };

    const handleUnload = () => {
        if (offlineWallet.balance <= 0) {
            toast.error("SaralPay wallet is empty");
            return;
        }
        const remaining = offlineWallet.balance;
        unloadSaralPay();
        toast.success(`Returned ${formatCurrency(remaining)} to main wallet`);
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
                <h1 className="text-lg font-bold">SaralPay Offline Wallet</h1>
            </div>

            {/* SaralPay Wallet Card */}
            <Card className={`bg-gradient-to-br ${offlineWallet.loaded ? "from-amber-500 to-orange-600" : "from-gray-500 to-gray-600"} text-white border-0`}>
                <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Wallet className="h-5 w-5" />
                        <span className="text-sm font-medium">SaralPay Wallet</span>
                        {offlineWallet.loaded ? (
                            <span className="ml-auto text-[10px] bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Active
                            </span>
                        ) : (
                            <span className="ml-auto text-[10px] bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <WifiOff className="h-3 w-3" /> Not Loaded
                            </span>
                        )}
                    </div>
                    <p className="text-3xl font-bold mb-1">{formatCurrency(saralPayBalance)}</p>
                    <p className="text-xs text-white/70">Offline wallet balance</p>

                    {offlineWallet.loaded && offlineWallet.initialLoadAmount > 0 && (
                        <div className="mt-4">
                            <div className="flex justify-between text-xs mb-1.5">
                                <span>Spent: {formatCurrency(offlineWallet.initialLoadAmount - offlineWallet.balance)}</span>
                                <span>Loaded: {formatCurrency(offlineWallet.initialLoadAmount)}</span>
                            </div>
                            <div className="w-full bg-white/20 rounded-full h-3">
                                <div
                                    className={`${getBarColor()} h-3 rounded-full transition-all duration-500`}
                                    style={{ width: `${usedPercent}%` }}
                                />
                            </div>
                            <p className="text-xs text-white/70 mt-1.5">{usedPercent}% spent</p>
                        </div>
                    )}

                    {offlineWallet.loadedAt > 0 && (
                        <div className="mt-3 flex items-center gap-1 text-xs text-white/60">
                            <Clock className="h-3 w-3" />
                            Loaded {new Date(offlineWallet.loadedAt).toLocaleDateString()} at {new Date(offlineWallet.loadedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Main balance reminder */}
            <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-600" />
                        <div>
                            <p className="text-xs font-medium text-blue-800">Main Wallet Balance</p>
                            <p className="text-sm font-bold text-blue-700">{formatCurrency(balance)}</p>
                        </div>
                    </div>
                    <p className="text-[10px] text-blue-600">Available to load</p>
                </CardContent>
            </Card>

            {/* Warning if wallet nearly empty */}
            {offlineWallet.loaded && offlineWallet.balance > 0 && usedPercent >= 80 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-medium text-amber-800">Running Low</p>
                        <p className="text-xs text-amber-700 mt-0.5">
                            You&apos;ve spent {usedPercent}% of your SaralPay wallet. Consider loading more funds for offline payments.
                        </p>
                    </div>
                </div>
            )}

            {/* Load Wallet — Preset Amounts */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <ArrowDownToLine className="h-4 w-4" />
                        Load SaralPay Wallet
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                        Load funds from your main wallet into SaralPay for offline payments. Your main balance will be deducted.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {PRESETS.map((amt) => (
                            <Button
                                key={amt}
                                variant="outline"
                                className="h-12 hover:bg-amber-50 hover:border-amber-300"
                                onClick={() => handleLoad(amt)}
                                disabled={amt > balance}
                            >
                                <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
                                {formatCurrency(amt)}
                            </Button>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <Input
                            type="number"
                            placeholder="Custom amount"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            className="flex-1"
                            max={50000}
                        />
                        <Button onClick={handleCustomLoad} disabled={!customAmount} className="bg-amber-600 hover:bg-amber-700">
                            Load <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Unload Wallet */}
            {offlineWallet.loaded && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <ArrowUpFromLine className="h-4 w-4" />
                            Unload SaralPay Wallet
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Return remaining SaralPay balance ({formatCurrency(offlineWallet.balance)}) back to your main wallet.
                            This will deactivate the offline wallet.
                        </p>
                        <Button
                            variant="outline"
                            className="w-full border-red-200 text-red-700 hover:bg-red-50"
                            onClick={handleUnload}
                            disabled={offlineWallet.balance <= 0}
                        >
                            <ArrowUpFromLine className="h-4 w-4 mr-2" />
                            Unload {formatCurrency(offlineWallet.balance)} → Main Wallet
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* NID + Bank Status */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Linked Accounts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                            <IdCard className="h-5 w-5 text-blue-600" />
                            <span className="text-sm">National ID</span>
                        </div>
                        {nid ? (
                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> {nid.nidNumber.slice(0, 10)}...
                            </span>
                        ) : (
                            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => router.push("/pay/nid")}>
                                Link NID
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-green-600" />
                            <span className="text-sm">Bank Account</span>
                        </div>
                        {linkedBank ? (
                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> {linkedBank.bankName}
                            </span>
                        ) : (
                            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => router.push("/pay/nid")}>
                                Link Bank
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* How it works */}
            <Card className="bg-amber-50/50 border-amber-100">
                <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-amber-700 space-y-1.5">
                            <p className="font-medium">How SaralPay Works</p>
                            <ul className="list-disc pl-3.5 space-y-1">
                                <li>Load funds from your main wallet into SaralPay — like a prepaid offline wallet</li>
                                <li>When offline, NFC and other payments deduct from your SaralPay balance</li>
                                <li>Your NID links your identity — no internet needed to verify</li>
                                <li>When back online, queued payments auto-settle with the server</li>
                                <li>Unload anytime to return remaining balance to your main wallet</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
