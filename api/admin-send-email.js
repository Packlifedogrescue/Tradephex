// api/admin-send-email.js — Send arbitrary email from admin panel
// Auth: requires x-admin-key header matching ADMIN_API_SECRET env var
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { to, subject, body } = req.body;
  if (!to || !subject || !body) return res.status(400).json({ error: 'Missing fields' });

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  // Convert plain-text body to HTML (preserve line breaks)
  const htmlBody = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  // Wrap in branded layout
  const SITE = process.env.NEXT_PUBLIC_URL || 'https://tradephex.com';
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#F7F5EE;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1A1A22;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFF;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:#06060A;padding:24px 32px;border-bottom:3px solid #C9A84C;">
          <div style="font-weight:800;font-size:22px;letter-spacing:0.1em;color:#FFF;">TRADE<span style="color:#C9A84C;">PHEX</span></div>
        </td></tr>
        <tr><td style="padding:32px;line-height:1.6;font-size:14px;">${htmlBody}</td></tr>
        <tr><td style="background:#F8F8F8;padding:20px 32px;border-top:1px solid #E5E5E5;font-size:11px;color:#666;line-height:1.6;">
          Tradephex LLC · 100 Noble Blvd STE 10 #1056 · Carlisle, PA 17013<br/>
          Questions? Reply to this email or visit ${SITE}/support.
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Tradephex <noreply@tradephex.com>',
        to: [to],
        subject,
        html,
        reply_to: 'support@tradephex.com',
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.message || 'Send failed' });
    res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('Admin send email error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
