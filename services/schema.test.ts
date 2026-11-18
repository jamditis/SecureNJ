import { describe, expect, it } from 'vitest';
import { isContact, isMutualAidPost, isSighting, isStatusUser, isVote, isWhiteboardStroke } from './schema';
import type { Sighting } from '../types';

const sighting: Sighting = {
  id: 'a',
  type: 'checkpoint',
  location: 'Broad St and Market St',
  description: 'Two vehicles stop cars',
  size: '',
  uniform: '',
  equipment: '',
  timestamp: 1,
  reporterId: 'm1',
  clearedAt: null,
};

describe('record guards', () => {
  it('accepts a complete record', () => {
    expect(isSighting(sighting)).toBe(true);
  });

  it('rejects a record with a missing field, a wrong type, or an unknown option', () => {
    const { location: _location, ...missing } = sighting;
    expect(isSighting(missing)).toBe(false);
    expect(isSighting({ ...sighting, timestamp: 'yesterday' })).toBe(false);
    expect(isSighting({ ...sighting, timestamp: Number.NaN })).toBe(false);
    expect(isSighting({ ...sighting, type: 'party' })).toBe(false);
  });

  it('rejects values that are not objects', () => {
    for (const value of [null, undefined, 'text', 7, [], [sighting]]) {
      expect(isSighting(value)).toBe(false);
      expect(isMutualAidPost(value)).toBe(false);
      expect(isStatusUser(value)).toBe(false);
      expect(isVote(value)).toBe(false);
      expect(isContact(value)).toBe(false);
    }
  });

  it('rejects a stroke with an odd number of coordinates or a coordinate that is not a number', () => {
    const stroke = { id: 's', by: 'm', timestamp: 1, color: '#000', width: 0.003, points: [0.1, 0.2, 0.3, 0.4] };
    expect(isWhiteboardStroke(stroke)).toBe(true);
    expect(isWhiteboardStroke({ ...stroke, points: [0.1, 0.2, 0.3] })).toBe(false);
    expect(isWhiteboardStroke({ ...stroke, points: [0.1, 'x'] })).toBe(false);
  });

  it('accepts only the two contact roles', () => {
    const contact = { id: 'c', name: 'Ana', contact: '555-0100', role: 'Lead', notes: '' };
    expect(isContact(contact)).toBe(true);
    expect(isContact({ ...contact, role: 'Admin' })).toBe(false);
  });
});
