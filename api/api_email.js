// api/_email.js — Resend email service
// Internal module used by other API routes. Not a route itself (underscore prefix).
//
// ENV VARS:
//   RESEND_API_KEY       — from resend.com dashboard
//   RESEND_FROM_EMAIL    — verified sender (e.g. "Tradephex <noreply@tradephex.com>")
//   NEXT_PUBLIC_URL      — your site URL for email links

const FROM = process.env.RESEND_FROM_EMAIL || 'Tradephex <noreply@tradephex.com>';
const SITE = process.env.NEXT_PUBLIC_URL || 'https://tradephex.com';

// ── Brand colors — match site theme (black + gold) ──
const C = {
  gold: '#C9A84C',
  goldBright: '#E8C870',
  black: '#06060A',
  blackSoft: '#0E0E0E',
  text: '#1A1A22',
  subtle: '#666666',
  bg: '#F7F5EE',
  green: '#1F7A4D',
  red: '#A62828',
};

// ── Reusable email layout ──
function emailLayout(subject, body) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${C.text};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:6px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:${C.black};padding:24px 32px;border-bottom:3px solid ${C.gold};">
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:22px;letter-spacing:0.1em;color:#FFFFFF;">TRADE<span style="color:${C.gold};">PHEX</span></div>
        </td></tr>
        <tr><td style="padding:32px;line-height:1.6;font-size:14px;">
          ${body}
        </td></tr>
        <tr><td style="background:#F8F8F8;padding:20px 32px;border-top:1px solid #E5E5E5;font-size:11px;color:${C.subtle};line-height:1.6;">
          <strong>Tradephex LLC</strong> · 100 Noble Blvd STE 10 #1056 · Carlisle, PA 17013<br/>
          You're receiving this because you have an account at tradephex.com.<br/>
          Questions? Reply to this email or visit <a href="${SITE}/support" style="color:${C.gold};">${SITE}/support</a>.<br/><br/>
          <em style="color:${C.subtle};">Tradephex LLC is not a registered broker-dealer. All trading on the platform uses simulated market data. Participation is a skills assessment program; no real money is at risk.</em>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── Core send function ──
async function sendEmail({ to, subject, html, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured. Email skipped:', subject, '→', to);
    return { skipped: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        reply_to: replyTo || 'support@tradephex.com',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Resend API error:', data);
      return { error: data.message || 'Send failed' };
    }
    return { id: data.id };
  } catch (err) {
    console.error('Email send exception:', err.message);
    return { error: err.message };
  }
}

// ════════════════════════════════════════════════
// EMAIL TEMPLATES
// Each function takes a data object and sends.
// All return { id } on success or { error } on failure.
// ════════════════════════════════════════════════

// 1. Welcome — sent after signup
export async function sendWelcomeEmail({ email, firstName }) {
  const name = firstName || 'trader';
  return sendEmail({
    to: email,
    subject: 'Welcome to Tradephex',
    html: emailLayout('Welcome to Tradephex', `
      <h1 style="font-size:24px;font-weight:700;color:${C.black};margin:0 0 16px;">Welcome, ${name}.</h1>
      <p>Your Tradephex account is live. Here's what you can do next:</p>
      <ul style="padding-left:20px;color:${C.text};">
        <li><strong>Buy a challenge</strong> to start your evaluation — accounts from $50K to $150K</li>
        <li><strong>Or grab a Pro chart subscription</strong> if you just want our pro-grade charting tools</li>
        <li><strong>Open the Trade Journal</strong> to track every trade, analyze performance, and replay setups</li>
      </ul>
      <p style="margin:24px 0;">
        <a href="${SITE}/journal" style="background:${C.gold};color:${C.black};padding:12px 28px;text-decoration:none;border-radius:4px;font-weight:700;letter-spacing:0.1em;font-size:13px;text-transform:uppercase;">Open Your Dashboard</a>
      </p>
      <p style="font-size:13px;color:${C.subtle};">Questions about how it all works? Reply to this email — we read every message.</p>
    `),
  });
}

