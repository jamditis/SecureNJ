import { describe, expect, it } from 'vitest';
import { alertState, countConfirmations } from './alerts';
import { tallyVotes } from './consensus';
import { buildPhoneTree, parseContacts, treeDepth } from './phoneTree';
import { isOverdue, needsAttention, sortForBoard } from './status';
import { isFarEnough, isNearStroke, lastStrokeOf, toBoardPoint } from './whiteboard';
import type { Contact, Sighting, StatusUser, Vote, VoteType, WhiteboardStroke } from '../types';

describe('alerts', () => {
  const sighting: Sighting = {
    id: 's1',
    type: 'raid',
    location: 'x',
    description: '',
    size: '',
    uniform: '',
    equipment: '',
    timestamp: 0,
    reporterId: 'reporter',
    clearedAt: null,
  };

  it('is not confirmed when only the reporter confirms', () => {
    const confirmations = [{ sightingId: 's1', memberId: 'reporter' }];
    expect(countConfirmations(sighting, confirmations)).toBe(0);
    expect(alertState(sighting, confirmations)).toBe('unconfirmed');
  });

  it('is confirmed when a different member confirms, and ignores other sightings', () => {
    const confirmations = [
      { sightingId: 's1', memberId: 'a' },
      { sightingId: 's1', memberId: 'b' },
      { sightingId: 's2', memberId: 'c' },
    ];
    expect(countConfirmations(sighting, confirmations)).toBe(2);
    expect(alertState(sighting, confirmations)).toBe('confirmed');
  });

  it('is cleared when a member marks the location as clear', () => {
    expect(alertState({ ...sighting, clearedAt: 5 }, [{ sightingId: 's1', memberId: 'a' }])).toBe('cleared');
  });
});

describe('consensus', () => {
  const votes = (...types: VoteType[]): Vote[] =>
    types.map((type, i) => ({ proposalId: 'p', memberId: `m${i}`, type, concern: '', name: '' }));

  it('has no outcome with no votes', () => {
    expect(tallyVotes([]).outcome).toBe('none');
  });

  it('is blocked by one block, with any number of supporters', () => {
    const tally = tallyVotes(votes('support', 'support', 'support', 'block'));
    expect(tally.outcome).toBe('blocked');
    expect(tally).toMatchObject({ support: 3, block: 1, total: 4 });
  });

  it('reports reservations when there is a concern but no block', () => {
    expect(tallyVotes(votes('support', 'reservations', 'stand-aside')).outcome).toBe('reservations');
  });

  it('reaches consensus when stand-asides are the only votes that are not support', () => {
    expect(tallyVotes(votes('support', 'stand-aside')).outcome).toBe('consensus');
  });

  it('has no support when all members stand aside', () => {
    expect(tallyVotes(votes('stand-aside', 'stand-aside')).outcome).toBe('no-support');
  });
});

describe('phone tree', () => {
  const person = (name: string, role: Contact['role'] = 'Member'): Contact => ({
    id: name,
    name,
    contact: `555-${name}`,
    role,
    notes: '',
  });
  const names = (people: Contact[]) => people.map((p) => p.name);

  it('returns an empty tree for no contacts', () => {
    expect(buildPhoneTree([], 2)).toEqual([]);
  });

  it('puts each person in the tree one time', () => {
    const contacts = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((n) => person(n));
    const tree = buildPhoneTree(contacts, 2);
    expect(names(tree.map((node) => node.person)).sort()).toEqual(names(contacts).sort());
    const called = tree.flatMap((node) => names(node.calls));
    expect(new Set(called).size).toBe(called.length);
    expect(called).toHaveLength(contacts.length - 1);
  });

  it('puts leads at the top and gives each lead a branch', () => {
    const tree = buildPhoneTree([person('m1'), person('L1', 'Lead'), person('m2'), person('L2', 'Lead'), person('m3')], 2);
    expect(tree[0]).toMatchObject({ person: { name: 'L1' }, calledBy: null, level: 0 });
    expect(tree[1]).toMatchObject({ person: { name: 'L2' }, calledBy: null, level: 0 });
    expect(names(tree[0].calls)).toEqual(['m1', 'm2']);
    expect(names(tree[1].calls)).toEqual(['m3']);
  });

  it('uses the first contact as the top when there is no lead', () => {
    const tree = buildPhoneTree([person('a'), person('b'), person('c'), person('d')], 2);
    expect(tree[0].calledBy).toBeNull();
    expect(names(tree[0].calls)).toEqual(['b', 'c']);
    expect(tree.find((node) => node.person.name === 'd')?.calledBy?.name).toBe('b');
    expect(treeDepth(tree)).toBe(3);
  });

  it('gives no person more calls than the branch setting', () => {
    const contacts = Array.from({ length: 20 }, (_, i) => person(`p${i}`));
    for (const branching of [1, 2, 3, 5]) {
      expect(Math.max(...buildPhoneTree(contacts, branching).map((node) => node.calls.length))).toBeLessThanOrEqual(branching);
    }
  });

  it('reads contacts from a file, drops bad entries, and makes new IDs', () => {
    const contacts = parseContacts([
      { id: 'keep-me', name: ' Ana ', contact: '555-0100', role: 'Lead', notes: 'n' },
      { name: 'Ben', contact: '555-0101', role: 'Admin' },
      { name: '', contact: '555-0102' },
      { name: 'No contact' },
      'text',
      null,
    ]);
    expect(contacts).toHaveLength(2);
    expect(contacts[0]).toMatchObject({ name: 'Ana', role: 'Lead', notes: 'n' });
    expect(contacts[0].id).not.toBe('keep-me');
    expect(contacts[1]).toMatchObject({ name: 'Ben', role: 'Member', notes: '' });
  });

  it('refuses a file that is not a contact list', () => {
    expect(() => parseContacts({ name: 'Ana' })).toThrow();
    expect(() => parseContacts([{ title: 'wrong' }])).toThrow();
  });
});

