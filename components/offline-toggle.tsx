"use client";

import { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OfflineToggleProps {
    className?: string;
    onToggle?: (isOnline: boolean) => void;
}

export function OfflineToggle({ className, onToggle }: OfflineToggleProps) {
    const [isOnline, setIsOnline] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined") {
            setIsOnline(navigator.onLine);
        }
    }, []);

    const handleToggle = () => {
        const newState = !isOnline;
        setIsOnline(newState);

        // Override navigator.onLine for demo purposes
        if (typeof window !== "undefined") {
            Object.defineProperty(navigator, "onLine", {
                writable: true,
                configurable: true,
                value: newState,
            });

            // Dispatch event to trigger listeners
            window.dispatchEvent(new Event(newState ? "online" : "offline"));
        }

        onToggle?.(newState);
    };

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
            variant="outline"
            size="sm"
            onClick={handleToggle}
            className={cn("gap-2", className)}
        >
            {isOnline ? (
                <>
                    <Wifi className="h-4 w-4 text-accent" />
                    <span>Online</span>
                </>
            ) : (
                <>
                    <WifiOff className="h-4 w-4 text-warning" />
                    <span>Offline</span>
                </>
            )}
        </Button>
    );
}

