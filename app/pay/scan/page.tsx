"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { NetworkStatus } from "@/components/network-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNetwork } from "@/hooks/use-network";
import { ArrowLeft, Camera, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ScanPage() {
    const router = useRouter();
    const { online } = useNetwork();
    const [scanning, setScanning] = useState(false);
    const [scannedData, setScannedData] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    const startScanning = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setScanning(true);
            }
        } catch (err) {
            console.error("Camera access error:", err);
            // Fallback: Manual QR entry
            const manualQR = prompt("Enter QR code data manually:");
            if (manualQR) {
                handleScannedData(manualQR);
            }
        }
    };

    const stopScanning = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setScanning(false);
    };

    const handleScannedData = (data: string) => {
        setScannedData(data);
        stopScanning();
        // Parse QR data and navigate to confirmation
        try {
            const parsed = JSON.parse(data);
            router.push(
                `/pay/confirm?data=${encodeURIComponent(JSON.stringify(parsed))}`
            );
        } catch {
            router.push(`/pay/confirm?qr=${encodeURIComponent(data)}`);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-10 border-b border-border bg-surface">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/pay">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <h1 className="text-xl font-semibold">Scan Payment QR</h1>
                    <div className="w-10" />
                </div>
            </header>

            <main className="container mx-auto px-4 py-6">
                <div className="space-y-6">
                    {/* Camera View */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="relative aspect-square bg-black rounded-t-lg overflow-hidden">
                                {scanning ? (
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Camera className="h-16 w-16 text-muted-foreground" />
                                    </div>
                                )}
                                {scanning && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="border-2 border-primary rounded-lg w-64 h-64" />
                                    </div>
                                )}
                            </div>
                            <div className="p-4 space-y-2">
                                <p className="text-sm text-center text-muted-foreground">
                                    Point camera at UPA-NP QR
                                </p>
                                <div className="flex items-center justify-center gap-2">
                                    <NetworkStatus />
                                </div>
                                <p className="text-xs text-center text-muted-foreground">
                                    Offline verification: Ready
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="space-y-2">
                        {!scanning ? (
                            <Button className="w-full" onClick={startScanning}>
                                <Camera className="h-5 w-5 mr-2" />
                                Start Scanning
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={stopScanning}
                            >
                                Stop Scanning
                            </Button>
                        )}
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={() => {
                                const manual = prompt("Enter QR code data:");
                                if (manual) handleScannedData(manual);
                            }}
                        >
                            Enter QR Manually
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={async () => {
                                try {
                                    const text = await navigator.clipboard.readText();
                                    if (text) {
                                        handleScannedData(text);
                                    }
                                } catch {
                                    const manual = prompt("Paste QR code data:");
                                    if (manual) handleScannedData(manual);
                                }
                            }}
                        >
                            Paste QR Data
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}

