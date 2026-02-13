import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
        return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    // Fallback to localStorage if Supabase not configured
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ data: null, fallback: true });
    }

    const { data, error } = await supabase
        .from("officer_state")
        .select("*")
        .eq("user_id", userId)
        .single();

    // Ignore "no rows found" error, just return null data
    if (error && error.code !== "PGRST116") {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || null });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { user_id, selected_upa_address, selected_intent_code, last_qr_payload } = body;

        if (!user_id || !selected_upa_address) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Fallback to localStorage if Supabase not configured
        if (!isSupabaseConfigured()) {
            return NextResponse.json({ 
                data: { user_id, selected_upa_address, selected_intent_code, last_qr_payload },
                fallback: true 
            });
        }

        const { data, error } = await supabase
            .from("officer_state")
            .upsert({
                user_id,
                selected_upa_address,
                selected_intent_code: selected_intent_code || null,
                last_qr_payload: last_qr_payload || null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
