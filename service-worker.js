// service-worker.js

const CACHE_NAME = 'companero-dev';            // build overwrites with content hash
const APP_SHELL = ['./', './index.html'];      // build overwrites with hashed shell

// Pure router — unit-testable, no side effects.
export function routeFor(req) {
  if (req.mode === 'navigate') return 'navigate';
  return 'asset';
}

// Only 2xx responses are safe to cache (avoid poisoning the cache with a transient 404/500).
export function isCacheable(res) {
  return !!res && res.ok;
}

const isSW = typeof self !== 'undefined' && 'ServiceWorkerGlobalScope' in self
  && self instanceof self.ServiceWorkerGlobalScope;

if (isSW) {
  self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL)));
    // No auto-skipWaiting: the page prompts the user (avoids version skew).
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )).then(() => self.clients.claim())
    );
  });

  self.addEventListener('message', (event) => {
    if (!event || !event.data) return;
    if (event.data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
    if (event.data.type === 'GET_VERSION') {
      try { event.source?.postMessage({ type: 'VERSION', version: CACHE_NAME }); } catch {}
    }
  });

  self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== location.origin) return;

    if (routeFor(req) === 'navigate') {
      // Network-first: pick up new deploys immediately; fall back to cache offline.
      event.respondWith(
        fetch(req).then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy)).catch(() => {});
          }
          return res;
        }).catch(() => caches.match('./index.html').then((r) => r || caches.match(req)))
      );
      return;
    }

    // Content-addressed assets are immutable → cache-first.
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (isCacheable(res)) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => new Response('Offline', { status: 503, statusText: 'Offline' })))
    );
  });
}
