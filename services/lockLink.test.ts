import { describe, expect, it } from 'vitest';
import { bytesToBase64, decryptText, encryptText } from './crypto';
import { readRoute } from '../tools';
import { buildLockLink, linkQrCells, readLockLink } from './lockLink';

const PASSPHRASE = 'river tulip nine window';

/** The part of the link that the app gives to the tool. */
const payloadOf = (link: string) => readRoute(link.slice(link.indexOf('#'))).payload;

describe('link of a locked message', () => {
  it('gives back the locked text that the link was made from', async () => {
    const locked = await encryptText('Meet at 6', PASSPHRASE);
    const link = buildLockLink(locked, 'https://example.org/app/');
    expect(link.startsWith('https://example.org/app/#/secure-share/snj2.')).toBe(true);
    expect(readRoute(link.slice(link.indexOf('#'))).page).toBe('secure-share');
    expect(readLockLink(payloadOf(link))).toEqual({ text: locked, damaged: false });
  });

  it('has the form of the links of the old site', () => {
    // Base64 has "+", "/", and "=". The old site encoded them, so that no app changes them.
    const locked = 'ab+/'.repeat(15) + 'ab==';
    expect(buildLockLink(locked, 'https://example.org/')).toBe(`https://example.org/#/secure-share/${encodeURIComponent(locked)}`);
  });

  it('opens a link of the old site, which has locked text with no prefix', async () => {
    const legacy = bytesToBase64(new Uint8Array(60).fill(251));
    const link = `https://example.org/#/secure-share/${encodeURIComponent(legacy)}`;
    expect(readLockLink(payloadOf(link))).toEqual({ text: legacy, damaged: false });
  });

  it('keeps the locked text out of the part of the address that goes to a server', async () => {
    const locked = await encryptText('Meet at 6', PASSPHRASE);
    const link = new URL(buildLockLink(locked, 'https://example.org/app/'));
    expect(link.pathname + link.search).toBe('/app/');
  });

  it('does not copy the query or the fragment of the open page into the link', () => {
    const link = buildLockLink('x'.repeat(60), 'https://example.org/app/index.html?invite=1#/secure-share/old');
    expect(link).toBe(`https://example.org/app/index.html#/secure-share/${'x'.repeat(60)}`);
  });

  it('makes a link that works when the app is opened from a file', () => {
    const link = buildLockLink('x'.repeat(60), 'file:///home/me/app/index.html#/secure-share');
    expect(link.startsWith('file:///home/me/app/index.html#/secure-share/')).toBe(true);
  });

  it('reads a link that a mail program broke over two lines', async () => {
    const locked = await encryptText('Meet at 6', PASSPHRASE);
    const encoded = encodeURIComponent(locked);
    // The break is after the prefix "snj2.", so that it is not inside an escape such as "%2B".
    const broken = `${encoded.slice(0, 5)}%0A%20${encoded.slice(5)}`;
    const { text, damaged } = readLockLink(broken);
    expect(damaged).toBe(false);
    expect(await decryptText(text, PASSPHRASE)).toBe('Meet at 6');
  });

  it('reports a link that cannot be decoded as damaged', () => {
    expect(readLockLink('snj2.abc%E0%A4%A')).toEqual({ text: '', damaged: true });
    expect(readLockLink('%')).toEqual({ text: '', damaged: true });
  });

  it('reports a link that does not hold locked text as damaged', () => {
    expect(readLockLink('hello')).toEqual({ text: '', damaged: true });
    expect(readLockLink(encodeURIComponent('<script>alert(1)</script>'.repeat(4)))).toEqual({ text: '', damaged: true });
    // Too short to hold a salt, a nonce, and an authentication tag.
    expect(readLockLink('snj2.QUJD')).toEqual({ text: '', damaged: true });
  });

  it('reports no damage when the address has no locked text', () => {
    expect(readLockLink('')).toEqual({ text: '', damaged: false });
  });
});

describe('QR code of a link', () => {
  it('draws a code for a link of normal length', async () => {
    const link = buildLockLink(await encryptText('Meet at 6', PASSPHRASE), 'https://example.org/');
    const cells = linkQrCells(link);
    expect(cells).not.toBeNull();
    expect(cells!.dark.length).toBeGreaterThan(0);
    expect(cells!.dark.every(([column, row]) => column < cells!.size && row < cells!.size)).toBe(true);
  });

  it('gives no code and no error when the link is too long', () => {
    expect(linkQrCells('a'.repeat(2953))).not.toBeNull();
    expect(linkQrCells('a'.repeat(2954))).toBeNull();
  });
});
