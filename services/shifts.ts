/** Shift roster: records, guards, and logic. */

export interface Shift {
  id: string;
  /** The task or role, for example "Hotline" or "Food pickup". */
  title: string;
  location: string;
  /** Start and end as milliseconds since 1970. */
  start: number;
  end: number;
  /** How many people the shift needs. */
  needed: number;
  notes: string;
}

/** One member on one shift. Stored with the key `${shiftId}:${memberId}`. */
export interface ShiftSignup {
  shiftId: string;
  memberId: string;
  /** The display name of the member at the time of the sign-up. */
  name: string;
}

type Fields = Record<string, unknown>;
const fieldsOf = (value: unknown): Fields | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Fields) : null;
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function isShift(value: unknown): value is Shift {
  const v = fieldsOf(value);
  return (
    v !== null &&
    ['id', 'title', 'location', 'notes'].every((key) => typeof v[key] === 'string') &&
    isTime(v.start) &&
    isTime(v.end) &&
    typeof v.needed === 'number' &&
    Number.isInteger(v.needed) &&
    v.needed >= 1
  );
}

export function isShiftSignup(value: unknown): value is ShiftSignup {
  const v = fieldsOf(value);
  return v !== null && ['shiftId', 'memberId', 'name'].every((key) => typeof v[key] === 'string');
}

export const signupKey = (shiftId: string, memberId: string) => `${shiftId}:${memberId}`;
export const keyOfSignup = (signup: ShiftSignup) => signupKey(signup.shiftId, signup.memberId);

export function signupsOf(shift: Shift, signups: ShiftSignup[]): ShiftSignup[] {
  return signups.filter((signup) => signup.shiftId === shift.id);
}

/** How many more people the shift needs. Zero when the shift is full or over-filled. */
export function openSlots(shift: Shift, signups: ShiftSignup[]): number {
  return Math.max(0, shift.needed - signupsOf(shift, signups).length);
}

export function isPast(shift: Shift, now: number): boolean {
  return shift.end < now;
}

/** Shifts that are not over, soonest first. */
export function upcomingShifts(shifts: Shift[], now: number): Shift[] {
  return shifts.filter((shift) => !isPast(shift, now)).sort((a, b) => a.start - b.start);
}

/** The number of shifts that are not over and still need people. */
export function countGaps(shifts: Shift[], signups: ShiftSignup[], now: number): number {
  return upcomingShifts(shifts, now).filter((shift) => openSlots(shift, signups) > 0).length;
}

export interface ShiftDraft {
  title: string;
  location: string;
  /** Local date as YYYY-MM-DD and local times as HH:MM, from the form fields. */
  date: string;
  startTime: string;
  endTime: string;
  needed: string;
  notes: string;
}

export type ShiftProblem = 'title' | 'time' | 'needed';

/**
 * Makes the fields of a shift from the form. A shift that ends at or before
 * its start time ends on the next day (a night shift).
 */
export function readShiftDraft(draft: ShiftDraft): Omit<Shift, 'id'> | ShiftProblem {
  if (draft.title.trim() === '') return 'title';
  const start = new Date(`${draft.date}T${draft.startTime}`).getTime();
  let end = new Date(`${draft.date}T${draft.endTime}`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'time';
  if (end <= start) end += 24 * 60 * 60 * 1000;
  const needed = Number(draft.needed);
  if (!Number.isInteger(needed) || needed < 1 || needed > 999) return 'needed';
  return { title: draft.title.trim(), location: draft.location.trim(), start, end, needed, notes: draft.notes.trim() };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** The form fields for a shift, in the local time of the device. */
export function toShiftDraft(shift: Shift): ShiftDraft {
  const start = new Date(shift.start);
  const end = new Date(shift.end);
  return {
    title: shift.title,
    location: shift.location,
    date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    needed: String(shift.needed),
    notes: shift.notes,
  };
}
