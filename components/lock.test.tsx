// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { base64ToBytes, bytesToBase64, decryptBytes, encryptBytes, encryptText } from '../services/crypto';
import { downloadBlob } from '../services/download';
import { I18nContext, i18nFor } from '../services/i18n';
import { packFile } from '../services/lockedFile';
import LockFile from './LockFile';
import SecureShare from './SecureShare';

vi.mock('../services/download', () => ({ downloadBlob: vi.fn() }));

const PASSPHRASE = 'river tulip nine window';
const WAIT = { timeout: 15_000 };

beforeEach(() => {
  window.history.replaceState(null, '', '#/secure-share');
});
afterEach(cleanup);

// The label also holds the warning for a weak passphrase, so match the start of its text.
const passphraseField = () => screen.getByLabelText<HTMLInputElement>(/^Passphrase/, { selector: 'input' });
const lockedText = async () => (await screen.findByTestId('locked-text', undefined, WAIT)).textContent ?? '';
const unlockedText = async () => (await screen.findByTestId('unlocked-text', undefined, WAIT)).textContent;

type User = ReturnType<typeof userEvent.setup>;

async function lock(user: User, message: string): Promise<string> {
  await user.click(screen.getByLabelText('Your message'));
  await user.paste(message);
  await user.click(passphraseField());
  await user.paste(PASSPHRASE);
  await user.click(screen.getByRole('button', { name: 'Lock message' }));
  return lockedText();
}

async function unlock(user: User, locked: string | null, passphrase = PASSPHRASE): Promise<void> {
  if (locked !== null) {
    await user.click(screen.getByLabelText('Locked text'));
    await user.paste(locked);
  }
  if (passphraseField().value === '') {
    await user.click(passphraseField());
    await user.paste(passphrase);
  }
  await user.click(screen.getByRole('button', { name: 'Unlock message' }));
}

