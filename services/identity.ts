/**
 * Each browser has a random member ID. It identifies a device inside a
 * space (votes, check-ins). It is not an account and has no link to a person.
 */
const ID_KEY = 'snj.memberId';
const NAME_KEY = 'snj.memberName';

export function getMemberId(storage: Storage): string {
  let id = storage.getItem(ID_KEY);
  if (!id) {
    id = globalThis.crypto.randomUUID();
    storage.setItem(ID_KEY, id);
  }
  return id;
}

export function loadMemberName(storage: Storage): string {
  return storage.getItem(NAME_KEY) ?? '';
}

export function saveMemberName(storage: Storage, name: string): void {
  storage.setItem(NAME_KEY, name.trim());
}
