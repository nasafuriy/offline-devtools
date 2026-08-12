/* ============================================================
   Shashka service worker.

   Only used by the hosted copy, where it makes the app installable
   and genuinely offline. It never contacts anything but this origin,
   and it stores only the app's own files — no user data, ever.
   ============================================================ */

const CACHE = 'shashka-v1';

// The hosted index.html is the fully inlined single-file build, so the whole
// application is these few entries.
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './docs/icon-192.png',
  './docs/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll rejects the whole batch if one entry 404s, so add individually.
      .then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // nothing off-origin is ours to handle

  // Serve from cache immediately, refresh in the background: the app opens
  // instantly and offline, and picks up a new build on the next visit.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});

// Lets a future version take over without waiting for every tab to close.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
