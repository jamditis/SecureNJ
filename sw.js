// Saves the site's built files on install, so it opens without a connection after one visit.
const VERSION = '331fc8e428a0';
const ASSETS = ["./assets/index-DexewPBY.css","./assets/index-BhtmjXkj.js"];
const CACHE = `securenj-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(['./', './favicon.svg', './manifest.webmanifest', ...ASSETS]))
      .then(() => self.skipWaiting())
  );
});

// Other sites on this origin have their own caches, so only touch this site's caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('securenj-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // Pages try the network first, so a fix reaches people as soon as they are online.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then((cache) => cache.match('./'))));
    return;
  }
  event.respondWith(caches.open(CACHE).then((cache) => cache.match(request)).then((hit) => hit || fetch(request)));
});
