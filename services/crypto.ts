/**
 * Passphrase encryption for exports and shared payloads.
 *
 * Cipher: AES-256-GCM. Key: PBKDF2-SHA-256 from the passphrase.
 *
 * Formats:
 * - Text, version 2: "snj2." + base64(salt[16] | iv[12] | ciphertext). 600,000 iterations.
 * - Text, version 1 (read only): base64(salt[16] | iv[12] | ciphertext). 100,000 iterations.
 * - File, version 2: "SNJ2" | salt[16] | iv[12] | ciphertext. The plaintext is
 *   headerLength[4, big endian] | header JSON {name, type} | file bytes.
 *
 * `docs/security.md` gives the limits of this design.
 */

export const KDF_ITERATIONS = 600_000;
const LEGACY_KDF_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TEXT_PREFIX = 'snj2.';
const FILE_MAGIC = new Uint8Array([0x53, 0x4e, 0x4a, 0x32]); // "SNJ2"

/** The largest file that the browser encrypts in memory. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
/**
 * The largest container that the browser decrypts. A container is larger
 * than its file: it adds the name, the type, the salt, the nonce, and the
 * authentication tag.
 */
export const MAX_CONTAINER_BYTES = MAX_FILE_BYTES + 64 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

/** The passphrase is wrong, or the data is damaged. AES-GCM cannot tell which. */
export class DecryptionError extends Error {
  constructor() {
    super('Decryption failed. The passphrase is wrong or the data is damaged.');
    this.name = 'DecryptionError';
  }
}

export interface PlainFile {
  name: string;
  type: string;
  bytes: Uint8Array;
}

export function bytesToBase64(bytes: Uint8Array): string {
  // A spread of the full array overflows the call stack for large payloads.
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Two devices can encode the same typed passphrase in different ways, and a
 * paste can add a space. Version 2 uses this form for all passphrases.
 */
export function normalizePassphrase(passphrase: string): string {
  return passphrase.normalize('NFKC').trim();
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const material = await subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Returns salt | iv | ciphertext. */
export async function encryptBytes(data: Uint8Array, passphrase: string): Promise<Uint8Array> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(normalizePassphrase(passphrase), salt, KDF_ITERATIONS);
  const ciphertext = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));

  const sealed = new Uint8Array(SALT_BYTES + IV_BYTES + ciphertext.length);
  sealed.set(salt, 0);
  sealed.set(iv, SALT_BYTES);
  sealed.set(ciphertext, SALT_BYTES + IV_BYTES);
  return sealed;
}

export function decryptBytes(sealed: Uint8Array, passphrase: string): Promise<Uint8Array> {
  return open(sealed, normalizePassphrase(passphrase), KDF_ITERATIONS);
}

async function open(sealed: Uint8Array, passphrase: string, iterations: number): Promise<Uint8Array> {
  // 16 bytes is the size of the GCM authentication tag.
  if (sealed.length < SALT_BYTES + IV_BYTES + 16) {
    throw new DecryptionError();
  }
  const salt = sealed.slice(0, SALT_BYTES);
  const iv = sealed.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = sealed.slice(SALT_BYTES + IV_BYTES);
  const key = await deriveKey(passphrase, salt, iterations);
  try {
    return new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext));
  } catch {
    throw new DecryptionError();
  }
}

export async function encryptText(text: string, passphrase: string): Promise<string> {
  return TEXT_PREFIX + bytesToBase64(await encryptBytes(encoder.encode(text), passphrase));
}

export async function decryptText(payload: string, passphrase: string): Promise<string> {
  const compact = payload.replace(/\s+/g, '');
  const isCurrent = compact.startsWith(TEXT_PREFIX);
  let sealed: Uint8Array;
  try {
    sealed = base64ToBytes(isCurrent ? compact.slice(TEXT_PREFIX.length) : compact);
  } catch {
    throw new DecryptionError();
  }
  // Version 1 used the passphrase as typed.
  const plain = isCurrent ? await decryptBytes(sealed, passphrase) : await open(sealed, passphrase, LEGACY_KDF_ITERATIONS);
  try {
    return decoder.decode(plain);
  } catch {
    throw new DecryptionError();
  }
}

/** A decrypted file name comes from the sender. It must not contain a path or hidden characters. */
function safeFileName(name: unknown): string {
  const base = String(name ?? '').split(/[\\/]/).pop() ?? '';
  // Control and format characters include the marks that reverse text direction.
  const clean = base.replace(/[\p{Cc}\p{Cf}]/gu, '').trim();
  return clean === '' || clean === '.' || clean === '..' ? 'decrypted-file' : clean;
}

export async function encryptFile(file: PlainFile, passphrase: string): Promise<Uint8Array> {
  if (file.bytes.length > MAX_FILE_BYTES) {
    throw new RangeError('The file is too large to encrypt in the browser.');
  }
  const header = encoder.encode(JSON.stringify({ name: file.name, type: file.type }));
  const plain = new Uint8Array(4 + header.length + file.bytes.length);
  new DataView(plain.buffer).setUint32(0, header.length);
  plain.set(header, 4);
  plain.set(file.bytes, 4 + header.length);

  const sealed = await encryptBytes(plain, passphrase);
  const out = new Uint8Array(FILE_MAGIC.length + sealed.length);
  out.set(FILE_MAGIC, 0);
  out.set(sealed, FILE_MAGIC.length);
  return out;
}

export async function decryptFile(container: Uint8Array, passphrase: string): Promise<PlainFile> {
  const hasMagic = FILE_MAGIC.every((byte, i) => container[i] === byte);
  if (!hasMagic) {
    throw new DecryptionError();
  }
  const plain = await decryptBytes(container.subarray(FILE_MAGIC.length), passphrase);
  try {
    const headerLength = new DataView(plain.buffer, plain.byteOffset, plain.byteLength).getUint32(0);
    const header: unknown = JSON.parse(decoder.decode(plain.subarray(4, 4 + headerLength)));
    const fields = (typeof header === 'object' && header !== null ? header : {}) as Record<string, unknown>;
    return {
      name: safeFileName(fields.name),
      type: typeof fields.type === 'string' ? fields.type : 'application/octet-stream',
      bytes: plain.slice(4 + headerLength),
    };
  } catch {
    throw new DecryptionError();
  }
}
