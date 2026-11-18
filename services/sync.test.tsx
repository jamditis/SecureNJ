// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ALERT_RETENTION } from './retention';
import { isProposal, keyOfId } from './schema';
import { SyncProvider, ToolScope, useRecords, useRooms, useSharedSetting, useSync } from './sync';

afterEach(cleanup);

function Probe() {
  const { space, memberId } = useSync();
  const { records, map } = useRecords('proposals', isProposal, keyOfId);
  const [hours, setHours] = useSharedSetting(ALERT_RETENTION);
  return (
    <div>
      <p>mode: {space ? 'room' : 'local'}</p>
      <p>member: {memberId}</p>
      <p>records: {records.map((record) => record.text).join(', ')}</p>
      <p>hours: {hours}</p>
      <button onClick={() => map.set('p1', { id: 'p1', text: 'Saved proposal', timestamp: 1, status: 'active' })}>add</button>
      <button onClick={() => setHours(12)}>set hours</button>
    </div>
  );
}

const app = (tool: string) => (
  <SyncProvider>
    <ToolScope tool={tool}>
      <Probe />
    </ToolScope>
  </SyncProvider>
);

/** All text that the browser database holds, in all databases. */
async function allStoredText(): Promise<string> {
  let text = '';
  for (const { name } of await indexedDB.databases()) {
    if (!name) continue;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (db.objectStoreNames.contains('updates')) {
      const updates = await new Promise<Uint8Array[]>((resolve, reject) => {
        const request = db.transaction('updates').objectStore('updates').getAll();
        request.onsuccess = () => resolve(request.result as Uint8Array[]);
        request.onerror = () => reject(request.error);
      });
      text += updates.map((update) => new TextDecoder('latin1').decode(update)).join('\n');
    }
    db.close();
  }
  return text;
}

describe('a tool with no room', () => {
  it('saves records on the device and loads them again after a restart', async () => {
    const user = userEvent.setup();
    const first = render(app('consensus'));
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

    render(app('consensus'));
    await screen.findByText('records: Saved proposal');
    expect(screen.getByText('hours: 12')).toBeTruthy();
    expect(screen.getByText(/^member: /).textContent).toBe(member);
  });
});

describe('safety alerts', () => {
  it('never writes its data to the device', async () => {
    const user = userEvent.setup();
    const first = render(app('safety-alerts'));
    await screen.findByText('mode: local');
    await user.click(screen.getByRole('button', { name: 'add' }));
    expect(screen.getByText('records: Saved proposal')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 100));
    // The record of the test before this one is in the database of a different tool.
    const stored = await allStoredText();
    first.unmount();

    render(app('safety-alerts'));
    await screen.findByText('mode: local');
    expect(screen.getByText('records:')).toBeTruthy();
    // One copy is from the consensus test. A second copy would be from this tool.
    expect(stored.split('Saved proposal').length - 1).toBeLessThanOrEqual(1);
  });
});

describe('rooms', () => {
  function Opener() {
    const { openRoom, rooms } = useRooms();
    return (
      <div>
        <p>open rooms: {Object.keys(rooms).length}</p>
        <button
          onClick={() => {
            openRoom('consensus', { name: 'Group', passphrase: 'short', signaling: [] }).catch(() => {
              document.title = 'refused';
            });
          }}
        >
          open weak
        </button>
      </div>
    );
  }

  it('refuses to open a room with a weak passphrase', async () => {
    const user = userEvent.setup();
    render(
      <SyncProvider>
        <Opener />
      </SyncProvider>,
    );
    await screen.findByText('open rooms: 0');
    await user.click(screen.getByRole('button', { name: 'open weak' }));
    await expect.poll(() => document.title).toBe('refused');
    expect(screen.getByText('open rooms: 0')).toBeTruthy();
  });
});
