-- ============================================
-- UPA-NP — Database Schema
-- Supabase SQL Editor — Run this FIRST
-- ============================================
-- INSTRUCTIONS:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
--   4. Then run 02_seed.sql
-- ============================================

-- ============================================
-- STEP 0: Clean slate (safe to re-run)
-- ============================================
DROP TABLE IF EXISTS sync_queue CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS intents CASCADE;
DROP TABLE IF EXISTS upas CASCADE;

-- ============================================
-- STEP 1: Extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- STEP 2: Tables
-- ============================================

-- 2.1 UPAs (Unified Payment Addresses)
CREATE TABLE upas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address     VARCHAR(100) UNIQUE NOT NULL,        -- "traffic@nepal.gov"
  entity_name VARCHAR(200) NOT NULL,               -- "Nepal Traffic Police"
  entity_type VARCHAR(50) NOT NULL                 -- "government" | "institution" | "merchant"
                CHECK (entity_type IN ('government', 'institution', 'merchant')),
  public_key  TEXT,                                 -- Ed25519 public key (base64)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 Intent Templates
CREATE TABLE intents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_code     VARCHAR(100) UNIQUE NOT NULL,    -- "traffic_fine"
  category        VARCHAR(50) NOT NULL             -- "fine" | "tax" | "tuition" | "fee" | "purchase"
                    CHECK (category IN ('fine', 'tax', 'tuition', 'fee', 'purchase')),
  label           VARCHAR(200) NOT NULL,            -- "Traffic Violation Fine"
  description     TEXT,
  amount_type     VARCHAR(20) NOT NULL              -- "fixed" | "range" | "open"
                    CHECK (amount_type IN ('fixed', 'range', 'open')),
  fixed_amount    DECIMAL(12,2),
  min_amount      DECIMAL(12,2),
  max_amount      DECIMAL(12,2),
  metadata_schema JSONB NOT NULL DEFAULT '{}',
  upa_id          UUID REFERENCES upas(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Transactions
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_id           VARCHAR(50) UNIQUE NOT NULL,      -- "UPA-2026-00247"
  upa_id          UUID REFERENCES upas(id) NOT NULL,
  intent_id       UUID REFERENCES intents(id) NOT NULL,
  amount          DECIMAL(12,2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'NPR',
  payer_name      VARCHAR(200),
  payer_id        VARCHAR(100),
  wallet_provider VARCHAR(50) DEFAULT 'upa_pay',
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'settled', 'queued', 'failed', 'syncing')),
  mode            VARCHAR(20) NOT NULL DEFAULT 'online'
                    CHECK (mode IN ('online', 'offline')),
  metadata        JSONB NOT NULL DEFAULT '{}',
  signature       TEXT,
  nonce           VARCHAR(100) UNIQUE,
  issued_at       TIMESTAMPTZ NOT NULL,
  settled_at      TIMESTAMPTZ,
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 Offline Sync Queue
CREATE TABLE sync_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID REFERENCES transactions(id) ON DELETE CASCADE,
  signed_payload  JSONB NOT NULL,
  signature       TEXT NOT NULL,
  nonce           VARCHAR(100) UNIQUE NOT NULL,
  status          VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'synced', 'failed', 'rejected')),
  error_message   TEXT,
  attempts        INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  synced_at       TIMESTAMPTZ
);

-- ============================================
-- STEP 3: Indexes
-- ============================================
CREATE INDEX idx_tx_status    ON transactions(status);
CREATE INDEX idx_tx_upa       ON transactions(upa_id);
CREATE INDEX idx_tx_intent    ON transactions(intent_id);
CREATE INDEX idx_tx_created   ON transactions(created_at DESC);
CREATE INDEX idx_tx_nonce     ON transactions(nonce);
CREATE INDEX idx_tx_mode      ON transactions(mode);
CREATE INDEX idx_tx_issued    ON transactions(issued_at DESC);
CREATE INDEX idx_sync_status  ON sync_queue(status);
CREATE INDEX idx_sync_txn     ON sync_queue(transaction_id);
CREATE INDEX idx_intents_upa  ON intents(upa_id);
CREATE INDEX idx_upas_address ON upas(address);

-- ============================================
-- STEP 4: Enable Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE sync_queue;

-- ============================================
-- STEP 5: Row Level Security (Hackathon: allow all)
-- ============================================
ALTER TABLE upas ENABLE ROW LEVEL SECURITY;
ALTER TABLE intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to upas"         ON upas         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to intents"      ON intents      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to sync_queue"   ON sync_queue   FOR ALL USING (true) WITH CHECK (true);
