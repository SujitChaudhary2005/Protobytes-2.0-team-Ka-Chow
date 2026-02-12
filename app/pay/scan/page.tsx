"use client";

import { useState, useEffect, useRef } from "react";
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
import { useNetwork } from "@/hooks/use-network";
import { RouteGuard } from "@/components/route-guard";
import { Camera, Search, Keyboard, XCircle, Loader2 } from "lucide-react";
import type { UPA } from "@/types";

export default function ScanPageWrapper() {
    return (
        <RouteGuard allowedRoles={["citizen"]}>
            <ScanPage />
        </RouteGuard>
    );
}

function ScanPage() {
    const router = useRouter();
    const { online } = useNetwork();
    const [wantScan, setWantScan] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // UPA manual lookup
    const [upaInput, setUpaInput] = useState("");
    const [upas, setUpas] = useState<UPA[]>([]);
    const [matchedUpa, setMatchedUpa] = useState<UPA | null>(null);
    const [selectedIntentCode, setSelectedIntentCode] = useState("");
    const [lookingUp, setLookingUp] = useState(false);

    const scannerRef = useRef<any>(null);
    const scannerContainerId = "qr-reader";

    // Load all UPAs for lookup
    useEffect(() => {
        fetch("/api/upas")
            .then((r) => r.json())
            .then((res) => setUpas(res.data || []))
            .catch(console.error);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
                scannerRef.current = null;
            }
        };
    }, []);

    // Start scanner AFTER the container div is rendered and visible
    useEffect(() => {
        if (!wantScan || scanning) return;

        let cancelled = false;

        const initScanner = async () => {
            try {
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                if (cancelled) return;

                const { Html5Qrcode } = await import("html5-qrcode");

                if (scannerRef.current) {
                    try { await scannerRef.current.stop(); } catch {}
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
                    () => {}
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
        } catch {}
        setScanning(false);
        setWantScan(false);
    };

    const handleScannedData = (data: string) => {
        try {
            const parsed = JSON.parse(data);
            // Accept StaticQRPayload — requires upa field, amount is optional
            if (!parsed.upa) {
                setError("Invalid QR code — no UPA address found");
                return;
            }
            router.push(`/pay/confirm?data=${encodeURIComponent(data)}`);
        } catch {
            // If it's not JSON, treat it as a plain UPA address
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
            // Build a StaticQRPayload from the first intent and navigate
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

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div>
                <h2 className="text-2xl font-semibold">Scan & Pay</h2>
                <p className="text-sm text-muted-foreground">
                    Scan a QR code or enter a UPA address to pay
                </p>
            </div>

            {/* Camera Scanner */}
            <Card>
                <CardContent className="p-4">
                    {wantScan ? (
                        <>
                            <div
                                id={scannerContainerId}
                                className="w-full rounded-lg overflow-hidden mb-4"
                                style={{ minHeight: 300 }}
                            />
                            <Button variant="outline" className="w-full" onClick={stopScanning}>
                                <XCircle className="h-4 w-4 mr-2" />
                                Stop Camera
                            </Button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <Camera className="h-12 w-12 text-muted-foreground/30" />
                            <Button
                                onClick={() => { setError(null); setWantScan(true); }}
                                size="lg"
                            >
                                <Camera className="h-4 w-4 mr-2" />
                                Start Camera
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {error && (
                <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-4 text-sm text-destructive">
                        {error}
                    </CardContent>
                </Card>
            )}

            {/* UPA Address Input */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Keyboard className="h-4 w-4" />
                        Pay by UPA Address
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
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

