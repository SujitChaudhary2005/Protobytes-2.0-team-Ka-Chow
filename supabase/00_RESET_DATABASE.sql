-- ============================================
-- UPA-NP — DATABASE RESET SCRIPT
-- WARNING: This will DELETE ALL DATA
-- Use this to start fresh before running seed_all.sql
-- ============================================

-- Drop all tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS public.sync_queue CASCADE;
DROP TABLE IF EXISTS public.offline_wallet_ledger CASCADE;
DROP TABLE IF EXISTS public.offline_limits CASCADE;
DROP TABLE IF EXISTS public.bank_accounts CASCADE;
DROP TABLE IF EXISTS public.nid_cards CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.intents CASCADE;
DROP TABLE IF EXISTS public.officer_state CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.upas CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS upa_id_for(TEXT) CASCADE;
DROP FUNCTION IF EXISTS intent_id_for(TEXT) CASCADE;
DROP FUNCTION IF EXISTS nid_id_for(TEXT) CASCADE;

-- Now you can run your schema files in order:
-- 1. 00_COMPLETE_SCHEMA.sql (or 01_schema.sql + 04_extended_schema.sql)
-- 2. seed_all.sql
