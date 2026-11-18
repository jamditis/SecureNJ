import { describe, expect, it } from 'vitest';
import { generatePassphrase, isWeakPassphrase } from './passphrase';
import {
  clearSavedSpace,
  deriveSpaceKeys,
  loadSavedSpace,
  normalizeSpaceName,
  parseSignalingUrls,
  saveSpace,
  type SpaceConfig,
} from './space';

class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.items.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

describe('deriveSpaceKeys', () => {
  it('gives the same keys to all members who type the same name and passphrase', async () => {
    const a = await deriveSpaceKeys('Newark Rapid Response', 'six random words go right here');
    const b = await deriveSpaceKeys('  newark   rapid response ', 'six random words go right here ');
    expect(a).toEqual(b);
    expect(a.roomId).toMatch(/^snj-[0-9a-f]{32}$/);
    expect(a.roomPassword).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives a different room for a different passphrase or a different name', async () => {
    const base = await deriveSpaceKeys('group', 'passphrase one');
    const otherPassphrase = await deriveSpaceKeys('group', 'passphrase two');
    const otherName = await deriveSpaceKeys('group 2', 'passphrase one');
    expect(otherPassphrase.roomId).not.toBe(base.roomId);
    expect(otherPassphrase.roomPassword).not.toBe(base.roomPassword);
    expect(otherName.roomId).not.toBe(base.roomId);
  });

  it('does not put the name or the passphrase in the room ID', async () => {
    const keys = await deriveSpaceKeys('visible', 'hunter2hunter2');
    expect(keys.roomId).not.toContain('visible');
    expect(keys.roomId).not.toContain('hunter2');
    expect(keys.roomPassword).not.toBe(keys.roomId.slice(4));
  });
});

describe('normalizeSpaceName', () => {
  it('ignores case and extra spaces', () => {
    expect(normalizeSpaceName('  Essex  County\tAid ')).toBe('essex county aid');
  });
});

describe('parseSignalingUrls', () => {
  it('accepts WebSocket addresses and removes duplicates', () => {
    expect(parseSignalingUrls('wss://a.example, ws://localhost:4444\nwss://a.example')).toEqual({
      urls: ['wss://a.example', 'ws://localhost:4444'],
      invalid: [],
    });
  });

  it('reports addresses that are not WebSocket addresses', () => {
    expect(parseSignalingUrls('https://a.example nonsense')).toEqual({
      urls: [],
      invalid: ['https://a.example', 'nonsense'],
    });
  });

  it('returns nothing for empty text', () => {
    expect(parseSignalingUrls('  ')).toEqual({ urls: [], invalid: [] });
  });
});

describe('saved space', () => {
  const config: SpaceConfig = { name: 'group', passphrase: 'secret words here', signaling: ['wss://a.example'] };

  it('keeps the passphrase in session storage unless the user asks to remember it', () => {
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    saveSpace(config, false, session, local);
    expect(local.length).toBe(0);
    expect(loadSavedSpace(session, local)).toEqual(config);
  });

  it('moves the space to local storage when the user asks to remember it', () => {
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    saveSpace(config, false, session, local);
    saveSpace(config, true, session, local);
    expect(session.length).toBe(0);
    expect(loadSavedSpace(session, local)).toEqual(config);
  });

  it('removes the space from both stores', () => {
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    saveSpace(config, true, session, local);
    clearSavedSpace(session, local);
    expect(loadSavedSpace(session, local)).toBeNull();
  });

  it('ignores damaged or wrong data', () => {
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    session.setItem('snj.space', '{not json');
    local.setItem('snj.space', JSON.stringify({ name: 'x' }));
    expect(loadSavedSpace(session, local)).toBeNull();
  });
});

describe('passphrase', () => {
  it('makes the requested number of words from the list', () => {
    const words = generatePassphrase(6).split(' ');
    expect(words).toHaveLength(6);
    expect(words.every((word) => /^[a-z]+$/.test(word))).toBe(true);
  });

  it('makes a different passphrase each time', () => {
    expect(generatePassphrase()).not.toBe(generatePassphrase());
  });

  it('flags a short passphrase as weak', () => {
    expect(isWeakPassphrase('short')).toBe(true);
    expect(isWeakPassphrase(generatePassphrase())).toBe(false);
  });
});
