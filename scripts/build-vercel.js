#!/usr/bin/env node
/**
 * Production build for Vercel — outputs static assets to dist/
 * Env vars (set in Vercel dashboard or .env locally):
 *   XAI_API_KEY       — server-side key for /api/roast proxy
 *   RL_ANALYTICS_URL  — optional analytics beacon endpoint
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  || process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 8)
  || Date.now().toString(36);

const staticFiles = ['index.html', 'privacy-policy.html'];
const copyDirs = ['icons'];

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function writeManifest() {
  const manifest = {
    id: '/',
    name: 'RoastLord',
    short_name: 'RoastLord',
    description: 'Upload a photo. Get absolutely cooked. Brutal roasts that slap.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    background_color: '#000000',
    theme_color: '#000000',
    orientation: 'portrait',
    categories: ['entertainment', 'social'],
    lang: 'en',
    icons: [
      { src: '/icons/icon-48.png', sizes: '48x48', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-256.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
  fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('[vercel] wrote manifest.json');
}

function writeServiceWorker() {
  const sw = `// RoastLord — production service worker (build ${BUILD_ID})
const CACHE_NAME = 'roastlord-${BUILD_ID}';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/js/analytics.js',
  '/js/capacitor-native.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/assets/roastlord-logo.png',
  '/assets/pepper.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (event.request.method !== 'GET') return;

  // Always fetch fresh env flags (API proxy on/off)
  if (url.pathname === '/env-config.js') {
    event.respondWith(fetch(event.request));
    return;
  }

  const isAppShell = PRECACHE.some((p) => url.pathname === p || (p === '/' && url.pathname === '/index.html'));

  if (isAppShell) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
      )
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
`;
  fs.writeFileSync(path.join(dist, 'sw.js'), sw);
  console.log('[vercel] wrote sw.js (' + BUILD_ID + ')');
}

function writeEnvConfig() {
  const xaiKey = process.env.XAI_API_KEY || '';
  const analyticsUrl = process.env.RL_ANALYTICS_URL || '';
  const apiProxyEnabled = Boolean(xaiKey);

  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
  const config = {
    BUILD_ID,
    API_PROXY_ENABLED: apiProxyEnabled,
    RL_ANALYTICS_URL: analyticsUrl,
    STRIPE_ENABLED: Boolean(stripeKey),
    STRIPE_PUBLISHABLE_KEY: stripePublishableKey
  };

  const js = `// Generated at build — do not edit\nwindow.__ROASTLORD_ENV__=${JSON.stringify(config)};\n`;
  fs.writeFileSync(path.join(dist, 'env-config.js'), js);
  console.log('[vercel] env-config.js (API_PROXY_ENABLED=' + apiProxyEnabled + ')');
}

rmrf(dist);
fs.mkdirSync(path.join(dist, 'js'), { recursive: true });

for (const file of staticFiles) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) {
    console.warn('[vercel] skipping missing:', file);
    continue;
  }
  fs.copyFileSync(src, path.join(dist, file));
  console.log('[vercel] copied', file);
}

for (const dir of copyDirs) {
  const src = path.join(root, dir);
  if (fs.existsSync(src)) {
    copyDir(src, path.join(dist, dir));
    console.log('[vercel] copied', dir + '/');
  }
}

if (fs.existsSync(path.join(root, 'assets', 'icon.png'))) {
  fs.mkdirSync(path.join(dist, 'icons'), { recursive: true });
  fs.copyFileSync(path.join(root, 'assets', 'icon.png'), path.join(dist, 'icons', 'icon.png'));
}

const assetsDir = path.join(dist, 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

const logoSrc = path.join(root, 'assets', 'roastlord-logo.png');
if (fs.existsSync(logoSrc)) {
  fs.copyFileSync(logoSrc, path.join(assetsDir, 'roastlord-logo.png'));
  console.log('[vercel] copied assets/roastlord-logo.png');
}

const pepperSrc = path.join(root, 'assets', 'Pepper.png');
if (fs.existsSync(pepperSrc)) {
  fs.copyFileSync(pepperSrc, path.join(assetsDir, 'pepper.png'));
  console.log('[vercel] copied assets/pepper.png');
}

const soundsSrc = path.join(root, 'public', 'sounds');
if (fs.existsSync(soundsSrc)) {
  copyDir(soundsSrc, path.join(dist, 'sounds'));
  console.log('[vercel] copied public/sounds/ → dist/sounds/');
}

const { copyExamplesToDist } = require('../lib/example-assets');
const examplesOut = path.join(assetsDir, 'examples');
const { copied, manifest } = copyExamplesToDist(root, examplesOut);
if (copied) {
  const vidCount = manifest.videos.length;
  const picCount = manifest.photos.length;
  console.log(`[vercel] copied ${copied} example assets → dist/assets/examples/ (${vidCount} videos, ${picCount} extra photos)`);
}

const esbuildFlags = '--bundle --format=iife --minify --platform=browser';
execSync(`npx esbuild src/analytics.js ${esbuildFlags} --outfile=dist/js/analytics.js`, { cwd: root, stdio: 'inherit' });
execSync(
  `npx esbuild src/capacitor-native.js ${esbuildFlags} --global-name=RoastLordNativeBundle --outfile=dist/js/capacitor-native.js`,
  { cwd: root, stdio: 'inherit' }
);

writeManifest();
writeServiceWorker();
writeEnvConfig();

console.log('[vercel] dist/ ready — deploy with: vercel --prod');