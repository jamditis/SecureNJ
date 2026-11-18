import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { purgeExpired } from './retention';
import { openSession } from './sync';

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 18, 12);

const sighting = (id: string, ageHours: number) => ({ id, timestamp: NOW - ageHours * HOUR, location: `place ${id}` });

describe('purgeExpired', () => {
  it('deletes old alerts with the default time of 4 hours and keeps new ones', () => {
    const doc = new Y.Doc();
    doc.getMap('sightings').set('old', sighting('old', 5));
    doc.getMap('sightings').set('new', sighting('new', 2));
    purgeExpired(doc, NOW);
    expect(Array.from(doc.getMap('sightings').keys())).toEqual(['new']);
  });

  it('uses the retention time of the space, not a setting of one device', () => {
    const doc = new Y.Doc();
    doc.getMap('settings').set('alertRetentionHours', 1);
    doc.getMap('sightings').set('s', sighting('s', 2));
    purgeExpired(doc, NOW);
    expect(doc.getMap('sightings').size).toBe(0);
  });

  it('deletes old posts with the default time of 48 hours, and keeps all posts when the time is 0', () => {
    const doc = new Y.Doc();
    doc.getMap('posts').set('p', { id: 'p', timestamp: NOW - 50 * HOUR });
    purgeExpired(doc, NOW);
    expect(doc.getMap('posts').size).toBe(0);

    const kept = new Y.Doc();
    kept.getMap('settings').set('aidRetentionHours', 0);
    kept.getMap('posts').set('p', { id: 'p', timestamp: NOW - 500 * HOUR });
    purgeExpired(kept, NOW);
    expect(kept.getMap('posts').size).toBe(1);
  });

  it('deletes confirmations and positions that belong to a record that is gone', () => {
    const doc = new Y.Doc();
    doc.getMap('sightings').set('old', sighting('old', 5));
    doc.getMap('sightings').set('new', sighting('new', 1));
    doc.getMap('confirmations').set('old:a', { sightingId: 'old', memberId: 'a' });
    doc.getMap('confirmations').set('new:a', { sightingId: 'new', memberId: 'a' });
    doc.getMap('proposals').set('p1', { id: 'p1' });
    doc.getMap('votes').set('p1:a', { proposalId: 'p1', memberId: 'a' });
    doc.getMap('votes').set('gone:a', { proposalId: 'gone', memberId: 'a' });
    purgeExpired(doc, NOW);
    expect(Array.from(doc.getMap('confirmations').keys())).toEqual(['new:a']);
    expect(Array.from(doc.getMap('votes').keys())).toEqual(['p1:a']);
  });

  it('does not stop on a record that has no time', () => {
    const doc = new Y.Doc();
    doc.getMap('sightings').set('bad', 'not a record');
    doc.getMap('sightings').set('old', sighting('old', 5));
    purgeExpired(doc, NOW);
    expect(Array.from(doc.getMap('sightings').keys())).toEqual(['bad']);
  });
});

/** Reads all bytes that the browser database holds for one document, as text. */
async function storedText(dbName: string): Promise<string> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const updates = await new Promise<Uint8Array[]>((resolve, reject) => {
    const request = db.transaction('updates').objectStore('updates').getAll();
    request.onsuccess = () => resolve(request.result as Uint8Array[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return updates.map((update) => new TextDecoder('latin1').decode(update)).join('\n');
}

describe('browser database', () => {
  it('does not keep the text of a deleted record', async () => {
    const session = openSession({ keys: null, signaling: [], memberId: 'me', persist: true });
    await session.ready;
    const map = session.doc.getMap('sightings');
    map.set('s1', { id: 's1', timestamp: Date.now(), location: 'Secret meeting corner' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await storedText('snj-local')).toContain('Secret meeting corner');

    map.delete('s1');
    await session.compact();
    expect(await storedText('snj-local')).not.toContain('Secret meeting corner');
    session.close();
  });
});
