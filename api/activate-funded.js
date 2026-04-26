// api/activate-funded.js — Stripe checkout for $150 funded activation
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { user_id, email } = req.body;
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://tradephex.com';

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price: process.env.STRIPE_FUNDED_PRICE_ID,
        quantity: 1,
      }],
      customer_email: email || undefined,
      metadata: { user_id, type: 'funded_activation' },
      success_url: `${baseUrl}/journal?funded=activated`,
      cancel_url: `${baseUrl}/journal?tab=evaluation`,
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Funded activation error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
