/**
 * Encrypted backup of the records of one tool. Use it to keep a copy off
 * the device, to move a group to a new passphrase, or to carry data between
 * devices that cannot connect.
 *
 * A backup holds only the records of its tool, and it can be added only to
 * that tool. A tool whose data must never be written to a device has no
 * backup.
 */
import type * as Y from 'yjs';
import { decryptFile, encryptFile } from './crypto';
import { isDeleted } from './retention';
import { MEMORY_ONLY_TOOLS } from './space';

const BACKUP_TYPE = 'application/x-securenj-room';

/**
 * The maps that hold the records of each tool. With no room, all tools
 * share one local document, so a backup must name the maps that it takes.
 */
const TOOL_MAPS: Record<string, string[]> = {
  'status-board': ['users'],
  'mutual-aid': ['posts', 'claims'],
  consensus: ['proposals', 'votes'],
  whiteboard: ['strokes'],
  'shift-roster': ['shifts', 'shiftSignups'],
  'supply-inventory': ['supplies', 'supplyAdjustments'],
};

export const hasBackup = (tool: string) => !MEMORY_ONLY_TOOLS.has(tool) && tool in TOOL_MAPS;

/** The file is not a backup of this tool, or this tool has no backup. */
export class NotABackupError extends Error {
  constructor() {
    super('The file is not a backup of this tool.');
    this.name = 'NotABackupError';
  }
}

export async function sealBackup(doc: Y.Doc, tool: string, passphrase: string): Promise<Uint8Array> {
  if (!hasBackup(tool)) throw new NotABackupError();
  const maps: Record<string, Record<string, unknown>> = {};
  for (const name of TOOL_MAPS[tool]) maps[name] = doc.getMap(name).toJSON();
  // The tool is inside the encrypted part, so the file does not show it.
  const bytes = new TextEncoder().encode(JSON.stringify({ tool, maps }));
  return encryptFile({ name: tool, type: BACKUP_TYPE, bytes }, passphrase);
}

/**
 * Adds the records of a backup to `doc` and returns the number of records
 * that it added. A record that is in `doc` is not changed, and a record
 * that was deleted from `doc` does not come back.
 */
export async function restoreBackup(doc: Y.Doc, tool: string, container: Uint8Array, passphrase: string): Promise<number> {
  const file = await decryptFile(container, passphrase);
  if (file.type !== BACKUP_TYPE || file.name !== tool || !hasBackup(tool)) throw new NotABackupError();
  let maps: unknown;
  try {
    maps = (JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(file.bytes)) as { maps?: unknown }).maps;
  } catch {
    throw new NotABackupError();
  }
  if (typeof maps !== 'object' || maps === null) throw new NotABackupError();

  let added = 0;
  doc.transact(() => {
    for (const name of TOOL_MAPS[tool]) {
      const records = (maps as Record<string, unknown>)[name];
      if (typeof records !== 'object' || records === null) continue;
      const map = doc.getMap(name);
      for (const [key, value] of Object.entries(records)) {
        // The tool checks each record when it reads it, so a bad record is not shown.
        if (map.has(key) || isDeleted(doc, name, key)) continue;
        map.set(key, value);
        added += 1;
      }
    }
  });
  return added;
}
