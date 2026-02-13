import { createClient, SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * DEMO_MODE flag — when true, RLS is expected to be wide-open (see 07_e2e_realtime.sql).
 * In production, set this to false and wire proper auth.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false"; // defaults to true

let _supabase: SupabaseClient | null = null;

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      _supabase = createClient(supabaseUrl, supabaseAnonKey, {
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      });
    }
    return (_supabase as any)[prop];
  },
});

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== "https://your-project.supabase.co");
}

// ── Realtime helper ─────────────────────────────────────────────
// Returns a channel subscription for INSERT/UPDATE on `transactions`.
// Caller is responsible for calling `channel.unsubscribe()` on cleanup.
export function subscribeToTransactions(
  onInsert: (payload: any) => void,
  onUpdate: (payload: any) => void,
): RealtimeChannel | null {
  if (!isSupabaseConfigured()) return null;

  const channel = supabase
    .channel("transactions-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "transactions" },
      (payload) => onInsert(payload),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "transactions" },
      (payload) => onUpdate(payload),
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[Supabase Realtime] Subscribed to transactions");
      }
      if (status === "CHANNEL_ERROR") {
        console.warn("[Supabase Realtime] Channel error — will retry");
      }
    });

  return channel;
}
