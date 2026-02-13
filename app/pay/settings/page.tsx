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
    Shield,
    RefreshCcw,
    AlertTriangle,
    CheckCircle2,
    Info,
    WifiOff,
    ArrowRight,
    IdCard,
    Building2,
} from "lucide-react";
import { toast } from "sonner";

const PRESETS = [2000, 5000, 10000, 20000];

export default function SettingsPage() {
    return (
        <RouteGuard allowedRoles={["citizen"]}>
            <OfflineSettings />
        </RouteGuard>
    );
}

function OfflineSettings() {
    const router = useRouter();
    const { offlineLimit, setOfflineLimit, resetOfflineLimit, nid, linkedBank } = useWallet();
    const [customAmount, setCustomAmount] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const usedPercent = offlineLimit.maxAmount > 0
        ? Math.min(100, Math.round((offlineLimit.currentUsed / offlineLimit.maxAmount) * 100))
        : 0;
    const remaining = offlineLimit.maxAmount - offlineLimit.currentUsed;

    const getBarColor = () => {
        if (usedPercent >= 90) return "bg-red-500";
        if (usedPercent >= 70) return "bg-amber-500";
        return "bg-green-500";
    };

    const handleSetLimit = (amt: number) => {
        if (amt < offlineLimit.currentUsed) {
            toast.error(`Cannot set below current usage (${formatCurrency(offlineLimit.currentUsed)})`);
            return;
        }
        setOfflineLimit(amt);
        toast.success(`Offline limit set to ${formatCurrency(amt)}`);
    };

    const handleCustom = () => {
        const amt = Number(customAmount);
        if (amt <= 0 || amt > 50000) {
            toast.error("Enter an amount between 1 and 50,000");
            return;
        }
        handleSetLimit(amt);
        setCustomAmount("");
    };

    const handleReset = () => {
        resetOfflineLimit();
        toast.success("Offline usage reset to zero!");
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
                <h1 className="text-lg font-bold">Offline Spending Limits</h1>
            </div>

            {/* Current Status */}
            <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <WifiOff className="h-5 w-5" />
                        <span className="text-sm font-medium">Current Offline Limit</span>
                    </div>
                    <p className="text-3xl font-bold mb-1">{formatCurrency(offlineLimit.maxAmount)}</p>
                    <div className="mt-4">
                        <div className="flex justify-between text-xs mb-1.5">
                            <span>Used: {formatCurrency(offlineLimit.currentUsed)}</span>
                            <span>Remaining: {formatCurrency(Math.max(0, remaining))}</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-3">
                            <div
                                className={`${getBarColor()} h-3 rounded-full transition-all duration-500`}
                                style={{ width: `${usedPercent}%` }}
                            />
                        </div>
                        <p className="text-xs text-white/70 mt-1.5">{usedPercent}% of limit used</p>
                    </div>
                </CardContent>
            </Card>

            {/* Warning if near limit */}
            {usedPercent >= 80 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-medium text-amber-800">Approaching Limit</p>
                        <p className="text-xs text-amber-700 mt-0.5">
                            You&apos;ve used {usedPercent}% of your offline limit. Consider increasing it or going online to sync payments.
                        </p>
                    </div>
                </div>
            )}

            {/* Preset Amounts */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Set Offline Limit
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        {PRESETS.map((amt) => (
                            <Button
                                key={amt}
                                variant={offlineLimit.maxAmount === amt ? "default" : "outline"}
                                className="h-12"
                                onClick={() => handleSetLimit(amt)}
                            >
                                {formatCurrency(amt)}
                                {offlineLimit.maxAmount === amt && (
                                    <CheckCircle2 className="h-4 w-4 ml-2" />
                                )}
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
                        <Button onClick={handleCustom} disabled={!customAmount}>
                            Set <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Reset Usage */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <RefreshCcw className="h-4 w-4" />
                        Reset Usage Counter
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                        Reset the &quot;used&quot; counter back to zero. This should be done after syncing queued payments online.
                        In production, this resets automatically after successful settlement.
                    </p>
                    <Button
                        variant="outline"
                        className="w-full border-red-200 text-red-700 hover:bg-red-50"
                        onClick={handleReset}
                        disabled={offlineLimit.currentUsed === 0}
                    >
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Reset to Zero ({formatCurrency(offlineLimit.currentUsed)} used)
                    </Button>
                </CardContent>
            </Card>

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
            <Card className="bg-blue-50/50 border-blue-100">
                <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-blue-700 space-y-1.5">
                            <p className="font-medium">How Offline Limits Work</p>
                            <ul className="list-disc pl-3.5 space-y-1">
                                <li>When offline, payments are queued locally up to your set limit</li>
                                <li>Each queued payment deducts from your available offline balance</li>
                                <li>Your NID links your identity — no internet needed to verify</li>
                                <li>When back online, queued payments auto-settle and your balance syncs</li>
                                <li>The counter resets automatically after successful settlement</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
