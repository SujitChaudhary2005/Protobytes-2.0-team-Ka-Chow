/**
 * NFC Signaling — cross-device communication via Supabase Realtime Broadcast
 *
 * BroadcastChannel only works same-origin/same-browser.
 * Supabase Realtime Broadcast works across devices/networks — perfect for
 * mobile-to-mobile NFC demo.
 *
 * Both channels are used simultaneously:
 *   - BroadcastChannel → instant, same-device (tabs) — WORKS OFFLINE
 *   - Supabase Realtime → cross-device (mobile-to-mobile) — requires network
 *
 * When offline, BroadcastChannel still enables same-device NFC demo (two tabs).
 * Cross-device signaling resumes automatically when back online.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type SignalMessage = {
    type: string;
    [key: string]: any;
};

export type SignalCallback = (msg: SignalMessage) => void;

const CHANNEL_NAME = "upa-nfc-signal";

/**
 * Create a dual signaling channel (BroadcastChannel + Supabase Realtime)
 * BroadcastChannel works offline for same-device (tab-to-tab) NFC.
 * Supabase Realtime is used best-effort for cross-device signaling.
 */
export function createSignalChannel(onMessage: SignalCallback) {
    let bc: BroadcastChannel | null = null;
    let rtChannel: RealtimeChannel | null = null;

    // ── 1. Same-device BroadcastChannel (works offline!) ─────
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        bc = new BroadcastChannel("upa-nfc-channel");
        bc.onmessage = (event) => {
            if (event.data?.type) onMessage(event.data);
        };
    }

    // ── 2. Cross-device Supabase Realtime Broadcast (online only) ──
    const connectRealtime = () => {
        if (rtChannel) return; // already connected
        if (!isSupabaseConfigured()) return;
        if (typeof navigator !== "undefined" && !navigator.onLine) return; // skip if offline

        try {
            rtChannel = supabase.channel(CHANNEL_NAME, {
                config: { broadcast: { self: false } },
            });

            rtChannel
                .on("broadcast", { event: "signal" }, (payload: any) => {
                    if (payload?.payload?.type) {
                        onMessage(payload.payload as SignalMessage);
                    }
                })
                .subscribe((status) => {
                    if (status === "SUBSCRIBED") {
                        console.log("[NFC Signal] Supabase realtime connected");
                    }
                });
        } catch {
            // Failed to connect — we'll rely on BroadcastChannel
            console.log("[NFC Signal] Supabase realtime unavailable — offline mode active");
            rtChannel = null;
        }
    };

    // Try initial realtime connection
    connectRealtime();

    // Auto-reconnect when coming back online
    const onOnline = () => {
        console.log("[NFC Signal] Back online — reconnecting Supabase realtime");
        connectRealtime();
    };
    const onOffline = () => {
        console.log("[NFC Signal] Offline — using BroadcastChannel only");
    };

    if (typeof window !== "undefined") {
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
    }

    return {
        /**
         * Send a message to both channels.
         * BroadcastChannel always works (even offline).
         * Supabase Realtime is best-effort.
         */
        send(msg: SignalMessage) {
            // BroadcastChannel (same device — always works)
            try { bc?.postMessage(msg); } catch { /* closed */ }

            // Supabase Realtime (cross device — online only, best-effort)
            if (rtChannel) {
                rtChannel.send({
                    type: "broadcast",
                    event: "signal",
                    payload: msg,
                }).catch(() => { /* offline or error — best-effort */ });
            }
        },

        /**
         * Clean up both channels and event listeners
         */
        close() {
            if (typeof window !== "undefined") {
                window.removeEventListener("online", onOnline);
                window.removeEventListener("offline", onOffline);
            }
            try { bc?.close(); } catch { /* ignore */ }
            if (rtChannel) {
                supabase.removeChannel(rtChannel);
                rtChannel = null;
            }
        },
    };
}
