const { analyzePhotoAge, BLOCK_MESSAGE, resolveRoastStyle } = require('../lib/age-check');
const { callXaiVision } = require('../lib/xai');
const {
  getRoastSystemPrompt,
  buildRoastPrompt,
  getMaxTokensForLength,
  cleanRoastText,
  enforceRoastFormat
} = require('../lib/roast-prompts');

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

  const { imageBase64, style = 'brutal' } = body || {};
  if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length < 100) {
    return res.status(400).json({ error: 'Missing or invalid imageBase64' });
  }

  const allowedStyles = ['normal', 'brutal', 'british', 'genz', 'dad'];
  const safeStyle = allowedStyles.includes(style) ? style : 'brutal';

  try {
    const { policy } = await analyzePhotoAge(apiKey, imageBase64);

    if (policy.action === 'block') {
      return res.status(403).json({
        blocked: true,
        code: policy.code || 'MINORS_ONLY',
        message: policy.message || BLOCK_MESSAGE
      });
    }

    const effectiveStyle = resolveRoastStyle(safeStyle, policy);

    const roastRaw = await callXaiVision(apiKey, {
      system: getRoastSystemPrompt(),
      userText: buildRoastPrompt(effectiveStyle, 'viral', policy),
      imageBase64,
      temperature: 0.95,
      maxTokens: getMaxTokensForLength()
    });

    const roast = enforceRoastFormat(cleanRoastText(roastRaw));
    if (!roast) {
      return res.status(502).json({ error: 'RoastLord did not return a roast' });
    }

    return res.status(200).json({
      roast,
      style: effectiveStyle,
      requestedStyle: safeStyle,
      length: 'viral',
      minorShield: Boolean(policy.shieldMinors),
      styleAdjusted: effectiveStyle !== safeStyle,
      agePolicy: {
        shieldMinors: Boolean(policy.shieldMinors),
        allowBrutal: Boolean(policy.allowBrutal),
        allowExplicit: Boolean(policy.allowExplicit),
        ageTier: policy.ageTier || 'unknown'
      }
    });
  } catch (err) {
    console.error('[api/roast]', err);
    const status = err.status >= 400 && err.status < 600 ? err.status : 500;
    return res.status(status >= 500 ? 502 : status).json({ error: err.message || 'Roast generation failed' });
  }
};