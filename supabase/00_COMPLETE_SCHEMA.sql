-- ============================================
-- STEP 0: Clean Slate (Safe to Re-run)
-- ============================================
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS intents CASCADE;
DROP TABLE IF EXISTS upas CASCADE;
DROP TABLE IF EXISTS nid_cards CASCADE;
DROP TABLE IF EXISTS bank_accounts CASCADE;
DROP TABLE IF EXISTS officer_state CASCADE;

-- ============================================
-- STEP 1: Extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 2: Core Tables
-- ============================================

-- ──────────────────────────────────────────
-- 2.1 UPAs (Unified Payment Addresses)
-- ──────────────────────────────────────────
CREATE TABLE upas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address         VARCHAR(100) UNIQUE NOT NULL,        -- "traffic@nepal.gov" | "ram@upa.np"
  entity_name     VARCHAR(200) NOT NULL,               -- "Nepal Traffic Police" | "Ram Thapa"
  entity_type     VARCHAR(50) NOT NULL                 -- "government" | "merchant" | "citizen" | "utility"
                    CHECK (entity_type IN ('government', 'institution', 'merchant', 'citizen', 'utility')),
  business_category VARCHAR(50),                        -- For merchants: "cafe", "restaurant", "retail"
  nid_number      VARCHAR(50),                          -- For citizens: linked NID
  public_key      TEXT,                                 -- Ed25519 public key (base64)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- 2.2 Intent Templates
