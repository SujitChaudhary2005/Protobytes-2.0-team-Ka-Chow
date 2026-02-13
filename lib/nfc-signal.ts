/**
 * NFC Signaling — cross-device communication via Supabase Realtime Broadcast
 *
 * BroadcastChannel only works same-origin/same-browser.
 * Supabase Realtime Broadcast works across devices/networks — perfect for
 * mobile-to-mobile NFC demo.
 *
 * Both channels are used simultaneously:
 *   - BroadcastChannel → instant, same-device (tabs)
 *   - Supabase Realtime → cross-device (mobile-to-mobile)
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
 */
export function createSignalChannel(onMessage: SignalCallback) {
    let bc: BroadcastChannel | null = null;
    let rtChannel: RealtimeChannel | null = null;

    // ── 1. Same-device BroadcastChannel ──────────────────────
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        bc = new BroadcastChannel("upa-nfc-channel");
        bc.onmessage = (event) => {
            if (event.data?.type) onMessage(event.data);
        };
    }

    // ── 2. Cross-device Supabase Realtime Broadcast ──────────
    if (isSupabaseConfigured()) {
        rtChannel = supabase.channel(CHANNEL_NAME, {
            config: { broadcast: { self: false } }, // don't echo own messages
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
    }

    return {
        /**
         * Send a message to both channels
         */
        send(msg: SignalMessage) {
            // BroadcastChannel (same device)
            try { bc?.postMessage(msg); } catch { /* closed */ }

            // Supabase Realtime (cross device)
            if (rtChannel) {
                rtChannel.send({
                    type: "broadcast",
                    event: "signal",
                    payload: msg,
                }).catch(() => { /* best-effort */ });
            }
        },

        /**
         * Clean up both channels
         */
        close() {
            try { bc?.close(); } catch { /* ignore */ }
            if (rtChannel) {
                supabase.removeChannel(rtChannel);
            }
        },
    };
}
