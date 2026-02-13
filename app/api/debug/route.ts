import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * GET /api/debug — Check Supabase connection and environment variables
 */
export async function GET() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      SUPABASE_URL_SET: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_URL_VALUE: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) + "...",
      SUPABASE_KEY_SET: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
      DEMO_MODE_EVALUATED: process.env.NEXT_PUBLIC_DEMO_MODE !== "false",
    },
    supabaseConfigured: isSupabaseConfigured(),
    databaseTest: null as any,
  };

  // Test actual database connection
  if (isSupabaseConfigured()) {
    try {
      const { data, error, count } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true });

      diagnostics.databaseTest = {
        success: !error,
        error: error?.message || null,
        count: count,
        canConnect: true,
      };

      // Also test if we can read one transaction
      const { data: sampleTx, error: sampleError } = await supabase
        .from("transactions")
        .select("tx_id, amount, status")
        .limit(1)
        .single();

      diagnostics.databaseTest.sampleTransaction = sampleTx || null;
      diagnostics.databaseTest.sampleError = sampleError?.message || null;
    } catch (err: any) {
      diagnostics.databaseTest = {
        success: false,
        error: err.message,
        canConnect: false,
      };
    }
  } else {
    diagnostics.databaseTest = {
      success: false,
      error: "Supabase not configured - missing URL or KEY",
      canConnect: false,
    };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
