"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useNetwork } from "@/hooks/use-network";
import { useWallet } from "@/contexts/wallet-context";
import { RouteGuard } from "@/components/route-guard";
import {
    Camera,
    Search,
    Keyboard,
    XCircle,
    Loader2,
    ClipboardPaste,
    QrCode,
    Wifi,
    WifiOff,
    Copy,
    Check,
    User,
    Share2,
    ShieldCheck,
    Shield,
    Fingerprint,
    Landmark,
    CreditCard,
} from "lucide-react";
import type { UPA } from "@/types";

export default function ScanPageWrapper() {
    return (
        <RouteGuard allowedRoles={["citizen"]}>
            <ScanPage />
        </RouteGuard>
    );
}

/* ─── Inline QR generator using <img> — avoids canvas rendering issues ─ */
function UserQRImage({ value, size = 200 }: { value: string; size?: number }) {
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        if (!value) return;
        let cancelled = false;

        import("qrcode").then((QRCode) => {
            QRCode.toDataURL(value, {
                width: size,
                margin: 2,
                errorCorrectionLevel: "M",
                color: { dark: "#000000", light: "#FFFFFF" },
            })
                .then((url: string) => {
                    if (!cancelled) setSrc(url);
                })
                .catch(console.error);
        });

        return () => { cancelled = true; };
    }, [value, size]);

    if (!src) {
        return (
            <div
                style={{ width: size, height: size }}
                className="flex items-center justify-center bg-muted/30 rounded-lg animate-pulse"
            >
                <QrCode className="h-10 w-10 text-muted-foreground/30" />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt="Your Payment QR Code"
            width={size}
            height={size}
            style={{ width: size, height: size, display: "block" }}
        />
    );
}

