/**
 * Family emergency plan: the answers, the saved file, and its checks.
 *
 * A plan is one object with the item ID as the key and the answer as the
 * value. The browser stores nothing: the plan is in the memory of the page
 * until the person saves a locked file or prints it.
 *
 * The saved file is the text that `encryptText` makes from the JSON of that
 * object. The old build made the same JSON, so its files open here, and the
 * "Unlock" tab of "Lock a message" reads the files of both.
 */
import { DEFAULT_ANSWERS, PLAN_SECTIONS } from '../content/familyPlan';
import { decryptText, encryptText } from './crypto';

export type PlanAnswers = Readonly<Record<string, string>>;

/** The old build used this name. Keep it, so that people find their file. */
export const PLAN_FILE_NAME = 'family-plan.locked.txt';
export const PLAN_FILE_TYPE = 'text/plain';
/** A saved plan is a few kilobytes. A larger file is not a plan, and the page does not read it. */
export const MAX_PLAN_FILE_BYTES = 1024 * 1024;

const ITEM_IDS: readonly string[] = PLAN_SECTIONS.flatMap((section) => section.items.map((item) => item.id));

/** The file opened with the passphrase, but it does not hold a family plan. */
export class NotAPlanError extends Error {
  constructor() {
    super('The file does not hold a family plan.');
    this.name = 'NotAPlanError';
  }
}

export const newPlan = (): PlanAnswers => ({ ...DEFAULT_ANSWERS });

/** Returns a new object, so that a change of the plan is a change of identity. */
export const setAnswer = (plan: PlanAnswers, id: string, value: string): PlanAnswers => ({ ...plan, [id]: value });

/** The JSON of the old build: an object with the item ID as the key. Only the items of the form go into the file. */
export function serializePlan(plan: PlanAnswers): string {
  const known: Record<string, string> = {};
  for (const id of ITEM_IDS) {
    if (typeof plan[id] === 'string') known[id] = plan[id];
  }
  return JSON.stringify(known);
}

/**
 * Reads the text of a saved plan. The content of a file is not trusted:
 * only the items of the form are kept, and only text. The old build took
 * any JSON value as the plan, kept keys that the form does not show, and
 * wrote them into the next saved file.
 */
export function parsePlan(text: string): PlanAnswers {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new NotAPlanError();
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new NotAPlanError();
  const fields = value as Record<string, unknown>;
  const plan: Record<string, string> = {};
  for (const id of ITEM_IDS) {
    const answer = Object.hasOwn(fields, id) ? fields[id] : undefined;
    if (typeof answer === 'string') plan[id] = answer;
  }
  // A file of a different tool can open with the same passphrase. It must not empty the form.
  if (Object.keys(plan).length === 0) throw new NotAPlanError();
  return plan;
}

/** The text of the locked file. Throws `WeakPassphraseError` for a weak passphrase. */
export function lockPlan(plan: PlanAnswers, passphrase: string): Promise<string> {
  return encryptText(serializePlan(plan), passphrase);
}

/** Throws `DecryptionError` for a wrong passphrase or a damaged file, and `NotAPlanError` for other content. */
export async function unlockPlan(fileText: string, passphrase: string): Promise<PlanAnswers> {
  return parsePlan(await decryptText(fileText.trim(), passphrase));
}
