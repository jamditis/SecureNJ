// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptText } from '../services/crypto';
import { downloadBlob } from '../services/download';
import { I18nContext, i18nFor } from '../services/i18n';
import { localDateTimeValue } from '../services/witness';
import WitnessNotes from './WitnessNotes';

vi.mock('../services/download', () => ({ downloadBlob: vi.fn() }));

const PASSPHRASE = 'maple river stone cloud forest lamp';
const SAVED = 'Saved as witness-notes.locked.txt. Open it with the "Unlock" tab on the lock a message page. Send the passphrase a different way.';

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsText(blob);
  });

/** The content and the name of the one file that the tool saved. */
const savedFile = async () => {
  const calls = vi.mocked(downloadBlob).mock.calls;
  expect(calls).toHaveLength(1);
  const [blob, name] = calls[0];
  return { content: await readBlob(blob), name, type: blob.type };
};

const passphraseField = () => screen.getByLabelText(/^Passphrase/);
const saveButton = () => screen.getByRole('button', { name: 'Lock and save notes' });
const unloadIsStopped = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

beforeEach(() => {
  vi.mocked(downloadBlob).mockClear();
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('witness notes', () => {
  it('fills in the date and time with the local time of the device', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 18, 14, 5));
    render(<WitnessNotes />);
    expect(screen.getByLabelText<HTMLInputElement>('Date and time').value).toBe('2026-11-18T14:05');
    expect(localDateTimeValue(new Date())).toBe('2026-11-18T14:05');
  });

  it('shows each question of the old form with its hint, and no question is required', () => {
    render(<WitnessNotes />);
    const short = ['Exact place', 'Agency and what they wore', 'Vehicles'];
    const long = ['What happened, in order', 'What was said', 'People affected', 'Photos, video, and other witnesses'];
    for (const label of short) {
      const input = screen.getByLabelText<HTMLInputElement>(label);
      expect(input.tagName).toBe('INPUT');
      expect(input.autocomplete).toBe('off');
      expect(input.required).toBe(false);
    }
    for (const label of long) {
      const area = screen.getByLabelText<HTMLTextAreaElement>(label);
      expect(area.tagName).toBe('TEXTAREA');
      expect(area.rows).toBe(4);
    }
    expect(screen.getByRole('textbox', { name: 'What was said', description: 'Use exact words if you can. Did they show a warrant?' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Vehicles', description: 'Make, color, markings, and plate if visible.' })).toBeTruthy();
  });

  it('saves a locked file with the old name, which opens with the passphrase and holds the notes in the sequence of the form', async () => {
    const user = userEvent.setup();
    render(<WitnessNotes />);
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2026-11-18T14:05' } });
    await user.type(screen.getByLabelText('What was said'), 'Open the door');
    await user.type(screen.getByLabelText('Exact place'), 'Broad St and Market St');
    await user.type(passphraseField(), PASSPHRASE);
    await user.click(saveButton());

    await screen.findByText(SAVED);
    expect(screen.getByRole('status').textContent).toBe(SAVED);
    const file = await savedFile();
    expect(file.name).toBe('witness-notes.locked.txt');
    expect(file.type).toBe('text/plain');
    expect(await decryptText(file.content, PASSPHRASE)).toBe(
      'Witness notes\n\nDate and time: 2026-11-18 14:05\n\nExact place: Broad St and Market St\n\nWhat was said: Open the door',
    );
  });

  it('saves a file that does not contain the notes or the passphrase as plain text', async () => {
    const user = userEvent.setup();
    render(<WitnessNotes />);
    await user.type(screen.getByLabelText('People affected'), 'A man in a red jacket');
    await user.type(passphraseField(), PASSPHRASE);
    await user.click(saveButton());
    await screen.findByText(SAVED);

    const { content } = await savedFile();
    for (const secret of ['red jacket', 'People affected', 'Witness notes', PASSPHRASE]) {
      expect(content).not.toContain(secret);
      // The text after the version mark is base64: look inside it too.
      expect(atob(content.slice(content.indexOf('.') + 1))).not.toContain(secret);
    }
  });

  it('does not store the notes or the passphrase on the device', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<WitnessNotes />);
    await user.type(screen.getByLabelText('What happened, in order'), 'Two officers went in');
    await user.type(passphraseField(), PASSPHRASE);
    await user.click(saveButton());
    await screen.findByText(SAVED);

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(screen.getByText('These notes are not stored on this device. If you leave or reload this page before you save them, they are gone.')).toBeTruthy();
    setItem.mockRestore();
  });

  it('saves no file for a short passphrase, and says why', async () => {
    const user = userEvent.setup();
    render(<WitnessNotes />);
    await user.type(screen.getByLabelText('Vehicles'), 'White van');
    await user.click(saveButton());
    expect((await screen.findByRole('alert')).textContent).toBe('Use a passphrase of at least 12 characters.');
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('saves no file for a passphrase that is easy to guess', async () => {
    const user = userEvent.setup();
    render(<WitnessNotes />);
    await user.type(screen.getByLabelText('Vehicles'), 'White van');
    await user.type(passphraseField(), 'password password');
    await user.click(saveButton());
    expect((await screen.findByRole('alert')).textContent).toContain('easy to guess');
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('saves no file when no question has an answer', async () => {
    const user = userEvent.setup();
    render(<WitnessNotes />);
    await user.type(screen.getByLabelText('Exact place'), '   ');
    await user.type(passphraseField(), PASSPHRASE);
    await user.click(saveButton());
    expect(screen.getByRole('alert').textContent).toBe('Write down what you saw before you lock the notes.');
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('saves one file when the button is pressed two times fast', async () => {
    const user = userEvent.setup();
    render(<WitnessNotes />);
    await user.type(screen.getByLabelText('Vehicles'), 'White van');
    await user.type(passphraseField(), PASSPHRASE);
    await user.dblClick(saveButton());
    await screen.findByText(SAVED);
    // Time for a second file, if the second press started one.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(downloadBlob).toHaveBeenCalledTimes(1);
  });

  it('takes the "saved" message away when the notes or the passphrase change after the save', async () => {
    const user = userEvent.setup();
    render(<WitnessNotes />);
    await user.type(screen.getByLabelText('Vehicles'), 'White van');
    await user.type(passphraseField(), PASSPHRASE);
    await user.click(saveButton());
    await screen.findByText(SAVED);

    await user.type(screen.getByLabelText('Vehicles'), ', plate ABC');
    expect(screen.queryByText(SAVED)).toBeNull();

    await user.click(saveButton());
    await screen.findByText(SAVED);
    await user.type(passphraseField(), '!');
    expect(screen.queryByText(SAVED)).toBeNull();
  });

  it('asks before the browser closes the page with notes that are not in a file', async () => {
    const user = userEvent.setup();
    render(<WitnessNotes />);
    expect(unloadIsStopped()).toBe(false);

    await user.type(screen.getByLabelText('Vehicles'), 'White van');
    expect(unloadIsStopped()).toBe(true);

    await user.type(passphraseField(), PASSPHRASE);
    await user.click(saveButton());
    await screen.findByText(SAVED);
    expect(unloadIsStopped()).toBe(false);

    await user.type(screen.getByLabelText('Vehicles'), '!');
    expect(unloadIsStopped()).toBe(true);
  });

  it('links to the ACLU guide in a new tab with no referrer, and to the photo cleaner in the app', () => {
    render(<WitnessNotes />);
    const guide = screen.getByRole<HTMLAnchorElement>('link', { name: 'Read the ACLU guide' });
    expect(guide.href).toBe('https://www.aclu.org/know-your-rights/protesters-rights');
    expect(guide.target).toBe('_blank');
    expect(guide.rel).toContain('noreferrer');
    expect(guide.closest('p')?.textContent).toBe(
      "Stay safe first. When you are lawfully in a public space, you have the right to photograph what's in plain view, including police. Keep your distance, and don't block or interfere with officers. Read the ACLU guide. This isn't legal advice.",
    );

    const cleaner = screen.getByRole('link', { name: 'photo cleaner' });
    expect(cleaner.getAttribute('href')).toBe('#/photo-cleaner');
    expect(cleaner.closest('li')?.textContent).toBe('Use the photo cleaner on a copy before you share a photo. Keep the original for the lawyer.');
    expect(screen.getByRole('heading', { name: 'Before you share anything' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('writes the file with the Spanish labels when the form is in Spanish', async () => {
    const user = userEvent.setup();
    render(
      <I18nContext.Provider value={i18nFor('es')}>
        <WitnessNotes />
      </I18nContext.Provider>,
    );
    fireEvent.change(screen.getByLabelText('Fecha y hora'), { target: { value: '2026-11-18T14:05' } });
    await user.type(screen.getByLabelText('Lugar exacto'), 'Calle Broad');
    await user.type(screen.getByLabelText(/^Frase de contraseña/), PASSPHRASE);
    await user.click(screen.getByRole('button', { name: 'Bloquear y guardar las notas' }));
    expect((await screen.findByText(/witness-notes\.locked\.txt/)).closest('[role="status"]')).not.toBeNull();

    const { content, name } = await savedFile();
    expect(name).toBe('witness-notes.locked.txt');
    expect(await decryptText(content, PASSPHRASE)).toBe('Notas de testigo\n\nFecha y hora: 2026-11-18 14:05\n\nLugar exacto: Calle Broad');
  });
});
