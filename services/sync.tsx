/**
 * The data layer. One Yjs document holds the data of the active space.
 *
 * - No space: the document is saved in this browser only. No network.
 * - In a space: the document also syncs to peers over WebRTC. The room ID
 *   and the room password come from the passphrase (see `space.ts`).
 *
 * A second, private document holds data that must not leave the device
 * (the phone tree). It never syncs.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence, storeState } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';
import { Awareness } from 'y-protocols/awareness';
import { ICE_SERVER_URLS } from './config';
import { useT } from './i18n';
import { eraseDevice, forgetDatabase, rememberDatabase } from './wipe';
import { forgetMember, getMemberId, loadMemberName, saveMemberName } from './identity';
import { purgeExpired } from './retention';
import {
  clearSavedSpace,
  deriveSpaceKeys,
  loadSavedSpace,
  saveSpace,
  type SpaceConfig,
  type SpaceKeys,
} from './space';

const LOCAL_DB = 'snj-local';
const PRIVATE_DB = 'snj-private';
const SWEEP_INTERVAL_MS = 30_000;
const DATABASE_TIMEOUT_MS = 10_000;
const DELETE_TIMEOUT_MS = 3_000;
/** Tabs of one browser use this channel to leave a space or to erase the device together. */
const TAB_CHANNEL = 'snj-tabs';
type TabMessage = { type: 'leave'; dbName: string } | { type: 'erase' };

function tellOtherTabs(message: TabMessage): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(TAB_CHANNEL);
  channel.postMessage(message);
  channel.close();
}

/** `none`: no server is set. `connecting`: no server answers. */
export type SignalingState = 'none' | 'connecting' | 'connected';

export interface SyncValue {
  /** The data of the active space, or the local data if there is no space. */
  doc: Y.Doc;
  /** Data that never leaves this device. */
  privateDoc: Y.Doc;
  awareness: Awareness;
  /** The ID of this device in the active space. A different space gives a different ID. */
  memberId: string;
  memberName: string;
  setMemberName: (name: string) => void;
  space: { name: string; signaling: string[] } | null;
  /** Connected peers, which includes other tabs of this browser. */
  peers: number;
  signaling: SignalingState;
  /** True after a space did not open. The app is then in local mode. */
  spaceFailed: boolean;
  join: (config: SpaceConfig, remember: boolean) => void;
  /** Resolves to false if the delete of the local copy is not complete yet. */
  leave: (deleteLocalCopy: boolean) => Promise<boolean>;
  /** Deletes all data of the app from this browser, in all tabs. */
  erase: () => Promise<void>;
}

export const SyncContext = createContext<SyncValue | null>(null);

export function useSync(): SyncValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside SyncProvider');
  return value;
}

export const databaseName = (keys: SpaceKeys | null) => (keys ? keys.roomId : LOCAL_DB);

interface SignalingConnection {
  connected: boolean;
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
}

function watchSignaling(network: WebrtcProvider, onChange: (state: SignalingState) => void): () => void {
  const connections = network.signalingConns as SignalingConnection[];
  if (connections.length === 0) {
    onChange('none');
    return () => {};
  }
  const report = () => onChange(connections.some((c) => c.connected) ? 'connected' : 'connecting');
  connections.forEach((c) => {
    c.on('connect', report);
    c.on('disconnect', report);
  });
  report();
  return () =>
    connections.forEach((c) => {
      c.off('connect', report);
      c.off('disconnect', report);
    });
}

/**
 * Keeps the browser database small and free of deleted text. The database
 * is a log of changes: without this, the text of a deleted record stays in
 * the log. `purge` also deletes expired records of the space.
 */
