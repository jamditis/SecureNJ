import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Copy, Download, Network, Plus, Trash2, Upload, Users } from 'lucide-react';
import { decryptText, encryptText } from '../services/crypto';
import { downloadBlob } from '../services/download';
import { useT, type Translate } from '../services/i18n';
import { buildPhoneTree, parseContacts, treeDepth, type CallAssignment } from '../services/phoneTree';
import { isContact, keyOfId } from '../services/schema';
import { useRecords, useSync } from '../services/sync';
import type { Contact, ContactRole } from '../types';
import { Button, Field, IconButton, Notice, PassphraseModal, ToolHeader, inputClass } from './ui';

const BRANCH_OPTIONS = [2, 3, 4, 5];
const EMPTY_CONTACT = { name: '', contact: '', role: 'Member' as ContactRole, notes: '' };

const describe = (person: Contact) => `${person.name} (${person.contact})`;

/** The text that one person gets. It names only the people that this person talks to. */
function callCard(node: CallAssignment, t: Translate): string {
  const lines = [
    t('tree.card.title', { name: node.person.name }),
    node.calledBy ? t('tree.card.from', { person: describe(node.calledBy) }) : t('tree.card.fromCoordinator'),
  ];
  if (node.calls.length > 0) {
    lines.push(t('tree.card.calls'), ...node.calls.map((person) => `- ${describe(person)}`), t('tree.card.noAnswer'));
  } else {
    lines.push(t('tree.card.end'));
  }
  return lines.join('\n');
}

