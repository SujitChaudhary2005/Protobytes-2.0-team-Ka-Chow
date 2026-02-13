import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { initiateTransfer, type TransferRequest } from "@/lib/transfer";

// POST /api/transactions/c2c — Citizen-to-Citizen payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromUPA, toUPA, amount, intent, message, walletProvider = "upa_pay" } = body;

    if (!fromUPA || !toUPA || !amount || !intent) {
      return NextResponse.json(
        { success: false, error: "fromUPA, toUPA, amount, and intent are required" },
        { status: 400 }
      );
    }

    if (fromUPA === toUPA) {
      return NextResponse.json(
        { success: false, error: "Cannot send to yourself" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be positive" },
        { status: 400 }
      );
    }

    const txId = `UPA-2026-${String(Date.now()).slice(-5)}`;
    const now = new Date().toISOString();
    const nonce = body.nonce || `c2c-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // ── Fund Transfer via abstraction layer ─────────────────────
    const transferReq: TransferRequest = {
      txId,
      source: {
        walletId: fromUPA,
        provider: "upa_wallet",
      },
      destination: {
        upaAddress: toUPA,
      },
      amount,
      currency: "NPR",
      purpose: intent,
      payerName: body.payerName || fromUPA,
      payerId: fromUPA,
    };

    const transferResult = await initiateTransfer(transferReq);

    if (transferResult.status === "failed") {
      return NextResponse.json(
        { success: false, error: transferResult.errorMessage || "Fund transfer failed" },
        { status: 500 }
      );
    }

    // Try Supabase
    if (isSupabaseConfigured()) {
      try {
        // Check nonce uniqueness
        const { data: existingNonce } = await supabase
          .from("transactions")
          .select("id")
          .eq("nonce", nonce)
          .single();

        if (existingNonce) {
          return NextResponse.json(
            { success: false, error: "Replay detected: nonce already used" },
            { status: 400 }
          );
        }

        // Resolve UPA IDs
        const { data: fromUpaData } = await supabase
          .from("upas")
          .select("id")
          .eq("address", fromUPA)
          .single();

        const { data: toUpaData } = await supabase
          .from("upas")
          .select("id")
          .eq("address", toUPA)
          .single();

        if (fromUpaData && toUpaData) {
          const { error } = await supabase.from("transactions").insert({
            tx_id: txId,
            upa_id: toUpaData.id,
            intent_id: null,
            tx_type: "c2c",
            amount,
            payer_name: body.payerName || fromUPA,
            payer_id: null,
            payer_upa: fromUpaData.id,
            receiver_upa: toUpaData.id,
            wallet_provider: walletProvider,
            payment_source: body.paymentSource || "wallet",
            status: "settled",
            mode: "online",
            metadata: {
              intent,
              message: message || "",
              fromUPA,
              toUPA,
              transferId: transferResult.transferId,
              bankReference: transferResult.bankReference,
              fee: transferResult.fee,
              netAmount: transferResult.netAmount,
            },
            nonce,
            issued_at: now,
            settled_at: now,
          });

          if (!error) {
            return NextResponse.json({
              success: true,
              transaction: {
                txId,
                type: "c2c",
                fromUPA,
                toUPA,
                amount,
                intent,
                message,
                status: "settled",
                settledAt: now,
                transferId: transferResult.transferId,
                fee: transferResult.fee,
              },
            });
          }
        }
      } catch (e) {
        console.error("[C2C API] Supabase error:", e);
      }
    }

    // Fallback: return success (localStorage handled on client)
    return NextResponse.json({
      success: true,
      transaction: {
        txId,
        type: "c2c",
        fromUPA,
        toUPA,
        amount,
        intent,
        message,
        status: "settled",
        settledAt: now,
        transferId: transferResult.transferId,
        fee: transferResult.fee,
      },
    });
  } catch (error) {
    console.error("[C2C API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
