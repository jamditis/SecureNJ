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
const DATABASE_PREFIX = 'snj-';
const CACHE_PREFIX = 'snj-app-';
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
    .filter((key) => key.startsWith(KEY_PREFIX))
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

async function ownDatabases(registered: string[]): Promise<string[]> {
  const names = new Set([...KNOWN_DATABASES, ...registered]);
  if (typeof indexedDB.databases === 'function') {
    for (const { name } of await indexedDB.databases()) {
      if (name?.startsWith(DATABASE_PREFIX)) names.add(name);
    }
  }
  return Array.from(names);
}

export interface EraseResult {
  /** False if a database delete is not complete yet. */
  complete: boolean;
}

export async function eraseDevice(local: Storage = localStorage, session: Storage = sessionStorage): Promise<EraseResult> {
  const registered = readRegistry(local);
  clearOwnKeys(local);
  clearOwnKeys(session);

  const deleted = await Promise.all((await ownDatabases(registered)).map(deleteDatabase));

  if (typeof caches !== 'undefined') {
    const own = (await caches.keys()).filter((key) => key.startsWith(CACHE_PREFIX));
    await Promise.all(own.map((key) => caches.delete(key)));
  }
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    // Only the service worker of this app, not the workers of other sites on the origin.
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.unregister();
  }
  return { complete: deleted.every(Boolean) };
}