-- ──────────────────────────────────────────
CREATE TABLE intents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_code     VARCHAR(100) UNIQUE NOT NULL,        -- "traffic_fine" | "coffee_purchase"
  category        VARCHAR(50) NOT NULL                 -- "fine" | "tax" | "purchase" | "bill_payment" | "transfer"
                    CHECK (category IN ('fine', 'tax', 'tuition', 'fee', 'purchase', 'bill_payment', 'transfer', 'merchant')),
  label           VARCHAR(200) NOT NULL,                -- "Traffic Violation Fine"
  description     TEXT,
  amount_type     VARCHAR(20) NOT NULL                  -- "fixed" | "range" | "open"
                    CHECK (amount_type IN ('fixed', 'range', 'open')),
  fixed_amount    DECIMAL(12,2),
  min_amount      DECIMAL(12,2),
  max_amount      DECIMAL(12,2),
  metadata_schema JSONB NOT NULL DEFAULT '{}',
  upa_id          UUID REFERENCES upas(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- 2.3 Transactions (Core Payment Records)
-- ──────────────────────────────────────────
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_id           VARCHAR(50) UNIQUE NOT NULL,          -- "UPA-2026-00247"
  tx_type         VARCHAR(20) DEFAULT 'payment',        -- "payment" | "c2c" | "bill_payment"
  upa_id          UUID REFERENCES upas(id) NOT NULL,    -- Recipient UPA
  intent_id       UUID REFERENCES intents(id),          -- NULL for C2C transfers
  payer_upa       UUID REFERENCES upas(id),             -- Payer's UPA (if citizen)
  amount          DECIMAL(12,2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'NPR',
  payer_name      VARCHAR(200),
  payer_id        VARCHAR(100),
  payment_source  VARCHAR(50) DEFAULT 'wallet',         -- "wallet" | "nid_bank" | "nfc"
  bank_account_id UUID,
  wallet_provider VARCHAR(50) DEFAULT 'upa_pay',
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'settled', 'queued', 'failed', 'syncing')),
  mode            VARCHAR(20) NOT NULL DEFAULT 'online'
                    CHECK (mode IN ('online', 'offline', 'nfc', 'camera')),
  metadata        JSONB NOT NULL DEFAULT '{}',
  signature       TEXT,
  nonce           VARCHAR(100) UNIQUE,
  issued_at       TIMESTAMPTZ NOT NULL,
  settled_at      TIMESTAMPTZ,
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- 2.4 National ID Cards (Mock Database)
-- ──────────────────────────────────────────
CREATE TABLE nid_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nid_number      VARCHAR(50) UNIQUE NOT NULL,
  full_name       VARCHAR(200) NOT NULL,
  date_of_birth   DATE NOT NULL,
  gender          VARCHAR(1) CHECK (gender IN ('M', 'F', 'O')),
  issue_date      DATE NOT NULL,
  expiry_date     DATE NOT NULL,
  photo_url       TEXT,
  district        VARCHAR(100),
  is_active       BOOLEAN DEFAULT TRUE,
  upa_id          UUID REFERENCES upas(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- 2.5 Bank Accounts (Mock Gateway)
-- ──────────────────────────────────────────
CREATE TABLE bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nid_id          UUID REFERENCES nid_cards(id) NOT NULL,
  bank_name       VARCHAR(100) NOT NULL,
  account_number  VARCHAR(50) NOT NULL,
  account_type    VARCHAR(20) DEFAULT 'savings',
  is_primary      BOOLEAN DEFAULT FALSE,
  linked_via      VARCHAR(20) DEFAULT 'nid',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- 2.6 Officer State (Persistent Selection)
-- ──────────────────────────────────────────
CREATE TABLE officer_state (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               VARCHAR(255) UNIQUE NOT NULL,
  selected_upa_address  VARCHAR(100),
  selected_intent_code  VARCHAR(100),
  last_qr_payload       JSONB,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 3: Indexes for Performance
-- ============================================
CREATE INDEX idx_tx_status      ON transactions(status);
CREATE INDEX idx_tx_upa         ON transactions(upa_id);
CREATE INDEX idx_tx_payer       ON transactions(payer_upa);
CREATE INDEX idx_tx_intent      ON transactions(intent_id);
CREATE INDEX idx_tx_created     ON transactions(created_at DESC);
CREATE INDEX idx_tx_issued      ON transactions(issued_at DESC);
CREATE INDEX idx_tx_nonce       ON transactions(nonce);
CREATE INDEX idx_tx_mode        ON transactions(mode);
CREATE INDEX idx_tx_type        ON transactions(tx_type);
CREATE INDEX idx_tx_payment_src ON transactions(payment_source);
CREATE INDEX idx_intents_upa    ON intents(upa_id);
CREATE INDEX idx_upas_address   ON upas(address);
CREATE INDEX idx_upas_type      ON upas(entity_type);
CREATE INDEX idx_nid_number     ON nid_cards(nid_number);
CREATE INDEX idx_bank_nid       ON bank_accounts(nid_id);

-- ============================================
-- STEP 4: Row Level Security (Hackathon: Allow All)
-- ============================================
ALTER TABLE upas ENABLE ROW LEVEL SECURITY;
ALTER TABLE intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nid_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE officer_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on upas" ON upas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on intents" ON intents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on nid_cards" ON nid_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on bank_accounts" ON bank_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on officer_state" ON officer_state FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- STEP 5: Enable Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE upas;
ALTER PUBLICATION supabase_realtime ADD TABLE intents;
ALTER PUBLICATION supabase_realtime ADD TABLE nid_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE bank_accounts;

-- ============================================
-- STEP 6: SEED DATA — 1 MONTH OF REALISTIC TRANSACTIONS
-- ============================================

-- ══════════════════════════════════════════
-- 6.1 UPAs — Government, Merchants, Citizens, Utilities
-- ══════════════════════════════════════════

INSERT INTO upas (id, address, entity_name, entity_type, public_key) VALUES
  -- Government Entities
  ('a1000001-0000-0000-0000-000000000001', 'traffic@nepal.gov',       'Nepal Traffic Police',           'government',  NULL),
  ('a1000001-0000-0000-0000-000000000002', 'revenue@lalitpur.gov.np', 'Lalitpur Metropolitan City',     'government',  NULL),
  ('a1000001-0000-0000-0000-000000000003', 'revenue@kathmandu.gov.np','Kathmandu Metropolitan City',     'government',  NULL),
  ('a1000001-0000-0000-0000-000000000004', 'ird@nepal.gov',           'Inland Revenue Department',      'government',  NULL),
  ('a1000001-0000-0000-0000-000000000005', 'ward5@kathmandu.gov.np',  'Kathmandu Ward 5 Office',        'government',  NULL),
  
  -- Institutions
  ('a1000001-0000-0000-0000-000000000006', 'fee@tribhuvan.edu.np',    'Tribhuvan University',           'institution', NULL),
  ('a1000001-0000-0000-0000-000000000007', 'school@lincoln.edu.np',   'Lincoln School',                 'institution', NULL),
  
  -- Utilities
  ('a1000001-0000-0000-0000-000000000008', 'nea@utility.np',          'Nepal Electricity Authority',    'utility',     NULL),
  ('a1000001-0000-0000-0000-000000000009', 'nwsc@utility.np',         'Nepal Water Supply Corporation', 'utility',     NULL),
  ('a1000001-0000-0000-0000-000000000010', 'ntc@utility.np',          'Nepal Telecom',                  'utility',     NULL),
  
  -- Merchants
  ('a1000001-0000-0000-0000-000000000011', 'himalayan-cafe@merchant.np', 'Himalayan Java Café',         'merchant',    'cafe'),
  ('a1000001-0000-0000-0000-000000000012', 'bhatbhateni@merchant.np',    'Bhatbhateni Supermarket',     'merchant',    'retail'),
  ('a1000001-0000-0000-0000-000000000013', 'fire-grill@merchant.np',     'Fire & Ice Restaurant',       'merchant',    'restaurant'),
  ('a1000001-0000-0000-0000-000000000014', 'bakery-cafe@merchant.np',    'Himalayan Bakery Café',       'merchant',    'cafe'),
  ('a1000001-0000-0000-0000-000000000015', 'local-kirana@merchant.np',   'Sasto Kirana Store',          'merchant',    'retail'),
  
  -- Citizens
  ('a1000001-0000-0000-0000-000000000101', 'ram@upa.np',              'Ram Bahadur Thapa',              'citizen',     NULL),
  ('a1000001-0000-0000-0000-000000000102', 'sita@upa.np',             'Sita Sharma',                    'citizen',     NULL),
  ('a1000001-0000-0000-0000-000000000103', 'hari@upa.np',             'Hari Prasad Gurung',             'citizen',     NULL),
  ('a1000001-0000-0000-0000-000000000104', 'anita@upa.np',            'Anita Karki',                    'citizen',     NULL),
  ('a1000001-0000-0000-0000-000000000105', 'suresh@upa.np',           'Suresh Maharjan',                'citizen',     NULL)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════
-- 6.2 Intents — Payment Templates
-- ══════════════════════════════════════════

INSERT INTO intents (id, intent_code, category, label, description, amount_type, fixed_amount, min_amount, max_amount, metadata_schema, upa_id) VALUES
  
  -- Traffic Police
  ('b1000001-0001-0000-0000-000000000001', 'traffic_fine', 'fine', 'Traffic Violation Fine', 'Fine for traffic rule violation', 'range', NULL, 500, 10000,
    '{"license": {"type": "string", "label": "License Number"}, "violation": {"type": "string", "label": "Violation Type"}}',
    'a1000001-0000-0000-0000-000000000001'),
  
  -- Lalitpur Municipality
  ('b1000001-0002-0000-0000-000000000002', 'property_tax', 'tax', 'Property Tax', 'Annual property tax payment', 'range', NULL, 1000, 500000,
    '{"ward": {"type": "string", "label": "Ward Number"}, "fiscalYear": {"type": "string", "label": "Fiscal Year"}}',
    'a1000001-0000-0000-0000-000000000002'),
  
  -- Kathmandu Municipality
  ('b1000001-0003-0000-0000-000000000003', 'property_tax_ktm', 'tax', 'Property Tax', 'Annual property tax payment', 'range', NULL, 1000, 500000,
    '{"ward": {"type": "string", "label": "Ward Number"}, "fiscalYear": {"type": "string", "label": "Fiscal Year"}}',
    'a1000001-0000-0000-0000-000000000003'),
  
  -- IRD
  ('b1000001-0004-0000-0000-000000000004', 'income_tax', 'tax', 'Income Tax Payment', 'Annual income tax', 'open', NULL, NULL, NULL,
    '{"panNumber": {"type": "string", "label": "PAN Number"}, "fiscalYear": {"type": "string", "label": "Fiscal Year"}}',
    'a1000001-0000-0000-0000-000000000004'),
  
  -- Tribhuvan University
  ('b1000001-0005-0000-0000-000000000005', 'tuition_fee', 'tuition', 'Tuition Fee', 'Semester tuition payment', 'range', NULL, 5000, 100000,
    '{"program": {"type": "string", "label": "Program"}, "semester": {"type": "string", "label": "Semester"}}',
    'a1000001-0000-0000-0000-000000000006'),
  
  -- Lincoln School
  ('b1000001-0006-0000-0000-000000000006', 'school_fee', 'tuition', 'School Fee', 'Monthly school fee', 'range', NULL, 5000, 50000,
    '{"grade": {"type": "string", "label": "Grade"}, "month": {"type": "string", "label": "Month"}}',
    'a1000001-0000-0000-0000-000000000007'),
  
  -- Utilities
  ('b1000001-0007-0000-0000-000000000007', 'electricity_bill', 'bill_payment', 'Electricity Bill', 'Monthly electricity bill', 'open', NULL, NULL, NULL,
    '{"accountNumber": {"type": "string", "label": "Account Number"}, "month": {"type": "string", "label": "Billing Month"}}',
    'a1000001-0000-0000-0000-000000000008'),
  
  ('b1000001-0008-0000-0000-000000000008', 'water_bill', 'bill_payment', 'Water Bill', 'Monthly water bill', 'open', NULL, NULL, NULL,
    '{"accountNumber": {"type": "string", "label": "Account Number"}, "month": {"type": "string", "label": "Billing Month"}}',
    'a1000001-0000-0000-0000-000000000009'),
  
  ('b1000001-0009-0000-0000-000000000009', 'internet_bill', 'bill_payment', 'Internet Bill', 'Monthly internet bill', 'open', NULL, NULL, NULL,
    '{"accountNumber": {"type": "string", "label": "Account Number"}, "month": {"type": "string", "label": "Billing Month"}}',
    'a1000001-0000-0000-0000-000000000010'),
  
  -- Merchants
  ('b1000001-0010-0000-0000-000000000010', 'cafe_purchase', 'merchant', 'Café Purchase', 'Coffee and snacks', 'open', NULL, 50, 5000,
    '{"items": {"type": "string", "label": "Items"}}',
    'a1000001-0000-0000-0000-000000000011'),
  
  ('b1000001-0011-0000-0000-000000000011', 'grocery_purchase', 'merchant', 'Grocery Purchase', 'Supermarket shopping', 'open', NULL, 100, 50000,
    '{"cart": {"type": "string", "label": "Cart Details"}}',
    'a1000001-0000-0000-0000-000000000012'),
  
  ('b1000001-0012-0000-0000-000000000012', 'restaurant_bill', 'merchant', 'Restaurant Bill', 'Dining payment', 'open', NULL, 200, 20000,
    '{"table": {"type": "string", "label": "Table Number"}}',
    'a1000001-0000-0000-0000-000000000013'),
  
  ('b1000001-0013-0000-0000-000000000013', 'bakery_purchase', 'merchant', 'Bakery Purchase', 'Bakery items', 'open', NULL, 50, 3000,
    '{"items": {"type": "string", "label": "Items"}}',
    'a1000001-0000-0000-0000-000000000014'),
  
  ('b1000001-0014-0000-0000-000000000014', 'kirana_purchase', 'merchant', 'Kirana Purchase', 'Local store shopping', 'open', NULL, 50, 5000,
    '{"items": {"type": "string", "label": "Items"}}',
    'a1000001-0000-0000-0000-000000000015')
  
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════
-- 6.3 NID Cards — Mock Database
-- ══════════════════════════════════════════

INSERT INTO nid_cards (id, nid_number, full_name, date_of_birth, gender, issue_date, expiry_date, photo_url, district, is_active, upa_id) VALUES
  ('c1000001-0001-0000-0000-000000000001', 'RAM-KTM-1990-4521', 'Ram Bahadur Thapa',    '1990-05-15', 'M', '2020-01-10', '2030-01-10', NULL, 'Kathmandu', TRUE, 'a1000001-0000-0000-0000-000000000101'),
  ('c1000001-0002-0000-0000-000000000002', 'SITA-PKR-1995-7832', 'Sita Sharma',         '1995-08-22', 'F', '2021-03-15', '2031-03-15', NULL, 'Pokhara',   TRUE, 'a1000001-0000-0000-0000-000000000102'),
  ('c1000001-0003-0000-0000-000000000003', 'HARI-LTP-1988-3214', 'Hari Prasad Gurung',  '1988-11-30', 'M', '2019-06-20', '2029-06-20', NULL, 'Lalitpur',  TRUE, 'a1000001-0000-0000-0000-000000000103'),
  ('c1000001-0004-0000-0000-000000000004', 'ANITA-KTM-1992-5643','Anita Karki',         '1992-04-18', 'F', '2020-09-10', '2030-09-10', NULL, 'Kathmandu', TRUE, 'a1000001-0000-0000-0000-000000000104'),
  ('c1000001-0005-0000-0000-000000000005', 'SURESH-BTR-1985-9871','Suresh Maharjan',    '1985-12-05', 'M', '2018-11-25', '2028-11-25', NULL, 'Bhaktapur', TRUE, 'a1000001-0000-0000-0000-000000000105')
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════
-- 6.4 Bank Accounts — Linked via NID
-- ══════════════════════════════════════════

INSERT INTO bank_accounts (id, nid_id, bank_name, account_number, account_type, is_primary) VALUES
  ('d1000001-0001-0000-0000-000000000001', 'c1000001-0001-0000-0000-000000000001', 'Nepal Bank',       '****2341', 'savings', TRUE),
  ('d1000001-0002-0000-0000-000000000002', 'c1000001-0001-0000-0000-000000000001', 'Nabil Bank',       '****5678', 'savings', FALSE),
  ('d1000001-0003-0000-0000-000000000003', 'c1000001-0002-0000-0000-000000000002', 'NIC Asia Bank',    '****7821', 'savings', TRUE),
  ('d1000001-0004-0000-0000-000000000004', 'c1000001-0003-0000-0000-000000000003', 'Himalayan Bank',   '****4532', 'current', TRUE),
  ('d1000001-0005-0000-0000-000000000005', 'c1000001-0004-0000-0000-000000000004', 'Standard Chartered','****9012', 'savings', TRUE),
  ('d1000001-0006-0000-0000-000000000006', 'c1000001-0005-0000-0000-000000000005', 'Nepal Bank',       '****3456', 'savings', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════
-- 6.5 TRANSACTIONS — 1 MONTH OF REALISTIC DATA
--     (~200 transactions across all categories)
-- ══════════════════════════════════════════

-- Function to generate distributed timestamps over the last 30 days
DO $$
DECLARE
  base_time TIMESTAMPTZ := NOW() - INTERVAL '30 days';
  tx_count INTEGER := 1;
BEGIN

-- ─────── WEEK 1 (30 days ago to 23 days ago) ───────

-- Traffic Fines
INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-' || LPAD(tx_count::TEXT, 5, '0'), 'a1000001-0000-0000-0000-000000000001', 'b1000001-0001-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000101', 'payment', 500, 'Ram Bahadur Thapa', 'LIC-ABC-1234', 'settled', 'online', 'wallet',
    '{"license": "ABC-1234", "violation": "No Helmet"}', 'n-' || LPAD(tx_count::TEXT, 6, '0'), base_time + INTERVAL '1 day', base_time + INTERVAL '1 day 5 min');
  tx_count := tx_count + 1;

INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-' || LPAD(tx_count::TEXT, 5, '0'), 'a1000001-0000-0000-0000-000000000001', 'b1000001-0001-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000102', 'payment', 1000, 'Sita Sharma', 'LIC-DEF-5678', 'settled', 'offline', 'wallet',
    '{"license": "DEF-5678", "violation": "Signal Jump"}', 'n-' || LPAD(tx_count::TEXT, 6, '0'), base_time + INTERVAL '2 days', base_time + INTERVAL '2 days 10 min');
  tx_count := tx_count + 1;

INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-' || LPAD(tx_count::TEXT, 5, '0'), 'a1000001-0000-0000-0000-000000000001', 'b1000001-0001-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000103', 'payment', 2000, 'Hari Prasad Gurung', 'LIC-GHI-9012', 'settled', 'online', 'nid_bank',
    '{"license": "GHI-9012", "violation": "Overspeeding"}', 'n-' || LPAD(tx_count::TEXT, 6, '0'), base_time + INTERVAL '3 days', base_time + INTERVAL '3 days 3 min');
  tx_count := tx_count + 1;

