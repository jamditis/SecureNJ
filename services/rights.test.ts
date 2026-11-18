import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { RAPID_RESPONSE_HOTLINE } from '../content/hotlines';
import { RIGHTS_CARD, RIGHTS_LINKS } from '../content/rightsCard';
import en from '../locales/en/rights';
import es from '../locales/es/rights';
import { CONTACT_MAX_LENGTH, contactRows, defaultContacts, isDefaultHotline, splitTemplate } from './rights';

/**
 * The script that wrote the content files computed these digests from the
 * strings of the old build (`content-verbatim.json`), not from the content
 * files. A digest is the SHA-256 of the JSON text of the value, with no
 * spaces, in UTF-8. If a test here fails, the content changed: do not update
 * the digest unless the source text itself has a new, reviewed version.
 */
const SOURCE_DIGESTS = {
  RIGHTS_CARD: 'bc2cc27e8178c225db8bb63f4b68dd9661c86722d7a90d451f459ade07b63bfa',
  RIGHTS_LINKS: '30d64dbff8afd08db2b146610317910d0e528043bebcdb60055407db21692aa9',
  RAPID_RESPONSE_HOTLINE: 'f257ab709f508abc83e00fa8b8e9599557db3c405d09338100066b3677bbdaa8',
};

const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');

describe('rights card content', () => {
  it('has the card text of the old build, byte for byte', () => {
    expect(digest(RIGHTS_CARD)).toBe(SOURCE_DIGESTS.RIGHTS_CARD);
  });

  it('has the outside links of the old build, byte for byte', () => {
    expect(digest(RIGHTS_LINKS)).toBe(SOURCE_DIGESTS.RIGHTS_LINKS);
  });

  it('has the hotline number, its name, and its source of the old build, byte for byte', () => {
    expect(digest(RAPID_RESPONSE_HOTLINE)).toBe(SOURCE_DIGESTS.RAPID_RESPONSE_HOTLINE);
  });

  it('has three situations with five, four, and two lines', () => {
    expect(RIGHTS_CARD.sections.map((section) => section.items.length)).toEqual([5, 4, 2]);
  });

  it('has no line with a space at an end or with a character that is not plain ASCII', () => {
    const lines = [
      RIGHTS_CARD.title,
      ...RIGHTS_CARD.sections.flatMap((section) => [section.heading, ...section.items]),
      ...Object.values(RIGHTS_CARD.contactLabels),
      RIGHTS_CARD.sourceLine,
    ];
    expect(lines).toHaveLength(19);
    for (const line of lines) expect(line).toMatch(/^[\x21-\x7e]([\x20-\x7e]*[\x21-\x7e])?$/);
  });

  it('links only to https addresses', () => {
    for (const url of [...Object.values(RIGHTS_LINKS), RAPID_RESPONSE_HOTLINE.sourceUrl]) expect(new URL(url).protocol).toBe('https:');
  });
});

describe('contact rows of the card', () => {
  it('starts with the hotline number and no other line', () => {
    expect(contactRows(defaultContacts())).toEqual([{ key: 'hotline', value: RAPID_RESPONSE_HOTLINE.number }]);
  });

  it('keeps the order hotline, lawyer, emergency contact', () => {
    expect(contactRows({ contact: '555-0101', lawyer: 'Legal group 555-0102', hotline: '555-0100' }).map((row) => row.key)).toEqual(['hotline', 'lawyer', 'contact']);
  });

  it('gives no row for an empty line', () => {
    expect(contactRows({ hotline: '', lawyer: '', contact: '555-0101' })).toEqual([{ key: 'contact', value: '555-0101' }]);
    expect(contactRows({ hotline: '', lawyer: '', contact: '' })).toEqual([]);
  });

  it('gives no row for a line of spaces, and removes spaces at the ends', () => {
    expect(contactRows({ hotline: '   ', lawyer: '\t', contact: '  555-0101 ' })).toEqual([{ key: 'contact', value: '555-0101' }]);
  });

  it('knows when the hotline line still holds the number of the old build', () => {
    expect(isDefaultHotline(defaultContacts().hotline)).toBe(true);
    expect(isDefaultHotline(` ${RAPID_RESPONSE_HOTLINE.number} `)).toBe(true);
    expect(isDefaultHotline('555-0100')).toBe(false);
    expect(isDefaultHotline('')).toBe(false);
  });

  it('has a length limit that the default number fits in', () => {
    expect(RAPID_RESPONSE_HOTLINE.number.length).toBeLessThan(CONTACT_MAX_LENGTH);
  });
});

describe('message with link positions', () => {
  it('splits a message at each name in braces', () => {
    expect(splitTemplate('{a}, with more on the {b}.')).toEqual([
      { kind: 'slot', name: 'a' },
      { kind: 'text', value: ', with more on the ' },
      { kind: 'slot', name: 'b' },
      { kind: 'text', value: '.' },
    ]);
  });

  it('gives one text part for a message with no name in braces', () => {
    expect(splitTemplate('Plain text')).toEqual([{ kind: 'text', value: 'Plain text' }]);
    expect(splitTemplate('')).toEqual([]);
  });

  it('loses no character of the message', () => {
    for (const template of [...Object.values(en), ...Object.values(es)]) {
      const joined = splitTemplate(template)
        .map((part) => (part.kind === 'text' ? part.value : `{${part.name}}`))
        .join('');
      expect(joined).toBe(template);
    }
  });
});

describe('text of the rights card page', () => {
  const slots = (template: string) =>
    splitTemplate(template)
      .flatMap((part) => (part.kind === 'slot' ? [part.name] : []))
      .sort();

  it('has the same link positions in Spanish as in English', () => {
    for (const key of Object.keys(en) as Array<keyof typeof en>) expect([key, slots(es[key])]).toEqual([key, slots(en[key])]);
  });

  it('has a Spanish text for each key, and none is the placeholder', () => {
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(es[key].trim()).not.toBe('');
      expect(es[key]).not.toBe('Marcador');
      expect(en[key]).not.toBe('Placeholder');
    }
  });
});
