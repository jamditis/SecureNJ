// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { isProposal } from './schema';
import { SyncProvider, useRecords, useSharedSetting, useSync } from './sync';

afterEach(cleanup);

function Probe() {
  const { space, memberId } = useSync();
  const { records, map } = useRecords('proposals', isProposal);
  const [hours, setHours] = useSharedSetting('alertRetentionHours', 4);
  return (
    <div>
      <p>mode: {space ? 'space' : 'local'}</p>
      <p>member: {memberId}</p>
      <p>records: {records.map((record) => record.text).join(', ')}</p>
      <p>hours: {hours}</p>
      <button onClick={() => map.set('p1', { id: 'p1', text: 'Saved proposal', timestamp: 1, status: 'active' })}>add</button>
      <button onClick={() => setHours(12)}>set hours</button>
    </div>
  );
}

describe('SyncProvider with no space', () => {
  it('opens the local document, saves records, and loads them again after a restart', async () => {
    const user = userEvent.setup();
    const first = render(
      <SyncProvider>
        <Probe />
      </SyncProvider>,
    );
    expect(screen.getByText('Loading your data…')).toBeTruthy();
    await screen.findByText('mode: local');
    const member = screen.getByText(/^member: /).textContent;

    await user.click(screen.getByRole('button', { name: 'add' }));
    await user.click(screen.getByRole('button', { name: 'set hours' }));
    expect(screen.getByText('records: Saved proposal')).toBeTruthy();
    expect(screen.getByText('hours: 12')).toBeTruthy();

    // The browser database writes after the update. Give it time, then "restart".
    await new Promise((resolve) => setTimeout(resolve, 100));
    first.unmount();

    render(
      <SyncProvider>
        <Probe />
      </SyncProvider>,
    );
    await screen.findByText('records: Saved proposal');
    expect(screen.getByText('hours: 12')).toBeTruthy();
    expect(screen.getByText(/^member: /).textContent).toBe(member);
  });
});
