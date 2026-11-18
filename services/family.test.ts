import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ANSWERS,
  FIRST_STEPS,
  HOTLINE_ITEM_ID,
  HOTLINE_NOTE,
  LANGUAGE_LINKS,
  LEARN_MORE,
  PLAN_SECTIONS,
} from '../content/familyPlan';
import { DecryptionError, WeakPassphraseError, bytesToBase64, decryptText } from './crypto';
import { NotAPlanError, PLAN_FILE_NAME, lockPlan, newPlan, parsePlan, serializePlan, setAnswer, unlockPlan } from './family';

const PASSPHRASE = 'maple river stone cloud forest lamp';
const ITEMS = PLAN_SECTIONS.flatMap((section) => section.items);

/** A file as the old build wrote it: base64 of salt, nonce, and ciphertext, with no version prefix. */
async function oldBuildFile(json: string, passphrase: string): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const material = await subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ciphertext = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(json)));
  const sealed = new Uint8Array(28 + ciphertext.length);
  sealed.set(salt, 0);
  sealed.set(iv, 16);
  sealed.set(ciphertext, 28);
  return bytesToBase64(sealed);
}

describe('family plan: reference content', () => {
  it('is the text of the old build, character for character', () => {
    // The generator script prints this digest. A change of one prompt, link, or number fails here.
    const content = {
      sections: PLAN_SECTIONS,
      firstSteps: FIRST_STEPS,
      learnMore: LEARN_MORE,
      defaults: DEFAULT_ANSWERS,
      hotlineNote: HOTLINE_NOTE,
      languageLinks: LANGUAGE_LINKS,
    };
    expect(createHash('sha256').update(JSON.stringify(content), 'utf8').digest('hex')).toBe('f9314b9cf40c350cab01271e9862ceefca8987a408599e51ad6e4eb8332e566e');
  });

  it('has the 14 questions of the old form in 4 sections, and 7 first steps', () => {
    expect(PLAN_SECTIONS.map((section) => section.items.map((item) => item.id))).toEqual([
      ['contact1', 'contact2', 'lawyer', 'hotline', 'consulate'],
      ['kids', 'pickup', 'care', 'health', 'others'],
      ['docs', 'alien', 'money'],
      ['wishes'],
    ]);
    expect(ITEMS.filter((item) => item.long).map((item) => item.id)).toEqual(['kids', 'pickup', 'care', 'health', 'others', 'docs', 'money', 'wishes']);
    expect(FIRST_STEPS).toHaveLength(7);
  });

  it('links only to pages with an https address', () => {
    const links = [...LEARN_MORE, ...HOTLINE_NOTE, ...LANGUAGE_LINKS].filter((part) => typeof part !== 'string');
    expect(links).toHaveLength(6);
    for (const link of links) expect(new URL(link.href).protocol).toBe('https:');
  });
});

describe('family plan: answers', () => {
  it('starts with the hotline number and no other answer', () => {
    expect(newPlan()).toEqual({ [HOTLINE_ITEM_ID]: '1-800-308-0878' });
    expect(ITEMS.some((item) => item.id === HOTLINE_ITEM_ID)).toBe(true);
  });

  it('gives a new object for each change and leaves the old one as it was', () => {
    const first = newPlan();
    const second = setAnswer(first, 'kids', 'Ana, Lincoln School');
    expect(second).toEqual({ hotline: '1-800-308-0878', kids: 'Ana, Lincoln School' });
    expect(first).toEqual({ hotline: '1-800-308-0878' });
    expect(newPlan()).toEqual({ hotline: '1-800-308-0878' });
  });

  it('writes the JSON of the old build: an object with the item ID as the key', () => {
    expect(serializePlan({ hotline: '1-800-308-0878', contact1: 'Rosa 555-0100' })).toBe('{"contact1":"Rosa 555-0100","hotline":"1-800-308-0878"}');
  });

  it('keeps an answer that the person emptied, so that the default number does not come back', () => {
    expect(parsePlan(serializePlan(setAnswer(newPlan(), 'hotline', '')))).toEqual({ hotline: '' });
  });
});

