-- TRADEPHEX READ-ONLY SUPABASE SECURITY INVENTORY
-- Run in the Supabase SQL editor for your own review.
-- These queries do not alter tables, policies, or customer records.
-- Share only the resulting schema/policy metadata, never credentials or trader data.

-- Row-level security status for critical tables.
SELECT schemaname, tablename, rowsecurity
FROM pg_catalog.pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles','evaluations','trades','payout_requests','trade_reviews','sessions')
ORDER BY tablename;

-- Existing row-level security policies.
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual AS using_expression, with_check AS insert_or_update_check
FROM pg_catalog.pg_policies
WHERE schemaname='public'
  AND tablename IN ('profiles','evaluations','trades','payout_requests','trade_reviews','sessions')
ORDER BY tablename, policyname;

-- Grants to anonymous and authenticated Supabase API roles.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('profiles','evaluations','trades','payout_requests','trade_reviews','sessions')
  AND grantee IN ('anon','authenticated','service_role')
ORDER BY table_name, grantee, privilege_type;

-- Column names and types only (no customer rows).
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('profiles','evaluations','trades','payout_requests','trade_reviews','sessions')
ORDER BY table_name, ordinal_position;

-- Indexes relevant to webhook idempotency.
SELECT tablename, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname='public' AND tablename IN ('evaluations','payout_requests')
ORDER BY tablename,indexname;
