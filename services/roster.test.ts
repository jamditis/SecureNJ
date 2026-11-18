import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { deleteRecords, isDeleted, purgeExpired } from './retention';
import {
  countGaps,
  isShift,
  openSlots,
  readShiftDraft,
  toShiftDraft,
  upcomingShifts,
  type Shift,
  type ShiftSignup,
} from './shifts';
import { changeFor, clampDelta, countLow, isLow, isSupplyAdjustment, isSupplyItem, quantityOf, type SupplyItem } from './supplies';

const HOUR = 60 * 60 * 1000;
const NOW = new Date(2026, 10, 18, 12, 0).getTime();

const shift = (patch: Partial<Shift> = {}): Shift => ({
  id: 's1',
  title: 'Hotline',
  location: 'Office',
  start: NOW + HOUR,
  end: NOW + 3 * HOUR,
  needed: 2,
  notes: '',
  ...patch,
});
const signup = (shiftId: string, memberId: string): ShiftSignup => ({ shiftId, memberId, name: memberId });

describe('shift roster', () => {
  it('counts the people that a shift still needs, and never less than zero', () => {
    expect(openSlots(shift(), [])).toBe(2);
    expect(openSlots(shift(), [signup('s1', 'a'), signup('other', 'b')])).toBe(1);
    expect(openSlots(shift(), [signup('s1', 'a'), signup('s1', 'b'), signup('s1', 'c')])).toBe(0);
  });

  it('lists shifts that are not over, soonest first', () => {
    const shifts = [
      shift({ id: 'later', start: NOW + 5 * HOUR, end: NOW + 6 * HOUR }),
      shift({ id: 'over', start: NOW - 5 * HOUR, end: NOW - HOUR }),
      shift({ id: 'now', start: NOW - HOUR, end: NOW + HOUR }),
    ];
    expect(upcomingShifts(shifts, NOW).map((s) => s.id)).toEqual(['now', 'later']);
  });

  it('counts only shifts that are not over and are not full as gaps', () => {
    const shifts = [shift({ id: 'full', needed: 1 }), shift({ id: 'open' }), shift({ id: 'over', end: NOW - 1, start: NOW - HOUR })];
    expect(countGaps(shifts, [signup('full', 'a')], NOW)).toBe(1);
  });

  it('reads a shift from the form and gives the same form back', () => {
    const draft = { title: ' Food pickup ', location: 'Pantry', date: '2026-11-20', startTime: '09:30', endTime: '11:00', needed: '3', notes: '' };
    const fields = readShiftDraft(draft);
    expect(fields).toMatchObject({ title: 'Food pickup', needed: 3 });
    if (typeof fields === 'string') throw new Error(fields);
    expect(fields.end - fields.start).toBe(1.5 * HOUR);
    expect(toShiftDraft({ id: 'x', ...fields })).toEqual({ ...draft, title: 'Food pickup' });
  });

  it('keeps a deleted shift deleted when a different member edits it at the same time', () => {
    const ana = new Y.Doc();
    ana.getMap('shifts').set('s1', shift());
    ana.getMap('shiftSignups').set('s1:a', signup('s1', 'a'));
    const ben = new Y.Doc();
    Y.applyUpdate(ben, Y.encodeStateAsUpdate(ana));

    // Ana deletes the shift. Ben, who is not connected, changes its title.
    deleteRecords(ana, 'shifts', ['s1']);
    ana.getMap('shiftSignups').delete('s1:a');
    ben.getMap('shifts').set('s1', shift({ title: 'Hotline, room 2' }));
    Y.applyUpdate(ana, Y.encodeStateAsUpdate(ben));
    Y.applyUpdate(ben, Y.encodeStateAsUpdate(ana));

    for (const doc of [ana, ben]) {
      // The record can be in the map again after the merge, but it has a marker: tools hide it.
      expect(isDeleted(doc, 'shifts', 's1')).toBe(true);
      purgeExpired(doc, NOW);
      expect(doc.getMap('shifts').has('s1')).toBe(false);
    }
  });

  it('removes a delete marker after 30 days', () => {
    const doc = new Y.Doc();
    deleteRecords(doc, 'shifts', ['s1'], NOW);
    purgeExpired(doc, NOW + 29 * 24 * HOUR);
    expect(isDeleted(doc, 'shifts', 's1')).toBe(true);
    purgeExpired(doc, NOW + 31 * 24 * HOUR);
    expect(isDeleted(doc, 'shifts', 's1')).toBe(false);
  });

  it('treats an end time before the start time as a shift that ends on the next day', () => {
    const fields = readShiftDraft({ title: 'Night watch', location: '', date: '2026-11-20', startTime: '22:00', endTime: '02:00', needed: '2', notes: '' });
    if (typeof fields === 'string') throw new Error(fields);
    expect(fields.end - fields.start).toBe(4 * HOUR);
  });

  it('reports what is wrong with a form', () => {
    const good = { title: 'x', location: '', date: '2026-11-20', startTime: '09:00', endTime: '10:00', needed: '1', notes: '' };
    expect(readShiftDraft({ ...good, title: '  ' })).toBe('title');
    expect(readShiftDraft({ ...good, date: '' })).toBe('time');
    expect(readShiftDraft({ ...good, needed: '0' })).toBe('needed');
    expect(readShiftDraft({ ...good, needed: '1.5' })).toBe('needed');
    expect(readShiftDraft({ ...good, needed: 'many' })).toBe('needed');
  });

  it('accepts only a complete shift record from a peer', () => {
    expect(isShift(shift())).toBe(true);
    expect(isShift({ ...shift(), needed: 0 })).toBe(false);
    expect(isShift({ ...shift(), start: 'tomorrow' })).toBe(false);
    expect(isShift(null)).toBe(false);
  });

  it('deletes the sign-ups of a shift that is gone', () => {
    const doc = new Y.Doc();
    doc.getMap('shifts').set('s1', shift());
    doc.getMap('shiftSignups').set('s1:a', signup('s1', 'a'));
    doc.getMap('shiftSignups').set('gone:a', signup('gone', 'a'));
    purgeExpired(doc, NOW);
    expect(Array.from(doc.getMap('shiftSignups').keys())).toEqual(['s1:a']);
  });
});