describe('family plan: content of a file is not trusted', () => {
  it('refuses text that is not JSON, and JSON that is not an object', () => {
    for (const text of ['', 'hello', 'null', '"a plan"', '42', '[]', '[{"hotline":"1"}]']) {
      expect(() => parsePlan(text), text).toThrow(NotAPlanError);
    }
  });

  it('refuses the file of a different tool, so that it does not empty the form', () => {
    expect(() => parsePlan('{}')).toThrow(NotAPlanError);
    expect(() => parsePlan('{"where":"Broad St","what":"Two officers went in."}')).toThrow(NotAPlanError);
    expect(() => parsePlan('{"hotline":5,"kids":null}')).toThrow(NotAPlanError);
  });

  it('keeps only the items of the form, and only text', () => {
    const text = '{"hotline":"555-0100","kids":["Ana"],"care":{"a":1},"tracker":"hidden","__proto__":{"polluted":"yes"},"constructor":"x","wishes":"Stay together"}';
    const plan = parsePlan(text);
    expect(plan).toEqual({ hotline: '555-0100', wishes: 'Stay together' });
    expect(Object.keys(plan)).toEqual(['hotline', 'wishes']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('does not write an unknown key into the next saved file', () => {
    expect(serializePlan({ hotline: '555-0100', tracker: 'hidden' })).toBe('{"hotline":"555-0100"}');
  });
});

describe('family plan: locked file', () => {
  const plan = { hotline: '1-800-308-0878', contact1: 'Rosa Diaz 555-0100', docs: 'Blue folder\nin the hall closet' };

  it('uses the file name of the old build', () => {
    expect(PLAN_FILE_NAME).toBe('family-plan.locked.txt');
  });

  it('opens again with the same passphrase', async () => {
    const file = await lockPlan(plan, PASSPHRASE);
    expect(await unlockPlan(file, PASSPHRASE)).toEqual(plan);
    // A text editor or a mail program can add a line break at the end.
    expect(await unlockPlan(`  ${file}\r\n`, PASSPHRASE)).toEqual(plan);
  });

  it('does not contain an answer, a question, or an item ID as plain text', async () => {
    const file = await lockPlan(plan, PASSPHRASE);
    for (const text of ['Rosa', '555-0100', '1-800-308-0878', 'Blue folder', 'contact1', 'hotline', btoa('Rosa Diaz'), btoa('{"contact1"')]) {
      expect(file).not.toContain(text);
    }
  });

  it('is text that the "Unlock" tab of "Lock a message" reads as the JSON of the plan', async () => {
    const file = await lockPlan(plan, PASSPHRASE);
    expect(file.startsWith('snj2.')).toBe(true);
    expect(JSON.parse(await decryptText(file, PASSPHRASE))).toEqual(plan);
  });

  it('does not open with a different passphrase', async () => {
    const file = await lockPlan(plan, PASSPHRASE);
    await expect(unlockPlan(file, 'maple river stone cloud forest lamb')).rejects.toBeInstanceOf(DecryptionError);
  });

  it('does not open a file that was changed', async () => {
    const file = await lockPlan(plan, PASSPHRASE);
    const changed = file.slice(0, 40) + (file[40] === 'A' ? 'B' : 'A') + file.slice(41);
    await expect(unlockPlan(changed, PASSPHRASE)).rejects.toBeInstanceOf(DecryptionError);
    await expect(unlockPlan('not a locked file', PASSPHRASE)).rejects.toBeInstanceOf(DecryptionError);
  });

  it('refuses a weak passphrase', async () => {
    await expect(lockPlan(plan, 'short')).rejects.toBeInstanceOf(WeakPassphraseError);
    await expect(lockPlan(plan, '')).rejects.toBeInstanceOf(WeakPassphraseError);
    await expect(lockPlan(plan, 'password password')).rejects.toBeInstanceOf(WeakPassphraseError);
  });

  it('opens a file that the old build saved', async () => {
    const file = await oldBuildFile('{"hotline":"1-800-308-0878","contact1":"Rosa Diaz 555-0100"}', PASSPHRASE);
    expect(await unlockPlan(file, PASSPHRASE)).toEqual({ hotline: '1-800-308-0878', contact1: 'Rosa Diaz 555-0100' });
  });

  it('refuses a locked file of a different tool, also with the right passphrase', async () => {
    const notes = await oldBuildFile('Witness notes\n\nExact place: Broad St', PASSPHRASE);
    await expect(unlockPlan(notes, PASSPHRASE)).rejects.toBeInstanceOf(NotAPlanError);
  });
});
