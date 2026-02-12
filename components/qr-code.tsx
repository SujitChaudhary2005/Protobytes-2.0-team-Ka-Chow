"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRCodeProps {
    value: string;
    size?: number;
    className?: string;
}

export function QRCodeDisplay({ value, size = 256, className }: QRCodeProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current && value) {
            QRCode.toCanvas(canvasRef.current, value, {
                width: size,
                margin: 2,
                color: {
                    dark: "#111827",
                    light: "#FFFFFF",
                },
            }).catch((err) => {
                console.error("QR generation error:", err);
            });
        }
    }, [value, size]);

    if (!value) return null;

    return (
        <div className={className}>
            <canvas ref={canvasRef} className="w-full h-auto" />
        </div>
    );
}

