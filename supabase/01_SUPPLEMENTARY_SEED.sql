-- ============================================
-- UPA-NP — SUPPLEMENTARY SEED DATA
-- Generates 200+ transactions across 30 days
-- Run AFTER 00_COMPLETE_SCHEMA.sql
-- ============================================

-- This adds additional transactions to fill out the 1-month period
-- Mix of: traffic fines, taxes, bills, merchant purchases, C2C transfers

DO $$
DECLARE
  base_date TIMESTAMPTZ := NOW() - INTERVAL '30 days';
  tx_num INTEGER := 250; -- Start from 250 to avoid conflicts
  day_offset INTEGER;
  hour_offset INTEGER;
BEGIN

-- ═══════════════════════════════════════════
-- WEEK 2 (Days 8-14)
-- ═══════════════════════════════════════════

FOR day_offset IN 8..14 LOOP
  -- Morning: Café purchases
  INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
    ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
     'a1000001-0000-0000-0000-000000000011', 'b1000001-0010-0000-0000-000000000010', 'a1000001-0000-0000-0000-000000000101',
     'payment', 350 + FLOOR(RANDOM() * 200)::INTEGER, 'Ram Bahadur Thapa', 'settled', 'online', 'wallet',
     '{"items": "Coffee, Pastry"}', 'n-' || LPAD(tx_num::TEXT, 6, '0'),
     base_date + (day_offset || ' days')::INTERVAL + (8 || ' hours')::INTERVAL,
     base_date + (day_offset || ' days')::INTERVAL + (8 || ' hours')::INTERVAL + INTERVAL '2 min');
  tx_num := tx_num + 1;
  
  -- Midday: Grocery shopping
  INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
    ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
     'a1000001-0000-0000-0000-000000000012', 'b1000001-0011-0000-0000-000000000011', 'a1000001-0000-0000-0000-000000000102',
     'payment', 2500 + FLOOR(RANDOM() * 3000)::INTEGER, 'Sita Sharma', 'settled', 'online', 'wallet',
     '{"cart": "Weekly groceries"}', 'n-' || LPAD(tx_num::TEXT, 6, '0'),
     base_date + (day_offset || ' days')::INTERVAL + (12 || ' hours')::INTERVAL,
     base_date + (day_offset || ' days')::INTERVAL + (12 || ' hours')::INTERVAL + INTERVAL '3 min');
  tx_num := tx_num + 1;
  
  -- Evening: Restaurant dinner
  INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
    ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
     'a1000001-0000-0000-0000-000000000013', 'b1000001-0012-0000-0000-000000000012', 'a1000001-0000-0000-0000-000000000103',
     'payment', 1800 + FLOOR(RANDOM() * 1200)::INTEGER, 'Hari Prasad Gurung', 'settled', 'online', 'wallet',
     ('{"table": "Table ' || (1 + FLOOR(RANDOM() * 15))::INTEGER || '"}')::jsonb, 'n-' || LPAD(tx_num::TEXT, 6, '0'),
     base_date + (day_offset || ' days')::INTERVAL + (19 || ' hours')::INTERVAL,
     base_date + (day_offset || ' days')::INTERVAL + (19 || ' hours')::INTERVAL + INTERVAL '2 min');
  tx_num := tx_num + 1;
  
  -- Random: Traffic fines (30% chance per day)
  IF RANDOM() < 0.3 THEN
    INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
      ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
       'a1000001-0000-0000-0000-000000000001', 'b1000001-0001-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000104',
       'payment', 500 + (500 * FLOOR(RANDOM() * 4)::INTEGER), 'Anita Karki', 'LIC-ANI-' || (1000 + FLOOR(RANDOM() * 9000))::INTEGER,
       'settled', CASE WHEN RANDOM() < 0.7 THEN 'online' ELSE 'offline' END, 'wallet',
       ('{"license": "ANI-' || (1000 + FLOOR(RANDOM() * 9000))::INTEGER || '", "violation": "' || 
       (ARRAY['No Helmet', 'Signal Jump', 'Overspeeding', 'Illegal Parking'])[1 + FLOOR(RANDOM() * 4)::INTEGER] || '"}')::jsonb,
       'n-' || LPAD(tx_num::TEXT, 6, '0'),
       base_date + (day_offset || ' days')::INTERVAL + ((10 + FLOOR(RANDOM() * 9))::INTEGER || ' hours')::INTERVAL,
       base_date + (day_offset || ' days')::INTERVAL + ((10 + FLOOR(RANDOM() * 9))::INTEGER || ' hours')::INTERVAL + INTERVAL '5 min');
    tx_num := tx_num + 1;
  END IF;
