import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { verifySignature } from "@/lib/crypto";
import { initiateTransfer, type TransferRequest } from "@/lib/transfer";

// POST /api/transactions/sync — sync offline payments
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payments } = body;

    if (!Array.isArray(payments) || payments.length === 0) {
      return NextResponse.json({ success: false, error: "No payments to sync" }, { status: 400 });
    }

    const results = [];

    for (const payment of payments) {
      const { qrPayload, signature, nonce, publicKey } = payment;
      const txId = `UPA-2026-${String(Date.now()).slice(-5)}-${Math.random().toString(36).slice(2, 5)}`;

      // Server-side Ed25519 signature verification
      if (signature && publicKey) {
        try {
          const isValid = verifySignature(qrPayload, signature, publicKey);
          if (!isValid) {
            results.push({
              txId: null,
              status: "rejected",
              reason: "invalid_signature",
            });
            continue;
          }
        } catch {
          results.push({
            txId: null,
            status: "rejected",
            reason: "signature_verification_error",
          });
          continue;
        }
      }

      // Check QR expiry (1 hour)
      if (qrPayload.expiresAt) {
        const expiresAt = new Date(qrPayload.expiresAt).getTime();
        if (Date.now() > expiresAt) {
          results.push({
            txId: null,
            status: "rejected",
            reason: "qr_expired",
          });
          continue;
        }
      }

      // ── Fund Transfer via abstraction layer ─────────────────────
      const transferReq: TransferRequest = {
        txId,
        source: {
          walletId: qrPayload.metadata?.payerId || "unknown",
          provider: "upa_wallet",
        },
        destination: {
          upaAddress: qrPayload.upa,
        },
        amount: qrPayload.amount,
        currency: "NPR",
        purpose: qrPayload.intent?.name || qrPayload.intent?.id || "payment",
        payerName: qrPayload.metadata?.payerName || "Unknown",
        payerId: qrPayload.metadata?.payerId || "unknown",
      };

      const transferResult = await initiateTransfer(transferReq);

      if (transferResult.status === "failed") {
        results.push({
          txId: null,
          status: "failed",
          reason: transferResult.errorMessage || "fund_transfer_failed",
        });
        continue;
      }

      if (isSupabaseConfigured()) {
        // Check nonce hasn't been used
        const { data: existing } = await supabase
          .from("transactions")
          .select("id")
          .eq("nonce", nonce)
          .single();

        if (existing) {
          results.push({
            txId: null,
            status: "rejected",
            reason: "nonce_reused",
          });
          continue;
        }

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
            currency: "NPR",
            payer_name: qrPayload.metadata?.payerName,
            payer_id: qrPayload.metadata?.payerId,
            wallet_provider: "upa_pay",
            status: "settled",
            mode: "offline",
            metadata: {
              ...(qrPayload.metadata || {}),
              transferId: transferResult.transferId,
              bankReference: transferResult.bankReference,
              fee: transferResult.fee,
              netAmount: transferResult.netAmount,
            },
            signature,
            nonce,
            issued_at: qrPayload.issuedAt || new Date().toISOString(),
            settled_at: new Date().toISOString(),
            synced_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          results.push({ txId: null, status: "failed", reason: error.message });
          continue;
        }

        results.push({ txId, status: "settled", verified: true });
      } else {
        // Fallback
        results.push({ txId, status: "settled", verified: true });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
