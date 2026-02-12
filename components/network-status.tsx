"use client";

import { useNetwork } from "@/hooks/use-network";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function NetworkStatus({ className }: { className?: string }) {
    const { online } = useNetwork();

    return (
        <div
            className={cn(
                "flex items-center gap-2 text-sm",
                online ? "text-accent" : "text-warning",
                className
            )}
        >
            {online ? (
                <Wifi className="h-4 w-4" />
            ) : (
                <WifiOff className="h-4 w-4" />
            )}
            <span>{online ? "Online" : "Offline"}</span>
        </div>
    );
}

