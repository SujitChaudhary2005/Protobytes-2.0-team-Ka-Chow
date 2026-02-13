-- ============================================
-- UPA-NP — E2E Realtime Integration Migration
-- Run AFTER 06_nid_storage.sql
-- ============================================
-- PURPOSE:
--   - Ensure nonce UNIQUE constraint is enforced at DB level (replay protection)
--   - Add trigger to auto-set settled_at on status transition
--   - Add realtime publication for transactions if not already present
--   - Create helper function for nonce-safe inserts
--   - All RLS policies are DEMO-ONLY (open read/write)
-- ============================================

-- ── 1. Ensure nonce uniqueness (idempotent) ──────────────────────
-- The constraint already exists in 01_schema.sql as UNIQUE on nonce column
-- This is a safety net in case it was dropped
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_nonce_key' AND conrelid = 'transactions'::regclass
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_nonce_key UNIQUE (nonce);
  END IF;
END$$;

-- ── 2. Index on nonce for fast lookups ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_tx_nonce ON transactions(nonce);

-- ── 3. Auto-set settled_at trigger ───────────────────────────────
CREATE OR REPLACE FUNCTION fn_auto_settled_at()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to 'settled' and settled_at is null, auto-fill
  IF NEW.status = 'settled' AND NEW.settled_at IS NULL THEN
    NEW.settled_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_settled_at ON transactions;
CREATE TRIGGER trg_auto_settled_at
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_settled_at();

-- ── 4. Nonce-safe insert function (returns 409-equivalent) ───────
-- Call via supabase.rpc('insert_transaction_safe', { ... })
-- Returns JSON: { "ok": true, "id": "uuid" } or { "ok": false, "error": "nonce_duplicate" }
CREATE OR REPLACE FUNCTION insert_transaction_safe(
  p_tx_id          TEXT,
  p_upa_id         UUID,
  p_intent_id      UUID DEFAULT NULL,
  p_tx_type        TEXT DEFAULT 'payment',
  p_amount         NUMERIC DEFAULT 0,
  p_currency       TEXT DEFAULT 'NPR',
  p_payer_name     TEXT DEFAULT NULL,
  p_payer_id       TEXT DEFAULT NULL,
  p_payer_upa      UUID DEFAULT NULL,
  p_receiver_upa   UUID DEFAULT NULL,
  p_wallet_provider TEXT DEFAULT 'upa_pay',
  p_payment_source TEXT DEFAULT 'wallet',
  p_status         TEXT DEFAULT 'settled',
  p_mode           TEXT DEFAULT 'online',
  p_metadata       JSONB DEFAULT '{}',
  p_signature      TEXT DEFAULT NULL,
  p_nonce          TEXT DEFAULT NULL,
  p_issued_at      TIMESTAMPTZ DEFAULT NOW(),
  p_settled_at     TIMESTAMPTZ DEFAULT NULL,
  p_synced_at      TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Check nonce uniqueness first
  IF p_nonce IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM transactions WHERE nonce = p_nonce) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'nonce_duplicate', 'code', 409);
    END IF;
  END IF;

  INSERT INTO transactions (
    tx_id, upa_id, intent_id, tx_type, amount, currency,
    payer_name, payer_id, payer_upa, receiver_upa,
    wallet_provider, payment_source, status, mode,
    metadata, signature, nonce, issued_at, settled_at, synced_at
  ) VALUES (
    p_tx_id, p_upa_id, p_intent_id, p_tx_type, p_amount, p_currency,
    p_payer_name, p_payer_id, p_payer_upa, p_receiver_upa,
    p_wallet_provider, p_payment_source, p_status, p_mode,
    p_metadata, p_signature, p_nonce, p_issued_at, p_settled_at, p_synced_at
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'nonce_duplicate', 'code', 409);
END;
$$ LANGUAGE plpgsql;

-- ── 5. Ensure realtime is enabled for transactions ───────────────
-- (Idempotent — safe to re-run)
DO $$
BEGIN
  -- Try to add; ignore if already in publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END$$;

-- ── 6. RLS Policies (DEMO-ONLY — open access) ───────────────────
-- NOTE: In production, replace these with proper auth-based policies.
-- These exist solely for hackathon demo purposes.
DO $$
BEGIN
  -- Transactions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Allow all access to transactions'
  ) THEN
    CREATE POLICY "Allow all access to transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- UPAs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'upas' AND policyname = 'Allow all access to upas'
  ) THEN
    CREATE POLICY "Allow all access to upas" ON upas FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Intents
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'intents' AND policyname = 'Allow all access to intents'
  ) THEN
    CREATE POLICY "Allow all access to intents" ON intents FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ============================================
-- DONE. Verify with:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'transactions'::regclass AND conname = 'transactions_nonce_key';
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'transactions'::regclass AND tgname = 'trg_auto_settled_at';
--   SELECT proname FROM pg_proc WHERE proname = 'insert_transaction_safe';
-- ============================================
