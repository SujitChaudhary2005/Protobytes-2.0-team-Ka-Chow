"use client";

import { useCallback } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNetwork } from "@/hooks/use-network";

interface OfflineToggleProps {
    className?: string;
    onToggle?: (isOnline: boolean) => void;
}

export function OfflineToggle({ className, onToggle }: OfflineToggleProps) {
    const { online, mounted } = useNetwork();

    const handleToggle = useCallback(() => {
        const newState = !online;

        // Override navigator.onLine for testing purposes
        if (typeof window !== "undefined") {
            Object.defineProperty(navigator, "onLine", {
                writable: true,
                configurable: true,
                value: newState,
            });

            // Dispatch native event to trigger all listeners (including useNetwork)
            window.dispatchEvent(new Event(newState ? "online" : "offline"));
        }

        onToggle?.(newState);
    }, [online, onToggle]);

    if (!mounted) {
        return (
            <Button
                variant="outline"
                size="sm"
                className={cn("gap-2", className)}
                disabled
            >
                <Wifi className="h-4 w-4 text-muted-foreground" />
                <span>Loading...</span>
            </Button>
        );
    }

    return (
        <Button
            variant={online ? "outline" : "destructive"}
            size="sm"
            onClick={handleToggle}
            className={cn(
                "gap-2 transition-all duration-300",
                !online && "animate-pulse",
                className
            )}
        >
            {online ? (
                <>
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <Wifi className="h-4 w-4" />
                    <span>Online</span>
                </>
            ) : (
                <>
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                    <WifiOff className="h-4 w-4" />
                    <span>Offline</span>
                </>
            )}
        </Button>
    );
}

