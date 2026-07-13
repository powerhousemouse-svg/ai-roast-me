const { getStripe, getWebhookSecret } = require('../../lib/stripe-client');
const { grantFromCheckoutSession, syncSubscriptionStatus } = require('../../lib/entitlements');
const { sendPurchaseConfirmationEmail } = require('../../lib/email');
const { signRestoreToken } = require('../../lib/restore-token');
const { readRawBody } = require('../../lib/http');

async function handleCheckoutCompleted(stripe, sessionRef) {
  const session = await stripe.checkout.sessions.retrieve(sessionRef.id, {
    expand: ['customer', 'subscription']
  });

  const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
  if (!paid && session.mode !== 'subscription') {
    console.log('[stripe/webhook] Skipping unpaid session', session.id, session.payment_status);
    return;
  }

  const result = await grantFromCheckoutSession(session);
  console.log('[stripe/webhook] processed session', session.id, 'granted=', result.granted, 'plan=', result.entitlements?.plan);

  if (result.granted && result.email) {
    try {
      const token = signRestoreToken(result.email);
      await sendPurchaseConfirmationEmail(result.email, token, result.product);
    } catch (err) {
      // Don't fail the webhook if email fails — entitlements are already saved
      console.error('[stripe/webhook] purchase email failed', err.message);
    }
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = getStripe();
  const webhookSecret = getWebhookSecret();
  if (!webhookSecret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET not configured');
    return res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET not configured' });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] signature error', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripe, event.data.object);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscriptionStatus(event.data.object);
        console.log('[stripe/webhook] synced subscription', event.data.object.id, event.data.object.status);
        break;
      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripe/webhook]', err);
    return res.status(500).json({ error: err.message });
  }
};