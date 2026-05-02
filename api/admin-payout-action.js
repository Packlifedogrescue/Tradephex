// api/admin-payout-action.js — Admin approves or rejects a payout request
// Auth via shared secret in header (ADMIN_API_SECRET)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Auth check
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { request_id, action, reason, txn_ref } = req.body;
  // action: 'approve' | 'reject' | 'paid'
  if (!request_id || !action) return res.status(400).json({ error: 'Missing fields' });

  try {
    // Get the payout request + user info
    const reqRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/payout_requests?id=eq.${request_id}&select=*`,
      { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const requests = await reqRes.json();
    if (!requests.length) return res.status(404).json({ error: 'Request not found' });
    const payoutReq = requests[0];

    // Get user email
    const userRes = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/admin/users/${payoutReq.user_id}`,
      { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const userData = await userRes.json();
    const userEmail = userData.email;
    const firstName = (userData.user_metadata?.display_name || userEmail || '').split(' ')[0].split('@')[0];

    // Update payout status
    const newStatus = action === 'approve' ? 'approved' : action === 'paid' ? 'paid' : 'rejected';
    const patch = {
      status: newStatus,
      processed_at: new Date().toISOString(),
    };
    if (action === 'reject' && reason) patch.rejection_reason = reason;

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/payout_requests?id=eq.${request_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(patch),
    });

    // Send appropriate email
    if (userEmail) {
      try {
        if (action === 'paid') {
          const { sendPayoutSentEmail } = await import('./_email.js');
          await sendPayoutSentEmail({
            email: userEmail,
            firstName,
            amount: parseFloat(payoutReq.amount_requested),
            method: payoutReq.payment_method || 'bank transfer',
            txnRef: txn_ref || '',
          });
        } else if (action === 'reject') {
          const { sendPayoutRejectedEmail } = await import('./_email.js');
          await sendPayoutRejectedEmail({
            email: userEmail,
            firstName,
            amount: parseFloat(payoutReq.amount_requested),
            reason: reason || 'See your dashboard for details.',
          });
        }
      } catch (emailErr) {
        console.error('Payout action email failed:', emailErr.message);
      }
    }

    res.status(200).json({ success: true, status: newStatus });
  } catch (err) {
    console.error('Admin payout action error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
