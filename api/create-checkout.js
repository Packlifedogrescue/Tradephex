// Create an evaluation checkout for the authenticated account only.
// Evaluation entitlements must be granted by a verified Stripe webhook, never a URL.
import { getAuthenticatedUser } from './_auth.js';

const PLANS = Object.freeze({
  '25k': { name:'Tradephex Eval $25K', price:14900, account:25000, profit_target:0.10, max_dd:0.05, daily_limit:0.02 },
  '50k': { name:'Tradephex Eval $50K', price:24900, account:50000, profit_target:0.10, max_dd:0.05, daily_limit:0.02 },
  '100k': { name:'Tradephex Eval $100K', price:39900, account:100000, profit_target:0.08, max_dd:0.05, daily_limit:0.02 },
  '150k': { name:'Tradephex Eval $150K', price:59900, account:150000, profit_target:0.08, max_dd:0.05, daily_limit:0.02 },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error:'Checkout is not configured' });

  try {
    const user = await getAuthenticatedUser(req);
    if (!user || !user.email) return res.status(401).json({ error:'Please sign in again' });

    const plan = typeof req.body?.plan === 'string' ? req.body.plan : '';
    const p = Object.prototype.hasOwnProperty.call(PLANS,plan) ? PLANS[plan] : null;
    if (!p) return res.status(400).json({ error:'Invalid plan' });

    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = process.env.NEXT_PUBLIC_URL || 'https://tradephex.com';
    const session = await stripe.checkout.sessions.create({
      payment_method_types:['card'],
      mode:'payment',
      client_reference_id:user.id,
      customer_email:user.email,
      line_items:[{
        price_data:{
          currency:'usd',
          unit_amount:p.price,
          product_data:{
            name:p.name,
            description:`Evaluation: ${p.profit_target*100}% profit target, ${p.max_dd*100}% max drawdown, ${p.daily_limit*100}% daily loss`,
          },
        },
        quantity:1,
      }],
      metadata:{
        type:'evaluation',
        user_id:user.id,
        plan,
        account_size:String(p.account),
        profit_target:String(p.profit_target),
        max_dd:String(p.max_dd),
        daily_limit:String(p.daily_limit),
      },
      success_url:origin + '/journal?checkout=return',
      cancel_url:origin + '/journal?tab=upgrade',
      allow_promotion_codes:true,
    });

    return res.status(200).json({ url:session.url });
  } catch (err) {
    console.error('Evaluation checkout error:', err);
    return res.status(500).json({ error:'Checkout is temporarily unavailable' });
  }
}
