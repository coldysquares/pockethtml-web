// Network first, cache as fallback: new deploys show up on the next load,
// and anything opened before keeps working offline.
const CACHE = 'pockethtml-v6';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './library.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './tools/',
  './tools/registry.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() =>
      caches.match(request, { ignoreSearch: request.mode === 'navigate' }).then(cached =>
        cached || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error())
      )
    )
  );
});
