// Payout requests are deliberately disabled until server-side trading results,
// payable balances, identity, banking-data handling, and concurrency checks exist.
// Do not accept client-provided payout amounts as authoritative.
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  return res.status(503).json({
    error:'Payout requests are temporarily unavailable during pre-launch security review.'
  });
}
