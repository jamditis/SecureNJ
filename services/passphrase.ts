import { wordlist } from '@scure/bip39/wordlists/english.js';

/**
 * Makes a passphrase from random words. The list has 2,048 words, so each
 * word adds 11 bits. Six words give 66 bits.
 */
export function generatePassphrase(wordCount = 6): string {
  const picks = globalThis.crypto.getRandomValues(new Uint16Array(wordCount));
  // 2,048 is a power of two, so the mask gives each word the same probability.
  return Array.from(picks, (value) => wordlist[value & 0x7ff]).join(' ');
}

/** A passphrase shorter than this is too easy to find by trial. */
export const MIN_PASSPHRASE_LENGTH = 12;

export function isWeakPassphrase(passphrase: string): boolean {
  return passphrase.trim().length < MIN_PASSPHRASE_LENGTH;
}
