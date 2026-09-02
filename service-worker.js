const CACHE_VERSION = 'tracking-monitor-pwa-v0.20';
const LOCAL_APP_SHELL = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(LOCAL_APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isMapTile = /(^|\.)tile\.openstreetmap\.org$/i.test(url.hostname);
  const isLiveTracking = /(^|\.)script\.google\.com$/i.test(url.hostname)
    || /(^|\.)script\.googleusercontent\.com$/i.test(url.hostname);

  // Live tracking and map tiles must always use the network.
  if (isMapTile || isLiveTracking) return;

  // Page navigation: network first, local cached app as fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put('./', copy));
          }
          return response;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  // Local same-origin files: cache first. External libraries: network only.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});
