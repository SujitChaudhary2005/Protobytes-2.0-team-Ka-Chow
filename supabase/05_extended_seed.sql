-- ============================================
-- UPA-NP — Extended Seed Data
-- Run AFTER 04_extended_schema.sql
-- Adds: citizen UPAs, merchant UPAs, utility UPAs, NID cards, bank accounts, diverse transactions
-- ============================================

-- ── Citizen UPAs ──
INSERT INTO upas (id, address, entity_name, entity_type, nid_number) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'ram@upa.np',    'Ram Bahadur Thapa',   'citizen', 'RAM-KTM-1990-4521'),
  ('a2000000-0000-0000-0000-000000000002', 'sita@upa.np',   'Sita Sharma',         'citizen', 'SITA-PKR-1995-7832'),
  ('a2000000-0000-0000-0000-000000000003', 'hari@upa.np',   'Hari Prasad Gurung',  'citizen', 'HARI-LTP-1988-3214')
ON CONFLICT (id) DO NOTHING;

-- ── Merchant UPAs ──
INSERT INTO upas (id, address, entity_name, entity_type, business_category) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'coffee@himalayanjava.np',   'Himalayan Java - Thamel',  'merchant', 'cafe'),
  ('a3000000-0000-0000-0000-000000000002', 'grocery@bhatbhateni.np',    'Bhatbhateni Supermarket',  'merchant', 'grocery'),
  ('a3000000-0000-0000-0000-000000000003', 'restaurant@thakali.np',     'Thakali Kitchen',          'merchant', 'restaurant'),
  ('a3000000-0000-0000-0000-000000000004', 'pharmacy@nepalausadhi.np',  'Nepal Ausadhi Pasal',      'merchant', 'pharmacy')
ON CONFLICT (id) DO NOTHING;

-- ── Utility UPAs ──
INSERT INTO upas (id, address, entity_name, entity_type) VALUES
  ('a4000000-0000-0000-0000-000000000001', 'nea@utility.np',             'Nepal Electricity Authority',  'utility'),
  ('a4000000-0000-0000-0000-000000000002', 'water@kathmandu.gov.np',     'Kathmandu Water Supply',       'utility'),
  ('a4000000-0000-0000-0000-000000000003', 'internet@worldlink.np',      'Worldlink Communications',     'utility'),
  ('a4000000-0000-0000-0000-000000000004', 'recharge@ntc.np',            'Nepal Telecom',                'utility'),
  ('a4000000-0000-0000-0000-000000000005', 'passport@mfa.gov.np',        'Ministry of Foreign Affairs',  'government')
ON CONFLICT (id) DO NOTHING;

-- ── Merchant Intents ──
INSERT INTO intents (id, intent_code, category, label, description, amount_type, fixed_amount, min_amount, max_amount, metadata_schema, upa_id) VALUES
  ('b2000000-0000-0000-0000-000000000001', 'coffee_purchase', 'merchant', 'Coffee Purchase',
    'Payment for coffee and food', 'open', NULL, 50, 5000,
    '{"items": {"type": "string", "label": "Items", "required": false}, "table": {"type": "string", "label": "Table #", "required": false}}',
    'a3000000-0000-0000-0000-000000000001'),

  ('b2000000-0000-0000-0000-000000000002', 'grocery_purchase', 'merchant', 'Grocery Purchase',
    'Supermarket/grocery shopping', 'open', NULL, 50, 50000,
    '{"invoice": {"type": "string", "label": "Invoice #", "required": false}, "branch": {"type": "string", "label": "Branch", "required": false}}',
    'a3000000-0000-0000-0000-000000000002'),

  ('b2000000-0000-0000-0000-000000000003', 'restaurant_payment', 'merchant', 'Restaurant Payment',
    'Dining and food orders', 'open', NULL, 100, 20000,
    '{"table": {"type": "string", "label": "Table #", "required": false}, "guests": {"type": "string", "label": "Guests", "required": false}}',
    'a3000000-0000-0000-0000-000000000003'),

  ('b2000000-0000-0000-0000-000000000004', 'pharmacy_purchase', 'merchant', 'Pharmacy Purchase',
    'Medicine and health products', 'open', NULL, 50, 20000,
    '{"prescription": {"type": "string", "label": "Prescription", "required": false}}',
    'a3000000-0000-0000-0000-000000000004')
ON CONFLICT (id) DO NOTHING;