function startHousekeeping(doc: Y.Doc, persistence: IndexeddbPersistence, purge: boolean) {
  let dirty = false;
  const markDirty = () => {
    dirty = true;
  };
  doc.on('update', markDirty);
  const compact = async () => {
    dirty = false;
    await storeState(persistence, true);
  };
  const sweep = () => {
    if (purge) purgeExpired(doc, Date.now());
    // A closed database rejects. The next session compacts at its start.
    if (dirty) compact().catch(() => {});
  };
  const timer = setInterval(sweep, SWEEP_INTERVAL_MS);
  void persistence.whenSynced.then(sweep);
  return {
    compact,
    stop: () => {
      clearInterval(timer);
      doc.off('update', markDirty);
    },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

interface SessionOptions {
  keys: SpaceKeys | null;
  signaling: string[];
  memberId: string;
  onPeers: (count: number) => void;
  onSignaling: (state: SignalingState) => void;
}

export interface Session {
  doc: Y.Doc;
  awareness: Awareness;
  memberId: string;
  dbName: string;
  /** Resolves when the saved data is loaded from the browser database. */
  ready: Promise<unknown>;
  /** Rewrites the browser database so that it holds the current data only. */
  compact: () => Promise<void>;
  close: () => void;
}

export function openSession({ keys, signaling, memberId, onPeers, onSignaling }: SessionOptions): Session {
  const dbName = databaseName(keys);
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  awareness.setLocalStateField('member', memberId);
  const persistence = new IndexeddbPersistence(dbName, doc);
  const housekeeping = startHousekeeping(doc, persistence, true);

  let network: WebrtcProvider | null = null;
  let stopSignalingWatch = () => {};
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    housekeeping.stop();
    stopSignalingWatch();
    // destroy() alone leaves the connection to the signaling server open.
    network?.disconnect();
    network?.destroy();
    void persistence.destroy();
    awareness.destroy();
    doc.destroy();
  };

  if (keys) {
    try {
      network = new WebrtcProvider(keys.roomId, doc, {
        signaling,
        password: keys.roomPassword,
        awareness,
        peerOpts: { config: { iceServers: ICE_SERVER_URLS.length > 0 ? [{ urls: ICE_SERVER_URLS }] : [] } },
      });
    } catch (error) {
      // For example: the browser refuses the address of a signaling server.
      close();
      throw error;
    }
    network.on('peers', ({ webrtcPeers, bcPeers }) => onPeers(webrtcPeers.length + bcPeers.length));
    stopSignalingWatch = watchSignaling(network, onSignaling);
  }

  return { doc, awareness, memberId, dbName, ready: persistence.whenSynced, compact: housekeeping.compact, close };
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [config, setConfig] = useState<SpaceConfig | null>(() => loadSavedSpace(sessionStorage, localStorage));
  const [session, setSession] = useState<Session | null>(null);
  const [privateSession, setPrivateSession] = useState<{ doc: Y.Doc; close: () => void } | null>(null);
  const [peers, setPeers] = useState(0);
  const [signaling, setSignaling] = useState<SignalingState>('none');
  const [failed, setFailed] = useState(false);
  const [spaceFailed, setSpaceFailed] = useState(false);
  const [memberName, setMemberNameState] = useState(() => loadMemberName(localStorage));
  /** Set when this browser was erased. `complete` is false while a delete waits for a different tab. */
  const [erased, setErased] = useState<{ complete: boolean; here: boolean } | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    const persistence = new IndexeddbPersistence(PRIVATE_DB, doc);
    const housekeeping = startHousekeeping(doc, persistence, false);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      housekeeping.stop();
      void persistence.destroy();
      doc.destroy();
    };
    // The database never reports that it is not available, so use a time limit.
    withTimeout(persistence.whenSynced, DATABASE_TIMEOUT_MS).then(
      () => !closed && setPrivateSession({ doc, close }),
      () => !closed && setFailed(true),
    );
    return close;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let opened: Session | null = null;
    const open = async () => {
      // Key derivation is slow by design. It runs before any network use.
      const keys = config ? await deriveSpaceKeys(config.name, config.passphrase) : null;
      if (cancelled) return;
      if (keys) rememberDatabase(localStorage, keys.roomId);
      opened = openSession({
        keys,
        signaling: config?.signaling ?? [],
        memberId: getMemberId(localStorage, databaseName(keys)),
        onPeers: setPeers,
        onSignaling: setSignaling,
      });
      await withTimeout(opened.ready, DATABASE_TIMEOUT_MS);
      if (!cancelled) setSession(opened);
    };
    open().catch(() => {
      if (cancelled) return;
      if (config) {
        // Do not keep a space that cannot open: the app would fail at each start.
        clearSavedSpace(sessionStorage, localStorage);
        setSpaceFailed(true);
        setConfig(null);
      } else {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
      opened?.close();
      setSession(null);
      setPeers(0);
      setSignaling('none');
    };
  }, [config]);

  // When one tab leaves a space or erases the device, the other tabs of this
  // browser do the same. An open tab would keep the connection and would
  // block the delete of the database.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined' || !session || !privateSession) return;
    const channel = new BroadcastChannel(TAB_CHANNEL);
    channel.onmessage = (event: MessageEvent<TabMessage>) => {
      if (event.data.type === 'leave' && event.data.dbName === session.dbName) {
        clearSavedSpace(sessionStorage, localStorage);
        setConfig(null);
      }
      if (event.data.type === 'erase') {
        session.close();
        privateSession.close();
        sessionStorage.clear();
        setErased({ complete: true, here: false });
      }
    };
    return () => channel.close();
  }, [session, privateSession]);

  const join = useCallback((next: SpaceConfig, remember: boolean) => {
    saveSpace(next, remember, sessionStorage, localStorage);
    setSpaceFailed(false);
    setConfig(next);
  }, []);

  const leave = useCallback(
    async (deleteLocalCopy: boolean) => {
      if (!session || !config) return true;
      const { dbName } = session;
      clearSavedSpace(sessionStorage, localStorage);
      tellOtherTabs({ type: 'leave', dbName });
      session.close();
      setConfig(null);
      if (!deleteLocalCopy) return true;
      forgetMember(localStorage, dbName);
      forgetDatabase(localStorage, dbName);
      setMemberNameState('');
      // The browser waits until all tabs close the database. Do not wait
      // without limit: the delete completes later if a tab is slow.
      return withTimeout(deleteDatabase(dbName), DELETE_TIMEOUT_MS).then(
        () => true,
        () => false,
      );
    },
    [session, config],
  );

  const erase = useCallback(async () => {
    tellOtherTabs({ type: 'erase' });
    // An open database blocks its delete, so close both documents first.
    session?.close();
    privateSession?.close();
    setSession(null);
    const result = await eraseDevice();
    setErased({ complete: result.complete, here: true });
  }, [session, privateSession]);

  const setMemberName = useCallback((name: string) => {
    saveMemberName(localStorage, name);
    setMemberNameState(name.trim());
  }, []);

  const value = useMemo<SyncValue | null>(
    () =>
      session && privateSession
        ? {
            doc: session.doc,
            privateDoc: privateSession.doc,
            awareness: session.awareness,
            memberId: session.memberId,
            memberName,
            setMemberName,
            space: config ? { name: config.name, signaling: config.signaling } : null,
            peers,
            signaling,
            spaceFailed,
            join,
            leave,
            erase,
          }
        : null,
    [session, privateSession, memberName, setMemberName, config, peers, signaling, spaceFailed, join, leave, erase],
  );

  if (erased) {
    // This screen uses no stored data and no network, so it also shows with no connection.
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto">
        <p className="font-bold text-slate-900">{t('erase.done')}</p>
        {!erased.complete && <p className="text-sm text-amber-700">{t('erase.pending')}</p>}
        {erased.here ? (
          <button type="button" onClick={() => window.location.reload()} className="underline text-sm text-slate-600">
            {t('erase.restart')}
          </button>
        ) : (
          <p className="text-sm text-slate-600">{t('erase.otherTab')}</p>
        )}
      </div>
    );
  }
  if (failed) {
    return <p className="p-8 text-center text-red-700">{t('sync.failed')}</p>;
  }
  if (!value) {
    return <p className="p-8 text-center text-slate-500">{t('sync.loading')}</p>;
  }
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

