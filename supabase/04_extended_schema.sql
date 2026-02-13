-- ============================================
-- UPA-NP — Extended Schema for NID, Banks, C2C, Bills, Offline Limits
-- Run AFTER 01_schema.sql
-- ============================================

-- ── Extend UPAs table ──
ALTER TABLE upas DROP CONSTRAINT IF EXISTS upas_entity_type_check;
ALTER TABLE upas ADD CONSTRAINT upas_entity_type_check
  CHECK (entity_type IN ('government', 'institution', 'merchant', 'citizen', 'utility'));
ALTER TABLE upas ADD COLUMN IF NOT EXISTS business_category VARCHAR(50);
ALTER TABLE upas ADD COLUMN IF NOT EXISTS nid_number VARCHAR(50);

-- ── Extend Intents categories ──
ALTER TABLE intents DROP CONSTRAINT IF EXISTS intents_category_check;
ALTER TABLE intents ADD CONSTRAINT intents_category_check
  CHECK (category IN ('fine', 'tax', 'tuition', 'fee', 'purchase', 'bill_payment', 'transfer', 'merchant'));

-- ── Extend Transactions ──
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tx_type VARCHAR(20) DEFAULT 'payment';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payer_upa UUID REFERENCES upas(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receiver_upa UUID REFERENCES upas(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_source VARCHAR(50) DEFAULT 'wallet';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_account_id UUID;
-- Update intent_id to be nullable (C2C transfers have no intent template)
ALTER TABLE transactions ALTER COLUMN intent_id DROP NOT NULL;
-- Extend mode check
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_mode_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_mode_check
  CHECK (mode IN ('online', 'offline', 'nfc', 'camera'));

-- ── National ID Cards (Mock Database) ──
CREATE TABLE IF NOT EXISTS nid_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nid_number      VARCHAR(50) UNIQUE NOT NULL,
  full_name       VARCHAR(200) NOT NULL,
  date_of_birth   DATE NOT NULL,
  issue_date      DATE NOT NULL,
  expiry_date     DATE NOT NULL,
  photo_url       TEXT,
  district        VARCHAR(100),
  is_active       BOOLEAN DEFAULT TRUE,
  upa_id          UUID REFERENCES upas(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Bank Accounts (Mock Gateway) ──
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nid_id          UUID REFERENCES nid_cards(id) NOT NULL,
  bank_name       VARCHAR(100) NOT NULL,
  account_number  VARCHAR(50) NOT NULL,
  account_type    VARCHAR(20) DEFAULT 'savings',
  is_primary      BOOLEAN DEFAULT FALSE,
  linked_via      VARCHAR(20) DEFAULT 'nid',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_nid_number ON nid_cards(nid_number);
CREATE INDEX IF NOT EXISTS idx_bank_nid ON bank_accounts(nid_id);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_tx_payer ON transactions(payer_upa);
CREATE INDEX IF NOT EXISTS idx_tx_receiver ON transactions(receiver_upa);
CREATE INDEX IF NOT EXISTS idx_tx_payment_source ON transactions(payment_source);

-- ── RLS (Hackathon: allow all) ──
ALTER TABLE nid_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to nid_cards" ON nid_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to bank_accounts" ON bank_accounts FOR ALL USING (true) WITH CHECK (true);

-- ── Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE nid_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE bank_accounts;
