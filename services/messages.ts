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
 * Parts of an English message that a translation must have with no change,
 * character for character:
 * - a number with hyphens, which is a phone number (1-800-308-0878);
 * - a form number (I-205);
 * - an address of a site or a name of a file (nj211.org, README.md, .env.local);
 * - a code span between backticks.
 */
const EXACT_PARTS = [/\d+(?:-\d+)+/g, /\b[A-Z]-\d+\b/g, /(?<![\w-])\.?[\w-]{2,}(?:\.[\w-]+)*\.[a-z]{2,}\b/gi, /`[^`]+`/g];

export const exactPartsOf = (text: string): string[] => EXACT_PARTS.flatMap((pattern) => text.match(pattern) ?? []);

/**
 * True when the text has the part and the part is not inside a longer
 * number or address: "1-800-308-0878-1" does not have "1-800-308-0878", and
 * "nj211.org.example.com" does not have "nj211.org".
 */
function hasExactPart(text: string, part: string): boolean {
  const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\w.-])${escaped}(?![\\w-]|\\.[\\w-])`).test(text);
}

/**
 * True when the translation has each number of the English text, as many
 * times as the English text has it, and adds no number of three digits or
 * more. A translation that changes or adds a number can send a reader to a
 * wrong phone number. A short number can be new: "August 4" has the number
 * of the month in some languages.
 */
function keepsNumbers(english: string, translated: string): boolean {
  const left = numbersOf(translated);
  const kept = numbersOf(english).every((number) => {
    const index = left.indexOf(number);
    if (index === -1) return false;
    left.splice(index, 1);
    return true;
  });
  return kept && left.every((number) => number.length <= 2);
}

/** The sentences between straight double quotation marks. */
const quotesOf = (text: string): string[] => (text.match(/"[^"]+"/g) ?? []).map((quote) => quote.slice(1, -1));

/**
 * In the rights card, a sentence in quotation marks is what a person says
 * to an agent, who speaks English. It must stay in English.
 */
const QUOTES_STAY_ENGLISH = /^content\.rights\./;

/** A character that a reader cannot see and that can change the order or the look of the text. */
const INVISIBLE = /\p{Cf}/u;

export type TranslationProblem = 'empty' | 'invisible' | 'slots' | 'numbers' | 'exact' | 'quotes';

/** What each problem means, for a message to the person or the agent who wrote the translation. */
export const PROBLEM_TEXT: Readonly<Record<TranslationProblem, string>> = {
  empty: 'the text is empty',
  invisible: 'the text has a character that a reader cannot see (a direction mark or a zero width character)',
  slots: 'the slots in braces are not the same as in the English text',
  numbers: 'a number of the English text is missing or changed, or the text adds a number of three digits or more',
  exact: 'a phone number, a form number, an address, a file name, or a code span of the English text is not there with no change',
  quotes: 'a sentence in quotation marks of the English text is not there in English',
};

/**
 * Checks one translated message against its English text. Returns the
 * problem, or `null` when the translation is safe to show.
 * It cannot tell if the meaning is correct.
 */
export function translationProblem(english: string, translated: unknown, key = ''): TranslationProblem | null {
  if (typeof translated !== 'string' || translated.trim() === '') return 'empty';
  if (INVISIBLE.test(translated)) return 'invisible';
  if (slotsOf(english) !== slotsOf(translated)) return 'slots';
  if (!keepsNumbers(english, translated)) return 'numbers';
  if (!exactPartsOf(english).every((part) => hasExactPart(translated, part))) return 'exact';
  if (QUOTES_STAY_ENGLISH.test(key) && !quotesOf(english).every((quote) => translated.includes(quote))) return 'quotes';
  return null;
}

/** The entries of a language file that are safe to show: a known key and a text that passes the check. */
export function usableTranslation(file: unknown, source: Readonly<Record<string, string>> = SOURCE_MESSAGES): Translation {
  const usable: Record<string, string> = {};
  if (typeof file !== 'object' || file === null) return usable;
  for (const [key, text] of Object.entries(file)) {
    if (Object.hasOwn(source, key) && translationProblem(source[key], text, key) === null) usable[key] = text as string;
  }
  return usable;
}
