const { getStripe } = require('../../lib/stripe-client');
const { grantFromCheckoutSession, toClientPayload } = require('../../lib/entitlements');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = req.query?.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
    if (!paid && session.mode !== 'subscription') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    const result = await grantFromCheckoutSession(session);
    return res.status(200).json(toClientPayload(result.entitlements));
  } catch (err) {
    console.error('[stripe/session]', err);
    return res.status(500).json({ error: err.message || 'Session lookup failed' });
  }
};