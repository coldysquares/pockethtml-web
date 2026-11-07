// Network first with a short timeout, cache as fallback.
// Online: a new deploy shows up on the next load.
// Weak signal: if the network has not answered within NETWORK_TIMEOUT_MS,
// the cached copy is served instead of waiting, and the network answer
// still lands in the cache for next time.
// Offline: everything precached at install (the app, the tools hub and every
// hosted tool in tools/registry.json) opens with no connection.
const CACHE = 'pockethtml-v9';
const NETWORK_TIMEOUT_MS = 3000;
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
  './edit/',
  './tools/',
  './tools/registry.json'
];

async function precacheHostedTools(cache) {
  try {
    const response = await fetch('./tools/registry.json', { cache: 'no-cache' });
    const registry = await response.json();
    const urls = (registry.tools || [])
      .filter(tool => tool.kind === 'hosted' && tool.path)
      .map(tool => './tools/' + tool.path);
    await Promise.all(urls.map(url => cache.add(url).catch(() => {})));
  } catch (error) {
    // The app shell is already cached; tools will be cached when opened.
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await precacheHostedTools(cache);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

function fromCache(request) {
  return caches.match(request, { ignoreSearch: request.mode === 'navigate' }).then(cached => {
    if (cached || request.mode !== 'navigate') return cached;
    const path = new URL(request.url).pathname;
    return caches.match(path.startsWith('/edit/') ? './edit/' : './index.html');
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  const network = fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      return caches.open(CACHE).then(cache => cache.put(request, copy)).then(() => response, () => response);
    }
    return response;
  });
  // Let a slow network answer finish and refresh the cache even after the cache was served.
  event.waitUntil(network.catch(() => {}));

  event.respondWith((async () => {
    const timeout = new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT_MS, null));
    const first = await Promise.race([network.catch(() => null), timeout]);
    if (first) return first;
    const cached = await fromCache(request);
    if (cached) return cached;
    try {
      return await network;
    } catch (error) {
      return Response.error();
    }
  })());
});
