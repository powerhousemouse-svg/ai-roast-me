const crypto = require('crypto');

function getSecret() {
  return process.env.RESTORE_JWT_SECRET || process.env.STRIPE_SECRET_KEY || 'roastlord-dev-secret';
}

function signRestoreToken(email) {
  const payload = {
    email: String(email || '').trim().toLowerCase(),
    exp: Date.now() + 30 * 60 * 1000
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyRestoreToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.email || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { signRestoreToken, verifyRestoreToken };