describe('lock a message', () => {
  it('locks a message and unlocks it again with the passphrase', async () => {
    const user = userEvent.setup();
    render(<SecureShare />);
    expect(screen.getByRole('heading', { name: /Lock a message/ })).toBeTruthy();

    const locked = await lock(user, 'Meet at 6\nat the library');
    expect(screen.getByRole('heading', { name: 'Your message is locked' })).toBeTruthy();
    expect(locked.startsWith('snj2.')).toBe(true);
    expect(locked).not.toContain('Meet');

    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(screen.getByRole('heading', { name: /Unlock a message/ })).toBeTruthy();
    // The tab change keeps the passphrase and clears the rest.
    expect(passphraseField().value).toBe(PASSPHRASE);
    expect(screen.getByLabelText<HTMLTextAreaElement>('Locked text').value).toBe('');
    expect(screen.queryByTestId('locked-text')).toBeNull();

    await unlock(user, locked);
    expect(await unlockedText()).toBe('Meet at 6\nat the library');
    expect(screen.getByRole('heading', { name: 'The message' })).toBeTruthy();
  });

  it('copies a link of the old form, and the link opens the message', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/app/?x=1#/secure-share');
    const first = render(<SecureShare />);
    const locked = await lock(user, 'Meet at 6');

    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    const link = await navigator.clipboard.readText();
    expect(link).toBe(`${window.location.origin}/app/#/secure-share/${encodeURIComponent(locked)}`);

    await user.click(screen.getByRole('button', { name: 'Copy text only' }));
    expect(await navigator.clipboard.readText()).toBe(locked);
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();

    first.unmount();
    render(<SecureShare lockedFromLink={link.slice(link.indexOf('#/secure-share/') + '#/secure-share/'.length)} />);
    await unlock(user, null);
    expect(await unlockedText()).toBe('Meet at 6');

    await user.click(screen.getByRole('button', { name: 'Copy message' }));
    expect(await navigator.clipboard.readText()).toBe('Meet at 6');
  });

  it('shows a QR code of the link', async () => {
    const user = userEvent.setup();
    render(<SecureShare />);
    await lock(user, 'Meet at 6');
    expect(screen.getByRole('img', { name: 'QR code for the locked link' }).querySelectorAll('rect').length).toBeGreaterThan(100);
    expect(screen.getByText('To hand it over in person, have them scan this code.')).toBeTruthy();
  });

  it('shows no QR code and no error when the link is too long for one', async () => {
    const user = userEvent.setup();
    render(<SecureShare />);
    const locked = await lock(user, 'A long message. '.repeat(200));
    expect(locked.length).toBeGreaterThan(3000);
    expect(screen.queryByRole('img', { name: 'QR code for the locked link' })).toBeNull();
    expect(screen.queryByText('To hand it over in person, have them scan this code.')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
  });

  it('opens a link on the unlock tab with the text filled in, and takes the locked text out of the address bar', async () => {
    const user = userEvent.setup();
    const locked = await encryptText('Bring water', PASSPHRASE);
    const payload = encodeURIComponent(locked);
    window.history.replaceState(null, '', `/app/?x=1#/secure-share/${payload}`);
    render(<SecureShare lockedFromLink={payload} />);

    expect(screen.getByRole('heading', { name: /Unlock a message/ })).toBeTruthy();
    expect(screen.getByText('Someone sent you a locked message. Enter the passphrase they gave you to read it.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unlock' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Locked text').value).toBe(locked);
    expect(window.location.hash).toBe('#/secure-share');
    expect(window.location.href).not.toContain(payload);
    expect(window.location.pathname + window.location.search).toBe('/app/?x=1');

    await unlock(user, null);
    expect(await unlockedText()).toBe('Bring water');
  });

  it('says that the link is damaged when it cannot be decoded', () => {
    window.history.replaceState(null, '', '#/secure-share/snj2.abc%E0%A4%A');
    render(<SecureShare lockedFromLink="snj2.abc%E0%A4%A" />);
    expect(screen.getByRole('alert').textContent).toBe('This link is damaged. Ask the sender for a new one.');
    expect(screen.getByRole('button', { name: 'Unlock' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Locked text').value).toBe('');
    expect(window.location.hash).toBe('#/secure-share');
  });

  it('unlocks text from the old site and from the export files of other tools', async () => {
    // The old site: base64 with no prefix. The passphrase is used as typed.
    const user = userEvent.setup();
    const exported = JSON.stringify({ notes: 'Two cars at the corner' });
    const legacy = bytesToBase64(await encryptBytes(new TextEncoder().encode(exported), PASSPHRASE));
    render(<SecureShare />);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    // A text file can end with a line break.
    await unlock(user, `${legacy}\n`);
    expect(await unlockedText()).toBe(exported);
  });

  it('says what is missing before it locks', async () => {
    const user = userEvent.setup();
    render(<SecureShare />);
    await user.click(screen.getByRole('button', { name: 'Lock message' }));
    expect(screen.getByRole('alert').textContent).toBe('Write a message first.');

    await user.type(screen.getByLabelText('Your message'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Lock message' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter the passphrase.');

    await user.type(passphraseField(), 'short');
    await user.click(screen.getByRole('button', { name: 'Lock message' }));
    expect(screen.getByRole('alert').textContent).toBe('Use a passphrase of at least 12 characters.');

    await user.clear(passphraseField());
    await user.type(passphraseField(), 'password1234');
    await user.click(screen.getByRole('button', { name: 'Lock message' }));
    expect(screen.getByRole('alert').textContent).toMatch(/^That passphrase is easy to guess\./);
    expect(screen.queryByTestId('locked-text')).toBeNull();
  });

  it('says what is missing before it unlocks, and reports a wrong passphrase', async () => {
    const user = userEvent.setup();
    const locked = await encryptText('Bring water', PASSPHRASE);
    render(<SecureShare />);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await user.click(screen.getByRole('button', { name: 'Unlock message' }));
    expect(screen.getByRole('alert').textContent).toBe('Paste the locked text first.');

    await user.click(screen.getByLabelText('Locked text'));
    await user.paste(locked);
    await user.click(screen.getByRole('button', { name: 'Unlock message' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter the passphrase.');

    await unlock(user, null, 'not the right passphrase');
    expect((await screen.findByRole('alert', undefined, WAIT)).textContent).toBe('Could not unlock this. Check the passphrase and the text.');
    expect(screen.queryByTestId('unlocked-text')).toBeNull();
  });

  it('does not let the tab change while it works, so a message never shows as locked text', async () => {
    const user = userEvent.setup();
    const locked = await encryptText('Bring water', PASSPHRASE);
    render(<SecureShare />);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await unlock(user, locked);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Working…' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Lock' }).disabled).toBe(true);

    expect(await unlockedText()).toBe('Bring water');
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    expect(screen.queryByTestId('locked-text')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Your message is locked' })).toBeNull();
    expect(screen.queryByText('Bring water')).toBeNull();
  });

  it('sends nothing to a server and stores nothing on the device', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, 'open');
    const socket = vi.spyOn(window, 'WebSocket');
    localStorage.clear();
    sessionStorage.clear();

    render(<SecureShare />);
    const locked = await lock(user, 'Meet at 6');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await unlock(user, locked);
    expect(await unlockedText()).toBe('Meet at 6');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    expect(socket).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(window.location.href).not.toContain('snj2.');
    vi.unstubAllGlobals();
  });

  it('says so when the browser refuses the clipboard', async () => {
    const user = userEvent.setup();
    render(<SecureShare />);
    await lock(user, 'Meet at 6');
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not copy. Select the text and copy it yourself.');
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
  });
});

describe('lock a file', () => {
  const saved = vi.mocked(downloadBlob);
  beforeEach(() => saved.mockClear());

  const notes = () => new File(['The safe house is at 12 Elm Street.'], 'elm-street-plan.txt', { type: 'text/plain' });
  const fileInput = () => screen.getByLabelText<HTMLInputElement>('File, up to 25 MB');

  async function lockNotes(user: User): Promise<string> {
    await user.upload(fileInput(), notes());
    await user.click(passphraseField());
    await user.paste(PASSPHRASE);
    await user.click(screen.getByRole('button', { name: 'Lock and save' }));
    await screen.findByRole('status', undefined, WAIT);
    return saved.mock.calls[0][0].text();
  }

  it('saves one HTML file with a neutral name that holds the file and its name, encrypted', async () => {
    const user = userEvent.setup();
    render(<LockFile />);
    const html = await lockNotes(user);

    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved.mock.calls[0][1]).toBe('locked-file.html');
    expect(saved.mock.calls[0][0].type).toBe('text/html');
    expect(screen.getByRole('status').textContent).toBe(
      'Saved as locked-file.html. Send the file by email or USB drive. Send the passphrase a different way, such as in person or on Signal.',
    );

    expect(html).toContain('<title>Locked file</title>');
    expect(html).not.toContain('elm-street-plan');
    expect(html).not.toContain('Elm Street');
    expect(html).not.toContain(PASSPHRASE);

    const payload = /var PAYLOAD = "([^"]+)";/.exec(html)![1];
    const plain = await decryptBytes(base64ToBytes(payload), PASSPHRASE);
    const original = packFile({ name: 'elm-street-plan.txt', type: 'text/plain', bytes: new TextEncoder().encode('The safe house is at 12 Elm Street.') });
    expect(Array.from(plain)).toEqual(Array.from(original));
  });

  it('writes the locked file in the language of the app', async () => {
    const user = userEvent.setup();
    render(
      <I18nContext.Provider value={i18nFor('es')}>
        <LockFile />
      </I18nContext.Provider>,
    );
    await user.upload(screen.getByLabelText<HTMLInputElement>('Archivo, hasta 25 MB'), notes());
    await user.click(screen.getByLabelText('Frase de contraseña', { selector: 'input' }));
    await user.paste(PASSPHRASE);
    await user.click(screen.getByRole('button', { name: 'Bloquear y guardar' }));
    await screen.findByRole('status', undefined, WAIT);
    const html = await saved.mock.calls[0][0].text();
    expect(html).toContain('<html lang="es" dir="ltr">');
    expect(html).toContain('<title>Archivo bloqueado</title>');
  });

  // These selectors do not use text, so the test does not depend on how much of each language file is done.
  it.each([
    ['pt', '<html lang="pt-BR" dir="ltr">'],
    ['zh', '<html lang="zh-Hans" dir="ltr">'],
    ['ar', '<html lang="ar" dir="rtl">'],
  ] as const)('gives the locked file the language tag and the direction of %s', async (locale, start) => {
    const user = userEvent.setup();
    const { container } = render(
      <I18nContext.Provider value={i18nFor(locale)}>
        <LockFile />
      </I18nContext.Provider>,
    );
    await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, notes());
    await user.click(container.querySelector<HTMLInputElement>('input[type="password"]')!);
    await user.paste(PASSPHRASE);
    await user.click(container.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    await screen.findByRole('status', undefined, WAIT);
    const html = await saved.mock.calls[0][0].text();
    expect(html).toContain(start);
  });

  it('saves nothing with no file, with a file over 25 MB, or with a weak passphrase', async () => {
    const user = userEvent.setup();
    render(<LockFile />);
    await user.click(screen.getByRole('button', { name: 'Lock and save' }));
    expect(screen.getByRole('alert').textContent).toBe('Choose a file first.');

    const large = notes();
    Object.defineProperty(large, 'size', { value: 25 * 1024 * 1024 + 1 });
    await user.upload(fileInput(), large);
    await user.click(passphraseField());
    await user.paste(PASSPHRASE);
    await user.click(screen.getByRole('button', { name: 'Lock and save' }));
    expect(screen.getByRole('alert').textContent).toBe('Choose a file under 25 MB.');

    await user.upload(fileInput(), notes());
    await user.clear(passphraseField());
    await user.click(screen.getByRole('button', { name: 'Lock and save' }));
    expect(screen.getByRole('alert').textContent).toBe('Use a passphrase of at least 12 characters.');

    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Lock and save' }).disabled).toBe(false));
    expect(saved).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('takes the "saved" note away when a different file is chosen', async () => {
    const user = userEvent.setup();
    render(<LockFile />);
    await lockNotes(user);
    await user.upload(fileInput(), new File(['x'], 'other.txt'));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
