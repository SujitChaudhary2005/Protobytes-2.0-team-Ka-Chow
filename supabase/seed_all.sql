-- ============================================
-- UPA-NP — Consolidated Mock Data Seed
-- Run AFTER schema migrations are applied.
-- Includes:
--   02_seed.sql
--   05_extended_seed.sql
--   01_SUPPLEMENTARY_SEED.sql
-- ============================================

-- ============================================
-- From 02_seed.sql
-- ============================================

-- ============================================
-- UPA-NP — Seed Data
-- Run AFTER 01_schema.sql
-- ============================================

-- ============================================
-- UPAs (5 Government/Institution Entities)
-- ============================================
INSERT INTO upas (id, address, entity_name, entity_type, public_key) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'traffic@nepal.gov',       'Nepal Traffic Police',           'government',  NULL),
  ('a1000000-0000-0000-0000-000000000002', 'revenue@lalitpur.gov.np', 'Lalitpur Metropolitan City',     'government',  NULL),
  ('a1000000-0000-0000-0000-000000000003', 'fee@tribhuvan.edu.np',    'Tribhuvan University',           'institution', NULL),
  ('a1000000-0000-0000-0000-000000000004', 'ward5@kathmandu.gov.np',  'Kathmandu Ward 5 Office',        'government',  NULL),
  ('a1000000-0000-0000-0000-000000000005', 'license@dotm.gov.np',    'Dept. of Transport Management',  'government',  NULL)
ON CONFLICT (address) DO NOTHING;

