/** Landing page example assets — roastlord-pic-* / roastlord-vid-* / roastlord-{style}-* */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const DEFAULT_ROASTS = {
  'genz-1': 'No cap your aura is cooked. That smile screams mid and zero rizz.',
  'brutal-1': 'Bro your smirk is stupid ugly. That face ruins the whole photo, period.',
  'genz-2': 'Not you posting this delulu pic. Your face is mid and giving NPC.',
  'brutal-2': 'Your face is genuinely embarrassing today. That grin makes you look even stupider.',
  'genz-3': 'Bro your rizz died on arrival. This fit is mid and you\'re cooked.',
  'brutal-3': 'Bro you look tired and ugly. That dead stare killed whatever vibe you had.'
};

// Portrait crop inside the green frame on 9:16 roast videos (fractions of frame size).
const VIDEO_POSTER_CROP = 'crop=iw*0.548:ih*0.312:iw*0.226:ih*0.079';

function examplePicName(style, n) {
  return `roastlord-pic-${style}-${n}.jpg`;
}

function exampleVidName(style, n) {
  return `roastlord-vid-${style}-${n}.mp4`;
}

function getAssetDirs(rootDir = path.join(__dirname, '..')) {
  return {
    photosDir: path.join(rootDir, 'assets', 'test-photos'),
    videosDir: path.join(rootDir, 'assets', 'test-videos')
  };
}

function resolvePosterFile(photosDir, style, n) {
  return examplePicName(style, n);
}

function interleaveStyles(items) {
  const genz = items.filter((i) => i.style === 'genz').sort((a, b) => a.n - b.n);
  const brutal = items.filter((i) => i.style === 'brutal').sort((a, b) => a.n - b.n);
  const merged = [];
  const max = Math.max(genz.length, brutal.length);
  for (let i = 0; i < max; i++) {
    if (genz[i]) merged.push(genz[i]);
    if (brutal[i]) merged.push(brutal[i]);
  }
  return merged;
}

function videoMd5(videosDir, file) {
  return crypto.createHash('md5').update(fs.readFileSync(path.join(videosDir, file))).digest('hex');
}

function listVideoExamples(videosDir) {
  if (!fs.existsSync(videosDir)) return [];

  const parsed = fs
    .readdirSync(videosDir)
    .filter((f) => /^roastlord-vid-(genz|brutal)(?:-\d+)?\.mp4$/i.test(f) && !/\bcopy\b/i.test(f))
    .map((f) => {
      const m = f.match(/^roastlord-vid-(genz|brutal)(?:-(\d+))?\.mp4$/i);
      return { file: f, style: m[1].toLowerCase(), n: m[2] ? Number(m[2]) : 1 };
    });

  const bySlot = new Map();
  for (const entry of parsed) {
    const key = `${entry.style}-${entry.n}`;
    const prev = bySlot.get(key);
    if (!prev || /-\d+\.mp4$/i.test(entry.file)) bySlot.set(key, entry);
  }

  return [...bySlot.values()].sort(
    (a, b) => (a.style !== b.style ? a.style.localeCompare(b.style) : a.n - b.n)
  );
}

function extractPosterFromVideo(videoPath, outputPath) {
  const ffmpeg = require('ffmpeg-static');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  execSync(
    `"${ffmpeg}" -y -i "${videoPath}" -vframes 1 -vf "${VIDEO_POSTER_CROP}" -q:v 2 "${outputPath}"`,
    { stdio: 'ignore' }
  );
}

function discoverExamples(rootDir = path.join(__dirname, '..')) {
  const { photosDir, videosDir } = getAssetDirs(rootDir);
  const videoExamples = [];
  const usedPosters = new Set();
  const videos = listVideoExamples(videosDir);

  for (const { file: video, style, n } of videos) {
    const poster = examplePicName(style, n);
    usedPosters.add(poster);
    const key = `${style}-${n}`;
    videoExamples.push({
      type: 'video',
      style,
      n,
      video,
      poster,
      roast: DEFAULT_ROASTS[key] || ''
    });
  }

  const photoOnly = [];
  if (fs.existsSync(photosDir)) {
    const loosePhotos = fs
      .readdirSync(photosDir)
      .filter((f) => /^roastlord-(?:pic-)?(genz|brutal)-\d+\.jpe?g$/i.test(f))
      .sort((a, b) => {
        const ma = a.match(/(genz|brutal)-(\d+)/i);
        const mb = b.match(/(genz|brutal)-(\d+)/i);
        if (ma[1] !== mb[1]) return ma[1].localeCompare(mb[1]);
        return Number(ma[2]) - Number(mb[2]);
      });

    for (const poster of loosePhotos) {
      if (usedPosters.has(poster)) continue;
      const m = poster.match(/^roastlord-(?:pic-)?(genz|brutal)-(\d+)\.jpe?g$/i);
      if (!m) continue;
      photoOnly.push({
        type: 'image',
        style: m[1].toLowerCase(),
        n: Number(m[2]),
        poster
      });
    }
  }

  return {
    videos: interleaveStyles(videoExamples),
    photos: photoOnly
  };
}

function isExampleAsset(filename) {
  if (/\bcopy\b/i.test(filename)) return false;
  return (
    /^roastlord-vid-(genz|brutal)(?:-\d+)?\.mp4$/i.test(filename)
    || /^roastlord-(?:pic-)?(genz|brutal)-\d+\.jpe?g$/i.test(filename)
  );
}

function copyExamplesToDist(rootDir, distExamplesDir) {
  const { photosDir, videosDir } = getAssetDirs(rootDir);
  const manifest = discoverExamples(rootDir);
  fs.mkdirSync(distExamplesDir, { recursive: true });

  let copied = 0;
  const copiedNames = new Set();
  const extractedByMd5 = new Map();

  for (const item of manifest.videos) {
    const videoSrc = path.join(videosDir, item.video);
    if (!fs.existsSync(videoSrc) || copiedNames.has(item.video)) continue;
    fs.copyFileSync(videoSrc, path.join(distExamplesDir, item.video));
    copiedNames.add(item.video);
    copied++;

    const hash = videoMd5(videosDir, item.video);
    const posterDest = path.join(distExamplesDir, item.poster);
    if (!extractedByMd5.has(hash)) {
      extractPosterFromVideo(videoSrc, posterDest);
      extractedByMd5.set(hash, item.poster);
      copiedNames.add(item.poster);
      copied++;
    } else if (!copiedNames.has(item.poster)) {
      const canonicalPoster = extractedByMd5.get(hash);
      fs.copyFileSync(
        path.join(distExamplesDir, canonicalPoster),
        posterDest
      );
      copiedNames.add(item.poster);
      copied++;
    }
  }

  for (const item of manifest.photos) {
    if (!item.poster || copiedNames.has(item.poster)) continue;
    const src = path.join(photosDir, item.poster);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(distExamplesDir, item.poster));
    copiedNames.add(item.poster);
    copied++;
  }

  fs.writeFileSync(
    path.join(distExamplesDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  return { copied, manifest };
}

module.exports = {
  DEFAULT_ROASTS,
  examplePicName,
  exampleVidName,
  getAssetDirs,
  resolvePosterFile,
  extractPosterFromVideo,
  discoverExamples,
  isExampleAsset,
  copyExamplesToDist
};