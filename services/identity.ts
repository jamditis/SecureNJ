/**
 * Each browser has a random member ID for each space. It tells devices
 * apart inside a space (positions, check-ins). It is not an account, and
 * the IDs of one device in two spaces have no link.
 */
const idKey = (scope: string) => `snj.member.${scope}`;
const NAME_KEY = 'snj.memberName';

/** `scope` is the database name of the space, or of the local document. */
export function getMemberId(storage: Storage, scope: string): string {
  let id = storage.getItem(idKey(scope));
  if (!id) {
    id = globalThis.crypto.randomUUID();
    storage.setItem(idKey(scope), id);
  }
  return id;
}

/** Removes what links this device to its records in a space. */
export function forgetMember(storage: Storage, scope: string): void {
  storage.removeItem(idKey(scope));
  storage.removeItem(NAME_KEY);
}

export function loadMemberName(storage: Storage): string {
  return storage.getItem(NAME_KEY) ?? '';
}

export function saveMemberName(storage: Storage, name: string): void {
  storage.setItem(NAME_KEY, name.trim());
}
