// ============================================
// TRADEPHEX — Supabase Client
// src/lib/supabase.js
// ============================================

const SUPABASE_URL = window.__env?.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.__env?.SUPABASE_ANON_KEY || '';

// Load Supabase from CDN (add to your HTML head):
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

let supabase;

function getSupabase() {
  if (!supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

// ── AUTH ──

async function signUp(email, password, fullName) {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });
  return { data, error };
}

async function signIn(email, password) {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
}

async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  return { error };
}

async function getUser() {
  const { data: { user } } = await getSupabase().auth.getUser();
  return user;
}

async function getSession() {
  const { data: { session } } = await getSupabase().auth.getSession();
  return session;
}

// ── TRADES ──

async function getTrades(userId, options = {}) {
  let query = getSupabase()
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('entry_time', { ascending: false });

  if (options.symbol) query = query.eq('symbol', options.symbol);
  if (options.side) query = query.eq('side', options.side);
  if (options.status) query = query.eq('status', options.status);
  if (options.limit) query = query.limit(options.limit);
  if (options.dateFrom) query = query.gte('entry_time', options.dateFrom);
  if (options.dateTo) query = query.lte('entry_time', options.dateTo);

  const { data, error } = await query;
  return { data, error };
}

async function addTrade(userId, trade) {
  const { data, error } = await getSupabase()
    .from('trades')
    .insert({
      user_id: userId,
      symbol: trade.symbol,
      side: trade.side,
      entry_price: trade.entry,
      exit_price: trade.exit,
      contracts: trade.contracts,
      pnl: trade.pnl,
      r_multiple: trade.r,
      stop_loss: trade.stopLoss,
      take_profit: trade.takeProfit,
      entry_time: trade.entryTime || new Date().toISOString(),
      exit_time: trade.exitTime,
      duration_minutes: trade.durationMinutes,
      status: trade.exit ? 'closed' : 'open',
      setup_notes: trade.notes,
      execution_quality: trade.quality,
      emotional_state: trade.emotion,
    })
    .select()
    .single();
  return { data, error };
}

async function updateTrade(tradeId, updates) {
  const { data, error } = await getSupabase()
    .from('trades')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', tradeId)
    .select()
    .single();
  return { data, error };
}

async function deleteTrade(tradeId) {
  const { error } = await getSupabase()
    .from('trades')
    .delete()
    .eq('id', tradeId);
  return { error };
}

// ── TRADE REVIEWS ──

async function saveTradeReview(tradeId, userId, review) {
  const { data, error } = await getSupabase()
    .from('trade_reviews')
    .upsert({
      trade_id: tradeId,
      user_id: userId,
      went_right: review.wentRight,
      went_wrong: review.wentWrong,
      do_differently: review.doDifferently,
      overall_grade: review.grade,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  return { data, error };
}

// ── STATS ──

async function getUserStats(userId) {
  const { data, error } = await getSupabase()
    .from('user_trade_stats')
    .select('*')
    .eq('user_id', userId)
    .single();
  return { data, error };
}

async function getDailyPnl(userId, days = 30) {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  const { data, error } = await getSupabase()
    .from('trades')
    .select('entry_time, pnl')
    .eq('user_id', userId)
    .eq('status', 'closed')
    .gte('entry_time', dateFrom.toISOString())
    .order('entry_time', { ascending: true });

  return { data, error };
}

// ── PROFILE ──

async function getProfile(userId) {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
}

async function updateProfile(userId, updates) {
  const { data, error } = await getSupabase()
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
}

// Export
window.tradephexDB = {
  signUp, signIn, signOut, getUser, getSession,
  getTrades, addTrade, updateTrade, deleteTrade,
  saveTradeReview, getUserStats, getDailyPnl,
  getProfile, updateProfile
};
