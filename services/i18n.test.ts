import { describe, expect, it } from 'vitest';
import en from '../locales/en';
import { makeTranslate } from './i18n';
import { getMemberId, loadMemberName, saveMemberName } from './identity';

describe('makeTranslate', () => {
  const t = makeTranslate(en);

  it('returns the text for a key', () => {
    expect(t('common.cancel')).toBe('Cancel');
  });

  it('replaces each placeholder with its value', () => {
    expect(t('dashboard.inSpace', { name: 'Ironbound', count: 3 })).toBe('Space: Ironbound · peers: 3');
  });

  it('keeps a placeholder that has no value, so a missing value is visible', () => {
    expect(t('dashboard.inSpace', { name: 'Ironbound' })).toBe('Space: Ironbound · peers: {count}');
  });

  it('does not treat a value as a template', () => {
    expect(t('alerts.goesToSpace', { name: '{count}' })).toContain('"{count}"');
  });
});

describe('English text', () => {
  it('has no empty message', () => {
    const empty = Object.entries(en).filter(([, text]) => text.trim() === '');
    expect(empty).toEqual([]);
  });
});

describe('member identity', () => {
  const makeStorage = (): Storage => {
    const items = new Map<string, string>();
    return {
      get length() {
        return items.size;
      },
      clear: () => items.clear(),
      getItem: (key) => items.get(key) ?? null,
      key: (index) => Array.from(items.keys())[index] ?? null,
      removeItem: (key) => void items.delete(key),
      setItem: (key, value) => void items.set(key, value),
    };
  };

  it('makes one ID for a browser and keeps it', () => {
    const storage = makeStorage();
    const id = getMemberId(storage);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getMemberId(storage)).toBe(id);
    expect(getMemberId(makeStorage())).not.toBe(id);
  });

  it('saves the display name with no spaces at the ends', () => {
    const storage = makeStorage();
    expect(loadMemberName(storage)).toBe('');
    saveMemberName(storage, '  Sparrow ');
    expect(loadMemberName(storage)).toBe('Sparrow');
  });
});
