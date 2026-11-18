import { describe, expect, it } from 'vitest';
import {
  DecryptionError,
  WeakPassphraseError,
  MAX_CONTAINER_BYTES,
  MAX_FILE_BYTES,
  base64ToBytes,
  bytesToBase64,
  decryptFile,
  decryptText,
  encryptBytes,
  encryptFile,
  encryptText,
} from './crypto';

const PASSPHRASE = 'correct horse battery staple';

/** Makes a version 1 payload in the same way as the first release of the app. */
async function encryptLegacy(text: string, passphrase: string, iterations = 100_000): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
  const combined = new Uint8Array(28 + ciphertext.length);
  combined.set(salt, 0);
  combined.set(iv, 16);
  combined.set(ciphertext, 28);
  return btoa(String.fromCharCode(...combined));
}

describe('base64', () => {
  it('round-trips all byte values', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('encodes a payload that is larger than the argument limit of the JavaScript engine', () => {
    // The first release used String.fromCharCode(...bytes), which throws a RangeError here.
    const bytes = new Uint8Array(1_000_000).fill(7);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});

describe('text encryption', () => {
  it('round-trips text that is not ASCII', async () => {
    const text = 'Reunión a las 6 — 東京 🛡️';
    const sealed = await encryptText(text, PASSPHRASE);
    expect(sealed.startsWith('snj2.')).toBe(true);
    expect(await decryptText(sealed, PASSPHRASE)).toBe(text);
  });

  it('gives different output for the same input', async () => {
    expect(await encryptText('same', PASSPHRASE)).not.toBe(await encryptText('same', PASSPHRASE));
  });

  it('rejects the wrong passphrase', async () => {
    const sealed = await encryptText('secret', PASSPHRASE);
    await expect(decryptText(sealed, 'wrong')).rejects.toBeInstanceOf(DecryptionError);
  });

  it('rejects changed ciphertext', async () => {
    const sealed = await encryptBytes(new TextEncoder().encode('secret'), PASSPHRASE);
    sealed[sealed.length - 1] ^= 1;
    await expect(decryptText('snj2.' + bytesToBase64(sealed), PASSPHRASE)).rejects.toBeInstanceOf(DecryptionError);
  });

  it('rejects input that is not base64 or is too short', async () => {
    await expect(decryptText('not base64 !!!', PASSPHRASE)).rejects.toBeInstanceOf(DecryptionError);
    await expect(decryptText('snj2.AAAA', PASSPHRASE)).rejects.toBeInstanceOf(DecryptionError);
  });

  it('ignores white space that a chat application adds to a pasted payload', async () => {
    const sealed = await encryptText('secret', PASSPHRASE);
    const wrapped = ` ${sealed.slice(0, 20)}\n${sealed.slice(20)} `;
    expect(await decryptText(wrapped, PASSPHRASE)).toBe('secret');
  });

  it('accepts the same passphrase in a different Unicode form or with a space at the end', async () => {
    // Phones and computers can encode "é" in two ways, and a paste can add a space.
    const composed = 'caf\u00e9 au lait matin';
    const decomposed = 'cafe\u0301 au lait matin ';
    const sealed = await encryptText('secret', composed);
    expect(await decryptText(sealed, decomposed)).toBe('secret');
  });

  it('refuses to encrypt with a weak passphrase, in each encrypt function', async () => {
    await expect(encryptText('secret', 'short')).rejects.toBeInstanceOf(WeakPassphraseError);
    await expect(encryptText('secret', 'password-password')).rejects.toBeInstanceOf(WeakPassphraseError);
    await expect(encryptBytes(new Uint8Array(1), 'aaaaaaaaaaaaaaaa')).rejects.toBeInstanceOf(WeakPassphraseError);
    await expect(encryptFile({ name: 'a', type: '', bytes: new Uint8Array(1) }, 'short')).rejects.toBeInstanceOf(WeakPassphraseError);
  });

  it('still decrypts old data that was made with a weak passphrase', async () => {
    const legacy = await encryptLegacy('old message', 'weak');
    expect(await decryptText(legacy, 'weak')).toBe('old message');
  });

  it('reads locked text from the published site, which used 600,000 iterations and no prefix', async () => {
    const fromSite = await encryptLegacy('message from the site', PASSPHRASE, 600_000);
    expect(await decryptText(fromSite, PASSPHRASE)).toBe('message from the site');
    await expect(decryptText(fromSite, 'not the passphrase')).rejects.toBeInstanceOf(DecryptionError);
  });

  it('reads a version 1 payload', async () => {
    const legacy = await encryptLegacy('old message', PASSPHRASE);
    expect(await decryptText(legacy, PASSPHRASE)).toBe('old message');
  });
});

describe('file encryption', () => {
  it('round-trips the bytes, the name, and the type', async () => {
    const bytes = crypto.getRandomValues(new Uint8Array(5000));
    const sealed = await encryptFile({ name: 'notes.pdf', type: 'application/pdf', bytes }, PASSPHRASE);
    expect(new TextDecoder().decode(sealed.subarray(0, 4))).toBe('SNJ2');
    expect(await decryptFile(sealed, PASSPHRASE)).toEqual({ name: 'notes.pdf', type: 'application/pdf', bytes });
  });

  it('does not show the file name in the container', async () => {
    const sealed = await encryptFile({ name: 'witness-list.txt', type: 'text/plain', bytes: new Uint8Array(10) }, PASSPHRASE);
    expect(new TextDecoder('latin1').decode(sealed)).not.toContain('witness-list');
  });

  it('removes a path from the decrypted file name', async () => {
    const sealed = await encryptFile({ name: '../../etc/passwd', type: '', bytes: new Uint8Array(1) }, PASSPHRASE);
    expect((await decryptFile(sealed, PASSPHRASE)).name).toBe('passwd');
  });

  it('removes invisible direction marks, which can disguise a file extension', async () => {
    const sealed = await encryptFile({ name: 'photo\u202egnp.exe', type: '', bytes: new Uint8Array(1) }, PASSPHRASE);
    expect((await decryptFile(sealed, PASSPHRASE)).name).toBe('photognp.exe');
  });

  it('accepts the file passphrase with a space at the end', async () => {
    const sealed = await encryptFile({ name: 'a', type: '', bytes: new Uint8Array([7]) }, PASSPHRASE);
    expect((await decryptFile(sealed, `${PASSPHRASE} `)).bytes).toEqual(new Uint8Array([7]));
  });

  it('permits a container that is larger than the file limit by the size of the format data', async () => {
    // A file at the size limit must decrypt again. The container adds the
    // name, the type, the salt, the nonce, and the authentication tag.
    const bytes = new Uint8Array(1000);
    const sealed = await encryptFile({ name: 'n'.repeat(255), type: 't'.repeat(255), bytes }, PASSPHRASE);
    expect(sealed.length).toBeGreaterThan(bytes.length);
    expect(sealed.length - bytes.length).toBeLessThanOrEqual(MAX_CONTAINER_BYTES - MAX_FILE_BYTES);
  });

  it('rejects the wrong passphrase and data that is not a container', async () => {
    const sealed = await encryptFile({ name: 'a', type: '', bytes: new Uint8Array(1) }, PASSPHRASE);
    await expect(decryptFile(sealed, 'wrong')).rejects.toBeInstanceOf(DecryptionError);
    await expect(decryptFile(new Uint8Array(100), PASSPHRASE)).rejects.toBeInstanceOf(DecryptionError);
  });
});
