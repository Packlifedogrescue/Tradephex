# Tradephex trading-chart reliability — draft, 2026-11-25

## Implemented on draft PR #4 (NOT released to production)

- A single `TradephexChartRisk.validateFill` check applies to market/limit fills, scale-in, reversals and trade ideas. Whole quantities, tick sizes, the *resulting* position cap, daily lockouts, manual timed locks, and prior demo failure are checked.
- Reductions and flattening remain possible during lockouts. Pending entries are not allowed during locks, and existing working orders are canceled on a risk-breach close.
- Instrument switching is blocked while a position or limit order remains open. This avoids calculating a prior symbol's P&L using a new instrument's contract multiplier.
- Bracket SL/TP checks use the current simulated tick, not earlier extrema of the bar before the bracket was placed. Stops fill at the current tick (simulated adverse slippage).
- Trailing drawdown uses the highest observed open-equity balance. Realized-loss breaches while flat also activate daily locks or demo failure. Forced closures use regular trade accounting, fee deduction, and journal submission.
- Demo chart persists synthetic minute bars, positions, working orders, P&L and timed locks locally by signed-in Supabase user and preset account size, with validation and 36-hour expiry. Browser storage is **untrusted**, nontransactional and not an official ledger. Simultaneous tabs and storage-clearing are not safe for real rewards.
- Candles advance at real one-minute boundaries and session/time-exit times use Eastern time. Unsupported daily/weekly historical chart views are blocked rather than displaying an insignificant number of fake bars.
- DOM and news are explicitly identified as synthetic; journal entries are labeled simulated; the top bar says **SIM · DEMO ONLY**. No browser trade can award official evaluation credit.
- Risk calculator no longer displays a minimum of one contract if stop distance makes even one contract unaffordable. Replay and manual lockout now require positions/working orders to be handled first.

## Not implemented: important production blockers

- **No licensed market data:** market prices, fills, order book, volume delta, DOM icebergs, footprint and news events are still synthetic.
- **No server-trusted execution ledger:** orders, positions, official P&L, trailing drawdown, session attendance and pass/fail decisions cannot depend on these browser values.
- **No purchased account entitlement binding:** demo account size can be chosen from four presets. That's a display/practice setting only.
- **No permanent multi-device restore:** local demo snapshots are not official and expire. Live production positions/orders require transactional server storage and authoritative market data.
- **Not fully browser-tested:** GitHub Node tests and a Vercel preview build do not verify all UI controls. Manually test symbol switching, futures sessions, SL/TP, limit fills, scale-in/out, refresh restore, replay, mobile, keyboard shortcuts and failure overlays on preview.
- Live Supabase security issues and Stripe fulfillment must be resolved separately. Do NOT enable paid evaluations or payouts based on this chart.

## Release instructions

PR #4 is stacked on the prelaunch PR #2 and database PR #3. Keep these as draft, review in order, and test against actual Supabase RLS and licensed data in staging before a release. Do not merge solely on unit tests. No chart code was deployed to production in this audit.
