"use client";

import { useServiceWorker } from "@/hooks/use-service-worker";
import { requestBackgroundSync } from "@/hooks/use-service-worker";
import { useNetwork } from "@/hooks/use-network";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Client-side providers that need to run in the browser:
 * - Service Worker registration
 * - Auto background sync when coming back online
 * - Listen for sync completion events
 */
export function ClientProviders() {
    useServiceWorker();
    const { online } = useNetwork();
    const wasOffline = useRef(false);

    // When coming back online, trigger background sync
    useEffect(() => {
        if (!online) {
            wasOffline.current = true;
            return;
        }

        if (wasOffline.current) {
            wasOffline.current = false;
            // Trigger background sync
            requestBackgroundSync();
            toast.info("Back Online", {
                description: "Syncing queued transactions...",
            });
        }
    }, [online]);

    // Listen for sync completion from Service Worker
    useEffect(() => {
        const handler = (e: Event) => {
            try {
                if (!(e instanceof CustomEvent) || !e.detail) {
                    return;
                }
                
                const { synced = 0, failed = 0 } = e.detail;
                
                if (synced > 0) {
                    toast.success("Sync Complete", {
                        description: `${synced} transaction${synced > 1 ? "s" : ""} settled successfully`,
                    });
                }
                if (failed > 0) {
                    toast.error("Sync Issues", {
                        description: `${failed} transaction${failed > 1 ? "s" : ""} failed — check dashboard`,
                    });
                }
            } catch (error) {
                // Silently handle any event processing errors
                console.warn("Event handler error:", error);
            }
        };

        window.addEventListener("upa-sync-complete", handler);
        return () => window.removeEventListener("upa-sync-complete", handler);
    }, []);

    return null; // This component renders nothing, just runs effects
}
