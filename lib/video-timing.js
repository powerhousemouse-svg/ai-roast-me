/** Shared roast video timing — first-line text is full opacity at t=0 (frame 0). */

const VIDEO_TIMING = {
  DURATION: 5,
  TEXT_DONE_BY: 3.0,
  EXTRA_LINE_POP: 0.1,
  EXTRA_LINE_START: 0.12,
  LINE_STAGGER_MAX: 0.16,
  LINE_STAGGER_MIN: 0.06,
  LOGO_START: 4.0
};

/** First roast line: visible at full size from frame 0 — no fade delay. */
const FIRST_LINE_STYLE = { alpha: 1, scale: 1 };

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

function getFirstLineStyle() {
  return FIRST_LINE_STYLE;
}

/** Photo visible from frame 0 (matches instant text). */
function getPhotoStyle() {
  return { alpha: 1, scale: 1 };
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

module.exports = {
  VIDEO_TIMING,
  FIRST_LINE_STYLE,
  clamp01,
  easeOutCubic,
  easeOutBack,
  getFirstLineStyle,
  getPhotoStyle,
  getVideoLineStagger,
  getExtraLineProgress
};