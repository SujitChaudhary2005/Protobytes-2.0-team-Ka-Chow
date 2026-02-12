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
  ('a1000000-0000-0000-0000-000000000005', 'license@dotm.gov.np',    'Dept. of Transport Management',  'government',  NULL);

-- ============================================
-- Intents (10 Payment Templates)
-- ============================================
INSERT INTO intents (id, intent_code, category, label, description, amount_type, fixed_amount, min_amount, max_amount, metadata_schema, upa_id) VALUES

  -- Traffic Police
  ('b1000000-0000-0000-0000-000000000001', 'traffic_fine', 'fine', 'Traffic Violation Fine',
    'Fine for traffic rule violation', 'range', NULL, 500, 10000,
    '{"license": {"type": "string", "label": "License Number", "required": true}, "violation": {"type": "string", "label": "Violation Type", "required": true}, "vehicle": {"type": "string", "label": "Vehicle Number", "required": true}, "location": {"type": "string", "label": "Location", "required": true}}',
    'a1000000-0000-0000-0000-000000000001'),

  ('b1000000-0000-0000-0000-000000000002', 'license_fee', 'fee', 'Driving License Fee',
    'Fee for new or renewal driving license', 'fixed', 1000, NULL, NULL,
    '{"licenseType": {"type": "string", "label": "License Type", "required": true}, "category": {"type": "string", "label": "Category (New/Renewal)", "required": true}}',
    'a1000000-0000-0000-0000-000000000001'),

  -- Lalitpur Municipality
  ('b1000000-0000-0000-0000-000000000003', 'property_tax', 'tax', 'Property Tax',
    'Annual property tax payment', 'range', NULL, 1000, 500000,
    '{"ward": {"type": "string", "label": "Ward Number", "required": true}, "lotNumber": {"type": "string", "label": "Lot/Plot Number", "required": true}, "fiscalYear": {"type": "string", "label": "Fiscal Year", "required": true}, "areaSqft": {"type": "string", "label": "Area (sq ft)", "required": false}}',
    'a1000000-0000-0000-0000-000000000002'),

  ('b1000000-0000-0000-0000-000000000004', 'business_registration', 'fee', 'Business Registration Fee',
    'Municipal business registration', 'fixed', 5000, NULL, NULL,
    '{"businessName": {"type": "string", "label": "Business Name", "required": true}, "businessType": {"type": "string", "label": "Business Type", "required": true}, "ward": {"type": "string", "label": "Ward Number", "required": true}}',
    'a1000000-0000-0000-0000-000000000002'),

  -- Tribhuvan University
  ('b1000000-0000-0000-0000-000000000005', 'tuition_fee', 'tuition', 'Tuition Fee',
    'Semester tuition payment', 'range', NULL, 5000, 100000,
    '{"program": {"type": "string", "label": "Program", "required": true}, "semester": {"type": "string", "label": "Semester", "required": true}, "studentId": {"type": "string", "label": "Student ID", "required": true}}',
    'a1000000-0000-0000-0000-000000000003'),

  ('b1000000-0000-0000-0000-000000000006', 'exam_fee', 'fee', 'Examination Fee',
    'Semester examination fee', 'fixed', 2500, NULL, NULL,
    '{"program": {"type": "string", "label": "Program", "required": true}, "semester": {"type": "string", "label": "Semester", "required": true}, "studentId": {"type": "string", "label": "Student ID", "required": true}}',
    'a1000000-0000-0000-0000-000000000003'),

  -- Kathmandu Ward 5
  ('b1000000-0000-0000-0000-000000000007', 'birth_certificate', 'fee', 'Birth Certificate Fee',
    'Issuance of birth certificate', 'fixed', 200, NULL, NULL,
    '{"childName": {"type": "string", "label": "Child Name", "required": true}, "dob": {"type": "string", "label": "Date of Birth", "required": true}, "parentName": {"type": "string", "label": "Parent Name", "required": true}}',
    'a1000000-0000-0000-0000-000000000004'),

  ('b1000000-0000-0000-0000-000000000008', 'recommendation_letter', 'fee', 'Recommendation Letter Fee',
    'Ward-level recommendation letter', 'fixed', 500, NULL, NULL,
    '{"purpose": {"type": "string", "label": "Purpose", "required": true}, "documentType": {"type": "string", "label": "Document Type", "required": true}}',
    'a1000000-0000-0000-0000-000000000004'),

  -- Dept. of Transport Management
  ('b1000000-0000-0000-0000-000000000009', 'vehicle_registration', 'fee', 'Vehicle Registration Fee',
    'New vehicle registration', 'range', NULL, 5000, 50000,
    '{"vehicleType": {"type": "string", "label": "Vehicle Type", "required": true}, "manufacturer": {"type": "string", "label": "Manufacturer", "required": true}, "model": {"type": "string", "label": "Model", "required": true}}',
    'a1000000-0000-0000-0000-000000000005'),

  ('b1000000-0000-0000-0000-000000000010', 'route_permit', 'fee', 'Route Permit Fee',
    'Public transport route permit', 'fixed', 15000, NULL, NULL,
    '{"route": {"type": "string", "label": "Route", "required": true}, "vehicleNumber": {"type": "string", "label": "Vehicle Number", "required": true}, "permitDuration": {"type": "string", "label": "Permit Duration", "required": true}}',
    'a1000000-0000-0000-0000-000000000005');

