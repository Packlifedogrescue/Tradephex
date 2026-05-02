// api/request-payout.js — Funded trader payout request
// Called when a trader passes their evaluation and requests their profit split
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { user_id, eval_id, amount, account_number, routing_number, paypal_email, email, first_name } = req.body;
  if (!user_id || !eval_id || !amount) return res.status(400).json({ error: 'Missing fields' });

  try {
    // Verify eval is in passed status
    const checkRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/evaluations?id=eq.${eval_id}&user_id=eq.${user_id}&status=eq.passed`,
      { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const evals = await checkRes.json();
    if (!evals.length) return res.status(403).json({ error: 'Eval not found or not passed' });

    // Create payout request record (return representation so we get the new ID)
    const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/payout_requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        user_id,
        eval_id,
        amount_requested: amount,
        status: 'pending',
        payment_method: paypal_email ? 'paypal' : 'bank',
        payment_details: paypal_email || `${account_number}:${routing_number}`,
        requested_at: new Date().toISOString(),
      }),
    });
    const created = await insertRes.json();
    const requestId = Array.isArray(created) && created[0] ? created[0].id : null;

    // Send confirmation email (non-blocking; don't fail the request if it bombs)
    if (email) {
      try {
        const { sendPayoutRequestedEmail } = await import('./_email.js');
        await sendPayoutRequestedEmail({
          email,
          firstName: first_name || '',
          amount: parseFloat(amount),
          requestId: requestId || 'pending',
        });
      } catch (emailErr) {
        console.error('Payout request email failed:', emailErr.message);
      }
    }

    res.status(200).json({
      success: true,
      requestId,
      message: 'Payout request submitted. Processing within 5 business days.',
    });
  } catch (err) {
    console.error('Payout request error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
