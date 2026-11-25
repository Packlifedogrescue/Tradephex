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

-- Sensitive profile fields: are any client roles allowed to change plan or account size?
SELECT table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND grantee IN ('anon','authenticated')
  AND privilege_type IN ('UPDATE','INSERT')
ORDER BY column_name, grantee;

-- Find public views and their security_invoker settings (view-owner queries may bypass RLS).
SELECT c.relname AS view_name,
       pg_get_userbyid(c.relowner) AS view_owner,
       c.reloptions AS view_options,
       pg_get_viewdef(c.oid, true) IS NOT NULL AS has_definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
ORDER BY c.relname;

-- Identify any SQL functions marked SECURITY DEFINER in public (metadata only).
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS function_owner,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
ORDER BY p.proname;
