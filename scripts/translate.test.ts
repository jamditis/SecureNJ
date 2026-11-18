import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LOCALES } from '../services/i18n';
import { SOURCE_MESSAGES } from '../services/messages';
import { TARGETS, applyWork, lintLanguage, main, pendingKeys, prune, readLanguage, stampOf, workFor, type LanguageFiles, type WorkFile } from './translate';

const source = { hello: 'Hello {name}', phone: 'Call 211', bye: 'Goodbye' };

/** Files in which `hello` and `phone` have a current translation. */
const current = (): LanguageFiles => ({
  text: { hello: 'Hola {name}', phone: 'Llama al 211' },
  stamps: { hello: stampOf(source.hello), phone: stampOf(source.phone) },
});

/** Fills the work file as a translator does. */
const fill = (work: WorkFile, translations: Record<string, string>): WorkFile =>
  Object.fromEntries(Object.entries(work).map(([key, item]) => [key, { ...item, translation: translations[key] ?? '' }]));

describe('stamp', () => {
  it('is the same for the same English text, and different after a change', () => {
    expect(stampOf('Call 211')).toBe(stampOf('Call 211'));
    expect(stampOf('Call 211')).not.toBe(stampOf('Call 311'));
    expect(stampOf('Call 211')).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('lint of the files of a language', () => {
  it('finds no fault in files that are current, and lists the keys that need a translation', () => {
    expect(lintLanguage(source, current())).toEqual([]);
    expect(pendingKeys(source, current())).toEqual(['bye']);
  });

  it('finds a stale translation when the check of the text alone finds nothing', () => {
    const changed = { ...source, hello: 'Hello {name}, do not open the door' };
    const faults = lintLanguage(changed, current());
    expect(faults).toHaveLength(1);
    expect(faults[0].startsWith('hello: the English text changed after this translation')).toBe(true);
    expect(pendingKeys(changed, current())).toEqual(['hello', 'bye']);
  });

  it('finds a text with no stamp, an unknown key, an unsafe text, and a stamp with no text', () => {
    const files = current();
    files.text.bye = 'Adiós';
    files.text.gone = 'x';
    files.text.hello = 'Hola';
    files.stamps.nothing = 'abc';
    const faults = lintLanguage(source, files);
    expect(faults.some((fault) => fault.startsWith('bye: no stamp'))).toBe(true);
    expect(faults.some((fault) => fault.startsWith('gone: the app has no such key'))).toBe(true);
    expect(faults.some((fault) => fault.startsWith('hello: the slots in braces'))).toBe(true);
    expect(faults.some((fault) => fault.startsWith('nothing: a stamp with no text'))).toBe(true);
  });

  // The stamp file can be lost. Then no translation can be shown to be current.
  it('finds a fault for each text when the stamp file is gone', () => {
    const faults = lintLanguage(source, { text: current().text, stamps: {} });
    expect(faults.map((fault) => fault.split(':')[0])).toEqual(['hello', 'phone']);
  });
});

describe('prune', () => {
  it('removes a stale translation, a text with no stamp, and an unknown key, and keeps a current one', () => {
    const files = current();
    files.text.bye = 'Adiós';
    files.text.gone = 'x';
    files.stamps.gone = 'abc';
    const changed = { ...source, phone: 'Call 311' };
    const pruned = prune(changed, files);
    expect(pruned).toEqual({ text: { hello: 'Hola {name}' }, stamps: { hello: stampOf(source.hello) } });
    expect(lintLanguage(changed, pruned)).toEqual([]);
  });
});

describe('work file', () => {
  it('has each key that needs a translation, with the English text and the old translation', () => {
    const changed = { ...source, phone: 'Call 311' };
    expect(workFor(changed, current())).toEqual({
      phone: { english: 'Call 311', previous: 'Llama al 211', translation: '' },
      bye: { english: 'Goodbye', translation: '' },
    });
  });

  it('applies a translation, writes its stamp, and keeps the order of the source', () => {
    const result = applyWork(source, current(), fill(workFor(source, current()), { bye: 'Adiós' }));
    expect(result.applied).toEqual(['bye']);
    expect(result.refused).toEqual([]);
    expect(result.left).toEqual({});
    expect(Object.keys(result.files.text)).toEqual(['hello', 'phone', 'bye']);
    expect(result.files.stamps.bye).toBe(stampOf('Goodbye'));
    expect(lintLanguage(source, result.files)).toEqual([]);
  });

  it('keeps an entry with no translation in the work file, and does not refuse it', () => {
    const work = workFor(source, current());
    const result = applyWork(source, current(), work);
    expect(result.applied).toEqual([]);
    expect(result.refused).toEqual([]);
    expect(result.left).toEqual(work);
  });

  // The translator read version 1 of the English text. Then the English text
  // changed (a second edit, a rebase). The old translation must not get the
  // stamp of version 2.
  it('refuses a translation of an English text that changed after the work file was written', () => {
    const v1 = { ...source, bye: 'Open the door only for a warrant' };
    const v2 = { ...source, bye: 'Do not open the door, even for a warrant' };
    const work = fill(workFor(v1, current()), { bye: 'Abre la puerta solo con una orden' });
    const result = applyWork(v2, current(), work);
    expect(result.applied).toEqual([]);
    expect(result.refused.map((item) => item.key)).toEqual(['bye']);
    expect(result.files.text.bye).toBeUndefined();
    expect(result.files.stamps.bye).toBeUndefined();
    expect(pendingKeys(v2, result.files)).toEqual(['bye']);
  });

  it('refuses a translation that fails the check, and says why', () => {
    const work = fill(workFor({ ...source, bye: 'Call 1-800-308-0878' }, current()), { bye: 'Llama al 1-800-308-0879' });
    const result = applyWork({ ...source, bye: 'Call 1-800-308-0878' }, current(), work);
    expect(result.applied).toEqual([]);
    expect(result.refused[0].key).toBe('bye');
    expect(result.refused[0].reason).toContain('number');
    expect(Object.keys(result.left)).toEqual(['bye']);
  });

  it('refuses an entry for a key that the app does not have', () => {
    const result = applyWork(source, current(), { gone: { english: 'x', translation: 'y' } });
    expect(result.refused).toEqual([{ key: 'gone', reason: 'the app has no such key' }]);
    expect(result.files.text.gone).toBeUndefined();
  });

  it('replaces a stale translation', () => {
    const changed = { ...source, phone: 'Call 311' };
    const result = applyWork(changed, current(), fill(workFor(changed, current()), { phone: 'Llama al 311', bye: 'Adiós' }));
    expect(result.files.text.phone).toBe('Llama al 311');
    expect(lintLanguage(changed, result.files)).toEqual([]);
  });
});

describe('command', () => {
  let dir: string;
  let workDir: string;
  const lines: string[] = [];
  const run = (args: string[], custom: Record<string, string> = source) => main(args, { dir, workDir, source: custom, targets: ['xx'], log: (line) => lines.push(line) });
  const read = <T = Record<string, string>>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;
  const workPath = () => join(workDir, 'xx.json');
  const translate = (translations: Record<string, string>) => writeFileSync(workPath(), JSON.stringify(fill(read<WorkFile>(workPath()), translations)));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'snj-translate-'));
    workDir = join(dir, 'work');
    lines.length = 0;
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('goes from no translation to no fault with "--todo" and "--apply"', async () => {
    expect(await run([])).toBe(0);
    expect(lines[0]).toBe('xx: 3 of 3 messages need a translation');
    expect(await run(['--todo'])).toBe(0);
    translate({ hello: 'Hola {name}', phone: 'Llama al 211', bye: 'Adiós' });
    expect(await run(['--apply'])).toBe(0);
    expect(read(join(dir, 'xx.json'))).toEqual({ hello: 'Hola {name}', phone: 'Llama al 211', bye: 'Adiós' });
    expect(await run(['--lint'])).toBe(0);
    // A work file with nothing left is removed.
    expect(existsSync(workPath())).toBe(false);
  });

  it('fails the apply and keeps the entry when a translation is refused', async () => {
    await run(['--todo']);
    translate({ hello: 'Hola', phone: 'Llama al 211' });
    expect(await run(['--apply'])).toBe(1);
    expect(read(join(dir, 'xx.json'))).toEqual({ phone: 'Llama al 211' });
    expect(Object.keys(read(workPath()))).toEqual(['hello', 'bye']);
    expect(lines.some((line) => line.includes('refused hello'))).toBe(true);
  });

  it('cannot make a text current that a person put in the language file by hand', async () => {
    writeFileSync(join(dir, 'xx.json'), JSON.stringify({ hello: 'Hola {name}' }));
    expect(await run(['--lint'])).toBe(1);
    // No command gives a stamp to that text. The work file asks for it again.
    await run(['--todo']);
    expect(read<WorkFile>(workPath()).hello).toEqual({ english: 'Hello {name}', previous: 'Hola {name}', translation: '' });
    await run(['--apply']);
    expect(await run(['--lint'])).toBe(1);
  });

  it('goes from a change of the English text back to no fault', async () => {
    await run(['--todo']);
    translate({ hello: 'Hola {name}', phone: 'Llama al 211', bye: 'Adiós' });
    await run(['--apply']);
    const changed = { ...source, hello: 'Hello {name}, welcome' };
    expect(await run(['--lint'], changed)).toBe(1);
    await run(['--todo'], changed);
    expect(Object.keys(read(workPath()))).toEqual(['hello']);
    translate({ hello: 'Hola {name}, te damos la bienvenida' });
    expect(await run(['--apply'], changed)).toBe(0);
    expect(await run(['--lint'], changed)).toBe(0);
  });

  it('shows the English text again after "--prune", with no fault', async () => {
    await run(['--todo']);
    translate({ hello: 'Hola {name}', phone: 'Llama al 211', bye: 'Adiós' });
    await run(['--apply']);
    const changed = { ...source, hello: 'Hello {name}, welcome' };
    await run(['--prune'], changed);
    expect(read(join(dir, 'xx.json'))).toEqual({ phone: 'Llama al 211', bye: 'Adiós' });
    expect(await run(['--lint'], changed)).toBe(0);
  });

  it('refuses an unknown argument, and has no command that only writes stamps', async () => {
    expect(await run(['--translate-all'])).toBe(2);
    expect(await run(['--stamp'])).toBe(2);
  });
});

describe('translation files of the app', () => {
  it('has a file for each language of the app that is not English', () => {
    expect([...TARGETS].sort()).toEqual(Object.keys(LOCALES).filter((code) => code !== 'en').sort());
    for (const code of TARGETS) expect([code, existsSync(`locales/${code}.json`), existsSync(`locales/${code}.stamp.json`)]).toEqual([code, true, true]);
  });

  // This is the check that stops a stale translation of a safety text.
  it.each(TARGETS)('has no fault in the files for %s', (code) => {
    expect(lintLanguage(SOURCE_MESSAGES, readLanguage('locales', code))).toEqual([]);
  });
});
