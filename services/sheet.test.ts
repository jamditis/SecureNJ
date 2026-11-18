import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NOTE_EXAMPLE, SOURCE_DIGEST, SPANISH_LINKS, STARTER_LISTINGS } from '../content/resourceSheet';
import {
  DRAFT_KEY,
  LEGACY_DRAFT_KEY,
  LINK_PROTOCOLS,
  addStarters,
  clearDraft,
  contactHref,
  loadDraft,
  namedListings,
  parseDraft,
  removeListing,
  saveDraft,
  sheetText,
  updateListing,
  type Listing,
  type SheetDraft,
} from './sheet';

const listing = (patch: Partial<Listing> = {}): Listing => ({ id: 'a', name: 'Food pantry', offers: 'Groceries', when: 'Sat 9-12', contact: '973-555-0100', ...patch });
const draft = (patch: Partial<SheetDraft> = {}): SheetDraft => ({ title: 'Community resources', note: 'Checked today', entries: [listing()], ...patch });

/** IDs n1, n2, ... so that a test can see where a new ID was made. */
const counter = () => {
  let next = 0;
  return () => `n${++next}`;
};

/** Browser storage in memory. `failWrites` acts like a browser that is full or blocks storage. */
class MemoryStorage {
  values = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('reference content of the resource sheet', () => {
  // The digest that the generator printed when it read content-verbatim.json.
  // A change of a name, a phone number, or an address by hand fails this test.
  const DIGEST_OF_SOURCE = '7b4863ce3fb0a7ce42a120b3c3f9753b9ad279f03a4d38685b1bb1c3d8e90bbb';

  it('has the starter listings, the note example, and the links of the JSON source, with no change', () => {
    const content = JSON.stringify({ starters: STARTER_LISTINGS, noteExample: NOTE_EXAMPLE, spanishLinks: SPANISH_LINKS });
    const digest = createHash('sha256').update(content, 'utf8').digest('hex');
    expect(digest).toBe(DIGEST_OF_SOURCE);
    expect(SOURCE_DIGEST).toBe(DIGEST_OF_SOURCE);
  });

  // The JSON is not in the repository. Set SNJ_CONTENT_JSON to its path to compare each string with the source.
  const sourcePath = process.env.SNJ_CONTENT_JSON;
  it.skipIf(!sourcePath)('has starter listings that are equal to the listings in content-verbatim.json', () => {
    const source = JSON.parse(readFileSync(sourcePath ?? '', 'utf8'));
    expect(STARTER_LISTINGS).toEqual(source.resource_sheet.new_jersey_starters);
    expect(NOTE_EXAMPLE).toBe(source.resource_sheet.blocks.find((block: { id?: unknown }) => block.id === 'rs-note').placeholder);
    const numbers: string[] = source.hotlines_and_phone_numbers.occurrences
      .filter((occurrence: { region: string }) => occurrence.region === 'resource_sheet')
      .map((occurrence: { string: string }) => occurrence.string);
    const inStarters = STARTER_LISTINGS.flatMap((starter) => Object.values(starter));
    expect(numbers.length).toBeGreaterThan(0);
    for (const number of numbers) expect(inStarters).toContain(number);
    for (const link of SPANISH_LINKS) expect(JSON.stringify(source.rights_card.blocks)).toContain(JSON.stringify(link.url));
  });

  it('links to material in Spanish with web addresses only', () => {
    for (const link of SPANISH_LINKS) expect(new URL(link.url).protocol).toBe('https:');
  });
});

describe('listings', () => {
  it('puts only listings with a name on the sheet', () => {
    const entries = [listing(), listing({ id: 'b', name: '   ' }), listing({ id: 'c', name: '' })];
    expect(namedListings(entries).map((entry) => entry.id)).toEqual(['a']);
  });

  it('changes one field of one listing', () => {
    const entries = [listing(), listing({ id: 'b' })];
    expect(updateListing(entries, 'b', 'contact', '211')).toEqual([listing(), listing({ id: 'b', contact: '211' })]);
  });

  it('leaves one empty listing when the last listing is removed', () => {
    expect(removeListing([listing(), listing({ id: 'b' })], 'a')).toEqual([listing({ id: 'b' })]);
    expect(removeListing([listing()], 'a', counter())).toEqual([{ id: 'n1', name: '', offers: '', when: '', contact: '' }]);
  });

  it('adds the starters after the listings that have a name, and drops the listings without a name', () => {
    const entries = [listing({ id: 'empty', name: '' }), listing()];
    const result = addStarters(entries, STARTER_LISTINGS, counter());
    expect(result[0]).toEqual(listing());
    expect(result.slice(1).map(({ id: _id, ...content }) => content)).toEqual(STARTER_LISTINGS);
    expect(result.slice(1).map((entry) => entry.id)).toEqual(['n1', 'n2', 'n3']);
  });

  it('adds the starters a second time with new IDs', () => {
    const makeId = counter();
    const twice = addStarters(addStarters([], STARTER_LISTINGS, makeId), STARTER_LISTINGS, makeId);
    expect(twice).toHaveLength(2 * STARTER_LISTINGS.length);
    expect(new Set(twice.map((entry) => entry.id)).size).toBe(twice.length);
  });
});

describe('text version of the sheet', () => {
  it('has the title, the note, and one line for each listing, with one empty line between them', () => {
    const sheet = draft({ entries: [listing(), listing({ id: 'b', name: 'Clinic', offers: '', when: '', contact: 'https://clinic.example' })] });
    expect(sheetText(sheet)).toBe('Community resources\n\nChecked today\n\nFood pantry | Groceries | Sat 9-12 | 973-555-0100\n\nClinic | https://clinic.example');
  });

  it('leaves out an empty title, an empty note, and a listing without a name', () => {
    expect(sheetText(draft({ title: '', note: '', entries: [listing({ name: ' ', contact: 'secret' }), listing({ id: 'b', name: 'Clinic', offers: '', when: '', contact: '' })] }))).toBe('Clinic');
  });
});

describe('stored draft', () => {
  it('reads back the draft that it saved', () => {
    const storage = new MemoryStorage();
    expect(saveDraft(storage, draft())).toBe(true);
    expect(loadDraft(storage, 'Default')).toEqual(draft());
  });

  it('gives no draft when nothing is stored, or when the stored value is not a draft', () => {
    expect(parseDraft(null, 'Default')).toBeNull();
    expect(parseDraft('{broken', 'Default')).toBeNull();
    expect(parseDraft('null', 'Default')).toBeNull();
    expect(parseDraft('"text"', 'Default')).toBeNull();
    expect(parseDraft('[1,2]', 'Default')).toBeNull();
  });

  it('starts with one empty listing when the draft has no listings', () => {
    expect(parseDraft('{"title":"T","note":"N"}', 'Default', counter())).toEqual({ title: 'T', note: 'N', entries: [{ id: 'n1', name: '', offers: '', when: '', contact: '' }] });
    expect(parseDraft('{"entries":[]}', 'Default', counter())).toMatchObject({ title: 'Default', note: '', entries: [{ id: 'n1' }] });
  });

  it('repairs a draft with parts of a wrong type, so that the page cannot fail on it', () => {
    const raw = JSON.stringify({
      title: 7,
      note: { x: 1 },
      entries: [null, 'text', { id: 'a', name: 'Pantry', offers: 5, when: null }, { id: 'a', name: 'Same ID' }, { name: 'No ID' }, { id: 9, name: [] }],
    });
    const result = parseDraft(raw, 'Default', counter());
    expect(result).toEqual({
      title: 'Default',
      note: '',
      entries: [
        { id: 'a', name: 'Pantry', offers: '', when: '', contact: '' },
        { id: 'n1', name: 'Same ID', offers: '', when: '', contact: '' },
        { id: 'n2', name: 'No ID', offers: '', when: '', contact: '' },
        { id: 'n3', name: '', offers: '', when: '', contact: '' },
      ],
    });
    // The functions of the page work on the result.
    expect(() => sheetText(result as SheetDraft)).not.toThrow();
  });

  it('moves a draft of the first version of the site to the new key and removes the old key', () => {
    const storage = new MemoryStorage();
    storage.values.set(LEGACY_DRAFT_KEY, JSON.stringify(draft()));
    expect(loadDraft(storage, 'Default')).toEqual(draft());
    expect(storage.getItem(LEGACY_DRAFT_KEY)).toBeNull();
    expect(JSON.parse(storage.getItem(DRAFT_KEY) ?? '')).toEqual(draft());
    // The second read finds the draft under the new key.
    expect(loadDraft(storage, 'Default')).toEqual(draft());
  });

  it('uses the new key, which "erase this device" removes', () => {
    expect(DRAFT_KEY).toBe('snj.resourceSheet');
    expect(LEGACY_DRAFT_KEY).toBe('securenj-resource-sheet');
  });

  it('keeps the draft under the new key and removes an old draft when both are there', () => {
    const storage = new MemoryStorage();
    storage.values.set(DRAFT_KEY, JSON.stringify(draft({ title: 'New' })));
    storage.values.set(LEGACY_DRAFT_KEY, JSON.stringify(draft({ title: 'Old' })));
    expect(loadDraft(storage, 'Default')?.title).toBe('New');
    expect(storage.getItem(LEGACY_DRAFT_KEY)).toBeNull();
  });

  it('removes an old value that is not a draft', () => {
    const storage = new MemoryStorage();
    storage.values.set(LEGACY_DRAFT_KEY, '{broken');
    expect(loadDraft(storage, 'Default')).toBeNull();
    expect(storage.values.size).toBe(0);
  });

  it('keeps the old draft in place when the browser cannot write the new key', () => {
    const storage = new MemoryStorage();
    storage.values.set(LEGACY_DRAFT_KEY, JSON.stringify(draft()));
    storage.failWrites = true;
    expect(loadDraft(storage, 'Default')).toEqual(draft());
    expect(storage.getItem(LEGACY_DRAFT_KEY)).not.toBeNull();
  });

  it('reports a draft that the browser did not keep', () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    expect(saveDraft(storage, draft())).toBe(false);
    expect(saveDraft(null, draft())).toBe(false);
  });

  it('deletes the draft under the new key and under the old key', () => {
    const storage = new MemoryStorage();
    storage.values.set(DRAFT_KEY, JSON.stringify(draft()));
    storage.values.set(LEGACY_DRAFT_KEY, JSON.stringify(draft()));
    storage.values.set('other-site', 'stays');
    expect(clearDraft(storage)).toBe(true);
    expect(Array.from(storage.values.keys())).toEqual(['other-site']);
  });
});

