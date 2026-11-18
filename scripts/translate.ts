/**
 * Keeps the translation files in step with the English text.
 *
 *   npm run translate              list the text that needs a translation
 *   npm run translate -- --todo    write a work file for each language with the text to translate
 *   npm run translate -- --apply   put the translations of the work files into the language files
 *   npm run translate -- --lint    list the faults in the translation files
 *   npm run translate -- --prune   remove each translation of an English text that changed or is gone
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
 * - `.translate/xx.json`: the work file. It is not in the repository.
 *
 * A translation is stale when the hash in its stamp is different from the
 * hash of the English text: the English text changed after the translation
 * was made. A stale translation is a fault, because it can say something
 * that the English text no longer says.
 *
 * To translate new or changed English text:
 * 1. Change the English text.
 * 2. Run `npm run translate -- --todo`. Each work file gets the keys that
 *    need a translation, with the English text.
 * 3. Write each translation in the work files, in the field `translation`.
 * 4. Run `npm run translate -- --apply`.
 *
 * Only `--apply` writes a stamp, and only when the English text in the work
 * file is still the English text of the app. So a stamp says which English
 * text the translator read. No command marks an old translation as current.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '../services/i18n';
import { PROBLEM_TEXT, SOURCE_MESSAGES, translationProblem } from '../services/messages';

type Texts = Record<string, string>;
type Source = Readonly<Record<string, string>>;

/** Each language of the app that is not English. */
export const TARGETS: readonly string[] = Object.keys(LOCALES).filter((code) => code !== 'en');

export const stampOf = (english: string): string => createHash('sha256').update(english).digest('hex').slice(0, 12);

export interface LanguageFiles {
  text: Texts;
  stamps: Texts;
}

/** One entry of a work file. */
export interface WorkItem {
  /** The English text at the time the work file was written. */
  english: string;
  /** The translation of an older English text, as a help for the translator. */
  previous?: string;
  /** The translator writes the new text here. */
  translation: string;
}
export type WorkFile = Record<string, WorkItem>;

const isStale = (source: Source, files: LanguageFiles, key: string): boolean => files.stamps[key] !== stampOf(source[key]);

/**
 * The keys of the app that need a translation: the keys with no text, and
 * the keys with a stale text.
 */
export const pendingKeys = (source: Source, files: LanguageFiles): string[] =>
  Object.keys(source).filter((key) => typeof files.text[key] !== 'string' || isStale(source, files, key));

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
    const problem = translationProblem(source[key], text, key);
    if (problem) faults.push(`${key}: ${PROBLEM_TEXT[problem]}`);
    if (files.stamps[key] === undefined) faults.push(`${key}: no stamp. Only "npm run translate -- --apply" writes a stamp: translate the text again through a work file`);
    else if (isStale(source, files, key)) faults.push(`${key}: the English text changed after this translation. Translate it again ("--todo", then "--apply"), or run "--prune" to show the English text`);
  }
  for (const key of Object.keys(files.stamps)) {
    if (files.text[key] === undefined) faults.push(`${key}: a stamp with no text. Run "npm run translate -- --prune"`);
  }
  return faults;
}

/** Puts the keys in the order of the source, and removes the entries of keys that the app does not have. */
function inSourceOrder(source: Source, files: LanguageFiles): LanguageFiles {
  const text: Texts = {};
  const stamps: Texts = {};
  for (const key of Object.keys(source)) {
    if (typeof files.text[key] !== 'string') continue;
    text[key] = files.text[key];
    if (typeof files.stamps[key] === 'string') stamps[key] = files.stamps[key];
  }
  return { text, stamps };
}

/**
 * Removes the translations that are stale or have no stamp, and the entries
 * of keys that the app no longer has. The English text shows for them.
 */
export function prune(source: Source, files: LanguageFiles): LanguageFiles {
  const kept: LanguageFiles = { text: {}, stamps: {} };
  for (const key of Object.keys(source)) {
    if (typeof files.text[key] !== 'string' || isStale(source, files, key)) continue;
    kept.text[key] = files.text[key];
    kept.stamps[key] = files.stamps[key];
  }
  return kept;
}

/** The work file of one language: each key that needs a translation, with its English text. */
export function workFor(source: Source, files: LanguageFiles): WorkFile {
  const work: WorkFile = {};
  for (const key of pendingKeys(source, files)) {
    work[key] = { english: source[key], ...(typeof files.text[key] === 'string' ? { previous: files.text[key] } : {}), translation: '' };
  }
  return work;
}

