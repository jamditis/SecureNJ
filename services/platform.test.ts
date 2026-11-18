import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { NotABackupError, restoreBackup, sealBackup } from './backup';
import { DecryptionError, encryptFile } from './crypto';
import { pickLocale } from './i18n';
import { deleteRecords } from './retention';
import { makeInviteLink, readInvite } from './invite';
import { MAX_SPACE_NAME_LENGTH } from './space';

const PASSPHRASE = 'river tulip nine window';

describe('backup', () => {
  const makeLocal = () => {
    const doc = new Y.Doc();
    doc.getMap('posts').set('p1', { id: 'p1', title: 'Ride to the clinic' });
    doc.getMap('claims').set('p1', { postId: 'p1', status: 'claimed', claimedBy: 'Wren' });
    // With no room, all tools share one document. These records belong to other tools.
    doc.getMap('users').set('m1', { id: 'm1', name: 'Sparrow' });
    doc.getMap('contacts').set('c1', { id: 'c1', name: 'Private contact' });
    return doc;
  };

  it('moves the records of one tool to a new, empty document', async () => {
    const sealed = await sealBackup(makeLocal(), 'mutual-aid', PASSPHRASE);
    const fresh = new Y.Doc();
    expect(await restoreBackup(fresh, 'mutual-aid', sealed, PASSPHRASE)).toBe(2);
    expect(fresh.getMap('posts').get('p1')).toEqual({ id: 'p1', title: 'Ride to the clinic' });
    expect(fresh.getMap('claims').get('p1')).toMatchObject({ status: 'claimed' });
  });

  it('holds only the records of its tool, not the records of the other tools on the device', async () => {
    const sealed = await sealBackup(makeLocal(), 'mutual-aid', PASSPHRASE);
    const fresh = new Y.Doc();
    await restoreBackup(fresh, 'mutual-aid', sealed, PASSPHRASE);
    expect(Array.from(fresh.share.keys()).sort()).toEqual(['claims', 'deleted', 'posts']);
    expect(fresh.getMap('users').size).toBe(0);
  });

  it('does not show the data in the backup file', async () => {
    const sealed = await sealBackup(makeLocal(), 'mutual-aid', PASSPHRASE);
    const text = new TextDecoder('latin1').decode(sealed);
    expect(text).not.toContain('Ride to the clinic');
    expect(text).not.toContain('mutual-aid');
  });

  it('does not change a record that is in the document, and does not bring back a deleted record', async () => {
    const doc = makeLocal();
    const sealed = await sealBackup(doc, 'mutual-aid', PASSPHRASE);
    doc.getMap('claims').set('p1', { postId: 'p1', status: 'done', claimedBy: 'Wren' });
    deleteRecords(doc, 'posts', ['p1']);
    doc.getMap('posts').set('p2', { id: 'p2', title: 'Groceries' });
    expect(await restoreBackup(doc, 'mutual-aid', sealed, PASSPHRASE)).toBe(0);
    expect(Array.from(doc.getMap('posts').keys())).toEqual(['p2']);
    expect(doc.getMap('claims').get('p1')).toMatchObject({ status: 'done' });
  });

  it('refuses to add the backup of one tool to a different tool', async () => {
    const sealed = await sealBackup(makeLocal(), 'mutual-aid', PASSPHRASE);
    const other = new Y.Doc();
    await expect(restoreBackup(other, 'whiteboard', sealed, PASSPHRASE)).rejects.toBeInstanceOf(NotABackupError);
    expect(other.share.size).toBe(0);
  });

  it('refuses to make a backup of a tool whose data must never be written to a device', async () => {
    await expect(sealBackup(makeLocal(), 'safety-alerts', PASSPHRASE)).rejects.toBeInstanceOf(NotABackupError);
  });

  it('rejects the wrong passphrase and leaves the document as it was', async () => {
    const sealed = await sealBackup(makeLocal(), 'mutual-aid', PASSPHRASE);
    const target = new Y.Doc();
    await expect(restoreBackup(target, 'mutual-aid', sealed, 'wrong set of words')).rejects.toBeInstanceOf(DecryptionError);
    expect(target.share.size).toBe(0);
  });

  it('rejects an encrypted file that is not a backup, and damaged backup data', async () => {
    const target = new Y.Doc();
    const otherFile = await encryptFile({ name: 'photo.jpg', type: 'image/jpeg', bytes: new Uint8Array(50) }, PASSPHRASE);
    await expect(restoreBackup(target, 'mutual-aid', otherFile, PASSPHRASE)).rejects.toBeInstanceOf(NotABackupError);

    const damaged = await encryptFile({ name: 'mutual-aid', type: 'application/x-securenj-room', bytes: new Uint8Array([9, 9, 9]) }, PASSPHRASE);
    await expect(restoreBackup(target, 'mutual-aid', damaged, PASSPHRASE)).rejects.toBeInstanceOf(NotABackupError);
    expect(target.share.size).toBe(0);
  });
});

