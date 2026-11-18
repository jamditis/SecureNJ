// @vitest-environment jsdom
import { act, cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { deleteRecords } from '../services/retention';
import type { MutualAidPost, Sighting } from '../types';
import ConsensusBuilder from './ConsensusBuilder';
import MutualAid from './MutualAid';
import PhoneTree from './PhoneTree';
import Sightings from './Sightings';
import StatusBoard from './StatusBoard';
import { createTestSync, renderWithSync } from './test-utils';

afterEach(cleanup);

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

  it('deletes a report when a peer sent a bad confirmation', async () => {
    const user = userEvent.setup();
    const sync = createTestSync();
    sync.doc.getMap('sightings').set('s1', sighting());
    sync.doc.getMap<unknown>('confirmations').set('bad', null);
    sync.doc.getMap<unknown>('confirmations').set('worse', 'text');
    sync.doc.getMap('confirmations').set('s1:a', { sightingId: 's1', memberId: 'a' });
    renderWithSync(<Sightings />, sync);
    await user.click(screen.getByRole('button', { name: 'Delete the report' }));
    expect(sync.doc.getMap('sightings').size).toBe(0);
    expect(Array.from(sync.doc.getMap('confirmations').keys())).toEqual(['bad', 'worse']);
  });

  it('hides a report that came back through a merge after a member deleted it', () => {
    const sync = createTestSync();
    deleteRecords(sync.doc, 'sightings', ['s1']);
    // A member who was not connected changed the report. The merge puts the record back.
    sync.doc.getMap('sightings').set('s1', sighting({ clearedAt: 5 }));
    renderWithSync(<Sightings />, sync);
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('ignores a record that is stored under a key that is not its ID', () => {
    // Delete uses the ID as the key. A record under a different key could not be deleted.
    const sync = createTestSync();
    sync.doc.getMap('sightings').set('some-other-key', sighting({ id: 's1' }));
    renderWithSync(<Sightings />, sync);
    expect(screen.queryByRole('article')).toBeNull();
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
  };

  it('keeps both an edit and a claim that two members make at the same time', async () => {
    const user = userEvent.setup();
    // Ana and Ben start from the same board. They are not connected.
    const ana = createTestSync();
    ana.doc.getMap('posts').set('p1', post);
    const ben = new Y.Doc();
    Y.applyUpdate(ben, Y.encodeStateAsUpdate(ana.doc));

    ben.getMap('claims').set('p1', { postId: 'p1', status: 'claimed', claimedBy: 'Wren' });

    renderWithSync(<MutualAid />, ana);
    await user.click(screen.getByRole('button', { name: 'Edit the post' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), ' on Friday');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    // They connect. Each device gets the changes of the other.
    act(() => {
      Y.applyUpdate(ana.doc, Y.encodeStateAsUpdate(ben));
    });
    Y.applyUpdate(ben, Y.encodeStateAsUpdate(ana.doc));

    for (const doc of [ana.doc, ben]) {
      expect(doc.getMap('posts').get('p1')).toMatchObject({ title: 'Ride to the clinic on Friday' });
      expect(doc.getMap('claims').get('p1')).toMatchObject({ status: 'claimed', claimedBy: 'Wren' });
    }
    expect(screen.getByText('Claimed by Wren')).toBeTruthy();
  });

  it('records the name of the member who claims a post, and removes the claim on "open again"', async () => {
    const user = userEvent.setup();
    const sync = createTestSync();
    sync.doc.getMap('posts').set('p1', post);
    renderWithSync(<MutualAid />, sync);
    await user.click(screen.getByRole('button', { name: 'Claim' }));
    expect(screen.getByText('Claimed by Sparrow')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Open again' }));
    expect(sync.doc.getMap('claims').size).toBe(0);
  });

  it('deletes the claim together with the post', async () => {
    const user = userEvent.setup();
    const sync = createTestSync();
    sync.doc.getMap('posts').set('p1', post);
    sync.doc.getMap('claims').set('p1', { postId: 'p1', status: 'done', claimedBy: '' });
    renderWithSync(<MutualAid />, sync);
    await user.click(screen.getByRole('checkbox', { name: 'Show done' }));
    await user.click(screen.getByRole('button', { name: 'Delete the post' }));
    expect(sync.doc.getMap('posts').size).toBe(0);
    expect(sync.doc.getMap('claims').size).toBe(0);
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

  it('changes the shared retention time only on "Save", not while the member types', async () => {
    // Each change of this time deletes posts for the full space.
    const user = userEvent.setup();
    const { sync } = renderWithSync(<MutualAid />);
    const settings = sync.doc.getMap('settings');
    await user.click(screen.getByRole('button', { name: 'Board settings' }));
    const field = screen.getByRole('spinbutton');
    await user.clear(field);
    await user.type(field, '72');
    expect(settings.size).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(settings.get('aidRetentionHours')).toBe(72);
  });

  it('hides a post that is older than the retention time', () => {
    const sync = createTestSync();
    sync.doc.getMap('posts').set('p1', { ...post, timestamp: Date.now() - 49 * 60 * 60 * 1000 });
    renderWithSync(<MutualAid />, sync);
    expect(screen.queryByText('Ride to the clinic')).toBeNull();
  });
});

describe('dialogs', () => {
  it('closes only the top dialog on Escape and gives the focus back to the opener', async () => {
    const user = userEvent.setup();
    const sync = createTestSync();
    sync.doc.getMap('posts').set('p1', {
      id: 'p1',
      type: 'request',
      category: 'food',
      title: 'Groceries',
      description: '',
      contact: '',
      timestamp: Date.now(),
      urgent: false,
    });
    renderWithSync(<MutualAid />, sync);
    const opener = screen.getByRole('button', { name: 'Board settings' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Export the posts' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(2);

    await user.keyboard('{Escape}');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps the Tab key inside the dialog', async () => {
    const user = userEvent.setup();
    renderWithSync(<Sightings />);
    await user.click(screen.getByRole('button', { name: 'Report activity' }));
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 20; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
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

  it('deletes a proposal when a peer sent a bad position', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const sync = createTestSync();
    sync.doc.getMap('proposals').set('p1', { id: 'p1', text: 'Meet on Thursday', timestamp: 1, status: 'active' });
    sync.doc.getMap<unknown>('votes').set('bad', null);
    sync.doc.getMap('votes').set('p1:a', { proposalId: 'p1', memberId: 'a', type: 'support', concern: '', name: '' });
    renderWithSync(<ConsensusBuilder />, sync);
    await user.click(screen.getByRole('button', { name: 'Delete the proposal' }));
    expect(sync.doc.getMap('proposals').size).toBe(0);
    expect(Array.from(sync.doc.getMap('votes').keys())).toEqual(['bad']);
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

      // An edit of the status keeps the check-in time unless the member changes it.
      await user.click(screen.getByRole('button', { name: 'Change my status' }));
      await user.click(screen.getByRole('button', { name: 'Safe' }));
      expect((sync.doc.getMap('users').get('me') as { checkInBy: number }).checkInBy).toBe(me.checkInBy);

      act(() => {
        vi.advanceTimersByTime(16 * 60_000);
      });
      expect(screen.getByText('Check-in is overdue')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
