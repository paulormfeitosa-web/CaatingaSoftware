self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Pass-through simples para garantir o funcionamento do PWA
  e.respondWith(fetch(e.request).catch(() => new Response("Você está offline.")));
});