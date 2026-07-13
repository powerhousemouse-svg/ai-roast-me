const Stripe = require('stripe');

let stripe;

function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    stripe = new Stripe(key, { apiVersion: '2024-11-20.acacia' });
  }
  return stripe;
}

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET
    || process.env.strip_secret_STRIPE_WEBHOOK_SECRET
    || '';
}

function getSiteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://www.roastlord.com';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

module.exports = { getStripe, getWebhookSecret, getSiteUrl, normalizeEmail };