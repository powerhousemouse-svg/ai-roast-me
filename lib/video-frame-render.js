/**
 * Server-side roast video frame renderer (matches index.html drawRoastVideoFrame).
 * Requires the `canvas` package.
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const {
  VIDEO_TIMING,
  getFirstLineStyle,
  getPhotoStyle,
  getVideoLineStagger,
  getExtraLineProgress
} = require('./video-timing');
const { VIDEO_TEXT_LAYOUT } = require('./video-text-layout');

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;

function tryRegisterInterFont() {
  const candidates = [
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/Library/Fonts/Arial Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
  ];
  for (const fontPath of candidates) {
    if (fs.existsSync(fontPath)) {
      try {
        registerFont(fontPath, { family: 'RoastVideoFont', weight: 'bold' });
        return '800 RoastVideoFont';
      } catch {
        /* try next */
      }
    }
  }
  return '800 Arial, Helvetica, sans-serif';
}

const FONT_FAMILY = tryRegisterInterFont();

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
  const words = text.split(/\s+/);
  const out = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const test = cur ? `${cur} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && cur) {
      out.push(cur);
      cur = words[i];
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

function drawLogoOnCanvas(ctx, logo, centerX, topY, maxHeight) {
  const ratio = logo.width / Math.max(1, logo.height);
  const h = maxHeight;
  const w = h * ratio;
  ctx.drawImage(logo, centerX - w / 2, topY, w, h);
}

function buildRoastVideoLayout(ctx, photo, roastText) {
  const {
    MARGIN,
    PHOTO_ZONE_Y,
    PHOTO_MAX_H,
    TEXT_GAP,
    TEXT_BOTTOM_PAD,
    LOGO_Y,
    LOGO_H,
    SIZE_STEPS
  } = VIDEO_TEXT_LAYOUT;

  const photoMaxW = WIDTH - MARGIN * 2;

  const imgRatio = photo.width / Math.max(1, photo.height);
  let dW = photoMaxW;
  let dH = dW / imgRatio;
  if (dH > PHOTO_MAX_H) {
    dH = PHOTO_MAX_H;
    dW = dH * imgRatio;
  }
  const pX = Math.round((WIDTH - dW) / 2);
  const pY = Math.round(PHOTO_ZONE_Y + (PHOTO_MAX_H - dH) / 2);

  const textY0 = PHOTO_ZONE_Y + PHOTO_MAX_H + TEXT_GAP;
  const textBottom = HEIGHT - TEXT_BOTTOM_PAD;
  const textMaxWidth = WIDTH - MARGIN * 2;
  const textX = WIDTH / 2;

  const paras = roastText.split(/\n+/).map((p) => p.trim()).filter(Boolean);

  let lines = [];
  let fSize = SIZE_STEPS[0].fSize;
  let lh = SIZE_STEPS[0].lh;
  for (const step of SIZE_STEPS) {
    fSize = step.fSize;
    lh = step.lh;
    ctx.font = `${FONT_FAMILY} ${fSize}px`;
    lines = [];
    for (const p of paras) {
      lines.push(...wrapTextToLines(ctx, p, textMaxWidth));
    }
    const blockH = lines.length * lh;
    if (blockH <= textBottom - textY0 || step === SIZE_STEPS[SIZE_STEPS.length - 1]) break;
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
    logoY: LOGO_Y,
    logoH: LOGO_H
  };
}

function drawRoastVideoFrame(ctx, layout, assets, timeSec) {
  const { width, height, photo: ph, lines, lh, textX, textY0, logoY, logoH } = layout;
  const { photo, logo } = assets;
  const { DURATION, LOGO_START } = VIDEO_TIMING;
  const photoStyle = getPhotoStyle();

  drawVideoBackground(ctx, width, height);

  if (photoStyle.alpha > 0.001) {
    const cx = ph.x + ph.w / 2;
    const cy = ph.y + ph.h / 2;
    ctx.save();
    ctx.globalAlpha = photoStyle.alpha;
    ctx.translate(cx, cy);
    ctx.scale(photoStyle.scale, photoStyle.scale);
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
  }

  const visibleLines = lines.filter(Boolean);
  const lineCount = Math.max(1, visibleLines.length);
  const lineStagger = getVideoLineStagger(lineCount);

  ctx.font = `${FONT_FAMILY} ${layout.fSize}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const firstLine = getFirstLineStyle();
  let ty = textY0;
  visibleLines.forEach((ln, i) => {
    const anim = i === 0 ? firstLine : getExtraLineProgress(timeSec, i, lineStagger);
    if (!anim || anim.alpha <= 0.001) return;
    drawMemeTextLineAnimated(ctx, ln, textX, ty, anim.alpha, anim.scale);
    ty += lh;
  });

  if (timeSec >= LOGO_START) {
    const logoP = easeOutCubic((timeSec - LOGO_START) / (DURATION - LOGO_START));
    ctx.save();
    ctx.globalAlpha = logoP;
    if (logo) {
      drawLogoOnCanvas(ctx, logo, width / 2, logoY, logoH);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd700';
      ctx.font = `${FONT_FAMILY} 48px`;
      ctx.fillText('ROASTLORD', width / 2, logoY + 12);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = `${FONT_FAMILY} 26px`;
    ctx.fillText('@roastlord.com', width / 2, logoY + (logo ? logoH + 18 : 58));
    ctx.restore();
  }
}

async function renderRoastVideoJpegFrames(photoPath, roastText, logoPath) {
  const photo = await loadImage(photoPath);
  const logo = logoPath && fs.existsSync(logoPath) ? await loadImage(logoPath) : null;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const layout = buildRoastVideoLayout(ctx, photo, roastText);
  const assets = { photo, logo };

  const totalFrames = FPS * VIDEO_TIMING.DURATION;
  const frames = [];

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = Math.min(VIDEO_TIMING.DURATION, frame / FPS);
    drawRoastVideoFrame(ctx, layout, assets, t);
    frames.push(canvas.toBuffer('image/jpeg', { quality: 0.82 }));
  }

  return frames;
}

/** Returns true if white roast text pixels are present at t=0 (frame 0). */
async function verifyTextVisibleAtFrameZero(photoPath, roastText, logoPath) {
  const photo = await loadImage(photoPath);
  const logo = logoPath && fs.existsSync(logoPath) ? await loadImage(logoPath) : null;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const layout = buildRoastVideoLayout(ctx, photo, roastText);
  drawRoastVideoFrame(ctx, layout, { photo, logo }, 0);

  const sampleY = Math.floor(layout.textY0);
  const sampleH = Math.ceil(Math.max(layout.lh, layout.lines.length * layout.lh));
  const { data } = ctx.getImageData(0, sampleY, WIDTH, sampleH);

  let brightPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 200 && g > 200 && b > 200) brightPixels++;
  }
  return brightPixels >= 80;
}

module.exports = {
  WIDTH,
  HEIGHT,
  FPS,
  drawRoastVideoFrame,
  buildRoastVideoLayout,
  renderRoastVideoJpegFrames,
  verifyTextVisibleAtFrameZero
};