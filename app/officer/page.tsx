"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QRCodeDisplay } from "@/components/qr-code";
import { generateKeyPair, signPayload, generateNonce, keyToHex } from "@/lib/crypto";
import { toast } from "sonner";
import { QrCode, Download, Wifi, WifiOff, Copy, Check } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { UPA, IntentTemplate, OnlineQRPayload, OfflineQRPayload } from "@/types";

export default function OfficerPage() {

    const [loading, setLoading] = useState(false);
    const [upas, setUpas] = useState<UPA[]>([]);
    const [selectedUpa, setSelectedUpa] = useState<UPA | null>(null);
    const [selectedIntent, setSelectedIntent] = useState<IntentTemplate | null>(null);
    const [qrData, setQrData] = useState<string | null>(null);
    const [qrMode, setQrMode] = useState<"online" | "offline">("online");
    const [amount, setAmount] = useState("");
    const [payerName, setPayerName] = useState("");
    const [payerId, setPayerId] = useState("");
    const [metadata, setMetadata] = useState<Record<string, string>>({});
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetch("/api/upas")
            .then((r) => r.json())
            .then((res) => {
                setUpas(res.data || []);
                if (res.data?.[0]) {
                    setSelectedUpa(res.data[0]);
                    if (res.data[0].intents?.[0]) {
                        handleIntentSelect(res.data[0].intents[0]);
                    }
                }
            })
            .catch(console.error);
    }, []);

    const handleUpaSelect = (address: string) => {
        const upa = upas.find((u) => u.address === address);
        if (upa) {
            setSelectedUpa(upa);
            setSelectedIntent(null);
            setMetadata({});
            setAmount("");
            if (upa.intents?.[0]) handleIntentSelect(upa.intents[0]);
        }
    };

    const handleIntentSelect = (intent: IntentTemplate) => {
        setSelectedIntent(intent);
        if (intent.amount_type === "fixed" && intent.fixed_amount) {
            setAmount(String(intent.fixed_amount));
        } else {
            setAmount("");
        }
        const newMetadata: Record<string, string> = {};
        if (intent.metadata_schema) {
            Object.keys(intent.metadata_schema).forEach((key) => {
                newMetadata[key] = "";
            });
        }
        setMetadata(newMetadata);
    };

    const handleGenerateQR = () => {
        if (!selectedUpa || !selectedIntent) {
            toast.error("Missing Selection", { description: "Please select a UPA and intent" });
            return;
        }
        if (!amount || parseFloat(amount) <= 0) {
            toast.error("Invalid Amount", { description: "Please enter a valid amount" });
            return;
        }
        if (!payerName || !payerId) {
            toast.error("Missing Payer Info", { description: "Please enter payer name and ID" });
            return;
        }

        if (selectedIntent.amount_type === "range") {
            const amt = parseFloat(amount);
            if (selectedIntent.min_amount && amt < selectedIntent.min_amount) {
                toast.error("Amount Too Low", { description: `Minimum: NPR ${selectedIntent.min_amount}` });
                return;
            }
            if (selectedIntent.max_amount && amt > selectedIntent.max_amount) {
                toast.error("Amount Too High", { description: `Maximum: NPR ${selectedIntent.max_amount}` });
                return;
            }
        }

        setLoading(true);
        try {
            const nonce = generateNonce();
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

            const basePayload: OnlineQRPayload = {
                version: "1.0",
                type: "online",
                upa: selectedUpa.address,
                intent: {
                    id: selectedIntent.intent_code,
                    category: selectedIntent.category,
                    label: selectedIntent.label,
                },
                amount: parseFloat(amount),
                currency: "NPR",
                metadata: { ...metadata, payerName, payerId },
                payer_name: payerName,
                payer_id: payerId,
                issuedAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                nonce,
            };

            let finalPayload: OnlineQRPayload | OfflineQRPayload;

            if (qrMode === "offline") {
                const { publicKey, privateKey } = generateKeyPair();
                const signature = signPayload(basePayload, privateKey);
                finalPayload = {
                    ...basePayload,
                    type: "offline",
                    signature,
                    publicKey: keyToHex(publicKey),
                } as OfflineQRPayload;
            } else {
                finalPayload = basePayload;
            }

            setQrData(JSON.stringify(finalPayload));
            toast.success("QR Code Generated", {
                description: `${qrMode === "offline" ? "Signed offline" : "Online"} payment request ready`,
            });
        } catch (err: any) {
            toast.error("Generation Failed", { description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleCopyQR = async () => {
        if (qrData) {
            await navigator.clipboard.writeText(qrData);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success("Copied!", { description: "QR payload copied to clipboard" });
        }
    };

    const handleDownloadQR = () => {
        const canvas = document.querySelector("#qr-canvas canvas") as HTMLCanvasElement;
        if (canvas) {
            const link = document.createElement("a");
            link.download = `UPA-QR-${selectedIntent?.intent_code || "payment"}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            toast.success("Downloaded", { description: "QR code saved as PNG" });
        }
    };

    return (
        <div className="p-4 md:p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-semibold">Officer Portal</h2>
                <p className="text-sm text-muted-foreground">Generate intent-locked payment QR codes</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Form */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Payment Request</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* QR Mode Toggle */}
                            <div className="space-y-2">
                                <Label>QR Mode</Label>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant={qrMode === "online" ? "default" : "outline"}
                                        className="flex-1"
                                        onClick={() => setQrMode("online")}
                                        size="sm"
                                    >
                                        <Wifi className="h-4 w-4 mr-1.5" />
                                        Online
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={qrMode === "offline" ? "default" : "outline"}
                                        className="flex-1"
                                        onClick={() => setQrMode("offline")}
                                        size="sm"
                                    >
                                        <WifiOff className="h-4 w-4 mr-1.5" />
                                        Offline
                                    </Button>
                                </div>
                                {qrMode === "offline" && (
                                    <p className="text-xs text-accent font-medium">
                                        Ed25519 signature will be embedded
                                    </p>
                                )}
                            </div>

                            {/* UPA Address */}
                            <div className="space-y-2">
                                <Label>UPA Address</Label>
                                <Select value={selectedUpa?.address || ""} onValueChange={handleUpaSelect}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select UPA" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {upas.map((upa) => (
                                            <SelectItem key={upa.address} value={upa.address}>
                                                {upa.entity_name} ({upa.address})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Intent Type */}
                            <div className="space-y-2">
                                <Label>Intent Type</Label>
                                <Select
                                    value={selectedIntent?.intent_code || ""}
                                    onValueChange={(code) => {
                                        const intent = selectedUpa?.intents.find((i) => i.intent_code === code);
                                        if (intent) handleIntentSelect(intent);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Intent" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(selectedUpa?.intents || []).map((intent) => (
                                            <SelectItem key={intent.intent_code} value={intent.intent_code}>
                                                {intent.label} ({intent.category})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Amount */}
                            <div className="space-y-2">
                                <Label>Amount (NPR)</Label>
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder={
                                        selectedIntent?.amount_type === "fixed"
                                            ? String(selectedIntent.fixed_amount)
                                            : selectedIntent?.min_amount
                                            ? `${selectedIntent.min_amount} - ${selectedIntent.max_amount}`
                                            : "Enter amount"
                                    }
                                    disabled={selectedIntent?.amount_type === "fixed"}
                                />
                                {selectedIntent?.amount_type === "range" && (
                                    <p className="text-xs text-muted-foreground">
                                        Range: NPR {selectedIntent.min_amount} - {selectedIntent.max_amount}
                                    </p>
                                )}
                            </div>

                            {/* Payer Info */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Payer Name</Label>
                                    <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Ram Thapa" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Payer ID</Label>
                                    <Input value={payerId} onChange={(e) => setPayerId(e.target.value)} placeholder="License #" />
                                </div>
                            </div>

                            {/* Dynamic Metadata Fields */}
                            {selectedIntent?.metadata_schema && Object.keys(selectedIntent.metadata_schema).length > 0 && (
                                <div className="space-y-3 pt-3 border-t">
                                    <Label className="text-xs font-semibold text-primary uppercase tracking-wider">
                                        Intent-Specific Fields
                                    </Label>
                                    {Object.entries(selectedIntent.metadata_schema).map(([key, field]) => (
                                        <div key={key} className="space-y-1">
                                            <Label className="text-sm">
                                                {field.label}
                                                {field.required && <span className="text-danger ml-1">*</span>}
                                            </Label>
                                            <Input
                                                value={metadata[key] || ""}
                                                onChange={(e) => setMetadata({ ...metadata, [key]: e.target.value })}
                                                placeholder={field.label}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Button className="w-full" onClick={handleGenerateQR} disabled={loading}>
                                <QrCode className="h-4 w-4 mr-2" />
                                {loading ? "Generating..." : `Generate ${qrMode === "offline" ? "Signed " : ""}QR Code`}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* QR Display */}
                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Payment QR Code</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {qrData ? (
                                <div className="space-y-4">
                                    <div id="qr-canvas" className="flex justify-center p-4 bg-white rounded-lg border">
                                        <QRCodeDisplay value={qrData} size={260} />
                                    </div>

                                    <div className="bg-muted/50 border rounded-lg p-3 max-h-40 overflow-y-auto">
                                        <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                                            {JSON.stringify(JSON.parse(qrData), null, 2)}
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1" size="sm" onClick={handleDownloadQR}>
                                            <Download className="h-4 w-4 mr-1.5" />
                                            Download
                                        </Button>
                                        <Button variant="outline" className="flex-1" size="sm" onClick={handleCopyQR}>
                                            {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                                            {copied ? "Copied!" : "Copy"}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                                    <QrCode className="h-12 w-12 opacity-20" />
                                    <p className="text-sm">Generate a QR code to display it here</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

