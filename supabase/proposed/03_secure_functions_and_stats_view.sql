-- Tradephex proposed staging patch 3: privileged functions and view. NOT DEPLOYED.
BEGIN;
ALTER VIEW public.user_trade_stats SET (security_invoker = true);
REVOKE ALL PRIVILEGES ON TABLE public.user_trade_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_trade_stats TO authenticated;
-- The existing Stripe RPC accepts a caller-supplied email and plan. End users
-- must not invoke it (only verified server handlers may grant paid access).
REVOKE ALL ON FUNCTION public.handle_stripe_webhook(text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_payout() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_leaderboard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_stripe_webhook(text,text,text),
  public.handle_new_user(), public.notify_new_payout(),
  public.sync_leaderboard() TO service_role;
-- Qualify the effective namespace; 01 removed CREATE access to public.
ALTER FUNCTION public.handle_stripe_webhook(text,text,text) SET search_path = public;
ALTER FUNCTION public.notify_new_payout() SET search_path = public;
ALTER FUNCTION public.sync_leaderboard() SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = pg_catalog;
-- This legacy trigger currently publishes invented win rate/profit factor.
-- No official rankings until verified server-side fills are available.
DROP TRIGGER IF EXISTS sync_leaderboard_on_eval_update ON public.evaluations;
COMMIT;
