const CACHE_NAME = 'pecuaria-inteligente-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Permite que o app funcione e intercepte requisições
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});