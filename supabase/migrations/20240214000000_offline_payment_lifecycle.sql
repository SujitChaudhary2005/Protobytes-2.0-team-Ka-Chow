-- ============================================================
-- Migration: Add offline payment lifecycle support
-- Adds settlement_state, expiry, device/signature tracking
-- and offline_wallet_ledger table for reversibility.
-- Backward-compatible: all new columns are nullable/defaulted.
-- ============================================================

-- ── 1. Extend transactions table ──────────────────────────────

-- Settlement state for offline lifecycle
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS settlement_state text
    DEFAULT NULL
    CHECK (settlement_state IS NULL OR settlement_state IN (
      'accepted_offline','sync_pending','settled','rejected','reversed','expired'
    ));

-- When this offline tx expires if not synced
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS offline_expires_at timestamptz DEFAULT NULL;

-- How many sync attempts have been made
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS sync_attempts int DEFAULT 0;

-- Reason if rejected or reversed
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS rejection_reason text DEFAULT NULL;

-- Device identifiers for sender and receiver
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS sender_device_id text DEFAULT NULL;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS receiver_device_id text DEFAULT NULL;

-- Dual signatures for offline acceptance proof
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS sender_signature text DEFAULT NULL;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS receiver_signature text DEFAULT NULL;

-- Cryptographic proof JSONB (nonces, timestamps, full receipt)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS proof jsonb DEFAULT '{}';

-- Client-generated stable UUID for idempotent sync
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS client_tx_id text DEFAULT NULL;

-- ── 2. Indexes for offline queries ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_transactions_settlement_state
  ON transactions (settlement_state);

CREATE INDEX IF NOT EXISTS idx_transactions_offline_expires_at
  ON transactions (offline_expires_at)
  WHERE offline_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_client_tx_id
  ON transactions (client_tx_id)
  WHERE client_tx_id IS NOT NULL;

-- Nonce uniqueness (if not already present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_nonce_unique
  ON transactions (nonce)
  WHERE nonce IS NOT NULL;

-- ── 3. offline_wallet_ledger table ────────────────────────────

CREATE TABLE IF NOT EXISTS offline_wallet_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_id       uuid REFERENCES transactions(id) ON DELETE SET NULL,
  client_tx_id text,
  user_id     text NOT NULL,
  upa_address text,
  direction   text NOT NULL CHECK (direction IN ('debit','credit')),
  amount      numeric NOT NULL CHECK (amount > 0),
  state       text NOT NULL DEFAULT 'applied'
              CHECK (state IN ('applied','reversed')),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offline_ledger_user
  ON offline_wallet_ledger (user_id);

CREATE INDEX IF NOT EXISTS idx_offline_ledger_client_tx
  ON offline_wallet_ledger (client_tx_id)
  WHERE client_tx_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offline_ledger_state
  ON offline_wallet_ledger (state);
