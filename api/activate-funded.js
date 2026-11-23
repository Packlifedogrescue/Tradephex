// Activation must not initiate payment for an unverified trader.
// The full activation flow requires server-side evaluation eligibility checks,
// a separate signed webhook handler, and an idempotent entitlement update.
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  return res.status(503).json({
    error:'Funded-account activation is temporarily unavailable during pre-launch security review.'
  });
}