describe('group check-in', () => {
  const NOW = 1_000_000;
  const user = (name: string, patch: Partial<StatusUser> = {}): StatusUser => ({
    id: name,
    name,
    status: 'safe',
    note: '',
    lastUpdated: NOW,
    checkInBy: null,
    ...patch,
  });

  it('is overdue only after the promised time', () => {
    expect(isOverdue(user('a'), NOW)).toBe(false);
    expect(isOverdue(user('a', { checkInBy: NOW + 1 }), NOW)).toBe(false);
    expect(isOverdue(user('a', { checkInBy: NOW - 1 }), NOW)).toBe(true);
  });

  it('flags members who need support, are detained, or are overdue', () => {
    expect(needsAttention(user('a'), NOW)).toBe(false);
    expect(needsAttention(user('a', { status: 'transit' }), NOW)).toBe(false);
    expect(needsAttention(user('a', { status: 'support' }), NOW)).toBe(true);
    expect(needsAttention(user('a', { status: 'detained' }), NOW)).toBe(true);
    expect(needsAttention(user('a', { checkInBy: NOW - 1 }), NOW)).toBe(true);
  });

  it('shows members who need attention first', () => {
    const sorted = sortForBoard([user('Ana'), user('Zed', { status: 'detained' }), user('Bo')], NOW);
    expect(sorted.map((u) => u.name)).toEqual(['Zed', 'Ana', 'Bo']);
  });
});

describe('whiteboard', () => {
  const stroke = (patch: Partial<WhiteboardStroke>): WhiteboardStroke => ({
    id: 's',
    by: 'me',
    timestamp: 1,
    points: [0.1, 0.1, 0.5, 0.1],
    color: '#000',
    width: 0.004,
    ...patch,
  });

  it('gives the same board point for the same position on screens of different sizes', () => {
    const phone = toBoardPoint(10 + 180, 20 + 90, { left: 10, top: 20, width: 360 });
    const desktop = toBoardPoint(100 + 600, 50 + 300, { left: 100, top: 50, width: 1200 });
    expect(phone).toEqual([0.5, 0.25]);
    expect(desktop).toEqual(phone);
  });

  it('drops a point that is very near the last point', () => {
    expect(isFarEnough([], 0.1, 0.1)).toBe(true);
    expect(isFarEnough([0.1, 0.1], 0.1005, 0.1)).toBe(false);
    expect(isFarEnough([0.1, 0.1], 0.2, 0.1)).toBe(true);
  });

  it('hits a stroke in the middle of a segment and misses a distant point', () => {
    expect(isNearStroke(stroke({}), 0.3, 0.105, 0.01)).toBe(true);
    expect(isNearStroke(stroke({}), 0.3, 0.2, 0.01)).toBe(false);
    expect(isNearStroke(stroke({}), 0.7, 0.1, 0.01)).toBe(false);
  });

  it('hits a stroke that is one dot', () => {
    expect(isNearStroke(stroke({ points: [0.4, 0.4] }), 0.405, 0.4, 0.01)).toBe(true);
    expect(isNearStroke(stroke({ points: [0.4, 0.4] }), 0.5, 0.4, 0.01)).toBe(false);
  });

  it('finds the newest stroke of one member for undo', () => {
    const strokes = [
      stroke({ id: 'a', timestamp: 1 }),
      stroke({ id: 'b', timestamp: 3 }),
      stroke({ id: 'c', timestamp: 5, by: 'other' }),
    ];
    expect(lastStrokeOf(strokes, 'me')?.id).toBe('b');
    expect(lastStrokeOf(strokes, 'nobody')).toBeUndefined();
  });
});
