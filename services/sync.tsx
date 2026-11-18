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
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';
import { Awareness } from 'y-protocols/awareness';
import { ICE_SERVER_URLS } from './config';
import { useT } from './i18n';
import { getMemberId, loadMemberName, saveMemberName } from './identity';
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

/** `none`: no server is set. `connecting`: no server answers. */
export type SignalingState = 'none' | 'connecting' | 'connected';

export interface SyncValue {
  /** The data of the active space, or the local data if there is no space. */
  doc: Y.Doc;
  /** Data that never leaves this device. */
  privateDoc: Y.Doc;
  awareness: Awareness;
  memberId: string;
  memberName: string;
  setMemberName: (name: string) => void;
  space: { name: string; signaling: string[] } | null;
  /** Connected peers, which includes other tabs of this browser. */
  peers: number;
  signaling: SignalingState;
  join: (config: SpaceConfig, remember: boolean) => void;
  leave: (deleteLocalCopy: boolean) => Promise<void>;
}

export const SyncContext = createContext<SyncValue | null>(null);

export function useSync(): SyncValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside SyncProvider');
  return value;
}

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
  /** Resolves when the saved data is loaded from the browser database. */
  ready: Promise<unknown>;
  /** Deletes the browser database of this session. */
  clearData: () => Promise<void>;
  close: () => void;
}

export function openSession({ keys, signaling, memberId, onPeers, onSignaling }: SessionOptions): Session {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  awareness.setLocalStateField('member', memberId);
  const persistence = new IndexeddbPersistence(keys ? keys.roomId : LOCAL_DB, doc);

  let network: WebrtcProvider | null = null;
  let stopSignalingWatch = () => {};
  if (keys) {
    network = new WebrtcProvider(keys.roomId, doc, {
      signaling,
      password: keys.roomPassword,
      awareness,
      peerOpts: { config: { iceServers: ICE_SERVER_URLS.length > 0 ? [{ urls: ICE_SERVER_URLS }] : [] } },
    });
    network.on('peers', ({ webrtcPeers, bcPeers }) => onPeers(webrtcPeers.length + bcPeers.length));
    stopSignalingWatch = watchSignaling(network, onSignaling);
  }

  return {
    doc,
    awareness,
    ready: persistence.whenSynced,
    clearData: () => persistence.clearData(),
    close: () => {
      stopSignalingWatch();
      network?.destroy();
      void persistence.destroy();
      awareness.destroy();
      doc.destroy();
    },
  };
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [config, setConfig] = useState<SpaceConfig | null>(() => loadSavedSpace(sessionStorage, localStorage));
  const [session, setSession] = useState<Session | null>(null);
  const [privateDoc, setPrivateDoc] = useState<Y.Doc | null>(null);
  const [peers, setPeers] = useState(0);
  const [signaling, setSignaling] = useState<SignalingState>('none');
  const [failed, setFailed] = useState(false);
  const [memberId] = useState(() => getMemberId(localStorage));
  const [memberName, setMemberNameState] = useState(() => loadMemberName(localStorage));

  useEffect(() => {
    const doc = new Y.Doc();
    const persistence = new IndexeddbPersistence(PRIVATE_DB, doc);
    let cancelled = false;
    persistence.whenSynced.then(
      () => !cancelled && setPrivateDoc(doc),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
      void persistence.destroy();
      doc.destroy();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let opened: Session | null = null;
    const open = async () => {
      // Key derivation is slow by design. It runs before any network use.
      const keys = config ? await deriveSpaceKeys(config.name, config.passphrase) : null;
      if (cancelled) return;
      opened = openSession({
        keys,
        signaling: config?.signaling ?? [],
        memberId,
        onPeers: setPeers,
        onSignaling: setSignaling,
      });
      await opened.ready;
      if (!cancelled) setSession(opened);
    };
    open().catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      opened?.close();
      setSession(null);
      setPeers(0);
      setSignaling('none');
    };
  }, [config, memberId]);

  const join = useCallback((next: SpaceConfig, remember: boolean) => {
    saveSpace(next, remember, sessionStorage, localStorage);
    setConfig(next);
  }, []);

  const leave = useCallback(
    async (deleteLocalCopy: boolean) => {
      if (deleteLocalCopy && session) {
        // A second tab that has the space open blocks the delete. Do not wait
        // for it: the browser completes the delete when that tab closes.
        await Promise.race([session.clearData(), new Promise((resolve) => setTimeout(resolve, 3000))]);
      }
      clearSavedSpace(sessionStorage, localStorage);
      setConfig(null);
    },
    [session],
  );

  const setMemberName = useCallback((name: string) => {
    saveMemberName(localStorage, name);
    setMemberNameState(name.trim());
  }, []);

  const value = useMemo<SyncValue | null>(
    () =>
      session && privateDoc
        ? {
            doc: session.doc,
            privateDoc,
            awareness: session.awareness,
            memberId,
            memberName,
            setMemberName,
            space: config ? { name: config.name, signaling: config.signaling } : null,
            peers,
            signaling,
            join,
            leave,
          }
        : null,
    [session, privateDoc, memberId, memberName, setMemberName, config, peers, signaling, join, leave],
  );

  if (failed) {
    return <p className="p-8 text-center text-red-700">{t('sync.failed')}</p>;
  }
  if (!value) {
    return <p className="p-8 text-center text-slate-500">{t('sync.loading')}</p>;
  }
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

function createRecordStore<T>(map: Y.Map<T>, isValid: (value: unknown) => value is T) {
  let last: T[] = [];
  return {
    subscribe: (onChange: () => void) => {
      map.observe(onChange);
      return () => map.unobserve(onChange);
    },
    // Yjs returns the same object for a record that did not change, so a
    // shallow comparison is sufficient to keep the snapshot stable.
    getSnapshot: () => {
      const next = Array.from(map.values()).filter(isValid);
      if (next.length !== last.length || next.some((record, i) => record !== last[i])) last = next;
      return last;
    },
  };
}

/**
 * The valid records of one map, as React state. A record that fails
 * `isValid` is ignored. `isValid` must be a stable function.
 */
export function useRecords<T>(
  name: string,
  isValid: (value: unknown) => value is T,
  scope: 'shared' | 'private' = 'shared',
): { records: T[]; map: Y.Map<T> } {
  const sync = useSync();
  const map = (scope === 'private' ? sync.privateDoc : sync.doc).getMap<T>(name);
  const store = useMemo(() => createRecordStore(map, isValid), [map, isValid]);
  const records = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { records, map };
}

/** A number that the full space shares, for example a retention time. */
export function useSharedSetting(key: string, fallback: number): [number, (value: number) => void] {
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