export default function PhoneTree() {
  const t = useT();
  const { privateDoc } = useSync();
  const { records, map } = useRecords('contacts', isContact, keyOfId, 'private');
  const [draft, setDraft] = useState(EMPTY_CONTACT);
  const [branching, setBranching] = useState(2);
  const [transfer, setTransfer] = useState<{ kind: 'export' } | { kind: 'import'; payload: string } | null>(null);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const contacts = useMemo(() => [...records].sort((a, b) => a.name.localeCompare(b.name)), [records]);
  const tree = useMemo(() => buildPhoneTree(contacts, branching), [contacts, branching]);

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (draft.name.trim() === '' || draft.contact.trim() === '') return;
    const id = crypto.randomUUID();
    map.set(id, { id, name: draft.name.trim(), contact: draft.contact.trim(), role: draft.role, notes: draft.notes.trim() });
    setDraft(EMPTY_CONTACT);
  };

  const replaceAll = (next: Contact[]) => {
    if (contacts.length > 0 && !window.confirm(t('tree.replaceConfirm', { count: contacts.length }))) return;
    privateDoc.transact(() => {
      map.clear();
      next.forEach((contact) => map.set(contact.id, contact));
    });
    setError('');
  };

  const exportTree = async (passphrase: string) => {
    const sealed = await encryptText(JSON.stringify(contacts), passphrase);
    downloadBlob(new Blob([sealed], { type: 'text/plain' }), 'phone-tree.snj.txt');
  };

  const pickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const payload = await file.text();
    let plain: unknown;
    try {
      plain = JSON.parse(payload);
    } catch {
      // The file is not JSON, so it is an encrypted export.
      setTransfer({ kind: 'import', payload });
      return;
    }
    // A file from the first release of the app is plain JSON.
    try {
      replaceAll(parseContacts(plain));
    } catch {
      setError(t('tree.badFile'));
    }
  };

  const importEncrypted = async (payload: string, passphrase: string) => {
    const plain = await decryptText(payload, passphrase);
    try {
      replaceAll(parseContacts(JSON.parse(plain)));
    } catch {
      setError(t('tree.badFile'));
    }
  };

  const copyCard = async (node: CallAssignment) => {
    await navigator.clipboard.writeText(callCard(node, t));
    setCopiedId(node.person.id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  return (
    <div className="space-y-8">
      <ToolHeader title={t('tree.title')} subtitle={t('tree.subtitle')} synced={false}>
        <Button variant="light" onClick={() => fileInput.current?.click()}>
          <Upload className="w-4 h-4" aria-hidden="true" /> {t('tree.import')}
        </Button>
        <input ref={fileInput} type="file" accept=".txt,.json,text/plain,application/json" className="hidden" onChange={pickFile} />
        <Button disabled={contacts.length === 0} onClick={() => setTransfer({ kind: 'export' })}>
          <Download className="w-4 h-4" aria-hidden="true" /> {t('tree.export')}
        </Button>
      </ToolHeader>

      {error && <Notice tone="error">{error}</Notice>}
      <Notice tone="warning">{t('tree.storageNote')}</Notice>

      <section className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
        <h3 className="p-5 border-b border-slate-100 font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-500" aria-hidden="true" /> {t('tree.contacts', { count: contacts.length })}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                <th className="px-5 py-3">{t('tree.field.name')}</th>
                <th className="px-5 py-3">{t('tree.field.contact')}</th>
                <th className="px-5 py-3">{t('tree.field.role')}</th>
                <th className="px-5 py-3">{t('tree.field.notes')}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    {t('tree.empty')}
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td className="px-5 py-3 font-bold text-slate-900">{contact.name}</td>
                    <td className="px-5 py-3 font-mono text-slate-600">{contact.contact}</td>
                    <td className="px-5 py-3">{t(`tree.role.${contact.role}`)}</td>
                    <td className="px-5 py-3 text-slate-500">{contact.notes}</td>
                    <td className="px-5 py-1 text-right">
                      <IconButton icon={Trash2} label={t('tree.remove', { name: contact.name })} onClick={() => map.delete(contact.id)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <form onSubmit={add} className="p-5 bg-slate-50 border-t border-slate-100 grid grid-cols-1 md:grid-cols-5 gap-3">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t('tree.field.name')} aria-label={t('tree.field.name')} className={`${inputClass} !bg-white`} />
          <input value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} placeholder={t('tree.field.contact')} aria-label={t('tree.field.contact')} className={`${inputClass} !bg-white`} />
          <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as ContactRole })} aria-label={t('tree.field.role')} className={`${inputClass} !bg-white`}>
            <option value="Member">{t('tree.role.Member')}</option>
            <option value="Lead">{t('tree.role.Lead')}</option>
          </select>
          <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder={t('tree.field.notes')} aria-label={t('tree.field.notes')} className={`${inputClass} !bg-white`} />
          <Button type="submit" variant="dark">
            <Plus className="w-4 h-4" aria-hidden="true" /> {t('tree.add')}
          </Button>
        </form>
      </section>

      {tree.length > 1 && (
        <section className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Network className="w-5 h-5 text-emerald-500" aria-hidden="true" /> {t('tree.plan')}
              </h3>
              <p className="text-sm text-slate-500">{t('tree.planSummary', { people: tree.length, depth: treeDepth(tree) })}</p>
            </div>
            <div className="w-40">
              <Field label={t('tree.branching')}>
                <select value={branching} onChange={(e) => setBranching(Number(e.target.value))} className={inputClass}>
                  {BRANCH_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          <Notice>{t('tree.cardNote')}</Notice>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tree.map((node) => (
              <li key={node.person.id} className="border border-slate-200 rounded-2xl p-4 space-y-2">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words font-mono">{callCard(node, t)}</pre>
                <Button variant="light" className="!px-3 !py-1.5 !text-xs" onClick={() => void copyCard(node)}>
                  <Copy className="w-3 h-3" aria-hidden="true" /> {copiedId === node.person.id ? t('common.copied') : t('tree.copyCard')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {transfer && (
        <PassphraseModal
          title={transfer.kind === 'export' ? t('tree.export') : t('tree.import')}
          note={transfer.kind === 'export' ? t('tree.exportNote') : t('tree.importNote')}
          actionLabel={transfer.kind === 'export' ? t('tree.export') : t('tree.import')}
          create={transfer.kind === 'export'}
          onSubmit={(passphrase) => (transfer.kind === 'export' ? exportTree(passphrase) : importEncrypted(transfer.payload, passphrase))}
          onClose={() => setTransfer(null)}
        />
      )}
    </div>
  );
}