// 2. Eval purchase confirmation
export async function sendEvalPurchaseEmail({ email, firstName, accountSize, profitTarget, maxDD, dailyLimit, plan }) {
  const name = firstName || 'trader';
  return sendEmail({
    to: email,
    subject: `Your $${accountSize.toLocaleString()} ${plan} evaluation is active`,
    html: emailLayout('Evaluation Active', `
      <h1 style="font-size:24px;font-weight:700;color:${C.black};margin:0 0 16px;">You're funded, ${name}.</h1>
      <p>Your <strong>$${accountSize.toLocaleString()} ${plan}</strong> evaluation is now active. Here's your account snapshot:</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#F8F8F8;border-radius:4px;margin:16px 0;border:1px solid #E5E5E5;">
        <tr><td style="padding:14px 16px;border-bottom:1px solid #E5E5E5;font-size:13px;"><strong>Account Size</strong></td><td style="padding:14px 16px;border-bottom:1px solid #E5E5E5;text-align:right;font-family:'Courier New',monospace;">$${accountSize.toLocaleString()}</td></tr>
        <tr><td style="padding:14px 16px;border-bottom:1px solid #E5E5E5;font-size:13px;"><strong>Profit Target</strong></td><td style="padding:14px 16px;border-bottom:1px solid #E5E5E5;text-align:right;font-family:'Courier New',monospace;color:${C.green};">$${profitTarget.toLocaleString()} (6%)</td></tr>
        <tr><td style="padding:14px 16px;border-bottom:1px solid #E5E5E5;font-size:13px;"><strong>Max Drawdown</strong></td><td style="padding:14px 16px;border-bottom:1px solid #E5E5E5;text-align:right;font-family:'Courier New',monospace;color:${C.red};">$${maxDD.toLocaleString()} (5%)</td></tr>
        <tr><td style="padding:14px 16px;border-bottom:1px solid #E5E5E5;font-size:13px;"><strong>Daily Loss Limit</strong></td><td style="padding:14px 16px;border-bottom:1px solid #E5E5E5;text-align:right;font-family:'Courier New',monospace;color:${C.red};">$${dailyLimit.toLocaleString()} (2%)</td></tr>
        <tr><td style="padding:14px 16px;font-size:13px;"><strong>Min Trading Days</strong></td><td style="padding:14px 16px;text-align:right;font-family:'Courier New',monospace;">5 days</td></tr>
      </table>
      <p>Pass the evaluation by hitting your profit target without breaching the drawdown rules. Once you pass, you're funded with an 80%/85%/90% profit split (scales with payouts).</p>
      <p style="margin:24px 0;">
        <a href="${SITE}/eval-chart" style="background:${C.gold};color:${C.black};padding:12px 28px;text-decoration:none;border-radius:4px;font-weight:700;letter-spacing:0.1em;font-size:13px;text-transform:uppercase;">Start Trading Now</a>
      </p>
      <p style="font-size:13px;color:${C.subtle};">Need a refresher on the rules? Visit <a href="${SITE}/journal#eval-rules" style="color:${C.gold};">your rules page</a>.</p>
    `),
  });
}

// 3. Evaluation passed
export async function sendEvalPassedEmail({ email, firstName, accountSize, profit }) {
  const name = firstName || 'trader';
  return sendEmail({
    to: email,
    subject: '🎉 You passed your evaluation',
    html: emailLayout('Evaluation Passed', `
      <h1 style="font-size:28px;font-weight:700;color:${C.green};margin:0 0 16px;">You did it, ${name}.</h1>
      <p>You officially passed your <strong>$${accountSize.toLocaleString()}</strong> evaluation with a profit of <strong style="color:${C.green};">$${profit.toLocaleString()}</strong>.</p>
      <p>Your funded account is now live. You can request payouts the moment you have profit to take.</p>
      <p style="background:#F8F8F8;border-left:3px solid ${C.gold};padding:14px 18px;margin:20px 0;font-size:13px;">
        <strong>Before your first payout:</strong> we need a Form W-9 on file (US traders) or W-8BEN (foreign). We'll send a separate email with the exact form link and instructions. No payouts can be processed without this.
      </p>
      <p style="margin:24px 0;">
        <a href="${SITE}/journal" style="background:${C.gold};color:${C.black};padding:12px 28px;text-decoration:none;border-radius:4px;font-weight:700;letter-spacing:0.1em;font-size:13px;text-transform:uppercase;">Manage Your Funded Account</a>
      </p>
      <p>Trade well. The discipline that got you here is what keeps you here.</p>
    `),
  });
}

// 4. Evaluation failed (drawdown breach)
export async function sendEvalFailedEmail({ email, firstName, accountSize, reason }) {
  const name = firstName || 'trader';
  return sendEmail({
    to: email,
    subject: 'Your evaluation has ended',
    html: emailLayout('Evaluation Ended', `
      <h1 style="font-size:24px;font-weight:700;color:${C.black};margin:0 0 16px;">Tough one, ${name}.</h1>
      <p>Your <strong>$${accountSize.toLocaleString()}</strong> evaluation ended after a <strong>${reason}</strong>.</p>
      <p>We know this isn't the email you wanted. The reality is most evaluations don't pass on the first try — what separates funded traders is reviewing what happened and coming back better.</p>
      <p><strong>What to do next:</strong></p>
      <ul style="padding-left:20px;color:${C.text};">
        <li>Open your <a href="${SITE}/journal" style="color:${C.gold};">journal</a> and review every trade from this attempt</li>
        <li>Identify the specific trade or session that breached the rule</li>
        <li>Read the <a href="${SITE}/journal#eval-rules" style="color:${C.gold};">rules page</a> if you're unsure why something failed</li>
        <li>When you're ready, buy a fresh evaluation and apply what you learned</li>
      </ul>
      <p style="margin:24px 0;">
        <a href="${SITE}/journal#upgrade" style="background:${C.gold};color:${C.black};padding:12px 28px;text-decoration:none;border-radius:4px;font-weight:700;letter-spacing:0.1em;font-size:13px;text-transform:uppercase;">Buy New Challenge</a>
      </p>
      <p style="font-size:13px;color:${C.subtle};">No obligation, no pressure. The evaluation will be there when you're ready.</p>
    `),
  });
}

