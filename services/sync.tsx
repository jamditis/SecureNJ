/**
 * The data layer.
 *
 * Each shared tool has its own Yjs document:
 * - In a room: the document of that tool syncs to peers over WebRTC. The room
 *   ID and the room password come from the group name, the passphrase, and
 *   the tool (see `space.ts`). The passphrase is used one time to derive the
 *   keys. It is never stored and is not kept in memory.
 * - With no room: the tool uses the local document. No network.
 *
 * Safety alerts are never written to this device, with or without a room.
 * A private document holds data that must not leave the device (the phone
 * tree). It never syncs.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { forgetMember, getMemberId, loadMemberName, saveMemberName } from './identity';
import { passphraseProblem } from './passphrase';
import { isDeleted, purgeExpired } from './retention';
import { MEMORY_ONLY_TOOLS, deriveRoomKeys, type RoomRequest, type SpaceKeys } from './space';
import { eraseDevice, forgetDatabase, rememberDatabase, removeOldData } from './wipe';

export { MEMORY_ONLY_TOOLS };

const LOCAL_DB = 'snj-local';
const PRIVATE_DB = 'snj-private';
const SWEEP_INTERVAL_MS = 30_000;
const DATABASE_TIMEOUT_MS = 10_000;
const DELETE_TIMEOUT_MS = 3_000;

/** Tabs of one browser use this channel to leave a room or to erase the device together. */
const TAB_CHANNEL = 'snj-tabs';
type TabMessage = { type: 'leave'; roomId: string } | { type: 'erase' };

/**
 * An erase can come while a room is still opening (key derivation takes
 * time). The number goes up at each erase, and an open that started before
 * the erase stops when it sees a new number.
 */
let eraseCount = 0;
/** The tools that have a room that is opening now. One open for each tool at a time. */
const opening = new Set<string>();

function tellOtherTabs(message: TabMessage): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(TAB_CHANNEL);
  channel.postMessage(message);
  channel.close();
}

/** `none`: no server is set. `connecting`: no server answers. */
export type SignalingState = 'none' | 'connecting' | 'connected';

/** What one tool gets: its own document and the state of its room. */
export interface SyncValue {
  /** The data of the room of this tool, or the local data if the tool has no room. */
  doc: Y.Doc;
  /** Data that never leaves this device. */
  privateDoc: Y.Doc;
  awareness: Awareness;
  /** The ID of this device in this room. A different room gives a different ID. */
  memberId: string;
  memberName: string;
  setMemberName: (name: string) => void;
  /** The room of this tool, or null when the tool works on this device only. */
  space: { name: string; signaling: string[] } | null;
  /** Connected peers, which includes other tabs of this browser. */
  peers: number;
  signaling: SignalingState;
}

export const SyncContext = createContext<SyncValue | null>(null);

export function useSync(): SyncValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside ToolScope');
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

/**
 * Deletes expired records, and keeps the browser database free of deleted
 * text. The database is a log of changes: without the rewrite, the text of
 * a deleted record stays in the log. A document with no database only gets
 * the delete of expired records.
 */
function startHousekeeping(doc: Y.Doc, persistence: IndexeddbPersistence | null, purge: boolean) {
  let dirty = false;
  const markDirty = () => {
    dirty = true;
  };
  doc.on('update', markDirty);
  const compact = async () => {
    dirty = false;
    if (persistence) await storeState(persistence, true);
  };
  const sweep = () => {
    if (purge) purgeExpired(doc, Date.now());
    // A closed database rejects. The next session compacts at its start.
    if (dirty) compact().catch(() => {});
  };
  const timer = setInterval(sweep, SWEEP_INTERVAL_MS);
  if (persistence) void persistence.whenSynced.then(sweep);
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
  /** Null for a document with no room. */
  keys: SpaceKeys | null;
  signaling: string[];
  memberId: string;
  /** False for data that must never be written to this device. */
  persist: boolean;
  /** The database name of a document with no room. */
  localName?: string;
  /** False for the private document, which has no shared records to expire. */
  purge?: boolean;
  onPeers?: (count: number) => void;
  onSignaling?: (state: SignalingState) => void;
}

