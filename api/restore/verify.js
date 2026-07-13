const { verifyRestoreToken } = require('../../lib/restore-token');
const { getEntitlements, toClientPayload } = require('../../lib/entitlements');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.query?.token;
  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  const payload = verifyRestoreToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired restore link' });
  }

  try {
    const entitlements = await getEntitlements(payload.email);
    return res.status(200).json(toClientPayload(entitlements));
  } catch (err) {
    console.error('[restore/verify]', err);
    return res.status(500).json({ error: err.message || 'Restore failed' });
  }
};