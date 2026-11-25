-- Runs ONLY against the disposable GitHub Actions PostgreSQL database.
-- Test actual RLS visibility and safe column update behavior as a signed-in user.

GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('00000000-0000-4000-8000-000000000002','second-ci@example.com','{"full_name":"Second Trader"}'::jsonb);

INSERT INTO public.evaluations (id,user_id,account_size,stripe_session_id)
VALUES
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',50000,'test_session_1'),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',50000,'test_session_2');
INSERT INTO public.payout_requests(id,user_id,amount_requested)
VALUES
 ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',1),
 ('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',1);
INSERT INTO public.leaderboard(id,user_id,show_on_board)
VALUES
 ('30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',true),
 ('30000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',false);

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $verify$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.evaluations;
  IF n <> 1 THEN RAISE EXCEPTION 'RLS evaluation isolation failed: %', n; END IF;
  SELECT count(*) INTO n FROM public.payout_requests;
  IF n <> 1 THEN RAISE EXCEPTION 'RLS payout isolation failed: %', n; END IF;
  SELECT count(*) INTO n FROM public.profiles;
  IF n <> 1 THEN RAISE EXCEPTION 'RLS profile isolation failed: %', n; END IF;
  SELECT count(*) INTO n FROM public.leaderboard;
  IF n <> 1 THEN RAISE EXCEPTION 'RLS leaderboard opt-out failed: %', n; END IF;
END;
$verify$;

-- Editable public profile fields still work, and cannot edit another person's.
UPDATE public.profiles SET full_name='First Trader Updated'
WHERE id='00000000-0000-4000-8000-000000000001';
DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id='00000000-0000-4000-8000-000000000001'
      AND full_name='First Trader Updated'
  ) THEN RAISE EXCEPTION 'Own profile update failed'; END IF;
END;
$verify$;

-- An unauthorized attempt to modify official evaluation must be rejected.
DO $verify$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    UPDATE public.evaluations SET status='passed'
      WHERE id='10000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN insufficient_privilege THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Users can still update evaluations'; END IF;
END;
$verify$;

-- Paid plan must never be editable by an ordinary authenticated user.
DO $verify$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    UPDATE public.profiles SET plan='elite'
      WHERE id='00000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN insufficient_privilege THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Users can still elevate membership'; END IF;
END;
$verify$;

RESET ROLE;
RESET request.jwt.claim.sub;

DO $verify$
BEGIN
  IF (SELECT plan FROM public.profiles WHERE id='00000000-0000-4000-8000-000000000001') = 'elite'
  THEN RAISE EXCEPTION 'Privileged plan was modified'; END IF;
END;
$verify$;