-- ── Utility/Bill Intents ──
INSERT INTO intents (id, intent_code, category, label, description, amount_type, fixed_amount, min_amount, max_amount, metadata_schema, upa_id) VALUES
  ('b3000000-0000-0000-0000-000000000001', 'electricity_bill', 'bill_payment', 'Electricity Bill',
    'Monthly electricity bill payment', 'open', NULL, 100, 50000,
    '{"accountNumber": {"type": "string", "label": "Account Number", "required": true}, "month": {"type": "string", "label": "Billing Month", "required": true}, "units": {"type": "string", "label": "Units (kWh)", "required": false}}',
    'a4000000-0000-0000-0000-000000000001'),

  ('b3000000-0000-0000-0000-000000000002', 'water_bill', 'bill_payment', 'Water Bill',
    'Monthly water supply bill', 'open', NULL, 50, 10000,
    '{"accountNumber": {"type": "string", "label": "Account Number", "required": true}, "month": {"type": "string", "label": "Billing Month", "required": true}}',
    'a4000000-0000-0000-0000-000000000002'),

  ('b3000000-0000-0000-0000-000000000003', 'internet_bill', 'bill_payment', 'Internet Bill',
    'Monthly ISP bill', 'open', NULL, 500, 10000,
    '{"accountNumber": {"type": "string", "label": "Account Number", "required": true}, "plan": {"type": "string", "label": "Plan", "required": false}}',
    'a4000000-0000-0000-0000-000000000003'),

  ('b3000000-0000-0000-0000-000000000004', 'mobile_recharge', 'bill_payment', 'Mobile Recharge',
    'Prepaid mobile recharge', 'open', NULL, 20, 5000,
    '{"mobileNumber": {"type": "string", "label": "Mobile Number", "required": true}}',
    'a4000000-0000-0000-0000-000000000004'),

  ('b3000000-0000-0000-0000-000000000005', 'passport_fee', 'fee', 'Passport Fee',
    'Passport application fee', 'fixed', 5000, NULL, NULL,
    '{"passportType": {"type": "string", "label": "Passport Type", "required": true}, "urgency": {"type": "string", "label": "Urgency", "required": true}}',
    'a4000000-0000-0000-0000-000000000005')
ON CONFLICT (id) DO NOTHING;

-- ── NID Cards ──
INSERT INTO nid_cards (id, nid_number, full_name, date_of_birth, issue_date, expiry_date, photo_url, district, is_active, upa_id) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'RAM-KTM-1990-4521',  'Ram Bahadur Thapa',   '1990-05-15', '2020-01-01', '2030-01-01', '/mock-nid/ram.jpg',  'Kathmandu', TRUE, 'a2000000-0000-0000-0000-000000000001'),
  ('d1000000-0000-0000-0000-000000000002', 'SITA-PKR-1995-7832', 'Sita Sharma',         '1995-08-22', '2021-03-15', '2031-03-15', '/mock-nid/sita.jpg', 'Pokhara',   TRUE, 'a2000000-0000-0000-0000-000000000002'),
  ('d1000000-0000-0000-0000-000000000003', 'HARI-LTP-1988-3214', 'Hari Prasad Gurung',  '1988-12-10', '2019-06-20', '2029-06-20', '/mock-nid/hari.jpg', 'Lalitpur',  TRUE, 'a2000000-0000-0000-0000-000000000003')
ON CONFLICT (id) DO NOTHING;

-- ── Bank Accounts ──
INSERT INTO bank_accounts (id, nid_id, bank_name, account_number, account_type, is_primary, linked_via) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Nepal Bank',      '01234567890123', 'savings', TRUE, 'nid'),
  ('e1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', 'Nabil Bank',      '98765432109876', 'savings', TRUE, 'nid'),
  ('e1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000003', 'NIC Asia Bank',   '11223344556677', 'savings', TRUE, 'nid')
ON CONFLICT (id) DO NOTHING;

