// @vitest-environment jsdom
import { act, cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MutualAidPost, Sighting } from '../types';
import ConsensusBuilder from './ConsensusBuilder';
import MutualAid from './MutualAid';
import PhoneTree from './PhoneTree';
import Sightings from './Sightings';
import StatusBoard from './StatusBoard';
import { createTestSync, renderWithSync } from './test-utils';

afterEach(cleanup);

const HOUR = 60 * 60 * 1000;

const sighting = (patch: Partial<Sighting> = {}): Sighting => ({
  id: 's1',
  type: 'checkpoint',
  location: 'Broad St and Market St',
  description: '',
  size: '',
  uniform: '',
  equipment: '',
  timestamp: Date.now(),
  reporterId: 'other-member',
  clearedAt: null,
  ...patch,
});

describe('safety alerts', () => {
  it('saves a report with the member as the reporter', async () => {
    const user = userEvent.setup();
    const { sync } = renderWithSync(<Sightings />);
    await user.click(screen.getByRole('button', { name: 'Report activity' }));
    await user.type(screen.getByLabelText('Location'), 'Ferry St');
    await user.click(screen.getByRole('button', { name: 'Send the report' }));

    const saved = Array.from(sync.doc.getMap<Sighting>('sightings').values());
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ location: 'Ferry St', reporterId: 'me', clearedAt: null });
    expect(screen.getByText('Not confirmed: one report only')).toBeTruthy();
    // A reporter cannot confirm their own report.
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'I see it too' }).disabled).toBe(true);
  });

  it('shows the good records when a peer sends a bad record', () => {
    const sync = createTestSync();
    const map = sync.doc.getMap<unknown>('sightings');
    map.set('bad-1', { id: 'bad-1', location: 42 });
    map.set('bad-2', 'not a record');
    map.set('s1', sighting());
    renderWithSync(<Sightings />, sync);
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Broad St and Market St')).toBeTruthy();
  });

  it('counts a confirmation from a member who is not the reporter', async () => {
    const user = userEvent.setup();
    const sync = createTestSync();
    sync.doc.getMap('sightings').set('s1', sighting());
    renderWithSync(<Sightings />, sync);
    await user.click(screen.getByRole('button', { name: 'I see it too' }));
    expect(screen.getByText('Confirmed by other members: 1')).toBeTruthy();
    expect(sync.doc.getMap('confirmations').get('s1:me')).toEqual({ sightingId: 's1', memberId: 'me' });
  });

  it('deletes the confirmations of a report together with the report', async () => {
    const user = userEvent.setup();
    const sync = createTestSync();
    sync.doc.getMap('sightings').set('s1', sighting());
    sync.doc.getMap('confirmations').set('s1:a', { sightingId: 's1', memberId: 'a' });
    sync.doc.getMap('confirmations').set('s2:a', { sightingId: 's2', memberId: 'a' });
    renderWithSync(<Sightings />, sync);
    await user.click(screen.getByRole('button', { name: 'Delete the report' }));
    expect(sync.doc.getMap('sightings').size).toBe(0);
    expect(Array.from(sync.doc.getMap('confirmations').keys())).toEqual(['s2:a']);
  });

  it('uses the retention time of the space, not a setting of one device', () => {
    // The space default is 4 hours. A report that is 2 hours old stays.
    const kept = createTestSync();
    kept.doc.getMap('sightings').set('s1', sighting({ timestamp: Date.now() - 2 * HOUR }));
    renderWithSync(<Sightings />, kept);
    expect(kept.doc.getMap('sightings').size).toBe(1);
    cleanup();

    // The space sets 1 hour. Each member then deletes the same report.
    const purged = createTestSync();
    purged.doc.getMap('settings').set('alertRetentionHours', 1);
    purged.doc.getMap('sightings').set('s1', sighting({ timestamp: Date.now() - 2 * HOUR }));
    renderWithSync(<Sightings />, purged);
    expect(purged.doc.getMap('sightings').size).toBe(0);
  });
});

