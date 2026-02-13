import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * POST /api/transactions/offline/accept
 *
 * Records an offline-accepted transaction on the server side (when online).
 * This is called when two devices complete the offline handshake and one
 * comes back online first. It creates a pending settlement record.
 *
 * If the device is offline, the local Dexie DB stores it instead, and
 * this endpoint is called later during sync.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            client_tx_id,
            nonce,
            senderUPA,
            receiverUPA,
            amount,
            intent,
            acceptedAt,
            expiresAt,
            sender_signature,
            receiver_signature,
            sender_device_id,
            receiver_device_id,
            proof,
        } = body;

        if (!client_tx_id || !senderUPA || !receiverUPA || !amount) {
            return NextResponse.json(
                { error: "Missing required fields: client_tx_id, senderUPA, receiverUPA, amount" },
                { status: 400 }
            );
        }

        if (amount <= 0) {
            return NextResponse.json(
                { error: "Amount must be positive" },
                { status: 400 }
            );
        }

        // Check per-tx limit
        const PER_TX_LIMIT = Number(process.env.NEXT_PUBLIC_OFFLINE_TX_LIMIT ?? 500);
        if (amount > PER_TX_LIMIT) {
            return NextResponse.json(
                { error: `Amount ${amount} exceeds per-tx limit of ${PER_TX_LIMIT}` },
                { status: 400 }
            );
        }

        if (!isSupabaseConfigured() || !supabase) {
            // Demo mode — accept immediately
            return NextResponse.json({
                success: true,
                status: "accepted_offline",
                client_tx_id,
                message: "Offline acceptance recorded (demo mode)",
            });
        }

        // Check for existing record (idempotency)
        const { data: existing } = await supabase
            .from("transactions")
            .select("id, settlement_state")
            .eq("client_tx_id", client_tx_id)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({
                success: true,
                status: existing.settlement_state,
                client_tx_id,
                tx_id: existing.id,
                message: "Already recorded",
            });
        }

        // Insert as accepted_offline
        const { data: tx, error: insertError } = await supabase
            .from("transactions")
            .insert({
                client_tx_id,
                nonce,
                sender: senderUPA,
                recipient: receiverUPA,
                amount,
                intent: intent || "payment",
                status: "pending",
                settlement_state: "accepted_offline",
                mode: "offline",
                offline_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
                sender_signature,
                receiver_signature,
                sender_device_id,
                receiver_device_id,
                proof: proof || {},
                sync_attempts: 0,
                created_at: acceptedAt ? new Date(acceptedAt).toISOString() : new Date().toISOString(),
            })
            .select()
            .single();

        if (insertError) {
            return NextResponse.json(
                { error: insertError.message },
                { status: 500 }
            );
        }

        // Record ledger entries
        try {
            await supabase.from("offline_wallet_ledger").insert([
                {
                    tx_id: tx?.id,
                    client_tx_id,
                    user_id: senderUPA,
                    upa_address: senderUPA,
                    direction: "debit",
                    amount,
                    state: "applied",
                },
                {
                    tx_id: tx?.id,
                    client_tx_id,
                    user_id: receiverUPA,
                    upa_address: receiverUPA,
                    direction: "credit",
                    amount,
                    state: "applied",
                },
            ]);
        } catch {
            // Non-fatal
        }

        return NextResponse.json({
            success: true,
            status: "accepted_offline",
            client_tx_id,
            tx_id: tx?.id,
        });
    } catch (error) {
        console.error("Offline accept error:", error);
        return NextResponse.json(
            { error: "Failed to record offline acceptance" },
            { status: 500 }
        );
    }
}