-- Helper lookups for existing rows (avoid FK failures when IDs differ).
CREATE OR REPLACE FUNCTION upa_id_for(p_address TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM upas WHERE address = p_address;
$$;

CREATE OR REPLACE FUNCTION intent_id_for(p_intent_code TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM intents WHERE intent_code = p_intent_code;
$$;

CREATE OR REPLACE FUNCTION nid_id_for(p_nid_number TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM nid_cards WHERE nid_number = p_nid_number;
$$;

-- ============================================
-- Intents (10 Payment Templates)
-- ============================================
INSERT INTO intents (id, intent_code, category, label, description, amount_type, fixed_amount, min_amount, max_amount, metadata_schema, upa_id) VALUES

  -- Traffic Police
  ('b1000000-0000-0000-0000-000000000001', 'traffic_fine', 'fine', 'Traffic Violation Fine',
    'Fine for traffic rule violation', 'range', NULL, 500, 10000,
    '{"license": {"type": "string", "label": "License Number", "required": true}, "violation": {"type": "string", "label": "Violation Type", "required": true}, "vehicle": {"type": "string", "label": "Vehicle Number", "required": true}, "location": {"type": "string", "label": "Location", "required": true}}',
    upa_id_for('traffic@nepal.gov')),

  ('b1000000-0000-0000-0000-000000000002', 'license_fee', 'fee', 'Driving License Fee',
    'Fee for new or renewal driving license', 'fixed', 1000, NULL, NULL,
    '{"licenseType": {"type": "string", "label": "License Type", "required": true}, "category": {"type": "string", "label": "Category (New/Renewal)", "required": true}}',
    upa_id_for('traffic@nepal.gov')),

  -- Lalitpur Municipality
  ('b1000000-0000-0000-0000-000000000003', 'property_tax', 'tax', 'Property Tax',
    'Annual property tax payment', 'range', NULL, 1000, 500000,
    '{"ward": {"type": "string", "label": "Ward Number", "required": true}, "lotNumber": {"type": "string", "label": "Lot/Plot Number", "required": true}, "fiscalYear": {"type": "string", "label": "Fiscal Year", "required": true}, "areaSqft": {"type": "string", "label": "Area (sq ft)", "required": false}}',
    upa_id_for('revenue@lalitpur.gov.np')),

  ('b1000000-0000-0000-0000-000000000004', 'business_registration', 'fee', 'Business Registration Fee',
    'Municipal business registration', 'fixed', 5000, NULL, NULL,
    '{"businessName": {"type": "string", "label": "Business Name", "required": true}, "businessType": {"type": "string", "label": "Business Type", "required": true}, "ward": {"type": "string", "label": "Ward Number", "required": true}}',
    upa_id_for('revenue@lalitpur.gov.np')),

  -- Tribhuvan University
  ('b1000000-0000-0000-0000-000000000005', 'tuition_fee', 'tuition', 'Tuition Fee',
    'Semester tuition payment', 'range', NULL, 5000, 100000,
    '{"program": {"type": "string", "label": "Program", "required": true}, "semester": {"type": "string", "label": "Semester", "required": true}, "studentId": {"type": "string", "label": "Student ID", "required": true}}',
    upa_id_for('fee@tribhuvan.edu.np')),

  ('b1000000-0000-0000-0000-000000000006', 'exam_fee', 'fee', 'Examination Fee',
    'Semester examination fee', 'fixed', 2500, NULL, NULL,
    '{"program": {"type": "string", "label": "Program", "required": true}, "semester": {"type": "string", "label": "Semester", "required": true}, "studentId": {"type": "string", "label": "Student ID", "required": true}}',
    upa_id_for('fee@tribhuvan.edu.np')),

  -- Kathmandu Ward 5
  ('b1000000-0000-0000-0000-000000000007', 'birth_certificate', 'fee', 'Birth Certificate Fee',
    'Issuance of birth certificate', 'fixed', 200, NULL, NULL,
    '{"childName": {"type": "string", "label": "Child Name", "required": true}, "dob": {"type": "string", "label": "Date of Birth", "required": true}, "parentName": {"type": "string", "label": "Parent Name", "required": true}}',
    upa_id_for('ward5@kathmandu.gov.np')),

  ('b1000000-0000-0000-0000-000000000008', 'recommendation_letter', 'fee', 'Recommendation Letter Fee',
    'Ward-level recommendation letter', 'fixed', 500, NULL, NULL,
    '{"purpose": {"type": "string", "label": "Purpose", "required": true}, "documentType": {"type": "string", "label": "Document Type", "required": true}}',
    upa_id_for('ward5@kathmandu.gov.np')),

  -- Dept. of Transport Management
  ('b1000000-0000-0000-0000-000000000009', 'vehicle_registration', 'fee', 'Vehicle Registration Fee',
    'New vehicle registration', 'range', NULL, 5000, 50000,
    '{"vehicleType": {"type": "string", "label": "Vehicle Type", "required": true}, "manufacturer": {"type": "string", "label": "Manufacturer", "required": true}, "model": {"type": "string", "label": "Model", "required": true}}',
    upa_id_for('license@dotm.gov.np')),

  ('b1000000-0000-0000-0000-000000000010', 'route_permit', 'fee', 'Route Permit Fee',
    'Public transport route permit', 'fixed', 15000, NULL, NULL,
    '{"route": {"type": "string", "label": "Route", "required": true}, "vehicleNumber": {"type": "string", "label": "Vehicle Number", "required": true}, "permitDuration": {"type": "string", "label": "Permit Duration", "required": true}}',
    upa_id_for('license@dotm.gov.np'))
ON CONFLICT (intent_code) DO NOTHING;

-- ============================================
-- Transactions (55 Realistic Entries)
-- ============================================

-- ── Traffic Fines (15 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00001', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 500,  'Ram Thapa',        'LIC-ABC-1234', 'settled', 'online',
    '{"violation": "Red Zone Parking", "vehicle": "BA 1 PA 4567", "location": "New Road, Kathmandu", "license": "ABC-1234"}',
    'n-00001', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours 58 minutes'),

  ('UPA-2026-00002', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 1000, 'Sita Sharma',       'LIC-DEF-5678', 'settled', 'offline',
    '{"violation": "Signal Jump", "vehicle": "BA 2 PA 8901", "location": "Kalanki Chowk", "license": "DEF-5678"}',
    'n-00002', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours 55 minutes'),

  ('UPA-2026-00003', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 2000, 'Bikash KC',         'LIC-GHI-9012', 'settled', 'online',
    '{"violation": "Drunk Driving", "vehicle": "BA 3 KHA 3456", "location": "Tinkune", "license": "GHI-9012"}',
    'n-00003', NOW() - INTERVAL '4 hours 30 minutes', NOW() - INTERVAL '4 hours 28 minutes'),

  ('UPA-2026-00004', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 500,  'Kamala Devi',       'LIC-JKL-3456', 'settled', 'online',
    '{"violation": "No Helmet", "vehicle": "BA 4 PA 7890", "location": "Balaju", "license": "JKL-3456"}',
    'n-00004', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours 58 minutes'),

  ('UPA-2026-00005', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 3000, 'Dipak Oli',         'LIC-MNO-7890', 'settled', 'offline',
    '{"violation": "Overspeeding", "vehicle": "BA 5 CHA 1234", "location": "Ring Road, Koteshwor", "license": "MNO-7890"}',
    'n-00005', NOW() - INTERVAL '3 hours 30 minutes', NOW() - INTERVAL '3 hours 20 minutes'),

  ('UPA-2026-00006', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 500,  'Anita Poudel',      'LIC-PQR-1234', 'settled', 'online',
    '{"violation": "Wrong Way", "vehicle": "BA 6 PA 5678", "location": "Maitighar", "license": "PQR-1234"}',
    'n-00006', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 58 minutes'),

  ('UPA-2026-00007', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 1500, 'Suresh Maharjan',   'LIC-STU-5678', 'queued',  'offline',
    '{"violation": "Illegal Parking", "vehicle": "BA 7 KHA 9012", "location": "Durbar Marg", "license": "STU-5678"}',
    'n-00007', NOW() - INTERVAL '2 hours 30 minutes', NULL),

  ('UPA-2026-00008', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 500,  'Laxmi Karki',       'LIC-VWX-9012', 'settled', 'online',
    '{"violation": "No Seatbelt", "vehicle": "BA 8 PA 3456", "location": "Chabahil", "license": "VWX-9012"}',
    'n-00008', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 58 minutes'),

  ('UPA-2026-00009', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 2500, 'Rajesh Shrestha',   'LIC-YZA-3456', 'settled', 'online',
    '{"violation": "Hit and Run", "vehicle": "BA 9 CHA 7890", "location": "Baneshwor", "license": "YZA-3456"}',
    'n-00009', NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '1 hour 28 minutes'),

  ('UPA-2026-00010', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 500,  'Geeta Rana',        'LIC-BCD-7890', 'queued',  'offline',
    '{"violation": "Double Line Crossing", "vehicle": "BA 10 PA 1234", "location": "Satdobato", "license": "BCD-7890"}',
    'n-00010', NOW() - INTERVAL '1 hour', NULL),

  ('UPA-2026-00011', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 1000, 'Nabin Ghimire',     'LIC-EFG-1111', 'settled', 'online',
    '{"violation": "Using Phone While Driving", "vehicle": "BA 11 KHA 5555", "location": "Gongabu", "license": "EFG-1111"}',
    'n-00011', NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '48 minutes'),

  ('UPA-2026-00012', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 500,  'Sabina Limbu',      'LIC-HIJ-2222', 'settled', 'offline',
    '{"violation": "Red Zone Parking", "vehicle": "BA 12 PA 6666", "location": "Lazimpat", "license": "HIJ-2222"}',
    'n-00012', NOW() - INTERVAL '40 minutes', NOW() - INTERVAL '35 minutes'),

  ('UPA-2026-00013', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 5000, 'Prakash Bhandari',  'LIC-KLM-3333', 'settled', 'online',
    '{"violation": "No Insurance", "vehicle": "BA 13 CHA 7777", "location": "Thapathali", "license": "KLM-3333"}',
    'n-00013', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '28 minutes'),

  ('UPA-2026-00014', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 500,  'Durga Magar',       'LIC-NOP-4444', 'settled', 'online',
    '{"violation": "No Helmet (Pillion)", "vehicle": "BA 14 PA 8888", "location": "Pulchowk", "license": "NOP-4444"}',
    'n-00014', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '18 minutes'),

  ('UPA-2026-00015', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 1000, 'Binod Adhikari',    'LIC-QRS-5555', 'queued',  'offline',
    '{"violation": "Signal Jump", "vehicle": "BA 15 KHA 9999", "location": "Jawalakhel", "license": "QRS-5555"}',
    'n-00015', NOW() - INTERVAL '10 minutes', NULL)
ON CONFLICT (tx_id) DO NOTHING;

-- ── License Fees (5 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00016', upa_id_for('traffic@nepal.gov'), intent_id_for('license_fee'), 1000, 'Maya Tamang',    'APP-LIC-7890', 'settled', 'online',
    '{"licenseType": "Two Wheeler", "category": "Renewal"}',
    'n-00016', NOW() - INTERVAL '5 hours 45 minutes', NOW() - INTERVAL '5 hours 43 minutes'),

  ('UPA-2026-00017', upa_id_for('traffic@nepal.gov'), intent_id_for('license_fee'), 1000, 'Sunil Basnet',   'APP-LIC-1122', 'settled', 'online',
    '{"licenseType": "Four Wheeler", "category": "New"}',
    'n-00017', NOW() - INTERVAL '4 hours 15 minutes', NOW() - INTERVAL '4 hours 13 minutes'),

  ('UPA-2026-00018', upa_id_for('traffic@nepal.gov'), intent_id_for('license_fee'), 1000, 'Parbati Rai',    'APP-LIC-3344', 'settled', 'offline',
    '{"licenseType": "Two Wheeler", "category": "New"}',
    'n-00018', NOW() - INTERVAL '3 hours 15 minutes', NOW() - INTERVAL '3 hours 5 minutes'),

  ('UPA-2026-00019', upa_id_for('traffic@nepal.gov'), intent_id_for('license_fee'), 1000, 'Bikram Thapa',   'APP-LIC-5566', 'queued',  'offline',
    '{"licenseType": "Heavy Vehicle", "category": "Renewal"}',
    'n-00019', NOW() - INTERVAL '2 hours 15 minutes', NULL),

  ('UPA-2026-00020', upa_id_for('traffic@nepal.gov'), intent_id_for('license_fee'), 1000, 'Sanjay Gurung',  'APP-LIC-7788', 'settled', 'online',
    '{"licenseType": "Four Wheeler", "category": "Renewal"}',
    'n-00020', NOW() - INTERVAL '1 hour 15 minutes', NOW() - INTERVAL '1 hour 13 minutes')
ON CONFLICT (tx_id) DO NOTHING;

-- ── Property Tax (10 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00021', upa_id_for('revenue@lalitpur.gov.np'), intent_id_for('property_tax'), 15000, 'Hari Prasad',       'PROP-KTM-4421', 'settled', 'online',
    '{"ward": "7", "fiscalYear": "2082/83", "areaSqft": "2400", "lotNumber": "KTM-4421"}',
    'n-00021', NOW() - INTERVAL '6 hours 10 minutes', NOW() - INTERVAL '6 hours 8 minutes'),

  ('UPA-2026-00022', upa_id_for('revenue@lalitpur.gov.np'), intent_id_for('property_tax'), 25000, 'Sarita Joshi',      'PROP-LAL-5532', 'settled', 'online',
    '{"ward": "12", "fiscalYear": "2082/83", "areaSqft": "3200", "lotNumber": "LAL-5532"}',
    'n-00022', NOW() - INTERVAL '5 hours 50 minutes', NOW() - INTERVAL '5 hours 48 minutes'),

  ('UPA-2026-00023', upa_id_for('revenue@lalitpur.gov.np'), intent_id_for('property_tax'), 8000,  'Mohan Khadka',      'PROP-LAL-6643', 'settled', 'offline',
    '{"ward": "3", "fiscalYear": "2082/83", "areaSqft": "1500", "lotNumber": "LAL-6643"}',
    'n-00023', NOW() - INTERVAL '5 hours 20 minutes', NOW() - INTERVAL '5 hours 10 minutes'),

  ('UPA-2026-00024', upa_id_for('revenue@lalitpur.gov.np'), intent_id_for('property_tax'), 45000, 'Deepak Pandey',     'PROP-LAL-7754', 'settled', 'online',
    '{"ward": "15", "fiscalYear": "2082/83", "areaSqft": "5000", "lotNumber": "LAL-7754"}',
    'n-00024', NOW() - INTERVAL '4 hours 50 minutes', NOW() - INTERVAL '4 hours 48 minutes'),

  ('UPA-2026-00025', upa_id_for('revenue@lalitpur.gov.np'), intent_id_for('property_tax'), 12000, 'Sunita Acharya',    'PROP-LAL-8865', 'queued',  'offline',
    '{"ward": "9", "fiscalYear": "2082/83", "areaSqft": "2000", "lotNumber": "LAL-8865"}',
    'n-00025', NOW() - INTERVAL '4 hours 20 minutes', NULL),

  ('UPA-2026-00026', upa_id_for('revenue@lalitpur.gov.np'), intent_id_for('property_tax'), 18000, 'Rajan Manandhar',   'PROP-LAL-9976', 'settled', 'online',
    '{"ward": "11", "fiscalYear": "2082/83", "areaSqft": "2800", "lotNumber": "LAL-9976"}',
    'n-00026', NOW() - INTERVAL '3 hours 50 minutes', NOW() - INTERVAL '3 hours 48 minutes'),

  ('UPA-2026-00027', upa_id_for('revenue@lalitpur.gov.np'), intent_id_for('property_tax'), 32000, 'Nirmala Shakya',    'PROP-LAL-1087', 'settled', 'offline',
    '{"ward": "6", "fiscalYear": "2082/83", "areaSqft": "4000", "lotNumber": "LAL-1087"}',
    'n-00027', NOW() - INTERVAL '3 hours 20 minutes', NOW() - INTERVAL '3 hours 10 minutes'),

  ('UPA-2026-00028', upa_id_for('revenue@lalitpur.gov.np'), intent_id_for('property_tax'), 9500,  'Bijay Lama',        'PROP-LAL-2198', 'settled', 'online',
    '{"ward": "2", "fiscalYear": "2082/83", "areaSqft": "1800", "lotNumber": "LAL-2198"}',
    'n-00028', NOW() - INTERVAL '2 hours 50 minutes', NOW() - INTERVAL '2 hours 48 minutes'),

  ('UPA-2026-00029', upa_id_for('revenue@lalitpur.gov.np'), intent_id_for('property_tax'), 22000, 'Mina Shrestha',     'PROP-LAL-3309', 'queued',  'offline',
    '{"ward": "8", "fiscalYear": "2082/83", "areaSqft": "3500", "lotNumber": "LAL-3309"}',
    'n-00029', NOW() - INTERVAL '2 hours 20 minutes', NULL),

  ('UPA-2026-00030', upa_id_for('revenue@lalitpur.gov.np'), intent_id_for('property_tax'), 14000, 'Gopal Bhattarai',   'PROP-LAL-4410', 'settled', 'online',
    '{"ward": "14", "fiscalYear": "2082/83", "areaSqft": "2200", "lotNumber": "LAL-4410"}',
    'n-00030', NOW() - INTERVAL '1 hour 50 minutes', NOW() - INTERVAL '1 hour 48 minutes')
ON CONFLICT (tx_id) DO NOTHING;

-- ── Business Registration (3 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00031', upa_id_for('revenue@lalitpur.gov.np'), intent_id_for('business_registration'), 5000, 'Krishna Maharjan', 'BIZ-REG-001', 'settled', 'online',
    '{"businessName": "Himalayan Cafe", "businessType": "Restaurant", "ward": "5"}',
    'n-00031', NOW() - INTERVAL '5 hours 10 minutes', NOW() - INTERVAL '5 hours 8 minutes'),

  ('UPA-2026-00032', upa_id_for('revenue@lalitpur.gov.np'), intent_id_for('business_registration'), 5000, 'Priya Shrestha',  'BIZ-REG-002', 'settled', 'online',
    '{"businessName": "Digital Nepal IT", "businessType": "Technology", "ward": "12"}',
    'n-00032', NOW() - INTERVAL '3 hours 40 minutes', NOW() - INTERVAL '3 hours 38 minutes'),

  ('UPA-2026-00033', upa_id_for('revenue@lalitpur.gov.np'), intent_id_for('business_registration'), 5000, 'Arjun Tamang',    'BIZ-REG-003', 'queued',  'offline',
    '{"businessName": "Everest Trekking", "businessType": "Tourism", "ward": "7"}',
    'n-00033', NOW() - INTERVAL '1 hour 40 minutes', NULL)
ON CONFLICT (tx_id) DO NOTHING;

-- ── Tuition Fees (8 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00034', upa_id_for('fee@tribhuvan.edu.np'), intent_id_for('tuition_fee'), 25000, 'Anish Gurung',     'STU-TU-2024-4456', 'settled', 'online',
    '{"program": "BCA", "semester": "4th", "studentId": "TU-2024-4456"}',
    'n-00034', NOW() - INTERVAL '6 hours 5 minutes', NOW() - INTERVAL '6 hours 3 minutes'),

  ('UPA-2026-00035', upa_id_for('fee@tribhuvan.edu.np'), intent_id_for('tuition_fee'), 35000, 'Sapana Rai',       'STU-TU-2023-5567', 'settled', 'online',
    '{"program": "BBA", "semester": "6th", "studentId": "TU-2023-5567"}',
    'n-00035', NOW() - INTERVAL '5 hours 35 minutes', NOW() - INTERVAL '5 hours 33 minutes'),

  ('UPA-2026-00036', upa_id_for('fee@tribhuvan.edu.np'), intent_id_for('tuition_fee'), 28000, 'Roshan Poudel',    'STU-TU-2024-6678', 'settled', 'offline',
    '{"program": "BSc CSIT", "semester": "3rd", "studentId": "TU-2024-6678"}',
    'n-00036', NOW() - INTERVAL '4 hours 45 minutes', NOW() - INTERVAL '4 hours 35 minutes'),

  ('UPA-2026-00037', upa_id_for('fee@tribhuvan.edu.np'), intent_id_for('tuition_fee'), 20000, 'Asmita Thapa',     'STU-TU-2025-7789', 'queued',  'offline',
    '{"program": "BCA", "semester": "2nd", "studentId": "TU-2025-7789"}',
    'n-00037', NOW() - INTERVAL '4 hours 5 minutes', NULL),

  ('UPA-2026-00038', upa_id_for('fee@tribhuvan.edu.np'), intent_id_for('tuition_fee'), 45000, 'Manish KC',        'STU-TU-2022-8890', 'settled', 'online',
    '{"program": "MBA", "semester": "2nd", "studentId": "TU-2022-8890"}',
    'n-00038', NOW() - INTERVAL '3 hours 5 minutes', NOW() - INTERVAL '3 hours 3 minutes'),

  ('UPA-2026-00039', upa_id_for('fee@tribhuvan.edu.np'), intent_id_for('tuition_fee'), 22000, 'Pooja Dhakal',     'STU-TU-2024-9901', 'settled', 'online',
    '{"program": "BIT", "semester": "5th", "studentId": "TU-2024-9901"}',
    'n-00039', NOW() - INTERVAL '2 hours 5 minutes', NOW() - INTERVAL '2 hours 3 minutes'),

  ('UPA-2026-00040', upa_id_for('fee@tribhuvan.edu.np'), intent_id_for('tuition_fee'), 30000, 'Suman Adhikari',   'STU-TU-2023-1012', 'settled', 'offline',
    '{"program": "BE Civil", "semester": "7th", "studentId": "TU-2023-1012"}',
    'n-00040', NOW() - INTERVAL '1 hour 5 minutes', NOW() - INTERVAL '55 minutes'),

  ('UPA-2026-00041', upa_id_for('fee@tribhuvan.edu.np'), intent_id_for('tuition_fee'), 25000, 'Kiran Bista',      'STU-TU-2024-2123', 'settled', 'online',
    '{"program": "BSc CSIT", "semester": "5th", "studentId": "TU-2024-2123"}',
    'n-00041', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '43 minutes')
ON CONFLICT (tx_id) DO NOTHING;

-- ── Exam Fees (5 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00042', upa_id_for('fee@tribhuvan.edu.np'), intent_id_for('exam_fee'), 2500, 'Anish Gurung',   'STU-TU-2024-4456', 'settled', 'online',
    '{"program": "BCA", "semester": "4th", "studentId": "TU-2024-4456"}',
    'n-00042', NOW() - INTERVAL '5 hours 55 minutes', NOW() - INTERVAL '5 hours 53 minutes'),

  ('UPA-2026-00043', upa_id_for('fee@tribhuvan.edu.np'), intent_id_for('exam_fee'), 2500, 'Sapana Rai',     'STU-TU-2023-5567', 'settled', 'online',
    '{"program": "BBA", "semester": "6th", "studentId": "TU-2023-5567"}',
    'n-00043', NOW() - INTERVAL '5 hours 25 minutes', NOW() - INTERVAL '5 hours 23 minutes'),

  ('UPA-2026-00044', upa_id_for('fee@tribhuvan.edu.np'), intent_id_for('exam_fee'), 2500, 'Roshan Poudel',  'STU-TU-2024-6678', 'queued',  'offline',
    '{"program": "BSc CSIT", "semester": "3rd", "studentId": "TU-2024-6678"}',
    'n-00044', NOW() - INTERVAL '4 hours 35 minutes', NULL),

  ('UPA-2026-00045', upa_id_for('fee@tribhuvan.edu.np'), intent_id_for('exam_fee'), 2500, 'Pooja Dhakal',   'STU-TU-2024-9901', 'settled', 'online',
    '{"program": "BIT", "semester": "5th", "studentId": "TU-2024-9901"}',
    'n-00045', NOW() - INTERVAL '1 hour 55 minutes', NOW() - INTERVAL '1 hour 53 minutes'),

  ('UPA-2026-00046', upa_id_for('fee@tribhuvan.edu.np'), intent_id_for('exam_fee'), 2500, 'Kiran Bista',    'STU-TU-2024-2123', 'settled', 'online',
    '{"program": "BSc CSIT", "semester": "5th", "studentId": "TU-2024-2123"}',
    'n-00046', NOW() - INTERVAL '35 minutes', NOW() - INTERVAL '33 minutes')
ON CONFLICT (tx_id) DO NOTHING;

-- ── Birth Certificate Fees (3 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00047', upa_id_for('ward5@kathmandu.gov.np'), intent_id_for('birth_certificate'), 200, 'Ramesh Khadka',   'BC-W5-001', 'settled', 'online',
    '{"childName": "Aarav Khadka", "dob": "2082-05-15", "parentName": "Ramesh Khadka"}',
    'n-00047', NOW() - INTERVAL '5 hours 40 minutes', NOW() - INTERVAL '5 hours 38 minutes'),

  ('UPA-2026-00048', upa_id_for('ward5@kathmandu.gov.np'), intent_id_for('birth_certificate'), 200, 'Sushma Ghimire',  'BC-W5-002', 'settled', 'offline',
    '{"childName": "Riya Ghimire", "dob": "2082-08-22", "parentName": "Sushma Ghimire"}',
    'n-00048', NOW() - INTERVAL '3 hours 40 minutes', NOW() - INTERVAL '3 hours 30 minutes'),

  ('UPA-2026-00049', upa_id_for('ward5@kathmandu.gov.np'), intent_id_for('birth_certificate'), 200, 'Dil Bahadur',     'BC-W5-003', 'settled', 'online',
    '{"childName": "Nischal Tamang", "dob": "2082-11-03", "parentName": "Dil Bahadur Tamang"}',
    'n-00049', NOW() - INTERVAL '1 hour 40 minutes', NOW() - INTERVAL '1 hour 38 minutes')
ON CONFLICT (tx_id) DO NOTHING;

-- ── Recommendation Letters (2 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00050', upa_id_for('ward5@kathmandu.gov.np'), intent_id_for('recommendation_letter'), 500, 'Anup Shrestha',    'REC-W5-001', 'settled', 'online',
    '{"purpose": "Foreign Employment", "documentType": "Character Certificate"}',
    'n-00050', NOW() - INTERVAL '4 hours 40 minutes', NOW() - INTERVAL '4 hours 38 minutes'),

  ('UPA-2026-00051', upa_id_for('ward5@kathmandu.gov.np'), intent_id_for('recommendation_letter'), 500, 'Kabita Bhandari',  'REC-W5-002', 'queued',  'offline',
    '{"purpose": "Bank Loan", "documentType": "Recommendation Letter"}',
    'n-00051', NOW() - INTERVAL '2 hours 40 minutes', NULL)
ON CONFLICT (tx_id) DO NOTHING;

-- ── Vehicle Registration (3 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00052', upa_id_for('license@dotm.gov.np'), intent_id_for('vehicle_registration'), 25000, 'Bikash Tamang',  'VEH-REG-001', 'settled', 'online',
    '{"vehicleType": "Motorcycle", "manufacturer": "Yamaha", "model": "FZ-S V3"}',
    'n-00052', NOW() - INTERVAL '5 hours 15 minutes', NOW() - INTERVAL '5 hours 13 minutes'),

  ('UPA-2026-00053', upa_id_for('license@dotm.gov.np'), intent_id_for('vehicle_registration'), 45000, 'Shanti Devi',    'VEH-REG-002', 'settled', 'online',
    '{"vehicleType": "Car", "manufacturer": "Hyundai", "model": "i20"}',
    'n-00053', NOW() - INTERVAL '3 hours 10 minutes', NOW() - INTERVAL '3 hours 8 minutes'),

  ('UPA-2026-00054', upa_id_for('license@dotm.gov.np'), intent_id_for('vehicle_registration'), 15000, 'Naresh Gurung',  'VEH-REG-003', 'queued',  'offline',
    '{"vehicleType": "Scooter", "manufacturer": "Honda", "model": "Dio"}',
    'n-00054', NOW() - INTERVAL '1 hour 10 minutes', NULL)
ON CONFLICT (tx_id) DO NOTHING;

-- ── Route Permit (1 transaction) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00055', upa_id_for('license@dotm.gov.np'), intent_id_for('route_permit'), 15000, 'Sajha Yatayat',  'RP-SAJHA-001', 'settled', 'online',
    '{"route": "Kathmandu - Bhaktapur", "vehicleNumber": "BA 1 KHA 1234", "permitDuration": "1 Year"}',
    'n-00055', NOW() - INTERVAL '2 hours 10 minutes', NOW() - INTERVAL '2 hours 8 minutes')
ON CONFLICT (tx_id) DO NOTHING;

-- ============================================
-- From 05_extended_seed.sql
-- ============================================

-- ============================================
-- UPA-NP — Extended Seed Data
-- Run AFTER 04_extended_schema.sql
-- Adds: citizen UPAs, merchant UPAs, utility UPAs, NID cards, bank accounts, diverse transactions
-- ============================================

-- ── Citizen UPAs ──
INSERT INTO upas (id, address, entity_name, entity_type, nid_number) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'ram@upa.np',    'Ram Bahadur Thapa',   'citizen', 'RAM-KTM-1990-4521'),
  ('a2000000-0000-0000-0000-000000000002', 'sita@upa.np',   'Sita Sharma',         'citizen', 'SITA-PKR-1995-7832'),
  ('a2000000-0000-0000-0000-000000000003', 'hari@upa.np',   'Hari Prasad Gurung',  'citizen', 'HARI-LTP-1988-3214'),
  ('a2000000-0000-0000-0000-000000000004', 'anita@upa.np',  'Anita Gurung',        'citizen', 'ANITA-BRT-1998-5643'),
  ('a2000000-0000-0000-0000-000000000005', 'tyler@upa.np',  'Tyler Durden',        'citizen', '123-456-789')
ON CONFLICT (address) DO NOTHING;

-- ── Merchant UPAs ──
INSERT INTO upas (id, address, entity_name, entity_type, business_category) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'coffee@himalayanjava.np',   'Himalayan Java - Thamel',  'merchant', 'cafe'),
  ('a3000000-0000-0000-0000-000000000002', 'grocery@bhatbhateni.np',    'Bhatbhateni Supermarket',  'merchant', 'grocery'),
  ('a3000000-0000-0000-0000-000000000003', 'restaurant@thakali.np',     'Thakali Kitchen',          'merchant', 'restaurant'),
  ('a3000000-0000-0000-0000-000000000004', 'pharmacy@nepalausadhi.np',  'Nepal Ausadhi Pasal',      'merchant', 'pharmacy')
ON CONFLICT (address) DO NOTHING;

-- ── Utility UPAs ──
INSERT INTO upas (id, address, entity_name, entity_type) VALUES
  ('a4000000-0000-0000-0000-000000000001', 'nea@utility.np',             'Nepal Electricity Authority',  'utility'),
  ('a4000000-0000-0000-0000-000000000002', 'water@kathmandu.gov.np',     'Kathmandu Water Supply',       'utility'),
  ('a4000000-0000-0000-0000-000000000003', 'internet@worldlink.np',      'Worldlink Communications',     'utility'),
  ('a4000000-0000-0000-0000-000000000004', 'recharge@ntc.np',            'Nepal Telecom',                'utility'),
  ('a4000000-0000-0000-0000-000000000005', 'passport@mfa.gov.np',        'Ministry of Foreign Affairs',  'government')
ON CONFLICT (address) DO NOTHING;

-- ── Merchant Intents ──
INSERT INTO intents (id, intent_code, category, label, description, amount_type, fixed_amount, min_amount, max_amount, metadata_schema, upa_id) VALUES
  ('b2000000-0000-0000-0000-000000000001', 'coffee_purchase', 'merchant', 'Coffee Purchase',
    'Payment for coffee and food', 'open', NULL, 50, 5000,
    '{"items": {"type": "string", "label": "Items", "required": false}, "table": {"type": "string", "label": "Table #", "required": false}}',
    upa_id_for('coffee@himalayanjava.np')),

  ('b2000000-0000-0000-0000-000000000002', 'grocery_purchase', 'merchant', 'Grocery Purchase',
    'Supermarket/grocery shopping', 'open', NULL, 50, 50000,
    '{"invoice": {"type": "string", "label": "Invoice #", "required": false}, "branch": {"type": "string", "label": "Branch", "required": false}}',
    upa_id_for('grocery@bhatbhateni.np')),

  ('b2000000-0000-0000-0000-000000000003', 'restaurant_payment', 'merchant', 'Restaurant Payment',
    'Dining and food orders', 'open', NULL, 100, 20000,
    '{"table": {"type": "string", "label": "Table #", "required": false}, "guests": {"type": "string", "label": "Guests", "required": false}}',
    upa_id_for('restaurant@thakali.np')),

  ('b2000000-0000-0000-0000-000000000004', 'pharmacy_purchase', 'merchant', 'Pharmacy Purchase',
    'Medicine and health products', 'open', NULL, 50, 20000,
    '{"prescription": {"type": "string", "label": "Prescription", "required": false}}',
    upa_id_for('pharmacy@nepalausadhi.np'))
ON CONFLICT (intent_code) DO NOTHING;

-- ── Utility/Bill Intents ──
INSERT INTO intents (id, intent_code, category, label, description, amount_type, fixed_amount, min_amount, max_amount, metadata_schema, upa_id) VALUES
  ('b3000000-0000-0000-0000-000000000001', 'electricity_bill', 'bill_payment', 'Electricity Bill',
    'Monthly electricity bill payment', 'open', NULL, 100, 50000,
    '{"accountNumber": {"type": "string", "label": "Account Number", "required": true}, "month": {"type": "string", "label": "Billing Month", "required": true}, "units": {"type": "string", "label": "Units (kWh)", "required": false}}',
    upa_id_for('nea@utility.np')),

  ('b3000000-0000-0000-0000-000000000002', 'water_bill', 'bill_payment', 'Water Bill',
    'Monthly water supply bill', 'open', NULL, 50, 10000,
    '{"accountNumber": {"type": "string", "label": "Account Number", "required": true}, "month": {"type": "string", "label": "Billing Month", "required": true}}',
    upa_id_for('water@kathmandu.gov.np')),

  ('b3000000-0000-0000-0000-000000000003', 'internet_bill', 'bill_payment', 'Internet Bill',
    'Monthly ISP bill', 'open', NULL, 500, 10000,
    '{"accountNumber": {"type": "string", "label": "Account Number", "required": true}, "plan": {"type": "string", "label": "Plan", "required": false}}',
    upa_id_for('internet@worldlink.np')),

  ('b3000000-0000-0000-0000-000000000004', 'mobile_recharge', 'bill_payment', 'Mobile Recharge',
    'Prepaid mobile recharge', 'open', NULL, 20, 5000,
    '{"mobileNumber": {"type": "string", "label": "Mobile Number", "required": true}}',
    upa_id_for('recharge@ntc.np')),

  ('b3000000-0000-0000-0000-000000000005', 'passport_fee', 'fee', 'Passport Fee',
    'Passport application fee', 'fixed', 5000, NULL, NULL,
    '{"passportType": {"type": "string", "label": "Passport Type", "required": true}, "urgency": {"type": "string", "label": "Urgency", "required": true}}',
    upa_id_for('passport@mfa.gov.np'))
ON CONFLICT (intent_code) DO NOTHING;

-- ── NID Cards ──
INSERT INTO nid_cards (id, nid_number, full_name, date_of_birth, issue_date, expiry_date, photo_url, district, is_active, upa_id) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'RAM-KTM-1990-4521',  'Ram Bahadur Thapa',   '1990-05-15', '2020-01-01', '2030-01-01', '/mock-nid/ram.jpg',   'Kathmandu', TRUE, upa_id_for('ram@upa.np')),
  ('d1000000-0000-0000-0000-000000000002', 'SITA-PKR-1995-7832', 'Sita Sharma',         '1995-08-22', '2021-03-15', '2031-03-15', '/mock-nid/sita.jpg',  'Pokhara',   TRUE, upa_id_for('sita@upa.np')),
  ('d1000000-0000-0000-0000-000000000003', 'HARI-LTP-1988-3214', 'Hari Prasad Gurung',  '1988-12-10', '2019-06-20', '2029-06-20', '/mock-nid/hari.jpg',  'Lalitpur',  TRUE, upa_id_for('hari@upa.np')),
  ('d1000000-0000-0000-0000-000000000004', 'ANITA-BRT-1998-5643','Anita Gurung',        '1998-03-12', '2022-06-15', '2032-06-15', '/mock-nid/anita.jpg', 'Bharatpur', TRUE, upa_id_for('anita@upa.np')),
  ('d1000000-0000-0000-0000-000000000005', '123-456-789',        'Tyler Durden',        '1979-12-18', '2024-12-18', '2034-12-18', '/mock-nid/tyler.png', 'Kathmandu', TRUE, upa_id_for('tyler@upa.np'))
ON CONFLICT (nid_number) DO NOTHING;

-- ── Bank Accounts ──
INSERT INTO bank_accounts (id, nid_id, bank_name, account_number, account_type, is_primary, linked_via) VALUES
  ('e1000000-0000-0000-0000-000000000001', nid_id_for('RAM-KTM-1990-4521'), 'Nepal Bank',      '01234567890123', 'savings', TRUE, 'nid'),
  ('e1000000-0000-0000-0000-000000000002', nid_id_for('SITA-PKR-1995-7832'), 'Nabil Bank',      '98765432109876', 'savings', TRUE, 'nid'),
  ('e1000000-0000-0000-0000-000000000003', nid_id_for('HARI-LTP-1988-3214'), 'NIC Asia Bank',   '11223344556677', 'savings', TRUE, 'nid'),
  ('e1000000-0000-0000-0000-000000000004', nid_id_for('ANITA-BRT-1998-5643'), 'Himalayan Bank',  '55667788990011', 'savings', TRUE, 'nid'),
  ('e1000000-0000-0000-0000-000000000005', nid_id_for('123-456-789'),        'Himalayan Bank',  '23410098776655', 'savings', TRUE, 'nid')
ON CONFLICT (id) DO NOTHING;

-- ── Mixed Transactions (merchant, bill, C2C, NID) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, tx_type, amount, payer_name, payer_id, payer_upa, payment_source, status, mode, metadata, nonce, issued_at, settled_at) VALUES

  -- Coffee purchase (merchant, wallet, online)
  ('UPA-2026-00056', upa_id_for('coffee@himalayanjava.np'), intent_id_for('coffee_purchase'), 'merchant_purchase', 282.50,
    'Ram Thapa', NULL, upa_id_for('ram@upa.np'), 'wallet', 'settled', 'online',
    '{"items": "Cappuccino x1, Croissant x1", "table": "4", "invoice": "HJ-2026-0421", "tax": "32.50"}',
    'n-00056', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 58 minutes'),

  -- Grocery purchase (merchant, wallet, online)
  ('UPA-2026-00057', upa_id_for('grocery@bhatbhateni.np'), intent_id_for('grocery_purchase'), 'merchant_purchase', 1850,
    'Sita Sharma', NULL, upa_id_for('sita@upa.np'), 'wallet', 'settled', 'online',
    '{"branch": "Thamel", "invoice": "BB-2026-8821", "items": "15 items"}',
    'n-00057', NOW() - INTERVAL '2 hours 45 minutes', NOW() - INTERVAL '2 hours 43 minutes'),

  -- Electricity bill (utility, NID bank, NFC)
  ('UPA-2026-00058', upa_id_for('nea@utility.np'), intent_id_for('electricity_bill'), 'bill_payment', 2500,
    'Ram Bahadur Thapa', '012-345-678-9', upa_id_for('ram@upa.np'), 'nid_bank', 'settled', 'nfc',
    '{"accountNumber": "012-345-678-9", "month": "February 2026", "units": "245", "previousReading": "12450", "currentReading": "12695"}',
    'n-00058', NOW() - INTERVAL '2 hours 30 minutes', NOW() - INTERVAL '2 hours 28 minutes'),

  -- Water bill (utility, wallet, online)
  ('UPA-2026-00059', upa_id_for('water@kathmandu.gov.np'), intent_id_for('water_bill'), 'bill_payment', 450,
    'Hari Prasad', 'WAT-KTM-9922', upa_id_for('hari@upa.np'), 'wallet', 'settled', 'online',
    '{"accountNumber": "WAT-KTM-9922", "month": "February 2026", "consumption": "12 cubic meters"}',
    'n-00059', NOW() - INTERVAL '2 hours 15 minutes', NOW() - INTERVAL '2 hours 13 minutes'),

  -- Internet bill (utility, wallet, online)
  ('UPA-2026-00060', upa_id_for('internet@worldlink.np'), intent_id_for('internet_bill'), 'bill_payment', 1100,
    'Sita Sharma', 'WL-PKR-4521', upa_id_for('sita@upa.np'), 'wallet', 'settled', 'online',
    '{"accountNumber": "WL-PKR-4521", "plan": "100 Mbps Unlimited", "month": "February 2026"}',
    'n-00060', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 58 minutes'),

  -- Restaurant (merchant, NID bank, NFC)
  ('UPA-2026-00061', upa_id_for('restaurant@thakali.np'), intent_id_for('restaurant_payment'), 'merchant_purchase', 1200,
    'Ram Thapa', NULL, upa_id_for('ram@upa.np'), 'nid_bank', 'settled', 'nfc',
    '{"guests": "3", "table": "12", "invoice": "THK-0221", "items": "Dal Bhat Set x3"}',
    'n-00061', NOW() - INTERVAL '1 hour 45 minutes', NOW() - INTERVAL '1 hour 43 minutes'),

  -- Pharmacy (merchant, wallet, online)
  ('UPA-2026-00062', upa_id_for('pharmacy@nepalausadhi.np'), intent_id_for('pharmacy_purchase'), 'merchant_purchase', 750,
    'Ram Thapa', NULL, upa_id_for('ram@upa.np'), 'wallet', 'settled', 'online',
    '{"prescription": "Yes", "items": "3 items", "invoice": "PH-0891"}',
    'n-00062', NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '1 hour 28 minutes'),

  -- C2C: Ram -> Sita (Lunch split)
  ('UPA-2026-00063', upa_id_for('sita@upa.np'), NULL, 'c2c', 800,
    'Ram Thapa', NULL, upa_id_for('ram@upa.np'), 'wallet', 'settled', 'online',
    '{"intent": "Lunch split", "message": "Thanks for yesterday!", "fromUPA": "ram@upa.np", "toUPA": "sita@upa.np"}',
    'n-00063', NOW() - INTERVAL '1 hour 15 minutes', NOW() - INTERVAL '1 hour 13 minutes'),

  -- C2C: Hari -> Ram (Rent payment, NID bank)
  ('UPA-2026-00064', upa_id_for('ram@upa.np'), NULL, 'c2c', 5000,
    'Hari Prasad', NULL, upa_id_for('hari@upa.np'), 'nid_bank', 'settled', 'online',
    '{"intent": "Rent payment", "message": "February rent", "fromUPA": "hari@upa.np", "toUPA": "ram@upa.np"}',
    'n-00064', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '58 minutes'),

  -- C2C: Sita -> Hari (Movie tickets)
  ('UPA-2026-00065', upa_id_for('hari@upa.np'), NULL, 'c2c', 1200,
    'Sita Sharma', NULL, upa_id_for('sita@upa.np'), 'wallet', 'settled', 'online',
    '{"intent": "Movie tickets", "message": "Avengers split", "fromUPA": "sita@upa.np", "toUPA": "hari@upa.np"}',
    'n-00065', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '43 minutes'),

  -- NID payment (traffic fine via NID bank + NFC)
  ('UPA-2026-00066', upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), 'nid_payment', 1000,
    'Ram Bahadur Thapa', 'APP-LIC-7890', upa_id_for('ram@upa.np'), 'nid_bank', 'settled', 'nfc',
    '{"violation": "License Renewal", "license": "APP-LIC-7890", "vehicle": "BA 1 PA 4567", "location": "DOTM Ekantakuna"}',
    'n-00066', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '28 minutes'),

  -- Passport fee (online, wallet)
  ('UPA-2026-00067', upa_id_for('passport@mfa.gov.np'), intent_id_for('passport_fee'), 'payment', 5000,
    'Maya Tamang', 'PASS-2024-8822', NULL, 'wallet', 'settled', 'online',
    '{"passportType": "Regular", "urgency": "Normal"}',
    'n-00067', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '18 minutes'),

  -- Queued offline payment (tuition, offline, not yet synced)
  ('UPA-2026-00068', upa_id_for('fee@tribhuvan.edu.np'), intent_id_for('tuition_fee'), 'payment', 25000,
    'Anish Gurung', 'STU-TU-2024-4456', NULL, 'wallet', 'queued', 'offline',
    '{"program": "BCA", "semester": "4th", "studentName": "Anish Gurung"}',
    'n-00068', NOW() - INTERVAL '10 minutes', NULL)
ON CONFLICT (tx_id) DO NOTHING;

-- ============================================
-- From 01_SUPPLEMENTARY_SEED.sql
-- ============================================

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

-- ============================================
-- WEEK 2 (Days 8-14)
-- ============================================

FOR day_offset IN 8..14 LOOP
  -- Morning: Cafe purchases
  INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
    ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
     upa_id_for('coffee@himalayanjava.np'), intent_id_for('coffee_purchase'), upa_id_for('ram@upa.np'),
     'payment', 350 + FLOOR(RANDOM() * 200)::INTEGER, 'Ram Bahadur Thapa', 'settled', 'online', 'wallet',
     '{"items": "Coffee, Pastry"}', 'n-' || LPAD(tx_num::TEXT, 6, '0'),
     base_date + (day_offset || ' days')::INTERVAL + (8 || ' hours')::INTERVAL,
     base_date + (day_offset || ' days')::INTERVAL + (8 || ' hours')::INTERVAL + INTERVAL '2 min');
  tx_num := tx_num + 1;
  
  -- Midday: Grocery shopping
  INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
    ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
     upa_id_for('grocery@bhatbhateni.np'), intent_id_for('grocery_purchase'), upa_id_for('sita@upa.np'),
     'payment', 2500 + FLOOR(RANDOM() * 3000)::INTEGER, 'Sita Sharma', 'settled', 'online', 'wallet',
     '{"cart": "Weekly groceries"}', 'n-' || LPAD(tx_num::TEXT, 6, '0'),
     base_date + (day_offset || ' days')::INTERVAL + (12 || ' hours')::INTERVAL,
     base_date + (day_offset || ' days')::INTERVAL + (12 || ' hours')::INTERVAL + INTERVAL '3 min');
  tx_num := tx_num + 1;
  
  -- Evening: Restaurant dinner
  INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
    ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
     upa_id_for('restaurant@thakali.np'), intent_id_for('restaurant_payment'), upa_id_for('hari@upa.np'),
     'payment', 1800 + FLOOR(RANDOM() * 1200)::INTEGER, 'Hari Prasad Gurung', 'settled', 'online', 'wallet',
     ('{"table": "Table ' || (1 + FLOOR(RANDOM() * 15))::INTEGER || '"}')::jsonb, 'n-' || LPAD(tx_num::TEXT, 6, '0'),
     base_date + (day_offset || ' days')::INTERVAL + (19 || ' hours')::INTERVAL,
     base_date + (day_offset || ' days')::INTERVAL + (19 || ' hours')::INTERVAL + INTERVAL '2 min');
  tx_num := tx_num + 1;
  
  -- Random: Traffic fines (30% chance per day)
  IF RANDOM() < 0.3 THEN
    INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
      ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
       upa_id_for('traffic@nepal.gov'), intent_id_for('traffic_fine'), upa_id_for('anita@upa.np'),
       'payment', 500 + (500 * FLOOR(RANDOM() * 4)::INTEGER), 'Anita Gurung', 'LIC-ANI-' || (1000 + FLOOR(RANDOM() * 9000))::INTEGER,
       'settled', CASE WHEN RANDOM() < 0.7 THEN 'online' ELSE 'offline' END, 'wallet',
       ('{"license": "ANI-' || (1000 + FLOOR(RANDOM() * 9000))::INTEGER || '", "violation": "' || 
       (ARRAY['No Helmet', 'Signal Jump', 'Overspeeding', 'Illegal Parking'])[1 + FLOOR(RANDOM() * 4)::INTEGER] || '"}')::jsonb,
       'n-' || LPAD(tx_num::TEXT, 6, '0'),
       base_date + (day_offset || ' days')::INTERVAL + ((10 + FLOOR(RANDOM() * 9))::INTEGER || ' hours')::INTERVAL,
       base_date + (day_offset || ' days')::INTERVAL + ((10 + FLOOR(RANDOM() * 9))::INTEGER || ' hours')::INTERVAL + INTERVAL '5 min');
    tx_num := tx_num + 1;
  END IF;
