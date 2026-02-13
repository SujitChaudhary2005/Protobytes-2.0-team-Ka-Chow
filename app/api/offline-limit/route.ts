import { NextRequest, NextResponse } from "next/server";

// POST /api/offline-limit — Set or update offline spending limit
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { upaAddress, limitAmount } = body;

    if (!limitAmount || limitAmount < 0) {
      return NextResponse.json(
        { success: false, error: "Valid limitAmount is required" },
        { status: 400 }
      );
    }

    // In production: store in server DB. For demo: just confirm.
    return NextResponse.json({
      success: true,
      offlineLimit: {
        upaAddress: upaAddress || "demo@upa.np",
        maxAmount: limitAmount,
        currentUsed: 0,
        remaining: limitAmount,
      },
    });
  } catch (error) {
    console.error("[Offline Limit API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/offline-limit — Get current offline limit
export async function GET(request: NextRequest) {
  const upaAddress = request.nextUrl.searchParams.get("upa");

  // Default limits per user (mock)
  const limits: Record<string, { maxAmount: number; currentUsed: number }> = {
    "ram@upa.np": { maxAmount: 5000, currentUsed: 0 },
    "sita@upa.np": { maxAmount: 10000, currentUsed: 0 },
    "hari@upa.np": { maxAmount: 2000, currentUsed: 0 },
  };

  const limit = upaAddress && limits[upaAddress]
    ? limits[upaAddress]
    : { maxAmount: 5000, currentUsed: 0 };

  return NextResponse.json({
    success: true,
    offlineLimit: {
      upaAddress: upaAddress || "default",
      maxAmount: limit.maxAmount,
      currentUsed: limit.currentUsed,
      remaining: limit.maxAmount - limit.currentUsed,
    },
  });
}
