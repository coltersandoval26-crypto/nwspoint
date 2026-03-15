const STATIC_CACHE = 'nwspoint-static-v4';
const RUNTIME_CACHE = 'nwspoint-runtime-v4';
const FONT_CACHE = 'nwspoint-fonts-v4';
const STATIC_ASSETS = ['/', '/index.html', '/sw.js'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(() => null)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(k => ![STATIC_CACHE, RUNTIME_CACHE, FONT_CACHE].includes(k))
        .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isWeatherApi(url) {
  return (
    url.hostname.includes('weather.gov') ||
    url.hostname.includes('nominatim.openstreetmap.org') ||
    url.hostname.includes('currentuvindex.com') ||
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('bigdatacloud.net')
  );
}

function isFontRequest(request, url) {
  return (
    request.destination === 'font' ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  );
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(response => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) return cached;
  const network = await networkPromise;
  return network || Response.error();
}

async function networkFirstDocument(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put('/index.html', fresh.clone());
    return fresh;
  } catch {
    return (await cache.match('/index.html')) || new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  if (isWeatherApi(url)) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response('{"error":"offline"}', {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
          statusText: 'Offline'
        })
      )
    );
    return;
  }

  if (isFontRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(fetch(request));
});