END LOOP;

-- ============================================
-- WEEK 3 (Days 15-21) — Bill Payment Week
-- ============================================

FOR day_offset IN 15..21 LOOP
  -- Electricity Bills (random citizens)
  INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
    ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
     upa_id_for('nea@utility.np'), intent_id_for('electricity_bill'),
     upa_id_for((ARRAY['ram@upa.np', 'sita@upa.np', 'hari@upa.np'])[1 + FLOOR(RANDOM() * 3)::INTEGER]),
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
     upa_id_for('water@kathmandu.gov.np'), intent_id_for('water_bill'),
     upa_id_for((ARRAY['ram@upa.np', 'anita@upa.np', 'tyler@upa.np'])[1 + FLOOR(RANDOM() * 3)::INTEGER]),
     'bill_payment', 300 + FLOOR(RANDOM() * 500)::INTEGER,
     (ARRAY['Ram Bahadur Thapa', 'Anita Gurung', 'Tyler Durden'])[1 + FLOOR(RANDOM() * 3)::INTEGER],
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
       upa_id_for('internet@worldlink.np'), intent_id_for('internet_bill'),
       upa_id_for((ARRAY['sita@upa.np', 'hari@upa.np'])[1 + FLOOR(RANDOM() * 2)::INTEGER]),
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

