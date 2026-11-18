/**
 * Erases all data of the app from this browser. The caller must close the
 * open databases first: an open database blocks its delete.
 *
 * Storage belongs to a web origin, not to an app. Other sites on the same
 * origin (for example other GitHub Pages projects of one user) use the same
 * storage, so the erase removes only the names that this app owns.
 *
 * The order is on purpose. The passphrase and the member IDs go first,
 * because that step cannot fail and cannot wait.
 */
const KEY_PREFIX = 'snj.';
/**
 * The published site before this app stored data under these names, on the
 * same origin. An erase must remove that data too.
 */
const OLD_SITE_KEYS = /^(securenj-|mutual-aid-settings$)/;
/** The old site named each room database with 64 hex characters. */
const OLD_SITE_DATABASE = /^[0-9a-f]{64}$/;
const DATABASE_PREFIX = 'snj-';
const CACHE_PREFIX = 'snj-app-';
/** The site that this app replaces used this prefix for its caches, at the same address. */
const OLD_SITE_CACHE_PREFIX = 'securenj-';
const KNOWN_DATABASES = ['snj-local', 'snj-private'];
const REGISTRY_KEY = 'snj.databases';
const DELETE_TIMEOUT_MS = 3_000;

function readRegistry(storage: Storage): string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(REGISTRY_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Keeps the names of the space databases on this device. Some browsers
 * cannot list databases. The erase then finds the databases in this list.
 */
export function rememberDatabase(storage: Storage, name: string): void {
  const names = readRegistry(storage);
  if (!names.includes(name)) storage.setItem(REGISTRY_KEY, JSON.stringify([...names, name]));
}

export function forgetDatabase(storage: Storage, name: string): void {
  storage.setItem(REGISTRY_KEY, JSON.stringify(readRegistry(storage).filter((known) => known !== name)));
}

function clearOwnKeys(storage: Storage): void {
  Object.keys(storage)
    .filter((key) => key.startsWith(KEY_PREFIX) || OLD_SITE_KEYS.test(key))
    .forEach((key) => storage.removeItem(key));
}

function deleteDatabase(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(true);
    request.onerror = () => resolve(false);
    // A different tab can block the delete. The browser completes it when that tab closes.
    setTimeout(() => resolve(false), DELETE_TIMEOUT_MS);
  });
}

/** True if the database has the two stores that the sync library makes. */
function isSyncDatabase(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => {
      const stores = request.result.objectStoreNames;
      const result = stores.contains('updates') && stores.contains('custom');
      request.result.close();
      resolve(result);
    };
    request.onerror = () => resolve(false);
  });
}

async function listedDatabases(): Promise<string[] | null> {
  // Some browsers cannot list databases. The app then knows only the names that it kept.
  if (typeof indexedDB.databases !== 'function') return null;
  return (await indexedDB.databases()).map((db) => db.name).filter((name): name is string => !!name);
}

async function ownDatabases(registered: string[]): Promise<string[]> {
  const names = new Set([...KNOWN_DATABASES, ...registered]);
  for (const name of (await listedDatabases()) ?? []) {
    if (name.startsWith(DATABASE_PREFIX)) names.add(name);
    // A different site can use a name of the same form. Take only a database of the sync library.
    else if (OLD_SITE_DATABASE.test(name) && (await isSyncDatabase(name))) names.add(name);
  }
  return Array.from(names);
}

export interface EraseResult {
  /** False if a step failed or a database delete is not complete yet. */
  complete: boolean;
}

/** Runs one step of the erase. A step that fails must not stop the steps after it. */
async function step(run: () => Promise<boolean | void>): Promise<boolean> {
  try {
    return (await run()) !== false;
  } catch {
    return false;
  }
}

export async function eraseDevice(local: Storage = localStorage, session: Storage = sessionStorage): Promise<EraseResult> {
  const registered = readRegistry(local);
  clearOwnKeys(local);
  clearOwnKeys(session);

  const results = [
    await step(async () => (await Promise.all((await ownDatabases(registered)).map(deleteDatabase))).every(Boolean)),
    await step(async () => {
      if (typeof caches === 'undefined') return;
      const own = (await caches.keys()).filter((key) => key.startsWith(CACHE_PREFIX) || key.startsWith(OLD_SITE_CACHE_PREFIX));
      await Promise.all(own.map((key) => caches.delete(key)));
    }),
    await step(async () => {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
      // Only the service worker of this app. A site in a parent folder can have its own worker.
      const registration = await navigator.serviceWorker.getRegistration();
      const scope = new URL('./', window.location.href).href;
      const script = registration?.active?.scriptURL ?? registration?.waiting?.scriptURL ?? registration?.installing?.scriptURL ?? '';
      if (registration && registration.scope === scope && script === `${scope}sw.js`) await registration.unregister();
    }),
  ];
  return { complete: results.every(Boolean) };
}

/**
 * Removes what an earlier version of this app left on the device and that
 * the app no longer uses: a stored group name and passphrase, and the
 * database of a room that the app does not know. It runs at each start.
 */
export async function removeOldData(local: Storage = localStorage, session: Storage = sessionStorage): Promise<void> {
  local.removeItem('snj.space');
  session.removeItem('snj.space');
  const known = new Set([...KNOWN_DATABASES, ...readRegistry(local)]);
  const stale = ((await listedDatabases()) ?? []).filter((name) => name.startsWith(DATABASE_PREFIX) && !known.has(name));
  await Promise.all(stale.map(deleteDatabase));
}