END LOOP;

-- ═══════════════════════════════════════════
-- WEEK 3 (Days 15-21) — Bill Payment Week
-- ═══════════════════════════════════════════

FOR day_offset IN 15..21 LOOP
  -- Electricity Bills (random citizens)
  INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
    ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
     'a1000001-0000-0000-0000-000000000008', 'b1000001-0007-0000-0000-000000000007',
     (ARRAY['a1000001-0000-0000-0000-000000000101', 'a1000001-0000-0000-0000-000000000102', 'a1000001-0000-0000-0000-000000000103'])[1 + FLOOR(RANDOM() * 3)::INTEGER]::UUID,
     'bill_payment', 1500 + FLOOR(RANDOM() * 2000)::INTEGER,
     (ARRAY['Ram Bahadur Thapa', 'Sita Sharma', 'Hari Prasad Gurung'])[1 + FLOOR(RANDOM() * 3)::INTEGER],
     'NEA-' || (100000 + FLOOR(RANDOM() * 900000))::INTEGER, 'settled', 'online', 'wallet',
     ('{"accountNumber": "' || (100000 + FLOOR(RANDOM() * 900000))::INTEGER || '", "month": "January 2026"}')::jsonb,
     'n-' || LPAD(tx_num::TEXT, 6, '0'),
     base_date + (day_offset || ' days')::INTERVAL + (14 || ' hours')::INTERVAL,
     base_date + (day_offset || ' days')::INTERVAL + (14 || ' hours')::INTERVAL + INTERVAL '2 min');
  tx_num := tx_num + 1;
  
  -- Water Bills
  INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
    ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
     'a1000001-0000-0000-0000-000000000009', 'b1000001-0008-0000-0000-000000000008',
     (ARRAY['a1000001-0000-0000-0000-000000000101', 'a1000001-0000-0000-0000-000000000104', 'a1000001-0000-0000-0000-000000000105'])[1 + FLOOR(RANDOM() * 3)::INTEGER]::UUID,
     'bill_payment', 300 + FLOOR(RANDOM() * 500)::INTEGER,
     (ARRAY['Ram Bahadur Thapa', 'Anita Karki', 'Suresh Maharjan'])[1 + FLOOR(RANDOM() * 3)::INTEGER],
     'NWSC-' || (10000 + FLOOR(RANDOM() * 90000))::INTEGER, 'settled', 'online', 'wallet',
     ('{"accountNumber": "' || (10000 + FLOOR(RANDOM() * 90000))::INTEGER || '", "month": "January 2026"}')::jsonb,
     'n-' || LPAD(tx_num::TEXT, 6, '0'),
     base_date + (day_offset || ' days')::INTERVAL + (15 || ' hours')::INTERVAL,
     base_date + (day_offset || ' days')::INTERVAL + (15 || ' hours')::INTERVAL + INTERVAL '1 min');
  tx_num := tx_num + 1;
  
  -- Internet Bills
  IF day_offset % 2 = 0 THEN
    INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
      ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
       'a1000001-0000-0000-0000-000000000010', 'b1000001-0009-0000-0000-000000000009',
       (ARRAY['a1000001-0000-0000-0000-000000000102', 'a1000001-0000-0000-0000-000000000103'])[1 + FLOOR(RANDOM() * 2)::INTEGER]::UUID,
       'bill_payment', 800 + FLOOR(RANDOM() * 1200)::INTEGER,
       (ARRAY['Sita Sharma', 'Hari Prasad Gurung'])[1 + FLOOR(RANDOM() * 2)::INTEGER],
       'NTC-' || (5000 + FLOOR(RANDOM() * 95000))::INTEGER, 'settled', 'online', 'wallet',
       ('{"accountNumber": "' || (5000 + FLOOR(RANDOM() * 95000))::INTEGER || '", "month": "January 2026"}')::jsonb,
       'n-' || LPAD(tx_num::TEXT, 6, '0'),
       base_date + (day_offset || ' days')::INTERVAL + (16 || ' hours')::INTERVAL,
       base_date + (day_offset || ' days')::INTERVAL + (16 || ' hours')::INTERVAL + INTERVAL '1 min');
    tx_num := tx_num + 1;
  END IF;