export interface Session {
  doc: Y.Doc;
  awareness: Awareness;
  memberId: string;
  /** The name of the browser database, or null when the document is in memory only. */
  dbName: string | null;
  /** The public ID of the room, or null for a document with no room. */
  roomId: string | null;
  /** Resolves when the saved data is loaded from the browser database. */
  ready: Promise<unknown>;
  /** Rewrites the browser database so that it holds the current data only. */
  compact: () => Promise<void>;
  close: () => void;
}

export function openSession(options: SessionOptions): Session {
  const { keys, signaling, memberId, persist, localName = LOCAL_DB, purge = true, onPeers = () => {}, onSignaling = () => {} } = options;
  const dbName = persist ? (keys ? keys.roomId : localName) : null;
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  awareness.setLocalStateField('member', memberId);
  const persistence = dbName ? new IndexeddbPersistence(dbName, doc) : null;
  const housekeeping = startHousekeeping(doc, persistence, purge);

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
    void persistence?.destroy();
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

  return {
    doc,
    awareness,
    memberId,
    dbName,
    roomId: keys ? keys.roomId : null,
    ready: persistence ? persistence.whenSynced : Promise.resolve(),
    compact: housekeeping.compact,
    close,
  };
}

/** An open room of one tool. */
export interface OpenRoom {
  session: Session;
  name: string;
  signaling: string[];
  peers: number;
  signalingState: SignalingState;
}

/** The documents that are always open. */
interface BaseSessions {
  local: Session;
  /** Local data of the tools in `MEMORY_ONLY_TOOLS`. It is gone after a reload. */
  localMemory: Session;
  private: Session;
}

export interface RoomsValue {
  /** The open rooms, by tool. */
  rooms: Readonly<Record<string, OpenRoom>>;
  /** The tools that the member uses on this device only, in this tab. */
  localTools: ReadonlySet<string>;
  /**
   * The group name and the servers of the last room or of an invite. They
   * fill the form of the next room. They are in memory only.
   */
  lastRoom: { name: string; signaling: string[] } | null;
  setLastRoom: (room: { name: string; signaling: string[] } | null) => void;
  /** Rejects if the room cannot open. The passphrase is not kept after this call. */
  openRoom: (tool: string, request: RoomRequest) => Promise<void>;
  /** Resolves to false if the delete of the local copy is not complete yet. */
  closeRoom: (tool: string, deleteLocalCopy: boolean) => Promise<boolean>;
  setLocalOnly: (tool: string, localOnly: boolean) => void;
  /** Deletes all data of the app from this browser, in all tabs. */
  erase: () => Promise<void>;
}

const RoomsContext = createContext<(RoomsValue & { base: BaseSessions; memberName: string; setMemberName: (name: string) => void }) | null>(null);

