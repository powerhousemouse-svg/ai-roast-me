const { getStripe, getSiteUrl, normalizeEmail } = require('../../lib/stripe-client');
const { parseBody } = require('../../lib/http');
const { VALID_PRODUCTS } = require('../../lib/entitlements');

const PRODUCTS = {
  pack: {
    name: 'Brutal Pack',
    description: '10 roasts + all roast styles (Brutal, British, Gen Z, Dad Joke). No ads, no watermark.',
    amount: 199,
    mode: 'payment'
  },
  subscription: {
    name: 'Unlimited',
    description: 'Unlimited roasts every month. Cancel anytime.',
    amount: 499,
    mode: 'subscription',
    interval: 'month'
  },
  lifetime: {
    name: 'Lifetime Access',
    description: 'Unlimited roasts forever. Pay once, never again.',
    amount: 1499,
    mode: 'payment'
  }
};

function getPriceId(product) {
  if (product === 'pack') return process.env.STRIPE_PRICE_PACK;
  if (product === 'subscription') return process.env.STRIPE_PRICE_SUBSCRIPTION || process.env.STRIPE_PRICE_UNLIMITED;
  if (product === 'lifetime') return process.env.STRIPE_PRICE_LIFETIME;
  return null;
}

function buildLineItems(product, productInfo) {
  const priceId = getPriceId(product);

  if (priceId) {
    return [{ price: priceId, quantity: 1 }];
  }

  if (productInfo.mode === 'subscription') {
    return [{
      price_data: {
        currency: 'usd',
        unit_amount: productInfo.amount,
        recurring: { interval: productInfo.interval },
        product_data: {
          name: productInfo.name,
          description: productInfo.description
        }
      },
      quantity: 1
    }];
  }

  return [{
    price_data: {
      currency: 'usd',
      unit_amount: productInfo.amount,
      product_data: {
        name: productInfo.name,
        description: productInfo.description
      }
    },
    quantity: 1
  }];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stripe = getStripe();
    const body = await parseBody(req);
    const product = VALID_PRODUCTS.includes(body.product) ? body.product : 'pack';
    const productInfo = PRODUCTS[product];
    const email = normalizeEmail(body.email);
    const siteUrl = getSiteUrl();

    let customerId;
    if (email) {
      const existing = await stripe.customers.list({ email, limit: 1 });
      customerId = existing.data[0]?.id;
      if (!customerId) {
        const created = await stripe.customers.create({ email });
        customerId = created.id;
      }
    }

    const sessionParams = {
      mode: productInfo.mode,
      payment_method_types: ['card'],
      line_items: buildLineItems(product, productInfo),
      success_url: `${siteUrl}/?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?purchase=cancelled`,
      metadata: { product },
      subscription_data: product === 'subscription'
        ? { metadata: { product: 'subscription' } }
        : undefined,
      allow_promotion_codes: true
    };

    if (customerId) {
      sessionParams.customer = customerId;
    } else {
      sessionParams.customer_email = email || undefined;
      sessionParams.customer_creation = 'always';
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url, sessionId: session.id, product });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    return res.status(500).json({ error: err.message || 'Checkout failed' });
  }
};