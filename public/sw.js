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
const CACHE_PREFIX = 'snj-app-';
const CACHE = `${CACHE_PREFIX}v1`;
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

/** True for the address of the app page: the folder of the app, or its index.html. */
function isAppPage(url) {
  const scope = new URL(self.registration.scope);
  return url.origin === scope.origin && (url.pathname === scope.pathname || url.pathname === `${scope.pathname}index.html`);
}

// One save at a time. Two saves of different versions would each remove the files of the other.
let saving = Promise.resolve();

/** Saves the page and its files, then removes files of older versions. */
function savePage(response) {
  saving = saving
    .then(async () => {
      const type = response.headers.get('content-type') || '';
      const html = await response.text();
      const files = filesOf(html);
      // A page with no app files is not the app: an error page, or a page of a different site.
      if (!response.ok || !type.includes('text/html') || files.length === 0) return;
      const cache = await caches.open(CACHE);
      await cache.addAll([...files, ...EXTRA_FILES]);
      // A new response object: a response that came through a redirect cannot answer a navigation.
      await cache.put(PAGE, new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }));
      const current = new Set(files.map((file) => new URL(file, self.registration.scope).href));
      for (const request of await cache.keys()) {
        if (request.url.includes('/assets/') && !current.has(request.url)) await cache.delete(request);
      }
    })
    .catch(() => {});
  return saving;
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
      // Cache storage is shared with other sites on the same origin. Remove
      // only older caches of this app.
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Only the app page. A navigation to a file or to a different site in this folder is not changed.
    if (!isAppPage(url)) return;
    event.respondWith(
      fetch(request)
        .then((response) => {
          event.waitUntil(savePage(response.clone()));
          return response;
        })
        .catch(() => caches.match(PAGE, MATCH)),
    );
    return;
  }

  event.respondWith(caches.match(request, MATCH).then((saved) => saved || fetch(request)));
});
