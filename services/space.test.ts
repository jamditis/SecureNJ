import { describe, expect, it } from 'vitest';
import { generatePassphrase, passphraseProblem } from './passphrase';
import {
  deriveRoomKeys,
  normalizeSpaceName,
  parseSignalingUrls,
} from './space';

describe('deriveRoomKeys', () => {
  it('gives the same keys to all members who type the same name and passphrase for one tool', async () => {
    const a = await deriveRoomKeys('mutual-aid', 'Newark Rapid Response', 'six random words go right here');
    const b = await deriveRoomKeys('mutual-aid', '  newark   rapid response ', 'six random words go right here ');
    expect(a).toEqual(b);
    expect(a.roomId).toMatch(/^snj-[0-9a-f]{32}$/);
    expect(a.roomPassword).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives each tool its own room for the same name and passphrase', async () => {
    const aid = await deriveRoomKeys('mutual-aid', 'group', 'river tulip nine window');
    const alerts = await deriveRoomKeys('safety-alerts', 'group', 'river tulip nine window');
    expect(alerts.roomId).not.toBe(aid.roomId);
    expect(alerts.roomPassword).not.toBe(aid.roomPassword);
  });

  it('gives a different room for a different passphrase or a different name', async () => {
    const base = await deriveRoomKeys('consensus', 'group', 'river tulip nine window');
    const otherPassphrase = await deriveRoomKeys('consensus', 'group', 'river tulip nine door');
    const otherName = await deriveRoomKeys('consensus', 'group 2', 'river tulip nine window');
    expect(otherPassphrase.roomId).not.toBe(base.roomId);
    expect(otherPassphrase.roomPassword).not.toBe(base.roomPassword);
    expect(otherName.roomId).not.toBe(base.roomId);
  });

  it('does not put the name or the passphrase in the room ID', async () => {
    const keys = await deriveRoomKeys('consensus', 'visible', 'hunter2hunter2');
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

  it('refuses ws:// on an HTTPS page, where the browser blocks it, except to this computer', () => {
    expect(parseSignalingUrls('ws://signal.example:4444 ws://localhost:4444 wss://ok.example', true)).toEqual({
      urls: ['ws://localhost:4444', 'wss://ok.example'],
      invalid: ['ws://signal.example:4444'],
    });
  });

  it('returns nothing for empty text', () => {
    expect(parseSignalingUrls('  ')).toEqual({ urls: [], invalid: [] });
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

  it('refuses a passphrase of fewer than 12 characters', () => {
    expect(passphraseProblem('short')).toBe('short');
    expect(passphraseProblem('  eleven char ')).toBe('short');
  });

  it('refuses a long passphrase that is easy to guess', () => {
    expect(passphraseProblem('aaaaaaaaaaaaaaaa')).toBe('guessable');
    expect(passphraseProblem('abababababababab')).toBe('guessable');
    expect(passphraseProblem('MyPassword2026!!')).toBe('guessable');
    expect(passphraseProblem('qwerty-keyboard-row')).toBe('guessable');
  });

  it('accepts a generated passphrase and a long mixed one', () => {
    expect(passphraseProblem(generatePassphrase())).toBeNull();
    expect(passphraseProblem('river tulip nine window')).toBeNull();
  });
});
