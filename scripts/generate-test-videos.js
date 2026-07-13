#!/usr/bin/env node
/**
 * Generate sample roast videos for QA (2 Gen Z + 2 Brutal, different photos).
 * Verifies roast text is visible on frame 0 (t=0.0s).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  ROAST_WORD_MAX,
  HOOK_WORD_MIN,
  validateRoastFormat,
  countRoastWords
} = require('../lib/roast-prompts');
const { encodeFramesForTikTok, mp4HasAudioStream } = require('../lib/video-encode');
const { FPS } = require('../lib/video-frame-render');
const { VIDEO_TIMING, getFirstLineStyle } = require('../lib/video-timing');

const root = path.join(__dirname, '..');
const photosDir = path.join(root, 'assets', 'test-photos');
const outDir = path.join(root, 'assets', 'test-videos');
const logoPath = path.join(root, 'assets', 'roastlord-logo.png');

const TEST_CASES = [
  {
    id: 'genz-1',
    style: 'genz',
    photo: 'v5-genz-1.jpg',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&h=1000&fit=crop&crop=faces',
    roast: 'No cap your aura is cooked, bestie. This pic screams mid and skipped you.'
  },
  {
    id: 'genz-2',
    style: 'genz',
    photo: 'v5-genz-2.jpg',
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&h=1000&fit=crop&crop=faces',
    roast: 'Not you posting this delulu flex. Your rizz died and this vibe stays cooked.'
  },
  {
    id: 'brutal-1',
    style: 'brutal',
    photo: 'v5-brutal-1.jpg',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=1000&fit=crop&crop=faces',
    roast: 'Bro your face looks ugly today. That smirk makes everything ten times worse, period.'
  },
  {
    id: 'brutal-2',
    style: 'brutal',
    photo: 'v5-brutal-2.jpg',
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&h=1000&fit=crop&crop=faces',
    roast: 'Your face is ugly and embarrassing. You look stupid and that smirk makes it worse.'
  }
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, { headers: { 'User-Agent': 'RoastLord-Test/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    });
    req.on('error', (err) => {
      file.close();
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function ensurePhoto(caseDef) {
  const dest = path.join(photosDir, caseDef.photo);
  console.log(`  downloading ${caseDef.photo}...`);
  await downloadFile(caseDef.photoUrl, dest);
  return dest;
}

async function main() {
  let renderRoastVideoJpegFrames;
  let verifyTextVisibleAtFrameZero;
  try {
    ({ renderRoastVideoJpegFrames, verifyTextVisibleAtFrameZero } = require('../lib/video-frame-render'));
  } catch (err) {
    console.error('Missing canvas package. Run: npm install --save-dev canvas');
    console.error(err.message);
    process.exit(1);
  }

  const firstLine = getFirstLineStyle();
  if (firstLine.alpha !== 1 || firstLine.scale !== 1) {
    console.error('✗ FIRST_LINE_STYLE must be full opacity at t=0');
    process.exit(1);
  }

  fs.mkdirSync(photosDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  console.log('RoastLord test video generator');
  console.log(`Text visible at t=0.0s (frame 0) · ${VIDEO_TIMING.DURATION}s clips\n`);

  let allFrame0Ok = true;

  for (const tc of TEST_CASES) {
    const wc = countRoastWords(tc.roast);
    if (wc > ROAST_WORD_MAX) {
      console.error(`  ✗ ${tc.id} roast exceeds ${ROAST_WORD_MAX} words (${wc})`);
      process.exit(1);
    }

    const v = validateRoastFormat(tc.roast);
    console.log(`[${tc.id}] ${tc.style} — ${v.wordCount}w hook: "${v.hookWords}"`);
    if (v.hookWordCount < HOOK_WORD_MIN) {
      console.error(`  ✗ hook too short (${v.hookWordCount} words, need ${HOOK_WORD_MIN})`);
      process.exit(1);
    }

    const photoPath = await ensurePhoto(tc);

    const frame0Ok = await verifyTextVisibleAtFrameZero(photoPath, tc.roast, logoPath);
    if (frame0Ok) {
      console.log('  ✓ frame 0 (t=0.0s): roast text visible');
    } else {
      console.error('  ✗ frame 0 (t=0.0s): roast text NOT visible');
      allFrame0Ok = false;
    }

    const totalFrames = FPS * VIDEO_TIMING.DURATION;
    console.log(`  rendering ${totalFrames} frames...`);
    const frames = await renderRoastVideoJpegFrames(photoPath, tc.roast, logoPath);
    console.log('  encoding MP4 + music...');
    const mp4 = await encodeFramesForTikTok(frames, FPS);
    const hasAudio = await mp4HasAudioStream(mp4);
    if (!hasAudio) {
      console.error('  ✗ MP4 has no audio stream');
      process.exit(1);
    }
    console.log('  ✓ audio stream present');
    const outPath = path.join(outDir, `test-${tc.id}.mp4`);
    fs.writeFileSync(outPath, mp4);
    const kb = Math.round(mp4.length / 1024);
    console.log(`  ✓ ${outPath} (${kb} KB)\n`);
  }

  if (!allFrame0Ok) {
    console.error('FAILED — not all videos have text at frame 0');
    process.exit(1);
  }

  console.log('Done — 4 test videos confirmed: text at 0.0s on frame 0, background music muxed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});