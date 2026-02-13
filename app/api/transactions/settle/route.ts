import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { initiateTransfer, type TransferRequest } from "@/lib/transfer";

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

    // ── Nonce replay protection (DB-level) ──────────────────────
    if (qrPayload.nonce && isSupabaseConfigured()) {
      const { data: existingNonce } = await supabase
        .from("transactions")
        .select("id")
        .eq("nonce", qrPayload.nonce)
        .maybeSingle();

      if (existingNonce) {
        return NextResponse.json(
          { success: false, error: "Replay detected: nonce already used" },
          { status: 409 }
        );
      }
    }

    const txId = `UPA-2026-${String(Date.now()).slice(-5)}`;

    // ── Fund Transfer via abstraction layer ─────────────────────
    const transferReq: TransferRequest = {
      txId,
      source: {
        walletId: qrPayload.metadata?.payerId || "unknown",
        provider: walletProvider === "connectIPS" ? "connectIPS" : "upa_wallet",
      },
      destination: {
        upaAddress: qrPayload.upa,
        bankCode: qrPayload.metadata?.bankCode,
      },
      amount: qrPayload.amount,
      currency: "NPR",
      purpose: qrPayload.intent?.name || qrPayload.intent?.id || "payment",
      payerName: qrPayload.metadata?.payerName || "Unknown",
      payerId: qrPayload.metadata?.payerId || "unknown",
    };

    const transferResult = await initiateTransfer(transferReq);

    if (transferResult.status === "failed") {
      return NextResponse.json(
        { success: false, error: transferResult.errorMessage || "Fund transfer failed" },
        { status: 500 }
      );
    }

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

      // Resolve payer UPA if available
      let payerUpaId = null;
      if (qrPayload.metadata?.payerUPA) {
        const { data: payerUpa } = await supabase
          .from("upas")
          .select("id")
          .eq("address", qrPayload.metadata.payerUPA)
          .single();
        payerUpaId = payerUpa?.id || null;
      }

      const { error } = await supabase
        .from("transactions")
        .insert({
          tx_id: txId,
          upa_id: upa?.id || qrPayload.upa_id,
          intent_id: intent?.id || qrPayload.intent_id,
          tx_type: qrPayload.tx_type || "payment",
          amount: qrPayload.amount,
          currency: qrPayload.currency || "NPR",
          payer_name: qrPayload.payer_name || qrPayload.metadata?.payerName,
          payer_id: qrPayload.payer_id || qrPayload.metadata?.payerId,
          payer_upa: payerUpaId,
          receiver_upa: upa?.id || null,
          wallet_provider: walletProvider,
          payment_source: qrPayload.payment_source || walletProvider || "wallet",
          status: "settled",
          mode: "online",
          metadata: {
            ...(qrPayload.metadata || {}),
            transferId: transferResult.transferId,
            bankReference: transferResult.bankReference,
            fee: transferResult.fee,
            netAmount: transferResult.netAmount,
          },
          nonce: qrPayload.nonce,
          issued_at: qrPayload.issuedAt || new Date().toISOString(),
          settled_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        // Catch nonce unique violation → 409
        if (error.code === "23505" && error.message?.includes("nonce")) {
          return NextResponse.json(
            { success: false, error: "Replay detected: nonce already used" },
            { status: 409 }
          );
        }
        throw error;
      }

      return NextResponse.json({
        success: true,
        transaction: {
          txId,
          status: "settled",
          settledAt: new Date().toISOString(),
          transferId: transferResult.transferId,
          bankReference: transferResult.bankReference,
          fee: transferResult.fee,
        },
      });
    }

    // Fallback: return success (localStorage handled on client)
    return NextResponse.json({
      success: true,
      transaction: {
        txId,
        status: "settled",
        settledAt: new Date().toISOString(),
        transferId: transferResult.transferId,
        bankReference: transferResult.bankReference,
        fee: transferResult.fee,
      },
    });
  } catch (error: any) {
    console.error("Settle error:", error);

    // If Supabase failed but we have a valid payload, fallback gracefully
    if (isSupabaseConfigured()) {
      console.warn("[Settle] Supabase write failed — falling back to mock mode. Error:", error.message);
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
