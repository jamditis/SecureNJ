import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SOURCE_MESSAGES } from '../services/messages';
import { TARGETS, lintLanguage, main, missingKeys, prune, readLanguage, stampNew, stampOf } from './translate';

const source = { hello: 'Hello {name}', phone: 'Call 211', bye: 'Goodbye' };

describe('stamps', () => {
  it('gives the same stamp for the same English text, and a different one after a change', () => {
    expect(stampOf('Call 211')).toBe(stampOf('Call 211'));
    expect(stampOf('Call 211')).not.toBe(stampOf('Call 311'));
    expect(stampOf('Call 211')).toMatch(/^[0-9a-f]{12}$/);
  });

  it('gives a stamp to a new text and does not change a stamp that exists', () => {
    const files = { text: { hello: 'Hola {name}', phone: 'Llama al 211' }, stamps: { phone: 'old-stamp' } };
    const stamped = stampNew(source, files);
    expect(stamped.stamps).toEqual({ hello: stampOf(source.hello), phone: 'old-stamp' });
    expect(stamped.text).toEqual(files.text);
  });

  it('puts the keys in the order of the source', () => {
    const stamped = stampNew(source, { text: { bye: 'Adiós', hello: 'Hola {name}' }, stamps: {} });
    expect(Object.keys(stamped.text)).toEqual(['hello', 'bye']);
    expect(Object.keys(stamped.stamps)).toEqual(['hello', 'bye']);
  });
});

describe('lint of the files of a language', () => {
  const good = () => stampNew(source, { text: { hello: 'Hola {name}', phone: 'Llama al 211' }, stamps: {} });

  it('finds no fault in files that are current, and lists the keys with no translation', () => {
    expect(lintLanguage(source, good())).toEqual([]);
    expect(missingKeys(source, good())).toEqual(['bye']);
  });

  it('finds a translation of an English text that changed', () => {
    const changed = { ...source, phone: 'Call 311' };
    const faults = lintLanguage(changed, good());
    // Two faults: the number is different, and the stamp is stale.
    expect(faults.some((fault) => fault.startsWith('phone: the English text changed'))).toBe(true);
    expect(faults.some((fault) => fault.startsWith('phone: numbers'))).toBe(true);
  });

  it('finds a stale translation when the check of the text alone finds nothing', () => {
    const changed = { ...source, hello: 'Hello {name}, do not open the door' };
    expect(lintLanguage(changed, good())).toEqual([
      'hello: the English text changed after this translation. Run "npm run translate -- --prune", then translate it again',
    ]);
  });

  it('finds a text with no stamp, an unknown key, an unsafe text, and a stamp with no text', () => {
    const files = good();
    files.text.bye = 'Adiós';
    files.text.gone = 'x';
    files.text.hello = 'Hola';
    files.stamps.nothing = 'abc';
    const faults = lintLanguage(source, files);
    expect(faults.some((fault) => fault.startsWith('bye: no stamp'))).toBe(true);
    expect(faults.some((fault) => fault.startsWith('gone: the app has no such key'))).toBe(true);
    expect(faults.some((fault) => fault.startsWith('hello: slots'))).toBe(true);
    expect(faults.some((fault) => fault.startsWith('nothing: a stamp with no text'))).toBe(true);
  });
});

describe('prune', () => {
  it('removes a stale translation and an unknown key, and keeps a current one and a new one', () => {
    const files = stampNew(source, { text: { hello: 'Hola {name}', phone: 'Llama al 211' }, stamps: {} });
    files.text.bye = 'Adiós';
    files.text.gone = 'x';
    files.stamps.gone = 'abc';
    const changed = { ...source, phone: 'Call 311' };
    const pruned = prune(changed, files);
    expect(pruned.text).toEqual({ hello: 'Hola {name}', bye: 'Adiós' });
    expect(pruned.stamps).toEqual({ hello: stampOf(source.hello) });
    expect(lintLanguage(changed, stampNew(changed, pruned))).toEqual([]);
  });
});

describe('command', () => {
  let dir: string;
  const lines: string[] = [];
  const run = (args: string[], custom: Record<string, string> = source) => main(args, { dir, source: custom, targets: ['xx'], log: (line) => lines.push(line) });
  const read = (name: string) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as Record<string, string>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'snj-translate-'));
    lines.length = 0;
    writeFileSync(join(dir, 'xx.json'), JSON.stringify({ hello: 'Hola {name}', phone: 'Llama al 211' }));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('fails the lint until the new text has a stamp', async () => {
    expect(await run(['--lint'])).toBe(1);
    expect(await run(['--stamp'])).toBe(0);
    expect(await run(['--lint'])).toBe(0);
    expect(read('xx.stamp.json')).toEqual({ hello: stampOf(source.hello), phone: stampOf(source.phone) });
  });

  it('lists the keys with no translation and does not fail', async () => {
    expect(await run([])).toBe(0);
    expect(lines).toEqual(['xx: 1 of 3 messages have no translation and show in English', '  bye']);
  });

  it('goes from a change of the English text back to no fault with prune, a new text, and stamp', async () => {
    await run(['--stamp']);
    const changed = { ...source, hello: 'Hello {name}, welcome' };
    expect(await run(['--lint'], changed)).toBe(1);
    // A stamp alone must not hide the stale text.
    await run(['--stamp'], changed);
    expect(await run(['--lint'], changed)).toBe(1);
    await run(['--prune'], changed);
    expect(read('xx.json')).toEqual({ phone: 'Llama al 211' });
    writeFileSync(join(dir, 'xx.json'), JSON.stringify({ ...read('xx.json'), hello: 'Hola {name}, te damos la bienvenida' }));
    await run(['--stamp'], changed);
    expect(await run(['--lint'], changed)).toBe(0);
  });

  it('refuses an unknown argument', async () => {
    expect(await run(['--translate-all'])).toBe(2);
  });
});

describe('translation files of the app', () => {
  it('has a file for each language of the app that is not English', () => {
    expect([...TARGETS].sort()).toEqual(['ar', 'es', 'ht', 'pt', 'zh']);
  });

  // This is the check that stops a stale translation of a safety text.
  it.each(TARGETS)('has no fault in the files for %s', (code) => {
    expect(lintLanguage(SOURCE_MESSAGES, readLanguage('locales', code))).toEqual([]);
  });
});
