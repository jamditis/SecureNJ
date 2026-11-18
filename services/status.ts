import type { MemberStatus, StatusUser } from '../types';

/** The member promised to check in by a time, and that time is past. */
export function isOverdue(user: StatusUser, now: number): boolean {
  return user.checkInBy !== null && now > user.checkInBy;
}

export function needsAttention(user: StatusUser, now: number): boolean {
  return user.status === 'support' || user.status === 'detained' || isOverdue(user, now);
}

/** Members who need attention come first. Then the order is by name. */
export function sortForBoard(users: StatusUser[], now: number): StatusUser[] {
  return [...users].sort(
    (a, b) => Number(needsAttention(b, now)) - Number(needsAttention(a, now)) || a.name.localeCompare(b.name),
  );
}

interface StatusInput {
  id: string;
  name: string;
  status: MemberStatus;
  note: string;
  /** Zero means that the member sets no check-in time. */
  checkInMinutes: number;
}

/** Makes the record for a status update at the current time. */
export function makeStatusUpdate({ id, name, status, note, checkInMinutes }: StatusInput): StatusUser {
  const now = Date.now();
  return {
    id,
    name: name.trim(),
    status,
    note: note.trim(),
    lastUpdated: now,
    checkInBy: checkInMinutes > 0 ? now + checkInMinutes * 60_000 : null,
  };
}
