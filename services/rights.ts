/** Logic for the know-your-rights card. The card text is in `content/rightsCard.ts`. */
import { RAPID_RESPONSE_HOTLINE } from '../content/hotlines';

/** The three lines that a person can add to the card. Nothing saves them. */
export interface CardContacts {
  hotline: string;
  lawyer: string;
  contact: string;
}

export type ContactKey = keyof CardContacts;

/** The order of the rows on the card. */
export const CONTACT_KEYS: readonly ContactKey[] = ['hotline', 'lawyer', 'contact'];

/** A longer line does not fit on a card that a person cuts out. */
export const CONTACT_MAX_LENGTH = 120;

/** The card page opens with the hotline filled in. The other two lines are empty. */
export const defaultContacts = (): CardContacts => ({ hotline: RAPID_RESPONSE_HOTLINE.number, lawyer: '', contact: '' });

export interface ContactRow {
  key: ContactKey;
  value: string;
}

/**
 * The rows that the card shows. A line with no text, or with spaces only,
 * gives no row, so the card has no label with an empty value.
 */
export function contactRows(contacts: CardContacts): ContactRow[] {
  return CONTACT_KEYS.map((key) => ({ key, value: contacts[key].trim() })).filter((row) => row.value !== '');
}

/** True while the hotline line still holds the number that the page started with. */
export const isDefaultHotline = (value: string): boolean => value.trim() === RAPID_RESPONSE_HOTLINE.number;

export type TemplatePart = { kind: 'text'; value: string } | { kind: 'slot'; name: string };

/**
 * Splits a message at each `{name}`, so that a component can put a link in
 * that position. The order of the words then stays in the locale file.
 */
export function splitTemplate(template: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let last = 0;
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    if (match.index > last) parts.push({ kind: 'text', value: template.slice(last, match.index) });
    parts.push({ kind: 'slot', name: match[1] });
    last = match.index + match[0].length;
  }
  if (last < template.length) parts.push({ kind: 'text', value: template.slice(last) });
  return parts;
}

/** The sentences between straight double quotation marks in a line of the English card. */
export const englishQuotes = (englishLine: string): string[] => (englishLine.match(/"[^"]+"/g) ?? []).map((quote) => quote.slice(1, -1));

/**
 * Splits a translated card line at each sentence that stays in English, so
 * that the component can mark its language and its direction. In a right to
 * left line, an English sentence with no mark shows its last period first.
 */
export function splitAtEnglish(line: string, english: readonly string[]): { text: string; english: boolean }[] {
  const parts: { text: string; english: boolean }[] = [];
  let rest = line;
  for (;;) {
    let first = -1;
    let found = '';
    for (const sentence of english) {
      const index = sentence === '' ? -1 : rest.indexOf(sentence);
      if (index !== -1 && (first === -1 || index < first)) {
        first = index;
        found = sentence;
      }
    }
    if (first === -1) break;
    if (first > 0) parts.push({ text: rest.slice(0, first), english: false });
    parts.push({ text: found, english: true });
    rest = rest.slice(first + found.length);
  }
  if (rest !== '' || parts.length === 0) parts.push({ text: rest, english: false });
  return parts;
}
