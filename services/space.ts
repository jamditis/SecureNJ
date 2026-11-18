/**
 * A space is the private area of one group. The group shares a name and a
 * passphrase. All room identifiers come from these two values, so a person
 * who does not have the passphrase cannot find the room or read its messages.
 */
import { KDF_ITERATIONS } from './crypto';

export interface SpaceConfig {
  name: string;
  passphrase: string;
  /** WebSocket addresses of the signaling servers that connect peers. */
  signaling: string[];
}

export interface SpaceKeys {
  /** Public. The signaling server and the browser database see this value. */
  roomId: string;
  /** Secret. Encrypts the messages that go through the signaling server. */
  roomPassword: string;
}

const encoder = new TextEncoder();
const STORAGE_KEY = 'snj.space';

export function normalizeSpaceName(name: string): string {
  return name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function expand(master: CryptoKey, label: string, bytes: number): Promise<Uint8Array> {
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encoder.encode(label) },
    master,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

export async function deriveSpaceKeys(name: string, passphrase: string): Promise<SpaceKeys> {
  const subtle = globalThis.crypto.subtle;
  const material = await subtle.importKey(
    'raw',
    encoder.encode(passphrase.normalize('NFKC').trim()),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const salt = encoder.encode(`securenj/space/v1/${normalizeSpaceName(name)}`);
  const masterBits = await subtle.deriveBits({ name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' }, material, 256);
  const master = await subtle.importKey('raw', masterBits, 'HKDF', false, ['deriveBits']);

  // The two outputs have different labels. The public room ID gives no
  // information about the secret room password.
  const [roomId, roomPassword] = await Promise.all([expand(master, 'room-id', 16), expand(master, 'room-password', 32)]);
  return { roomId: `snj-${toHex(roomId)}`, roomPassword: toHex(roomPassword) };
}

function isWebSocketUrl(text: string): boolean {
  try {
    const { protocol } = new URL(text);
    return protocol === 'wss:' || protocol === 'ws:';
  } catch {
    return false;
  }
}

/** Reads server addresses from text. Separators are spaces, commas, and new lines. */
export function parseSignalingUrls(text: string): { urls: string[]; invalid: string[] } {
  const urls: string[] = [];
  const invalid: string[] = [];
  for (const entry of text.split(/[\s,]+/).filter(Boolean)) {
    if (!isWebSocketUrl(entry)) invalid.push(entry);
    else if (!urls.includes(entry)) urls.push(entry);
  }
  return { urls, invalid };
}

function isSpaceConfig(value: unknown): value is SpaceConfig {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === 'string' &&
    typeof v.passphrase === 'string' &&
    Array.isArray(v.signaling) &&
    v.signaling.every((url) => typeof url === 'string')
  );
}

/**
 * The saved space. Session storage is the default: the passphrase goes away
 * when the browser closes. Local storage is used only if the user asks.
 */
export function loadSavedSpace(session: Storage, local: Storage): SpaceConfig | null {
  for (const storage of [session, local]) {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
      if (isSpaceConfig(parsed)) return parsed;
    } catch {
      // Damaged storage is the same as no saved space.
    }
  }
  return null;
}

export function saveSpace(config: SpaceConfig, remember: boolean, session: Storage, local: Storage): void {
  clearSavedSpace(session, local);
  (remember ? local : session).setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearSavedSpace(session: Storage, local: Storage): void {
  session.removeItem(STORAGE_KEY);
  local.removeItem(STORAGE_KEY);
}
