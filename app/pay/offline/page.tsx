"use client";

import { useState, Suspense } from "react";
import { RouteGuard } from "@/components/route-guard";
import { CitizenOfflinePay, MerchantOfflineCharge } from "@/components/cross-device-offline";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowLeft, WifiOff, Send, Download } from "lucide-react";
import { useNetwork } from "@/hooks/use-network";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/contexts/wallet-context";

function OfflinePayContent() {
    const router = useRouter();
    const { online } = useNetwork();
    const { user, nid } = useWallet();
    const [mode, setMode] = useState<"pay" | "receive">("pay");

    const myName = user?.name || nid?.fullName || "User";
    const myUPA = nid?.linkedUPA || user?.upa_id || "user@upa.np";

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-lg mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold">Offline {mode === "pay" ? "Payment (C2C)" : "Request"}</h1>
                    <p className="text-xs text-muted-foreground">
                        {mode === "pay" ? "Citizen to Citizen - Scan or use Demo Mode" : "Show QR to receive"} without internet
                    </p>
                </div>
                <Badge
                    variant="outline"
                    className={
                        online
                            ? "text-emerald-700 border-emerald-300 bg-emerald-50"
                            : "text-red-700 border-red-300 bg-red-50 animate-pulse"
                    }
                >
                    {online ? "Online" : <><WifiOff className="h-3 w-3 mr-1" /> Offline</>}
                </Badge>
            </div>

            {/* Mode Toggle */}
            <div className="bg-muted p-1 rounded-lg flex gap-1">
                <button
                    onClick={() => setMode("pay")}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${mode === "pay"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/50"
                        }`}
                >
                    <Send className="h-4 w-4" />
                    Pay (Scan)
                </button>
                <button
                    onClick={() => setMode("receive")}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${mode === "receive"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/50"
                        }`}
                >
                    <Download className="h-4 w-4" />
                    Receive (QR)
                </button>
            </div>

            {/* Component Render */}
            {mode === "pay" ? (
                <CitizenOfflinePay />
            ) : (
                <MerchantOfflineCharge
                    businessName={myName}
                    businessUPA={myUPA}
                />
            )}
        </div>
    );
}

export default function OfflinePayPage() {
    return (
        <RouteGuard allowedRoles={["citizen", "officer", "merchant"]}>
            <Suspense fallback={<div className="p-4 text-center">Loading offline pay...</div>}>
                <OfflinePayContent />
            </Suspense>
        </RouteGuard>
    );
}
