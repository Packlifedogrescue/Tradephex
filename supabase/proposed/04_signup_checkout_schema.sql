-- Proposed staging-only schema compatibility patch; NOT APPLIED to Supabase.
BEGIN;
ALTER TABLE public.evaluations
 ADD COLUMN IF NOT EXISTS phase integer NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS net_pnl numeric NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS trading_days integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS drawdown_observed numeric NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS evaluations_stripe_session_unique
 ON public.evaluations (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
 IF NEW.email IS NULL THEN RETURN NEW; END IF;
 INSERT INTO public.profiles (id, email, full_name)
 VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name',''))
 ON CONFLICT (id) DO NOTHING;
 RETURN NEW;
END;
$func$;
COMMIT;
