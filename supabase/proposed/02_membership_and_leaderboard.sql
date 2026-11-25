-- Tradephex proposed staging patch 2: profile, journal, and leaderboard. NOT DEPLOYED.
BEGIN;
-- Users may read their own profile, and edit only nonfinancial fields.
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, username, avatar_url, primary_symbol, timezone) ON public.profiles TO authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Customers read own profile" ON public.profiles FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
CREATE POLICY "Customers edit own profile" ON public.profiles FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);
-- Preserve journal CRUD but do not permit direct manipulation of official evaluations.
REVOKE ALL PRIVILEGES ON TABLE public.trades FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
-- Only trusted backend code can publish account performance/rankings.
REVOKE ALL PRIVILEGES ON TABLE public.leaderboard FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.leaderboard TO anon, authenticated;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own leaderboard" ON public.leaderboard;
DROP POLICY IF EXISTS "Users can update own leaderboard" ON public.leaderboard;
DROP POLICY IF EXISTS "Anyone can read leaderboard" ON public.leaderboard;
CREATE POLICY "Read opted-in leaderboard" ON public.leaderboard FOR SELECT TO anon, authenticated USING (show_on_board IS TRUE);
REVOKE ALL PRIVILEGES ON TABLE public.referrals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.referrals TO authenticated;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
COMMIT;
