const CACHE_VERSION = 'tamper-rewards-v3-2026-09-21-seasonal-maps';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = './index.html';

const APP_SHELL = [
  './',
  './index.html',
  './rewards-manifest.webmanifest',
  './tamper-icon.svg',
  './tamper-icon-192.png',
  './tamper-icon-512.png',
  './tamper-apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          // Borra también el caché compartido antiguo (tamper-v*) que podía
          // contener referencias a POS y Contabilidad en este dominio.
          .filter(key => key.startsWith('tamper-') && ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navegación: primero red para recibir la versión nueva; si no hay
  // conexión abre la última versión guardada de Rewards.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () =>
          (await caches.match(request)) ||
          (await caches.match(OFFLINE_URL)) ||
          (await caches.match('./'))
        )
    );
    return;
  }

  // Firebase y Google Maps necesitan datos actuales. Se consulta la red y se
  // utiliza caché sólo como respaldo para recursos GET previamente obtenidos.
  const liveData = /(?:googleapis\.com|gstatic\.com|firebaseio\.com|firestore\.google\.com|identitytoolkit\.googleapis\.com)/i.test(url.hostname);
  if (liveData) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok || response.type === 'opaque') {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Recursos visuales y librerías: caché primero para una apertura rápida.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok || response.type === 'opaque') {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'CLEAR_RUNTIME_CACHE') {
    event.waitUntil(caches.delete(RUNTIME_CACHE));
  }
});
