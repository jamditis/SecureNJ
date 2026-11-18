/** Helpers for component tests. The documents are in memory: no database and no network. */
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { SyncContext, type SyncValue } from '../services/sync';

export function createTestSync(overrides: Partial<SyncValue> = {}): SyncValue {
  const doc = new Y.Doc();
  return {
    doc,
    privateDoc: new Y.Doc(),
    awareness: new Awareness(doc),
    memberId: 'me',
    memberName: 'Sparrow',
    setMemberName: () => {},
    space: null,
    peers: 0,
    signaling: 'none',
    ...overrides,
  };
}

export function renderWithSync(ui: ReactElement, sync: SyncValue = createTestSync()) {
  return { sync, ...render(<SyncContext.Provider value={sync}>{ui}</SyncContext.Provider>) };
}