-- ── Offline Limits ──
INSERT INTO offline_limits (id, upa_id, limit_amount, current_used) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 5000,  0),
  ('f1000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 10000, 0),
  ('f1000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000003', 2000,  0)
ON CONFLICT (id) DO NOTHING;

-- ── Mixed Transactions (merchant, bill, C2C, NID) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, tx_type, amount, payer_name, payer_id, payer_upa, payment_source, status, mode, metadata, nonce, issued_at, settled_at) VALUES

  -- Coffee purchase (merchant, wallet, online)
  ('UPA-2026-00056', 'a3000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'merchant_purchase', 282.50,
    'Ram Thapa', NULL, 'a2000000-0000-0000-0000-000000000001', 'wallet', 'settled', 'online',
    '{"items": "Cappuccino x1, Croissant x1", "table": "4", "invoice": "HJ-2026-0421", "tax": "32.50"}',
    'n-00056', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 58 minutes'),

  -- Grocery purchase (merchant, wallet, online)
  ('UPA-2026-00057', 'a3000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'merchant_purchase', 1850,
    'Sita Sharma', NULL, 'a2000000-0000-0000-0000-000000000002', 'wallet', 'settled', 'online',
    '{"branch": "Thamel", "invoice": "BB-2026-8821", "items": "15 items"}',
    'n-00057', NOW() - INTERVAL '2 hours 45 minutes', NOW() - INTERVAL '2 hours 43 minutes'),

  -- Electricity bill (utility, NID bank, NFC)
  ('UPA-2026-00058', 'a4000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'bill_payment', 2500,
    'Ram Bahadur Thapa', '012-345-678-9', 'a2000000-0000-0000-0000-000000000001', 'nid_bank', 'settled', 'nfc',
    '{"accountNumber": "012-345-678-9", "month": "February 2026", "units": "245", "previousReading": "12450", "currentReading": "12695"}',
    'n-00058', NOW() - INTERVAL '2 hours 30 minutes', NOW() - INTERVAL '2 hours 28 minutes'),

  -- Water bill (utility, wallet, online)
  ('UPA-2026-00059', 'a4000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000002', 'bill_payment', 450,
    'Hari Prasad', 'WAT-KTM-9922', 'a2000000-0000-0000-0000-000000000003', 'wallet', 'settled', 'online',
    '{"accountNumber": "WAT-KTM-9922", "month": "February 2026", "consumption": "12 cubic meters"}',
    'n-00059', NOW() - INTERVAL '2 hours 15 minutes', NOW() - INTERVAL '2 hours 13 minutes'),

  -- Internet bill (utility, wallet, online)
  ('UPA-2026-00060', 'a4000000-0000-0000-0000-000000000003', 'b3000000-0000-0000-0000-000000000003', 'bill_payment', 1100,
    'Sita Sharma', 'WL-PKR-4521', 'a2000000-0000-0000-0000-000000000002', 'wallet', 'settled', 'online',
    '{"accountNumber": "WL-PKR-4521", "plan": "100 Mbps Unlimited", "month": "February 2026"}',
    'n-00060', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 58 minutes'),

  -- Restaurant (merchant, NID bank, NFC)
  ('UPA-2026-00061', 'a3000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003', 'merchant_purchase', 1200,
    'Ram Thapa', NULL, 'a2000000-0000-0000-0000-000000000001', 'nid_bank', 'settled', 'nfc',
    '{"guests": "3", "table": "12", "invoice": "THK-0221", "items": "Dal Bhat Set x3"}',
    'n-00061', NOW() - INTERVAL '1 hour 45 minutes', NOW() - INTERVAL '1 hour 43 minutes'),

  -- Pharmacy (merchant, wallet, online)
  ('UPA-2026-00062', 'a3000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000004', 'merchant_purchase', 750,
    'Ram Thapa', NULL, 'a2000000-0000-0000-0000-000000000001', 'wallet', 'settled', 'online',
    '{"prescription": "Yes", "items": "3 items", "invoice": "PH-0891"}',
    'n-00062', NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '1 hour 28 minutes'),

  -- C2C: Ram → Sita (Lunch split)
  ('UPA-2026-00063', 'a2000000-0000-0000-0000-000000000002', NULL, 'c2c', 800,
    'Ram Thapa', NULL, 'a2000000-0000-0000-0000-000000000001', 'wallet', 'settled', 'online',
    '{"intent": "Lunch split", "message": "Thanks for yesterday!", "fromUPA": "ram@upa.np", "toUPA": "sita@upa.np"}',
    'n-00063', NOW() - INTERVAL '1 hour 15 minutes', NOW() - INTERVAL '1 hour 13 minutes'),

  -- C2C: Hari → Ram (Rent payment, NID bank)
  ('UPA-2026-00064', 'a2000000-0000-0000-0000-000000000001', NULL, 'c2c', 5000,
    'Hari Prasad', NULL, 'a2000000-0000-0000-0000-000000000003', 'nid_bank', 'settled', 'online',
    '{"intent": "Rent payment", "message": "February rent", "fromUPA": "hari@upa.np", "toUPA": "ram@upa.np"}',
    'n-00064', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '58 minutes'),

  -- C2C: Sita → Hari (Movie tickets)
  ('UPA-2026-00065', 'a2000000-0000-0000-0000-000000000003', NULL, 'c2c', 1200,
    'Sita Sharma', NULL, 'a2000000-0000-0000-0000-000000000002', 'wallet', 'settled', 'online',
    '{"intent": "Movie tickets", "message": "Avengers split", "fromUPA": "sita@upa.np", "toUPA": "hari@upa.np"}',
    'n-00065', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '43 minutes'),

  -- NID payment (traffic fine via NID bank + NFC)
  ('UPA-2026-00066', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'nid_payment', 1000,
    'Ram Bahadur Thapa', 'APP-LIC-7890', 'a2000000-0000-0000-0000-000000000001', 'nid_bank', 'settled', 'nfc',
    '{"violation": "License Renewal", "license": "APP-LIC-7890", "vehicle": "BA 1 PA 4567", "location": "DOTM Ekantakuna"}',
    'n-00066', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '28 minutes'),

  -- Passport fee (online, wallet)
  ('UPA-2026-00067', 'a4000000-0000-0000-0000-000000000005', 'b3000000-0000-0000-0000-000000000005', 'payment', 5000,
    'Maya Tamang', 'PASS-2024-8822', NULL, 'wallet', 'settled', 'online',
    '{"passportType": "Regular", "urgency": "Normal"}',
    'n-00067', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '18 minutes'),

  -- Queued offline payment (tuition, offline, not yet synced)
  ('UPA-2026-00068', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 'payment', 25000,
    'Anish Gurung', 'STU-TU-2024-4456', NULL, 'wallet', 'queued', 'offline',
    '{"program": "BCA", "semester": "4th", "studentName": "Anish Gurung"}',
    'n-00068', NOW() - INTERVAL '10 minutes', NULL)
ON CONFLICT (tx_id) DO NOTHING;
