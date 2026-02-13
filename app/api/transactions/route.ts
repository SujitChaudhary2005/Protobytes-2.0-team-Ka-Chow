import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getTransactions as getLocalTransactions, saveTransaction as saveLocalTransaction } from "@/lib/storage";

// Fallback demo transactions (shown when Supabase is not configured and localStorage is empty)
const FALLBACK_TRANSACTIONS: any[] = [
  { id: "demo-001", tx_id: "UPA-2026-00001", recipient: "traffic@nepal.gov", recipientName: "Nepal Traffic Police", amount: 500, intent: "Traffic Violation Fine", intentCategory: "fine", status: "settled", mode: "online", metadata: { violation: "Red Zone Parking", vehicle: "BA 1 PA 4567", location: "New Road, Kathmandu", license: "ABC-1234" }, timestamp: Date.now() - 6 * 3600000, settledAt: Date.now() - 5.97 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-002", tx_id: "UPA-2026-00002", recipient: "traffic@nepal.gov", recipientName: "Nepal Traffic Police", amount: 1000, intent: "Traffic Violation Fine", intentCategory: "fine", status: "settled", mode: "offline", metadata: { violation: "Signal Jump", vehicle: "BA 2 PA 8901", location: "Kalanki Chowk", license: "DEF-5678" }, timestamp: Date.now() - 5 * 3600000, settledAt: Date.now() - 4.92 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-003", tx_id: "UPA-2026-00003", recipient: "traffic@nepal.gov", recipientName: "Nepal Traffic Police", amount: 2000, intent: "Traffic Violation Fine", intentCategory: "fine", status: "settled", mode: "online", metadata: { violation: "Drunk Driving", vehicle: "BA 3 KHA 3456", location: "Tinkune", license: "GHI-9012" }, timestamp: Date.now() - 4.5 * 3600000, settledAt: Date.now() - 4.47 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-004", tx_id: "UPA-2026-00007", recipient: "traffic@nepal.gov", recipientName: "Nepal Traffic Police", amount: 1500, intent: "Traffic Violation Fine", intentCategory: "fine", status: "queued", mode: "offline", metadata: { violation: "Illegal Parking", vehicle: "BA 7 KHA 9012", location: "Durbar Marg", license: "STU-5678" }, timestamp: Date.now() - 2.5 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-005", tx_id: "UPA-2026-00016", recipient: "traffic@nepal.gov", recipientName: "Nepal Traffic Police", amount: 1000, intent: "Driving License Fee", intentCategory: "fee", status: "settled", mode: "online", metadata: { licenseType: "Two Wheeler", category: "Renewal" }, timestamp: Date.now() - 5.75 * 3600000, settledAt: Date.now() - 5.72 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-006", tx_id: "UPA-2026-00021", recipient: "revenue@lalitpur.gov.np", recipientName: "Lalitpur Metropolitan City", amount: 15000, intent: "Property Tax", intentCategory: "tax", status: "settled", mode: "online", metadata: { ward: "7", fiscalYear: "2082/83", areaSqft: "2400", lotNumber: "KTM-4421" }, timestamp: Date.now() - 6.17 * 3600000, settledAt: Date.now() - 6.13 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-007", tx_id: "UPA-2026-00024", recipient: "revenue@lalitpur.gov.np", recipientName: "Lalitpur Metropolitan City", amount: 45000, intent: "Property Tax", intentCategory: "tax", status: "settled", mode: "online", metadata: { ward: "15", fiscalYear: "2082/83", areaSqft: "5000", lotNumber: "LAL-7754" }, timestamp: Date.now() - 4.83 * 3600000, settledAt: Date.now() - 4.8 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-008", tx_id: "UPA-2026-00025", recipient: "revenue@lalitpur.gov.np", recipientName: "Lalitpur Metropolitan City", amount: 12000, intent: "Property Tax", intentCategory: "tax", status: "queued", mode: "offline", metadata: { ward: "9", fiscalYear: "2082/83", areaSqft: "2000", lotNumber: "LAL-8865" }, timestamp: Date.now() - 4.33 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-009", tx_id: "UPA-2026-00031", recipient: "revenue@lalitpur.gov.np", recipientName: "Lalitpur Metropolitan City", amount: 5000, intent: "Business Registration Fee", intentCategory: "fee", status: "settled", mode: "online", metadata: { businessName: "Himalayan Cafe", businessType: "Restaurant", ward: "5" }, timestamp: Date.now() - 5.17 * 3600000, settledAt: Date.now() - 5.13 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-010", tx_id: "UPA-2026-00034", recipient: "fee@tribhuvan.edu.np", recipientName: "Tribhuvan University", amount: 25000, intent: "Tuition Fee", intentCategory: "tuition", status: "settled", mode: "online", metadata: { program: "BCA", semester: "4th", studentId: "TU-2024-4456" }, timestamp: Date.now() - 6.08 * 3600000, settledAt: Date.now() - 6.05 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-011", tx_id: "UPA-2026-00035", recipient: "fee@tribhuvan.edu.np", recipientName: "Tribhuvan University", amount: 35000, intent: "Tuition Fee", intentCategory: "tuition", status: "settled", mode: "online", metadata: { program: "BBA", semester: "6th", studentId: "TU-2023-5567" }, timestamp: Date.now() - 5.58 * 3600000, settledAt: Date.now() - 5.55 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-012", tx_id: "UPA-2026-00037", recipient: "fee@tribhuvan.edu.np", recipientName: "Tribhuvan University", amount: 20000, intent: "Tuition Fee", intentCategory: "tuition", status: "queued", mode: "offline", metadata: { program: "BCA", semester: "2nd", studentId: "TU-2025-7789" }, timestamp: Date.now() - 4.08 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-013", tx_id: "UPA-2026-00042", recipient: "fee@tribhuvan.edu.np", recipientName: "Tribhuvan University", amount: 2500, intent: "Examination Fee", intentCategory: "fee", status: "settled", mode: "online", metadata: { program: "BCA", semester: "4th", studentId: "TU-2024-4456" }, timestamp: Date.now() - 5.92 * 3600000, settledAt: Date.now() - 5.88 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-014", tx_id: "UPA-2026-00047", recipient: "ward5@kathmandu.gov.np", recipientName: "Kathmandu Ward 5 Office", amount: 200, intent: "Birth Certificate Fee", intentCategory: "fee", status: "settled", mode: "online", metadata: { childName: "Aarav Khadka", dob: "2082-05-15", parentName: "Ramesh Khadka" }, timestamp: Date.now() - 5.67 * 3600000, settledAt: Date.now() - 5.63 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-015", tx_id: "UPA-2026-00051", recipient: "ward5@kathmandu.gov.np", recipientName: "Kathmandu Ward 5 Office", amount: 500, intent: "Recommendation Letter Fee", intentCategory: "fee", status: "queued", mode: "offline", metadata: { purpose: "Bank Loan", documentType: "Recommendation Letter" }, timestamp: Date.now() - 2.67 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-016", tx_id: "UPA-2026-00052", recipient: "license@dotm.gov.np", recipientName: "Dept. of Transport Management", amount: 25000, intent: "Vehicle Registration Fee", intentCategory: "fee", status: "settled", mode: "online", metadata: { vehicleType: "Motorcycle", manufacturer: "Yamaha", model: "FZ-S V3" }, timestamp: Date.now() - 5.25 * 3600000, settledAt: Date.now() - 5.22 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-017", tx_id: "UPA-2026-00053", recipient: "license@dotm.gov.np", recipientName: "Dept. of Transport Management", amount: 45000, intent: "Vehicle Registration Fee", intentCategory: "fee", status: "settled", mode: "online", metadata: { vehicleType: "Car", manufacturer: "Hyundai", model: "i20" }, timestamp: Date.now() - 3.17 * 3600000, settledAt: Date.now() - 3.13 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-018", tx_id: "UPA-2026-00054", recipient: "license@dotm.gov.np", recipientName: "Dept. of Transport Management", amount: 15000, intent: "Vehicle Registration Fee", intentCategory: "fee", status: "queued", mode: "offline", metadata: { vehicleType: "Scooter", manufacturer: "Honda", model: "Dio" }, timestamp: Date.now() - 1.17 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-019", tx_id: "UPA-2026-00055", recipient: "license@dotm.gov.np", recipientName: "Dept. of Transport Management", amount: 15000, intent: "Route Permit Fee", intentCategory: "fee", status: "settled", mode: "online", metadata: { route: "Kathmandu - Bhaktapur", vehicleNumber: "BA 1 KHA 1234", permitDuration: "1 Year" }, timestamp: Date.now() - 2.17 * 3600000, settledAt: Date.now() - 2.13 * 3600000, walletProvider: "upa_pay" },
  { id: "demo-020", tx_id: "UPA-2026-00038", recipient: "fee@tribhuvan.edu.np", recipientName: "Tribhuvan University", amount: 45000, intent: "Tuition Fee", intentCategory: "tuition", status: "settled", mode: "online", metadata: { program: "MBA", semester: "2nd", studentId: "TU-2022-8890" }, timestamp: Date.now() - 3.08 * 3600000, settledAt: Date.now() - 3.05 * 3600000, walletProvider: "upa_pay" },
];

