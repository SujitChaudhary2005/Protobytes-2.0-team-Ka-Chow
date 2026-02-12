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
  geofence?: {
    lat: number;
    lng: number;
    radiusMeters: number;
  };
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
  entity_type: "government" | "institution" | "merchant";
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

export interface Transaction {
  id: string;
  tx_id?: string;
  recipient: string;
  recipientName?: string;
  amount: number;
  intent: string;
  intentCategory?: string;
  metadata?: Record<string, string>;
  status: "pending" | "settled" | "failed" | "queued" | "syncing";
  mode: "online" | "offline";
  signature?: string;
  publicKey?: string;
  nonce?: string;
  timestamp: number;
  settledAt?: number;
  syncedAt?: number;
  walletProvider?: string;
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
  intent_id: string;
  amount: number;
  currency: string;
  payer_name: string | null;
  payer_id: string | null;
  wallet_provider: string;
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
  intents?: { intent_code: string; label: string; category: string };
}

