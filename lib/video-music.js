/** Random roast video background beats from public/sounds/. */

const fs = require('fs');
const path = require('path');

const BEAT_COUNT = 5;
const BEAT_FILES = [
  'roast-beat-1.MP3',
  'roast-beat-2.MP3',
  'roast-beat-3.MP3',
  'roast-beat-4.MP3',
  'roast-beat-5.MP3'
];

function getSoundsDirs(rootDir = path.join(__dirname, '..')) {
  return [
    path.join(rootDir, 'public', 'sounds'),
    path.join(rootDir, 'dist', 'sounds')
  ];
}

function resolveBeatPath(beatIndex, rootDir) {
  const idx = Number(beatIndex);
  if (!Number.isInteger(idx) || idx < 1 || idx > BEAT_COUNT) {
    throw new Error(`Invalid beat index: ${beatIndex}`);
  }
  const filename = BEAT_FILES[idx - 1];
  for (const dir of getSoundsDirs(rootDir)) {
    const full = path.join(dir, filename);
    if (fs.existsSync(full)) return full;
  }
  throw new Error(`Beat file not found: ${filename}`);
}

function pickRandomBeatIndex() {
  return 1 + Math.floor(Math.random() * BEAT_COUNT);
}

function pickRandomBeat(rootDir) {
  const index = pickRandomBeatIndex();
  return {
    index,
    filename: BEAT_FILES[index - 1],
    path: resolveBeatPath(index, rootDir)
  };
}

function normalizeBeatIndex(beatIndex) {
  const idx = parseInt(beatIndex, 10);
  if (Number.isInteger(idx) && idx >= 1 && idx <= BEAT_COUNT) return idx;
  return pickRandomBeatIndex();
}

module.exports = {
  BEAT_COUNT,
  BEAT_FILES,
  getSoundsDirs,
  resolveBeatPath,
  pickRandomBeatIndex,
  pickRandomBeat,
  normalizeBeatIndex
};