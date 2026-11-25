// Deterministic, closed-trade accounting core for a future server-side evaluation engine.
// INPUT CONTRACT: trades MUST be sourced from server-verified executions, never
// user-editable journals, browser-supplied P&L, or client-side simulated fills.
// This module does not grant account status, update Supabase, or issue payouts.
// It cannot evaluate open-position drawdown, exchange holidays, or live risk.
const etClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});

function positiveSafeInteger(n, field) {
  if (!Number.isSafeInteger(n) || n <= 0) throw new TypeError(field + ' must be a positive safe integer');
  return n;
}

export function tradingSessionKey(isoTime) {
  if (typeof isoTime !== 'string' || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(isoTime)) {
    throw new TypeError('closedAt must be a timezone-qualified ISO string');
  }
  const date = new Date(isoTime);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid closedAt');
  const parts = Object.fromEntries(etClock.formatToParts(date).map(p => [p.type, p.value]));
  const day = new Date(Date.UTC(
    Number(parts.year), Number(parts.month) - 1,
    Number(parts.day) + (Number(parts.hour) >= 18 ? 1 : 0)
  ));
  return day.toISOString().slice(0, 10);
}

export function evaluateClosedTradeLedger({ startingBalanceCents, trades, rules }) {
  positiveSafeInteger(startingBalanceCents, 'startingBalanceCents');
  if (!Array.isArray(trades)) throw new TypeError('trades must be an array');
  if (!rules || typeof rules !== 'object') throw new TypeError('rules are required');
  const profitTargetCents = positiveSafeInteger(rules.profitTargetCents, 'profitTargetCents');
  const maxDrawdownCents = positiveSafeInteger(rules.maxDrawdownCents, 'maxDrawdownCents');
  const dailyLossCents = positiveSafeInteger(rules.dailyLossCents, 'dailyLossCents');
  const minTradingDays = positiveSafeInteger(rules.minTradingDays, 'minTradingDays');
  const consistencyPct = rules.consistencyPct;
  if (consistencyPct != null && (
    typeof consistencyPct !== 'number' || !Number.isFinite(consistencyPct) ||
    consistencyPct <= 0 || consistencyPct > 100
  )) throw new TypeError('consistencyPct must be between 0 and 100');

  let balanceCents = startingBalanceCents;
  let peakBalanceCents = startingBalanceCents;
  let maxDrawdownObservedCents = 0;
  let largestDailyLossObservedCents = 0;
  const dailyTotals = new Map();
  const seenIds = new Set();
  let prevTimestamp = -Infinity;
  let failure = null;

  for (const trade of trades) {
    if (!trade || typeof trade !== 'object' || typeof trade.id !== 'string' || !trade.id.trim()) {
      throw new TypeError('Every verified trade must have an ID');
    }
    if (seenIds.has(trade.id)) throw new TypeError('Duplicate trade ID');
    seenIds.add(trade.id);
    if (!Number.isSafeInteger(trade.netPnlCents)) {
      throw new TypeError('netPnlCents must be a safe integer, with fees included');
    }
    const stamp = Date.parse(trade.closedAt);
    const day = tradingSessionKey(trade.closedAt);
    if (stamp < prevTimestamp) throw new TypeError('Trades must be sorted by closedAt');
    prevTimestamp = stamp;
    const dailyPnlCents = (dailyTotals.get(day) || 0) + trade.netPnlCents;
    if (!Number.isSafeInteger(dailyPnlCents)) throw new RangeError('Daily P&L overflow');
    dailyTotals.set(day, dailyPnlCents);

    balanceCents += trade.netPnlCents;
    if (!Number.isSafeInteger(balanceCents)) throw new RangeError('Balance overflow');
    peakBalanceCents = Math.max(peakBalanceCents, balanceCents);
    maxDrawdownObservedCents = Math.max(maxDrawdownObservedCents, peakBalanceCents - balanceCents);
    largestDailyLossObservedCents = Math.max(largestDailyLossObservedCents, -dailyPnlCents);
    if (!failure && maxDrawdownObservedCents >= maxDrawdownCents) failure = 'max_drawdown';
    if (!failure && largestDailyLossObservedCents >= dailyLossCents) failure = 'daily_loss';
  }

  const netPnlCents = balanceCents - startingBalanceCents;
  const highestProfitableDayCents = Math.max(0, ...dailyTotals.values());
  const consistencySharePct = netPnlCents > 0 ? 100 * highestProfitableDayCents / netPnlCents : null;
  const hasConsistency = consistencyPct == null || (
    consistencySharePct != null && consistencySharePct <= consistencyPct + 1e-9
  );
  const status = failure ? 'failed' : (
    netPnlCents >= profitTargetCents &&
    dailyTotals.size >= minTradingDays &&
    hasConsistency ? 'target_met' : 'in_progress'
  );

  return {
    status, failure,
    balanceCents, netPnlCents, peakBalanceCents,
    maxDrawdownObservedCents, largestDailyLossObservedCents,
    tradingDays: dailyTotals.size,
    highestProfitableDayCents,
    consistencySharePct,
    dailyPnl: Array.from(dailyTotals, ([date, pnlCents]) => ({ date, pnlCents })),
    // target_met does not change the account state: a trusted server must reconcile
    // fills/positions, open-equity risk, and database rules before granting an entitlement.
  };
}
