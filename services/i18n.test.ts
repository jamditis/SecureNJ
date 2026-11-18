import { describe, expect, it } from 'vitest';
import en from '../locales/en/index';
import { makeTranslate } from './i18n';
import { forgetMember, getMemberId, loadMemberName, saveMemberName } from './identity';

describe('makeTranslate', () => {
  const t = makeTranslate();

  it('returns the text for a key', () => {
    expect(t('common.cancel')).toBe('Cancel');
  });

  it('replaces each placeholder with its value', () => {
    expect(t('rights.hint.hotline', { name: 'A', source: 'B' })).toBe('This is the A number, as listed by the B. Call it to confirm before you print or share it.');
  });

  it('keeps a placeholder that has no value, so a missing value is visible', () => {
    expect(t('rights.hint.hotline', { name: 'A' })).toBe('This is the A number, as listed by the {source}. Call it to confirm before you print or share it.');
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

  it('makes one ID for a space and keeps it', () => {
    const storage = makeStorage();
    const id = getMemberId(storage, 'space-a');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getMemberId(storage, 'space-a')).toBe(id);
  });

  it('gives one device a different ID in each space, so that the spaces have no link', () => {
    const storage = makeStorage();
    expect(getMemberId(storage, 'space-a')).not.toBe(getMemberId(storage, 'space-b'));
  });

  it('removes the ID and the name when the member leaves and deletes a space', () => {
    const storage = makeStorage();
    const id = getMemberId(storage, 'space-a');
    const other = getMemberId(storage, 'space-b');
    saveMemberName(storage, 'Sparrow');
    forgetMember(storage, 'space-a');
    expect(loadMemberName(storage)).toBe('');
    expect(getMemberId(storage, 'space-a')).not.toBe(id);
    expect(getMemberId(storage, 'space-b')).toBe(other);
  });

  it('saves the display name with no spaces at the ends', () => {
    const storage = makeStorage();
    expect(loadMemberName(storage)).toBe('');
    saveMemberName(storage, '  Sparrow ');
    expect(loadMemberName(storage)).toBe('Sparrow');
  });
});
