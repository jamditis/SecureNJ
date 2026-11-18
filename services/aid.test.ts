import { describe, expect, it } from 'vitest';
import { cleanImportedPosts, statusOf } from './aid';

const NOW = 1_000_000;
const post = {
  id: 'p1',
  type: 'request',
  category: 'food',
  title: 'Groceries',
  description: '',
  contact: '',
  timestamp: 500,
  urgent: false,
};

describe('cleanImportedPosts', () => {
  it('keeps the known fields only', () => {
    const [clean] = cleanImportedPosts([{ ...post, status: 'done', extra: 'x'.repeat(100) }], NOW);
    expect(clean).toEqual(post);
  });

  it('does not accept a time in the future, which would never expire', () => {
    const [clean] = cleanImportedPosts([{ ...post, timestamp: NOW * 1000 }], NOW);
    expect(clean.timestamp).toBe(NOW);
  });

  it('drops a post that the retention time of the space would delete at once', () => {
    const HOUR = 60 * 60 * 1000;
    const now = 100 * HOUR;
    const old = { ...post, id: 'old', timestamp: now - 50 * HOUR };
    const fresh = { ...post, id: 'fresh', timestamp: now - HOUR };
    expect(cleanImportedPosts([old, fresh], now, 48).map((p) => p.id)).toEqual(['fresh']);
    expect(cleanImportedPosts([old, fresh], now, 0)).toHaveLength(2);
  });

  it('drops entries that are not posts, and returns nothing for data that is not a list', () => {
    expect(cleanImportedPosts([post, { id: 'x' }, 'text', null], NOW)).toHaveLength(1);
    expect(cleanImportedPosts({ posts: [post] }, NOW)).toEqual([]);
  });
});

describe('statusOf', () => {
  it('is open when the post has no claim record', () => {
    expect(statusOf('p1', [])).toBe('open');
    expect(statusOf('p1', [{ postId: 'p2', status: 'done', claimedBy: '' }])).toBe('open');
    expect(statusOf('p1', [{ postId: 'p1', status: 'claimed', claimedBy: 'Wren' }])).toBe('claimed');
  });
});