function createRecordStore<T>(map: Y.Map<T>, isValid: (value: unknown) => value is T, keyOf: (record: T) => string) {
  let last: T[] = [];
  return {
    subscribe: (onChange: () => void) => {
      map.observe(onChange);
      return () => map.unobserve(onChange);
    },
    // Yjs returns the same object for a record that did not change, so a
    // shallow comparison is sufficient to keep the snapshot stable.
    getSnapshot: () => {
      const next: T[] = [];
      map.forEach((value: unknown, key) => {
        if (isValid(value) && keyOf(value) === key) next.push(value);
      });
      if (next.length !== last.length || next.some((record, i) => record !== last[i])) last = next;
      return last;
    },
  };
}

/**
 * The valid records of one map, as React state. A record is ignored if it
 * fails `isValid` or if its map key is not `keyOf(record)`. Both functions
 * must be stable: use the guards and key functions in `schema.ts`.
 */
export function useRecords<T>(
  name: string,
  isValid: (value: unknown) => value is T,
  keyOf: (record: T) => string,
  scope: 'shared' | 'private' = 'shared',
): { records: T[]; map: Y.Map<T> } {
  const sync = useSync();
  const map = (scope === 'private' ? sync.privateDoc : sync.doc).getMap<T>(name);
  const store = useMemo(() => createRecordStore(map, isValid, keyOf), [map, isValid, keyOf]);
  const records = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { records, map };
}

/** A number that the full space shares, for example a retention time. */
export function useSharedSetting({ key, fallback }: { key: string; fallback: number }): [number, (value: number) => void] {
  const { doc } = useSync();
  const map = doc.getMap<number>('settings');
  const subscribe = useCallback(
    (onChange: () => void) => {
      map.observe(onChange);
      return () => map.unobserve(onChange);
    },
    [map],
  );
  const value = useSyncExternalStore(subscribe, () => {
    const stored = map.get(key);
    return typeof stored === 'number' && Number.isFinite(stored) ? stored : fallback;
  });
  const set = useCallback((next: number) => void map.set(key, next), [map, key]);
  return [value, set];
}

function readOnlineMembers(awareness: Awareness): Set<string> {
  const members = new Set<string>();
  awareness.getStates().forEach((state) => {
    if (typeof state.member === 'string') members.add(state.member);
  });
  return members;
}

/** The member IDs of the peers that are connected now. */
export function useOnlineMembers(): Set<string> {
  const { awareness } = useSync();
  const [online, setOnline] = useState(() => readOnlineMembers(awareness));
  useEffect(() => {
    const update = () => setOnline(readOnlineMembers(awareness));
    awareness.on('change', update);
    return () => awareness.off('change', update);
  }, [awareness]);
  return online;
}
