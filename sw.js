// RoastLord — service worker (local dev; production build generates dist/sw.js)
const CACHE_NAME = 'roastlord-v3';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/js/analytics.js',
  '/js/capacitor-native.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
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

  if (url.pathname === '/env-config.js' || url.pathname.endsWith('/env-config.js')) {
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