describe('mutual aid board', () => {
  const post: MutualAidPost = {
    id: 'p1',
    type: 'request',
    category: 'transport',
    title: 'Ride to the clinic',
    description: 'Friday at 9',
    contact: '555-0100',
    timestamp: Date.now(),
    urgent: false,
    status: 'open',
    claimedBy: '',
  };

  it('keeps a claim that a different member makes during an edit', async () => {
    const user = userEvent.setup();
    const sync = createTestSync();
    const map = sync.doc.getMap<MutualAidPost>('posts');
    map.set('p1', post);
    renderWithSync(<MutualAid />, sync);

    await user.click(screen.getByRole('button', { name: 'Edit the post' }));
    act(() => {
      map.set('p1', { ...post, status: 'claimed', claimedBy: 'Wren' });
    });
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), ' on Friday');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(map.get('p1')).toMatchObject({ title: 'Ride to the clinic on Friday', status: 'claimed', claimedBy: 'Wren' });
  });

  it('records the name of the member who claims a post', async () => {
    const user = userEvent.setup();
    const sync = createTestSync();
    sync.doc.getMap('posts').set('p1', post);
    renderWithSync(<MutualAid />, sync);
    await user.click(screen.getByRole('button', { name: 'Claim' }));
    expect(screen.getByText('Claimed by Sparrow')).toBeTruthy();
  });

  it('hides the contact until the member asks for it', async () => {
    const user = userEvent.setup();
    const sync = createTestSync();
    sync.doc.getMap('posts').set('p1', post);
    renderWithSync(<MutualAid />, sync);
    expect(screen.queryByText('555-0100')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show the contact' }));
    expect(screen.getByText('555-0100')).toBeTruthy();
  });
});

describe('phone tree', () => {
  const addContact = async (user: ReturnType<typeof userEvent.setup>, name: string, phone: string) => {
    await user.type(screen.getByLabelText('Name'), name);
    await user.type(screen.getByLabelText('Phone or Signal'), phone);
    await user.click(screen.getByRole('button', { name: 'Add' }));
  };

  it('keeps the contacts when the user opens a different tool and comes back', async () => {
    const user = userEvent.setup();
    const sync = createTestSync();
    const first = renderWithSync(<PhoneTree />, sync);
    await addContact(user, 'Ana', '555-0100');
    first.unmount();

    renderWithSync(<PhoneTree />, sync);
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Contacts: 1')).toBeTruthy();
  });

  it('keeps the contacts out of the shared document', async () => {
    const user = userEvent.setup();
    const { sync } = renderWithSync(<PhoneTree />);
    await addContact(user, 'Ana', '555-0100');
    expect(sync.privateDoc.getMap('contacts').size).toBe(1);
    expect(sync.doc.share.size).toBe(0);
  });

  it('gives each person a card that names only the people they talk to', async () => {
    const user = userEvent.setup();
    renderWithSync(<PhoneTree />);
    for (const [name, phone] of [['Ana', '1'], ['Ben', '2'], ['Cy', '3'], ['Di', '4']]) {
      await addContact(user, name, phone);
    }
    const cards = screen.getAllByText(/^Phone tree card for/).map((node) => node.textContent ?? '');
    const di = cards.find((card) => card.startsWith('Phone tree card for Di'));
    expect(di).toContain('Ben (2)');
    expect(di).not.toContain('Ana');
    expect(di).not.toContain('Cy');
  });
});

describe('consensus builder', () => {
  it('gives each member one position and removes it on a second click', async () => {
    const user = userEvent.setup();
    const sync = createTestSync();
    sync.doc.getMap('proposals').set('p1', { id: 'p1', text: 'Meet on Thursday', timestamp: 1, status: 'active' });
    renderWithSync(<ConsensusBuilder />, sync);
    const votes = sync.doc.getMap('votes');

    await user.click(screen.getByRole('button', { name: /^Support/ }));
    await user.click(screen.getByRole('button', { name: /^Block/ }));
    expect(votes.size).toBe(1);
    expect(votes.get('p1:me')).toMatchObject({ type: 'block', name: 'Sparrow' });
    expect(screen.getByText('Blocked')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^Block/ }));
    expect(votes.size).toBe(0);
    expect(screen.getByText('No positions')).toBeTruthy();
  });

  it('does not accept positions on a closed proposal', () => {
    const sync = createTestSync();
    sync.doc.getMap('proposals').set('p1', { id: 'p1', text: 'Meet on Thursday', timestamp: 1, status: 'closed' });
    renderWithSync(<ConsensusBuilder />, sync);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /^Support/ }).disabled).toBe(true);
  });
});

describe('group check-in', () => {
  it('saves the status with the check-in time and flags the member when the time is past', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { sync } = renderWithSync(<StatusBoard />);
      await user.selectOptions(screen.getByLabelText('I will check in again'), '15');
      const before = Date.now();
      await user.click(screen.getByRole('button', { name: 'In transit' }));

      const me = sync.doc.getMap('users').get('me') as { status: string; checkInBy: number };
      expect(me.status).toBe('transit');
      expect(me.checkInBy - before).toBeGreaterThanOrEqual(15 * 60_000);
      expect(screen.queryByText('Check-in is overdue')).toBeNull();

      act(() => {
        vi.advanceTimersByTime(16 * 60_000);
      });
      expect(screen.getByText('Check-in is overdue')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
