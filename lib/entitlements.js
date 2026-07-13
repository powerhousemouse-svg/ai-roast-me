const { getStripe, normalizeEmail } = require('./stripe-client');

const PACK_SIZE = 10;
const VALID_PRODUCTS = ['pack', 'subscription', 'lifetime'];

function computeUnlimited(ent) {
  return Boolean(ent.lifetime || ent.subscriptionActive);
}

function emptyEntitlements(email = '') {
  return {
    email: normalizeEmail(email),
    unlimited: false,
    lifetime: false,
    subscriptionActive: false,
    subscriptionId: null,
    packRoasts: 0,
    plan: 'none',
    updatedAt: new Date().toISOString()
  };
}

function normalizeEntitlements(raw, email = '') {
  const ent = { ...emptyEntitlements(email), ...(raw || {}) };
  ent.email = normalizeEmail(ent.email || email);
  ent.packRoasts = parseInt(ent.packRoasts || 0, 10) || 0;
  ent.lifetime = ent.lifetime === true || ent.lifetime === '1' || ent.lifetime === 'true';
  ent.subscriptionActive = ent.subscriptionActive === true || ent.subscriptionActive === '1' || ent.subscriptionActive === 'true';
  ent.unlimited = computeUnlimited(ent);
  if (ent.lifetime) ent.plan = 'lifetime';
  else if (ent.subscriptionActive) ent.plan = 'subscription';
  else if (ent.packRoasts > 0) ent.plan = 'pack';
  else ent.plan = ent.plan || 'none';
  return ent;
}

function kvAvailable() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function writeToKv(email, data) {
  if (!kvAvailable()) return;
  const { kv } = require('@vercel/kv');
  await kv.set(`rl:entitlements:${normalizeEmail(email)}`, data);
}

async function listCustomersForEmail(email) {
  const stripe = getStripe();
  const normalized = normalizeEmail(email);
  const customers = await stripe.customers.list({ email: normalized, limit: 100 });
  return customers.data;
}

function collectSessionIds(customers) {
  const ids = new Set();
  for (const customer of customers) {
    for (const sid of (customer.metadata?.rl_sessions || '').split(',')) {
      const id = sid.trim();
      if (id) ids.add(id);
    }
  }
  return ids;
}

async function listCompleteCheckoutSessions(stripe, customerId) {
  const sessions = [];
  let startingAfter;
  let hasMore = true;

  while (hasMore) {
    const params = { customer: customerId, limit: 100, status: 'complete' };
    if (startingAfter) params.starting_after = startingAfter;
    const page = await stripe.checkout.sessions.list(params);
    sessions.push(...page.data);
    hasMore = page.has_more;
    startingAfter = page.data.length ? page.data[page.data.length - 1].id : undefined;
    if (!page.data.length) hasMore = false;
  }

  return sessions;
}

async function findCheckoutSessionsByEmail(stripe, email) {
  const normalized = normalizeEmail(email);
  const found = new Map();
  let startingAfter;
  let pages = 0;
  const MAX_PAGES = 30;

  while (pages < MAX_PAGES) {
    const params = { limit: 100, status: 'complete' };
    if (startingAfter) params.starting_after = startingAfter;
    const page = await stripe.checkout.sessions.list(params);
    if (!page.data.length) break;

    for (const session of page.data) {
      const sessionEmail = normalizeEmail(session.customer_details?.email || session.customer_email);
      if (sessionEmail === normalized) found.set(session.id, session);
    }

    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
    pages++;
  }

  return [...found.values()];
}

