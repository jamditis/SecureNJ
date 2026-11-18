/**
 * Erases all data of the app from this browser. The caller must close the
 * open databases first: an open database blocks its delete.
 *
 * The order is on purpose. The passphrase and the member IDs go first,
 * because that step cannot fail and cannot wait.
 */
const KNOWN_DATABASES = ['snj-local', 'snj-private'];
const DELETE_TIMEOUT_MS = 3_000;

function deleteDatabase(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(true);
    request.onerror = () => resolve(false);
    // A different tab can block the delete. The browser completes it when that tab closes.
    setTimeout(() => resolve(false), DELETE_TIMEOUT_MS);
  });
}

async function databaseNames(): Promise<string[]> {
  // Some browsers cannot list databases. The fixed names are then all that the app can find.
  if (typeof indexedDB.databases !== 'function') return KNOWN_DATABASES;
  const listed = (await indexedDB.databases()).map((db) => db.name).filter((name): name is string => !!name);
  return Array.from(new Set([...KNOWN_DATABASES, ...listed]));
}

export interface EraseResult {
  /** False if a database delete is not complete yet. */
  complete: boolean;
}

export async function eraseDevice(): Promise<EraseResult> {
  localStorage.clear();
  sessionStorage.clear();

  const deleted = await Promise.all((await databaseNames()).map(deleteDatabase));

  if (typeof caches !== 'undefined') {
    await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
  }
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  return { complete: deleted.every(Boolean) };
}
