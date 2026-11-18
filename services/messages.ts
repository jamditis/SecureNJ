/**
 * The source text of the app, and the rules that a translation must pass.
 *
 * English is the source. UI text is in `locales/en/`, and reference text is
 * in `content/` (see `contentText.ts` for its keys). Each other language is
 * a file `locales/<code>.json` that a machine writes.
 */
import en from '../locales/en/index';
import { contentMessages } from './contentText';

/** Each key of the app, with its English text: UI text and reference text. */
export const SOURCE_MESSAGES: Readonly<Record<string, string>> = { ...en, ...contentMessages() };

/** The translated text of one language. A key with no entry shows in English. */
export type Translation = Readonly<Record<string, string | undefined>>;

const sorted = (found: RegExpMatchArray | null): string => [...(found ?? [])].sort().join(' ');

/** The slots of a message, for example `{name}`. The app puts a value or a link in each slot. */
export const slotsOf = (text: string): string => sorted(text.match(/\{\w+\}/g));

/** The numbers of a message, in Western digits: phone numbers, form numbers, dates, amounts. */
export const numbersOf = (text: string): string[] => text.match(/\d+/g) ?? [];

/**
 * True when the translation has each number of the English text, as many
 * times as the English text has it. A translation that changes a number can
 * send a reader to a wrong phone number. A translation can add a number: a
 * date such as "August 4" has the number of the month in some languages.
 */
function keepsNumbers(english: string, translated: string): boolean {
  const left = numbersOf(translated);
  return numbersOf(english).every((number) => {
    const index = left.indexOf(number);
    if (index === -1) return false;
    left.splice(index, 1);
    return true;
  });
}

export type TranslationProblem = 'empty' | 'slots' | 'numbers';

/**
 * Checks one translated message against its English text. Returns the
 * problem, or `null` when the translation is safe to show.
 * It cannot tell if the meaning is correct.
 */
export function translationProblem(english: string, translated: unknown): TranslationProblem | null {
  if (typeof translated !== 'string' || translated.trim() === '') return 'empty';
  if (slotsOf(english) !== slotsOf(translated)) return 'slots';
  if (!keepsNumbers(english, translated)) return 'numbers';
  return null;
}

/** The entries of a language file that are safe to show: a known key and a text that passes the check. */
export function usableTranslation(file: unknown, source: Readonly<Record<string, string>> = SOURCE_MESSAGES): Translation {
  const usable: Record<string, string> = {};
  if (typeof file !== 'object' || file === null) return usable;
  for (const [key, text] of Object.entries(file)) {
    if (Object.hasOwn(source, key) && translationProblem(source[key], text) === null) usable[key] = text as string;
  }
  return usable;
}