describe('invite link', () => {
  const invite = { name: 'Ironbound vecinos ñ', signaling: ['wss://signal.example.org'] };

  it('carries the space name and the servers in the part after "#"', () => {
    const link = makeInviteLink('https://toolkit.example.org/app/#old', invite);
    expect(link.startsWith('https://toolkit.example.org/app/#join=')).toBe(true);
    expect(readInvite(new URL(link).hash, true)).toEqual(invite);
  });

  it('has no field for a passphrase', () => {
    const link = makeInviteLink('https://toolkit.example.org/', { ...invite, passphrase: 'secret words' } as typeof invite);
    const payload = atob(new URL(link).hash.slice('#join='.length).replace(/-/g, '+').replace(/_/g, '/'));
    expect(payload).not.toContain('secret words');
  });

  it('drops server addresses that the browser cannot use', () => {
    const link = makeInviteLink('https://a.example/', { name: 'x', signaling: ['ws://evil.example', 'javascript:alert(1)', 'wss://ok.example'] });
    expect(readInvite(new URL(link).hash, true)).toEqual({ name: 'x', signaling: ['wss://ok.example'] });
  });

  it('returns nothing for an address with no invite or with a damaged invite', () => {
    const encode = (value: unknown) => `#join=${btoa(JSON.stringify(value))}`;
    expect(readInvite('', true)).toBeNull();
    expect(readInvite('#other', true)).toBeNull();
    expect(readInvite('#join=%%%', true)).toBeNull();
    expect(readInvite(encode('text'), true)).toBeNull();
    expect(readInvite(encode({ n: '', s: [] }), true)).toBeNull();
    expect(readInvite(encode({ n: 'x'.repeat(101), s: [] }), true)).toBeNull();
    expect(readInvite(encode({ n: 42 }), true)).toBeNull();
  });

  it('reads each invite that the app can make', () => {
    // A space name has a length limit. A link for a name at the limit must open.
    const longest = { name: 'ñ'.repeat(MAX_SPACE_NAME_LENGTH), signaling: [] };
    expect(readInvite(new URL(makeInviteLink('https://a.example/', longest)).hash, true)).toEqual(longest);
  });

  it('accepts an invite with no servers', () => {
    expect(readInvite(`#join=${btoa(JSON.stringify({ n: 'Group' }))}`, true)).toEqual({ name: 'Group', signaling: [] });
  });
});

describe('pickLocale', () => {
  it('uses the saved choice first', () => {
    expect(pickLocale('es', ['en-US'])).toBe('es');
  });

  it('uses the first language of the browser that the app has', () => {
    expect(pickLocale(null, ['fr-FR', 'es-MX', 'en-US'])).toBe('es');
    expect(pickLocale(null, ['ES'])).toBe('es');
  });

  it('uses English when no language matches or the saved value is not a language', () => {
    expect(pickLocale(null, ['fr-FR'])).toBe('en');
    expect(pickLocale('toString', [])).toBe('en');
    expect(pickLocale('xx', ['fr-CA'])).toBe('en');
  });
});
