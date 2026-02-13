"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/wallet-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteGuard } from "@/components/route-guard";
import { NIDCard } from "@/types";
import { NIDCardDisplay, NIDCardSkeleton } from "@/components/nid-card-display";
import {
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    Shield,
    Building2,
    Database,
} from "lucide-react";
import { toast } from "sonner";

export default function NIDVerificationPage() {
    return (
        <RouteGuard allowedRoles={["citizen"]}>
            <NIDVerification />
        </RouteGuard>
    );
}

type VerificationState = "idle" | "verifying" | "verified" | "error";

function NIDVerification() {
    const router = useRouter();
    const { linkNID, nid, linkedBank } = useWallet();
    const [verificationState, setVerificationState] = useState<VerificationState>(nid ? "verified" : "idle");
    const [manualNID, setManualNID] = useState("");
    const [verifiedNID, setVerifiedNID] = useState<NIDCard | null>(nid);
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);



    // Manual NID entry
    const handleManualVerify = async () => {
        if (!manualNID.trim()) {
            toast.error("Enter a NID number");
            return;
        }
        setIsLoading(true);
        setVerificationState("verifying");
        await verifyNID(manualNID.trim());
    };

    // Verify NID via API
    const verifyNID = async (nidNumber: string) => {
        try {
            // Show fetching state
            toast.loading("Querying National ID Registry...", { id: "nid-verify" });

            const res = await fetch("/api/nid", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nidNumber }),
            });

            const data = await res.json();
            toast.dismiss("nid-verify");

            if (data.success && data.nid) {
                // Build a full NIDCard from API response and pass it directly to linkNID.
                // This avoids discarding the server data and re-looking up from mock.
                const apiNid: NIDCard = {
                    nidNumber: data.nid.nidNumber,
                    fullName: data.nid.fullName,
                    dateOfBirth: data.nid.dateOfBirth,
                    gender: data.nid.gender || "M",
                    issueDate: data.nid.issueDate,
                    expiryDate: data.nid.expiryDate,
                    photoUrl: data.nid.photoUrl || "",
                    district: data.nid.district || "",
                    isActive: data.nid.isActive ?? true,
                    linkedUPA: data.nid.linkedUPA || null,
                    linkedBanks: (data.nid.linkedBanks || []).map((b: any) => ({
                        id: b.id || "",
                        bankName: b.bankName || "",
                        accountNumber: b.accountNumber || "",
                        accountType: b.accountType || "savings",
                        isPrimary: b.isPrimary ?? false,
                        linkedVia: "nid" as const,
                    })),
                };

                const linked = linkNID(apiNid);
                if (linked) {
                    setVerifiedNID(linked);
                    setVerificationState("verified");
                    toast.success(`✓ Verified: ${data.nid.fullName}`, { duration: 3000 });
                } else {
                    setVerificationState("error");
                    toast.error("NID linking failed");
                }
            } else {
                setVerificationState("error");
                toast.error(data.error || "NID verification failed");
            }
        } catch {
            toast.dismiss("nid-verify");
            setVerificationState("error");
            toast.error("Verification failed. Check connection.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!mounted) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
                <h1 className="text-lg font-bold">NID Verification</h1>
            </div>




            {verificationState === "idle" && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Enter National ID Number</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Input
                            placeholder="NID Number (e.g., 123-456-789 or RAM-KTM-1990-4521)"
                            value={manualNID}
                            onChange={(e) => setManualNID(e.target.value.toUpperCase())}
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" className="text-xs" onClick={() => setManualNID("123-456-789")}>
                                123-456-789
                            </Button>
                            {["RAM-KTM-1990-4521", "SITA-PKR-1995-7832", "HARI-LTP-1988-3214"].map((nid) => (
                                <Button key={nid} variant="outline" size="sm" className="text-xs" onClick={() => setManualNID(nid)}>
                                    {nid.split("-").slice(0, 2).join("-")}...
                                </Button>
                            ))}
                        </div>
                        <Button className="w-full" onClick={handleManualVerify} disabled={!manualNID}>
                            Verify NID
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Verifying Animation - Shows NID card skeleton while fetching */}
            {verificationState === "verifying" && (
                <div className="space-y-4">
                    <NIDCardSkeleton />
                    <Card className="border-blue-200 bg-blue-50/50">
                        <CardContent className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2 text-blue-600">
                                <Database className="h-4 w-4" />
                                <span className="text-sm font-medium">Querying National ID Registry</span>
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Verified NID Display — Nagarik-style card */}
            {verificationState === "verified" && verifiedNID && (
                <>
                    {/* Verification Badge */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="font-semibold text-green-700">NID Verified</span>
                        </div>
                        <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">Active</span>
                    </div>

                    {/* NID Card — Nagarik app style */}
                    <NIDCardDisplay nid={verifiedNID} />

                    {/* Linked Bank */}
                    {linkedBank && (
                        <Card className="border-blue-100">
                            <CardContent className="p-3 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{linkedBank.bankName}</p>
                                    <p className="text-xs text-muted-foreground">Account: {linkedBank.accountNumber}</p>
                                </div>
                                <Shield className="h-4 w-4 text-green-600" />
                            </CardContent>
                        </Card>
                    )}

                    {/* Info Card */}
                    <Card className="border-green-100 bg-green-50/30">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-green-900">NID Successfully Verified</p>
                                    <p className="text-xs text-green-700 mt-1">
                                        Your National ID has been verified and linked to your UPA wallet. You can now make payments using your linked bank accounts.
                                    </p>
                                    <div className="mt-3 flex gap-2">
                                        <Button 
                                            size="sm" 
                                            className="bg-green-600 hover:bg-green-700"
                                            onClick={() => router.push("/settings")}
                                        >
                                            Manage Payment Sources
                                            <ArrowRight className="h-4 w-4 ml-2" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Verify different NID button */}
                    <Button variant="outline" className="w-full" onClick={() => { setVerificationState("idle"); setVerifiedNID(null); }}>
                        Verify Different NID
                    </Button>
                </>
            )}

            {/* Error State */}
            {verificationState === "error" && (
                <Card className="border-red-200 bg-red-50/50">
                    <CardContent className="p-6 text-center">
                        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                        <h2 className="font-semibold text-red-700 mb-2">Verification Failed</h2>
                        <p className="text-sm text-red-600 mb-4">NID card not found or is inactive.</p>
                        <Button onClick={() => setVerificationState("idle")}>Try Again</Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
