-- ============================================
-- TRADEPHEX DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── PROFILES ──
-- Extends Supabase auth.users
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  account_size DECIMAL(12,2) DEFAULT 10000,
  primary_symbol TEXT DEFAULT 'ES',
  timezone TEXT DEFAULT 'America/New_York',
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter','professional','elite')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── TRADES ──
CREATE TABLE trades (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('Long','Short')),
  entry_price DECIMAL(12,4) NOT NULL,
  exit_price DECIMAL(12,4),
  contracts INTEGER NOT NULL DEFAULT 1,
  pnl DECIMAL(12,2),
  r_multiple DECIMAL(6,2),
  stop_loss DECIMAL(12,4),
  take_profit DECIMAL(12,4),
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
  setup_notes TEXT,
  execution_quality INTEGER CHECK (execution_quality BETWEEN 1 AND 5),
  emotional_state TEXT CHECK (emotional_state IN ('calm','confident','anxious','fomo','revenge','neutral')),
  tags TEXT[],
  screenshot_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRADE REVIEWS ──
CREATE TABLE trade_reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  went_right TEXT,
  went_wrong TEXT,
  do_differently TEXT,
  overall_grade INTEGER CHECK (overall_grade BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── DAILY SESSIONS ──
CREATE TABLE sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  session_date DATE NOT NULL,
  gross_pnl DECIMAL(12,2) DEFAULT 0,
  net_pnl DECIMAL(12,2) DEFAULT 0,
  trade_count INTEGER DEFAULT 0,
  win_count INTEGER DEFAULT 0,
  loss_count INTEGER DEFAULT 0,
  max_drawdown DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  mental_state INTEGER CHECK (mental_state BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_date)
);

-- ── WATCHLIST ──
CREATE TABLE watchlist (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

-- ── INDEXES ──
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_entry_time ON trades(entry_time DESC);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_sessions_user_date ON sessions(user_id, session_date DESC);

-- ── ROW LEVEL SECURITY ──
-- Users can only see their own data

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Trades policies
CREATE POLICY "Users can view own trades"
  ON trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades"
  ON trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trades"
  ON trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades"
  ON trades FOR DELETE USING (auth.uid() = user_id);

-- Trade reviews policies
CREATE POLICY "Users can view own reviews"
  ON trade_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reviews"
  ON trade_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews"
  ON trade_reviews FOR UPDATE USING (auth.uid() = user_id);

-- Sessions policies
CREATE POLICY "Users can view own sessions"
  ON sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions"
  ON sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions"
  ON sessions FOR UPDATE USING (auth.uid() = user_id);

-- Watchlist policies
CREATE POLICY "Users can manage own watchlist"
  ON watchlist FOR ALL USING (auth.uid() = user_id);

-- ── HELPER VIEWS ──

-- Trade stats per user
CREATE VIEW user_trade_stats AS
SELECT
  user_id,
  COUNT(*) as total_trades,
  COUNT(*) FILTER (WHERE pnl > 0) as wins,
  COUNT(*) FILTER (WHERE pnl < 0) as losses,
  ROUND(COUNT(*) FILTER (WHERE pnl > 0)::DECIMAL / NULLIF(COUNT(*),0) * 100, 1) as win_rate,
  SUM(pnl) as net_pnl,
  AVG(pnl) FILTER (WHERE pnl > 0) as avg_win,
  AVG(pnl) FILTER (WHERE pnl < 0) as avg_loss,
  ROUND(ABS(AVG(pnl) FILTER (WHERE pnl > 0) / NULLIF(AVG(pnl) FILTER (WHERE pnl < 0),0)), 2) as profit_factor,
  AVG(execution_quality) as avg_quality
FROM trades
WHERE status = 'closed'
GROUP BY user_id;

-- ============================================
-- DONE. Your Tradephex database is ready.
-- ============================================
