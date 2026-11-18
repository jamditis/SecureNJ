/**
 * Encrypted backup of the shared document. Use it to keep a copy off the
 * device, to move a group to a new space with a new passphrase, or to carry
 * data between devices that cannot connect.
 */
import * as Y from 'yjs';
import { decryptFile, encryptFile } from './crypto';

const BACKUP_TYPE = 'application/x-securenj-space';

/** The file decrypts, but it is not a backup of a space. */
export class NotABackupError extends Error {
  constructor() {
    super('The file is not a backup of a space.');
    this.name = 'NotABackupError';
  }
}

export function sealBackup(doc: Y.Doc, passphrase: string): Promise<Uint8Array> {
  return encryptFile({ name: 'space', type: BACKUP_TYPE, bytes: Y.encodeStateAsUpdate(doc) }, passphrase);
}

/**
 * Adds the data of a backup to `doc`. This is a merge: records that are
 * only in `doc` stay, and a record that `doc` deleted after the backup
 * was made stays deleted.
 */
export async function restoreBackup(doc: Y.Doc, container: Uint8Array, passphrase: string): Promise<void> {
  const file = await decryptFile(container, passphrase);
  if (file.type !== BACKUP_TYPE) throw new NotABackupError();
  try {
    // Damaged data must fail here, before it reaches the real document.
    Y.applyUpdate(new Y.Doc(), file.bytes);
  } catch {
    throw new NotABackupError();
  }
  Y.applyUpdate(doc, file.bytes);
}
