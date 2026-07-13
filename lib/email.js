const { getSiteUrl } = require('./stripe-client');

async function sendRestoreEmail(email, token) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'RoastLord <onboarding@resend.dev>';
  const siteUrl = getSiteUrl().replace(/\/$/, '');
  const restoreUrl = `${siteUrl}/?restore=${encodeURIComponent(token)}`;

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set');
    return { sent: false, restoreUrl, reason: 'RESEND_API_KEY not configured' };
  }

  const subject = 'Restore your RoastLord purchases';
  const text = [
    'Restore your RoastLord purchases',
    '',
    'Tap the link below to restore your purchased roasts on this device.',
    'This link expires in 30 minutes.',
    '',
    restoreUrl,
    '',
    "If you didn't request this, you can ignore this email."
  ].join('\n');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#fff;border-radius:16px;">
      <div style="font-size:28px;font-weight:900;color:#ffd700;margin-bottom:8px;display:flex;align-items:center;gap:8px;"><img src="${siteUrl}/assets/pepper.png" alt="" width="28" height="28" style="display:inline-block;vertical-align:middle;" /> RoastLord</div>
      <p style="color:#ccc;line-height:1.6;margin:0 0 20px;">Tap below to restore your purchased roasts on this device. This link expires in <strong>30 minutes</strong>.</p>
      <a href="${restoreUrl}" style="display:inline-block;margin:8px 0 24px;padding:14px 28px;background:#22ff88;color:#000;font-weight:800;text-decoration:none;border-radius:12px;font-size:15px;">Restore purchases</a>
      <p style="color:#666;font-size:12px;line-height:1.5;margin:0;">If you didn't request this, ignore this email.</p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: [email], subject, html, text })
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('[email] Resend error', res.status, body);
    throw new Error(body?.message || body?.error || 'Email send failed');
  }

  console.log('[email] Restore link sent to', email, 'id:', body.id);
  return { sent: true, id: body.id };
}

const PRODUCT_LABELS = {
  pack: 'Brutal Pack',
  subscription: 'Unlimited Subscription',
  lifetime: 'Lifetime Access'
};

async function sendPurchaseConfirmationEmail(email, token, product) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'RoastLord <onboarding@resend.dev>';
  const siteUrl = getSiteUrl().replace(/\/$/, '');
  const restoreUrl = `${siteUrl}/?restore=${encodeURIComponent(token)}`;
  const planName = PRODUCT_LABELS[product] || 'Premium';

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping purchase confirmation');
    return { sent: false, reason: 'RESEND_API_KEY not configured' };
  }

  const subject = `Your RoastLord ${planName} is active`;
  const text = [
    `Thanks for your purchase! Your ${planName} is now active.`,
    '',
    'Tap the link below to unlock premium on this device:',
    restoreUrl,
    '',
    'This link expires in 30 minutes. You can also use Restore Purchases in the app anytime.',
    '',
    "If you didn't make this purchase, contact support."
  ].join('\n');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#fff;border-radius:16px;">
      <div style="font-size:28px;font-weight:900;color:#ffd700;margin-bottom:8px;display:flex;align-items:center;gap:8px;"><img src="${siteUrl}/assets/pepper.png" alt="" width="28" height="28" style="display:inline-block;vertical-align:middle;" /> RoastLord</div>
      <p style="color:#ccc;line-height:1.6;margin:0 0 8px;">Thanks for your purchase! Your <strong style="color:#22ff88;">${planName}</strong> is now active.</p>
      <p style="color:#ccc;line-height:1.6;margin:0 0 20px;">Tap below to unlock premium on this device. Link expires in <strong>30 minutes</strong>.</p>
      <a href="${restoreUrl}" style="display:inline-block;margin:8px 0 24px;padding:14px 28px;background:#22ff88;color:#000;font-weight:800;text-decoration:none;border-radius:12px;font-size:15px;">Activate on this device</a>
      <p style="color:#666;font-size:12px;line-height:1.5;margin:0;">You can also use <strong>Restore Purchases</strong> in the app anytime.</p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: [email], subject, html, text })
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('[email] Purchase confirmation error', res.status, body);
    throw new Error(body?.message || body?.error || 'Email send failed');
  }

  console.log('[email] Purchase confirmation sent to', email, 'id:', body.id);
  return { sent: true, id: body.id };
}

module.exports = { sendRestoreEmail, sendPurchaseConfirmationEmail };