-- Read-only post-application assertions; run against staging FIRST.
-- Raises an error if any critical permission/security property is missing.
DO $tests$
DECLARE
  p text;
BEGIN
  FOREACH p IN ARRAY ARRAY['profiles','evaluations','payout_requests','leaderboard']
  LOOP
    IF has_table_privilege('anon', 'public.'||p, 'TRUNCATE')
       OR has_table_privilege('authenticated', 'public.'||p, 'TRUNCATE')
    THEN RAISE EXCEPTION 'Unsafe TRUNCATE grant: %',p; END IF;
  END LOOP;
  IF has_table_privilege('authenticated','public.evaluations','INSERT')
   OR has_table_privilege('authenticated','public.evaluations','UPDATE')
   OR has_table_privilege('authenticated','public.payout_requests','INSERT')
   OR has_table_privilege('authenticated','public.leaderboard','UPDATE')
   OR has_table_privilege('authenticated','public.leaderboard','INSERT')
  THEN RAISE EXCEPTION 'An authenticated user can write protected financial records'; END IF;
  IF has_column_privilege('authenticated','public.profiles','plan','UPDATE')
   OR has_column_privilege('authenticated','public.profiles','account_size','UPDATE')
  THEN RAISE EXCEPTION 'Profile membership/size still writable by end users'; END IF;
  IF NOT has_column_privilege('authenticated','public.profiles','full_name','UPDATE')
    OR NOT has_table_privilege('authenticated','public.trades','INSERT')
    OR NOT has_table_privilege('authenticated','public.evaluations','SELECT')
  THEN RAISE EXCEPTION 'Expected normal user functionality is missing'; END IF;
  IF has_function_privilege('anon','public.handle_stripe_webhook(text,text,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.handle_stripe_webhook(text,text,text)','EXECUTE')
  THEN RAISE EXCEPTION 'Untrusted role can invoke privileged Stripe function'; END IF;
  IF NOT EXISTS (
     SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='user_trade_stats'
       AND 'security_invoker=true'=ANY(coalesce(c.reloptions,ARRAY[]::text[]))
  ) THEN RAISE EXCEPTION 'Trade stats view must use caller RLS'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
     WHERE schemaname='public' AND tablename='evaluations'
       AND indexname='evaluations_stripe_session_unique')
  THEN RAISE EXCEPTION 'Unique Stripe session index missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='evaluations' AND column_name='phase')
  THEN RAISE EXCEPTION 'Phase column missing'; END IF;
  RAISE NOTICE 'Tradephex key financial permission assertions passed';
END;
$tests$;
