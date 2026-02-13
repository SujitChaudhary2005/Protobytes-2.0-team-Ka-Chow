"use client";

import { useNetwork } from "@/hooks/use-network";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Fixed floating network badge — always visible for demo/video recording.
 * Shows green "Online" / red "Offline" pill in the bottom-left corner.
 * DEMO-ONLY: Remove before production.
 */
export function NetworkStatusBadge() {
    const { online, mounted } = useNetwork();

    if (!mounted) return null;

    return (
        <div
            className={cn(
                "fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg border transition-all duration-500 select-none pointer-events-none",
                online
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-red-50 border-red-300 text-red-700 animate-pulse"
            )}
        >
            {online ? (
                <>
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <Wifi className="h-3 w-3" />
                    <span>Online</span>
                </>
            ) : (
                <>
                    <span className="relative flex h-2 w-2">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                    <WifiOff className="h-3 w-3" />
                    <span>Offline</span>
                </>
            )}
        </div>
    );
}
