/**
 * Logic for the resource sheet: the listings, the text version, the optional
 * draft in the browser, and the check of an address before it becomes a link.
 *
 * The sheet is on one device and does not sync. Nothing is stored unless the
 * person asks for a draft.
 */

export interface Listing {
  id: string;
  name: string;
  offers: string;
  when: string;
  contact: string;
}

export type ListingField = 'name' | 'offers' | 'when' | 'contact';
export type ListingContent = Pick<Listing, ListingField>;

export interface SheetDraft {
  title: string;
  note: string;
  entries: Listing[];
}

/** "Erase this device" removes each key that starts with `snj.`. */
export const DRAFT_KEY = 'snj.resourceSheet';
/** The key of the first version of the site. It is read one time and then removed. */
export const LEGACY_DRAFT_KEY = 'securenj-resource-sheet';

const LISTING_FIELDS: readonly ListingField[] = ['name', 'offers', 'when', 'contact'];

type MakeId = () => string;
const randomId: MakeId = () => crypto.randomUUID();

export const emptyListing = (makeId: MakeId = randomId): Listing => ({ id: makeId(), name: '', offers: '', when: '', contact: '' });

/** Only a listing with a name is on the sheet and in the text version. */
export const namedListings = (entries: readonly Listing[]): Listing[] => entries.filter((entry) => entry.name.trim() !== '');

export const updateListing = (entries: readonly Listing[], id: string, field: ListingField, value: string): Listing[] =>
  entries.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry));

/** The form always has one listing, so the last one is replaced by an empty one. */
export function removeListing(entries: readonly Listing[], id: string, makeId: MakeId = randomId): Listing[] {
  const rest = entries.filter((entry) => entry.id !== id);
  return rest.length > 0 ? rest : [emptyListing(makeId)];
}

/** Keeps the listings that have a name and adds the starters after them, each with a new ID. */
export const addStarters = (entries: readonly Listing[], starters: readonly ListingContent[], makeId: MakeId = randomId): Listing[] => [
  ...namedListings(entries),
  ...starters.map((starter) => ({ id: makeId(), name: starter.name, offers: starter.offers, when: starter.when, contact: starter.contact })),
];

/**
 * The text for a group chat: the title, the note, then one line for each
 * listing with a name. Empty parts are left out. One empty line is between
 * the parts.
 */
export function sheetText(sheet: SheetDraft): string {
  const lines = namedListings(sheet.entries).map((entry) => LISTING_FIELDS.map((field) => entry[field]).filter(Boolean).join(' | '));
  return [sheet.title, sheet.note, ...lines].filter(Boolean).join('\n\n');
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Reads a stored draft. The value comes from browser storage, which other
 * pages on the same web address can write, so each part is checked: a part
 * with a wrong type becomes empty, and each listing gets an ID that no other
 * listing has. Returns null if the value is not a draft.
 */
export function parseDraft(raw: string | null, defaultTitle: string, makeId: MakeId = randomId): SheetDraft | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(parsed)) return null;

  const used = new Set<string>();
  const entries: Listing[] = [];
  for (const item of Array.isArray(parsed.entries) ? parsed.entries : []) {
    if (!isObject(item)) continue;
    const id = typeof item.id === 'string' && item.id !== '' && !used.has(item.id) ? item.id : makeId();
    used.add(id);
    entries.push({ id, name: text(item.name), offers: text(item.offers), when: text(item.when), contact: text(item.contact) });
  }
  return {
    title: typeof parsed.title === 'string' ? parsed.title : defaultTitle,
    note: text(parsed.note),
    entries: entries.length > 0 ? entries : [emptyListing(makeId)],
  };
}

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Some browsers throw on access to storage, for example when a setting blocks it. */
export function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Returns false if the browser did not keep the draft. */
export function saveDraft(storage: DraftStorage | null, sheet: SheetDraft): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify({ title: sheet.title, note: sheet.note, entries: sheet.entries }));
    return true;
  } catch {
    return false;
  }
}

/** Removes the draft, and a draft of the first version of the site. Returns false if a draft could still be there. */
export function clearDraft(storage: DraftStorage | null): boolean {
  if (!storage) return true;
  try {
    storage.removeItem(DRAFT_KEY);
    storage.removeItem(LEGACY_DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the draft. A draft under the key of the first version of the site
 * moves to the new key, so that the person keeps the sheet and "erase this
 * device" finds it. The old key is removed when the draft is safe under the
 * new key, or when its value is not a draft. A draft under the new key wins.
 */
export function loadDraft(storage: DraftStorage | null, defaultTitle: string, makeId: MakeId = randomId): SheetDraft | null {
  if (!storage) return null;
  try {
    const current = parseDraft(storage.getItem(DRAFT_KEY), defaultTitle, makeId);
    const legacyRaw = storage.getItem(LEGACY_DRAFT_KEY);
    if (legacyRaw === null) return current;
    if (current) {
      storage.removeItem(LEGACY_DRAFT_KEY);
      return current;
    }
    const legacy = parseDraft(legacyRaw, defaultTitle, makeId);
    if (!legacy || saveDraft(storage, legacy)) storage.removeItem(LEGACY_DRAFT_KEY);
    return legacy;
  } catch {
    return null;
  }
}

/** The only kinds of address that the sheet shows as a link. */
export const LINK_PROTOCOLS: readonly string[] = ['http:', 'https:', 'tel:', 'mailto:'];

const EXPLICIT_LINK = /^(?:https?|tel|mailto):/i;
const EMAIL = /^[^\s@:/?#]+@[^\s@:/?#]+\.[^\s@:/?#]+$/;
const PHONE = /^\+?[\d\s().-]+$/;
// The shortest number is a code such as 211. The longest international number has 15 digits.
const PHONE_MIN_DIGITS = 3;
const PHONE_MAX_DIGITS = 15;

/** Returns the address in standard form, or null if it is not one of the allowed kinds. */
function allowedHref(candidate: string): string | null {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  return LINK_PROTOCOLS.includes(url.protocol) ? url.href : null;
}

/**
 * The link for a contact that a person typed, or null if the contact must
 * show as plain text. A contact becomes a link only if all of it is a web
 * address that starts with http: or https:, a tel: or mailto: address, an
 * email address, or a phone number. All other text, which includes an
 * address with a different scheme such as javascript:, stays plain text.
 *
 * A name without a scheme, such as example.org, is not made into a link: the
 * function would have to guess the full address.
 */
export function contactHref(contact: string): string | null {
  const value = contact.trim();
  if (value === '') return null;
  if (EXPLICIT_LINK.test(value)) return allowedHref(value);
  if (EMAIL.test(value)) return allowedHref(`mailto:${value}`);
  if (PHONE.test(value)) {
    const digits = value.replace(/\D/g, '');
    if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) return null;
    return allowedHref(`tel:${value.startsWith('+') ? '+' : ''}${digits}`);
  }
  return null;
}