-- ============================================
-- Transactions (55 Realistic Entries)
-- ============================================

-- ── Traffic Fines (15 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00001', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 500,  'Ram Thapa',        'LIC-ABC-1234', 'settled', 'online',
    '{"violation": "Red Zone Parking", "vehicle": "BA 1 PA 4567", "location": "New Road, Kathmandu", "license": "ABC-1234"}',
    'n-00001', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours 58 minutes'),

  ('UPA-2026-00002', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 1000, 'Sita Sharma',       'LIC-DEF-5678', 'settled', 'offline',
    '{"violation": "Signal Jump", "vehicle": "BA 2 PA 8901", "location": "Kalanki Chowk", "license": "DEF-5678"}',
    'n-00002', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours 55 minutes'),

  ('UPA-2026-00003', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 2000, 'Bikash KC',         'LIC-GHI-9012', 'settled', 'online',
    '{"violation": "Drunk Driving", "vehicle": "BA 3 KHA 3456", "location": "Tinkune", "license": "GHI-9012"}',
    'n-00003', NOW() - INTERVAL '4 hours 30 minutes', NOW() - INTERVAL '4 hours 28 minutes'),

  ('UPA-2026-00004', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 500,  'Kamala Devi',       'LIC-JKL-3456', 'settled', 'online',
    '{"violation": "No Helmet", "vehicle": "BA 4 PA 7890", "location": "Balaju", "license": "JKL-3456"}',
    'n-00004', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours 58 minutes'),

  ('UPA-2026-00005', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 3000, 'Dipak Oli',         'LIC-MNO-7890', 'settled', 'offline',
    '{"violation": "Overspeeding", "vehicle": "BA 5 CHA 1234", "location": "Ring Road, Koteshwor", "license": "MNO-7890"}',
    'n-00005', NOW() - INTERVAL '3 hours 30 minutes', NOW() - INTERVAL '3 hours 20 minutes'),

  ('UPA-2026-00006', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 500,  'Anita Poudel',      'LIC-PQR-1234', 'settled', 'online',
    '{"violation": "Wrong Way", "vehicle": "BA 6 PA 5678", "location": "Maitighar", "license": "PQR-1234"}',
    'n-00006', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 58 minutes'),

  ('UPA-2026-00007', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 1500, 'Suresh Maharjan',   'LIC-STU-5678', 'queued',  'offline',
    '{"violation": "Illegal Parking", "vehicle": "BA 7 KHA 9012", "location": "Durbar Marg", "license": "STU-5678"}',
    'n-00007', NOW() - INTERVAL '2 hours 30 minutes', NULL),

  ('UPA-2026-00008', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 500,  'Laxmi Karki',       'LIC-VWX-9012', 'settled', 'online',
    '{"violation": "No Seatbelt", "vehicle": "BA 8 PA 3456", "location": "Chabahil", "license": "VWX-9012"}',
    'n-00008', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 58 minutes'),

  ('UPA-2026-00009', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 2500, 'Rajesh Shrestha',   'LIC-YZA-3456', 'settled', 'online',
    '{"violation": "Hit and Run", "vehicle": "BA 9 CHA 7890", "location": "Baneshwor", "license": "YZA-3456"}',
    'n-00009', NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '1 hour 28 minutes'),

  ('UPA-2026-00010', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 500,  'Geeta Rana',        'LIC-BCD-7890', 'queued',  'offline',
    '{"violation": "Double Line Crossing", "vehicle": "BA 10 PA 1234", "location": "Satdobato", "license": "BCD-7890"}',
    'n-00010', NOW() - INTERVAL '1 hour', NULL),

  ('UPA-2026-00011', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 1000, 'Nabin Ghimire',     'LIC-EFG-1111', 'settled', 'online',
    '{"violation": "Using Phone While Driving", "vehicle": "BA 11 KHA 5555", "location": "Gongabu", "license": "EFG-1111"}',
    'n-00011', NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '48 minutes'),

  ('UPA-2026-00012', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 500,  'Sabina Limbu',      'LIC-HIJ-2222', 'settled', 'offline',
    '{"violation": "Red Zone Parking", "vehicle": "BA 12 PA 6666", "location": "Lazimpat", "license": "HIJ-2222"}',
    'n-00012', NOW() - INTERVAL '40 minutes', NOW() - INTERVAL '35 minutes'),

  ('UPA-2026-00013', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 5000, 'Prakash Bhandari',  'LIC-KLM-3333', 'settled', 'online',
    '{"violation": "No Insurance", "vehicle": "BA 13 CHA 7777", "location": "Thapathali", "license": "KLM-3333"}',
    'n-00013', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '28 minutes'),

  ('UPA-2026-00014', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 500,  'Durga Magar',       'LIC-NOP-4444', 'settled', 'online',
    '{"violation": "No Helmet (Pillion)", "vehicle": "BA 14 PA 8888", "location": "Pulchowk", "license": "NOP-4444"}',
    'n-00014', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '18 minutes'),

  ('UPA-2026-00015', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 1000, 'Binod Adhikari',    'LIC-QRS-5555', 'queued',  'offline',
    '{"violation": "Signal Jump", "vehicle": "BA 15 KHA 9999", "location": "Jawalakhel", "license": "QRS-5555"}',
    'n-00015', NOW() - INTERVAL '10 minutes', NULL);

-- ── License Fees (5 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00016', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 1000, 'Maya Tamang',    'APP-LIC-7890', 'settled', 'online',
    '{"licenseType": "Two Wheeler", "category": "Renewal"}',
    'n-00016', NOW() - INTERVAL '5 hours 45 minutes', NOW() - INTERVAL '5 hours 43 minutes'),

  ('UPA-2026-00017', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 1000, 'Sunil Basnet',   'APP-LIC-1122', 'settled', 'online',
    '{"licenseType": "Four Wheeler", "category": "New"}',
    'n-00017', NOW() - INTERVAL '4 hours 15 minutes', NOW() - INTERVAL '4 hours 13 minutes'),

  ('UPA-2026-00018', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 1000, 'Parbati Rai',    'APP-LIC-3344', 'settled', 'offline',
    '{"licenseType": "Two Wheeler", "category": "New"}',
    'n-00018', NOW() - INTERVAL '3 hours 15 minutes', NOW() - INTERVAL '3 hours 5 minutes'),

  ('UPA-2026-00019', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 1000, 'Bikram Thapa',   'APP-LIC-5566', 'queued',  'offline',
    '{"licenseType": "Heavy Vehicle", "category": "Renewal"}',
    'n-00019', NOW() - INTERVAL '2 hours 15 minutes', NULL),

  ('UPA-2026-00020', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 1000, 'Sanjay Gurung',  'APP-LIC-7788', 'settled', 'online',
    '{"licenseType": "Four Wheeler", "category": "Renewal"}',
    'n-00020', NOW() - INTERVAL '1 hour 15 minutes', NOW() - INTERVAL '1 hour 13 minutes');

-- ── Property Tax (10 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00021', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 15000, 'Hari Prasad',       'PROP-KTM-4421', 'settled', 'online',
    '{"ward": "7", "fiscalYear": "2082/83", "areaSqft": "2400", "lotNumber": "KTM-4421"}',
    'n-00021', NOW() - INTERVAL '6 hours 10 minutes', NOW() - INTERVAL '6 hours 8 minutes'),

  ('UPA-2026-00022', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 25000, 'Sarita Joshi',      'PROP-LAL-5532', 'settled', 'online',
    '{"ward": "12", "fiscalYear": "2082/83", "areaSqft": "3200", "lotNumber": "LAL-5532"}',
    'n-00022', NOW() - INTERVAL '5 hours 50 minutes', NOW() - INTERVAL '5 hours 48 minutes'),

  ('UPA-2026-00023', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 8000,  'Mohan Khadka',      'PROP-LAL-6643', 'settled', 'offline',
    '{"ward": "3", "fiscalYear": "2082/83", "areaSqft": "1500", "lotNumber": "LAL-6643"}',
    'n-00023', NOW() - INTERVAL '5 hours 20 minutes', NOW() - INTERVAL '5 hours 10 minutes'),

  ('UPA-2026-00024', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 45000, 'Deepak Pandey',     'PROP-LAL-7754', 'settled', 'online',
    '{"ward": "15", "fiscalYear": "2082/83", "areaSqft": "5000", "lotNumber": "LAL-7754"}',
    'n-00024', NOW() - INTERVAL '4 hours 50 minutes', NOW() - INTERVAL '4 hours 48 minutes'),

  ('UPA-2026-00025', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 12000, 'Sunita Acharya',    'PROP-LAL-8865', 'queued',  'offline',
    '{"ward": "9", "fiscalYear": "2082/83", "areaSqft": "2000", "lotNumber": "LAL-8865"}',
    'n-00025', NOW() - INTERVAL '4 hours 20 minutes', NULL),

  ('UPA-2026-00026', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 18000, 'Rajan Manandhar',   'PROP-LAL-9976', 'settled', 'online',
    '{"ward": "11", "fiscalYear": "2082/83", "areaSqft": "2800", "lotNumber": "LAL-9976"}',
    'n-00026', NOW() - INTERVAL '3 hours 50 minutes', NOW() - INTERVAL '3 hours 48 minutes'),

  ('UPA-2026-00027', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 32000, 'Nirmala Shakya',    'PROP-LAL-1087', 'settled', 'offline',
    '{"ward": "6", "fiscalYear": "2082/83", "areaSqft": "4000", "lotNumber": "LAL-1087"}',
    'n-00027', NOW() - INTERVAL '3 hours 20 minutes', NOW() - INTERVAL '3 hours 10 minutes'),

  ('UPA-2026-00028', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 9500,  'Bijay Lama',        'PROP-LAL-2198', 'settled', 'online',
    '{"ward": "2", "fiscalYear": "2082/83", "areaSqft": "1800", "lotNumber": "LAL-2198"}',
    'n-00028', NOW() - INTERVAL '2 hours 50 minutes', NOW() - INTERVAL '2 hours 48 minutes'),

  ('UPA-2026-00029', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 22000, 'Mina Shrestha',     'PROP-LAL-3309', 'queued',  'offline',
    '{"ward": "8", "fiscalYear": "2082/83", "areaSqft": "3500", "lotNumber": "LAL-3309"}',
    'n-00029', NOW() - INTERVAL '2 hours 20 minutes', NULL),

  ('UPA-2026-00030', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 14000, 'Gopal Bhattarai',   'PROP-LAL-4410', 'settled', 'online',
    '{"ward": "14", "fiscalYear": "2082/83", "areaSqft": "2200", "lotNumber": "LAL-4410"}',
    'n-00030', NOW() - INTERVAL '1 hour 50 minutes', NOW() - INTERVAL '1 hour 48 minutes');

-- ── Business Registration (3 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00031', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 5000, 'Krishna Maharjan', 'BIZ-REG-001', 'settled', 'online',
    '{"businessName": "Himalayan Cafe", "businessType": "Restaurant", "ward": "5"}',
    'n-00031', NOW() - INTERVAL '5 hours 10 minutes', NOW() - INTERVAL '5 hours 8 minutes'),

  ('UPA-2026-00032', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 5000, 'Priya Shrestha',  'BIZ-REG-002', 'settled', 'online',
    '{"businessName": "Digital Nepal IT", "businessType": "Technology", "ward": "12"}',
    'n-00032', NOW() - INTERVAL '3 hours 40 minutes', NOW() - INTERVAL '3 hours 38 minutes'),

  ('UPA-2026-00033', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 5000, 'Arjun Tamang',    'BIZ-REG-003', 'queued',  'offline',
    '{"businessName": "Everest Trekking", "businessType": "Tourism", "ward": "7"}',
    'n-00033', NOW() - INTERVAL '1 hour 40 minutes', NULL);

-- ── Tuition Fees (8 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00034', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 25000, 'Anish Gurung',     'STU-TU-2024-4456', 'settled', 'online',
    '{"program": "BCA", "semester": "4th", "studentId": "TU-2024-4456"}',
    'n-00034', NOW() - INTERVAL '6 hours 5 minutes', NOW() - INTERVAL '6 hours 3 minutes'),

  ('UPA-2026-00035', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 35000, 'Sapana Rai',       'STU-TU-2023-5567', 'settled', 'online',
    '{"program": "BBA", "semester": "6th", "studentId": "TU-2023-5567"}',
    'n-00035', NOW() - INTERVAL '5 hours 35 minutes', NOW() - INTERVAL '5 hours 33 minutes'),

  ('UPA-2026-00036', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 28000, 'Roshan Poudel',    'STU-TU-2024-6678', 'settled', 'offline',
    '{"program": "BSc CSIT", "semester": "3rd", "studentId": "TU-2024-6678"}',
    'n-00036', NOW() - INTERVAL '4 hours 45 minutes', NOW() - INTERVAL '4 hours 35 minutes'),

  ('UPA-2026-00037', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 20000, 'Asmita Thapa',     'STU-TU-2025-7789', 'queued',  'offline',
    '{"program": "BCA", "semester": "2nd", "studentId": "TU-2025-7789"}',
    'n-00037', NOW() - INTERVAL '4 hours 5 minutes', NULL),

  ('UPA-2026-00038', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 45000, 'Manish KC',        'STU-TU-2022-8890', 'settled', 'online',
    '{"program": "MBA", "semester": "2nd", "studentId": "TU-2022-8890"}',
    'n-00038', NOW() - INTERVAL '3 hours 5 minutes', NOW() - INTERVAL '3 hours 3 minutes'),

  ('UPA-2026-00039', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 22000, 'Pooja Dhakal',     'STU-TU-2024-9901', 'settled', 'online',
    '{"program": "BIT", "semester": "5th", "studentId": "TU-2024-9901"}',
    'n-00039', NOW() - INTERVAL '2 hours 5 minutes', NOW() - INTERVAL '2 hours 3 minutes'),

  ('UPA-2026-00040', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 30000, 'Suman Adhikari',   'STU-TU-2023-1012', 'settled', 'offline',
    '{"program": "BE Civil", "semester": "7th", "studentId": "TU-2023-1012"}',
    'n-00040', NOW() - INTERVAL '1 hour 5 minutes', NOW() - INTERVAL '55 minutes'),

  ('UPA-2026-00041', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 25000, 'Kiran Bista',      'STU-TU-2024-2123', 'settled', 'online',
    '{"program": "BSc CSIT", "semester": "5th", "studentId": "TU-2024-2123"}',
    'n-00041', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '43 minutes');

-- ── Exam Fees (5 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00042', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000006', 2500, 'Anish Gurung',   'STU-TU-2024-4456', 'settled', 'online',
    '{"program": "BCA", "semester": "4th", "studentId": "TU-2024-4456"}',
    'n-00042', NOW() - INTERVAL '5 hours 55 minutes', NOW() - INTERVAL '5 hours 53 minutes'),

  ('UPA-2026-00043', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000006', 2500, 'Sapana Rai',     'STU-TU-2023-5567', 'settled', 'online',
    '{"program": "BBA", "semester": "6th", "studentId": "TU-2023-5567"}',
    'n-00043', NOW() - INTERVAL '5 hours 25 minutes', NOW() - INTERVAL '5 hours 23 minutes'),

  ('UPA-2026-00044', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000006', 2500, 'Roshan Poudel',  'STU-TU-2024-6678', 'queued',  'offline',
    '{"program": "BSc CSIT", "semester": "3rd", "studentId": "TU-2024-6678"}',
    'n-00044', NOW() - INTERVAL '4 hours 35 minutes', NULL),

  ('UPA-2026-00045', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000006', 2500, 'Pooja Dhakal',   'STU-TU-2024-9901', 'settled', 'online',
    '{"program": "BIT", "semester": "5th", "studentId": "TU-2024-9901"}',
    'n-00045', NOW() - INTERVAL '1 hour 55 minutes', NOW() - INTERVAL '1 hour 53 minutes'),

  ('UPA-2026-00046', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000006', 2500, 'Kiran Bista',    'STU-TU-2024-2123', 'settled', 'online',
    '{"program": "BSc CSIT", "semester": "5th", "studentId": "TU-2024-2123"}',
    'n-00046', NOW() - INTERVAL '35 minutes', NOW() - INTERVAL '33 minutes');

-- ── Birth Certificate Fees (3 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00047', 'a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000007', 200, 'Ramesh Khadka',   'BC-W5-001', 'settled', 'online',
    '{"childName": "Aarav Khadka", "dob": "2082-05-15", "parentName": "Ramesh Khadka"}',
    'n-00047', NOW() - INTERVAL '5 hours 40 minutes', NOW() - INTERVAL '5 hours 38 minutes'),

  ('UPA-2026-00048', 'a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000007', 200, 'Sushma Ghimire',  'BC-W5-002', 'settled', 'offline',
    '{"childName": "Riya Ghimire", "dob": "2082-08-22", "parentName": "Sushma Ghimire"}',
    'n-00048', NOW() - INTERVAL '3 hours 40 minutes', NOW() - INTERVAL '3 hours 30 minutes'),

  ('UPA-2026-00049', 'a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000007', 200, 'Dil Bahadur',     'BC-W5-003', 'settled', 'online',
    '{"childName": "Nischal Tamang", "dob": "2082-11-03", "parentName": "Dil Bahadur Tamang"}',
    'n-00049', NOW() - INTERVAL '1 hour 40 minutes', NOW() - INTERVAL '1 hour 38 minutes');

-- ── Recommendation Letters (2 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00050', 'a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000008', 500, 'Anup Shrestha',    'REC-W5-001', 'settled', 'online',
    '{"purpose": "Foreign Employment", "documentType": "Character Certificate"}',
    'n-00050', NOW() - INTERVAL '4 hours 40 minutes', NOW() - INTERVAL '4 hours 38 minutes'),

  ('UPA-2026-00051', 'a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000008', 500, 'Kabita Bhandari',  'REC-W5-002', 'queued',  'offline',
    '{"purpose": "Bank Loan", "documentType": "Recommendation Letter"}',
    'n-00051', NOW() - INTERVAL '2 hours 40 minutes', NULL);

-- ── Vehicle Registration (3 transactions) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00052', 'a1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000009', 25000, 'Bikash Tamang',  'VEH-REG-001', 'settled', 'online',
    '{"vehicleType": "Motorcycle", "manufacturer": "Yamaha", "model": "FZ-S V3"}',
    'n-00052', NOW() - INTERVAL '5 hours 15 minutes', NOW() - INTERVAL '5 hours 13 minutes'),

  ('UPA-2026-00053', 'a1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000009', 45000, 'Shanti Devi',    'VEH-REG-002', 'settled', 'online',
    '{"vehicleType": "Car", "manufacturer": "Hyundai", "model": "i20"}',
    'n-00053', NOW() - INTERVAL '3 hours 10 minutes', NOW() - INTERVAL '3 hours 8 minutes'),

  ('UPA-2026-00054', 'a1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000009', 15000, 'Naresh Gurung',  'VEH-REG-003', 'queued',  'offline',
    '{"vehicleType": "Scooter", "manufacturer": "Honda", "model": "Dio"}',
    'n-00054', NOW() - INTERVAL '1 hour 10 minutes', NULL);

-- ── Route Permit (1 transaction) ──
INSERT INTO transactions (tx_id, upa_id, intent_id, amount, payer_name, payer_id, status, mode, metadata, nonce, issued_at, settled_at) VALUES
  ('UPA-2026-00055', 'a1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000010', 15000, 'Sajha Yatayat',  'RP-SAJHA-001', 'settled', 'online',
    '{"route": "Kathmandu - Bhaktapur", "vehicleNumber": "BA 1 KHA 1234", "permitDuration": "1 Year"}',
    'n-00055', NOW() - INTERVAL '2 hours 10 minutes', NOW() - INTERVAL '2 hours 8 minutes');