describe('supply inventory', () => {
  const item: SupplyItem = { id: 'water', name: 'Water', unit: 'cases', location: 'Garage', lowAt: 5, notes: '' };
  const adjust = (itemId: string, delta: number, id = `${itemId}${delta}${Math.random()}`) => ({ id, itemId, delta, timestamp: NOW });

  it('gets the quantity from the sum of the changes to one item', () => {
    const adjustments = [adjust('water', 20), adjust('water', -3), adjust('masks', 100)];
    expect(quantityOf('water', adjustments)).toBe(17);
    expect(quantityOf('unknown', adjustments)).toBe(0);
  });

  it('keeps both changes when two members take stock at the same time', () => {
    const ana = new Y.Doc();
    ana.getMap('supplyAdjustments').set('a0', adjust('water', 20, 'a0'));
    const ben = new Y.Doc();
    Y.applyUpdate(ben, Y.encodeStateAsUpdate(ana));

    ana.getMap('supplyAdjustments').set('a1', adjust('water', -2, 'a1'));
    ben.getMap('supplyAdjustments').set('b1', adjust('water', -5, 'b1'));
    Y.applyUpdate(ana, Y.encodeStateAsUpdate(ben));
    Y.applyUpdate(ben, Y.encodeStateAsUpdate(ana));

    for (const doc of [ana, ben]) {
      const all = Array.from(doc.getMap('supplyAdjustments').values()).filter(isSupplyAdjustment);
      expect(quantityOf('water', all)).toBe(13);
    }
  });

  it('shows zero, not a negative number, when two members each take the last stock', () => {
    const taken = [adjust('water', 5), adjust('water', -5), adjust('water', -5)];
    expect(quantityOf('water', taken)).toBe(0);
    // The next "add 10" must show 10, so its record also covers the missing 5.
    const change = changeFor(10, taken);
    expect(change).toBe(15);
    expect(quantityOf('water', [...taken, adjust('water', change)])).toBe(10);
    expect(changeFor(-3, taken)).toBe(-0);
  });

  it('flags an item at or below its low level', () => {
    expect(isLow(item, [adjust('water', 6)])).toBe(false);
    expect(isLow(item, [adjust('water', 5)])).toBe(true);
    expect(isLow(item, [])).toBe(true);
    expect(countLow([item, { ...item, id: 'masks', lowAt: 0 }], [adjust('water', 9), adjust('masks', 1)])).toBe(0);
  });

  it('does not take more stock than is left', () => {
    expect(clampDelta(-5, 3)).toBe(-3);
    expect(clampDelta(-5, 0)).toBe(-0);
    expect(clampDelta(-2, 10)).toBe(-2);
    expect(clampDelta(4, 0)).toBe(4);
    expect(clampDelta(Number.NaN, 5)).toBe(0);
  });

  it('accepts only complete records from a peer', () => {
    expect(isSupplyItem(item)).toBe(true);
    expect(isSupplyItem({ ...item, lowAt: '5' })).toBe(false);
    expect(isSupplyAdjustment(adjust('water', 1))).toBe(true);
    expect(isSupplyAdjustment({ id: 'x', itemId: 'water', delta: Infinity, timestamp: 1 })).toBe(false);
  });

  it('deletes the changes of an item that is gone', () => {
    const doc = new Y.Doc();
    doc.getMap('supplies').set('water', item);
    doc.getMap('supplyAdjustments').set('a', adjust('water', 1, 'a'));
    doc.getMap('supplyAdjustments').set('b', adjust('gone', 1, 'b'));
    purgeExpired(doc, NOW);
    expect(Array.from(doc.getMap('supplyAdjustments').keys())).toEqual(['a']);
  });
});