export interface ApplyResult {
  files: LanguageFiles;
  applied: string[];
  /** The entries that were not applied, with the reason. */
  refused: { key: string; reason: string }[];
  /** The entries that stay in the work file: the refused ones and the ones with no translation yet. */
  left: WorkFile;
}

/**
 * Puts the translations of a work file into the files of a language. An
 * entry is refused when its English text is not the English text of the app
 * any more, or when its translation fails the check.
 */
export function applyWork(source: Source, files: LanguageFiles, work: WorkFile): ApplyResult {
  const next: LanguageFiles = { text: { ...files.text }, stamps: { ...files.stamps } };
  const applied: string[] = [];
  const refused: ApplyResult['refused'] = [];
  const left: WorkFile = {};
  for (const [key, item] of Object.entries(work)) {
    if (typeof item !== 'object' || item === null || typeof item.translation !== 'string' || item.translation.trim() === '') {
      left[key] = item;
      continue;
    }
    let reason: string | null = null;
    if (!Object.hasOwn(source, key)) reason = 'the app has no such key';
    else if (item.english !== source[key]) reason = 'the English text changed after the work file was written. Run "--todo" again and translate the new text';
    else {
      const problem = translationProblem(source[key], item.translation, key);
      if (problem) reason = PROBLEM_TEXT[problem];
    }
    if (reason) {
      refused.push({ key, reason });
      left[key] = item;
    } else {
      next.text[key] = item.translation;
      next.stamps[key] = stampOf(source[key]);
      applied.push(key);
    }
  }
  return { files: inSourceOrder(source, next), applied, refused, left };
}

// ---------------------------------------------------------------- files

const readJson = <T>(path: string): T | null => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : null);
const writeJson = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

export function readLanguage(dir: string, code: string): LanguageFiles {
  return { text: readJson<Texts>(join(dir, `${code}.json`)) ?? {}, stamps: readJson<Texts>(join(dir, `${code}.stamp.json`)) ?? {} };
}

export function writeLanguage(dir: string, code: string, files: LanguageFiles): void {
  writeJson(join(dir, `${code}.json`), files.text);
  writeJson(join(dir, `${code}.stamp.json`), files.stamps);
}

// ---------------------------------------------------------------- commands

export interface Options {
  dir?: string;
  workDir?: string;
  source?: Source;
  targets?: readonly string[];
  log?: (line: string) => void;
}

export async function main(args: readonly string[], options: Options = {}): Promise<number> {
  const dir = options.dir ?? 'locales';
  const workDir = options.workDir ?? '.translate';
  const source = options.source ?? SOURCE_MESSAGES;
  const targets = options.targets ?? TARGETS;
  const log = options.log ?? console.log;
  const mode = args[0] ?? '--check';

  if (mode === '--check') {
    const total = Object.keys(source).length;
    for (const code of targets) {
      const pending = pendingKeys(source, readLanguage(dir, code));
      log(`${code}: ${pending.length} of ${total} messages need a translation`);
      for (const key of pending.slice(0, 20)) log(`  ${key}`);
      if (pending.length > 20) log(`  and ${pending.length - 20} more`);
    }
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

  if (mode === '--prune') {
    for (const code of targets) writeLanguage(dir, code, prune(source, readLanguage(dir, code)));
    log('Stale and unknown translations are removed. The English text shows for them.');
    return 0;
  }

  if (mode === '--todo') {
    mkdirSync(workDir, { recursive: true });
    for (const code of targets) {
      const work = workFor(source, readLanguage(dir, code));
      const path = join(workDir, `${code}.json`);
      if (Object.keys(work).length === 0) {
        rmSync(path, { force: true });
        log(`${code}: nothing to translate`);
      } else {
        writeJson(path, work);
        log(`${code}: ${Object.keys(work).length} messages to translate in ${path}`);
      }
    }
    return 0;
  }

  if (mode === '--apply') {
    let refusedCount = 0;
    for (const code of targets) {
      const path = join(workDir, `${code}.json`);
      const work = readJson<WorkFile>(path);
      if (!work) continue;
      const result = applyWork(source, readLanguage(dir, code), work);
      writeLanguage(dir, code, result.files);
      if (Object.keys(result.left).length === 0) rmSync(path, { force: true });
      else writeJson(path, result.left);
      const waiting = Object.keys(result.left).length - result.refused.length;
      log(`${code}: applied ${result.applied.length}, refused ${result.refused.length}, with no translation yet ${waiting}`);
      for (const { key, reason } of result.refused) log(`  refused ${key}: ${reason}`);
      refusedCount += result.refused.length;
    }
    return refusedCount === 0 ? 0 : 1;
  }

  log(`Unknown argument: ${mode}`);
  return 2;
}
