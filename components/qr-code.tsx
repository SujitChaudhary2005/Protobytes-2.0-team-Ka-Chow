"use client";

import { useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";

interface QRCodeProps {
    value: string;
    size?: number;
    className?: string;
    /** Called with the base64 PNG data URI after the QR is rendered */
    onRendered?: (dataUrl: string) => void;
}

export function QRCodeDisplay({ value, size = 256, className, onRendered }: QRCodeProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current && value) {
            QRCode.toCanvas(canvasRef.current, value, {
                width: size,
                margin: 2,
                errorCorrectionLevel: "H",   // highest correction → most scannable
                color: {
                    dark: "#000000",
                    light: "#FFFFFF",
                },
            })
                .then(() => {
                    if (canvasRef.current && onRendered) {
                        onRendered(canvasRef.current.toDataURL("image/png"));
                    }
                })
                .catch((err) => {
                    console.error("QR generation error:", err);
                });
        }
    }, [value, size, onRendered]);

    if (!value) return null;

    return (
        <div className={className}>
            <canvas ref={canvasRef} className="w-full h-auto" />
        </div>
    );
}

/**
 * Upload a QR code image to Supabase Storage via the API route.
 * Returns the public URL of the stored image.
 */
export async function uploadQRToStorage(
    dataUrl: string,
    upa: string,
    intentCode: string
): Promise<string | null> {
    try {
        const filename = `${upa}-${intentCode}.png`;
        const res = await fetch("/api/qr/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl, filename }),
        });
        const result = await res.json();
        if (result.success) return result.url;
        console.error("QR upload failed:", result.error);
        return null;
    } catch (err) {
        console.error("QR upload error:", err);
        return null;
    }
}

