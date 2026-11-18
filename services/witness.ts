/**
 * Logic for the witness notes: the list of questions, the plain text of the
 * notes, and the locked file. The notes are not stored: the locked file is
 * the only copy.
 */
import { encryptText } from './crypto';

/** "Lock a message" opens a file with this name on its "Unlock" tab. */
export const WITNESS_FILE_NAME = 'witness-notes.locked.txt';
export const WITNESS_FILE_TYPE = 'text/plain';

/** The questions after the date, in the sequence of the form and of the file. `long` gives a text area. */
export const WITNESS_FIELDS = [
  { id: 'where', long: false },
  { id: 'who', long: false },
  { id: 'vehicles', long: false },
  { id: 'what', long: true },
  { id: 'said', long: true },
  { id: 'people', long: true },
  { id: 'evidence', long: true },
] as const;

export type WitnessFieldId = (typeof WITNESS_FIELDS)[number]['id'];
export type WitnessAnswers = Partial<Record<WitnessFieldId, string>>;

/** The labels come from the language of the form, so the file reads like the form that the witness saw. */
export interface WitnessLabels {
  title: string;
  when: string;
  fields: Record<WitnessFieldId, string>;
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

/** The local time in the format of a `datetime-local` input: `YYYY-MM-DDTHH:MM`. */
export function localDateTimeValue(now: Date): string {
  const date = `${String(now.getFullYear()).padStart(4, '0')}-${twoDigits(now.getMonth() + 1)}-${twoDigits(now.getDate())}`;
  return `${date}T${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`;
}

const isBlank = (value: string | undefined) => value === undefined || value.trim() === '';

/** True when the witness wrote an answer. The date does not count: the form fills it in. */
export function hasNotes(answers: WitnessAnswers): boolean {
  return WITNESS_FIELDS.some((field) => !isBlank(answers[field.id]));
}

/**
 * The plain text of the notes: the title, the date, and each answer, with an
 * empty line between them. A question with no answer is not in the text, and
 * an answer of spaces only is no answer.
 */
export function buildWitnessText(when: string, answers: WitnessAnswers, labels: WitnessLabels): string {
  const lines = [labels.title];
  if (!isBlank(when)) lines.push(`${labels.when}: ${when.trim().replace('T', ' ')}`);
  for (const field of WITNESS_FIELDS) {
    const answer = answers[field.id];
    if (answer !== undefined && !isBlank(answer)) lines.push(`${labels.fields[field.id]}: ${answer.trim()}`);
  }
  return lines.join('\n\n');
}

/**
 * Encrypts the notes in the text format of "Lock a message".
 * Throws `WeakPassphraseError` for a passphrase that the rule refuses.
 */
export function lockWitnessNotes(text: string, passphrase: string): Promise<string> {
  return encryptText(text, passphrase);
}
