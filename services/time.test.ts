import { describe, expect, it } from 'vitest';
import { expiredIds } from './retention';
import { timeAgo } from './time';

const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe('timeAgo', () => {
  it('shows "now" for less than one minute', () => {
    expect(timeAgo(NOW - 30_000, NOW, 'en')).toBe('now');
  });

  it('shows minutes, hours, and days', () => {
    expect(timeAgo(NOW - 5 * MINUTE, NOW, 'en')).toBe('5 min. ago');
    expect(timeAgo(NOW - 3 * HOUR, NOW, 'en')).toBe('3 hr. ago');
    expect(timeAgo(NOW - 50 * HOUR, NOW, 'en')).toBe('2 days ago');
  });

  it('does not show a time in the future when a peer clock is ahead', () => {
    expect(timeAgo(NOW + 10 * MINUTE, NOW, 'en')).toBe('now');
  });

  it('uses the language of the UI', () => {
    expect(timeAgo(NOW - 5 * MINUTE, NOW, 'es')).toBe('hace 5 min');
  });
});

describe('expiredIds', () => {
  const records = [
    { id: 'old', timestamp: NOW - 5 * HOUR },
    { id: 'edge', timestamp: NOW - 4 * HOUR },
    { id: 'new', timestamp: NOW - HOUR },
  ];

  it('returns only the records that are older than the retention time', () => {
    expect(expiredIds(records, NOW, 4)).toEqual(['old']);
  });

  it('keeps all records when retention is off', () => {
    expect(expiredIds(records, NOW, 0)).toEqual([]);
    expect(expiredIds(records, NOW, Number.NaN)).toEqual([]);
  });
});