// 5. Payout request received
export async function sendPayoutRequestedEmail({ email, firstName, amount, requestId }) {
  const name = firstName || 'trader';
  return sendEmail({
    to: email,
    subject: `Payout request received — $${amount.toFixed(2)}`,
    html: emailLayout('Payout Request Received', `
      <h1 style="font-size:24px;font-weight:700;color:${C.black};margin:0 0 16px;">Got it, ${name}.</h1>
      <p>We received your payout request for <strong style="color:${C.green};">$${amount.toFixed(2)}</strong>.</p>
      <p><strong>What happens next:</strong></p>
      <ul style="padding-left:20px;color:${C.text};">
        <li>Our team reviews the request within <strong>1 business day</strong></li>
        <li>If approved, we process payment within <strong>5 business days</strong></li>
        <li>You'll get a confirmation email when the payout sends</li>
      </ul>
      <p style="font-size:13px;color:${C.subtle};">Reference ID: <code>${requestId}</code></p>
      <p>If we need anything additional (like an updated W-9 or payment method confirmation), we'll reach out directly.</p>
    `),
  });
}

// 6. Payout approved & sent
export async function sendPayoutSentEmail({ email, firstName, amount, method, txnRef }) {
  const name = firstName || 'trader';
  return sendEmail({
    to: email,
    subject: `Payout sent — $${amount.toFixed(2)}`,
    html: emailLayout('Payout Sent', `
      <h1 style="font-size:24px;font-weight:700;color:${C.green};margin:0 0 16px;">Payout sent, ${name}.</h1>
      <p>Your payout of <strong style="color:${C.green};">$${amount.toFixed(2)}</strong> just went out via <strong>${method}</strong>.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#F8F8F8;border-radius:4px;margin:16px 0;border:1px solid #E5E5E5;">
        <tr><td style="padding:12px 16px;border-bottom:1px solid #E5E5E5;font-size:13px;"><strong>Amount</strong></td><td style="padding:12px 16px;border-bottom:1px solid #E5E5E5;text-align:right;font-family:'Courier New',monospace;color:${C.green};">$${amount.toFixed(2)}</td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #E5E5E5;font-size:13px;"><strong>Method</strong></td><td style="padding:12px 16px;border-bottom:1px solid #E5E5E5;text-align:right;font-family:'Courier New',monospace;">${method}</td></tr>
        <tr><td style="padding:12px 16px;font-size:13px;"><strong>Reference</strong></td><td style="padding:12px 16px;text-align:right;font-family:'Courier New',monospace;font-size:11px;">${txnRef || '—'}</td></tr>
      </table>
      <p>Funds typically arrive within <strong>1-3 business days</strong> for ACH, instantly for PayPal, and 10-30 minutes for crypto.</p>
      <p>If you don't see the funds within the expected window, reply to this email.</p>
    `),
  });
}

// 7. Payout rejected
export async function sendPayoutRejectedEmail({ email, firstName, amount, reason }) {
  const name = firstName || 'trader';
  return sendEmail({
    to: email,
    subject: 'Payout request needs attention',
    html: emailLayout('Payout Request Rejected', `
      <h1 style="font-size:22px;font-weight:700;color:${C.black};margin:0 0 16px;">Hold on, ${name} —</h1>
      <p>Your payout request for <strong>$${amount.toFixed(2)}</strong> wasn't processed. Here's why:</p>
      <p style="background:#FFF4F4;border-left:3px solid ${C.red};padding:14px 18px;margin:20px 0;color:${C.red};">${reason}</p>
      <p>Once you've resolved the issue, you can submit a new payout request from your dashboard.</p>
      <p style="margin:24px 0;">
        <a href="${SITE}/journal" style="background:${C.gold};color:${C.black};padding:12px 28px;text-decoration:none;border-radius:4px;font-weight:700;letter-spacing:0.1em;font-size:13px;text-transform:uppercase;">Open Dashboard</a>
      </p>
      <p style="font-size:13px;color:${C.subtle};">Questions? Reply to this email and we'll explain the specific issue.</p>
    `),
  });
}

