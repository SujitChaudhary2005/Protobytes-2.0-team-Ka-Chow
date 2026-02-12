"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QRCodeDisplay } from "@/components/qr-code";
import { createSignedPaymentRequest } from "@/lib/crypto";
import { createPaymentRequest } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Download, Wifi, WifiOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function OfficerPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [qrData, setQrData] = useState<string | null>(null);
    const [qrMode, setQrMode] = useState<"online" | "offline">("online");
    const [formData, setFormData] = useState({
        recipient: "traffic@nepal.gov",
        recipientName: "Nepal Traffic Police",
        amount: "",
        intent: "Traffic Violation Fine",
        license: "",
        violation: "",
        officer: "",
        vehicle: "",
        location: "",
    });

    // Mock UPA data (in production, fetch from API)
    const upas = [
        { address: "traffic@nepal.gov", name: "Nepal Traffic Police" },
        { address: "revenue@lalitpur.gov.np", name: "Lalitpur Municipality" },
        { address: "fee@tribhuvan.edu.np", name: "Tribhuvan University" },
    ];

    // Mock intents (filtered by UPA in production)
    const intents = [
        { code: "traffic_fine", label: "Traffic Violation Fine" },
        { code: "property_tax", label: "Property Tax" },
        { code: "tuition_fee", label: "Tuition Fee" },
        { code: "license_fee", label: "License Fee" },
    ];

    const handleGenerateQR = async () => {
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast({
                variant: "destructive",
                title: "Invalid Amount",
                description: "Please enter a valid amount",
            });
            return;
        }

        setLoading(true);
        try {
            // Generate key pair for officer (in production, use stored keys)
            const { ed25519 } = await import("@noble/ed25519");
            const privateKey = ed25519.utils.randomPrivateKey();

            const signedRequest = await createSignedPaymentRequest(
                {
                    recipient: formData.recipient,
                    amount: parseFloat(formData.amount),
                    intent: formData.intent,
                    metadata: {
                        license: formData.license,
                        violation: formData.violation,
                        officer: formData.officer,
                        vehicle: formData.vehicle,
                        location: formData.location,
                    },
                },
                privateKey
            );

            // Create QR data
            const qrPayload = JSON.stringify({
                ...signedRequest,
                recipientName: formData.recipientName,
            });

            setQrData(qrPayload);

            // Optionally save to database
            try {
                await createPaymentRequest({
                    recipient: formData.recipient,
                    recipient_name: formData.recipientName,
                    amount: parseFloat(formData.amount),
                    intent: formData.intent,
                    metadata: {
                        license: formData.license,
                        violation: formData.violation,
                        officer: formData.officer,
                        vehicle: formData.vehicle,
                        location: formData.location,
                    },
                    qr_data: qrPayload,
                    signature: signedRequest.signature,
                    public_key: signedRequest.publicKey,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                });
            } catch (err) {
                console.error("Database save error:", err);
            }

            toast({
                variant: "success",
                title: "QR Code Generated",
                description: "Payment request is ready",
            });
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Generation Failed",
                description: err.message,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border bg-surface">
                <div className="container mx-auto px-4 py-4">
                    <h1 className="text-2xl font-semibold">Officer Portal</h1>
                    <p className="text-sm text-muted-foreground">
                        Generate payment request QR codes
                    </p>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6">
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Form */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Payment Request Form</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="qrMode">QR Mode</Label>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant={qrMode === "online" ? "default" : "outline"}
                                            className="flex-1"
                                            onClick={() => setQrMode("online")}
                                        >
                                            <Wifi className="h-4 w-4 mr-2" />
                                            Online
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={qrMode === "offline" ? "default" : "outline"}
                                            className="flex-1"
                                            onClick={() => setQrMode("offline")}
                                        >
                                            <WifiOff className="h-4 w-4 mr-2" />
                                            Offline (Signed)
                                        </Button>
                                    </div>
                                    {qrMode === "offline" && (
                                        <p className="text-xs text-muted-foreground">
                                            Offline mode generates cryptographically signed QR codes
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="recipient">UPA Address</Label>
                                    <Select
                                        value={formData.recipient}
                                        onValueChange={(value) => {
                                            const upa = upas.find((u) => u.address === value);
                                            setFormData({
                                                ...formData,
                                                recipient: value,
                                                recipientName: upa?.name || "",
                                            });
                                        }}
                                    >
                                        <SelectTrigger id="recipient">
                                            <SelectValue placeholder="Select UPA" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {upas.map((upa) => (
                                                <SelectItem key={upa.address} value={upa.address}>
                                                    {upa.name} ({upa.address})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="intent">Intent Type</Label>
                                    <Select
                                        value={formData.intent}
                                        onValueChange={(value) =>
                                            setFormData({ ...formData, intent: value })
                                        }
                                    >
                                        <SelectTrigger id="intent">
                                            <SelectValue placeholder="Select Intent" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {intents.map((intent) => (
                                                <SelectItem key={intent.code} value={intent.label}>
                                                    {intent.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="amount">Amount (NPR)</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        value={formData.amount}
                                        onChange={(e) =>
                                            setFormData({ ...formData, amount: e.target.value })
                                        }
                                        placeholder="500"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="intent">Intent</Label>
                                    <Input
                                        id="intent"
                                        value={formData.intent}
                                        onChange={(e) =>
                                            setFormData({ ...formData, intent: e.target.value })
                                        }
                                        placeholder="Traffic Violation Fine"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="license">License Number</Label>
                                    <Input
                                        id="license"
                                        value={formData.license}
                                        onChange={(e) =>
                                            setFormData({ ...formData, license: e.target.value })
                                        }
                                        placeholder="ABC-1234"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="violation">Violation</Label>
                                    <Input
                                        id="violation"
                                        value={formData.violation}
                                        onChange={(e) =>
                                            setFormData({ ...formData, violation: e.target.value })
                                        }
                                        placeholder="Red Zone Parking"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="officer">Officer ID</Label>
                                    <Input
                                        id="officer"
                                        value={formData.officer}
                                        onChange={(e) =>
                                            setFormData({ ...formData, officer: e.target.value })
                                        }
                                        placeholder="OFF-789"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="vehicle">Vehicle Number</Label>
                                    <Input
                                        id="vehicle"
                                        value={formData.vehicle}
                                        onChange={(e) =>
                                            setFormData({ ...formData, vehicle: e.target.value })
                                        }
                                        placeholder="BA 1 PA 4567"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="location">Location</Label>
                                    <Input
                                        id="location"
                                        value={formData.location}
                                        onChange={(e) =>
                                            setFormData({ ...formData, location: e.target.value })
                                        }
                                        placeholder="Kathmandu"
                                    />
                                </div>

                                <Button
                                    className="w-full"
                                    onClick={handleGenerateQR}
                                    disabled={loading}
                                >
                                    <QrCode className="h-4 w-4 mr-2" />
                                    {loading ? "Generating..." : "Generate QR Code"}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* QR Display */}
                    <div>
                        <Card>
                            <CardHeader>
                                <CardTitle>Payment QR Code</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {qrData ? (
                                    <div className="space-y-4">
                                        <div className="flex justify-center p-4 bg-surface rounded-lg">
                                            <QRCodeDisplay value={qrData} size={256} />
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => {
                                                const link = document.createElement("a");
                                                link.href = `data:image/png;base64,${qrData}`;
                                                link.download = "payment-qr.png";
                                                link.click();
                                            }}
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            Download QR
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                                        <p>Generate a QR code to display it here</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}