async function reconcileEntitlementsFromStripe(email) {
  const stripe = getStripe();
  const normalized = normalizeEmail(email);
  if (!normalized) return emptyEntitlements();

  const customers = await listCustomersForEmail(normalized);
  const sessionIds = collectSessionIds(customers);

  for (const customer of customers) {
    const sessions = await listCompleteCheckoutSessions(stripe, customer.id);
    for (const session of sessions) sessionIds.add(session.id);
  }

  // Checkout sessions may have customer:null — discover by email directly
  const emailSessions = await findCheckoutSessionsByEmail(stripe, normalized);
  for (const session of emailSessions) sessionIds.add(session.id);

  let packPurchases = 0;
  let lifetime = false;
  let subscriptionActive = false;
  let subscriptionId = null;

  for (const sessionId of sessionIds) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription']
      });

      if (session.status !== 'complete') continue;

      const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
      if (!paid && session.mode !== 'subscription') continue;

      const product = session.metadata?.product;
      if (product === 'pack') packPurchases++;
      else if (product === 'lifetime') lifetime = true;
      else if (product === 'subscription') {
        subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id || subscriptionId;
      }
    } catch (err) {
      console.warn('[entitlements] Could not read session', sessionId, err.message);
    }
  }

  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      subscriptionActive = ['active', 'trialing'].includes(sub.status);
      if (!subscriptionActive) subscriptionId = null;
    } catch (_) {
      subscriptionId = null;
      subscriptionActive = false;
    }
  }

  if (!lifetime && !subscriptionActive) {
    for (const customer of customers) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 20 });
      const active = subs.data.find((s) => ['active', 'trialing'].includes(s.status));
      if (active) {
        subscriptionActive = true;
        subscriptionId = active.id;
        break;
      }
    }
  }

  const packValues = customers.map((c) => parseInt(c.metadata?.rl_pack_roasts || '0', 10) || 0);
  const packSum = packValues.reduce((a, b) => a + b, 0);
  const packMax = packValues.length ? Math.max(...packValues) : 0;
  const packFromSessions = packPurchases * PACK_SIZE;

  // Fallback when sessions can't be listed: multiple customers often each store one pack (10+10)
  let packRoasts = packFromSessions;
  if (packFromSessions === 0 && packSum > 0) {
    packRoasts = packSum;
  } else if (packFromSessions > 0 && packSum > packFromSessions && packValues.every((v) => v <= PACK_SIZE)) {
    packRoasts = packSum;
  } else if (packFromSessions === 0 && packMax > 0) {
    packRoasts = packMax;
  } else {
    packRoasts = Math.max(packFromSessions, packMax);
  }

  const ent = normalizeEntitlements({
    email: normalized,
    lifetime,
    subscriptionActive,
    subscriptionId,
    packRoasts,
    updatedAt: new Date().toISOString()
  });

  const metadata = {
    rl_sessions: [...sessionIds].join(','),
    rl_unlimited: ent.unlimited ? '1' : '0',
    rl_lifetime: ent.lifetime ? '1' : '0',
    rl_subscription_active: ent.subscriptionActive ? '1' : '0',
    rl_subscription_id: ent.subscriptionId || '',
    rl_pack_roasts: String(ent.packRoasts || 0),
    rl_updated_at: ent.updatedAt
  };

  if (customers.length) {
    await Promise.all(customers.map((customer) =>
      stripe.customers.update(customer.id, {
        metadata: { ...customer.metadata, ...metadata }
      })
    ));
  }

  await writeToKv(normalized, ent);
  console.log('[entitlements] Reconciled', normalized, 'sessions=', packPurchases, 'packRoasts=', ent.packRoasts, 'metaSum=', packSum, 'lifetime=', ent.lifetime, 'sub=', ent.subscriptionActive);

  return ent;
}

async function getEntitlements(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return emptyEntitlements();
  return reconcileEntitlementsFromStripe(normalized);
}

async function saveEntitlements(email, entitlements) {
  const normalized = normalizeEmail(email);
  const data = normalizeEntitlements({ ...entitlements, email: normalized }, normalized);
  await writeToKv(normalized, data);

  const stripe = getStripe();
  const customers = await listCustomersForEmail(normalized);
  const metadata = {
    rl_unlimited: data.unlimited ? '1' : '0',
    rl_lifetime: data.lifetime ? '1' : '0',
    rl_subscription_active: data.subscriptionActive ? '1' : '0',
    rl_subscription_id: data.subscriptionId || '',
    rl_pack_roasts: String(data.packRoasts || 0),
    rl_updated_at: data.updatedAt
  };

  if (!customers.length) {
    await stripe.customers.create({ email: normalized, metadata });
    return data;
  }

  await Promise.all(customers.map((customer) =>
    stripe.customers.update(customer.id, {
      metadata: { ...customer.metadata, ...metadata }
    })
  ));
  return data;
}