END LOOP;

-- ═══════════════════════════════════════════
-- WEEK 4 (Days 22-30) — Tax Season + C2C Transfers
-- ═══════════════════════════════════════════

FOR day_offset IN 22..30 LOOP
  -- Property Tax Payments (sporadic)
  IF day_offset % 3 = 0 THEN
    INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
      ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
       (ARRAY['a1000001-0000-0000-0000-000000000002', 'a1000001-0000-0000-0000-000000000003'])[1 + FLOOR(RANDOM() * 2)::INTEGER]::UUID,
       (ARRAY['b1000001-0002-0000-0000-000000000002', 'b1000001-0003-0000-0000-000000000003'])[1 + FLOOR(RANDOM() * 2)::INTEGER]::UUID,
       (ARRAY['a1000001-0000-0000-0000-000000000101', 'a1000001-0000-0000-0000-000000000103', 'a1000001-0000-0000-0000-000000000105'])[1 + FLOOR(RANDOM() * 3)::INTEGER]::UUID,
       'payment', 10000 + FLOOR(RANDOM() * 30000)::INTEGER,
       (ARRAY['Ram Bahadur Thapa', 'Hari Prasad Gurung', 'Suresh Maharjan'])[1 + FLOOR(RANDOM() * 3)::INTEGER],
       'PROP-' || (ARRAY['KTM', 'LAL'])[1 + FLOOR(RANDOM() * 2)::INTEGER] || '-' || (1000 + FLOOR(RANDOM() * 9000))::INTEGER,
       'settled', 'online', 'wallet',
       ('{"ward": "' || (1 + FLOOR(RANDOM() * 32))::INTEGER || '", "fiscalYear": "2082/83"}')::jsonb,
       'n-' || LPAD(tx_num::TEXT, 6, '0'),
       base_date + (day_offset || ' days')::INTERVAL + (11 || ' hours')::INTERVAL,
       base_date + (day_offset || ' days')::INTERVAL + (11 || ' hours')::INTERVAL + INTERVAL '10 min');
    tx_num := tx_num + 1;
  END IF;
  
  -- C2C Transfers (friend-to-friend)
  IF day_offset % 2 = 0 THEN
    INSERT INTO transactions (tx_id, tx_type, payer_upa, upa_id, amount, payer_name, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
      ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 'c2c',
       (ARRAY['a1000001-0000-0000-0000-000000000101', 'a1000001-0000-0000-0000-000000000102', 'a1000001-0000-0000-0000-000000000103'])[1 + FLOOR(RANDOM() * 3)::INTEGER]::UUID,
       (ARRAY['a1000001-0000-0000-0000-000000000104', 'a1000001-0000-0000-0000-000000000105'])[1 + FLOOR(RANDOM() * 2)::INTEGER]::UUID,
       500 + FLOOR(RANDOM() * 2000)::INTEGER,
       (ARRAY['Ram Bahadur Thapa', 'Sita Sharma', 'Hari Prasad Gurung'])[1 + FLOOR(RANDOM() * 3)::INTEGER],
       'settled', 'online', 'wallet',
       ('{"toUPA": "' || (ARRAY['anita@upa.np', 'suresh@upa.np'])[1 + FLOOR(RANDOM() * 2)::INTEGER] || '", ' ||
       '"intent": "' || (ARRAY['Lunch split', 'Movie tickets', 'Taxi fare', 'Gift'])[1 + FLOOR(RANDOM() * 4)::INTEGER] || '", ' ||
       '"message": "Thanks!"}')::jsonb,
       'n-' || LPAD(tx_num::TEXT, 6, '0'),
       base_date + (day_offset || ' days')::INTERVAL + ((12 + FLOOR(RANDOM() * 9))::INTEGER || ' hours')::INTERVAL,
       base_date + (day_offset || ' days')::INTERVAL + ((12 + FLOOR(RANDOM() * 9))::INTEGER || ' hours')::INTERVAL + INTERVAL '1 min');
    tx_num := tx_num + 1;
  END IF;
  
  -- Daily merchant purchases (varied)
  FOR i IN 1..3 LOOP
    INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
      ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
       (ARRAY['a1000001-0000-0000-0000-000000000011', 'a1000001-0000-0000-0000-000000000014', 'a1000001-0000-0000-0000-000000000015'])[i]::UUID,
       (ARRAY['b1000001-0010-0000-0000-000000000010', 'b1000001-0013-0000-0000-000000000013', 'b1000001-0014-0000-0000-000000000014'])[i]::UUID,
       (ARRAY['a1000001-0000-0000-0000-000000000101', 'a1000001-0000-0000-0000-000000000102', 'a1000001-0000-0000-0000-000000000104'])[i]::UUID,
       'payment', 200 + FLOOR(RANDOM() * 1000)::INTEGER,
       (ARRAY['Ram Bahadur Thapa', 'Sita Sharma', 'Anita Karki'])[i],
       'settled', CASE WHEN RANDOM() < 0.8 THEN 'online' ELSE 'offline' END, 'wallet',
       ('{"items": "' || (ARRAY['Coffee & Snacks', 'Bread & Milk', 'Groceries'])[i] || '"}')::jsonb,
       'n-' || LPAD(tx_num::TEXT, 6, '0'),
       base_date + (day_offset || ' days')::INTERVAL + ((9 + i * 3)::INTEGER || ' hours')::INTERVAL,
       base_date + (day_offset || ' days')::INTERVAL + ((9 + i * 3)::INTEGER || ' hours')::INTERVAL + INTERVAL '2 min');
    tx_num := tx_num + 1;
  END LOOP;
