/** Shared roast video text sizing — large mobile-readable typography. */

const VIDEO_TEXT_LAYOUT = {
  MARGIN: 40,
  PHOTO_ZONE_Y: 100,
  PHOTO_MAX_H: 700,
  TEXT_GAP: 36,
  TEXT_BOTTOM_PAD: 280,
  LOGO_Y: 1640,
  LOGO_H: 72,
  SIZE_STEPS: [
    { fSize: 78, lh: 94 },
    { fSize: 68, lh: 82 },
    { fSize: 58, lh: 70 },
    { fSize: 50, lh: 60 }
  ],
  MIN_FONT_SIZE: 50
};

module.exports = { VIDEO_TEXT_LAYOUT };