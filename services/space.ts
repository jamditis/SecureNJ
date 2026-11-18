/**
 * A group shares a name and a passphrase. Each shared tool has its own room,
 * and all room identifiers come from these two values, so a person who does
 * not have the passphrase cannot find a room or read its messages.
 *
 * Nothing in this file stores the name or the passphrase.
 */
import { KDF_ITERATIONS } from './crypto';
import { normalizePassphrase } from './passphrase';

/** What a member types to open a room. None of it is stored. */
export interface RoomRequest {
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
/** The data of these tools is never written to a device: not to a database and not to a backup file. */
export const MEMORY_ONLY_TOOLS: ReadonlySet<string> = new Set(['safety-alerts']);

/** The room form and the invite link use the same limit. */
export const MAX_SPACE_NAME_LENGTH = 100;

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

/**
 * The keys of the room of one tool. The tool is part of the salt, so the
 * same group name and passphrase give a different room for each tool. A
 * member who opens one tool does not open the others.
 */
export async function deriveRoomKeys(tool: string, name: string, passphrase: string): Promise<SpaceKeys> {
  const subtle = globalThis.crypto.subtle;
  const material = await subtle.importKey(
    'raw',
    encoder.encode(normalizePassphrase(passphrase)),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const salt = encoder.encode(`securenj/room/v1/${tool}/${normalizeSpaceName(name)}`);
  const masterBits = await subtle.deriveBits({ name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' }, material, 256);
  const master = await subtle.importKey('raw', masterBits, 'HKDF', false, ['deriveBits']);

  // The two outputs have different labels. The public room ID gives no
  // information about the secret room password.
  const [roomId, roomPassword] = await Promise.all([expand(master, 'room-id', 16), expand(master, 'room-password', 32)]);
  return { roomId: `snj-${toHex(roomId)}`, roomPassword: toHex(roomPassword) };
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

function isUsableUrl(text: string, pageIsSecure: boolean): boolean {
  try {
    const { protocol, hostname } = new URL(text);
    if (protocol === 'wss:') return true;
    // A browser refuses ws:// from an HTTPS page, except to this computer.
    return protocol === 'ws:' && (!pageIsSecure || LOCAL_HOSTS.includes(hostname));
  } catch {
    return false;
  }
}

/**
 * Reads server addresses from text. Separators are spaces, commas, and new
 * lines. `pageIsSecure` is true when the app is served over HTTPS.
 */
export function parseSignalingUrls(text: string, pageIsSecure = false): { urls: string[]; invalid: string[] } {
  const urls: string[] = [];
  const invalid: string[] = [];
  for (const entry of text.split(/[\s,]+/).filter(Boolean)) {
    if (!isUsableUrl(entry, pageIsSecure)) invalid.push(entry);
    else if (!urls.includes(entry)) urls.push(entry);
  }
  return { urls, invalid };
}
