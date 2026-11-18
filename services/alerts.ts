import type { Confirmation, Sighting } from '../types';
import { keyOfConfirmation } from './schema';

export type AlertState = 'cleared' | 'confirmed' | 'unconfirmed';

export const confirmationKey = (sightingId: string, memberId: string) => keyOfConfirmation({ sightingId, memberId });

/** The number of members, other than the reporter, who also saw the activity. */
export function countConfirmations(sighting: Sighting, confirmations: Confirmation[]): number {
  const members = new Set(
    confirmations
      .filter((c) => c.sightingId === sighting.id && c.memberId !== sighting.reporterId)
      .map((c) => c.memberId),
  );
  return members.size;
}

/** One report from one person is not confirmed. Rumors cause harm. */
export function alertState(sighting: Sighting, confirmations: Confirmation[]): AlertState {
  if (sighting.clearedAt !== null) return 'cleared';
  return countConfirmations(sighting, confirmations) > 0 ? 'confirmed' : 'unconfirmed';
}
