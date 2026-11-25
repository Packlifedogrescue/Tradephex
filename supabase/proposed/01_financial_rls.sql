-- Tradephex proposed staging patch 1: financial RLS. NOT DEPLOYED.
BEGIN;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.evaluations, public.payout_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.evaluations, public.payout_requests TO authenticated;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own evals" ON public.evaluations;
DROP POLICY IF EXISTS "Users can insert own evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Users can update own evals" ON public.evaluations;
DROP POLICY IF EXISTS "Users can update own evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Users can read own evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Users can view own evals" ON public.evaluations;
CREATE POLICY "Customers read own evaluations" ON public.evaluations FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert own payouts" ON public.payout_requests;
DROP POLICY IF EXISTS "Users can view own payouts" ON public.payout_requests;
CREATE POLICY "Customers read own payouts" ON public.payout_requests FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
COMMIT;
