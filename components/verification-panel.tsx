"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Lock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerificationPanelProps {
    signature: string;
    publicKey: string;
    nonce: string;
    timestamp: number;
    verified: boolean;
    payloadHash?: string;
}

export function VerificationPanel({
    signature,
    publicKey,
    nonce,
    timestamp,
    verified,
    payloadHash,
}: VerificationPanelProps) {
    const isExpired = Date.now() - timestamp > 60 * 60 * 1000; // 1 hour
    const truncatedSig = `${signature.slice(0, 8)}...${signature.slice(-8)}`;
    const truncatedKey = `${publicKey.slice(0, 8)}...${publicKey.slice(-8)}`;
    const truncatedNonce = `${nonce.slice(0, 8)}...${nonce.slice(-8)}`;

    return (
        <Card className="border-accent/20 bg-accent/5">
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-5 w-5 text-accent" />
                    Cryptographic Verification
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <span className="text-muted-foreground">Algorithm:</span>
                        <span className="ml-2 font-mono font-medium">Ed25519</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Status:</span>
                        {verified ? (
                            <span className="text-accent font-medium flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" />
                                VERIFIED
                            </span>
                        ) : (
                            <span className="text-danger font-medium flex items-center gap-1">
                                <XCircle className="h-4 w-4" />
                                FAILED
                            </span>
                        )}
                    </div>
                    <div className="col-span-2">
                        <span className="text-muted-foreground">Signature:</span>
                        <span className="ml-2 font-mono text-xs">{truncatedSig}</span>
                        {verified && (
                            <CheckCircle2 className="h-3 w-3 text-accent inline-block ml-2" />
                        )}
                    </div>
                    <div className="col-span-2">
                        <span className="text-muted-foreground">Public Key:</span>
                        <span className="ml-2 font-mono text-xs">{truncatedKey}</span>
                    </div>
                    <div className="col-span-2">
                        <span className="text-muted-foreground">Payload Hash:</span>
                        <span className="ml-2 font-mono text-xs">
                            {payloadHash || "SHA-256"}
                        </span>
                    </div>
                    <div className="col-span-2">
                        <span className="text-muted-foreground">Nonce:</span>
                        <span className="ml-2 font-mono text-xs">{truncatedNonce}</span>
                        <CheckCircle2 className="h-3 w-3 text-accent inline-block ml-2" />
                        <span className="text-xs text-muted-foreground ml-1">(unique)</span>
                    </div>
                    <div className="col-span-2">
                        <span className="text-muted-foreground">Timestamp:</span>
                        <span className="ml-2 text-xs">
                            {new Date(timestamp).toLocaleTimeString()}
                        </span>
                        {!isExpired ? (
                            <CheckCircle2 className="h-3 w-3 text-accent inline-block ml-2" />
                        ) : (
                            <XCircle className="h-3 w-3 text-warning inline-block ml-2" />
                        )}
                        <span className="text-xs text-muted-foreground ml-1">
                            ({isExpired ? "expired" : "within 1h"})
                        </span>
                    </div>
                    <div className="col-span-2">
                        <span className="text-muted-foreground">Tampered:</span>
                        <span className={cn("ml-2 font-medium", verified ? "text-accent" : "text-danger")}>
                            {verified ? "NO" : "YES"}
                        </span>
                        {verified && (
                            <CheckCircle2 className="h-3 w-3 text-accent inline-block ml-2" />
                        )}
                    </div>
                </div>
                <div className="pt-3 border-t border-border">
                    <div className="flex items-center gap-2 text-sm">
                        <Lock className="h-4 w-4 text-accent" />
                        <span className={cn("font-medium", verified ? "text-accent" : "text-danger")}>
                            {verified
                                ? "Status: VERIFIED — Safe to pay"
                                : "Status: VERIFICATION FAILED — Do not proceed"}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

