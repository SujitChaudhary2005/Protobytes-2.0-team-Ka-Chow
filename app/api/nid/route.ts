import { NextRequest, NextResponse } from "next/server";
import { MOCK_NID_DATABASE } from "@/types";
import { getNIDImageUrl } from "@/lib/nid-storage";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// POST /api/nid — Verify NID number (queries Supabase DB first, falls back to mock)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nidNumber } = body;

    if (!nidNumber) {
      return NextResponse.json(
        { success: false, error: "NID number is required" },
        { status: 400 }
      );
    }

    // ── Try Supabase DB first ──
    if (isSupabaseConfigured()) {
      const { data: nidRow, error } = await supabase
        .from("nid_cards")
        .select(`
          *,
          upas!nid_cards_upa_id_fkey ( address, entity_name ),
          bank_accounts ( id, bank_name, account_number, account_type, is_primary )
        `)
        .ilike("nid_number", nidNumber)
        .single();

      if (!error && nidRow) {
        // Simulate realistic DB lookup delay
        await new Promise((r) => setTimeout(r, 600));

        const photoUrl = getNIDImageUrl(nidRow.nid_number) || nidRow.photo_url;

        return NextResponse.json({
          success: true,
          source: "database",
          nid: {
            nidNumber: nidRow.nid_number,
            fullName: nidRow.full_name,
            dateOfBirth: nidRow.date_of_birth,
            issueDate: nidRow.issue_date,
            expiryDate: nidRow.expiry_date,
            district: nidRow.district,
            photoUrl,
            isActive: nidRow.is_active,
            linkedUPA: nidRow.upas?.address || null,
            linkedBanks: (nidRow.bank_accounts || []).map((b: any) => ({
              id: b.id,
              bankName: b.bank_name,
              accountNumber: `****${b.account_number.slice(-4)}`,
              isPrimary: b.is_primary,
            })),
          },
        });
      }
      // If Supabase query failed or no result, fall through to mock
    }

    // ── Fallback: in-memory mock database ──
    const nid = MOCK_NID_DATABASE.find(
      (n) => n.nidNumber.toUpperCase() === nidNumber.toUpperCase()
    );

    if (!nid) {
      return NextResponse.json(
        { success: false, error: "NID not found in database", nidNumber },
        { status: 404 }
      );
    }

    if (!nid.isActive) {
      return NextResponse.json(
        { success: false, error: "NID card is inactive/expired", nidNumber },
        { status: 403 }
      );
    }

    // Simulate verification delay
    await new Promise((r) => setTimeout(r, 800));

    const photoUrl = getNIDImageUrl(nid.nidNumber) || nid.photoUrl;

    return NextResponse.json({
      success: true,
      source: "mock",
      nid: {
        nidNumber: nid.nidNumber,
        fullName: nid.fullName,
        dateOfBirth: nid.dateOfBirth,
        issueDate: nid.issueDate,
        expiryDate: nid.expiryDate,
        district: nid.district,
        photoUrl: photoUrl,
        isActive: nid.isActive,
        linkedUPA: nid.linkedUPA,
        linkedBanks: nid.linkedBanks.map((b) => ({
          id: b.id,
          bankName: b.bankName,
          accountNumber: b.accountNumber,
          isPrimary: b.isPrimary,
        })),
      },
    });
  } catch (error) {
    console.error("[NID API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/nid — List all NID cards (from DB or mock, for demo)
export async function GET() {
  // Try Supabase first
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from("nid_cards")
      .select(`
        nid_number, full_name, district, is_active,
        upas!nid_cards_upa_id_fkey ( address )
      `)
      .order("full_name");

    if (!error && data) {
      return NextResponse.json({
        source: "database",
        data: data.map((row: any) => ({
          nidNumber: row.nid_number,
          fullName: row.full_name,
          district: row.district,
          isActive: row.is_active,
          linkedUPA: row.upas?.address || null,
        })),
      });
    }
  }

  // Fallback to mock
  return NextResponse.json({
    source: "mock",
    data: MOCK_NID_DATABASE.map((nid) => ({
      nidNumber: nid.nidNumber,
      fullName: nid.fullName,
      district: nid.district,
      isActive: nid.isActive,
      linkedUPA: nid.linkedUPA,
    })),
  });
}
