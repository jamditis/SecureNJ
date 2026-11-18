import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { NotABackupError, restoreBackup, sealBackup } from './backup';
import { DecryptionError, encryptFile } from './crypto';
import { pickLocale } from './i18n';
import { makeInviteLink, readInvite } from './invite';
import { MAX_SPACE_NAME_LENGTH } from './space';

const PASSPHRASE = 'backup passphrase for tests';

describe('backup', () => {
  const makeSpace = () => {
    const doc = new Y.Doc();
    doc.getMap('posts').set('p1', { id: 'p1', title: 'Ride to the clinic' });
    doc.getMap('settings').set('aidRetentionHours', 72);
    return doc;
  };

  it('moves all shared data to a new, empty document', async () => {
    const sealed = await sealBackup(makeSpace(), PASSPHRASE);
    const fresh = new Y.Doc();
    await restoreBackup(fresh, sealed, PASSPHRASE);
    expect(fresh.getMap('posts').get('p1')).toEqual({ id: 'p1', title: 'Ride to the clinic' });
    expect(fresh.getMap('settings').get('aidRetentionHours')).toBe(72);
  });

  it('does not show the data in the backup file', async () => {
    const sealed = await sealBackup(makeSpace(), PASSPHRASE);
    expect(new TextDecoder('latin1').decode(sealed)).not.toContain('Ride to the clinic');
  });

  it('adds to the data that is in the document, and keeps a later delete', async () => {
    const space = makeSpace();
    const sealed = await sealBackup(space, PASSPHRASE);
    space.getMap('posts').delete('p1');
    space.getMap('posts').set('p2', { id: 'p2', title: 'Groceries' });
    await restoreBackup(space, sealed, PASSPHRASE);
    expect(Array.from(space.getMap('posts').keys())).toEqual(['p2']);
  });

  it('rejects the wrong passphrase and leaves the document as it was', async () => {
    const sealed = await sealBackup(makeSpace(), PASSPHRASE);
    const target = new Y.Doc();
    await expect(restoreBackup(target, sealed, 'wrong passphrase')).rejects.toBeInstanceOf(DecryptionError);
    expect(target.share.size).toBe(0);
  });

  it('rejects an encrypted file that is not a backup, and damaged backup data', async () => {
    const target = new Y.Doc();
    const otherFile = await encryptFile({ name: 'photo.jpg', type: 'image/jpeg', bytes: new Uint8Array(50) }, PASSPHRASE);
    await expect(restoreBackup(target, otherFile, PASSPHRASE)).rejects.toBeInstanceOf(NotABackupError);

    const damaged = await encryptFile(
      { name: 'space', type: 'application/x-securenj-space', bytes: new Uint8Array([9, 9, 9, 9, 9, 9]) },
      PASSPHRASE,
    );
    await expect(restoreBackup(target, damaged, PASSPHRASE)).rejects.toBeInstanceOf(NotABackupError);
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
    expect(pickLocale('xx', ['pt-BR'])).toBe('en');
  });
});
