import type { Contact } from '../types';

export interface CallAssignment {
  person: Contact;
  /** Null for a person at the top of the tree. The coordinator calls this person. */
  calledBy: Contact | null;
  calls: Contact[];
  /** Zero for the top of the tree. */
  level: number;
}

/**
 * Makes a call tree. Leads are at the top. Each person calls no more than
 * `branching` people. The tree fills level by level, so it is as short as
 * possible and each lead gets a branch of almost the same size.
 */
export function buildPhoneTree(contacts: Contact[], branching: number): CallAssignment[] {
  if (contacts.length === 0) return [];
  const perPerson = Math.max(1, Math.floor(branching));
  const leads = contacts.filter((c) => c.role === 'Lead');
  const top = leads.length > 0 ? leads : [contacts[0]];
  const waiting = contacts.filter((c) => !top.includes(c));

  const tree: CallAssignment[] = top.map((person) => ({ person, calledBy: null, calls: [], level: 0 }));
  for (let i = 0; i < tree.length && waiting.length > 0; i += 1) {
    const caller = tree[i];
    caller.calls = waiting.splice(0, perPerson);
    caller.calls.forEach((person) => tree.push({ person, calledBy: caller.person, calls: [], level: caller.level + 1 }));
  }
  return tree;
}

/** The number of calls in sequence before the last person gets the message. */
export function treeDepth(tree: CallAssignment[]): number {
  return tree.reduce((max, node) => Math.max(max, node.level + 1), 0);
}

/**
 * Reads contacts from an imported file. Bad entries are dropped. Each
 * contact gets a new ID, so an import cannot overwrite a current contact.
 */
export function parseContacts(data: unknown): Contact[] {
  if (!Array.isArray(data)) throw new Error('The file does not contain a contact list.');
  const contacts: Contact[] = [];
  for (const entry of data) {
    if (typeof entry !== 'object' || entry === null) continue;
    const v = entry as Record<string, unknown>;
    if (typeof v.name !== 'string' || typeof v.contact !== 'string' || v.name.trim() === '') continue;
    contacts.push({
      id: globalThis.crypto.randomUUID(),
      name: v.name.trim(),
      contact: v.contact.trim(),
      role: v.role === 'Lead' ? 'Lead' : 'Member',
      notes: typeof v.notes === 'string' ? v.notes : '',
    });
  }
  if (contacts.length === 0) throw new Error('The file does not contain a contact list.');
  return contacts;
}
