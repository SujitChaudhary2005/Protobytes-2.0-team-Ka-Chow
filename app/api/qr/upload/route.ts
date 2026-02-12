import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * POST /api/qr/upload — Upload a QR code PNG to Supabase Storage
 *
 * Body (JSON):
 *   - image: base64-encoded PNG (data URI or raw base64)
 *   - filename: desired filename (e.g., "traffic@nepal.gov-traffic_fine.png")
 *
 * Returns:
 *   - url: the public URL of the uploaded QR image
 */
export async function POST(request: NextRequest) {
    try {
        const { image, filename } = await request.json();

        if (!image || !filename) {
            return NextResponse.json(
                { success: false, error: "image and filename are required" },
                { status: 400 }
            );
        }

        if (!isSupabaseConfigured()) {
            return NextResponse.json(
                { success: false, error: "Supabase not configured" },
                { status: 503 }
            );
        }

        // Strip data URI prefix if present
        const base64Data = image.replace(/^data:image\/png;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        // Sanitize filename
        const safeName = filename.replace(/[^a-zA-Z0-9@._-]/g, "_");
        const filePath = `${safeName}`;

        // Upload to Supabase Storage (upsert to allow overwriting)
        const { data, error } = await supabase.storage
            .from("qr-codes")
            .upload(filePath, buffer, {
                contentType: "image/png",
                upsert: true,
            });

        if (error) {
            console.error("Storage upload error:", error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        // Get the public URL
        const { data: urlData } = supabase.storage
            .from("qr-codes")
            .getPublicUrl(data.path);

        return NextResponse.json({
            success: true,
            url: urlData.publicUrl,
            path: data.path,
        });
    } catch (err: any) {
        console.error("QR upload error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Upload failed" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/qr/upload?upa=traffic@nepal.gov&intent=traffic_fine
 *
 * Check if a QR code already exists for a given UPA + intent combo
 */
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const upa = url.searchParams.get("upa");
        const intent = url.searchParams.get("intent");

        if (!upa || !intent) {
            return NextResponse.json(
                { success: false, error: "upa and intent params required" },
                { status: 400 }
            );
        }

        if (!isSupabaseConfigured()) {
            return NextResponse.json({ success: false, url: null });
        }

        const safeName = `${upa}-${intent}.png`.replace(/[^a-zA-Z0-9@._-]/g, "_");

        const { data: urlData } = supabase.storage
            .from("qr-codes")
            .getPublicUrl(safeName);

        return NextResponse.json({
            success: true,
            url: urlData.publicUrl,
        });
    } catch (err: any) {
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
