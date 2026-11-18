/*
 * Service worker: makes the app open with no connection.
 *
 * It keeps a copy of the app files only. It never sees the data of a tool:
 * that data is in IndexedDB and in WebRTC connections, which do not go
 * through a service worker.
 *
 * - The page (index.html): network first, so that an update arrives. With no
 *   connection, the saved copy.
 * - Other app files: the saved copy first. Their names change when their
 *   content changes, so a saved copy is never out of date.
 */
const CACHE = 'snj-app-v1';
const PAGE = './index.html';
// Many hosts send a "Vary" header. A saved file is selected by its address
// only: the app has one version of each file for all browsers.
const MATCH = { ignoreVary: true };
const EXTRA_FILES = ['./favicon.svg', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

/** The script and style files that a page loads from this app. */
function filesOf(html) {
  const files = [];
  for (const match of html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)) files.push(match[1]);
  return files;
}

/** Saves the page and its files, then removes files of older versions. */
async function savePage(response) {
  const cache = await caches.open(CACHE);
  const html = await response.clone().text();
  const files = filesOf(html);
  await cache.addAll([...files, ...EXTRA_FILES]);
  await cache.put(PAGE, response.clone());
  const current = new Set(files.map((file) => new URL(file, self.registration.scope).href));
  for (const request of await cache.keys()) {
    if (request.url.includes('/assets/') && !current.has(request.url)) await cache.delete(request);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch(PAGE, { cache: 'no-store' })
      .then(savePage)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) event.waitUntil(savePage(response.clone()));
          return response;
        })
        .catch(() => caches.match(PAGE, MATCH)),
    );
    return;
  }

  event.respondWith(caches.match(request, MATCH).then((saved) => saved || fetch(request)));
});
