const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { pickRandomBeatIndex, normalizeBeatIndex, resolveBeatPath } = require('./video-music');

const execFileAsync = promisify(execFile);

function getFfmpegPath() {
  try {
    return require('ffmpeg-static');
  } catch {
    return null;
  }
}

function resolveMusicPath(options = {}) {
  if (options.musicPath) return options.musicPath;
  const beatIndex = options.beatIndex != null
    ? normalizeBeatIndex(options.beatIndex)
    : pickRandomBeatIndex();
  return resolveBeatPath(beatIndex);
}

function buildAudioFilter(durationSec) {
  const fadeStart = Math.max(0, durationSec - 0.5);
  return `volume=0.72,afade=t=out:st=${fadeStart}:d=0.5`;
}

function musicInputArgs(musicPath) {
  return ['-stream_loop', '-1', '-i', musicPath];
}

/**
 * TikTok-optimized H.264 MP4 with background beat.
 */
async function encodeForTikTok(inputBuffer, inputExt = 'webm', durationSec = 5, options = {}) {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) throw new Error('ffmpeg binary not available');

  const musicPath = resolveMusicPath(options);
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-vid-'));
  const inputPath = path.join(tmp, `input.${inputExt}`);
  const outputPath = path.join(tmp, 'output.mp4');
  const dur = String(durationSec);

  try {
    await fs.writeFile(inputPath, inputBuffer);

    await execFileAsync(ffmpegPath, [
      ...musicInputArgs(musicPath),
      '-i', inputPath,
      '-map', '1:v:0',
      '-map', '0:a:0',
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '23',
      '-profile:v', 'high',
      '-level', '4.0',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-vsync', 'cfr',
      '-g', '60',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2',
      '-af', buildAudioFilter(durationSec),
      '-t', dur,
      '-movflags', '+faststart',
      '-y', outputPath
    ], { maxBuffer: 32 * 1024 * 1024 });

    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Encode numbered JPEG frame sequence with background beat for TikTok.
 */
async function encodeFramesForTikTok(frameBuffers, fps = 30, options = {}) {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) throw new Error('ffmpeg binary not available');

  const musicPath = resolveMusicPath(options);
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-frames-'));
  const videoOnlyPath = path.join(tmp, 'video.mp4');
  const outputPath = path.join(tmp, 'output.mp4');
  const durationSec = frameBuffers.length / fps;
  const dur = String(durationSec);
  const execOpts = { maxBuffer: 32 * 1024 * 1024 };

  try {
    for (let i = 0; i < frameBuffers.length; i++) {
      const name = `frame${String(i).padStart(4, '0')}.jpg`;
      await fs.writeFile(path.join(tmp, name), frameBuffers[i]);
    }

    // Pass 1: JPEG sequence has no timeline — encode video-only first.
    await execFileAsync(ffmpegPath, [
      '-framerate', String(fps),
      '-start_number', '0',
      '-i', path.join(tmp, 'frame%04d.jpg'),
      '-frames:v', String(frameBuffers.length),
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '23',
      '-profile:v', 'high',
      '-level', '4.0',
      '-pix_fmt', 'yuv420p',
      '-r', String(fps),
      '-vsync', 'cfr',
      '-g', String(fps * 2),
      '-an',
      '-y', videoOnlyPath
    ], execOpts);

    // Pass 2: mux background beat (image2 + audio in one pass drops audio on ffmpeg-static).
    await execFileAsync(ffmpegPath, [
      ...musicInputArgs(musicPath),
      '-i', videoOnlyPath,
      '-map', '1:v:0',
      '-map', '0:a:0',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2',
      '-af', buildAudioFilter(durationSec),
      '-t', dur,
      '-movflags', '+faststart',
      '-y', outputPath
    ], execOpts);

    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

/** Probe MP4 for an audio stream (for tests). */
async function mp4HasAudioStream(mp4Buffer) {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) return false;
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-probe-'));
  const probePath = path.join(tmp, 'probe.mp4');
  try {
    await fs.writeFile(probePath, mp4Buffer);
    try {
      await execFileAsync(ffmpegPath, ['-hide_banner', '-i', probePath], { maxBuffer: 4 * 1024 * 1024 });
    } catch (err) {
      const out = `${err.stdout || ''}${err.stderr || ''}`;
      return /Audio:/i.test(out);
    }
    return false;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  encodeForTikTok,
  encodeFramesForTikTok,
  mp4HasAudioStream,
  buildAudioFilter
};