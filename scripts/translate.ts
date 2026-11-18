/**
 * Keeps the translation files in step with the English text.
 *
 *   npm run translate              list the text that needs a translation
 *   npm run translate -- --lint    list the faults in the translation files
 *   npm run translate -- --prune   remove each translation of an English text that changed or is gone
 *   npm run translate -- --stamp   mark each new translation as made from the current English text
 *
 * This script does not translate. The agent or the person who changes the
 * English text writes the translations in the same pull request. A message
 * with no translation shows in English, so a missing translation does not
 * stop a build.
 *
 * Files for a language with the code `xx`:
 * - `locales/xx.json`: key to translated text.
 * - `locales/xx.stamp.json`: key to a short hash of the English text that the
 *   translation was made from.
 *
 * A translation is stale when the hash in its stamp is different from the
 * hash of the English text: the English text changed after the translation
 * was made. A stale translation is a fault, because it can say something
 * that the English text no longer says.
 *
 * To change English text that has translations:
 * 1. Change the English text.
 * 2. Run `npm run translate -- --prune`. The stale translations go away.
 * 3. Write the new translations in each `locales/xx.json`.
 * 4. Run `npm run translate -- --stamp`.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '../services/i18n';
import { SOURCE_MESSAGES, translationProblem } from '../services/messages';

type Texts = Record<string, string>;
type Source = Readonly<Record<string, string>>;

/** Each language of the app that is not English. */
export const TARGETS: readonly string[] = Object.keys(LOCALES).filter((code) => code !== 'en');

export const stampOf = (english: string): string => createHash('sha256').update(english).digest('hex').slice(0, 12);

export interface LanguageFiles {
  text: Texts;
  stamps: Texts;
}

const isStale = (source: Source, files: LanguageFiles, key: string): boolean =>
  files.stamps[key] !== undefined && files.stamps[key] !== stampOf(source[key]);

/** The keys of the app that have no translation. They show in English. */
export const missingKeys = (source: Source, files: LanguageFiles): string[] => Object.keys(source).filter((key) => files.text[key] === undefined);

/**
 * The faults of the files of one language: an unknown key, a text that
 * fails the check, a text with no stamp, a stale text.
 */
export function lintLanguage(source: Source, files: LanguageFiles): string[] {
  const faults: string[] = [];
  for (const [key, text] of Object.entries(files.text)) {
    if (!Object.hasOwn(source, key)) {
      faults.push(`${key}: the app has no such key. Run "npm run translate -- --prune"`);
      continue;
    }
    const problem = translationProblem(source[key], text);
    if (problem === 'empty') faults.push(`${key}: the text is empty`);
    else if (problem) faults.push(`${key}: ${problem} are different from the English text`);
    if (files.stamps[key] === undefined) faults.push(`${key}: no stamp. Run "npm run translate -- --stamp"`);
    else if (isStale(source, files, key)) faults.push(`${key}: the English text changed after this translation. Run "npm run translate -- --prune", then translate it again`);
  }
  for (const key of Object.keys(files.stamps)) {
    if (files.text[key] === undefined) faults.push(`${key}: a stamp with no text. Run "npm run translate -- --prune"`);
  }
  return faults;
}

/**
 * Removes the translations that are stale and the entries of keys that the
 * app no longer has, and puts the keys in the order of the source.
 * A text with no stamp stays: it is a new translation.
 */
export function prune(source: Source, files: LanguageFiles): LanguageFiles {
  const text: Texts = {};
  const stamps: Texts = {};
  for (const key of Object.keys(source)) {
    if (typeof files.text[key] !== 'string' || isStale(source, files, key)) continue;
    text[key] = files.text[key];
    if (files.stamps[key] !== undefined) stamps[key] = files.stamps[key];
  }
  return { text, stamps };
}

/**
 * Gives a stamp to each text that has none. It does not change a stamp that
 * exists: a stale text must stay a fault until `prune` removes it.
 */
export function stampNew(source: Source, files: LanguageFiles): LanguageFiles {
  const text: Texts = {};
  const stamps: Texts = {};
  for (const key of Object.keys(source)) {
    if (typeof files.text[key] !== 'string') continue;
    text[key] = files.text[key];
    stamps[key] = files.stamps[key] ?? stampOf(source[key]);
  }
  // An entry of an unknown key stays, so that the lint can report it.
  for (const key of Object.keys(files.text)) if (!Object.hasOwn(source, key)) text[key] = files.text[key];
  return { text, stamps };
}

// ---------------------------------------------------------------- files

const readJson = (path: string): Texts => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Texts) : {});
const writeJson = (path: string, value: Texts) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

export function readLanguage(dir: string, code: string): LanguageFiles {
  return { text: readJson(join(dir, `${code}.json`)), stamps: readJson(join(dir, `${code}.stamp.json`)) };
}

export function writeLanguage(dir: string, code: string, files: LanguageFiles): void {
  writeJson(join(dir, `${code}.json`), files.text);
  writeJson(join(dir, `${code}.stamp.json`), files.stamps);
}

// ---------------------------------------------------------------- commands

export interface Options {
  dir?: string;
  source?: Source;
  targets?: readonly string[];
  log?: (line: string) => void;
}

export async function main(args: readonly string[], options: Options = {}): Promise<number> {
  const dir = options.dir ?? 'locales';
  const source = options.source ?? SOURCE_MESSAGES;
  const targets = options.targets ?? TARGETS;
  const log = options.log ?? console.log;
  const mode = args[0] ?? '--check';

  if (mode === '--stamp' || mode === '--prune') {
    const change = mode === '--stamp' ? stampNew : prune;
    for (const code of targets) writeLanguage(dir, code, change(source, readLanguage(dir, code)));
    log(mode === '--stamp' ? 'Each new translation now has a stamp.' : 'Stale and unknown translations are removed.');
    return 0;
  }

  if (mode === '--lint') {
    let faults = 0;
    for (const code of targets) {
      for (const line of lintLanguage(source, readLanguage(dir, code))) {
        log(`${code}: ${line}`);
        faults += 1;
      }
    }
    log(faults === 0 ? 'No fault in the translation files.' : `${faults} faults.`);
    return faults === 0 ? 0 : 1;
  }

  if (mode === '--check') {
    const total = Object.keys(source).length;
    for (const code of targets) {
      const missing = missingKeys(source, readLanguage(dir, code));
      log(`${code}: ${missing.length} of ${total} messages have no translation and show in English`);
      for (const key of missing.slice(0, 20)) log(`  ${key}`);
      if (missing.length > 20) log(`  and ${missing.length - 20} more`);
    }
    return 0;
  }

  log(`Unknown argument: ${mode}`);
  return 2;
}
