const { normalizeEmail } = require('../../lib/stripe-client');
const { hasPurchases } = require('../../lib/entitlements');
const { signRestoreToken } = require('../../lib/restore-token');
const { sendRestoreEmail } = require('../../lib/email');
const { parseBody } = require('../../lib/http');

const GENERIC_MESSAGE =
  'If purchases exist for this email, we sent a restore link. Check your inbox and spam folder.';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = await parseBody(req);
    const email = normalizeEmail(body.email);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    const purchased = await hasPurchases(email);

    // Always return the same message when no purchases — avoids email enumeration
    if (!purchased) {
      return res.status(200).json({
        ok: true,
        emailSent: false,
        message: GENERIC_MESSAGE
      });
    }

    const token = signRestoreToken(email);
    const emailResult = await sendRestoreEmail(email, token);

    if (!emailResult.sent) {
      return res.status(503).json({
        error: 'Email service is not configured. Please contact support.',
        devRestoreUrl: process.env.NODE_ENV !== 'production' ? emailResult.restoreUrl : undefined
      });
    }

    return res.status(200).json({
      ok: true,
      emailSent: true,
      message: `Restore link sent to ${email}. Check your inbox — it expires in 30 minutes.`
    });
  } catch (err) {
    console.error('[restore/request]', err);
    return res.status(500).json({ error: err.message || 'Restore request failed' });
  }
};