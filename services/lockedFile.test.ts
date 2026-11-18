import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { WeakPassphraseError, base64ToBytes, bytesToBase64, decryptBytes, encryptBytes } from './crypto';
import { MAX_LOCKED_FILE_BYTES, buildLockedFilePage, lockFile, packFile, type LockedFilePageLabels } from './lockedFile';

const labels: LockedFilePageLabels = {
  lang: 'en',
  dir: 'ltr',
  pageTitle: 'Locked file',
  prompt: 'Type the passphrase.',
  passphrase: 'Passphrase',
  unlock: 'Unlock and save',
  working: 'Working',
  wrong: 'Wrong passphrase.',
  unsupported: 'This browser cannot unlock here.',
  done: 'Saved {name}.',
};

const PASSPHRASE = 'six words for the locked file';
// All byte values, so that an error in the base64 or the offsets shows.
const BYTES = Uint8Array.from({ length: 700 }, (_, i) => i % 256);
const file = (name = 'meeting notes.pdf', bytes = BYTES) => ({ name, type: 'application/pdf', bytes });

interface SavedFile {
  name: string;
  type: string;
  bytes: Uint8Array;
}

/**
 * Opens the locked file in a browser environment that has no network. The
 * environment records each file that the page saves.
 */
function openPage(html: string, options: { crypto?: boolean } = {}): { dom: JSDOM; saved: SavedFile[] } {
  const saved: SavedFile[] = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    beforeParse(window) {
      if (options.crypto !== false) Object.defineProperty(window, 'crypto', { value: webcrypto });
      Object.assign(window, { TextEncoder, TextDecoder });
      // jsdom has no object URLs and no downloads.
      const blobs = new Map<string, Blob>();
      window.URL.createObjectURL = (blob: Blob | MediaSource) => {
        const url = `blob:test/${blobs.size}`;
        blobs.set(url, blob as Blob);
        return url;
      };
      window.URL.revokeObjectURL = () => {};
      window.HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
        const blob = blobs.get(this.href)!;
        const entry: SavedFile = { name: this.download, type: blob.type, bytes: new Uint8Array() };
        saved.push(entry);
        void blob.arrayBuffer().then((buffer) => {
          entry.bytes = new Uint8Array(buffer);
        });
      };
    },
  });
  return { dom, saved };
}

async function unlock(dom: JSDOM, passphrase: string): Promise<void> {
  const { document } = dom.window;
  (document.getElementById('passphrase') as HTMLInputElement).value = passphrase;
  document.getElementById('unlock')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  const button = document.getElementById('unlock-button') as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  await expect.poll(() => !button.disabled, { timeout: 15_000 }).toBe(true);
}

