// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { eraseDevice, forgetDatabase, rememberDatabase, removeOldData } from './wipe';

function createDatabase(name: string, stores: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => stores.forEach((store) => request.result.createObjectStore(store, { autoIncrement: true }));
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

const databaseNames = async () => (await indexedDB.databases()).map((db) => db.name).sort();

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('eraseDevice', () => {
  it('deletes the data of this app and keeps the data of other apps on the same web address', async () => {
    // Sites on one origin share storage. GitHub Pages puts all projects of a user on one origin.
    localStorage.setItem('snj.space', 'secret');
    localStorage.setItem('snj.member.snj-abc', 'id');
    localStorage.setItem('other-app.settings', 'keep me');
    // Data that the published site stored before this app replaced it.
    localStorage.setItem('securenj-resource-sheet', '{}');
    localStorage.setItem(`securenj-room-${'ab'.repeat(32)}-status-name`, 'Sparrow');
    localStorage.setItem('mutual-aid-settings', '{}');
    sessionStorage.setItem('snj.space', 'secret');
    sessionStorage.setItem('other-app.session', 'keep me');
    await createDatabase('snj-local');
    await createDatabase('snj-0123abcd');
    await createDatabase('other-app-db');
    // A room database of the published site: 64 hex characters, with the stores of the sync library.
    await createDatabase('ab'.repeat(32), ['updates', 'custom']);
    // A database of a different site that has the same form of name.
    await createDatabase('cd'.repeat(32), ['its-own-store']);

    const result = await eraseDevice(localStorage, sessionStorage);

    expect(result.complete).toBe(true);
    expect(Object.keys(localStorage)).toEqual(['other-app.settings']);
    expect(Object.keys(sessionStorage)).toEqual(['other-app.session']);
    expect(await databaseNames()).toEqual(['cd'.repeat(32), 'other-app-db']);
  });

  it('deletes the databases of spaces in a browser that cannot list databases', async () => {
    await createDatabase('other-app-db');
    await createDatabase('snj-local');
    await createDatabase('snj-room-one');
    await createDatabase('snj-room-two');
    rememberDatabase(localStorage, 'snj-room-one');
    rememberDatabase(localStorage, 'snj-room-two');
    rememberDatabase(localStorage, 'snj-room-two');
    forgetDatabase(localStorage, 'snj-room-two');
    const all = indexedDB.databases.bind(indexedDB);
    Object.defineProperty(indexedDB, 'databases', { value: undefined, configurable: true });
    try {
      await eraseDevice(localStorage, sessionStorage);
    } finally {
      Object.defineProperty(indexedDB, 'databases', { value: all, configurable: true });
    }
    // The app knows the first room from its list. It left the second room, so that one is not in the list.
    expect(await databaseNames()).toEqual(['cd'.repeat(32), 'other-app-db', 'snj-room-two']);
  });
});

describe('removeOldData', () => {
  it('removes a passphrase that an earlier version of the app stored, and databases of rooms that the app does not know', async () => {
    localStorage.setItem('snj.space', JSON.stringify({ name: 'Group', passphrase: 'stored words', signaling: [] }));
    sessionStorage.setItem('snj.space', JSON.stringify({ name: 'Group', passphrase: 'stored words', signaling: [] }));
    await createDatabase('snj-0000old');
    await createDatabase('snj-1111known');
    await createDatabase('snj-local');
    rememberDatabase(localStorage, 'snj-1111known');

    await removeOldData(localStorage, sessionStorage);

    expect(localStorage.getItem('snj.space')).toBeNull();
    expect(sessionStorage.getItem('snj.space')).toBeNull();
    const names = await databaseNames();
    expect(names).not.toContain('snj-0000old');
    expect(names).toContain('snj-1111known');
    expect(names).toContain('snj-local');
  });
});