END LOOP;

-- ═══════════════════════════════════════════
-- RECENT (Last 3 Days) — High Activity
-- ═══════════════════════════════════════════

FOR day_offset IN 1..3 LOOP
  FOR hour_offset IN 9..20 LOOP
    -- Café purchases
    INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
      ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
       'a1000001-0000-0000-0000-000000000011', 'b1000001-0010-0000-0000-000000000010',
       (ARRAY['a1000001-0000-0000-0000-000000000101', 'a1000001-0000-0000-0000-000000000102', 'a1000001-0000-0000-0000-000000000103', 'a1000001-0000-0000-0000-000000000104'])[1 + FLOOR(RANDOM() * 4)::INTEGER]::UUID,
       'payment', 250 + FLOOR(RANDOM() * 500)::INTEGER,
       (ARRAY['Ram Bahadur Thapa', 'Sita Sharma', 'Hari Prasad Gurung', 'Anita Karki'])[1 + FLOOR(RANDOM() * 4)::INTEGER],
       'settled', 'online', 'wallet',
       ('{"items": "' || (ARRAY['Cappuccino', 'Latte', 'Espresso', 'Tea'])[1 + FLOOR(RANDOM() * 4)::INTEGER] || ', Snack"}')::jsonb,
       'n-' || LPAD(tx_num::TEXT, 6, '0'),
       NOW() - ((day_offset + 1) || ' days')::INTERVAL + (hour_offset || ' hours')::INTERVAL,
       NOW() - ((day_offset + 1) || ' days')::INTERVAL + (hour_offset || ' hours')::INTERVAL + INTERVAL '1 min');
    tx_num := tx_num + 1;
  END LOOP;
END LOOP;

RAISE NOTICE 'Generated % total transactions', tx_num - 250;

END $$;

-- ═══════════════════════════════════════════
-- Verification Queries
-- ═══════════════════════════════════════════

-- Check total transaction count
SELECT COUNT(*) as total_transactions FROM transactions;

-- Transactions by type
SELECT tx_type, COUNT(*) as count, SUM(amount) as total_amount
FROM transactions
GROUP BY tx_type;

-- Transactions by status
SELECT status, COUNT(*) as count
FROM transactions
GROUP BY status;

-- Transactions by mode
SELECT mode, COUNT(*) as count
FROM transactions
GROUP BY mode;

-- Revenue by merchant
SELECT u.entity_name, COUNT(t.id) as tx_count, SUM(t.amount) as revenue
FROM transactions t
JOIN upas u ON t.upa_id = u.id
WHERE u.entity_type = 'merchant'
GROUP BY u.entity_name
ORDER BY revenue DESC;

-- Daily transaction volume
SELECT DATE(issued_at) as date, COUNT(*) as tx_count, SUM(amount) as total_amount
FROM transactions
GROUP BY DATE(issued_at)
ORDER BY date DESC
LIMIT 30;

-- Category distribution
SELECT i.category, COUNT(t.id) as count, SUM(t.amount) as total
FROM transactions t
JOIN intents i ON t.intent_id = i.id
GROUP BY i.category
ORDER BY total DESC;
