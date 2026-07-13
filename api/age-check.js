const { analyzePhotoAge } = require('../lib/age-check');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'XAI_API_KEY is not configured on the server' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { imageBase64 } = body || {};
  if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length < 100) {
    return res.status(400).json({ error: 'Missing or invalid imageBase64' });
  }

  try {
    const { policy } = await analyzePhotoAge(apiKey, imageBase64);
    return res.status(200).json({
      policy: {
        action: policy.action,
        code: policy.code || null,
        message: policy.message || null,
        shieldMinors: Boolean(policy.shieldMinors),
        allowBrutal: Boolean(policy.allowBrutal),
        allowExplicit: Boolean(policy.allowExplicit),
        ageTier: policy.ageTier || 'unknown',
        uncertain: Boolean(policy.uncertain)
      }
    });
  } catch (err) {
    console.error('[api/age-check]', err);
    return res.status(502).json({ error: err.message || 'Age check failed' });
  }
};