import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// POST /api/transactions/settle — settle an online payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Accept both "payload" (from confirm page) and "qrPayload" (legacy)
    const qrPayload = body.payload || body.qrPayload;
    const walletProvider = body.walletProvider || "upa_pay";

    if (!qrPayload) {
      return NextResponse.json({ success: false, error: "Missing payload" }, { status: 400 });
    }

    // Check QR expiry (1 hour)
    if (qrPayload.expiresAt) {
      const expiresAt = new Date(qrPayload.expiresAt).getTime();
      if (Date.now() > expiresAt) {
        return NextResponse.json(
          { success: false, error: "QR payment request has expired" },
          { status: 400 }
        );
      }
    }

    // Check nonce uniqueness (if Supabase is configured)
    if (qrPayload.nonce && isSupabaseConfigured()) {
      const { data: existingNonce } = await supabase
        .from("transactions")
        .select("id")
        .eq("nonce", qrPayload.nonce)
        .single();

      if (existingNonce) {
        return NextResponse.json(
          { success: false, error: "Replay detected: nonce already used" },
          { status: 400 }
        );
      }
    }

    const txId = `UPA-2026-${String(Date.now()).slice(-5)}`;

    if (isSupabaseConfigured()) {
      // Look up UPA and intent
      const { data: upa } = await supabase
        .from("upas")
        .select("id")
        .eq("address", qrPayload.upa)
        .single();

      const { data: intent } = await supabase
        .from("intents")
        .select("id")
        .eq("intent_code", qrPayload.intent?.id || "")
        .single();

      const { data: tx, error } = await supabase
        .from("transactions")
        .insert({
          tx_id: txId,
          upa_id: upa?.id || qrPayload.upa_id,
          intent_id: intent?.id || qrPayload.intent_id,
          amount: qrPayload.amount,
          currency: qrPayload.currency || "NPR",
          payer_name: qrPayload.payer_name || qrPayload.metadata?.payerName,
          payer_id: qrPayload.payer_id || qrPayload.metadata?.payerId,
          wallet_provider: walletProvider,
          status: "settled",
          mode: "online",
          metadata: qrPayload.metadata || {},
          nonce: qrPayload.nonce,
          issued_at: qrPayload.issuedAt || new Date().toISOString(),
          settled_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        transaction: { txId, status: "settled", settledAt: new Date().toISOString() },
      });
    }

    // Fallback: return success (localStorage handled on client)
    return NextResponse.json({
      success: true,
      transaction: { txId, status: "settled", settledAt: new Date().toISOString() },
    });
  } catch (error: any) {
    console.error("Settle error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
