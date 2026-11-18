// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { eraseDevice, forgetDatabase, rememberDatabase } from './wipe';

function createDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
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
    sessionStorage.setItem('snj.space', 'secret');
    sessionStorage.setItem('other-app.session', 'keep me');
    await createDatabase('snj-local');
    await createDatabase('snj-0123abcd');
    await createDatabase('other-app-db');

    const result = await eraseDevice(localStorage, sessionStorage);

    expect(result.complete).toBe(true);
    expect(Object.keys(localStorage)).toEqual(['other-app.settings']);
    expect(Object.keys(sessionStorage)).toEqual(['other-app.session']);
    expect(await databaseNames()).toEqual(['other-app-db']);
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
    expect(await databaseNames()).toEqual(['other-app-db', 'snj-room-two']);
  });
});
