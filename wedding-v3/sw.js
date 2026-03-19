/**
 * sw.js — Wedding PWA Service Worker
 *
 * Strategy:
 *   - Static assets  → Cache-first (serve from cache, update in background)
 *   - JSON data files → Network-first (get fresh data when online, fallback to cache)
 *   - Everything else → Network-first with cache fallback
 */

const CACHE_NAME = 'wedding-v1';

const PRECACHE = [
  /* Pages */
  './index.html',
  './table.html',
  './menu.html',
  './video.html',
  './gallery.html',
  './wish.html',
  './game.html',

  /* Core assets */
  './assets/css/gw.css',
  './assets/js/gw.js',
  './assets/js/theme.js',
  './assets/js/libs/jsqr.min.js',

  /* Data */
  './assets/data/config.json',
  './assets/data/guests.json',

  /* Images */
  './assets/data/logo.svg',
  './assets/data/logo.jpg',
  './assets/data/banner.jpg',
  './assets/data/floral-background.jpg',

  /* Manifest */
  './manifest.json',
];

/* ── Install: pre-cache all static assets ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: delete old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests (skip CDN, external APIs)
  if (url.origin !== self.location.origin) return;

  const isJson = url.pathname.endsWith('.json');

  if (isJson) {
    // Network-first for data files — get fresh content when online
    event.respondWith(networkFirst(request));
  } else {
    // Cache-first for everything else
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline — asset not cached.', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}
