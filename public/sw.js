// focus-corner service worker. Versioned cache name; old caches are
// pruned on activate so a build bump cleanly invalidates assets.
//
// Strategy:
//   - Install: open the cache (no precache list — the runtime handler
//     fills it as users hit each asset).
//   - Fetch: same-origin GETs go cache-first with network fallback;
//     successful responses are stored. Off-origin requests pass through
//     untouched (Spotify/Google APIs must NOT hit cache).
//   - Activate: prune caches whose name doesn't match CACHE_NAME.
//
// Cache name is bumped manually when shell assets change in a way that
// requires every client to evict (e.g. major refactor of audio paths).

const CACHE_NAME = 'focus-corner-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone()).catch(() => {});
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    })(),
  );
});
