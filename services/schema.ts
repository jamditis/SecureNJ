/**
 * Type guards for records that arrive from peers or from imported files.
 * A record that does not pass its guard is ignored. One bad record must not
 * stop the tool for the full group.
 */
import type {
  AidClaim,
  Confirmation,
  Contact,
  MutualAidPost,
  Proposal,
  Sighting,
  StatusUser,
  Vote,
  WhiteboardStroke,
} from '../types';

type Fields = Record<string, unknown>;

function fields(value: unknown): Fields | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Fields) : null;
}

function strings(v: Fields, ...keys: string[]): boolean {
  return keys.every((key) => typeof v[key] === 'string');
}

function oneOf(value: unknown, options: readonly string[]): boolean {
  return typeof value === 'string' && options.includes(value);
}

function time(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function timeOrNull(value: unknown): boolean {
  return value === null || time(value);
}

export function isSighting(value: unknown): value is Sighting {
  const v = fields(value);
  return (
    v !== null &&
    strings(v, 'id', 'location', 'description', 'size', 'uniform', 'equipment', 'reporterId') &&
    oneOf(v.type, ['raid', 'checkpoint', 'surveillance', 'other']) &&
    time(v.timestamp) &&
    timeOrNull(v.clearedAt)
  );
}

export function isConfirmation(value: unknown): value is Confirmation {
  const v = fields(value);
  return v !== null && strings(v, 'sightingId', 'memberId');
}

export function isMutualAidPost(value: unknown): value is MutualAidPost {
  const v = fields(value);
  return (
    v !== null &&
    strings(v, 'id', 'category', 'title', 'description', 'contact') &&
    oneOf(v.type, ['request', 'offer']) &&
    typeof v.urgent === 'boolean' &&
    time(v.timestamp)
  );
}

export function isAidClaim(value: unknown): value is AidClaim {
  const v = fields(value);
  return v !== null && strings(v, 'postId', 'claimedBy') && oneOf(v.status, ['claimed', 'done']);
}

export function isProposal(value: unknown): value is Proposal {
  const v = fields(value);
  return v !== null && strings(v, 'id', 'text') && oneOf(v.status, ['active', 'closed']) && time(v.timestamp);
}

export function isVote(value: unknown): value is Vote {
  const v = fields(value);
  return v !== null && strings(v, 'proposalId', 'memberId', 'concern', 'name') && oneOf(v.type, ['support', 'reservations', 'stand-aside', 'block']);
}

export function isStatusUser(value: unknown): value is StatusUser {
  const v = fields(value);
  return (
    v !== null &&
    strings(v, 'id', 'name', 'note') &&
    oneOf(v.status, ['safe', 'transit', 'support', 'detained']) &&
    time(v.lastUpdated) &&
    timeOrNull(v.checkInBy)
  );
}

export function isWhiteboardStroke(value: unknown): value is WhiteboardStroke {
  const v = fields(value);
  return (
    v !== null &&
    strings(v, 'id', 'by', 'color') &&
    time(v.timestamp) &&
    time(v.width) &&
    Array.isArray(v.points) &&
    v.points.length % 2 === 0 &&
    v.points.every(time)
  );
}

export function isContact(value: unknown): value is Contact {
  const v = fields(value);
  return v !== null && strings(v, 'id', 'name', 'contact', 'notes') && oneOf(v.role, ['Lead', 'Member']);
}

/**
 * The map key that a record must have. `useRecords` ignores a record under
 * a different key: delete and update use this key, so such a record could
 * not be removed.
 */
export const keyOfId = (record: { id: string }) => record.id;
export const keyOfConfirmation = (c: Confirmation) => `${c.sightingId}:${c.memberId}`;
export const keyOfVote = (v: Vote) => `${v.proposalId}:${v.memberId}`;
export const keyOfClaim = (c: AidClaim) => c.postId;
