import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { encryptText } from './crypto';
import { buildEventPage, type EventPageLabels } from './eventExport';

const labels: EventPageLabels = {
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

  it('escapes markup in labels', async () => {
    const payload = await encryptText('{}', 'river tulip nine window');
    const html = buildEventPage(payload, { ...labels, pageTitle: '<img src=x>', unlock: '</script>' });
    const dom = openPage(html);
    expect(dom.window.document.querySelector('img')).toBeNull();
    expect(dom.window.document.querySelector('h1')!.textContent).toBe('<img src=x>');
    expect(dom.window.document.getElementById('unlock-button')!.textContent).toBe('</script>');
  });
});
