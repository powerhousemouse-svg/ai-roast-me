#!/usr/bin/env node
/**
 * Generate 6 improved roast test videos (3 Brutal + 3 Gen Z) with music.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  ROAST_WORD_MAX,
  HOOK_WORD_MIN,
  validateRoastFormat
} = require('../lib/roast-prompts');
const { encodeFramesForTikTok, mp4HasAudioStream } = require('../lib/video-encode');
const { FPS } = require('../lib/video-frame-render');
const { VIDEO_TIMING } = require('../lib/video-timing');

const root = path.join(__dirname, '..');
const photosDir = path.join(root, 'assets', 'test-photos');
const outDir = path.join(root, 'assets', 'test-videos');
const logoPath = path.join(root, 'assets', 'roastlord-logo.png');

const TEST_CASES = [
  {
    id: 'v6-brutal-1',
    style: 'brutal',
    photo: 'v6-brutal-1.jpg',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=1000&fit=crop&crop=faces',
    roast: 'Bro your smirk is stupid ugly. That face ruins the whole photo, period.'
  },
  {
    id: 'v6-brutal-2',
    style: 'brutal',
    photo: 'v6-brutal-2.jpg',
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&h=1000&fit=crop&crop=faces',
    roast: 'Your face is genuinely embarrassing today. That grin makes you look even stupider.'
  },
  {
    id: 'v6-brutal-3',
    style: 'brutal',
    photo: 'v6-brutal-3.jpg',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&h=1000&fit=crop&crop=faces',
    roast: 'Bro you look tired and ugly. That dead stare killed whatever vibe you had.'
  },
  {
    id: 'v6-genz-1',
    style: 'genz',
    photo: 'v6-genz-1.jpg',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&h=1000&fit=crop&crop=faces',
    roast: 'No cap your aura is cooked. That smile screams mid and zero rizz.'
  },
  {
    id: 'v6-genz-2',
    style: 'genz',
    photo: 'v6-genz-2.jpg',
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&h=1000&fit=crop&crop=faces',
    roast: 'Not you posting this delulu pic. Your face is mid and giving NPC.'
  },
  {
    id: 'v6-genz-3',
    style: 'genz',
    photo: 'v6-genz-3.jpg',
    photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&h=1000&fit=crop&crop=faces',
    roast: 'Bro your rizz died on arrival. This fit is mid and you\'re cooked.'
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

async function main() {
  const { renderRoastVideoJpegFrames, verifyTextVisibleAtFrameZero } = require('../lib/video-frame-render');

  fs.mkdirSync(photosDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  console.log('RoastLord v6 test video generator (improved roasts)\n');

  let allOk = true;

  for (const tc of TEST_CASES) {
    const v = validateRoastFormat(tc.roast);
    if (v.wordCount > ROAST_WORD_MAX || v.hookWordCount < HOOK_WORD_MIN) {
      console.error(`  ✗ ${tc.id} invalid format (${v.wordCount}w, hook ${v.hookWordCount}w)`);
      process.exit(1);
    }

    console.log(`[${tc.id}] ${tc.style} — ${v.wordCount}w · hook: "${v.hookWords}"`);
    console.log(`  "${tc.roast}"`);

    const photoPath = path.join(photosDir, tc.photo);
    console.log(`  downloading ${tc.photo}...`);
    await downloadFile(tc.photoUrl, photoPath);

    const frame0Ok = await verifyTextVisibleAtFrameZero(photoPath, tc.roast, logoPath);
    if (!frame0Ok) {
      console.error('  ✗ frame 0: text NOT visible');
      allOk = false;
    } else {
      console.log('  ✓ frame 0: text visible');
    }

    const frames = await renderRoastVideoJpegFrames(photoPath, tc.roast, logoPath);
    console.log(`  encoding ${frames.length} frames + music...`);
    const mp4 = await encodeFramesForTikTok(frames, FPS);
    const hasAudio = await mp4HasAudioStream(mp4);
    if (!hasAudio) {
      console.error('  ✗ MP4 has no audio stream');
      process.exit(1);
    }

    const outPath = path.join(outDir, `test-${tc.id}.mp4`);
    fs.writeFileSync(outPath, mp4);
    console.log(`  ✓ audio + video → ${outPath} (${Math.round(mp4.length / 1024)} KB)\n`);
  }

  if (!allOk) process.exit(1);
  console.log(`Done — 6 v6 test videos (${VIDEO_TIMING.DURATION}s each, 3 Brutal + 3 Gen Z)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});