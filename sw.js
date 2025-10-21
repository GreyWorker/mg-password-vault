// sw.js - Service Worker robustifié (SWR, precache tolérant, fallback nav)
const CACHE_NAME = 'mg-vault-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles/app.css',
  '/js/app.js',
  '/js/config.js',
  '/js/crypto.js',
  '/js/ui.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Installation : precache tolérant
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(CORE_ASSETS.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

// Activation : cleanup anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.map(n => (n !== CACHE_NAME ? caches.delete(n) : null)))
    ).then(() => self.clients.claim())
  );
});

// Support skipWaiting manuel (utile pour future UI d’update)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Fetch : SWR + fallback document
self.addEventListener('fetch', event => {
  const req = event.request;

  // On ne gère que GET sur même origine
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  // Navigation → fallback index.html si besoin
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      caches.match('/index.html').then(cached => cached || fetch(req))
    );
    return;
  }

  // SWR pour les assets
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(req).then(cached => {
        const fetchPromise = fetch(req).then(networkRes => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();        // CLONE CRITIQUE
            cache.put(req, clone).catch(() => {});
          }
          return networkRes;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    )
  );
});
