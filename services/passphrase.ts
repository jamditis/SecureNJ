import { wordlist } from '@scure/bip39/wordlists/english.js';

/**
 * Two devices can encode the same typed passphrase in different ways, and a
 * paste can add a space. Version 2 uses this form for all passphrases.
 */
export function normalizePassphrase(passphrase: string): string {
  return passphrase.normalize('NFKC').trim();
}

/**
 * Makes a passphrase from random words. The list has 2,048 words, so each
 * word adds 11 bits. Six words give 66 bits.
 */
export function generatePassphrase(wordCount = 6): string {
  const picks = globalThis.crypto.getRandomValues(new Uint16Array(wordCount));
  // 2,048 is a power of two, so the mask gives each word the same probability.
  return Array.from(picks, (value) => wordlist[value & 0x7ff]).join(' ');
}

export const MIN_PASSPHRASE_LENGTH = 12;
const MIN_DISTINCT_CHARACTERS = 6;
// No fragment can be a word, or a part of a word, of the generator list: the
// generator must never make a passphrase that this rule refuses. A test checks it.
const COMMON_FRAGMENTS = ['password', 'passphrase', 'passcode', 'qwerty', '123456', 'abcdef', 'letmein', 'iloveyou'];

export type PassphraseProblem = 'short' | 'guessable';

/**
 * The rule for each new passphrase: a room, an export, a locked message.
 * A person who holds the locked data can test guesses with no limit, so a
 * weak passphrase gives no protection. The check does not prove that a
 * passphrase is strong: it refuses the ones that are weak for certain.
 */
export function passphraseProblem(passphrase: string): PassphraseProblem | null {
  const text = normalizePassphrase(passphrase).toLowerCase();
  if (text.length < MIN_PASSPHRASE_LENGTH) return 'short';
  if (new Set(text).size < MIN_DISTINCT_CHARACTERS || COMMON_FRAGMENTS.some((fragment) => text.includes(fragment))) return 'guessable';
  return null;
}

/** For the test that the generator and the rule agree. */
export const GENERATOR_WORDS: readonly string[] = wordlist;