export function useRooms(): RoomsValue {
  const value = useContext(RoomsContext);
  if (!value) throw new Error('useRooms must be used inside SyncProvider');
  return value;
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [base, setBase] = useState<BaseSessions | null>(null);
  const [rooms, setRooms] = useState<Record<string, OpenRoom>>({});
  const [localTools, setLocalTools] = useState<ReadonlySet<string>>(new Set());
  const [lastRoom, setLastRoom] = useState<{ name: string; signaling: string[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [memberName, setMemberNameState] = useState(() => loadMemberName(localStorage));
  /** Set when this browser was erased. `complete` is false while a delete waits for a different tab. */
  const [erased, setErased] = useState<{ complete: boolean; here: boolean } | null>(null);
  // The cleanup at unmount needs the rooms that are open at that time.
  const roomsRef = useRef(rooms);
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    const memberId = getMemberId(localStorage, LOCAL_DB);
    const sessions: BaseSessions = {
      local: openSession({ keys: null, signaling: [], memberId, persist: true }),
      localMemory: openSession({ keys: null, signaling: [], memberId, persist: false }),
      private: openSession({ keys: null, signaling: [], memberId, persist: true, localName: PRIVATE_DB, purge: false }),
    };
    let closed = false;
    const close = () => {
      closed = true;
      Object.values(sessions).forEach((session) => session.close());
      Object.values(roomsRef.current).forEach((room) => room.session.close());
    };
    // An earlier version stored a passphrase and saved safety alerts. Remove both.
    void removeOldData().catch(() => {});
    void sessions.local.ready.then(() => {
      if (closed) return;
      for (const name of ['sightings', 'confirmations']) {
        const map = sessions.local.doc.getMap(name);
        if (map.size > 0) map.clear();
      }
    });
    // The database never reports that it is not available, so use a time limit.
    withTimeout(Promise.all([sessions.local.ready, sessions.private.ready]), DATABASE_TIMEOUT_MS).then(
      () => !closed && setBase(sessions),
      () => !closed && setFailed(true),
    );
    return close;
  }, []);

  const removeRoom = useCallback((tool: string) => {
    setRooms((current) => {
      const { [tool]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const openRoomNow = useCallback(
    async (tool: string, request: RoomRequest, startedAt: number) => {
      // Key derivation is slow by design. It runs before any network use.
      const keys = await deriveRoomKeys(tool, request.name, request.passphrase);
      if (eraseCount !== startedAt) throw new Error('the device was erased');
      const persist = !MEMORY_ONLY_TOOLS.has(tool);
      // A room that is not saved leaves no trace on the device, so its member ID is not saved.
      const memberId = persist ? getMemberId(localStorage, keys.roomId) : crypto.randomUUID();
      if (persist) rememberDatabase(localStorage, keys.roomId);

      const live = { peers: 0, signalingState: 'none' as SignalingState };
      const update = (patch: Partial<typeof live>) => {
        Object.assign(live, patch);
        setRooms((current) => (current[tool]?.session === session ? { ...current, [tool]: { ...current[tool], ...patch } } : current));
      };
      const session: Session = openSession({
        keys,
        signaling: request.signaling,
        memberId,
        persist,
        onPeers: (peers) => update({ peers }),
        onSignaling: (signalingState) => update({ signalingState }),
      });
      try {
        await withTimeout(session.ready, DATABASE_TIMEOUT_MS);
        if (eraseCount !== startedAt) throw new Error('the device was erased');
      } catch (error) {
        session.close();
        if (eraseCount !== startedAt && session.dbName) {
          // The erase ran before this room got its database. Remove what this open made.
          forgetMember(localStorage, session.dbName);
          forgetDatabase(localStorage, session.dbName);
          void deleteDatabase(session.dbName).catch(() => {});
        }
        throw error;
      }
      setRooms((current) => {
        // A second open for the same tool replaces the first room.
        if (current[tool]?.session !== session) current[tool]?.session.close();
        return { ...current, [tool]: { session, name: request.name.trim(), signaling: request.signaling, ...live } };
      });
      setLocalTools((current) => new Set([...current].filter((id) => id !== tool)));
      setLastRoom({ name: request.name.trim(), signaling: request.signaling });
    },
    [],
  );

  const openRoom = useCallback(
    async (tool: string, request: RoomRequest) => {
      if (passphraseProblem(request.passphrase)) throw new Error('weak passphrase');
      if (opening.has(tool)) throw new Error('this room is opening');
      const startedAt = eraseCount;
      opening.add(tool);
      try {
        await openRoomNow(tool, request, startedAt);
      } finally {
        opening.delete(tool);
      }
    },
    [openRoomNow],
  );

  const closeRoom = useCallback(
    async (tool: string, deleteLocalCopy: boolean) => {
      const room = rooms[tool];
      if (!room) return true;
      const { dbName, roomId } = room.session;
      if (roomId) tellOtherTabs({ type: 'leave', roomId });
      room.session.close();
      removeRoom(tool);
      if (!deleteLocalCopy || !dbName) return true;
      forgetMember(localStorage, dbName);
      // The browser waits until all tabs close the database. Do not wait
      // without limit: the delete completes later if a tab is slow.
      return withTimeout(deleteDatabase(dbName), DELETE_TIMEOUT_MS).then(
        () => {
          // Keep the name in the list until the delete is done, so that an erase can still find it.
          forgetDatabase(localStorage, dbName);
          return true;
        },
        () => false,
      );
    },
    [rooms, removeRoom],
  );

  const closeAll = useCallback(() => {
    Object.values(rooms).forEach((room) => room.session.close());
    setRooms({});
    if (base) Object.values(base).forEach((session) => session.close());
    setBase(null);
  }, [rooms, base]);

  // When one tab leaves a room or erases the device, the other tabs of this
  // browser do the same. An open tab would keep the connection and would
  // block the delete of the database. The channel opens one time: a channel
  // that opens again at each change can lose a message.
  const baseRef = useRef(base);
  useEffect(() => {
    baseRef.current = base;
  }, [base]);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(TAB_CHANNEL);
    channel.onmessage = (event: MessageEvent<TabMessage>) => {
      const message = event.data;
      if (message.type === 'leave') {
        for (const [tool, room] of Object.entries(roomsRef.current)) {
          if (room.session.roomId === message.roomId) {
            room.session.close();
            removeRoom(tool);
          }
        }
      }
      if (message.type === 'erase') {
        eraseCount += 1;
        Object.values(roomsRef.current).forEach((room) => room.session.close());
        setRooms({});
        if (baseRef.current) Object.values(baseRef.current).forEach((session) => session.close());
        setBase(null);
        setErased({ complete: true, here: false });
      }
    };
    return () => channel.close();
  }, [removeRoom]);

  const erase = useCallback(async () => {
    eraseCount += 1;
    tellOtherTabs({ type: 'erase' });
    // An open database blocks its delete, so close all documents first.
    closeAll();
    const result = await eraseDevice();
    setErased({ complete: result.complete, here: true });
  }, [closeAll]);

  const setLocalOnly = useCallback((tool: string, localOnly: boolean) => {
    setLocalTools((current) => {
      const next = new Set(current);
      if (localOnly) next.add(tool);
      else next.delete(tool);
      return next;
    });
  }, []);

  const setMemberName = useCallback((name: string) => {
    saveMemberName(localStorage, name);
    setMemberNameState(name.trim());
  }, []);

  const value = useMemo(
    () => (base ? { base, rooms, localTools, lastRoom, setLastRoom, openRoom, closeRoom, setLocalOnly, erase, memberName, setMemberName } : null),
    [base, rooms, localTools, lastRoom, openRoom, closeRoom, setLocalOnly, erase, memberName, setMemberName],
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
  return <RoomsContext.Provider value={value}>{children}</RoomsContext.Provider>;
}

/**
 * Gives a tool its data: the room of the tool if one is open, else the
 * local document. The tools inside use `useSync` and `useRecords`.
 */
export function ToolScope({ tool, children }: { tool: string; children: ReactNode }) {
  const context = useContext(RoomsContext);
  if (!context) throw new Error('ToolScope must be used inside SyncProvider');
  const { base, rooms, memberName, setMemberName } = context;
  const room = rooms[tool];
  const session = room?.session ?? (MEMORY_ONLY_TOOLS.has(tool) ? base.localMemory : base.local);
  const value = useMemo<SyncValue>(
    () => ({
      doc: session.doc,
      privateDoc: base.private.doc,
      awareness: session.awareness,
      memberId: session.memberId,
      memberName,
      setMemberName,
      space: room ? { name: room.name, signaling: room.signaling } : null,
      peers: room?.peers ?? 0,
      signaling: room?.signalingState ?? 'none',
    }),
    [session, base, memberName, setMemberName, room],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

function createRecordStore<T>(map: Y.Map<T>, name: string, isValid: (value: unknown) => value is T, keyOf: (record: T) => string) {
  let last: T[] = [];
  const doc = map.doc;
  const markers = doc?.getMap('deleted');
  return {
    subscribe: (onChange: () => void) => {
      map.observe(onChange);
      markers?.observe(onChange);
      return () => {
        map.unobserve(onChange);
        markers?.unobserve(onChange);
      };
    },
    // Yjs returns the same object for a record that did not change, so a
    // shallow comparison is sufficient to keep the snapshot stable.
    getSnapshot: () => {
      const next: T[] = [];
      map.forEach((value: unknown, key) => {
        // A record with a delete marker came back through a merge. It stays hidden.
        if (isValid(value) && keyOf(value) === key && !(doc && isDeleted(doc, name, key))) next.push(value);
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
  const store = useMemo(() => createRecordStore(map, name, isValid, keyOf), [map, name, isValid, keyOf]);
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
