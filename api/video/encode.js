const { encodeForTikTok, encodeFramesForTikTok } = require('../../lib/video-encode');
const { normalizeBeatIndex } = require('../../lib/video-music');

async function readBodyBuffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function detectInputExt(contentType, buffer) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('webm')) return 'webm';
  if (ct.includes('mp4')) return 'mp4';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45) return 'webm';
  if (buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return 'mp4';
  return 'webm';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Encode-Mode, X-Frame-Count, X-Fps, X-Beat-Index');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await readBodyBuffer(req);
    if (!body || body.length < 64) {
      return res.status(400).json({ error: 'Missing video data' });
    }

    const mode = (req.headers['x-encode-mode'] || '').toLowerCase();
    const beatIndex = normalizeBeatIndex(req.headers['x-beat-index']);
    const encodeOpts = { beatIndex };
    let mp4;

    if (mode === 'frames') {
      const frameCount = parseInt(req.headers['x-frame-count'] || '0', 10);
      const fps = parseInt(req.headers['x-fps'] || '30', 10);
      if (!frameCount || frameCount < 1) {
        return res.status(400).json({ error: 'Invalid frame count' });
      }
      const frames = [];
      let offset = 0;
      for (let i = 0; i < frameCount; i++) {
        if (offset + 4 > body.length) break;
        const len = body.readUInt32BE(offset);
        offset += 4;
        if (offset + len > body.length) break;
        frames.push(body.subarray(offset, offset + len));
        offset += len;
      }
      if (frames.length !== frameCount) {
        return res.status(400).json({ error: 'Frame payload incomplete' });
      }
      mp4 = await encodeFramesForTikTok(frames, fps, encodeOpts);
    } else {
      const ext = detectInputExt(req.headers['content-type'], body);
      mp4 = await encodeForTikTok(body, ext, 5, encodeOpts);
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('X-Beat-Index', String(beatIndex));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(mp4);
  } catch (err) {
    console.error('[api/video/encode]', err);
    return res.status(500).json({ error: err.message || 'Video encode failed' });
  }
};

module.exports.config = {
  api: { bodyParser: false },
  maxDuration: 60
};