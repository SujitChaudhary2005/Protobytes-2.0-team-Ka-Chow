import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Fallback data when Supabase is not configured
const FALLBACK_UPAS = [
  {
    id: "a1000000-0000-0000-0000-000000000001",
    address: "traffic@nepal.gov",
    entity_name: "Nepal Traffic Police",
    entity_type: "government",
    public_key: null,
    intents: [
      { id: "b1000000-0000-0000-0000-000000000001", intent_code: "traffic_fine", label: "Traffic Violation Fine", category: "fine", amount_type: "range", fixed_amount: null, min_amount: 500, max_amount: 10000, metadata_schema: { license: { type: "string", label: "License Number", required: true }, violation: { type: "string", label: "Violation Type", required: true }, vehicle: { type: "string", label: "Vehicle Number", required: true }, location: { type: "string", label: "Location", required: true } } },
      { id: "b1000000-0000-0000-0000-000000000002", intent_code: "license_fee", label: "Driving License Fee", category: "fee", amount_type: "fixed", fixed_amount: 1000, min_amount: null, max_amount: null, metadata_schema: { licenseType: { type: "string", label: "License Type", required: true }, category: { type: "string", label: "Category (New/Renewal)", required: true } } },
    ],
  },
  {
    id: "a1000000-0000-0000-0000-000000000002",
    address: "revenue@lalitpur.gov.np",
    entity_name: "Lalitpur Metropolitan City",
    entity_type: "government",
    public_key: null,
    intents: [
      { id: "b1000000-0000-0000-0000-000000000003", intent_code: "property_tax", label: "Property Tax", category: "tax", amount_type: "range", fixed_amount: null, min_amount: 1000, max_amount: 500000, metadata_schema: { ward: { type: "string", label: "Ward Number", required: true }, lotNumber: { type: "string", label: "Lot/Plot Number", required: true }, fiscalYear: { type: "string", label: "Fiscal Year", required: true }, areaSqft: { type: "string", label: "Area (sq ft)", required: false } } },
      { id: "b1000000-0000-0000-0000-000000000004", intent_code: "business_registration", label: "Business Registration Fee", category: "fee", amount_type: "fixed", fixed_amount: 5000, min_amount: null, max_amount: null, metadata_schema: { businessName: { type: "string", label: "Business Name", required: true }, businessType: { type: "string", label: "Business Type", required: true }, ward: { type: "string", label: "Ward Number", required: true } } },
    ],
  },
  {
    id: "a1000000-0000-0000-0000-000000000003",
    address: "fee@tribhuvan.edu.np",
    entity_name: "Tribhuvan University",
    entity_type: "institution",
    public_key: null,
    intents: [
      { id: "b1000000-0000-0000-0000-000000000005", intent_code: "tuition_fee", label: "Tuition Fee", category: "tuition", amount_type: "range", fixed_amount: null, min_amount: 5000, max_amount: 100000, metadata_schema: { program: { type: "string", label: "Program", required: true }, semester: { type: "string", label: "Semester", required: true }, studentId: { type: "string", label: "Student ID", required: true } } },
      { id: "b1000000-0000-0000-0000-000000000006", intent_code: "exam_fee", label: "Examination Fee", category: "fee", amount_type: "fixed", fixed_amount: 2500, min_amount: null, max_amount: null, metadata_schema: { program: { type: "string", label: "Program", required: true }, semester: { type: "string", label: "Semester", required: true }, studentId: { type: "string", label: "Student ID", required: true } } },
    ],
  },
  {
    id: "a1000000-0000-0000-0000-000000000004",
    address: "ward5@kathmandu.gov.np",
    entity_name: "Kathmandu Ward 5 Office",
    entity_type: "government",
    public_key: null,
    intents: [
      { id: "b1000000-0000-0000-0000-000000000007", intent_code: "birth_certificate", label: "Birth Certificate Fee", category: "fee", amount_type: "fixed", fixed_amount: 200, min_amount: null, max_amount: null, metadata_schema: { childName: { type: "string", label: "Child Name", required: true }, dob: { type: "string", label: "Date of Birth", required: true }, parentName: { type: "string", label: "Parent Name", required: true } } },
      { id: "b1000000-0000-0000-0000-000000000008", intent_code: "recommendation_letter", label: "Recommendation Letter Fee", category: "fee", amount_type: "fixed", fixed_amount: 500, min_amount: null, max_amount: null, metadata_schema: { purpose: { type: "string", label: "Purpose", required: true }, documentType: { type: "string", label: "Document Type", required: true } } },
    ],
  },
  {
    id: "a1000000-0000-0000-0000-000000000005",
    address: "license@dotm.gov.np",
    entity_name: "Dept. of Transport Management",
    entity_type: "government",
    public_key: null,
    intents: [
      { id: "b1000000-0000-0000-0000-000000000009", intent_code: "vehicle_registration", label: "Vehicle Registration Fee", category: "fee", amount_type: "range", fixed_amount: null, min_amount: 5000, max_amount: 50000, metadata_schema: { vehicleType: { type: "string", label: "Vehicle Type", required: true }, manufacturer: { type: "string", label: "Manufacturer", required: true }, model: { type: "string", label: "Model", required: true } } },
      { id: "b1000000-0000-0000-0000-000000000010", intent_code: "route_permit", label: "Route Permit Fee", category: "fee", amount_type: "fixed", fixed_amount: 15000, min_amount: null, max_amount: null, metadata_schema: { route: { type: "string", label: "Route", required: true }, vehicleNumber: { type: "string", label: "Vehicle Number", required: true }, permitDuration: { type: "string", label: "Permit Duration", required: true } } },
    ],
  },
];

export async function GET() {
  try {
    if (isSupabaseConfigured()) {
      const { data: upas, error } = await supabase
        .from("upas")
        .select(`
          id,
          address,
          entity_name,
          entity_type,
          public_key,
          intents (
            id,
            intent_code,
            category,
            label,
            amount_type,
            fixed_amount,
            min_amount,
            max_amount,
            metadata_schema
          )
        `)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return NextResponse.json({ data: upas });
    }

    // Fallback: return hardcoded data
    return NextResponse.json({ data: FALLBACK_UPAS });
  } catch (error: any) {
    console.error("Error fetching UPAs:", error);
    return NextResponse.json({ data: FALLBACK_UPAS });
  }
}
