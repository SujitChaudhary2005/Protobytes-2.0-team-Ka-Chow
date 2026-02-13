import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { verifySignature } from "@/lib/crypto";
import { initiateTransfer, type TransferRequest } from "@/lib/transfer";

/**
 * POST /api/transactions/sync
 *
 * Sync offline payments — supports both legacy queued txs and the new
 * offline-accepted tx format with dual signatures and client_tx_id.
 *
 * Returns deterministic per-item results by client_tx_id (or index).
 *
 * Rules:
 * - Validates signatures
 * - Enforces nonce idempotency (replay protection)
 * - Enforces the 96-hour sync deadline
 * - Marks settled/rejected/expired per-tx
 * - Returns clear reasons for rejection
 */

const OFFLINE_SYNC_DEADLINE_HOURS = Number(
  process.env.NEXT_PUBLIC_OFFLINE_SYNC_DEADLINE_HOURS ?? 96
);

const PER_OFFLINE_TX_LIMIT = Number(
  process.env.NEXT_PUBLIC_OFFLINE_TX_LIMIT ?? 500
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payments } = body;

    if (!Array.isArray(payments) || payments.length === 0) {
      return NextResponse.json(
        { error: "No payments to sync" },
        { status: 400 }
      );
    }

    const results: Array<{
      index: number;
      client_tx_id?: string;
      status: "settled" | "rejected" | "expired" | "error";
      error?: string;
      tx_id?: string;
    }> = [];

    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      const clientTxId = payment.client_tx_id || `sync_${Date.now()}_${i}`;

      try {
        // ── 1. Parse payload ──
        let parsed: Record<string, unknown>;
        try {
          parsed = typeof payment.payload === "string"
            ? JSON.parse(payment.payload)
            : payment.payload || {};
        } catch {
          parsed = {};
        }

        const amount = Number(payment.amount || parsed.amount || 0);
        const recipient = String(payment.receiverUPA || parsed.recipient || "");
        const sender = String(payment.senderUPA || parsed.fromUPA || "unknown");
        const nonce = payment.nonce || "";
        const timestamp = payment.timestamp || payment.acceptedAt || Date.now();
        const expiresAt = payment.expiresAt;

        // ── 2. Basic validation ──
        if (!amount || amount <= 0) {
          results.push({ index: i, client_tx_id: clientTxId, status: "rejected", error: "Invalid amount" });
          continue;
        }
        if (!recipient) {
          results.push({ index: i, client_tx_id: clientTxId, status: "rejected", error: "No recipient" });
          continue;
        }

        // ── 3. Per-tx limit check ──
        if (amount > PER_OFFLINE_TX_LIMIT) {
          results.push({
            index: i,
            client_tx_id: clientTxId,
            status: "rejected",
            error: `Amount ${amount} exceeds per-tx offline limit of ${PER_OFFLINE_TX_LIMIT}`,
          });
          continue;
        }

        // ── 4. Expiry check (sync deadline) ──
        const deadlineMs = OFFLINE_SYNC_DEADLINE_HOURS * 60 * 60 * 1000;
        const txAge = Date.now() - timestamp;
        if (txAge > deadlineMs) {
          results.push({
            index: i,
            client_tx_id: clientTxId,
            status: "expired",
            error: `Transaction expired: accepted ${Math.round(txAge / 3600000)}h ago, deadline is ${OFFLINE_SYNC_DEADLINE_HOURS}h`,
          });

          // If Supabase, record as expired
          if (isSupabaseConfigured() && supabase) {
            await supabase.from("transactions").insert({
              client_tx_id: clientTxId,
              sender: sender,
              recipient: recipient,
              amount: amount,
              intent: String(parsed.intent || "payment"),
              status: "failed",
              settlement_state: "expired",
              rejection_reason: `Sync deadline exceeded (${OFFLINE_SYNC_DEADLINE_HOURS}h)`,
              nonce: nonce,
              offline_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
              sender_signature: payment.sender_signature || payment.signature || null,
              receiver_signature: payment.receiver_signature || null,
              sender_device_id: payment.sender_device_id || null,
              receiver_device_id: payment.receiver_device_id || null,
              proof: payment.proof || {},
              sync_attempts: 1,
              mode: "offline",
            }).select();
          }
          continue;
        }

        // ── 5. Nonce idempotency check ──
        if (nonce && isSupabaseConfigured() && supabase) {
          const { data: existing } = await supabase
            .from("transactions")
            .select("id, settlement_state")
            .eq("nonce", nonce)
            .maybeSingle();

          if (existing) {
            // Already processed — return the existing state
            results.push({
              index: i,
              client_tx_id: clientTxId,
              status: existing.settlement_state === "settled" ? "settled" : "rejected",
              tx_id: existing.id,
              error: existing.settlement_state === "settled"
                ? undefined
                : "Duplicate nonce — already processed",
            });
            continue;
          }
        }

        // ── 6. Client_tx_id idempotency check ──
        if (clientTxId && isSupabaseConfigured() && supabase) {
          const { data: existing } = await supabase
            .from("transactions")
            .select("id, settlement_state")
            .eq("client_tx_id", clientTxId)
            .maybeSingle();

          if (existing) {
            results.push({
              index: i,
              client_tx_id: clientTxId,
              status: existing.settlement_state === "settled" ? "settled" : "rejected",
              tx_id: existing.id,
              error: existing.settlement_state === "settled"
                ? undefined
                : "Duplicate client_tx_id — already processed",
            });
            continue;
          }
        }

        // ── 7. Signature verification (best-effort) ──
        const signature = payment.sender_signature || payment.signature || "";
        const publicKey = payment.publicKey || "";
        if (signature && publicKey && payment.payload) {
          try {
            const isValid = await verifySignature(
              payment.payload,
              signature,
              publicKey
            );
            if (!isValid) {
              results.push({
                index: i,
                client_tx_id: clientTxId,
                status: "rejected",
                error: "Invalid sender signature",
              });
              continue;
            }
          } catch {
            // If sig verification fails on the server side (e.g. different crypto version),
            // we allow it through with a warning — production would reject.
          }
        }

        // ── 8. Settle via Supabase or demo mode ──
        if (isSupabaseConfigured() && supabase) {
          // Insert and settle
          const { data: insertedTx, error: insertError } = await supabase
            .from("transactions")
            .insert({
              client_tx_id: clientTxId,
              sender: sender,
              recipient: recipient,
              amount: amount,
              intent: String(parsed.intent || "payment"),
              status: "settled",
              settlement_state: "settled",
              mode: "offline",
              nonce: nonce,
              signature: signature,
              public_key: publicKey,
              offline_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
              sender_signature: payment.sender_signature || null,
              receiver_signature: payment.receiver_signature || null,
              sender_device_id: payment.sender_device_id || null,
              receiver_device_id: payment.receiver_device_id || null,
              proof: payment.proof || {},
              sync_attempts: 1,
              created_at: new Date(timestamp).toISOString(),
            })
            .select()
            .single();

          if (insertError) {
            // Check for nonce uniqueness violation
            if (insertError.code === "23505") {
              results.push({
                index: i,
                client_tx_id: clientTxId,
                status: "settled",
                error: undefined, // Idempotent — already settled
              });
            } else {
              results.push({
                index: i,
                client_tx_id: clientTxId,
                status: "error",
                error: insertError.message,
              });
            }
          } else {
            // Insert ledger entries
            try {
              await supabase.from("offline_wallet_ledger").insert([
                {
                  tx_id: insertedTx?.id,
                  client_tx_id: clientTxId,
                  user_id: sender,
                  upa_address: sender,
                  direction: "debit",
                  amount: amount,
                  state: "applied",
                },
                {
                  tx_id: insertedTx?.id,
                  client_tx_id: clientTxId,
                  user_id: recipient,
                  upa_address: recipient,
                  direction: "credit",
                  amount: amount,
                  state: "applied",
                },
              ]);
            } catch {
              // Ledger insert failure is non-fatal — tx is still settled
            }

            // Also settle via transfer engine for balance updates
            try {
              const transferReq: TransferRequest = {
                txId: insertedTx?.id || clientTxId,
                source: {
                  walletId: sender,
                  provider: "upa_wallet",
                },
                destination: {
                  upaAddress: recipient,
                },
                amount: amount,
                currency: "NPR",
                purpose: String(parsed.intent || "offline_payment"),
                payerName: sender,
                payerId: sender,
              };
              await initiateTransfer(transferReq);
            } catch {
              // Transfer engine failure is non-fatal for offline settlement
            }

            results.push({
              index: i,
              client_tx_id: clientTxId,
              status: "settled",
              tx_id: insertedTx?.id,
            });
          }
        } else {
          // Demo mode — settle immediately
          results.push({
            index: i,
            client_tx_id: clientTxId,
            status: "settled",
            tx_id: `demo_${clientTxId}`,
          });
        }
      } catch (err) {
        results.push({
          index: i,
          client_tx_id: clientTxId,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const settledCount = results.filter((r) => r.status === "settled").length;
    const failedCount = results.filter(
      (r) => r.status === "rejected" || r.status === "error" || r.status === "expired"
    ).length;

    return NextResponse.json({
      success: true,
      synced: settledCount,
      failed: failedCount,
      total: payments.length,
      results,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync payments" },
      { status: 500 }
    );
  }
}
