"use client";

import { useEffect } from "react";

/**
 * Registers the Service Worker for offline caching + background sync.
 * Also listens for SW messages (e.g., SYNC_COMPLETE) to update the UI.
 */
export function useServiceWorker() {
    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
            return;
        }

        // Register SW
        navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {
                // Request periodic background sync if available
                if ("periodicSync" in registration) {
                    (registration as any).periodicSync
                        .register("auto-sync-transactions", {
                            minInterval: 60 * 60 * 1000, // 1 hour
                        })
                        .catch(() => {
                            // Permission denied or not supported
                        });
                }
            })
            .catch((err) => {
                console.warn("[SW] Registration failed:", err);
            });

        // Listen for messages from SW
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === "SYNC_COMPLETE") {
                const { synced, failed } = event.data;
                // Dispatch a custom event so components can react
                window.dispatchEvent(
                    new CustomEvent("upa-sync-complete", {
                        detail: { synced, failed },
                    })
                );
            }
        };

        navigator.serviceWorker.addEventListener("message", handleMessage);
        return () => {
            navigator.serviceWorker.removeEventListener("message", handleMessage);
        };
    }, []);
}

/**
 * Trigger a one-time background sync (for when the user comes back online)
 */
export async function requestBackgroundSync(): Promise<void> {
    if (!("serviceWorker" in navigator)) return;

    try {
        const registration = await navigator.serviceWorker.ready;
        if ("sync" in registration) {
            await (registration as any).sync.register("sync-transactions");
        }
    } catch {
        // Background Sync API not supported or permission denied
        // Fall back to manual sync
        console.warn("[SW] Background sync not available, falling back to manual");
    }
}
