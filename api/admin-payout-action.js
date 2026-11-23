// Pre-launch safety: do not mark payouts as "paid" without checking that
// a payment was actually executed and settled by the payment provider.
// Replace this with audited, server-verified, role-based workflows.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(503).json({
    error: 'Payout administration is unavailable during pre-launch financial security review.'
  });
}