describe('locked file', () => {
  it('gives back the exact bytes and the name with the correct passphrase', async () => {
    const { dom, saved } = openPage(await lockFile(file(), PASSPHRASE, labels));
    await unlock(dom, PASSPHRASE);

    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('meeting notes.pdf');
    await expect.poll(() => Array.from(saved[0].bytes)).toEqual(Array.from(BYTES));
    const { document } = dom.window;
    expect(document.getElementById('done')!.textContent).toBe('Saved meeting notes.pdf.');
    expect(document.getElementById('error')!.hidden).toBe(true);
  });

  it('saves the file with a generic type, so that the browser does not open it', async () => {
    const page = await lockFile({ name: 'page.html', type: 'text/html', bytes: new TextEncoder().encode('<script>1</script>') }, PASSPHRASE, labels);
    const { dom, saved } = openPage(page);
    await unlock(dom, PASSPHRASE);
    expect(saved[0].type).toBe('application/octet-stream');
    expect(saved[0].name).toBe('page.html');
  });

  it('accepts the passphrase with a space at the end and in a different Unicode form', async () => {
    // "é" as one character at encryption, as "e" and a combining accent at decryption.
    const { dom, saved } = openPage(await lockFile(file(), 'caf\u00e9 river tulip window', labels));
    await unlock(dom, 'cafe\u0301 river tulip window ');
    expect(saved).toHaveLength(1);
  });

  it('shows an error for the wrong passphrase and saves nothing', async () => {
    const { dom, saved } = openPage(await lockFile(file(), PASSPHRASE, labels));
    await unlock(dom, 'the wrong passphrase');

    const { document } = dom.window;
    expect(saved).toHaveLength(0);
    expect(document.getElementById('error')!.hidden).toBe(false);
    expect(document.getElementById('error')!.textContent).toBe(labels.wrong);
    expect(document.getElementById('done')!.textContent).toBe('');
    expect(document.getElementById('unlock-button')!.textContent).toBe(labels.unlock);
  });

  it('unlocks after a wrong passphrase when the correct one follows', async () => {
    const { dom, saved } = openPage(await lockFile(file(), PASSPHRASE, labels));
    await unlock(dom, 'the wrong passphrase');
    await unlock(dom, PASSPHRASE);
    expect(saved).toHaveLength(1);
    expect(dom.window.document.getElementById('error')!.hidden).toBe(true);
  });

  it('shows a clear message when the browser has no Web Crypto', async () => {
    // A page that is not in a secure context has no crypto.subtle. Some
    // in-app file previews open the page in this way.
    const { dom, saved } = openPage(await lockFile(file(), PASSPHRASE, labels), { crypto: false });
    const { document } = dom.window;
    (document.getElementById('passphrase') as HTMLInputElement).value = PASSPHRASE;
    document.getElementById('unlock')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));

    const error = document.getElementById('error')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe(labels.unsupported);
    expect((document.getElementById('unlock-button') as HTMLButtonElement).disabled).toBe(false);
    expect(saved).toHaveLength(0);
  });

  it('contains no address of an external resource and blocks all network use', async () => {
    const html = await lockFile(file(), PASSPHRASE, labels);
    expect(html).not.toMatch(/https?:/i);
    // No element loads a resource or sends a form.
    expect(new JSDOM(html).window.document.querySelectorAll('[src], [href], [action]')).toHaveLength(0);
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("form-action 'none'");
  });

  it('does not contain the name or the content of the file as plain text', async () => {
    const secret = 'The safe house is at 12 Elm Street.';
    const html = await lockFile({ name: 'elm-street-plan.txt', type: 'text/plain', bytes: new TextEncoder().encode(secret) }, PASSPHRASE, labels);
    expect(html).not.toContain('elm-street-plan');
    expect(html).not.toContain(secret);
    expect(html).not.toContain(btoa(secret).slice(0, 16));
    expect(html).not.toContain('text/plain');
    expect(html).not.toContain(PASSPHRASE);
  });

  it('removes a path and hidden characters from a hostile file name', async () => {
    const names: [string, string][] = [
      ['../../etc/passwd', 'passwd'],
      ['C:\\Users\\me\\Start Menu\\run.bat', 'run.bat'],
      // A mark that reverses the text direction makes "exe.fdp" look like "pdf.exe".
      ['report\u202Efdp.exe', 'reportfdp.exe'],
      ['a\u0000b\r\nc\u200B.txt', 'abc.txt'],
      ['..', 'unlocked-file'],
      ['/', 'unlocked-file'],
    ];
    for (const [hostile, safe] of names) {
      const { dom, saved } = openPage(await lockFile(file(hostile), PASSPHRASE, labels));
      await unlock(dom, PASSPHRASE);
      expect(saved[0].name).toBe(safe);
      expect(dom.window.document.getElementById('done')!.textContent).toBe(`Saved ${safe}.`);
    }
  });

  it('shows a file name with markup as text', async () => {
    const { dom, saved } = openPage(await lockFile(file('<img src=x onerror=alert(1)>.txt'), PASSPHRASE, labels));
    await unlock(dom, PASSPHRASE);
    expect(saved[0].name).toBe('<img src=x onerror=alert(1)>.txt');
    expect(dom.window.document.querySelector('img')).toBeNull();
  });

  it('shows the wrong passphrase error for data that is not a packed file', async () => {
    // The metadata length says 4 GB, and the bytes after it are not JSON.
    const sealed = await encryptBytes(new Uint8Array([255, 255, 255, 255, 1, 2]), PASSPHRASE);
    const { dom, saved } = openPage(buildLockedFilePage(bytesToBase64(sealed), labels));
    await unlock(dom, PASSPHRASE);
    expect(saved).toHaveLength(0);
    expect(dom.window.document.getElementById('error')!.hidden).toBe(false);
  });

  it('carries the language and the direction of the labels', async () => {
    const english = openPage(buildLockedFilePage('AAAA', labels)).dom.window.document.documentElement;
    expect(english.lang).toBe('en');
    expect(english.dir).toBe('ltr');
    const { document } = openPage(buildLockedFilePage('AAAA', { ...labels, lang: 'ar', dir: 'rtl' })).dom.window;
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    // The passphrase reads left to right in each language. The file name takes its own direction.
    expect(document.getElementById('passphrase')!.getAttribute('dir')).toBe('ltr');
    expect(document.getElementById('done')!.getAttribute('dir')).toBe('auto');
  });

  it('accepts only a known direction', () => {
    const { document } = openPage(buildLockedFilePage('AAAA', { ...labels, dir: '"><img src=x>' as 'rtl' })).dom.window;
    expect(document.querySelector('img')).toBeNull();
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('escapes markup in labels', async () => {
    const html = await lockFile(file(), PASSPHRASE, {
      ...labels,
      lang: '"><img src=x>',
      pageTitle: '<img src=x>',
      passphrase: '"><img src=x>',
      unlock: '</script><img src=x>',
      done: '</script><b>{name}</b>',
    });
    const { dom } = openPage(html);
    const { document } = dom.window;
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('h1')!.textContent).toBe('<img src=x>');
    expect(document.getElementById('passphrase')!.getAttribute('aria-label')).toBe('"><img src=x>');
    expect(document.getElementById('unlock-button')!.textContent).toBe('</script><img src=x>');
    await unlock(dom, PASSPHRASE);
    expect(document.getElementById('done')!.textContent).toBe('</script><b>meeting notes.pdf</b>');
    expect(document.querySelector('b')).toBeNull();
    expect(document.getElementById('unlock-button')!.textContent).toBe('</script><img src=x>');
  });

  it('refuses a payload that is not base64 text', () => {
    expect(() => buildLockedFilePage('";alert(1);"', labels)).toThrow();
    expect(() => buildLockedFilePage('</script><script>alert(1)</script>', labels)).toThrow();
    expect(() => buildLockedFilePage('', labels)).toThrow();
  });

  it('uses the format of the old site: salt, nonce, ciphertext, and a length, the metadata, the bytes', async () => {
    const html = await lockFile(file(), PASSPHRASE, labels);
    const payload = /var PAYLOAD = "([^"]+)";/.exec(html)![1];
    const plain = await decryptBytes(base64ToBytes(payload), PASSPHRASE);
    const metaLength = new DataView(plain.buffer, plain.byteOffset).getUint32(0);
    expect(JSON.parse(new TextDecoder().decode(plain.subarray(4, 4 + metaLength)))).toEqual({ name: 'meeting notes.pdf', type: 'application/pdf' });
    expect(Array.from(plain.subarray(4 + metaLength))).toEqual(Array.from(BYTES));
    expect(Array.from(plain)).toEqual(Array.from(packFile(file())));
  });

  it('refuses a weak passphrase and a file over the limit', async () => {
    await expect(lockFile(file(), 'short', labels)).rejects.toBeInstanceOf(WeakPassphraseError);
    const large = { length: MAX_LOCKED_FILE_BYTES + 1 } as Uint8Array;
    await expect(lockFile({ name: 'a', type: '', bytes: large }, PASSPHRASE, labels)).rejects.toBeInstanceOf(RangeError);
  });
});
