import { NextRequest, NextResponse } from "next/server";
import { MOCK_NID_DATABASE } from "@/types";

// POST /api/nid — Verify NID number
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

    // Look up in mock database
    const nid = MOCK_NID_DATABASE.find(
      (n) => n.nidNumber.toUpperCase() === nidNumber.toUpperCase()
    );

    if (!nid) {
      return NextResponse.json(
        {
          success: false,
          error: "NID not found in database",
          nidNumber,
        },
        { status: 404 }
      );
    }

    if (!nid.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "NID card is inactive/expired",
          nidNumber,
        },
        { status: 403 }
      );
    }

    // Simulate NFC/verification delay
    await new Promise((r) => setTimeout(r, 800));

    return NextResponse.json({
      success: true,
      nid: {
        nidNumber: nid.nidNumber,
        fullName: nid.fullName,
        dateOfBirth: nid.dateOfBirth,
        district: nid.district,
        photoUrl: nid.photoUrl,
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

// GET /api/nid — List all mock NID cards (for demo)
export async function GET() {
  return NextResponse.json({
    data: MOCK_NID_DATABASE.map((nid) => ({
      nidNumber: nid.nidNumber,
      fullName: nid.fullName,
      district: nid.district,
      isActive: nid.isActive,
      linkedUPA: nid.linkedUPA,
    })),
  });
}