async function appendSessionToCustomers(email, sessionId) {
  const stripe = getStripe();
  const normalized = normalizeEmail(email);
  const customers = await listCustomersForEmail(normalized);

  await Promise.all(customers.map(async (customer) => {
    const existing = (customer.metadata?.rl_sessions || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (existing.includes(sessionId)) return;
    existing.push(sessionId);
    await stripe.customers.update(customer.id, {
      metadata: { ...customer.metadata, rl_sessions: existing.join(',') }
    });
  }));
}

function hasUnlimitedRoasts(ent) {
  const e = normalizeEntitlements(ent);
  return Boolean(e.lifetime || e.subscriptionActive);
}

function hasPremiumAccess(ent) {
  const e = normalizeEntitlements(ent);
  if (hasUnlimitedRoasts(e)) return true;
  return (e.packRoasts || 0) > 0;
}

async function getCustomerByEmail(email) {
  const customers = await listCustomersForEmail(email);
  return customers[0] || null;
}

async function resolveCustomerForSession(session) {
  const stripe = getStripe();
  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id;

  if (customerId) {
    if (typeof session.customer === 'object' && session.customer?.id) {
      return session.customer;
    }
    return stripe.customers.retrieve(customerId);
  }

  const email = normalizeEmail(session.customer_details?.email || session.customer_email);
  if (email) return getCustomerByEmail(email);
  return null;
}

async function resolveSessionEmail(session) {
  const email = normalizeEmail(session.customer_details?.email || session.customer_email);
  if (email) return email;

  const customer = await resolveCustomerForSession(session);
  return normalizeEmail(customer?.email);
}

async function grantFromCheckoutSession(session) {
  if (!session) throw new Error('Missing checkout session');

  const isSubscription = session.mode === 'subscription';
  const isPaid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';

  if (!isPaid && !isSubscription) {
    throw new Error('Checkout session is not paid');
  }

  const email = await resolveSessionEmail(session);
  const product = session.metadata?.product;
  const sessionId = session.id;

  if (!email || !sessionId) {
    throw new Error(`Missing email or session id (session=${sessionId || 'unknown'})`);
  }
  if (!VALID_PRODUCTS.includes(product)) {
    throw new Error(`Unknown product on checkout session: ${product || 'none'}`);
  }

  const customers = await listCustomersForEmail(email);
  const processed = collectSessionIds(customers);

  if (processed.has(sessionId)) {
    return {
      entitlements: await reconcileEntitlementsFromStripe(email),
      granted: false,
      email,
      product
    };
  }

  await appendSessionToCustomers(email, sessionId);
  const entitlements = await reconcileEntitlementsFromStripe(email);

  console.log('[entitlements] Granted', product, 'to', email, 'packRoasts=', entitlements.packRoasts);

  return { entitlements, granted: true, email, product };
}

async function syncSubscriptionStatus(subscription) {
  const stripe = getStripe();
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;

  if (!customerId) return;

  const customer = await stripe.customers.retrieve(customerId);
  const email = normalizeEmail(customer.email);
  if (!email) return;

  await reconcileEntitlementsFromStripe(email);
}

async function hasPurchases(email) {
  const ent = await getEntitlements(email);
  return hasUnlimitedRoasts(ent) || (ent.packRoasts || 0) > 0;
}

function toClientPayload(entitlements) {
  const ent = normalizeEntitlements(entitlements);
  const unlimitedRoasts = hasUnlimitedRoasts(ent);
  return {
    email: ent.email,
    unlimited: unlimitedRoasts,
    unlimitedRoasts,
    lifetime: ent.lifetime,
    subscriptionActive: ent.subscriptionActive,
    packRoasts: ent.packRoasts || 0,
    plan: ent.plan,
    premium: hasPremiumAccess(ent)
  };
}

// Legacy exports kept for compatibility
async function grantPack(email) {
  const ent = await getEntitlements(email);
  ent.packRoasts = (ent.packRoasts || 0) + PACK_SIZE;
  ent.plan = 'pack';
  return saveEntitlements(email, ent);
}

async function grantLifetime(email) {
  const ent = await getEntitlements(email);
  ent.lifetime = true;
  ent.plan = 'lifetime';
  return saveEntitlements(email, ent);
}

async function grantSubscription(email, subscriptionId) {
  const ent = await getEntitlements(email);
  ent.subscriptionActive = true;
  ent.subscriptionId = subscriptionId || ent.subscriptionId;
  ent.plan = ent.lifetime ? 'lifetime' : 'subscription';
  return saveEntitlements(email, ent);
}

async function revokeSubscription(email) {
  const ent = await getEntitlements(email);
  ent.subscriptionActive = false;
  ent.subscriptionId = null;
  ent.plan = ent.lifetime ? 'lifetime' : (ent.packRoasts > 0 ? 'pack' : 'none');
  return saveEntitlements(email, ent);
}

async function grantPurchase(email, product) {
  if (product === 'pack') return grantPack(email);
  if (product === 'lifetime') return grantLifetime(email);
  if (product === 'subscription') {
    throw new Error('Use grantSubscription with subscription id');
  }
  throw new Error(`Unknown product: ${product}`);
}

module.exports = {
  PACK_SIZE,
  VALID_PRODUCTS,
  emptyEntitlements,
  normalizeEntitlements,
  getEntitlements,
  reconcileEntitlementsFromStripe,
  saveEntitlements,
  grantPurchase,
  grantLifetime,
  grantSubscription,
  revokeSubscription,
  grantFromCheckoutSession,
  syncSubscriptionStatus,
  hasPurchases,
  hasUnlimitedRoasts,
  hasPremiumAccess,
  toClientPayload
};