function ScanPage() {
    const router = useRouter();
    const { online } = useNetwork();
    const { wallet, user, nid, linkedBank } = useWallet();

    // ── Camera opens by default when page loads ──────────────────────
    const [wantScan, setWantScan] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [canShare, setCanShare] = useState(false);

    // UPA manual lookup
    const [upaInput, setUpaInput] = useState("");
    const [upas, setUpas] = useState<UPA[]>([]);
    const [matchedUpa, setMatchedUpa] = useState<UPA | null>(null);
    const [selectedIntentCode, setSelectedIntentCode] = useState("");
    const [lookingUp, setLookingUp] = useState(false);

    const scannerRef = useRef<any>(null);
    const scannerContainerId = "qr-reader";
    const [pasteData, setPasteData] = useState("");

    // ─── Build user's QR payload ───────────────────────────────────────
    const userQRPayload = useMemo(() => {
        const upaAddress = nid?.linkedUPA || wallet?.address || "upa_demo";
        return JSON.stringify({
            version: "1.0",
            type: "receive",
            upa: upaAddress,
            name: nid?.fullName || user?.name || wallet?.name || "UPA User",
            ...(nid ? { nid: nid.nidNumber, district: nid.district } : {}),
            ...(wallet?.publicKey ? { publicKey: wallet.publicKey } : {}),
        });
    }, [nid, wallet, user]);

    const userUpaAddress = nid?.linkedUPA || wallet?.address || "upa_demo";
    const userName = nid?.fullName || user?.name || wallet?.name || "UPA User";

    // ─── Share detection ───────────────────────────────────────────────
    useEffect(() => {
        if (typeof navigator !== "undefined" && "share" in navigator) {
            setCanShare(true);
        }
    }, []);

    // ─── Load all UPAs for lookup ──────────────────────────────────────
    useEffect(() => {
        fetch("/api/upas")
            .then((r) => r.json())
            .then((res) => setUpas(res.data || []))
            .catch(console.error);
    }, []);

    // ─── Cleanup on unmount ────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => { });
                scannerRef.current = null;
            }
        };
    }, []);

    // ─── Start scanner AFTER container is rendered ─────────────────────
    useEffect(() => {
        if (!wantScan || scanning) return;

        let cancelled = false;

        const initScanner = async () => {
            try {
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                if (cancelled) return;

                const { Html5Qrcode } = await import("html5-qrcode");

                if (scannerRef.current) {
                    try { await scannerRef.current.stop(); } catch { }
                }

                const scanner = new Html5Qrcode(scannerContainerId);
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: "environment" },
                    {
                        fps: 15,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0,
                        disableFlip: false,
                    },
                    (decodedText) => {
                        handleScannedData(decodedText);
                        stopScanning();
                    },
                    () => { }
                );

                if (!cancelled) setScanning(true);
            } catch (err: any) {
                if (!cancelled) {
                    setError(err.message || "Failed to start camera");
                    setWantScan(false);
                }
            }
        };

        initScanner();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wantScan]);

    const stopScanning = async () => {
        try {
            if (scannerRef.current) {
                await scannerRef.current.stop();
                scannerRef.current = null;
            }
        } catch { }
        setScanning(false);
        setWantScan(false);
    };

    const handleScannedData = (data: string) => {
        try {
            const parsed = JSON.parse(data);
            if (!parsed.upa) {
                setError("Invalid QR code — no UPA address found");
                return;
            }
            router.push(`/pay/confirm?data=${encodeURIComponent(data)}`);
        } catch {
            const trimmed = data.trim();
            if (trimmed.includes("@")) {
                lookupAndNavigate(trimmed);
            } else {
                setError("Could not read QR code data");
            }
        }
    };

    const lookupAndNavigate = (address: string) => {
        const upa = upas.find((u) => u.address.toLowerCase() === address.toLowerCase());
        if (upa && upa.intents.length > 0) {
            const intent = upa.intents[0];
            const payload = {
                version: "1.0",
                upa: upa.address,
                entity_name: upa.entity_name,
                intent: { id: intent.intent_code, category: intent.category, label: intent.label },
                amount_type: intent.amount_type,
                amount: intent.fixed_amount || undefined,
                min_amount: intent.min_amount || undefined,
                max_amount: intent.max_amount || undefined,
                currency: "NPR",
                metadata_schema: intent.metadata_schema || {},
            };
            router.push(`/pay/confirm?data=${encodeURIComponent(JSON.stringify(payload))}`);
        } else {
            setError(`No entity found for "${address}"`);
        }
    };

    const handleUpaLookup = () => {
        const trimmed = upaInput.trim();
        if (!trimmed) return;

        setLookingUp(true);
        setError(null);
        setMatchedUpa(null);
        setSelectedIntentCode("");

        const found = upas.find((u) => u.address.toLowerCase() === trimmed.toLowerCase());
        if (found) {
            setMatchedUpa(found);
            if (found.intents[0]) setSelectedIntentCode(found.intents[0].intent_code);
        } else {
            setError(`No entity found for "${trimmed}". Try: traffic@nepal.gov`);
        }
        setLookingUp(false);
    };

    const handlePayWithUpa = () => {
        if (!matchedUpa || !selectedIntentCode) return;
        const intent = matchedUpa.intents.find((i) => i.intent_code === selectedIntentCode);
        if (!intent) return;

        const payload = {
            version: "1.0",
            upa: matchedUpa.address,
            entity_name: matchedUpa.entity_name,
            intent: { id: intent.intent_code, category: intent.category, label: intent.label },
            amount_type: intent.amount_type,
            amount: intent.fixed_amount || undefined,
            min_amount: intent.min_amount || undefined,
            max_amount: intent.max_amount || undefined,
            currency: "NPR",
            metadata_schema: intent.metadata_schema || {},
        };
        router.push(`/pay/confirm?data=${encodeURIComponent(JSON.stringify(payload))}`);
    };

    const handleCopyAddress = async () => {
        try {
            await navigator.clipboard.writeText(userUpaAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { }
    };

    const handleShareQR = async () => {
        if (!navigator.share) return;
        try {
            await navigator.share({
                title: `${userName} — Payment QR`,
                text: `Pay me via UPA: ${userUpaAddress}`,
                url: window.location.origin,
            });
        } catch { }
    };

    /* ═══════════════════════════════════════════════════════════════════
       RENDER
    ═══════════════════════════════════════════════════════════════════ */
    return (
        <div className="p-4 md:p-6 space-y-5">
            {/* ─── Header ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Scan & Pay</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Scan to pay or share your QR to receive
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {nid ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Verified
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">
                            <Shield className="h-3.5 w-3.5" />
                            Unverified
                        </span>
                    )}
                    {online ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
                            <Wifi className="h-3.5 w-3.5" />
                            Online
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600">
                            <WifiOff className="h-3.5 w-3.5" />
                            Offline
                        </span>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                MAIN ROW — Scanner (left)  +  My QR (right)
                Side-by-side on desktop, stacked on mobile
                Uses inline flex for reliable cross-device rendering
            ═══════════════════════════════════════════════════════════ */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem" }}>

                {/* ── LEFT: QR Scanner ────────────────────────────────── */}
                <Card className="overflow-hidden" style={{ flex: "1 1 340px", minWidth: 0 }}>
                    <CardHeader className="pb-2 border-b bg-muted/20">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Camera className="h-4 w-4 text-primary" />
                            Scan QR
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                        {wantScan ? (
                            <>
                                <div
                                    id={scannerContainerId}
                                    className="w-full rounded-lg overflow-hidden border"
                                    style={{ minHeight: 280 }}
                                />
                                <Button variant="outline" className="w-full mt-3" onClick={stopScanning}>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Stop Camera
                                </Button>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 gap-4">
                                <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center">
                                    <Camera className="h-8 w-8 text-primary/40" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium">Camera stopped</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Tap below to restart scanner
                                    </p>
                                </div>
                                <Button
                                    onClick={() => { setError(null); setWantScan(true); }}
                                    size="lg"
                                    className="gap-2"
                                >
                                    <Camera className="h-4 w-4" />
                                    Start Camera
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── RIGHT: My Payment QR ────────────────────────────── */}
                <Card className="overflow-hidden border-2 border-primary/20" style={{ flex: "1 1 340px", minWidth: 0 }}>
                    <CardHeader className="pb-2 border-b bg-primary/5">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <QrCode className="h-4 w-4 text-primary" />
                            My QR
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                        <div className="flex flex-col items-center text-center gap-3">
                            {/* User info */}
                            <div className="flex items-center gap-3 w-full">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <User className="h-5 w-5 text-primary" />
                                </div>
                                <div className="text-left min-w-0">
                                    <p className="font-semibold text-sm truncate">{userName}</p>
                                    <p className="text-xs text-muted-foreground font-mono truncate">{userUpaAddress}</p>
                                </div>
                            </div>

                            <Separator />

                            {/* QR Code */}
                            <div className="bg-white rounded-xl p-3 shadow-sm border inline-block">
                                <UserQRImage value={userQRPayload} size={200} />
                            </div>

                            <p className="text-xs text-muted-foreground max-w-[240px]">
                                Share this QR to receive payments via C2C
                            </p>

                            {/* Action buttons */}
                            <div className="flex gap-2 w-full">
                                <Button
                                    variant="outline"
                                    className="flex-1 gap-2 text-xs"
                                    onClick={handleCopyAddress}
                                >
                                    {copied ? (
                                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    ) : (
                                        <Copy className="h-3.5 w-3.5" />
                                    )}
                                    {copied ? "Copied!" : "Copy Address"}
                                </Button>
                                {canShare && (
                                    <Button
                                        variant="outline"
                                        className="flex-1 gap-2 text-xs"
                                        onClick={handleShareQR}
                                    >
                                        <Share2 className="h-3.5 w-3.5" />
                                        Share
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                NID CARD (if linked) / LINK NID PROMPT (if not)
            ═══════════════════════════════════════════════════════════ */}
            {nid ? (
                <Card className="overflow-hidden border-emerald-200/60">
                    <CardHeader className="pb-3 border-b bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
                        <CardTitle className="text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                            <Fingerprint className="h-4 w-4" />
                            National ID Linked
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="space-y-3">
                            {/* NID Mini-Card */}
                            <div className="rounded-lg border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                        Government of Nepal — National ID
                                    </span>
                                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                </div>
                                <div className="space-y-2">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Full Name</p>
                                        <p className="text-sm font-semibold">{nid.fullName}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-xs text-muted-foreground">NID Number</p>
                                            <p className="text-xs font-mono font-medium">{nid.nidNumber}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">District</p>
                                            <p className="text-xs font-medium">{nid.district}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Date of Birth</p>
                                            <p className="text-xs font-medium">{nid.dateOfBirth}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Expiry</p>
                                            <p className="text-xs font-medium">{nid.expiryDate}</p>
                                        </div>
                                    </div>
                                    {nid.linkedUPA && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Linked UPA</p>
                                            <p className="text-xs font-mono font-medium text-primary">{nid.linkedUPA}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Linked Bank */}
                            {linkedBank && (
                                <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/20">
                                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <Landmark className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold truncate">{linkedBank.bankName}</p>
                                        <p className="text-xs text-muted-foreground font-mono">
                                            {linkedBank.accountNumber} · {linkedBank.accountType}
                                        </p>
                                    </div>
                                    {linkedBank.isPrimary && (
                                        <span className="ml-auto text-[10px] font-medium text-emerald-600 bg-emerald-500/10 rounded-full px-2 py-0.5">
                                            Primary
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                /* NID not linked — prompt */
                <Card className="overflow-hidden border-dashed">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                                <CreditCard className="h-5 w-5 text-amber-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">Link your National ID</p>
                                <p className="text-xs text-muted-foreground">
                                    Connect NID to enable bank payments &amp; verified identity
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push("/pay/nid")}
                            >
                                Link
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── Error Display ────────────────────────────────────────── */}
            {error && (
                <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-4 flex items-center gap-3">
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        <p className="text-sm text-destructive">{error}</p>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto text-destructive hover:text-destructive"
                            onClick={() => setError(null)}
                        >
                            Dismiss
                        </Button>
                    </CardContent>
                </Card>
            )}



            {/* ─── UPA Address Lookup ──────────────────────────────────── */}
            <Card>
                <CardHeader className="pb-3 border-b bg-muted/20">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Keyboard className="h-4 w-4 text-primary" />
                        Pay by UPA Address
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="e.g. traffic@nepal.gov"
                            value={upaInput}
                            onChange={(e) => { setUpaInput(e.target.value); setMatchedUpa(null); setError(null); }}
                            onKeyDown={(e) => e.key === "Enter" && handleUpaLookup()}
                        />
                        <Button onClick={handleUpaLookup} disabled={!upaInput.trim() || lookingUp}>
                            {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                    </div>

                    {matchedUpa && (
                        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                            <div>
                                <p className="font-semibold">{matchedUpa.entity_name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{matchedUpa.address}</p>
                            </div>

                            {matchedUpa.intents.length > 1 && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Select Service</Label>
                                    <Select value={selectedIntentCode} onValueChange={setSelectedIntentCode}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose payment type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {matchedUpa.intents.map((i) => (
                                                <SelectItem key={i.intent_code} value={i.intent_code}>
                                                    {i.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {matchedUpa.intents.length === 1 && (
                                <p className="text-sm text-muted-foreground">
                                    Service: <span className="font-medium text-foreground">{matchedUpa.intents[0].label}</span>
                                </p>
                            )}

                            <Button className="w-full" onClick={handlePayWithUpa} disabled={!selectedIntentCode}>
                                Proceed to Pay
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
