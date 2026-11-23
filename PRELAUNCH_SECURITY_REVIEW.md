# Tradephex prelaunch payment and risk review

This is a **review-only pull request**. Do not merge into production until the checks below pass in a test environment. Neither this PR nor a successful Vercel build establishes compliance or security.

## Changes in this branch
- `api/create-checkout.js` verifies a Supabase access token server-side and uses the authenticated account ID and email. The client selects only a server-defined plan.
- `public/journal.html` removes the route that activated evaluations on checkout failure or URL parameters. Evaluation purchases call the authenticated checkout endpoint.
- `api/webhook.js` verifies the Stripe signature and paid session, validates plan metadata, and attempts idempotent fulfillment of the evaluation.
- `api/request-payout.js` and `api/activate-funded.js` deliberately fail closed with HTTP 503 until a complete secure system can replace them. **These functions are disabled by this patch.**

## Mandatory production checks (NOT implemented automatically)
1. Confirm the actual Supabase `evaluations`, `payout_requests`, `profiles`, and `trades` table definitions. The committed `supabase/schema.sql` does not include all required tables.
2. Ensure ordinary authenticated clients cannot INSERT/UPDATE `evaluations` or `payout_requests`, alter balances, change `status` to passed, or grant account entitlements via `auth.users.user_metadata`. All evaluation results used for rewards must be computed and signed by a trusted server process, not browser values.
3. Add a **unique constraint/index on `evaluations(stripe_session_id)`** after checking for duplicate or null values. Example for DBA review only (do not apply blindly):

   ```sql
   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS evaluations_stripe_session_id_unique
     ON public.evaluations (stripe_session_id);
   ```

   Run outside a transaction, confirm `stripe_session_id` exists and inspect duplicates. Stripe may retry or deliver events concurrently.
4. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and either `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` **in Vercel environment settings**, not repository files. Register the public `/api/webhook` endpoint in Stripe for `checkout.session.completed`. Never share secret keys publicly.
5. Test with Stripe **test-mode** payments: happy-path evaluation purchase, unsuccessful payment, duplicate webhook, delayed webhook, changed URL query, unauthenticated checkout, and a wrong user's access token. Verify one and only one evaluation record is created for a paid checkout.
6. The public evaluation marketing page describes one-phase 6% rules; checkout currently retains older 8–10% targets and a two-phase UI. **Do not accept paid evaluations until product rules and prices agree everywhere.** Those commercial decisions are not changed by this patch.
7. Repair or explicitly disable missing email imports (`api/_email.js`) and admin-list API references before launch.
8. Replace and test disabled payout and funded-account activation endpoints with server-validated entitlement and payout calculations, encrypted/tokenized payout-method handling, replay protection, authorization, and audit logging.
9. Verify subscriptions separately. Journal subscriptions still use old client-side Stripe code and need a server-side paid subscription confirmation path. `user_metadata` cannot be authoritative for paid entitlements.
10. Obtain appropriate futures market-data and simulated funded-trader usage authorizations before enabling real feeds.
11. Run an independent security assessment, load tests, and reconciliation tests. Keep the repository private if the business requires proprietary code confidentiality.

## Known limitations
- This branch is not deployed or connected to live Supabase.
- No live Stripe or database tests have been run.
- `public/eval-chart.html` currently performs client-side P&L and evaluation calculations. This remains untrusted for monetary rewards.
- Checkout prices are intentionally unchanged pending a single approved pricing/rules source of truth.
