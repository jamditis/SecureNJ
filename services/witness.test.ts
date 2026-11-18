import { describe, expect, it } from 'vitest';
import { WeakPassphraseError, decryptText } from './crypto';
import {
  WITNESS_FIELDS,
  WITNESS_FILE_NAME,
  buildWitnessText,
  hasNotes,
  localDateTimeValue,
  lockWitnessNotes,
  type WitnessLabels,
} from './witness';

const LABELS: WitnessLabels = {
  title: 'Witness notes',
  when: 'Date and time',
  fields: {
    where: 'Exact place',
    who: 'Agency and what they wore',
    vehicles: 'Vehicles',
    what: 'What happened, in order',
    said: 'What was said',
    people: 'People affected',
    evidence: 'Photos, video, and other witnesses',
  },
};
const PASSPHRASE = 'maple river stone cloud forest lamp';

describe('witness notes: form', () => {
  it('asks the questions in the sequence of the old form, with a text area for the long answers', () => {
    expect(WITNESS_FIELDS.map((field) => field.id)).toEqual(['where', 'who', 'vehicles', 'what', 'said', 'people', 'evidence']);
    expect(WITNESS_FIELDS.filter((field) => field.long).map((field) => field.id)).toEqual(['what', 'said', 'people', 'evidence']);
  });

  it('gives the local time of the device in the format of a date and time input', () => {
    expect(localDateTimeValue(new Date(2026, 0, 5, 9, 7, 59))).toBe('2026-01-05T09:07');
    expect(localDateTimeValue(new Date(2026, 10, 18, 23, 45))).toBe('2026-11-18T23:45');
  });

  it('sees notes only when an answer has text', () => {
    expect(hasNotes({})).toBe(false);
    expect(hasNotes({ where: '', what: '  \n ' })).toBe(false);
    expect(hasNotes({ said: 'Open the door' })).toBe(true);
  });
});

describe('witness notes: text', () => {
  it('writes the title, the date, and each answer in the sequence of the form, with an empty line between them', () => {
    const text = buildWitnessText('2026-11-18T14:05', { what: 'Two officers went in.\nThey left with one person.', where: 'Broad St and Market St' }, LABELS);
    expect(text).toBe(
      'Witness notes\n\nDate and time: 2026-11-18 14:05\n\nExact place: Broad St and Market St\n\nWhat happened, in order: Two officers went in.\nThey left with one person.',
    );
  });

  it('leaves out a question with no answer', () => {
    expect(buildWitnessText('2026-11-18T14:05', { where: '', vehicles: 'White van' }, LABELS)).toBe(
      'Witness notes\n\nDate and time: 2026-11-18 14:05\n\nVehicles: White van',
    );
  });

  it('leaves out an answer that holds only spaces', () => {
    expect(buildWitnessText('2026-11-18T14:05', { where: '   ', said: ' \n ' }, LABELS)).toBe('Witness notes\n\nDate and time: 2026-11-18 14:05');
  });

  it('leaves out the date line when the date is cleared', () => {
    expect(buildWitnessText('', { vehicles: 'White van' }, LABELS)).toBe('Witness notes\n\nVehicles: White van');
  });

  it('uses the labels that it gets, so the file reads like the form', () => {
    const labels = { ...LABELS, title: 'Notas de testigo', when: 'Fecha y hora', fields: { ...LABELS.fields, where: 'Lugar exacto' } };
    expect(buildWitnessText('2026-11-18T14:05', { where: 'Calle Broad' }, labels)).toBe('Notas de testigo\n\nFecha y hora: 2026-11-18 14:05\n\nLugar exacto: Calle Broad');
  });
});

describe('witness notes: locked file', () => {
  const text = buildWitnessText('2026-11-18T14:05', { where: 'Broad St and Market St', said: 'Open the door' }, LABELS);

  it('keeps the file name of the old site', () => {
    expect(WITNESS_FILE_NAME).toBe('witness-notes.locked.txt');
  });

  it('does not contain the notes as plain text', async () => {
    const locked = await lockWitnessNotes(text, PASSPHRASE);
    for (const secret of ['Witness notes', 'Broad St', 'Open the door', '2026-11-18', PASSPHRASE]) {
      expect(locked).not.toContain(secret);
      // The text after the version mark is base64: look inside it too.
      expect(Buffer.from(locked.slice(locked.indexOf('.') + 1), 'base64').toString('latin1')).not.toContain(secret);
    }
  });

  it('is one line of text that the "Unlock" function of "Lock a message" opens with the passphrase', async () => {
    const locked = await lockWitnessNotes(text, PASSPHRASE);
    expect(locked).not.toMatch(/\s/);
    expect(await decryptText(locked, PASSPHRASE)).toBe(text);
  });

  it('does not open with a different passphrase', async () => {
    const locked = await lockWitnessNotes(text, PASSPHRASE);
    await expect(decryptText(locked, 'a different passphrase 42')).rejects.toThrow();
  });

  it('refuses a passphrase that is short or easy to guess', async () => {
    await expect(lockWitnessNotes(text, '')).rejects.toBeInstanceOf(WeakPassphraseError);
    await expect(lockWitnessNotes(text, 'password password')).rejects.toMatchObject({ problem: 'guessable' });
  });
});
