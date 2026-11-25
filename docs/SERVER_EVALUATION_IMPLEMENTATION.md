# Server-authoritative evaluation system — engineering plan (DRAFT)

This is a design note, not approval to launch or an executable migration. The live Supabase schema and RLS policies have not been inspected.

## Work prepared
- api/_evaluation-ledger.js computes closed-trade balances, realized drawdown, worst realized session loss, trading-day counts, profit-target progress and day-level consistency using integer cents.
- tests/evaluation-ledger.test.js verifies risk outcomes, Eastern time rollovers, duplicate trade IDs and invalid inputs.
- **Neither file is connected to customer accounts or payment decisions.** A ledger result of target_met is not an entitlement.

## Security and architecture requirements
1. Inspect real tables, indexes, views, RLS and grants using supabase/SECURITY_AUDIT_READ_ONLY.sql. Do not assume that the repository SQL equals the live schema.
2. Separate user-editable journal entries from immutable, server-verified evaluation fills. Browser P&L is never trusted as a source for real monetary rewards.
3. Define a trusted market-data ingestion and matching engine for market/limit/stop orders, position changes, fees, slippage, timestamps, stale prices, holidays and exchange outages.
4. Compute open-position and realized equity risk on a trusted server, including trailing drawdown. Closed-trade accounting alone is insufficient.
5. Implement an atomic trade/fill and risk event ledger with unique idempotency keys, row locking, audit logs and strict evaluation state transitions.
6. Remove authenticated-user write access to official evaluation and payout tables and to privileged profile fields such as plan and account_size. Keep service credentials in secure server environment variables.
7. Complete signed Stripe fulfillment, database-enforced unique checkout identifiers, subscription lifecycle/reversal handling and payment reconciliation.
8. Require independent payout amount calculation, verified payment-provider settlement and encrypted/tokenized payout details. Do not store unprotected routing/account numbers.
9. Add abuse and concurrency tests. Validate trader identity, close/open P&L, daily cutoff, timezone, exchange calendar, partial fills and disconnections.

## Product decisions pending
- Public marketing advertises one-phase evaluation with a 6% profit target. Older checkout/terminal code uses 8–10% targets and two phases. Define one authoritative product specification before taking payments.
- Specify intraday vs EOD trailing drawdown, payout splits, frequency, consistency, minimum days, trading hours, commissions and news trading rules.
- License real-time futures data for the intended commercial simulated funded-trader business.

## Acceptance criteria before production release
- A connected Supabase audit proves authenticated clients cannot change balance, phase, pass/fail, payout or paid plan.
- Official server-side fills and open equity are reproducible from trusted market data and orders.
- Duplicate events and concurrent payout requests cannot create duplicate credit or withdrawals.
- Test-mode Stripe payments and webhook retries pass end-to-end, as do refunds, cancellations and failed payments.
- Production releases require independent security assessment and staging tests.

**Do not merge or enable real-money rewards based solely on this module or a passing Vercel build.**
