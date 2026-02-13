"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Lock, Shield, Zap, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
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
    const [expanded, setExpanded] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const isExpired = Date.now() - timestamp > 60 * 60 * 1000;
    const truncatedSig = `${signature.slice(0, 12)}...${signature.slice(-12)}`;
    const truncatedKey = `${publicKey.slice(0, 12)}...${publicKey.slice(-12)}`;

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 1500);
    };

    return (
        <Card className={cn(
            "border-2 transition-all duration-500",
            verified
                ? "border-emerald-500/40 bg-gradient-to-br from-emerald-50/80 to-green-50/50 dark:from-emerald-950/30 dark:to-green-950/20 shadow-lg shadow-emerald-500/10"
                : "border-red-500/40 bg-gradient-to-br from-red-50/80 to-rose-50/50 dark:from-red-950/30 dark:to-rose-950/20 shadow-lg shadow-red-500/10"
        )}>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "p-1.5 rounded-lg",
                            verified ? "bg-emerald-500/10" : "bg-red-500/10"
                        )}>
                            <Shield className={cn("h-5 w-5", verified ? "text-emerald-600" : "text-red-600")} />
                        </div>
                        <span>Cryptographic Verification</span>
                    </div>
                    <div className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5",
                        verified
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-red-500/15 text-red-700 dark:text-red-400"
                    )}>
                        {verified ? (
                            <>
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                                VERIFIED
                            </>
                        ) : (
                            <>
                                <XCircle className="h-3 w-3" />
                                FAILED
                            </>
                        )}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Core verification fields */}
                <div className="space-y-2.5">
                    {/* Algorithm */}
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/60 border border-border/50">
                        <span className="text-xs text-muted-foreground font-medium">Algorithm</span>
                        <span className="font-mono text-sm font-bold">Ed25519</span>
                    </div>
                    {/* Signature */}
                    <div className="py-1.5 px-3 rounded-lg bg-background/60 border border-border/50 space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground font-medium">Signature (64 bytes)</span>
                            <div className="flex items-center gap-1.5">
                                {verified && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                                <button onClick={() => copyToClipboard(signature, "sig")} className="text-muted-foreground hover:text-foreground transition-colors">
                                    {copiedField === "sig" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                </button>
                            </div>
                        </div>
                        <p className="font-mono text-[11px] text-foreground/80 break-all leading-relaxed">
                            {expanded ? signature : truncatedSig}
                        </p>
                    </div>
                    {/* Public Key */}
                    <div className="py-1.5 px-3 rounded-lg bg-background/60 border border-border/50 space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground font-medium">Public Key (32 bytes)</span>
                            <button onClick={() => copyToClipboard(publicKey, "key")} className="text-muted-foreground hover:text-foreground transition-colors">
                                {copiedField === "key" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </button>
                        </div>
                        <p className="font-mono text-[11px] text-foreground/80 break-all leading-relaxed">
                            {expanded ? publicKey : truncatedKey}
                        </p>
                    </div>
                    {/* Nonce + Timestamp row */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="py-1.5 px-3 rounded-lg bg-background/60 border border-border/50">
                            <span className="text-xs text-muted-foreground font-medium">Nonce</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <p className="font-mono text-[11px] text-foreground/80 truncate">{nonce.slice(0, 16)}...</p>
                                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                            </div>
                            <p className="text-[10px] text-muted-foreground">✓ Unique</p>
                        </div>
                        <div className="py-1.5 px-3 rounded-lg bg-background/60 border border-border/50">
                            <span className="text-xs text-muted-foreground font-medium">Timestamp</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <p className="text-[11px] text-foreground/80">{new Date(timestamp).toLocaleTimeString()}</p>
                                {!isExpired ? (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                ) : (
                                    <XCircle className="h-3 w-3 text-amber-500 shrink-0" />
                                )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                {isExpired ? "⚠ Expired" : "✓ Within 1 hour"}
                            </p>
                        </div>
                    </div>
                    {/* Tampered */}
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/60 border border-border/50">
                        <span className="text-xs text-muted-foreground font-medium">Tampered</span>
                        <span className={cn(
                            "text-sm font-bold flex items-center gap-1.5",
                            verified ? "text-emerald-600" : "text-red-600"
                        )}>
                            {verified ? (
                                <><CheckCircle2 className="h-3.5 w-3.5" /> NO</>
                            ) : (
                                <><XCircle className="h-3.5 w-3.5" /> YES — INVALID</>
                            )}
                        </span>
                    </div>
                </div>

                {/* Expand/collapse toggle */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                    {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {expanded ? "Show less" : "Show full hex values"}
                </button>

                {/* Bottom footer — the key message */}
                <div className={cn(
                    "pt-3 border-t flex items-center gap-2.5 rounded-lg px-3 py-2.5",
                    verified
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : "bg-red-500/10 border-red-500/20"
                )}>
                    <Zap className={cn("h-4 w-4 shrink-0", verified ? "text-emerald-600" : "text-red-600")} />
                    <span className={cn("text-sm font-semibold", verified ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                        {verified
                            ? "Verified locally — no server contact needed"
                            : "VERIFICATION FAILED — Do not proceed"}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

