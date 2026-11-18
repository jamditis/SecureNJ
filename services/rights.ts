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
