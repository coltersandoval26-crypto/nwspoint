const CACHE = 'nwspoint-v3';

self.addEventListener('install', e => {
  // Don't pre-cache anything — just activate immediately
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  // Delete ALL old caches on every update
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network-only for the HTML page — never serve stale index.html
  if (url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match('/').then(cached => cached || new Response('Offline', { status: 503 }))
      )
    );
    return;
  }

  // Always network-only for external APIs
  if (
    url.hostname.includes('weather.gov') ||
    url.hostname.includes('nominatim.openstreetmap.org') ||
    url.hostname.includes('currentuvindex.com') ||
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('bigdatacloud.net') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response('{}', { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // Cache-first for everything else (static assets)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