describe('link for a contact', () => {
  it('makes a link from a web address, a phone number, and an email address', () => {
    expect(contactHref('https://www.example.org/help?x=1')).toBe('https://www.example.org/help?x=1');
    expect(contactHref('  http://example.org  ')).toBe('http://example.org/');
    expect(contactHref('HTTPS://Example.org/Path')).toBe('https://example.org/Path');
    expect(contactHref('1-800-308-0878')).toBe('tel:18003080878');
    expect(contactHref('+1 (973) 555-0100')).toBe('tel:+19735550100');
    expect(contactHref('211')).toBe('tel:211');
    expect(contactHref('tel:+19735550100')).toBe('tel:+19735550100');
    expect(contactHref('help@example.org')).toBe('mailto:help@example.org');
    expect(contactHref('mailto:help@example.org')).toBe('mailto:help@example.org');
  });

  it('makes no link from an address with a scheme that is not http, https, tel, or mailto', () => {
    const blocked = [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      '  javascript:alert(1)',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      '\u0001javascript:alert(1)',
      'javascript://example.org/%0Aalert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'blob:https://example.org/1',
      'ftp://example.org/',
      'sms:+19735550100',
      'javascript:alert(1)@example.org',
      'x@javascript:alert(1).org',
    ];
    for (const contact of blocked) expect(contactHref(contact), contact).toBeNull();
  });

  it('gives only addresses with an allowed scheme, for each kind of input', () => {
    const inputs = ['https://example.org', 'http:example.org', 'tel:211', 'mailto:a@example.org', 'a@example.org', '973-555-0100', 'https:javascript:alert(1)', 'mailto:javascript:alert(1)'];
    for (const contact of inputs) {
      const href = contactHref(contact);
      if (href !== null) expect(LINK_PROTOCOLS, contact).toContain(new URL(href).protocol);
    }
    expect([...LINK_PROTOCOLS].sort()).toEqual(['http:', 'https:', 'mailto:', 'tel:']);
  });

  it('leaves text that is not one complete address as plain text', () => {
    expect(contactHref('')).toBeNull();
    expect(contactHref('   ')).toBeNull();
    expect(contactHref('Dial 211 or nj211.org')).toBeNull();
    expect(contactHref('lsnj.org')).toBeNull();
    expect(contactHref('Call 973-555-0100 after 5')).toBeNull();
    expect(contactHref('https://')).toBeNull();
    expect(contactHref('12')).toBeNull();
    expect(contactHref('1234567890123456')).toBeNull();
    expect(contactHref('---')).toBeNull();
  });
});
