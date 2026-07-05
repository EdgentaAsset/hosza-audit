/**
 * Service Worker — buka offline.
 * Aset Vite ada hash dalam nama (cache-first selamanya, self-busting);
 * index.html network-first (versi baru sampai tanpa bump manual —
 * tiada lagi "lupa naikkan VERSION" macam app lama).
 */
const CACHE = 'hosza-v3';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Aset ber-hash + ikon/font: cache-first
  if (url.pathname.includes('/assets/') || /\.(png|svg|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Navigasi/HTML: network-first, fallback cache bila offline
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res.clone();
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html'))),
  );
});
