// api/webhook.js — Stripe webhook handler
// ENV VARS: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY
// Set up in Stripe dashboard: https://dashboard.stripe.com/webhooks
// Events to listen for: checkout.session.completed, payment_intent.payment_failed

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // ── Handle events ──
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { user_id, plan, account_size, profit_target, max_dd, daily_limit } = session.metadata;

    try {
      // 1. Create evaluation record in Supabase
      const evalRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/evaluations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          user_id: user_id || null,
          account_size: parseInt(account_size),
          phase: 1,
          status: 'active',
          net_pnl: 0,
          max_drawdown: 0,
          trading_days: 0,
          profit_target: parseFloat(profit_target),
          max_dd_limit: parseFloat(max_dd),
          daily_loss_limit: parseFloat(daily_limit),
          stripe_session_id: session.id,
          started_at: new Date().toISOString(),
        }),
      });

      if (!evalRes.ok) {
        const err = await evalRes.text();
        console.error('Supabase eval insert failed:', err);
      } else {
        console.log(`✅ Eval created for user ${user_id} — $${account_size} account`);
      }

      // 2. Update user profile to mark as eval active
      if (user_id) {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${user_id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ plan: 'eval_active', updated_at: new Date().toISOString() }),
        });
      }

      // 3. Send confirmation email via Resend
      if (session.customer_email) {
        try {
          const { sendEvalPurchaseEmail, sendW9RequestEmail } = await import('./_email.js');
          // Pull first name from session if available
          const firstName = (session.customer_details?.name || '').split(' ')[0] || '';
          await sendEvalPurchaseEmail({
            email: session.customer_email,
            firstName,
            accountSize: parseInt(account_size),
            profitTarget: parseFloat(profit_target),
            maxDD: parseFloat(max_dd),
            dailyLimit: parseFloat(daily_limit),
            plan: plan ? plan.toUpperCase() : 'EVAL',
          });
          console.log(`✅ Confirmation email sent to ${session.customer_email}`);
        } catch (emailErr) {
          console.error('Email send failed:', emailErr.message);
          // Don't fail the webhook if email fails — log it and move on
        }
      }

    } catch (err) {
      console.error('Webhook processing error:', err);
      return res.status(500).json({ error: 'Processing failed' });
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object;
    console.log(`Payment failed: ${pi.id} — ${pi.last_payment_error?.message}`);
  }

  res.status(200).json({ received: true });
}
