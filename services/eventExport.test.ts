import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { encryptText } from './crypto';
import { buildEventPage, type EventPageLabels } from './eventExport';

const labels: EventPageLabels = {
  lang: 'en',
  dir: 'ltr',
  pageTitle: 'Locked event',
  prompt: 'Type the passphrase.',
  passphrase: 'Passphrase',
  unlock: 'Unlock',
  working: 'Working',
  wrong: 'Wrong passphrase.',
  unsupported: 'This browser cannot decrypt here.',
  location: 'Location',
  description: 'Description',
  safety: 'Safety',
  print: 'Print',
};

const event = {
  title: 'Know your rights night',
  date: 'Tuesday, 6 PM',
  location: 'Library, room <b>2</b>',
  description: 'Line one\nLine two',
  safetyInfo: 'Bring a friend',
};

/** Opens the exported page in a browser environment that has no network. */
function openPage(html: string): JSDOM {
  return new JSDOM(html, {
    runScripts: 'dangerously',
    beforeParse(window) {
      Object.defineProperty(window, 'crypto', { value: webcrypto });
      Object.assign(window, { TextEncoder, TextDecoder });
    },
  });
}

async function unlock(dom: JSDOM, passphrase: string): Promise<void> {
  const { document } = dom.window;
  (document.getElementById('passphrase') as HTMLInputElement).value = passphrase;
  document.getElementById('unlock')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  const button = document.getElementById('unlock-button') as HTMLButtonElement;
  const details = document.getElementById('details')!;
  await expect.poll(() => !button.disabled || !details.hidden, { timeout: 15_000 }).toBe(true);
}

describe('event page', () => {
  it('decrypts the event with the correct passphrase and shows it as text', async () => {
    const payload = await encryptText(JSON.stringify(event), 'six words for the event page');
    const dom = openPage(buildEventPage(payload, labels));
    await unlock(dom, 'six words for the event page');

    const { document } = dom.window;
    expect(document.getElementById('details')!.hidden).toBe(false);
    expect(document.getElementById('view-title')!.textContent).toBe(event.title);
    expect(document.getElementById('view-description')!.textContent).toBe(event.description);
    // Markup in the event must stay text.
    expect(document.getElementById('view-location')!.textContent).toBe(event.location);
    expect(document.getElementById('view-location')!.querySelector('b')).toBeNull();
  });

  it('accepts the passphrase with a space at the end', async () => {
    const payload = await encryptText(JSON.stringify(event), 'six words for the event page');
    const dom = openPage(buildEventPage(payload, labels));
    await unlock(dom, 'six words for the event page ');
    expect(dom.window.document.getElementById('details')!.hidden).toBe(false);
  });

  it('shows an error for the wrong passphrase and keeps the event hidden', async () => {
    const payload = await encryptText(JSON.stringify(event), 'six words for the event page');
    const dom = openPage(buildEventPage(payload, labels));
    await unlock(dom, 'wrong passphrase');

    const { document } = dom.window;
    expect(document.getElementById('error')!.hidden).toBe(false);
    expect(document.getElementById('details')!.hidden).toBe(true);
    expect(document.getElementById('view-title')!.textContent).toBe('');
  });

  it('shows a clear message when the browser has no Web Crypto', async () => {
    // A page that is not in a secure context has no crypto.subtle. Some
    // in-app file previews open the page in this way.
    const payload = await encryptText(JSON.stringify(event), 'six words for the event page');
    const dom = new JSDOM(buildEventPage(payload, labels), { runScripts: 'dangerously' });
    const { document } = dom.window;
    (document.getElementById('passphrase') as HTMLInputElement).value = 'six words for the event page';
    document.getElementById('unlock')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));

    const error = document.getElementById('error')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe(labels.unsupported);
    expect((document.getElementById('unlock-button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('contains no address of an external resource', async () => {
    const payload = await encryptText(JSON.stringify(event), 'river tulip nine window');
    const html = buildEventPage(payload, labels);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain(event.title);
  });

  it('refuses a payload that is not encrypted text', () => {
    expect(() => buildEventPage('</script><script>alert(1)</script>', labels)).toThrow();
    expect(() => buildEventPage('plain text', labels)).toThrow();
  });

  it('carries the language and the direction of the labels', async () => {
    const payload = await encryptText(JSON.stringify(event), 'six words for the event page');
    const english = openPage(buildEventPage(payload, labels)).window.document.documentElement;
    expect(english.lang).toBe('en');
    expect(english.dir).toBe('ltr');
    const arabic = openPage(buildEventPage(payload, { ...labels, lang: 'ar', dir: 'rtl' })).window.document;
    expect(arabic.documentElement.lang).toBe('ar');
    expect(arabic.documentElement.dir).toBe('rtl');
    // The passphrase reads left to right in each language. The text of the event takes its own direction.
    expect(arabic.getElementById('passphrase')!.getAttribute('dir')).toBe('ltr');
    for (const id of ['view-title', 'view-date', 'view-location', 'view-description', 'view-safety']) {
      expect(arabic.getElementById(id)!.getAttribute('dir')).toBe('auto');
    }
  });

  it('accepts only a known direction', async () => {
    const payload = await encryptText('{}', 'river tulip nine window');
    const page = buildEventPage(payload, { ...labels, dir: '"><img src=x>' as 'rtl' });
    const { document } = openPage(page).window;
    expect(document.querySelector('img')).toBeNull();
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('escapes markup in labels', async () => {
    const payload = await encryptText('{}', 'river tulip nine window');
    const html = buildEventPage(payload, { ...labels, lang: '"><img src=x>', pageTitle: '<img src=x>', unlock: '</script>' });
    const dom = openPage(html);
    expect(dom.window.document.querySelector('img')).toBeNull();
    expect(dom.window.document.querySelector('h1')!.textContent).toBe('<img src=x>');
    expect(dom.window.document.getElementById('unlock-button')!.textContent).toBe('</script>');
  });
});
