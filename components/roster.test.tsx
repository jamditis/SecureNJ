// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Shift } from '../services/shifts';
import ShiftRoster from './ShiftRoster';
import SupplyInventory from './SupplyInventory';
import { createTestSync, renderWithSync } from './test-utils';

afterEach(cleanup);

const HOUR = 60 * 60 * 1000;
const shift = (patch: Partial<Shift> = {}): Shift => ({
  id: 's1',
  title: 'Hotline',
  location: 'Office',
  start: Date.now() + HOUR,
  end: Date.now() + 3 * HOUR,
  needed: 2,
  notes: '',
  ...patch,
});

describe('shift roster', () => {
  it('saves a new shift from the form', async () => {
    const user = userEvent.setup();
    const { sync } = renderWithSync(<ShiftRoster />);
    await user.click(screen.getByRole('button', { name: 'New shift' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Task or role'), 'Food pickup');
    await user.type(within(dialog).getByLabelText('Date'), '2030-05-01');
    await user.type(within(dialog).getByLabelText('Start'), '09:00');
    await user.type(within(dialog).getByLabelText('End'), '11:00');
    await user.clear(within(dialog).getByLabelText('People needed'));
    await user.type(within(dialog).getByLabelText('People needed'), '3');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    const saved = Array.from(sync.doc.getMap<Shift>('shifts').values());
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ title: 'Food pickup', needed: 3 });
    expect(saved[0].end - saved[0].start).toBe(2 * HOUR);
    expect(screen.getByText('Needs 3 more (0 of 3)')).toBeTruthy();
  });

  it('lets a member sign up and take the name off again, with one record for each member', async () => {
    const user = userEvent.setup();
    const sync = createTestSync();
    sync.doc.getMap('shifts').set('s1', shift());
    sync.doc.getMap('shiftSignups').set('s1:other', { shiftId: 's1', memberId: 'other', name: 'Wren' });
    renderWithSync(<ShiftRoster />, sync);
    expect(screen.getByText('Needs 1 more (1 of 2)')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(screen.getByText('Full (2 of 2)')).toBeTruthy();
    expect(sync.doc.getMap('shiftSignups').get('s1:me')).toEqual({ shiftId: 's1', memberId: 'me', name: 'Sparrow' });

    await user.click(screen.getByRole('button', { name: 'Take my name off' }));
    expect(Array.from(sync.doc.getMap('shiftSignups').keys())).toEqual(['s1:other']);
  });

  it('hides a past shift until the member asks for it', async () => {
    const user = userEvent.setup();
    const sync = createTestSync();
    sync.doc.getMap('shifts').set('s1', shift({ start: Date.now() - 3 * HOUR, end: Date.now() - HOUR }));
    renderWithSync(<ShiftRoster />, sync);
    expect(screen.queryByText('Hotline')).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Show past shifts' }));
    expect(screen.getByText('Hotline')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign up' })).toBeNull();
  });

  it('deletes the sign-ups with the shift, also when a peer sent a bad sign-up', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const sync = createTestSync();
    sync.doc.getMap('shifts').set('s1', shift());
    sync.doc.getMap<unknown>('shiftSignups').set('bad', null);
    sync.doc.getMap('shiftSignups').set('s1:a', { shiftId: 's1', memberId: 'a', name: '' });
    renderWithSync(<ShiftRoster />, sync);
    await user.click(screen.getByRole('button', { name: 'Delete the shift' }));
    expect(sync.doc.getMap('shifts').size).toBe(0);
    expect(Array.from(sync.doc.getMap('shiftSignups').keys())).toEqual(['bad']);
  });
});

describe('supply inventory', () => {
  const addItem = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'New item' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Item'), 'Water');
    await user.clear(within(dialog).getByLabelText('Quantity now'));
    await user.type(within(dialog).getByLabelText('Quantity now'), '10');
    await user.type(within(dialog).getByLabelText('Unit'), 'cases');
    await user.clear(within(dialog).getByLabelText('Low at or below'));
    await user.type(within(dialog).getByLabelText('Low at or below'), '4');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
  };

  it('saves an item, changes its stock, and flags it when it is low', async () => {
    const user = userEvent.setup();
    const { sync } = renderWithSync(<SupplyInventory />);
    await addItem(user);
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.queryByText('Low: at or below 4')).toBeNull();

    const amount = screen.getByLabelText('Amount to take or add for Water');
    await user.clear(amount);
    await user.type(amount, '6');
    await user.click(screen.getByRole('button', { name: 'Take from Water' }));
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('Low: at or below 4')).toBeTruthy();
    // The stock is a list of changes, so that changes from two members both count.
    expect(sync.doc.getMap('supplyAdjustments').size).toBe(2);
  });

  it('does not take more stock than is left', async () => {
    const user = userEvent.setup();
    renderWithSync(<SupplyInventory />);
    await addItem(user);
    const amount = screen.getByLabelText('Amount to take or add for Water');
    await user.clear(amount);
    await user.type(amount, '25');
    await user.click(screen.getByRole('button', { name: 'Take from Water' }));
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Take from Water' }).disabled).toBe(true);
  });

  it('deletes the stock record with the item', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { sync } = renderWithSync(<SupplyInventory />);
    await addItem(user);
    await user.click(screen.getByRole('button', { name: 'Delete Water' }));
    expect(sync.doc.getMap('supplies').size).toBe(0);
    expect(sync.doc.getMap('supplyAdjustments').size).toBe(0);
  });
});
