"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNetwork } from "@/hooks/use-network";
import { RouteGuard } from "@/components/route-guard";
import { Camera, Clipboard, Keyboard, XCircle } from "lucide-react";

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
    const [pasteData, setPasteData] = useState("");
    const scannerRef = useRef<any>(null);
    const scannerContainerId = "qr-reader";

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
                // Wait for next paint so the div has real dimensions
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

                if (cancelled) return;

                const { Html5Qrcode } = await import("html5-qrcode");

                // Clean up any previous scanner instance
                if (scannerRef.current) {
                    try { await scannerRef.current.stop(); } catch {}
                }

                const scanner = new Html5Qrcode(scannerContainerId);
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
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
            if (!parsed.upa || !parsed.amount) {
                setError("Invalid QR code format");
                return;
            }
            router.push(`/pay/confirm?data=${encodeURIComponent(data)}`);
        } catch {
            setError("Could not parse QR code data");
        }
    };

    const handlePaste = () => {
        if (pasteData.trim()) {
            handleScannedData(pasteData.trim());
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div>
                <h2 className="text-2xl font-semibold">Scan QR Code</h2>
                <p className="text-sm text-muted-foreground">
                    Point your camera at a UPA payment QR code
                </p>
            </div>

            {/* Camera Scanner */}
            <Card>
                <CardContent className="p-4">
                    {/* Container is rendered when user wants to scan, giving it real dimensions */}
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
                <Card className="border-danger/50 bg-danger/5">
                    <CardContent className="p-4 text-sm text-danger">
                        {error}
                    </CardContent>
                </Card>
            )}

            {/* Manual Input */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Keyboard className="h-4 w-4" />
                        Manual Input
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                    <Input
                        placeholder="Paste QR payload JSON..."
                        value={pasteData}
                        onChange={(e) => setPasteData(e.target.value)}
                    />
                    <Button variant="outline" className="w-full" onClick={handlePaste} disabled={!pasteData.trim()}>
                        <Clipboard className="h-4 w-4 mr-2" />
                        Process Payload
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

