/**
 * Internal bulk-test engine — roast API + TikTok video frame encode.
 * Bundled for bulk-test.html only.
 */

const VIDEO_ENCODE_API = '/api/video/encode';
const VIDEO_ENCODE_MAX_BODY = 4.0 * 1024 * 1024;
const ROAST_BEAT_COUNT = 5;

const VIDEO_TIMING = {
  DURATION: 5,
  TEXT_DONE_BY: 3.0,
  EXTRA_LINE_POP: 0.1,
  EXTRA_LINE_START: 0.12,
  LINE_STAGGER_MAX: 0.16,
  LINE_STAGGER_MIN: 0.06,
  LOGO_START: 4.0
};

const FIRST_LINE_STYLE = { alpha: 1, scale: 1 };

let statusCallback = () => {};

function setStatusCallback(fn) {
  statusCallback = typeof fn === 'function' ? fn : () => {};
}

function setStatus(msg) {
  statusCallback(msg);
}

function isApiProxyEnabled() {
  return Boolean(window.__ROASTLORD_ENV__?.API_PROXY_ENABLED);
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(t) {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

function easeOutBack(t) {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isSafari() {
  const ua = navigator.userAgent;
  return (/Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/i.test(ua)) || isIOS();
}

function getVideoExportSize() {
  return isSafari() ? { w: 540, h: 960 } : { w: 720, h: 1280 };
}

function pickRandomBeatIndex() {
  return 1 + Math.floor(Math.random() * ROAST_BEAT_COUNT);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapTextToLines(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const out = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width > maxW && cur) {
      out.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function drawMemeTextLine(ctx, text, x, y, fillStyle) {
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 12;
  ctx.strokeText(text, x, y);
  ctx.lineWidth = 7;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillStyle || '#ffffff';
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function drawMemeTextLineAnimated(ctx, text, x, y, alpha, scale, fillStyle) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-x, -y);
  drawMemeTextLine(ctx, text, x, y, fillStyle);
  ctx.restore();
}

function drawVideoBackground(ctx, width, height) {
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#101018');
  bgGrad.addColorStop(0.5, '#07070b');
  bgGrad.addColorStop(1, '#020203');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width / 2, height * 0.28, 20, width / 2, height * 0.32, 520);
  glow.addColorStop(0, 'rgba(255, 215, 0, 0.08)');
  glow.addColorStop(0.55, 'rgba(34, 255, 136, 0.04)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function getVideoLineStagger(lineCount) {
  if (lineCount <= 1) return 0;
  const t = VIDEO_TIMING;
  const needed = (t.TEXT_DONE_BY - t.EXTRA_LINE_START - t.EXTRA_LINE_POP) / (lineCount - 1);
  return Math.min(t.LINE_STAGGER_MAX, Math.max(t.LINE_STAGGER_MIN, needed));
}

function getExtraLineProgress(timeSec, lineIndex, lineStagger) {
  if (lineIndex < 1) return null;
  const lineStart = VIDEO_TIMING.EXTRA_LINE_START + (lineIndex - 1) * lineStagger;
  const local = (timeSec - lineStart) / VIDEO_TIMING.EXTRA_LINE_POP;
  if (local <= 0) return null;
  const eased = easeOutBack(clamp01(local));
  return {
    alpha: easeOutCubic(clamp01(local * 3.5)),
    scale: 0.96 + 0.04 * eased
  };
}

function buildRoastVideoLayout(ctx, photo, roastText) {
  const WIDTH = 1080;
  const HEIGHT = 1920;
  const MARGIN = 40;
  const photoMaxW = WIDTH - MARGIN * 2;
  const photoMaxH = 700;
  const photoZoneY = 100;

  const imgRatio = photo.naturalWidth / Math.max(1, photo.naturalHeight);
  let dW = photoMaxW;
  let dH = dW / imgRatio;
  if (dH > photoMaxH) {
    dH = photoMaxH;
    dW = dH * imgRatio;
  }
  const pX = Math.round((WIDTH - dW) / 2);
  const pY = Math.round(photoZoneY + (photoMaxH - dH) / 2);

  const textY0 = photoZoneY + photoMaxH + 36;
  const textBottom = HEIGHT - 280;
  const textMaxWidth = WIDTH - MARGIN * 2;
  const textX = WIDTH / 2;

  const paras = String(roastText || '').split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const sizeSteps = [
    { fSize: 78, lh: 94 },
    { fSize: 68, lh: 82 },
    { fSize: 58, lh: 70 },
    { fSize: 50, lh: 60 }
  ];

  let lines = [];
  let fSize = 78;
  let lh = 94;
  for (const step of sizeSteps) {
    fSize = step.fSize;
    lh = step.lh;
    ctx.font = `800 ${fSize}px Inter, system-ui, -apple-system, sans-serif`;
    lines = [];
    for (const p of paras) {
      lines.push(...wrapTextToLines(ctx, p, textMaxWidth));
    }
    const blockH = lines.length * lh;
    if (blockH <= textBottom - textY0 || step === sizeSteps[sizeSteps.length - 1]) break;
  }

  return {
    width: WIDTH,
    height: HEIGHT,
    photo: { x: pX, y: pY, w: dW, h: dH, pad: 6, radius: 22 },
    lines,
    fSize,
    lh,
    textX,
    textY0,
    logoY: 1640,
    logoH: 72
  };
}

function drawRoastVideoFrame(ctx, layout, assets, timeSec) {
  const { width, height, photo: ph, lines, fSize, lh, textX, textY0, logoY, logoH } = layout;
  const { photo, logo } = assets;
  const { LOGO_START } = VIDEO_TIMING;

  drawVideoBackground(ctx, width, height);

  const cx = ph.x + ph.w / 2;
  const cy = ph.y + ph.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = '#0a0a0e';
  roundRectPath(ctx, ph.x - ph.pad, ph.y - ph.pad, ph.w + ph.pad * 2, ph.h + ph.pad * 2, ph.radius);
  ctx.fill();
  ctx.strokeStyle = 'rgba(34, 255, 136, 0.45)';
  ctx.lineWidth = 3;
  roundRectPath(ctx, ph.x - ph.pad, ph.y - ph.pad, ph.w + ph.pad * 2, ph.h + ph.pad * 2, ph.radius);
  ctx.stroke();
  ctx.save();
  roundRectPath(ctx, ph.x, ph.y, ph.w, ph.h, ph.radius - 4);
  ctx.clip();
  ctx.drawImage(photo, ph.x, ph.y, ph.w, ph.h);
  ctx.restore();
  ctx.restore();

  const visibleLines = lines.filter(Boolean);
  const lineCount = Math.max(1, visibleLines.length);
  const lineStagger = getVideoLineStagger(lineCount);

  ctx.font = `800 ${fSize}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let ty = textY0;

  visibleLines.forEach((ln, i) => {
    const anim = i === 0 ? FIRST_LINE_STYLE : getExtraLineProgress(timeSec, i, lineStagger);
    if (!anim || anim.alpha <= 0.001) return;
    drawMemeTextLineAnimated(ctx, ln, textX, ty, anim.alpha, anim.scale);
    ty += lh;
  });

  if (timeSec >= LOGO_START) {
    const logoP = easeOutCubic((timeSec - LOGO_START) / (VIDEO_TIMING.DURATION - LOGO_START));
    ctx.save();
    ctx.globalAlpha = logoP;
    if (logo) {
      const ratio = logo.naturalWidth / Math.max(1, logo.naturalHeight);
      const h = logoH;
      const w = h * ratio;
      ctx.drawImage(logo, width / 2 - w / 2, logoY, w, h);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd700';
      ctx.font = '800 48px Inter, system-ui, sans-serif';
      ctx.fillText('ROASTLORD', width / 2, logoY + 12);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '700 26px Inter, system-ui, sans-serif';
    ctx.fillText('@roastlord.com', width / 2, logoY + (logo ? logoH + 18 : 58));
    ctx.restore();
  }
}

function canvasToJpegBlob(canvas, quality = 0.58) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function estimateJpegQuality(sampleBytes, totalFrames) {
  const overhead = totalFrames * 4;
  const budget = VIDEO_ENCODE_MAX_BODY - overhead;
  const pad = isSafari() ? 1.45 : 1.12;
  const projected = sampleBytes * totalFrames * pad;
  if (projected <= budget) return isSafari() ? 0.52 : 0.62;
  const scale = budget / projected;
  const maxQ = isSafari() ? 0.52 : 0.62;
  const minQ = isSafari() ? 0.26 : 0.38;
  return Math.max(minQ, Math.min(maxQ, maxQ * scale));
}

async function packJpegFrameBundle(jpegBlobs) {
  const parts = await Promise.all(jpegBlobs.map((blob) => blob.arrayBuffer()));
  let total = 0;
  for (const buf of parts) total += 4 + buf.byteLength;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let offset = 0;
  for (const buf of parts) {
    const bytes = new Uint8Array(buf);
    view.setUint32(offset, bytes.byteLength, false);
    offset += 4;
    out.set(bytes, offset);
    offset += bytes.byteLength;
  }
  return new Blob([out], { type: 'application/octet-stream' });
}

async function encodeVideoOnServer(blob, opts = {}) {
  const headers = { 'Content-Type': blob.type || 'application/octet-stream' };
  headers['X-Beat-Index'] = String(opts.beatIndex ?? pickRandomBeatIndex());
  if (opts.mode === 'frames') {
    headers['X-Encode-Mode'] = 'frames';
    headers['X-Frame-Count'] = String(opts.frameCount);
    headers['X-Fps'] = String(opts.fps || 30);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  let res;
  try {
    res = await fetch(VIDEO_ENCODE_API, { method: 'POST', headers, body: blob, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err.error || '';
    } catch (_) {}
    throw new Error(detail || `Server encode failed (${res.status})`);
  }
  return await res.blob();
}

async function renderRoastVideoFramesOnce(sourceCanvas, exportCanvas, drawAtFrame, totalFrames, forcedQuality = null) {
  const exportCtx = exportCanvas.getContext('2d', { alpha: false });
  const frames = [];
  let quality = forcedQuality;

  for (let frame = 0; frame < totalFrames; frame++) {
    drawAtFrame(frame);
    exportCtx.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    if (quality == null && frame === 0) {
      const sample = await canvasToJpegBlob(exportCanvas, isSafari() ? 0.52 : 0.62);
      if (!sample) throw new Error('Failed to render video frame');
      quality = estimateJpegQuality(sample.size, totalFrames);
    }
    const jpeg = await canvasToJpegBlob(exportCanvas, quality);
    if (!jpeg) throw new Error('Failed to render video frame');
    frames.push(jpeg);
    if (frame % 15 === 0) {
      setStatus(`Rendering frames… ${Math.round((frame / totalFrames) * 100)}%`);
    }
  }
  return frames;
}

async function tryServerFrameEncode(jpegBlobs, fps = 30, beatIndex) {
  const bundle = await packJpegFrameBundle(jpegBlobs);
  if (bundle.size > VIDEO_ENCODE_MAX_BODY) {
    throw new Error(`Frame bundle too large (${Math.round(bundle.size / 1024)}KB)`);
  }
  setStatus('Encoding MP4 + music…');
  const mp4 = await encodeVideoOnServer(bundle, {
    mode: 'frames',
    frameCount: jpegBlobs.length,
    fps,
    beatIndex
  });
  return mp4?.size > 1024 ? mp4 : null;
}

let logoPromise = null;

function loadRoastLordLogo() {
  if (!logoPromise) {
    logoPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Logo failed to load'));
      img.src = '/assets/roastlord-logo.png';
    });
  }
  return logoPromise;
}

async function ensureFonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load('800 78px Inter'),
    document.fonts.load('700 26px Inter')
  ]).catch(() => {});
  await document.fonts.ready;
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function resizeImageToBase64(file, maxSize = 1024) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      let { width, height } = bitmap;
      const scale = Math.min(1, maxSize / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();
      return canvas.toDataURL('image/jpeg', 0.88).split(',')[1];
    } catch (_) {}
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to decode image'));
    el.src = dataUrl;
  });

  let { width, height } = img;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.88).split(',')[1];
}

async function fetchRoast(imageBase64, style) {
  if (!isApiProxyEnabled()) {
    throw new Error('Bulk test requires server API proxy (deploy to Vercel or run vercel dev with XAI_API_KEY).');
  }

  const response = await fetch('/api/roast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, style })
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 403 && data.blocked) {
    throw new Error(data.message || 'Photo blocked by age policy');
  }
  if (!response.ok) {
    throw new Error(data.error || `Roast API error: ${response.status}`);
  }
  const roast = String(data.roast || '').trim();
  if (!roast) throw new Error('Empty roast returned');
  return { roast, style: data.style || style };
}

async function generateRoastVideo(photoUrl, roastText) {
  await ensureFonts();
  const [logo, photo] = await Promise.all([
    loadRoastLordLogo().catch(() => null),
    loadImageFromUrl(photoUrl)
  ]);

  const WIDTH = 1080;
  const HEIGHT = 1920;
  const FPS = 30;
  const TOTAL_FRAMES = FPS * VIDEO_TIMING.DURATION;
  const beatIndex = pickRandomBeatIndex();

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d', { alpha: false });
  const { w: exportW, h: exportH } = getVideoExportSize();
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = exportW;
  exportCanvas.height = exportH;

  const layout = buildRoastVideoLayout(ctx, photo, roastText);
  const assets = { photo, logo };

  const drawAtFrame = (frame) => {
    const t = Math.min(VIDEO_TIMING.DURATION, frame / FPS);
    drawRoastVideoFrame(ctx, layout, assets, t);
  };

  setStatus('Rendering frames… 0%');
  let frames = await renderRoastVideoFramesOnce(canvas, exportCanvas, drawAtFrame, TOTAL_FRAMES);

  try {
    const mp4 = await tryServerFrameEncode(frames, FPS, beatIndex);
    if (mp4) return mp4;
  } catch (err) {
    if (err.message?.includes('too large')) {
      setStatus('Retrying with lower quality…');
      frames = await renderRoastVideoFramesOnce(canvas, exportCanvas, drawAtFrame, TOTAL_FRAMES, 0.26);
      const retryMp4 = await tryServerFrameEncode(frames, FPS, beatIndex);
      if (retryMp4) return retryMp4;
    }
    throw err;
  }

  throw new Error('Video encode failed');
}

const BulkTestEngine = {
  setStatusCallback,
  resizeImageToBase64,
  fetchRoast,
  generateRoastVideo,
  isApiProxyEnabled
};

window.BulkTestEngine = BulkTestEngine;