// 8. W-9 collection (initial)
export async function sendW9RequestEmail({ email, firstName }) {
  const name = firstName || 'trader';
  return sendEmail({
    to: email,
    subject: 'Tax form needed before your first payout',
    html: emailLayout('W-9 Required', `
      <h1 style="font-size:22px;font-weight:700;color:${C.black};margin:0 0 16px;">Quick admin item, ${name}.</h1>
      <p>Before we process your first payout, the IRS requires us to have a completed Form W-9 on file (US residents) or Form W-8BEN (foreign residents).</p>
      <p><strong>To submit your W-9 (US traders):</strong></p>
      <ol style="padding-left:20px;color:${C.text};">
        <li>Download: <a href="https://www.irs.gov/pub/irs-pdf/fw9.pdf" style="color:${C.gold};">irs.gov/pub/irs-pdf/fw9.pdf</a></li>
        <li>Fill in: your legal name, address, and SSN or EIN</li>
        <li>Sign and date</li>
        <li>Email completed PDF to <strong>tax@tradephex.com</strong></li>
      </ol>
      <p style="font-size:13px;color:${C.subtle};">Foreign traders submit W-8BEN: <a href="https://www.irs.gov/pub/irs-pdf/fw8ben.pdf" style="color:${C.gold};">irs.gov/pub/irs-pdf/fw8ben.pdf</a></p>
      <p>Your information is stored securely and used only for IRS reporting (1099-NEC at year-end).</p>
      <p style="font-size:13px;color:${C.subtle};">No payouts can be processed without this form. We'll confirm receipt within 1 business day.</p>
    `),
  });
}

// 9. Drawdown warning (when trader is close to breach)
export async function sendDrawdownWarningEmail({ email, firstName, currentDD, maxDD, accountSize }) {
  const name = firstName || 'trader';
  const pctUsed = ((currentDD / maxDD) * 100).toFixed(0);
  return sendEmail({
    to: email,
    subject: `⚠️ You're at ${pctUsed}% of max drawdown`,
    html: emailLayout('Drawdown Warning', `
      <h1 style="font-size:22px;font-weight:700;color:${C.red};margin:0 0 16px;">Heads up, ${name}.</h1>
      <p>Your <strong>$${accountSize.toLocaleString()}</strong> account just crossed <strong style="color:${C.red};">${pctUsed}%</strong> of its max drawdown threshold.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#FFF4F4;border-radius:4px;margin:16px 0;border:1px solid #FFCDD2;">
        <tr><td style="padding:14px 16px;border-bottom:1px solid #FFCDD2;font-size:13px;"><strong>Current Drawdown</strong></td><td style="padding:14px 16px;border-bottom:1px solid #FFCDD2;text-align:right;font-family:'Courier New',monospace;color:${C.red};">$${currentDD.toFixed(2)}</td></tr>
        <tr><td style="padding:14px 16px;font-size:13px;"><strong>Max Drawdown Limit</strong></td><td style="padding:14px 16px;text-align:right;font-family:'Courier New',monospace;">$${maxDD.toFixed(2)}</td></tr>
      </table>
      <p>This is a friendly heads-up. If you breach the max drawdown, your evaluation ends and you'd need to buy a new one.</p>
      <p><strong>Recommended actions:</strong></p>
      <ul style="padding-left:20px;color:${C.text};">
        <li>Stop trading for the rest of the session</li>
        <li>Reduce position size on your next entries</li>
        <li>Use the <strong>Trading Lockout</strong> feature on the chart to enforce a cooling-off period</li>
      </ul>
      <p style="font-size:13px;color:${C.subtle};">You can ignore this if you're confident in your current setup. We send these because traders consistently appreciate the prompt.</p>
    `),
  });
}

// 10. Password reset (Supabase auth has its own — this is for custom flows)
export async function sendPasswordResetEmail({ email, resetLink }) {
  return sendEmail({
    to: email,
    subject: 'Reset your Tradephex password',
    html: emailLayout('Password Reset', `
      <h1 style="font-size:22px;font-weight:700;color:${C.black};margin:0 0 16px;">Password reset request</h1>
      <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
      <p style="margin:24px 0;text-align:center;">
        <a href="${resetLink}" style="background:${C.gold};color:${C.black};padding:14px 32px;text-decoration:none;border-radius:4px;font-weight:700;letter-spacing:0.1em;font-size:13px;text-transform:uppercase;">Reset Password</a>
      </p>
      <p style="font-size:13px;color:${C.subtle};">If you didn't request this, ignore this email — your password won't change.</p>
      <p style="font-size:13px;color:${C.subtle};">Reset link: <a href="${resetLink}" style="color:${C.gold};word-break:break-all;">${resetLink}</a></p>
    `),
  });
}