// GET /api/transactions — list all transactions
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const intent = searchParams.get("intent");
  const upaId = searchParams.get("upa_id");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "100");

  try {
    if (isSupabaseConfigured()) {
      // Use left joins so transactions still appear even if UPA/intent is missing
      let query = supabase
        .from("transactions")
        .select(`
          *,
          upas (address, entity_name),
          intents (intent_code, label, category)
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      if (intent) {
        query = query.eq("intents.intent_code", intent);
      }
      if (upaId) {
        query = query.ilike("upas.address", `%${upaId}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      // Build summary
      const { data: allTx } = await supabase
        .from("transactions")
        .select("status, amount, intents!inner(label)");

      const summary = buildSummary(allTx || []);

      const normalized = (data || []).map((tx: any) => {
        const upaAddress = tx.upas?.address || tx.upa_address || tx.upa_id || null;
        const entityName = tx.upas?.entity_name || tx.entity_name || null;
        const intentLabel = tx.intents?.label || tx.intent_label || null;
        const intentCategory = tx.intents?.category || tx.intent_category || null;
        const intentCode = tx.intents?.intent_code || tx.intent_code || null;

        return {
          ...tx,
          upa_address: upaAddress,
          entity_name: entityName,
          intent_label: intentLabel,
          intent_category: intentCategory,
          intent_code: intentCode,
          recipient: tx.recipient || upaAddress,
          recipientName: tx.recipientName || entityName,
        };
      });

      return NextResponse.json({
        data: normalized,
        pagination: { page, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        summary,
      });
    }

    // Fallback: localStorage-based (for development without Supabase)
    const localTx = getLocalTransactions();
    // Only show fallback data if explicitly in DEMO mode
    const showDemoData = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    const txData = localTx.length > 0 ? localTx : (showDemoData ? FALLBACK_TRANSACTIONS : []);
    const filtered = txData.filter((tx) => {
      if (status && status !== "all" && tx.status !== status) return false;
      if (upaId) {
        const q = upaId.toLowerCase();
        const matchRecipient = tx.recipient?.toLowerCase().includes(q);
        const matchName = (tx as any).recipientName?.toLowerCase().includes(q);
        if (!matchRecipient && !matchName) return false;
      }
      return true;
    });

    return NextResponse.json({
      data: filtered,
      pagination: { page: 1, total: filtered.length, totalPages: 1 },
      summary: buildLocalSummary(txData),
    });
  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    // Fallback to local or demo data
    const localTx = getLocalTransactions();
    const showDemoData = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    const txData = localTx.length > 0 ? localTx : (showDemoData ? FALLBACK_TRANSACTIONS : []);
    return NextResponse.json({
      data: txData,
      pagination: { page: 1, total: txData.length, totalPages: 1 },
      summary: buildLocalSummary(txData),
    });
  }
}

function buildSummary(transactions: any[]) {
  const totalTransactions = transactions.length;
  const settledCount = transactions.filter((t) => t.status === "settled").length;
  const queuedCount = transactions.filter((t) => t.status === "queued").length;
  const totalAmount = transactions
    .filter((t) => t.status === "settled")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const byIntent: Record<string, { count: number; amount: number }> = {};
  transactions.forEach((t) => {
    const label = t.intents?.label || "Other";
    if (!byIntent[label]) byIntent[label] = { count: 0, amount: 0 };
    byIntent[label].count++;
    byIntent[label].amount += Number(t.amount);
  });

  return { totalTransactions, totalAmount, settledCount, queuedCount, byIntent };
}

function buildLocalSummary(transactions: any[]) {
  const totalTransactions = transactions.length;
  const settledCount = transactions.filter((t) => t.status === "settled").length;
  const queuedCount = transactions.filter((t) => t.status === "queued").length;
  const totalAmount = transactions
    .filter((t) => t.status === "settled")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const byIntent: Record<string, { count: number; amount: number }> = {};
  transactions.forEach((t) => {
    const label = t.intent || "Other";
    if (!byIntent[label]) byIntent[label] = { count: 0, amount: 0 };
    byIntent[label].count++;
    byIntent[label].amount += Number(t.amount);
  });

  return { totalTransactions, totalAmount, settledCount, queuedCount, byIntent };
}
