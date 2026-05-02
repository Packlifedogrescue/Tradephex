// api/create-checkout.js — Vercel serverless function
// Creates a Stripe Checkout session and returns the URL
// ENV VARS needed in Vercel dashboard:
//   STRIPE_SECRET_KEY  (sk_live_...)
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY
//   NEXT_PUBLIC_URL  (https://tradephex.com)

const PLANS = {
  '25k':  { name: 'Tradephex Eval $25K',  price: 14900,  account: 25000,  profit_target: 0.10, max_dd: 0.05, daily_limit: 0.02 },
  '50k':  { name: 'Tradephex Eval $50K',  price: 24900,  account: 50000,  profit_target: 0.10, max_dd: 0.05, daily_limit: 0.02 },
  '100k': { name: 'Tradephex Eval $100K', price: 39900,  account: 100000, profit_target: 0.08, max_dd: 0.05, daily_limit: 0.02 },
  '150k': { name: 'Tradephex Eval $150K', price: 59900,  account: 150000, profit_target: 0.08, max_dd: 0.05, daily_limit: 0.02 },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan, user_id, email } = req.body;
  const planData = PLANS[plan];
  if (!planData) return res.status(400).json({ error: 'Invalid plan' });

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://tradephex.com';

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: planData.price,
          product_data: {
            name: planData.name,
            description: `Phase 1: ${planData.profit_target*100}% profit target · Max DD: ${planData.max_dd*100}% · Daily limit: ${planData.daily_limit*100}%`,
            images: ['https://tradephex.com/og-image.png'],
          },
        },
        quantity: 1,
      }],
      customer_email: email || undefined,
      metadata: {
        user_id: user_id || '',
        plan,
        account_size: planData.account.toString(),
        profit_target: planData.profit_target.toString(),
        max_dd: planData.max_dd.toString(),
        daily_limit: planData.daily_limit.toString(),
      },
      success_url: `${baseUrl}/welcome?plan=${plan}`,
      cancel_url: `${baseUrl}/?canceled=true`,
      allow_promotion_codes: true,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
