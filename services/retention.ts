import type * as Y from 'yjs';

const HOUR = 60 * 60 * 1000;

/** Retention times are settings of the space. Zero hours means "keep all". */
export const ALERT_RETENTION = { key: 'alertRetentionHours', fallback: 4 } as const;
export const AID_RETENTION = { key: 'aidRetentionHours', fallback: 48 } as const;

interface Dated {
  id: string;
  timestamp: number;
}

/** The records that are older than the retention time. */
export function expiredIds(records: Dated[], now: number, retentionHours: number): string[] {
  if (!(retentionHours > 0)) return [];
  const cutoff = now - retentionHours * HOUR;
  return records.filter((record) => record.timestamp < cutoff).map((record) => record.id);
}

function readHours(doc: Y.Doc, setting: { key: string; fallback: number }): number {
  const stored = doc.getMap('settings').get(setting.key);
  return typeof stored === 'number' && Number.isFinite(stored) ? stored : setting.fallback;
}

function fieldOf(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[name] : undefined;
}

function deleteWhere(map: Y.Map<unknown>, shouldDelete: (value: unknown) => boolean): number {
  const keys: string[] = [];
  map.forEach((value, key) => {
    if (shouldDelete(value)) keys.push(key);
  });
  keys.forEach((key) => map.delete(key));
  return keys.length;
}

function deleteOlderThan(map: Y.Map<unknown>, now: number, hours: number): number {
  if (!(hours > 0)) return 0;
  const cutoff = now - hours * HOUR;
  return deleteWhere(map, (value) => {
    const timestamp = fieldOf(value, 'timestamp');
    return typeof timestamp === 'number' && timestamp < cutoff;
  });
}

/** Deletes the records of `map` that point to a parent record that is gone. */
function deleteOrphans(map: Y.Map<unknown>, parentField: string, parents: Y.Map<unknown>): number {
  return deleteWhere(map, (value) => {
    const parentId = fieldOf(value, parentField);
    return typeof parentId === 'string' && !parents.has(parentId);
  });
}

/**
 * A deleted record leaves a marker. Two members can delete and edit one
 * record at the same time: the edit writes the full record again, so with
 * no marker the deleted record comes back after the merge, without the
 * records that belonged to it. `useRecords` hides a record that has a
 * marker, and `purgeExpired` deletes it again.
 */
const DELETED_MAP = 'deleted';
const MARKER_DAYS = 30;
export const deletedKey = (mapName: string, key: string) => `${mapName}:${key}`;

export function isDeleted(doc: Y.Doc, mapName: string, key: string): boolean {
  return doc.getMap(DELETED_MAP).has(deletedKey(mapName, key));
}

/** Deletes records for the full group and leaves a marker for each. */
export function deleteRecords(doc: Y.Doc, mapName: string, keys: string[], now: number = Date.now()): void {
  doc.transact(() => {
    const map = doc.getMap(mapName);
    const markers = doc.getMap<number>(DELETED_MAP);
    keys.forEach((key) => {
      map.delete(key);
      markers.set(deletedKey(mapName, key), now);
    });
  });
}

/** Deletes records that came back after a delete, and markers that are old. */
function applyMarkers(doc: Y.Doc, now: number): number {
  const markers = doc.getMap<unknown>(DELETED_MAP);
  let deleted = 0;
  const old: string[] = [];
  markers.forEach((at, marker) => {
    const split = marker.indexOf(':');
    const map = doc.getMap(marker.slice(0, split));
    const key = marker.slice(split + 1);
    if (map.has(key)) {
      map.delete(key);
      deleted += 1;
    }
    if (typeof at !== 'number' || now - at > MARKER_DAYS * 24 * HOUR) old.push(marker);
  });
  old.forEach((marker) => markers.delete(marker));
  return deleted;
}

/**
 * Deletes expired records and the records that belonged to them, for the
 * full space. It runs for the open document at all times, not only while a
 * tool is on the screen. Returns the number of deleted records.
 */
export function purgeExpired(doc: Y.Doc, now: number): number {
  let deleted = 0;
  doc.transact(() => {
    deleted += applyMarkers(doc, now);
    const sightings = doc.getMap<unknown>('sightings');
    const posts = doc.getMap<unknown>('posts');
    deleted += deleteOlderThan(sightings, now, readHours(doc, ALERT_RETENTION));
    deleted += deleteOlderThan(posts, now, readHours(doc, AID_RETENTION));
    deleted += deleteOrphans(doc.getMap('confirmations'), 'sightingId', sightings);
    deleted += deleteOrphans(doc.getMap('claims'), 'postId', posts);
    deleted += deleteOrphans(doc.getMap('votes'), 'proposalId', doc.getMap('proposals'));
    deleted += deleteOrphans(doc.getMap('shiftSignups'), 'shiftId', doc.getMap('shifts'));
    deleted += deleteOrphans(doc.getMap('supplyAdjustments'), 'itemId', doc.getMap('supplies'));
  });
  return deleted;
}
