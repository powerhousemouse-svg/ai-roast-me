#!/usr/bin/env node
/**
 * Generate 3 roast test videos with random background beats.
 * Verifies each MP4 contains an audio stream.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { ROAST_WORD_MAX, validateRoastFormat } = require('../lib/roast-prompts');
const { encodeFramesForTikTok, mp4HasAudioStream } = require('../lib/video-encode');
const { pickRandomBeatIndex, BEAT_FILES } = require('../lib/video-music');
const { FPS } = require('../lib/video-frame-render');
const { VIDEO_TIMING } = require('../lib/video-timing');

const root = path.join(__dirname, '..');
const photosDir = path.join(root, 'assets', 'test-photos');
const outDir = path.join(root, 'assets', 'test-videos');
const logoPath = path.join(root, 'assets', 'roastlord-logo.png');

const TEST_CASES = [
  {
    id: 'music-genz-1',
    style: 'genz',
    photo: 'music-genz-1.jpg',
    photoUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&h=1000&fit=crop&crop=faces',
    roast: 'No cap your aura is cooked, bestie. This pic screams mid and skipped you.'
  },
  {
    id: 'music-brutal-1',
    style: 'brutal',
    photo: 'music-brutal-1.jpg',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&h=1000&fit=crop&crop=faces',
    roast: 'Bro your face looks ugly today. That smirk makes everything ten times worse, period.'
  },
  {
    id: 'music-genz-2',
    style: 'genz',
    photo: 'music-genz-2.jpg',
    photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&h=1000&fit=crop&crop=faces',
    roast: 'Not you posting this delulu flex. Your rizz died and this vibe stays cooked.'
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
  const { renderRoastVideoJpegFrames } = require('../lib/video-frame-render');

  fs.mkdirSync(photosDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  console.log('RoastLord music test video generator\n');

  for (const tc of TEST_CASES) {
    const v = validateRoastFormat(tc.roast);
    if (v.wordCount > ROAST_WORD_MAX) {
      console.error(`  ✗ ${tc.id} exceeds ${ROAST_WORD_MAX} words`);
      process.exit(1);
    }

    const beatIndex = pickRandomBeatIndex();
    console.log(`[${tc.id}] ${tc.style} — ${v.wordCount}w · beat ${beatIndex} (${BEAT_FILES[beatIndex - 1]})`);

    const photoPath = path.join(photosDir, tc.photo);
    console.log(`  downloading ${tc.photo}...`);
    await downloadFile(tc.photoUrl, photoPath);

    const frames = await renderRoastVideoJpegFrames(photoPath, tc.roast, logoPath);
    console.log(`  encoding ${frames.length} frames + music...`);
    const mp4 = await encodeFramesForTikTok(frames, FPS, { beatIndex });

    const hasAudio = await mp4HasAudioStream(mp4);
    if (!hasAudio) {
      console.error('  ✗ MP4 has no audio stream');
      process.exit(1);
    }
    console.log('  ✓ audio stream present');

    const outPath = path.join(outDir, `test-${tc.id}.mp4`);
    fs.writeFileSync(outPath, mp4);
    console.log(`  ✓ ${outPath} (${Math.round(mp4.length / 1024)} KB)\n`);
  }

  console.log(`Done — 3 test videos with music (${VIDEO_TIMING.DURATION}s each)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});