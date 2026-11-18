// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { SyncProvider } from '../services/sync';
import RoomGate from './RoomGate';

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

const gate = (tool = 'mutual-aid') => (
  <SyncProvider>
    <RoomGate tool={tool} title="Mutual aid board">
      <p>the tool</p>
    </RoomGate>
  </SyncProvider>
);

describe('room form', () => {
  it('shows the form first, not the tool', async () => {
    render(gate());
    await screen.findByRole('heading', { name: 'Mutual aid board' });
    expect(screen.queryByText('the tool')).toBeNull();
  });

  it('does not open a room with a weak passphrase', async () => {
    // The signaling server sees the room ID and can test guesses of the passphrase.
    const user = userEvent.setup();
    render(gate());
    const open = await screen.findByRole<HTMLButtonElement>('button', { name: 'Open room' });
    const passphrase = document.querySelector<HTMLInputElement>('input[type=password]')!;

    await user.type(screen.getByLabelText('Group name'), 'Ironbound');
    await user.type(passphrase, 'short');
    expect(open.disabled).toBe(true);
    expect(screen.getByText('Use a passphrase of at least 12 characters.')).toBeTruthy();

    await user.clear(passphrase);
    await user.type(passphrase, 'password-password');
    expect(open.disabled).toBe(true);

    await user.clear(passphrase);
    await user.type(passphrase, 'river tulip nine window');
    expect(open.disabled).toBe(false);
  });

  it('makes a passphrase of six random words', async () => {
    const user = userEvent.setup();
    render(gate());
    await user.click(await screen.findByRole('button', { name: 'Make a random passphrase' }));
    expect(screen.getByDisplayValue(/^([a-z]+ ){5}[a-z]+$/)).toBeTruthy();
  });

  it('lets a member use the tool on this device only, and go back to the form', async () => {
    const user = userEvent.setup();
    render(gate());
    await user.click(await screen.findByRole('button', { name: 'Use on this device only, with no room' }));
    expect(screen.getByText('the tool')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Open a room' }));
    expect(screen.queryByText('the tool')).toBeNull();
  });

  it('writes nothing about the room to the storage of the browser while the member types', async () => {
    const user = userEvent.setup();
    render(gate());
    await user.type(await screen.findByLabelText('Group name'), 'Ironbound');
    await user.type(document.querySelector<HTMLInputElement>('input[type=password]')!, 'river tulip nine window');
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain('Ironbound');
    expect(stored).not.toContain('river tulip');
  });

  it('tells the member that safety alerts are not saved on the device', async () => {
    render(gate('safety-alerts'));
    expect(await screen.findByText(/This tool saves nothing on this device/)).toBeTruthy();
  });
});
