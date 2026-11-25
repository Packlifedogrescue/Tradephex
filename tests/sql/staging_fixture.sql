-- Disposable CI-only PostgreSQL fixture. Never run on production.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,email text NOT NULL,full_name text,username text,avatar_url text,primary_symbol text,timezone text,plan text,account_size numeric);
CREATE TABLE public.trades(id uuid PRIMARY KEY,user_id uuid,pnl numeric,status text);
CREATE TABLE public.evaluations(id uuid PRIMARY KEY,user_id uuid,account_size numeric,profit_target numeric,max_drawdown numeric,daily_drawdown numeric,status text,max_dd_limit numeric,daily_loss_limit numeric,stripe_session_id text);
CREATE TABLE public.payout_requests(id uuid PRIMARY KEY,user_id uuid,amount_requested numeric);
CREATE TABLE public.leaderboard(id uuid PRIMARY KEY,user_id uuid,show_on_board boolean);
CREATE TABLE public.referrals(id uuid PRIMARY KEY,referrer_id uuid);
CREATE TABLE public.email_log(id uuid PRIMARY KEY,to_email text);
CREATE VIEW public.user_trade_stats AS SELECT user_id,count(*) AS total_trades FROM public.trades GROUP BY user_id;
