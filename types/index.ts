// ============================================
// UPA-NP Shared Types (PRD-Aligned)
// ============================================

// === User & Role Types ===
export type UserRole = "citizen" | "officer" | "merchant" | "admin";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  citizenship_id?: string;
  upa_id?: string;
  nidNumber?: string;        // Linked National ID
}

// === National ID (NID) Types ===
export interface NIDCard {
  nidNumber: string;           // "RAM-KTM-1990-4521"
  fullName: string;            // "Ram Bahadur Thapa"
  dateOfBirth: string;         // "1990-05-15"
  gender: "M" | "F" | "O";    // Male / Female / Other
  issueDate: string;
  expiryDate: string;
  photoUrl: string;            // Mock photo URL or NID number (resolved via getNIDImageUrl)
  district: string;            // "Kathmandu"
  isActive: boolean;
  linkedUPA: string | null;    // "ram@upa.np"
  linkedBanks: BankAccount[];
}

// === Bank Account Types ===
export interface BankAccount {
  id: string;
  bankName: string;            // "Nepal Bank"
  accountNumber: string;       // Masked: "****2341"
  accountType: "savings" | "current";
  isPrimary: boolean;
  linkedVia: "nid";
}

// === SaralPay Offline Wallet ===
export interface OfflineWallet {
  loaded: boolean;             // whether SaralPay wallet is active
  balance: number;             // current SaralPay wallet balance
  initialLoadAmount: number;   // how much was loaded originally
  loadedAt: number;            // timestamp of last load
  lastReset: number;           // timestamp of last sync/reset
}

// === C2C (Citizen-to-Citizen) Transaction ===
export interface C2CPayment {
  fromUPA: string;             // "ram@upa.np"
  toUPA: string;               // "sita@upa.np"
  amount: number;
  intent: string;              // "Lunch split" | "Movie tickets" | "Rent"
  message?: string;            // Optional note
  category: "personal";
}

// === Bill Payment Types ===
export interface BillPayment {
  billerUPA: string;           // "nea@utility.np"
  billerName: string;          // "Nepal Electricity Authority"
  billType: "electricity" | "water" | "internet" | "mobile" | "rent" | "school";
  accountNumber: string;       // Customer's utility account
  billingPeriod: string;       // "February 2026"
  dueDate: string;
  amount: number;
  consumption?: {
    units?: number;
    previousReading?: number;
    currentReading?: number;
  };
}

// === Merchant Profile (citizen → merchant registration) ===
export interface MerchantProfile {
  id: string;
  businessName: string;
  businessType: string;
  ward: string;
  address: string;
  phone: string;
  panNumber: string;          // PAN/VAT registration number
  upaAddress: string;         // generated merchant UPA e.g. "himalayan-cafe@merchant.np"
  registeredAt: number;
  ownerId: string;            // user ID of the citizen who registered
}

// === QR Payload Types (The Innovation) ===

// Static QR — generated once, reused forever
// Contains only the intent definition, not payer details
export interface StaticQRPayload {
  version: "1.0";
  upa: string;              // "traffic@nepal.gov"
  entity_name: string;      // "Nepal Traffic Police"
  intent: {
    id: string;             // "traffic_fine"
    category: string;       // "fine"
    label: string;          // "Traffic Violation Fine"
  };
  amount_type: "fixed" | "range" | "open";
  amount?: number;          // fixed amount (if fixed)
  min_amount?: number;      // if range
  max_amount?: number;      // if range
  currency: "NPR";
  metadata_schema: Record<string, { type: string; label: string; required: boolean }>;
  // Offline signing fields (present when officer generates signed QR)
  signature?: string;
  publicKey?: string;
  signed?: boolean;
  nonce?: string;
  issuedAt?: string;
  expiresAt?: string;
}

// Full transaction payload — built at payment time by the citizen app
interface BaseQRPayload {
  version: "1.0";
  upa: string;
  intent: {
    id: string;
    category: string;
    label: string;
  };
  amount: number;
  currency: "NPR";
  metadata: Record<string, string>;
  payer_name: string;
  payer_id: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
}

export interface OnlineQRPayload extends BaseQRPayload {
  type: "online";
}

export interface OfflineQRPayload extends BaseQRPayload {
  type: "offline";
  signature: string;        // Ed25519 signature (hex)
  publicKey: string;        // Issuer's public key (hex)
}

export type QRPayload = OnlineQRPayload | OfflineQRPayload;

// === UPA Types ===

export interface UPA {
  id: string;
  address: string;
  entity_name: string;
  entity_type: "government" | "institution" | "merchant" | "citizen" | "utility";
  business_category?: string;
  nid_number?: string;
  public_key: string | null;
  intents: IntentTemplate[];
}

export interface IntentTemplate {
  id: string;
  intent_code: string;
  category: string;
  label: string;
  amount_type: "fixed" | "range" | "open";
  fixed_amount: number | null;
  min_amount: number | null;
  max_amount: number | null;
  metadata_schema: Record<string, MetadataField>;
}

export interface MetadataField {
  type: string;
  label: string;
  required: boolean;
}

// === Transaction Types ===

export type TransactionType = "payment" | "c2c" | "nid_payment" | "bill_payment" | "merchant_purchase";
export type PaymentSource = "wallet" | "nid_bank" | "bank_gateway" | "esewa" | "khalti";

export interface Transaction {
  id: string;
  tx_id?: string;
  tx_type?: TransactionType;
  recipient: string;
  recipientName?: string;
  fromUPA?: string;          // For C2C — sender's UPA
  amount: number;
  intent: string;
  intentCategory?: string;
  metadata?: Record<string, string>;
  status: "pending" | "settled" | "failed" | "queued" | "syncing";
  mode: "online" | "offline" | "nfc" | "camera";
  payment_source?: PaymentSource;
  bank_name?: string;
  signature?: string;
  publicKey?: string;
  nonce?: string;
  timestamp: number;
  settledAt?: number;
  syncedAt?: number;
  walletProvider?: string;
  message?: string;          // C2C message
}

