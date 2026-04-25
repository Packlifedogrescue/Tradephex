// api/request-payout.js — Funded trader payout request
// Called when a trader passes Phase 2 and requests their profit split
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { user_id, eval_id, amount, account_number, routing_number, paypal_email } = req.body;
  if (!user_id || !eval_id || !amount) return res.status(400).json({ error: 'Missing fields' });

  // Verify eval is in passed status
  const checkRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/evaluations?id=eq.${eval_id}&user_id=eq.${user_id}&status=eq.passed`,
    { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
  );
  const evals = await checkRes.json();
  if (!evals.length) return res.status(403).json({ error: 'Eval not found or not passed' });

  // Create payout request record
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/payout_requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ user_id, eval_id, amount_requested: amount, status: 'pending', payment_method: paypal_email ? 'paypal' : 'bank', payment_details: paypal_email || `${account_number}:${routing_number}`, requested_at: new Date().toISOString() }),
  });

  res.status(200).json({ success: true, message: 'Payout request submitted. Processing within 5 business days.' });
}
