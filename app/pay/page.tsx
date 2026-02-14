"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
    Smartphone,
    Zap,
    CheckCircle2,
    RefreshCw,
    AlertTriangle,
    CloudOff,
    Building2,
    Users,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { saveTransaction as saveLocalTransaction } from "@/lib/storage";
import { queueTransaction } from "@/lib/db";
import { executeACIDTransaction } from "@/lib/acid-transaction";
import { createSignalChannel } from "@/lib/nfc-signal";
import type { UPA } from "@/types";

type PaymentMode = "qr" | "nfc";
type NFCStatus = "checking" | "ready" | "scanning" | "found" | "confirming" | "processing" | "success" | "error";
type TxMode = "c2b" | "c2c" | "c2g";

interface DetectedDevice {
    id: string;
    name: string;
    type: "merchant" | "citizen" | "government";
    upa?: string;
    amount?: number;
    lastSeen: number;
}

const GOV_ENTITIES = [
    { id: "gov-traffic", name: "Nepal Traffic Police", upa: "traffic@nepal.gov", category: "fine" },
    { id: "gov-revenue", name: "Inland Revenue Dept", upa: "revenue@ird.gov.np", category: "tax" },
    { id: "gov-metro", name: "Kathmandu Metropolitan", upa: "revenue@kathmandu.gov.np", category: "tax" },
    { id: "gov-transport", name: "Dept of Transport Mgmt", upa: "license@dotm.gov.np", category: "fee" },
];

export default function PayPageWrapper() {
    return (
        <RouteGuard allowedRoles={["citizen"]}>
            <Suspense fallback={<div className="p-4">Loading...</div>}>
                <PayPage />
            </Suspense>
        </RouteGuard>
    );
}

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

function PayPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { online } = useNetwork();
    const { wallet, balance, user, nid, linkedBank, addTransaction, updateBalance, creditUser, offlineWallet, saralPayBalance, canSpendOffline, spendFromSaralPay } = useWallet();

    // ─── Mode from URL param ────────────────────────────────────────
    const urlMode = searchParams.get("mode") as PaymentMode | null;
    const urlTx = searchParams.get("tx") as TxMode | null;
    const [activeMode, setActiveMode] = useState<PaymentMode>(urlMode === "nfc" ? "nfc" : "qr");

    // Update URL when mode changes
    useEffect(() => {
        const newUrl = `/pay?mode=${activeMode}`;
        if (window.location.pathname + window.location.search !== newUrl) {
            router.replace(newUrl, { scroll: false });
        }
    }, [activeMode, router]);

    // ─── Shared state ────────────────────────────────────────────────
    const myUPA = nid?.linkedUPA || user?.upa_id || wallet?.address || "";
    const myName = nid?.fullName || user?.name || wallet?.name || "Citizen";
    const myId = useRef(`pay-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`);

    // ─── QR State ────────────────────────────────────────────────────
    const [wantScan, setWantScan] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [qrError, setQrError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [canShare, setCanShare] = useState(false);
    const [upaInput, setUpaInput] = useState("");
    const [upas, setUpas] = useState<UPA[]>([]);
    const [matchedUpa, setMatchedUpa] = useState<UPA | null>(null);
    const [selectedIntentCode, setSelectedIntentCode] = useState("");
    const [lookingUp, setLookingUp] = useState(false);
    const scannerRef = useRef<any>(null);
    const scannerContainerId = "qr-reader-unified";

    // ─── NFC State ───────────────────────────────────────────────────
    const [nfcStatus, setNfcStatus] = useState<NFCStatus>("checking");
    const nfcStatusRef = useRef<NFCStatus>("checking");
    const [hasNativeNFC, setHasNativeNFC] = useState(false);
    const [nearbyDevices, setNearbyDevices] = useState<DetectedDevice[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<DetectedDevice | null>(null);
    const [payAmount, setPayAmount] = useState("");
    const [txMode, setTxMode] = useState<TxMode>(urlTx === "c2g" || urlTx === "c2c" ? urlTx : "c2b");
    const [lastTxId, setLastTxId] = useState<string | null>(null);
    const [lastTxType, setLastTxType] = useState<string>("");
    const channelRef = useRef<{ send: (msg: any) => void; close: () => void } | null>(null);

    // ─── User QR Payload ─────────────────────────────────────────────
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

    // ─── Load UPAs ────────────────────────────────────────────────────
    useEffect(() => {
        fetch("/api/upas")
            .then((r) => r.json())
            .then((res) => setUpas(res.data || []))
            .catch(console.error);
    }, []);

    // ─── NFC Support Check ────────────────────────────────────────────
    useEffect(() => {
        if (typeof window === "undefined") return;
        if ("NDEFReader" in window) setHasNativeNFC(true);
        if (activeMode === "nfc") setNfcStatus("ready");
    }, [activeMode]);

    // ─── NFC Signal Channel ───────────────────────────────────────────
    useEffect(() => {
        if (activeMode !== "nfc" || typeof window === "undefined") return;

        const signal = createSignalChannel((data) => {
            if (!data?.type) return;

            switch (data.type) {
                case "business_presence": {
                    setNearbyDevices((prev) => {
                        const device: DetectedDevice = {
                            id: data.businessId,
                            name: data.businessName,
                            type: "merchant",
                            upa: data.upa,
                            lastSeen: data.timestamp,
                        };
                        const idx = prev.findIndex((d) => d.id === data.businessId);
                        if (idx >= 0) { const copy = [...prev]; copy[idx] = device; return copy; }
                        return [...prev, device];
                    });
                    const s = nfcStatusRef.current;
                    if (s === "scanning" || s === "found") {
                        setNfcStatus("found");
                    }
                    break;
                }

                case "customer_presence": {
                    if (data.customerId === myId.current) return;
                    setNearbyDevices((prev) => {
                        const device: DetectedDevice = {
                            id: data.customerId,
                            name: data.customerName,
                            type: "citizen",
                            upa: data.upa,
                            lastSeen: data.timestamp,
                        };
                        const idx = prev.findIndex((d) => d.id === data.customerId);
                        if (idx >= 0) { const copy = [...prev]; copy[idx] = device; return copy; }
                        return [...prev, device];
                    });
                    const s = nfcStatusRef.current;
                    if (s === "scanning" || s === "found") {
                        setNfcStatus("found");
                    }
                    break;
                }

                case "payment_request": {
                    if (data.targetCustomer === myId.current) {
                        setSelectedDevice({
                            id: data.businessId,
                            name: data.paymentData.businessName,
                            type: "merchant",
                            upa: data.paymentData.upa,
                            amount: data.paymentData.amount,
                            lastSeen: Date.now(),
                        });
                        setNfcStatus("confirming");
                        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                        toast(`Payment request: ${formatCurrency(data.paymentData.amount)} from ${data.paymentData.businessName}`);
                    }
                    break;
                }

                case "b2c_payment_received": {
                    if (data.targetCitizen === myId.current || data.targetUPA === myUPA) {
                        handleIncomingB2C(data);
                    }
                    break;
                }

                case "c2c_payment_complete": {
                    if (data.toCitizenId === myId.current || data.toUPA === myUPA) {
                        handleIncomingC2C(data);
                    }
                    break;
                }
            }
        });
        channelRef.current = signal;

        const interval = setInterval(() => {
            signal.send({
                type: "customer_presence",
                customerId: myId.current,
                customerName: myName,
                upa: myUPA,
                walletBalance: balance,
                timestamp: Date.now(),
            });
        }, 2000);

        return () => {
            clearInterval(interval);
            signal.close();
            channelRef.current = null;
        };
    }, [activeMode, myName, balance, myUPA]);

    // Keep NFC status ref in sync
    useEffect(() => { nfcStatusRef.current = nfcStatus; }, [nfcStatus]);

    // Cleanup stale NFC detections
    useEffect(() => {
        if (activeMode !== "nfc") return;
        const interval = setInterval(() => {
            const now = Date.now();
            setNearbyDevices((prev) => prev.filter((d) => now - d.lastSeen < 10000));
        }, 3000);
        return () => clearInterval(interval);
    }, [activeMode]);

    // ─── QR Scanner ──────────────────────────────────────────────────
    useEffect(() => {
        if (activeMode !== "qr" || !wantScan || scanning) return;

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
                    setQrError(err.message || "Failed to start camera");
                    setWantScan(false);
                }
            }
        };

        initScanner();

        return () => { cancelled = true; };
    }, [wantScan, scanning, activeMode]);

    // Cleanup QR scanner on unmount or mode switch
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => { });
                scannerRef.current = null;
            }
        };
    }, [activeMode]);

    // ─── QR Handlers ──────────────────────────────────────────────────
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
                setQrError("Invalid QR code — no UPA address found");
                return;
            }

            if (parsed.type === "receive") {
                const params = new URLSearchParams();
                params.set("to", parsed.upa);
                if (parsed.name) params.set("name", parsed.name);
                router.push(`/pay/c2c?${params.toString()}`);
                return;
            }

            router.push(`/pay/confirm?data=${encodeURIComponent(data)}&method=qr`);
        } catch {
            const trimmed = data.trim();
            if (trimmed.includes("@")) {
                lookupAndNavigate(trimmed);
            } else {
                setQrError("Could not read QR code data");
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
            router.push(`/pay/confirm?data=${encodeURIComponent(JSON.stringify(payload))}&method=qr`);
        } else {
            setQrError(`No entity found for "${address}"`);
        }
    };

    const handleUpaLookup = () => {
        const trimmed = upaInput.trim();
        if (!trimmed) return;

        setLookingUp(true);
        setQrError(null);
        setMatchedUpa(null);
        setSelectedIntentCode("");

        const found = upas.find((u) => u.address.toLowerCase() === trimmed.toLowerCase());
        if (found) {
            setMatchedUpa(found);
            if (found.intents[0]) setSelectedIntentCode(found.intents[0].intent_code);
        } else {
            setQrError(`No entity found for "${trimmed}". Try: traffic@nepal.gov`);
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
        router.push(`/pay/confirm?data=${encodeURIComponent(JSON.stringify(payload))}&method=qr`);
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

    // ─── NFC Handlers ───────────────────────────────────────────────
    const handleIncomingB2C = (data: any) => {
        const txId = `UPA-B2C-R-${String(Date.now()).slice(-6)}`;
        const txRecord = {
            id: txId, tx_id: txId, tx_type: "b2c" as any,
            recipient: myUPA || myName, recipientName: myName,
            fromUPA: data.businessUPA, amount: data.amount,
            intent: `Received from ${data.businessName}`,
            intentCategory: "transfer",
            metadata: { businessName: data.businessName, paymentType: "b2c", mode: "nfc", direction: "incoming" },
            status: "settled" as const, mode: "nfc" as const,
            nonce: `b2c-r-${Date.now()}`, timestamp: Date.now(), settledAt: Date.now(),
            walletProvider: "upa_pay", payment_source: "wallet" as const,
        };
        addTransaction(txRecord);
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        toast.success(`Received ${formatCurrency(data.amount)} from ${data.businessName} [B2C]`);
    };

    const handleIncomingC2C = (data: any) => {
        const txId = `UPA-C2C-R-${String(Date.now()).slice(-6)}`;
        const txRecord = {
            id: txId, tx_id: txId, tx_type: "c2c" as any,
            recipient: myUPA || myName, recipientName: myName,
            fromUPA: data.fromUPA, amount: data.amount,
            intent: `Received from ${data.fromCitizenName}`,
            intentCategory: "transfer",
            metadata: { senderName: data.fromCitizenName, paymentType: "c2c", mode: "nfc", direction: "incoming" },
            status: "settled" as const, mode: "nfc" as const,
            nonce: `c2c-r-${Date.now()}`, timestamp: Date.now(), settledAt: Date.now(),
            walletProvider: "upa_pay", payment_source: "wallet" as const,
        };
        addTransaction(txRecord);
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        toast.success(`Received ${formatCurrency(data.amount)} from ${data.fromCitizenName} [C2C]`);
    };

    const startNFCScan = async () => {
        setNfcStatus("scanning");

        if (txMode === "c2g") {
            setTimeout(() => {
                setNearbyDevices((prev) => {
                    const govDevices: DetectedDevice[] = GOV_ENTITIES.map((g) => ({
                        id: g.id, name: g.name, type: "government" as const, upa: g.upa, lastSeen: Date.now(),
                    }));
                    return [...prev.filter((d) => d.type !== "government"), ...govDevices];
                });
                setNfcStatus("found");
            }, 800);
        }

        // Auto-detect for C2B: simulate nearby merchant terminals
        if (txMode === "c2b") {
            setTimeout(() => {
                setNearbyDevices((prev) => {
                    const existing = prev.filter((d) => d.type === "merchant");
                    if (existing.length > 0) return prev;
                    const simMerchants: DetectedDevice[] = [
                        { id: "biz-himalayan-java", name: "Himalayan Java Coffee", type: "merchant", upa: "shop@himalayanjava.np", lastSeen: Date.now() },
                        { id: "biz-bhatbhateni", name: "Bhatbhateni Supermarket", type: "merchant", upa: "pay@bhatbhateni.np", lastSeen: Date.now() },
                        { id: "biz-ncell", name: "Ncell Topup Center", type: "merchant", upa: "topup@ncell.np", lastSeen: Date.now() },
                    ];
                    return [...prev, ...simMerchants];
                });
                setNfcStatus("found");
            }, 1200);
        }

        // Auto-detect for C2C: simulate nearby citizens
        if (txMode === "c2c") {
            setTimeout(() => {
                setNearbyDevices((prev) => {
                    const existing = prev.filter((d) => d.type === "citizen");
                    if (existing.length > 0) return prev;
                    const simCitizens: DetectedDevice[] = [
                        { id: "ctz-anita", name: "Anita Gurung", type: "citizen", upa: "anita.gurung@upa.np", lastSeen: Date.now() },
                        { id: "ctz-bikash", name: "Bikash Tamang", type: "citizen", upa: "bikash.tamang@upa.np", lastSeen: Date.now() },
                    ];
                    return [...prev, ...simCitizens];
                });
                setNfcStatus("found");
            }, 1200);
        }

        if (hasNativeNFC && "NDEFReader" in window) {
            try {
                const NDEFReaderClass = (window as any).NDEFReader;
                const reader = new NDEFReaderClass();
                await reader.scan();
                toast.success("NFC scanning active — hold near a terminal");
                reader.addEventListener("reading", ({ serialNumber, message }: any) => {
                    let tagData: any = {};
                    for (const record of message.records) {
                        if (record.recordType === "text") {
                            const td = new TextDecoder();
                            try { tagData = JSON.parse(td.decode(record.data)); } catch { tagData = { upa: td.decode(record.data) }; }
                        }
                    }
                    setSelectedDevice({
                        id: serialNumber || `nfc-${Date.now()}`, name: tagData.merchantName || tagData.upa || "NFC Terminal",
                        type: "merchant", upa: tagData.upa, amount: tagData.amount, lastSeen: Date.now(),
                    });
                    setNfcStatus("confirming");
                    if (navigator.vibrate) navigator.vibrate([200]);
                });
            } catch (err: any) {
                if (err.name !== "AbortError") toast.error(`NFC Error: ${err.message}`);
                setNfcStatus("ready");
            }
        } else {
            toast("Scanning for nearby devices...");
        }
    };

    const stopNFCScan = () => {
        setNfcStatus("ready");
        setNearbyDevices([]);
    };

    const selectForPayment = (device: DetectedDevice, amt?: number) => {
        const amount = amt || Number(payAmount);
        if (!amount || amount <= 0) { toast.error("Enter a valid amount first"); return; }
        if (amount > balance) { toast.error("Insufficient balance"); return; }
        setSelectedDevice({ ...device, amount });
        setNfcStatus("confirming");
    };

    const approvePayment = async () => {
        if (!selectedDevice) return;
        const amount = selectedDevice.amount || Number(payAmount);
        if (!amount || amount <= 0) { toast.error("Invalid amount"); return; }
        if (amount > balance) { toast.error("Insufficient balance"); return; }

        if (!online) {
            if (!offlineWallet.loaded) {
                toast.error("SaralPay wallet not loaded! Go to Settings to load funds for offline payments.");
                return;
            }
            if (!canSpendOffline(amount)) {
                toast.error(`Insufficient SaralPay balance! Remaining: ${formatCurrency(saralPayBalance)}`);
                return;
            }
        }

        setNfcStatus("processing");
        await new Promise((r) => setTimeout(r, 1200));

        let txType: string, intentLabel: string, intentCategory: string, intentId: string;
        if (selectedDevice.type === "government") {
            txType = "c2g";
            intentLabel = `Govt Payment — ${selectedDevice.name}`;
            intentCategory = GOV_ENTITIES.find((g) => g.id === selectedDevice.id)?.category || "fee";
            intentId = "nfc_gov_payment";
        } else if (selectedDevice.type === "merchant") {
            txType = "merchant_purchase";
            intentLabel = `NFC Payment — ${selectedDevice.name}`;
            intentCategory = "purchase";
            intentId = "nfc_purchase";
        } else {
            txType = "c2c";
            intentLabel = `NFC Transfer — ${selectedDevice.name}`;
            intentCategory = "transfer";
            intentId = "nfc_transfer";
        }

        const isOffline = !online;
        const txId = `UPA-${txType.toUpperCase().replace("MERCHANT_PURCHASE", "C2B")}-${String(Date.now()).slice(-6)}`;
        const nonce = `nfc-${txType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const txRecord = {
            id: txId, tx_id: txId, tx_type: txType as any,
            recipient: selectedDevice.upa || selectedDevice.name,
            recipientName: selectedDevice.name, fromUPA: myUPA, amount,
            intent: intentLabel, intentCategory,
            metadata: {
                payerName: myName, payerUPA: myUPA,
                paymentType: txType, deviceType: selectedDevice.type, mode: "nfc",
                nfcNative: hasNativeNFC ? "true" : "false",
                offlineQueued: isOffline ? "true" : "false",
            },
            status: (isOffline ? "queued" : "settled") as "queued" | "settled",
            mode: (isOffline ? "offline" : "nfc") as "offline" | "nfc",
            nonce, timestamp: Date.now(),
            settledAt: isOffline ? undefined : Date.now(),
            walletProvider: "upa_pay", payment_source: "wallet" as const,
        };

        if (isOffline) {
            // ═══ ACID Transaction for offline NFC payments ═══
            const queuePayload = {
                payload: JSON.stringify({
                    version: "1.0", upa: selectedDevice.upa || selectedDevice.name,
                    intent: { id: intentId, category: intentCategory, label: intentLabel },
                    tx_type: txType, amount, currency: "NPR", metadata: txRecord.metadata,
                    payer_name: myName, payer_id: myUPA || myId.current,
                    issuedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 3600000).toISOString(),
                    nonce, type: "offline",
                }),
                signature: "offline-nfc-" + txId,
                publicKey: wallet?.publicKey || "",
                timestamp: Date.now(),
                nonce,
                recipient: selectedDevice.upa || selectedDevice.name,
                amount,
                intent: intentLabel,
                metadata: txRecord.metadata,
            };

            const acidResult = await executeACIDTransaction(
                {
                    transaction: txRecord,
                    queuePayload,
                    deductAmount: amount,
                    currentBalance: balance,
                    offlineBalance: saralPayBalance,
                    consumesOfflineWallet: true,
                },
                { addTransaction, updateBalance, spendFromSaralPay }
            );

            if (!acidResult.success) {
                setNfcStatus("ready");
                toast.error(`Payment failed: ${acidResult.error}`);
                return;
            }
        } else {
            // Online: direct writes (non-journaled, best-effort API persist)
            saveLocalTransaction(txRecord);
            updateBalance(amount);
        }

        if (channelRef.current) {
            if (selectedDevice.type === "merchant") {
                channelRef.current.send({
                    type: "payment_approval",
                    customerId: myId.current, customerName: myName, customerUPA: myUPA,
                    businessId: selectedDevice.id, amount, txId, txType,
                    isOffline,
                });
            } else if (selectedDevice.type === "citizen") {
                channelRef.current.send({
                    type: "c2c_payment_complete",
                    fromCitizenId: myId.current, fromCitizenName: myName, fromUPA: myUPA,
                    toCitizenId: selectedDevice.id, toUPA: selectedDevice.upa,
                    amount, txId, isOffline,
                });
                if (selectedDevice.upa) creditUser(selectedDevice.upa, amount, txRecord);
            }
        }

        if (!isOffline) {
            try {
                if (txType === "c2c") {
                    await fetch("/api/transactions/c2c", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ fromUPA: myUPA, toUPA: selectedDevice.upa, amount, intent: intentLabel, message: `NFC ${txType}`, payerName: myName, nonce }),
                    });
                } else {
                    await fetch("/api/transactions/settle", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            payload: {
                                version: "1.0", upa: selectedDevice.upa || selectedDevice.name,
                                intent: { id: intentId, category: intentCategory, label: intentLabel },
                                tx_type: txType, amount, currency: "NPR", metadata: txRecord.metadata,
                                payer_name: myName, payer_id: myUPA || myId.current,
                                issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
                                nonce, type: "online",
                            },
                        }),
                    });
                }
            } catch { }
        }

        // For online path, manually add to wallet — ACID already handles offline
        if (!isOffline) {
            addTransaction(txRecord);
        }
        setLastTxId(txId);
        setLastTxType(txType);
        setNfcStatus("success");
        if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);

        if (isOffline) {
            toast.success(`${formatCurrency(amount)} queued for ${selectedDevice.name} [${txType.toUpperCase()}] — will sync when online`);
        } else {
            toast.success(`${formatCurrency(amount)} sent to ${selectedDevice.name} [${txType.toUpperCase()}]`);
        }
    };

    const declinePayment = () => {
        if (selectedDevice && channelRef.current) {
            channelRef.current.send({ type: "payment_decline", customerId: myId.current, businessId: selectedDevice.id });
        }
        setSelectedDevice(null);
        setNfcStatus("ready");
        toast("Payment declined");
    };

    const resetNFCState = () => {
        stopNFCScan();
        setSelectedDevice(null);
        setPayAmount("");
        setLastTxId(null);
        setLastTxType("");
    };

    // ─── Filter NFC devices ───────────────────────────────────────────
    const merchants = nearbyDevices.filter((d) => d.type === "merchant");
    const citizens = nearbyDevices.filter((d) => d.type === "citizen");
    const govEntities = nearbyDevices.filter((d) => d.type === "government");

    const modeLabel: Record<TxMode, string> = { c2b: "Pay Merchant", c2c: "Send to Person", c2g: "Pay Government" };

    const txTypeLabel = (t: string) => {
        switch (t) {
            case "c2c": return "C2C — Citizen → Citizen";
            case "c2g": return "C2G — Citizen → Government";
            case "merchant_purchase": return "C2B — Citizen → Business";
            case "b2c": return "B2C — Business → Citizen";
            default: return t.toUpperCase();
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-4 pb-24">
            {/* ─── Header ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Pay</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Scan QR or tap NFC to pay
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {nid ? (
                        <Badge variant="outline" className="text-xs">
                            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                            Verified
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-xs">
                            <Shield className="h-3.5 w-3.5 mr-1" />
                            Unverified
                        </Badge>
                    )}
                </div>
            </div>

            {/* ─── Offline Banner — SaralPay Wallet ───────────────────── */}
            {!online && (
                <Card className={`${offlineWallet.loaded ? "border-amber-300 bg-amber-50" : "border-red-300 bg-red-50"}`}>
                    <CardContent className="p-3 flex items-start gap-3">
                        <WifiOff className={`h-5 w-5 mt-0.5 shrink-0 ${offlineWallet.loaded ? "text-amber-600" : "text-red-600"}`} />
                        <div className="flex-1">
                            <p className={`text-sm font-medium ${offlineWallet.loaded ? "text-amber-800" : "text-red-800"}`}>
                                {offlineWallet.loaded ? "SaralPay Offline Wallet" : "SaralPay Not Loaded"}
                            </p>
                            {offlineWallet.loaded ? (
                                <>
                                    <p className="text-xs text-amber-700 mt-1">
                                        Payments will be deducted from your SaralPay wallet and queued for sync.
                                    </p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 font-bold">
                                            <CloudOff className="h-3 w-3 mr-1" />
                                            SaralPay Balance: {formatCurrency(saralPayBalance)}
                                        </Badge>
                                    </div>
                                </>
                            ) : (
                                <p className="text-xs text-red-700 mt-1">
                                    Load your SaralPay wallet before going offline. Go to Settings → SaralPay to load funds.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── Balance Card ───────────────────────────────────────── */}
            {!online && offlineWallet.loaded ? (
                <Card className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs text-white/70">SaralPay Offline Wallet</p>
                                <p className="text-2xl font-bold">{formatCurrency(saralPayBalance)}</p>
                                <p className="text-[10px] text-white/50 mt-1">{myUPA || "No UPA linked"}</p>
                            </div>
                            <div className="p-3 bg-white/10 rounded-2xl"><WifiOff className="h-6 w-6" /></div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs text-white/70">Available Balance</p>
                                <p className="text-2xl font-bold">{formatCurrency(balance)}</p>
                                <p className="text-[10px] text-white/50 mt-1">{myUPA || "No UPA linked"}</p>
                            </div>
                            <div className="p-3 bg-white/10 rounded-2xl"><Smartphone className="h-6 w-6" /></div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── Offline Actions ────────────────────────────────────── */}
            {!online && (
                <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
                    size="lg"
                    onClick={() => router.push("/pay/offline")}
                >
                    <Smartphone className="h-5 w-5 mr-2" />
                    Scan Cross-Device QR
                </Button>
            )}

            {/* ─── Tabs ───────────────────────────────────────────────── */}
            <div className="space-y-4">
                <div className="flex gap-2 border-b">
                    <Button
                        variant={activeMode === "qr" ? "default" : "ghost"}
                        className={`flex-1 rounded-b-none ${activeMode === "qr" ? "" : "border-b-2 border-transparent"}`}
                        onClick={() => setActiveMode("qr")}
                    >
                        <QrCode className="h-4 w-4 mr-2" />
                        QR Code
                    </Button>
                    <Button
                        variant={activeMode === "nfc" ? "default" : "ghost"}
                        className={`flex-1 rounded-b-none ${activeMode === "nfc" ? "" : "border-b-2 border-transparent"}`}
                        onClick={() => setActiveMode("nfc")}
                    >
                        <Smartphone className="h-4 w-4 mr-2" />
                        NFC Tap
                    </Button>
                </div>

                {/* ─── QR Tab ─────────────────────────────────────────── */}
                {activeMode === "qr" && (
                    <div className="space-y-4">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem" }}>
                            {/* Scanner */}
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
                                                onClick={() => { setQrError(null); setWantScan(true); }}
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

                            {/* My QR */}
                            <Card className="overflow-hidden border-2 border-primary/20" style={{ flex: "1 1 340px", minWidth: 0 }}>
                                <CardHeader className="pb-2 border-b bg-primary/5">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <QrCode className="h-4 w-4 text-primary" />
                                        My QR
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-3">
                                    <div className="flex flex-col items-center text-center gap-3">
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
                                        <div className="bg-white rounded-xl p-3 shadow-sm border inline-block">
                                            <UserQRImage value={userQRPayload} size={200} />
                                        </div>
                                        <p className="text-xs text-muted-foreground max-w-[240px]">
                                            Share this QR to receive payments via C2C
                                        </p>
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

                        {/* Error Display */}
                        {qrError && (
                            <Card className="border-destructive/50 bg-destructive/5">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                                    <p className="text-sm text-destructive">{qrError}</p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="ml-auto text-destructive hover:text-destructive"
                                        onClick={() => setQrError(null)}
                                    >
                                        Dismiss
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* UPA Address Lookup */}
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
                                        onChange={(e) => { setUpaInput(e.target.value); setMatchedUpa(null); setQrError(null); }}
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
                )}

                {/* ─── NFC Tab ────────────────────────────────────────── */}
                {activeMode === "nfc" && (
                    <div className="space-y-4">
                        {/* Mode Selector */}
                        <div className="flex gap-2">
                            {(["c2b", "c2c", "c2g"] as TxMode[]).map((mode) => (
                                <Button
                                    key={mode}
                                    variant={txMode === mode ? "default" : "outline"}
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => { setTxMode(mode); resetNFCState(); }}
                                >
                                    {mode === "c2b" && <Building2 className="h-4 w-4 mr-1" />}
                                    {mode === "c2c" && <Users className="h-4 w-4 mr-1" />}
                                    {mode === "c2g" && <Landmark className="h-4 w-4 mr-1" />}
                                    <span className="text-xs">{mode === "c2b" ? "Merchant" : mode === "c2c" ? "Person" : "Govt"}</span>
                                </Button>
                            ))}
                        </div>

                        {/* Amount input */}
                        {!["confirming", "processing", "success"].includes(nfcStatus) && (
                            <Card>
                                <CardContent className="p-3">
                                    <label className="text-xs text-muted-foreground mb-1 block">Amount (NPR) — {modeLabel[txMode]}</label>
                                    <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Enter amount" />
                                </CardContent>
                            </Card>
                        )}

                        {/* NFC Action Area */}
                        <Card className={`transition-all duration-500 ${nfcStatus === "scanning" || nfcStatus === "found" ? "border-blue-400 bg-blue-50/50"
                            : nfcStatus === "confirming" ? "border-amber-400 bg-amber-50/50"
                                : nfcStatus === "processing" ? "border-purple-400 bg-purple-50/50"
                                    : nfcStatus === "success" ? "border-green-400 bg-green-50/50"
                                        : nfcStatus === "error" ? "border-red-400 bg-red-50/50"
                                            : "border-dashed"
                            }`}>
                            <CardContent className="p-6 text-center">
                                {/* Ready */}
                                {nfcStatus === "ready" && (
                                    <>
                                        <div className="mx-auto w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-4">
                                            {txMode === "c2g" ? <Landmark className="h-12 w-12 text-purple-600" />
                                                : txMode === "c2c" ? <Users className="h-12 w-12 text-purple-600" />
                                                    : <Smartphone className="h-12 w-12 text-purple-600" />}
                                        </div>
                                        <h3 className="text-lg font-semibold mb-1">{modeLabel[txMode]}</h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            {txMode === "c2b" ? "Open /merchant/nfc on another device or tab"
                                                : txMode === "c2c" ? "Another citizen opens /pay on their phone (NFC tab)"
                                                    : "Scan to see government payment entities"}
                                        </p>
                                        <Button onClick={startNFCScan} className="bg-purple-600 hover:bg-purple-700">
                                            <Smartphone className="h-4 w-4 mr-2" />
                                            Start Scanning
                                        </Button>
                                    </>
                                )}

                                {/* Scanning, no devices */}
                                {nfcStatus === "scanning" && nearbyDevices.length === 0 && (
                                    <>
                                        <div className="mx-auto w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-4 relative">
                                            <Smartphone className="h-12 w-12 text-blue-600" />
                                            <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-30" />
                                            <span className="absolute inset-[-8px] rounded-full border border-blue-300 animate-ping opacity-20" style={{ animationDelay: "0.5s" }} />
                                        </div>
                                        <h3 className="text-lg font-semibold text-blue-700 mb-1">Scanning...</h3>
                                        <p className="text-sm text-blue-600 mb-4">
                                            {txMode === "c2b" ? "Open /merchant/nfc on another device"
                                                : txMode === "c2c" ? "Other citizen opens /pay on their device (NFC tab)"
                                                    : "Loading government entities..."}
                                        </p>
                                        <Button variant="outline" size="sm" onClick={stopNFCScan}>Cancel</Button>
                                    </>
                                )}

                                {/* Found devices */}
                                {(nfcStatus === "scanning" || nfcStatus === "found") && nearbyDevices.length > 0 && (
                                    <>
                                        <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                            <Zap className="h-10 w-10 text-blue-600" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-blue-700 mb-3">
                                            {txMode === "c2b" ? "Merchants Found" : txMode === "c2c" ? "People Nearby" : "Government Entities"}
                                        </h3>
                                        <div className="space-y-2 text-left">
                                            {txMode === "c2b" && merchants.map((d) => (
                                                <div key={d.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="h-4 w-4 text-blue-600" />
                                                        <div>
                                                            <span className="text-sm font-medium">{d.name}</span>
                                                            {d.upa && <p className="text-[10px] text-muted-foreground">{d.upa}</p>}
                                                        </div>
                                                    </div>
                                                    {payAmount && Number(payAmount) > 0 ? (
                                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs" onClick={() => selectForPayment(d)}>
                                                            Pay {formatCurrency(Number(payAmount))}
                                                        </Button>
                                                    ) : <Badge variant="outline" className="text-[10px]">Enter amount</Badge>}
                                                </div>
                                            ))}

                                            {txMode === "c2c" && citizens.map((d) => (
                                                <div key={d.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                                                    <div className="flex items-center gap-2">
                                                        <Users className="h-4 w-4 text-green-600" />
                                                        <div>
                                                            <span className="text-sm font-medium">{d.name}</span>
                                                            {d.upa && <p className="text-[10px] text-muted-foreground">{d.upa}</p>}
                                                        </div>
                                                    </div>
                                                    {payAmount && Number(payAmount) > 0 ? (
                                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" onClick={() => selectForPayment(d)}>
                                                            Send {formatCurrency(Number(payAmount))}
                                                        </Button>
                                                    ) : <Badge variant="outline" className="text-[10px]">Enter amount</Badge>}
                                                </div>
                                            ))}

                                            {txMode === "c2g" && govEntities.map((d) => (
                                                <div key={d.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                                                    <div className="flex items-center gap-2">
                                                        <Landmark className="h-4 w-4 text-red-600" />
                                                        <div>
                                                            <span className="text-sm font-medium">{d.name}</span>
                                                            {d.upa && <p className="text-[10px] text-muted-foreground">{d.upa}</p>}
                                                        </div>
                                                    </div>
                                                    {payAmount && Number(payAmount) > 0 ? (
                                                        <Button size="sm" className="bg-red-600 hover:bg-red-700 text-xs" onClick={() => selectForPayment(d)}>
                                                            Pay {formatCurrency(Number(payAmount))}
                                                        </Button>
                                                    ) : <Badge variant="outline" className="text-[10px]">Enter amount</Badge>}
                                                </div>
                                            ))}
                                        </div>
                                        <Button variant="outline" size="sm" className="mt-4" onClick={stopNFCScan}>Cancel</Button>
                                    </>
                                )}

                                {/* Confirm */}
                                {nfcStatus === "confirming" && selectedDevice && (
                                    <>
                                        <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                                            <Fingerprint className="h-10 w-10 text-amber-600" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-amber-800 mb-1">Confirm Payment</h3>
                                        <div className="bg-white rounded-xl border p-4 my-4 text-left space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">To:</span>
                                                <span className="font-medium">{selectedDevice.name}</span>
                                            </div>
                                            {selectedDevice.upa && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">UPA:</span>
                                                    <span className="text-xs font-mono">{selectedDevice.upa}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Amount:</span>
                                                <span className="font-bold text-lg">{formatCurrency(selectedDevice.amount || 0)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Type:</span>
                                                <Badge variant="secondary" className="text-[10px]">
                                                    {selectedDevice.type === "merchant" ? "C2B" : selectedDevice.type === "government" ? "C2G" : "C2C"}
                                                </Badge>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Balance after:</span>
                                                <span>{formatCurrency(balance - (selectedDevice.amount || 0))}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <Button variant="outline" className="flex-1" onClick={declinePayment}>Decline</Button>
                                            <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={approvePayment}>
                                                <Fingerprint className="h-4 w-4 mr-2" /> Approve
                                            </Button>
                                        </div>
                                    </>
                                )}

                                {/* Processing */}
                                {nfcStatus === "processing" && (
                                    <>
                                        <div className="mx-auto w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                                            <RefreshCw className="h-12 w-12 text-purple-600 animate-spin" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-purple-700 mb-1">Processing...</h3>
                                        <p className="text-sm text-purple-600">Authenticating & settling payment</p>
                                    </>
                                )}

                                {/* Success */}
                                {nfcStatus === "success" && (
                                    <>
                                        <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-4 ${!online ? "bg-amber-100" : "bg-green-100"}`}>
                                            {!online ? (
                                                <CloudOff className="h-14 w-14 text-amber-600" />
                                            ) : (
                                                <CheckCircle2 className="h-14 w-14 text-green-600" />
                                            )}
                                        </div>
                                        <h3 className={`text-lg font-semibold mb-1 ${!online ? "text-amber-700" : "text-green-700"}`}>
                                            {!online ? "Payment Queued!" : "Payment Successful!"}
                                        </h3>
                                        <p className={`text-sm mb-1 ${!online ? "text-amber-600" : "text-green-600"}`}>
                                            {formatCurrency(selectedDevice?.amount || 0)} {!online ? "queued for" : "sent to"} {selectedDevice?.name}
                                        </p>
                                        {!online && (
                                            <p className="text-xs text-amber-500 mb-2">
                                                Will auto-settle when you&apos;re back online
                                            </p>
                                        )}
                                        {lastTxId && (
                                            <div className="my-3 bg-white rounded-lg border p-3 text-left space-y-1">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">TX ID:</span>
                                                    <span className="font-mono">{lastTxId}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">Type:</span>
                                                    <Badge variant="outline" className="text-[10px]">{txTypeLabel(lastTxType)}</Badge>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">Status:</span>
                                                    {!online ? (
                                                        <Badge className="bg-amber-100 text-amber-700 text-[10px]">Queued (Offline)</Badge>
                                                    ) : (
                                                        <Badge className="bg-green-100 text-green-700 text-[10px]">Settled</Badge>
                                                    )}
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">Mode:</span>
                                                    <span>{!online ? "NFC (Offline)" : "NFC"}</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex gap-3 justify-center">
                                            <Button variant="outline" size="sm" onClick={resetNFCState}>New Payment</Button>
                                            <Button size="sm" onClick={() => router.push("/")}>Home</Button>
                                        </div>
                                    </>
                                )}

                                {/* Error */}
                                {nfcStatus === "error" && (
                                    <>
                                        <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                            <XCircle className="h-10 w-10 text-red-600" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-red-700 mb-1">Payment Failed</h3>
                                        <p className="text-sm text-red-600 mb-4">Something went wrong.</p>
                                        <Button variant="outline" onClick={resetNFCState}>Try Again</Button>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
