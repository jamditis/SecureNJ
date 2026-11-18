import type { AidClaim, AidStatus, MutualAidPost } from '../types';
import { expiredIds } from './retention';
import { isMutualAidPost } from './schema';

export function statusOf(postId: string, claims: AidClaim[]): AidStatus {
  return claims.find((claim) => claim.postId === postId)?.status ?? 'open';
}

/**
 * Reads posts from an imported file. It keeps the known fields only, does
 * not accept a time in the future (such a post would never expire), and
 * drops posts that the retention time of the space would delete at once.
 */
export function cleanImportedPosts(data: unknown, now: number, retentionHours = 0): MutualAidPost[] {
  if (!Array.isArray(data)) return [];
  const posts = data.filter(isMutualAidPost).map(
    ({ id, type, category, title, description, contact, timestamp, urgent }): MutualAidPost => ({
      id,
      type,
      category,
      title,
      description,
      contact,
      timestamp: Math.min(timestamp, now),
      urgent,
    }),
  );
  const expired = new Set(expiredIds(posts, now, retentionHours));
  return posts.filter((post) => !expired.has(post.id));
}
