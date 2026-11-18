import type { Vote, VoteType } from '../types';

/**
 * - `none`: no votes.
 * - `blocked`: one block or more. A block stops the proposal.
 * - `reservations`: no block, but one member or more has a concern.
 * - `consensus`: support, with no block and no concern.
 * - `no-support`: all members stand aside.
 */
export type Outcome = 'none' | 'blocked' | 'reservations' | 'consensus' | 'no-support';

export type Tally = Record<VoteType, number> & { total: number; outcome: Outcome };

export const voteKey = (proposalId: string, memberId: string) => `${proposalId}:${memberId}`;

export function tallyVotes(votes: Vote[]): Tally {
  const counts: Record<VoteType, number> = { support: 0, reservations: 0, 'stand-aside': 0, block: 0 };
  votes.forEach((vote) => {
    counts[vote.type] += 1;
  });
  const total = votes.length;

  let outcome: Outcome;
  if (total === 0) outcome = 'none';
  else if (counts.block > 0) outcome = 'blocked';
  else if (counts.reservations > 0) outcome = 'reservations';
  else if (counts.support > 0) outcome = 'consensus';
  else outcome = 'no-support';

  return { ...counts, total, outcome };
}
