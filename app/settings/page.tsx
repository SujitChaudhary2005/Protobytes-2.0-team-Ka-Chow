"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/wallet-context";
import { useNetwork } from "@/hooks/use-network";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import {
    Settings,
    User,
    Shield,
    Wifi,
    WifiOff,
    Bell,
    Moon,
    Sun,
    Smartphone,
    CreditCard,
    IdCard,
    Building2,
    Lock,
    Eye,
    EyeOff,
    Globe,
    HardDrive,
    Trash2,
    RefreshCcw,
    LogOut,
    ChevronRight,
    CheckCircle2,
    AlertTriangle,
    Info,
    Download,
    Upload,
} from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
    const router = useRouter();
    const { online: isOnline } = useNetwork();
    const {
        isAuthenticated,
        isLoading,
        user,
        role,
        wallet,
        balance,
        transactions,
        nid,
        linkedBank,
        offlineWallet,
        saralPayBalance,
        unloadSaralPay,
        logout,
    } = useWallet();

    const [mounted, setMounted] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [biometric, setBiometric] = useState(false);
    const [showBalance, setShowBalance] = useState(true);
    const [language, setLanguage] = useState("en");
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (typeof window === "undefined") return;

        // Load persisted preferences
        const prefs = localStorage.getItem("upa_settings");
        if (prefs) {
            try {
                const p = JSON.parse(prefs);
                setDarkMode(p.darkMode ?? false);
                setNotifications(p.notifications ?? true);
                setBiometric(p.biometric ?? false);
                setShowBalance(p.showBalance ?? true);
                setLanguage(p.language ?? "en");
            } catch { /* ignore */ }
        }

        // Apply dark mode
        if (localStorage.getItem("upa_settings")) {
            try {
                const p = JSON.parse(localStorage.getItem("upa_settings")!);
                if (p.darkMode) document.documentElement.classList.add("dark");
            } catch { /* ignore */ }
        }
    }, []);

    const savePreference = (key: string, value: boolean | string) => {
        const prefs = localStorage.getItem("upa_settings");
        let current: Record<string, unknown> = {};
        if (prefs) {
            try { current = JSON.parse(prefs); } catch { /* ignore */ }
        }
        current[key] = value;
        localStorage.setItem("upa_settings", JSON.stringify(current));
    };

    const toggleDarkMode = () => {
        const next = !darkMode;
        setDarkMode(next);
        savePreference("darkMode", next);
        if (next) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        toast.success(next ? "Dark mode enabled" : "Light mode enabled");
    };

    const toggleNotifications = () => {
        const next = !notifications;
        setNotifications(next);
        savePreference("notifications", next);
        toast.success(next ? "Notifications enabled" : "Notifications disabled");
    };

    const toggleBiometric = () => {
        const next = !biometric;
        setBiometric(next);
        savePreference("biometric", next);
        toast.success(next ? "Biometric lock enabled" : "Biometric lock disabled");
    };

    const toggleShowBalance = () => {
        const next = !showBalance;
        setShowBalance(next);
        savePreference("showBalance", next);
    };

    const handleLanguageChange = (lang: string) => {
        setLanguage(lang);
        savePreference("language", lang);
        toast.success(`Language set to ${lang === "en" ? "English" : "नेपाली"}`);
    };

    const handleClearData = () => {
        if (!showClearConfirm) {
            setShowClearConfirm(true);
            return;
        }
        // Clear all local data
        const keysToKeep = ["upa_auth_session"];
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !keysToKeep.includes(key)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        setShowClearConfirm(false);
        toast.success("Local data cleared successfully");
    };

    const handleExportData = () => {
        const data = {
            exportDate: new Date().toISOString(),
            user: user ? { name: user.name, email: user.email, role: user.role } : null,
            transactionCount: transactions.length,
            transactions: transactions.slice(0, 50),
            balance,
            settings: { darkMode, notifications, biometric, showBalance, language },
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `upa-pay-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Data exported successfully");
    };

    const handleLogout = () => {
        logout();
        router.push("/auth");
    };

    if (isLoading || !mounted) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const usedPercent = offlineWallet.initialLoadAmount > 0
        ? Math.min(100, Math.round(((offlineWallet.initialLoadAmount - offlineWallet.balance) / offlineWallet.initialLoadAmount) * 100))
        : 0;

    return (
        <div className="p-4 md:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
                <Settings className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-bold">Settings</h1>
            </div>

            {/* ── Profile Section ─────────────────────────── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        Profile
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {user ? (
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold">
                                {user.name?.charAt(0) || "U"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-base truncate">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="capitalize text-xs">
                                        {role}
                                    </Badge>
                                    {user.phone && (
                                        <span className="text-xs text-muted-foreground">{user.phone}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-muted-foreground">Not logged in</p>
                            <Button className="mt-2" onClick={() => router.push("/auth")}>Login</Button>
                        </div>
                    )}

                    {/* Wallet Info */}
                    {wallet && (
                        <>
                            <Separator />
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground mb-1">UPA Address</p>
                                    <p className="text-sm font-mono truncate">{wallet.address}</p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground mb-1">Balance</p>
                                    <p className="text-sm font-semibold flex items-center gap-2">
                                        {showBalance ? formatCurrency(balance) : "••••••"}
                                        <button onClick={toggleShowBalance} className="text-muted-foreground hover:text-foreground">
                                            {showBalance ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                        </button>
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ── Linked Accounts ─────────────────────────── */}
            {role === "citizen" && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" />
                            Linked Accounts
                        </CardTitle>
                        <CardDescription>NID card and bank accounts linked to your wallet</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* NID Status */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${nid ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                                    <IdCard className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">National ID (NID)</p>
                                    <p className="text-xs text-muted-foreground">
                                        {nid ? `${nid.fullName} · ${nid.nidNumber}` : "Not linked"}
                                    </p>
                                </div>
                            </div>
                            {nid ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                                <Button size="sm" variant="outline" onClick={() => router.push("/pay/nid")}>
                                    Link
                                </Button>
                            )}
                        </div>

                        {/* Bank Status */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${linkedBank ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Bank Account</p>
                                    <p className="text-xs text-muted-foreground">
                                        {linkedBank ? `${linkedBank.bankName} · ****${linkedBank.accountNumber.slice(-4)}` : "Not linked"}
                                    </p>
                                </div>
                            </div>
                            {linkedBank ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                                <Button size="sm" variant="outline" onClick={() => router.push("/pay/nid")}>
                                    Link
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── SaralPay Offline Wallet (Citizens) ─────── */}
            {role === "citizen" && (
                <Card className={offlineWallet.loaded ? "border-amber-200" : ""}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <WifiOff className="h-4 w-4 text-primary" />
                            SaralPay Wallet
                        </CardTitle>
                        <CardDescription>Prepaid offline wallet for NFC &amp; offline payments</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium">Wallet Balance</p>
                                <p className={`text-2xl font-bold ${offlineWallet.loaded ? "text-amber-700" : "text-muted-foreground"}`}>
                                    {formatCurrency(saralPayBalance)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">Status</p>
                                <p className={`text-sm font-medium ${offlineWallet.loaded ? "text-green-600" : "text-muted-foreground"}`}>
                                    {offlineWallet.loaded ? "Active" : "Not Loaded"}
                                </p>
                            </div>
                        </div>

                        {/* Progress bar */}
                        {offlineWallet.loaded && offlineWallet.initialLoadAmount > 0 && (
                            <>
                                <div className="w-full bg-muted rounded-full h-2.5">
                                    <div
                                        className={`h-2.5 rounded-full transition-all ${usedPercent >= 90 ? "bg-red-500" : usedPercent >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                                        style={{ width: `${usedPercent}%` }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground text-center">
                                    {usedPercent}% spent · {formatCurrency(saralPayBalance)} remaining
                                </p>
                            </>
                        )}

                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => router.push("/pay/settings")}
                            >
                                {offlineWallet.loaded ? "Manage Wallet" : "Load Wallet"}
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                            {offlineWallet.loaded && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        unloadSaralPay();
                                        toast.success("SaralPay wallet unloaded. Funds returned to main wallet.");
                                    }}
                                >
                                    <RefreshCcw className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Appearance & Preferences ────────────────── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Sun className="h-4 w-4 text-primary" />
                        Appearance & Preferences
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                    {/* Dark Mode */}
                    <SettingRow
                        icon={darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                        label="Dark Mode"
                        description="Switch between light and dark theme"
                        action={
                            <ToggleSwitch checked={darkMode} onChange={toggleDarkMode} />
                        }
                    />

                    <Separator />

                    {/* Notifications */}
                    <SettingRow
                        icon={<Bell className="h-4 w-4" />}
                        label="Notifications"
                        description="Transaction alerts and updates"
                        action={
                            <ToggleSwitch checked={notifications} onChange={toggleNotifications} />
                        }
                    />

                    <Separator />

                    {/* Language */}
                    <SettingRow
                        icon={<Globe className="h-4 w-4" />}
                        label="Language"
                        description={language === "en" ? "English" : "नेपाली"}
                        action={
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handleLanguageChange("en")}
                                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${language === "en" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                >
                                    EN
                                </button>
                                <button
                                    onClick={() => handleLanguageChange("ne")}
                                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${language === "ne" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                                >
                                    नेपाली
                                </button>
                            </div>
                        }
                    />
                </CardContent>
            </Card>

            {/* ── Security ────────────────────────────────── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Security
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                    {/* Biometric */}
                    <SettingRow
                        icon={<Smartphone className="h-4 w-4" />}
                        label="Biometric Lock"
                        description="Require fingerprint or face to open app"
                        action={
                            <ToggleSwitch checked={biometric} onChange={toggleBiometric} />
                        }
                    />

                    <Separator />

                    {/* Hide Balance */}
                    <SettingRow
                        icon={showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        label="Show Balance"
                        description="Display wallet balance on dashboard"
                        action={
                            <ToggleSwitch checked={showBalance} onChange={toggleShowBalance} />
                        }
                    />

                    <Separator />

                    {/* Crypto Keys */}
                    <SettingRow
                        icon={<Lock className="h-4 w-4" />}
                        label="Cryptographic Keys"
                        description="Ed25519 signing keys for offline verification"
                        action={
                            <Badge variant="outline" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                                Active
                            </Badge>
                        }
                    />
                </CardContent>
            </Card>

            {/* ── Network & Connectivity ──────────────────── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        {isOnline ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-orange-500" />}
                        Network & Connectivity
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                            {isOnline ? (
                                <Wifi className="h-5 w-5 text-green-500" />
                            ) : (
                                <WifiOff className="h-5 w-5 text-orange-500" />
                            )}
                            <div>
                                <p className="text-sm font-medium">Connection Status</p>
                                <p className="text-xs text-muted-foreground">
                                    {isOnline ? "Connected to server" : "Working offline"}
                                </p>
                            </div>
                        </div>
                        <Badge variant={isOnline ? "default" : "secondary"}>
                            {isOnline ? "Online" : "Offline"}
                        </Badge>
                    </div>

                    {role === "citizen" && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                                <HardDrive className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Queued Transactions</p>
                                    <p className="text-xs text-muted-foreground">Payments waiting to sync</p>
                                </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => router.push("/pay/queued")}>
                                View
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Data Management ─────────────────────────── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-primary" />
                        Data Management
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                            <p className="text-sm font-medium">Transaction History</p>
                            <p className="text-xs text-muted-foreground">{transactions.length} transactions stored locally</p>
                        </div>
                        <Badge variant="outline">{transactions.length}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="w-full" onClick={handleExportData}>
                            <Download className="h-4 w-4 mr-2" />
                            Export Data
                        </Button>
                        <Button
                            variant={showClearConfirm ? "destructive" : "outline"}
                            size="sm"
                            className="w-full"
                            onClick={handleClearData}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {showClearConfirm ? "Confirm Clear" : "Clear Data"}
                        </Button>
                    </div>
                    {showClearConfirm && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>This will clear all local transaction data, settings, and cached info. Your account will remain. Tap again to confirm.</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── About ───────────────────────────────────── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        About
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">App Version</p>
                            <p className="text-sm font-medium">1.0.0</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">Platform</p>
                            <p className="text-sm font-medium">PWA</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">Crypto</p>
                            <p className="text-sm font-medium">Ed25519</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">Storage</p>
                            <p className="text-sm font-medium">IndexedDB + LS</p>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center pt-1">
                        UPA Pay — Unified Payment Address System for Nepal
                    </p>
                </CardContent>
            </Card>

            {/* ── Logout ──────────────────────────────────── */}
            {isAuthenticated && (
                <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleLogout}
                >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                </Button>
            )}

            {/* Bottom spacer for mobile nav */}
            <div className="h-24" />
        </div>
    );
}

/* ── Reusable Setting Row ────────────────────────────── */
function SettingRow({
    icon,
    label,
    description,
    action,
}: {
    icon: React.ReactNode;
    label: string;
    description: string;
    action: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
                <div className="text-muted-foreground">{icon}</div>
                <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
            </div>
            {action}
        </div>
    );
}

/* ── Toggle Switch Component ─────────────────────────── */
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button
            role="switch"
            aria-checked={checked}
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`}
            />
        </button>
    );
}