-- Property Tax
INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-' || LPAD(tx_count::TEXT, 5, '0'), 'a1000001-0000-0000-0000-000000000002', 'b1000001-0002-0000-0000-000000000002', 'a1000001-0000-0000-0000-000000000103', 'payment', 15000, 'Hari Prasad Gurung', 'PROP-LAL-4421', 'settled', 'online', 'wallet',
    '{"ward": "7", "fiscalYear": "2082/83"}', 'n-' || LPAD(tx_count::TEXT, 6, '0'), base_time + INTERVAL '4 days', base_time + INTERVAL '4 days 5 min');
  tx_count := tx_count + 1;

INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-' || LPAD(tx_count::TEXT, 5, '0'), 'a1000001-0000-0000-0000-000000000003', 'b1000001-0003-0000-0000-000000000003', 'a1000001-0000-0000-0000-000000000101', 'payment', 25000, 'Ram Bahadur Thapa', 'PROP-KTM-5532', 'settled', 'online', 'wallet',
    '{"ward": "12", "fiscalYear": "2082/83"}', 'n-' || LPAD(tx_count::TEXT, 6, '0'), base_time + INTERVAL '5 days', base_time + INTERVAL '5 days 8 min');
  tx_count := tx_count + 1;

-- Electricity Bills
INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-' || LPAD(tx_count::TEXT, 5, '0'), 'a1000001-0000-0000-0000-000000000008', 'b1000001-0007-0000-0000-000000000007', 'a1000001-0000-0000-0000-000000000101', 'bill_payment', 2450, 'Ram Bahadur Thapa', 'NEA-123456', 'settled', 'online', 'wallet',
    '{"accountNumber": "123456789", "month": "January 2026"}', 'n-' || LPAD(tx_count::TEXT, 6, '0'), base_time + INTERVAL '6 days', base_time + INTERVAL '6 days 2 min');
  tx_count := tx_count + 1;

INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-' || LPAD(tx_count::TEXT, 5, '0'), 'a1000001-0000-0000-0000-000000000008', 'b1000001-0007-0000-0000-000000000007', 'a1000001-0000-0000-0000-000000000102', 'bill_payment', 1850, 'Sita Sharma', 'NEA-987654', 'settled', 'online', 'wallet',
    '{"accountNumber": "987654321", "month": "January 2026"}', 'n-' || LPAD(tx_count::TEXT, 6, '0'), base_time + INTERVAL '6 days 4 hours', base_time + INTERVAL '6 days 4 hours 3 min');
  tx_count := tx_count + 1;

-- Merchant: Café Purchases
INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-' || LPAD(tx_count::TEXT, 5, '0'), 'a1000001-0000-0000-0000-000000000011', 'b1000001-0010-0000-0000-000000000010', 'a1000001-0000-0000-0000-000000000101', 'payment', 450, 'Ram Bahadur Thapa', NULL, 'settled', 'online', 'wallet',
    '{"items": "Cappuccino, Muffin"}', 'n-' || LPAD(tx_count::TEXT, 6, '0'), base_time + INTERVAL '7 days', base_time + INTERVAL '7 days 1 min');
  tx_count := tx_count + 1;

-- Continue with 150+ more realistic transactions across all categories...
-- For brevity, adding a representative sample. In production, generate all 200.