// === Wallet Types ===

export interface Wallet {
  id: string;
  name: string;
  balance: number;
  address: string;
  publicKey: string;
}

// === Network Types ===

export interface NetworkStatus {
  online: boolean;
  lastChecked: number;
}

// === Dashboard Types (from Supabase) ===

export interface SupabaseTransaction {
  id: string;
  tx_id: string;
  upa_id: string;
  intent_id: string | null;
  tx_type: string;
  amount: number;
  currency: string;
  payer_name: string | null;
  payer_id: string | null;
  payer_upa: string | null;
  receiver_upa: string | null;
  wallet_provider: string;
  payment_source: string;
  bank_account_id: string | null;
  status: string;
  mode: string;
  metadata: Record<string, string>;
  signature: string | null;
  nonce: string | null;
  issued_at: string;
  settled_at: string | null;
  synced_at: string | null;
  created_at: string;
  upas?: { address: string; entity_name: string };
  intents?: { intent_code: string; label: string; category: string } | null;
}

// === Quick C2C Intent Presets ===
export const C2C_INTENTS = [
  "Lunch split",
  "Movie tickets",
  "Taxi fare",
  "Gift",
  "Rent payment",
  "Grocery share",
  "Party contribution",
  "Loan repayment",
  "School supplies",
  "Coffee",
] as const;

// === Bill Payment Presets ===
export const BILL_TYPES = [
  { id: "electricity", label: "⚡ Electricity", billerUPA: "nea@utility.np", billerName: "Nepal Electricity Authority" },
  { id: "water", label: "💧 Water", billerUPA: "water@kathmandu.gov.np", billerName: "Kathmandu Water Supply" },
  { id: "internet", label: "🌐 Internet", billerUPA: "internet@worldlink.np", billerName: "Worldlink Communications" },
  { id: "mobile", label: "📱 Mobile Recharge", billerUPA: "recharge@ntc.np", billerName: "Nepal Telecom" },
] as const;

// === Mock NID Database ===
export const MOCK_NID_DATABASE: NIDCard[] = [
  {
    nidNumber: "RAM-KTM-1990-4521",
    fullName: "Ram Bahadur Thapa",
    dateOfBirth: "1990-05-15",
    gender: "M",
    issueDate: "2020-01-01",
    expiryDate: "2030-01-01",
    photoUrl: "/mock-nid/RAM-KTM-1990-4521.jpg",
    district: "Kathmandu",
    isActive: true,
    linkedUPA: "ram@upa.np",
    linkedBanks: [
      { id: "bank_1", bankName: "Nepal Bank", accountNumber: "****0123", accountType: "savings", isPrimary: true, linkedVia: "nid" },
    ],
  },
  {
    nidNumber: "SITA-PKR-1995-7832",
    fullName: "Sita Sharma",
    dateOfBirth: "1995-08-22",
    gender: "F",
    issueDate: "2021-03-15",
    expiryDate: "2031-03-15",
    photoUrl: "/mock-nid/SITA-PKR-1995-7832.jpg",
    district: "Pokhara",
    isActive: true,
    linkedUPA: "sita@upa.np",
    linkedBanks: [
      { id: "bank_2", bankName: "Nabil Bank", accountNumber: "****9876", accountType: "savings", isPrimary: true, linkedVia: "nid" },
    ],
  },
  {
    nidNumber: "HARI-LTP-1988-3214",
    fullName: "Hari Prasad Gurung",
    dateOfBirth: "1988-12-10",
    gender: "M",
    issueDate: "2019-06-20",
    expiryDate: "2029-06-20",
    photoUrl: "/mock-nid/HARI-LTP-1988-3214.jpg",
    district: "Lalitpur",
    isActive: true,
    linkedUPA: "hari@upa.np",
    linkedBanks: [
      { id: "bank_3", bankName: "NIC Asia Bank", accountNumber: "****6677", accountType: "savings", isPrimary: true, linkedVia: "nid" },
    ],
  },
  {
    nidNumber: "ANITA-BRT-1998-5643",
    fullName: "Anita Gurung",
    dateOfBirth: "1998-03-12",
    gender: "F",
    issueDate: "2022-06-15",
    expiryDate: "2032-06-15",
    photoUrl: "/mock-nid/ANITA-BRT-1998-5643.jpg",
    district: "Bharatpur",
    isActive: true,
    linkedUPA: "anita@upa.np",
    linkedBanks: [
      { id: "bank_4", bankName: "Himalayan Bank", accountNumber: "****0011", accountType: "savings", isPrimary: true, linkedVia: "nid" },
    ],
  },
  {
    nidNumber: "123-456-789",
    fullName: "Tyler Durden",
    dateOfBirth: "1979-12-18",
    gender: "M",
    issueDate: "2024-12-18",
    expiryDate: "2034-12-18",
    photoUrl: "/mock-nid/tyler.png",
    district: "Kathmandu",
    isActive: true,
    linkedUPA: "tyler@upa.np",
    linkedBanks: [
      { id: "bank_5", bankName: "Himalayan Bank", accountNumber: "****6655", accountType: "savings", isPrimary: true, linkedVia: "nid" },
    ],
  },
];

// === Mock Bank List ===
export const SUPPORTED_BANKS = [
  "Nepal Bank",
  "Nabil Bank",
  "NIC Asia Bank",
  "Himalayan Bank",
  "Standard Chartered Bank Nepal",
] as const;

