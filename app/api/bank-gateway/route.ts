import { NextRequest, NextResponse } from "next/server";
import { MOCK_NID_DATABASE } from "@/types";

// POST /api/bank-gateway/link — Link bank account via NID
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nidNumber, bankName, accountNumber, isPrimary = true } = body;

    if (!nidNumber || !bankName) {
      return NextResponse.json(
        { success: false, error: "NID number and bank name are required" },
        { status: 400 }
      );
    }

    // Verify NID exists
    const nid = MOCK_NID_DATABASE.find(
      (n) => n.nidNumber.toUpperCase() === nidNumber.toUpperCase()
    );

    if (!nid) {
      return NextResponse.json(
        { success: false, error: "NID not found" },
        { status: 404 }
      );
    }

    // Simulate bank verification delay
    await new Promise((r) => setTimeout(r, 1000));

    // Check if bank is already linked
    const existingBank = nid.linkedBanks.find(
      (b) => b.bankName.toLowerCase() === bankName.toLowerCase()
    );

    if (existingBank) {
      return NextResponse.json({
        success: true,
        message: "Bank account already linked",
        bankAccount: existingBank,
      });
    }

    // Mock: create new linked bank
    const masked = accountNumber
      ? `****${accountNumber.slice(-4)}`
      : `****${Math.floor(1000 + Math.random() * 9000)}`;

    const newBank = {
      id: `bank_${Date.now()}`,
      bankName,
      accountNumber: masked,
      accountType: "savings" as const,
      isPrimary,
      linkedVia: "nid" as const,
    };

    return NextResponse.json({
      success: true,
      message: `Bank account linked via NID ${nid.nidNumber}`,
      bankAccount: newBank,
    });
  } catch (error) {
    console.error("[Bank Gateway] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/bank-gateway — Get banks for a NID
export async function GET(request: NextRequest) {
  const nidNumber = request.nextUrl.searchParams.get("nid");

  if (!nidNumber) {
    // Return supported banks list
    return NextResponse.json({
      banks: [
        "Nepal Bank",
        "Nabil Bank",
        "NIC Asia Bank",
        "Himalayan Bank",
        "Standard Chartered Bank Nepal",
      ],
    });
  }

  const nid = MOCK_NID_DATABASE.find(
    (n) => n.nidNumber.toUpperCase() === nidNumber.toUpperCase()
  );

  if (!nid) {
    return NextResponse.json(
      { success: false, error: "NID not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    nidNumber: nid.nidNumber,
    fullName: nid.fullName,
    linkedBanks: nid.linkedBanks,
  });
}