-- ============================================
-- WEEK 4 (Days 22-30) — Tax Season + C2C Transfers
-- ============================================

FOR day_offset IN 22..30 LOOP
  -- Property Tax Payments (sporadic)
  IF day_offset % 3 = 0 THEN
    INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, payer_id, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
      ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
       upa_id_for('revenue@lalitpur.gov.np'),
       intent_id_for('property_tax'),
       upa_id_for((ARRAY['ram@upa.np', 'hari@upa.np', 'tyler@upa.np'])[1 + FLOOR(RANDOM() * 3)::INTEGER]),
       'payment', 10000 + FLOOR(RANDOM() * 30000)::INTEGER,
       (ARRAY['Ram Bahadur Thapa', 'Hari Prasad Gurung', 'Tyler Durden'])[1 + FLOOR(RANDOM() * 3)::INTEGER],
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
       upa_id_for((ARRAY['ram@upa.np', 'sita@upa.np', 'hari@upa.np'])[1 + FLOOR(RANDOM() * 3)::INTEGER]),
       upa_id_for((ARRAY['anita@upa.np', 'tyler@upa.np'])[1 + FLOOR(RANDOM() * 2)::INTEGER]),
       500 + FLOOR(RANDOM() * 2000)::INTEGER,
       (ARRAY['Ram Bahadur Thapa', 'Sita Sharma', 'Hari Prasad Gurung'])[1 + FLOOR(RANDOM() * 3)::INTEGER],
       'settled', 'online', 'wallet',
       ('{"toUPA": "' || (ARRAY['anita@upa.np', 'tyler@upa.np'])[1 + FLOOR(RANDOM() * 2)::INTEGER] || '", ' ||
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
       upa_id_for((ARRAY['coffee@himalayanjava.np', 'coffee@himalayanjava.np', 'grocery@bhatbhateni.np'])[i]),
       intent_id_for((ARRAY['coffee_purchase', 'coffee_purchase', 'grocery_purchase'])[i]),
       upa_id_for((ARRAY['ram@upa.np', 'sita@upa.np', 'anita@upa.np'])[i]),
       'payment', 200 + FLOOR(RANDOM() * 1000)::INTEGER,
       (ARRAY['Ram Bahadur Thapa', 'Sita Sharma', 'Anita Gurung'])[i],
       'settled', CASE WHEN RANDOM() < 0.8 THEN 'online' ELSE 'offline' END, 'wallet',
       ('{"items": "' || (ARRAY['Coffee & Snacks', 'Bread & Milk', 'Groceries'])[i] || '"}')::jsonb,
       'n-' || LPAD(tx_num::TEXT, 6, '0'),
       base_date + (day_offset || ' days')::INTERVAL + ((9 + i * 3)::INTEGER || ' hours')::INTERVAL,
       base_date + (day_offset || ' days')::INTERVAL + ((9 + i * 3)::INTEGER || ' hours')::INTERVAL + INTERVAL '2 min');
    tx_num := tx_num + 1;
  END LOOP;
END LOOP;

-- ============================================
-- RECENT (Last 3 Days) — High Activity
-- ============================================

FOR day_offset IN 1..3 LOOP
  FOR hour_offset IN 9..20 LOOP
    -- Cafe purchases
    INSERT INTO transactions (tx_id, upa_id, intent_id, payer_upa, tx_type, amount, payer_name, status, mode, payment_source, metadata, nonce, issued_at, settled_at) VALUES
      ('UPA-2026-' || LPAD(tx_num::TEXT, 5, '0'), 
       upa_id_for('coffee@himalayanjava.np'), intent_id_for('coffee_purchase'),
       upa_id_for((ARRAY['ram@upa.np', 'sita@upa.np', 'hari@upa.np', 'anita@upa.np'])[1 + FLOOR(RANDOM() * 4)::INTEGER]),
       'payment', 250 + FLOOR(RANDOM() * 500)::INTEGER,
       (ARRAY['Ram Bahadur Thapa', 'Sita Sharma', 'Hari Prasad Gurung', 'Anita Gurung'])[1 + FLOOR(RANDOM() * 4)::INTEGER],
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

-- ============================================
-- Verification Queries
-- ============================================

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
