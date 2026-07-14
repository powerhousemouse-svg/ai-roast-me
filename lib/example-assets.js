/** Landing page example assets — roastlord-pic-* / roastlord-vid-* / roastlord-{style}-* */

const fs = require('fs');
const path = require('path');

const DEFAULT_ROASTS = {
  'genz-1': 'No cap your aura is cooked. That smile screams mid and zero rizz.',
  'brutal-1': 'Bro your smirk is stupid ugly. That face ruins the whole photo, period.',
  'genz-2': 'Not you posting this delulu pic. Your face is mid and giving NPC.',
  'brutal-2': 'Your face is genuinely embarrassing today. That grin makes you look even stupider.',
  'genz-3': 'Bro your rizz died on arrival. This fit is mid and you\'re cooked.',
  'brutal-3': 'Bro you look tired and ugly. That dead stare killed whatever vibe you had.'
};

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
  if (!fs.existsSync(photosDir)) return null;
  const candidates = [
    examplePicName(style, n),
    `roastlord-${style}-${n}.jpg`
  ];
  // Slots 4+ often use pic-10, pic-11, … (roastlord-pic-genz-10 or roastlord-genz-10)
  if (n >= 4) {
    candidates.push(examplePicName(style, n + 6));
    candidates.push(`roastlord-${style}-${n + 6}.jpg`);
  }
  for (const file of candidates) {
    if (fs.existsSync(path.join(photosDir, file))) return file;
  }
  return null;
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

function discoverExamples(rootDir = path.join(__dirname, '..')) {
  const { photosDir, videosDir } = getAssetDirs(rootDir);
  const videoExamples = [];
  const usedPosters = new Set();

  if (fs.existsSync(videosDir)) {
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
    const videos = [...bySlot.values()].sort(
      (a, b) => (a.style !== b.style ? a.style.localeCompare(b.style) : a.n - b.n)
    );

    for (const { file: video, style, n } of videos) {
      const poster = resolvePosterFile(photosDir, style, n);
      if (poster) usedPosters.add(poster);
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
  fs.mkdirSync(distExamplesDir, { recursive: true });

  let copied = 0;
  for (const [srcDir] of [[photosDir], [videosDir]]) {
    if (!fs.existsSync(srcDir)) continue;
    for (const file of fs.readdirSync(srcDir)) {
      if (!isExampleAsset(file)) continue;
      fs.copyFileSync(path.join(srcDir, file), path.join(distExamplesDir, file));
      copied++;
    }
  }

  const manifest = discoverExamples(rootDir);
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
  discoverExamples,
  isExampleAsset,
  copyExamplesToDist
};