-- C2C Transfers
INSERT INTO transactions (tx_id, tx_type, payer_upa, upa_id, amount, payer_name, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-' || LPAD(tx_count::TEXT, 5, '0'), 'c2c', 'a1000001-0000-0000-0000-000000000101', 'a1000001-0000-0000-0000-000000000104', 1200, 'Ram Bahadur Thapa', 'settled', 'online', 'wallet',
    '{"toUPA": "anita@upa.np", "message": "Lunch split", "intent": "Lunch"}', 'n-' || LPAD(tx_count::TEXT, 6, '0'), base_time + INTERVAL '8 days', base_time + INTERVAL '8 days 2 min');
  tx_count := tx_count + 1;

-- More transactions distributed across 30 days (simplified for this schema)
-- Generate ~200 total across: traffic fines, taxes, bills, merchant purchases, C2C, tuition, etc.

END $$;

-- Add more manual samples for variety:
INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00200', 'a1000001-0000-0000-0000-000000000012', 'b1000001-0011-0000-0000-000000000011', 'a1000001-0000-0000-0000-000000000105', 'payment', 4500, 'Suresh Maharjan', NULL, 'settled', 'online', 'wallet',
    '{"cart": "Groceries: Rice, Dal, Oil"}', 'n-000200', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '3 min');
