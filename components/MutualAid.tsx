import { useCallback, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertTriangle, Check, Download, Megaphone, Pencil, Phone, Plus, Search, Settings, Trash2, Upload } from 'lucide-react';
import { decryptText, encryptText } from '../services/crypto';
import { downloadBlob } from '../services/download';
import { useLocale, useT } from '../services/i18n';
import { cleanImportedPosts, statusOf } from '../services/aid';
import { AID_RETENTION, deleteRecords, expiredIds } from '../services/retention';
import { isAidClaim, isMutualAidPost, keyOfClaim, keyOfId } from '../services/schema';
import { useRecords, useSharedSetting, useSync } from '../services/sync';
import { timeAgo, useNow } from '../services/time';
import type { AidStatus, MutualAidPost } from '../types';
import { Button, EmptyState, Field, IconButton, Modal, Notice, PassphraseModal, ToolHeader, inputClass } from './ui';

const CATEGORIES = ['food', 'shelter', 'transport', 'childcare', 'medical', 'legal', 'supplies', 'labor', 'other'] as const;
type Category = (typeof CATEGORIES)[number];
const isCategory = (value: string): value is Category => (CATEGORIES as readonly string[]).includes(value);

type Draft = Pick<MutualAidPost, 'type' | 'category' | 'title' | 'description' | 'contact' | 'urgent'>;
const EMPTY_DRAFT: Draft = { type: 'request', category: 'food', title: '', description: '', contact: '', urgent: false };
const toDraft = ({ type, category, title, description, contact, urgent }: MutualAidPost): Draft => ({
  type,
  category,
  title,
  description,
  contact,
  urgent,
});

export default function MutualAid() {
  const t = useT();
  const now = useNow();
  const { doc, memberName } = useSync();
  const { records: posts, map } = useRecords('posts', isMutualAidPost, keyOfId);
  // The claim state is a separate record. An edit of a post and a claim by a
  // different member then merge, and neither is lost.
  const { records: claims, map: claimMap } = useRecords('claims', isAidClaim, keyOfClaim);
  const [retention, setRetention] = useSharedSetting(AID_RETENTION);
  // The shared time changes only on "Save". A change deletes posts for all members.
  const [retentionDraft, setRetentionDraft] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'request' | 'offer'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showDone, setShowDone] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [transfer, setTransfer] = useState<{ kind: 'export' } | { kind: 'import'; payload: string } | null>(null);
  const [message, setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const remove = useCallback(
    (ids: string[]) =>
      doc.transact(() => {
        // The marker keeps a deleted post deleted if a member edits it at the same time.
        deleteRecords(doc, 'posts', ids);
        ids.forEach((id) => claimMap.delete(id));
      }),
    [doc, claimMap],
  );

  const categoryLabel = (category: string) => (isCategory(category) ? t(`aid.category.${category}`) : category);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    // The data layer deletes expired posts. This filter hides them until it does.
    const expired = new Set(expiredIds(posts, now, retention));
    return posts
      .filter((p) => !expired.has(p.id))
      .filter((p) => typeFilter === 'all' || p.type === typeFilter)
      .filter((p) => categoryFilter === 'all' || p.category === categoryFilter)
      .filter((p) => showDone || statusOf(p.id, claims) !== 'done')
      .filter((p) => term === '' || `${p.title} ${p.description}`.toLowerCase().includes(term))
      .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.timestamp - a.timestamp);
  }, [posts, claims, typeFilter, categoryFilter, showDone, search, now, retention]);

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!editing || editing.draft.title.trim() === '') return;
    const current = editing.id ? map.get(editing.id) : undefined;
    const id = current?.id ?? crypto.randomUUID();
    map.set(id, { id, timestamp: current?.timestamp ?? Date.now(), ...editing.draft });
    setEditing(null);
  };

  const setStatus = (post: MutualAidPost, status: AidStatus) => {
    if (status === 'open') {
      claimMap.delete(post.id);
      return;
    }
    const claimedBy = status === 'claimed' ? memberName : (claimMap.get(post.id)?.claimedBy ?? '');
    claimMap.set(post.id, { postId: post.id, status, claimedBy });
  };

  const exportPosts = async (passphrase: string) => {
    const sealed = await encryptText(JSON.stringify(posts), passphrase);
    downloadBlob(new Blob([sealed], { type: 'text/plain' }), `mutual-aid-${new Date().toISOString().slice(0, 10)}.snj.txt`);
  };

  const importPosts = async (payload: string, passphrase: string) => {
    const parsed: unknown = JSON.parse(await decryptText(payload, passphrase));
    const incoming = cleanImportedPosts(parsed, Date.now(), retention).filter((post) => !map.has(post.id));
    doc.transact(() => incoming.forEach((post) => map.set(post.id, post)));
    setMessage(t('aid.imported', { count: incoming.length }));
  };

  const pickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) setTransfer({ kind: 'import', payload: await file.text() });
  };

  const draftField = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    editing && setEditing({ ...editing, draft: { ...editing.draft, [key]: value } });

  return (
    <div className="space-y-8">
      <ToolHeader title={t('aid.title')} subtitle={t('aid.subtitle')}>
        <IconButton icon={Settings} label={t('aid.settings')} onClick={() => setShowSettings(true)} />
        <Button onClick={() => setEditing({ id: null, draft: EMPTY_DRAFT })}>
          <Plus className="w-5 h-5" aria-hidden="true" /> {t('aid.new')}
        </Button>
      </ToolHeader>

      <div className="flex flex-col xl:flex-row gap-3 xl:items-center bg-white p-4 rounded-3xl border border-slate-200">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(['all', 'request', 'offer'] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={typeFilter === type}
              onClick={() => setTypeFilter(type)}
              className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${typeFilter === type ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
            >
              {t(`aid.filter.${type}`)}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label={t('aid.category')}
          className={`${inputClass} xl:w-48`}
        >
          <option value="all">{t('aid.allCategories')}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`aid.category.${c}`)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
          {t('aid.showDone')}
        </label>
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('aid.search')}
            aria-label={t('aid.search')}
            className={`${inputClass} ps-9`}
          />
        </div>
      </div>

      {message && <Notice>{message}</Notice>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visible.length === 0 ? (
          <EmptyState icon={Megaphone} title={t('aid.empty')} />
        ) : (
          visible.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              status={statusOf(post.id, claims)}
              claimedBy={claims.find((claim) => claim.postId === post.id)?.claimedBy ?? ''}
              now={now}
              categoryLabel={categoryLabel(post.category)}
              onStatus={(status) => setStatus(post, status)}
              onEdit={() => setEditing({ id: post.id, draft: toDraft(post) })}
              onDelete={() => remove([post.id])}
            />
          ))
        )}
      </div>

      {showSettings && (
        <Modal
          title={t('aid.settings')}
          onClose={() => {
            setShowSettings(false);
            setRetentionDraft(null);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setRetention(Math.max(0, Math.floor(Number(retentionDraft) || 0)));
              setRetentionDraft(null);
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1">
              <Field label={t('aid.retention')}>
                <input
                  type="number"
                  min={0}
                  value={retentionDraft ?? String(retention)}
                  onChange={(event) => setRetentionDraft(event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <Button type="submit" variant="dark" disabled={retentionDraft === null || retentionDraft === String(retention)}>
              {t('common.save')}
            </Button>
          </form>
          <Notice tone="warning">{t('aid.retentionNote')}</Notice>
          <div className="flex gap-2">
            <Button variant="light" className="flex-1" disabled={posts.length === 0} onClick={() => setTransfer({ kind: 'export' })}>
              <Download className="w-4 h-4" aria-hidden="true" /> {t('aid.export')}
            </Button>
            <Button variant="light" className="flex-1" onClick={() => fileInput.current?.click()}>
              <Upload className="w-4 h-4" aria-hidden="true" /> {t('aid.import')}
            </Button>
            <input ref={fileInput} type="file" accept=".txt,text/plain" className="hidden" onChange={pickFile} />
          </div>
          <Button
            variant="danger"
            className="w-full"
            disabled={posts.length === 0}
            onClick={() => {
              if (window.confirm(t('aid.deleteAllConfirm'))) remove(posts.map((p) => p.id));
            }}
          >
            <AlertTriangle className="w-4 h-4" aria-hidden="true" /> {t('aid.deleteAll')}
          </Button>
        </Modal>
      )}

      {transfer && (
        <PassphraseModal
          title={transfer.kind === 'export' ? t('aid.export') : t('aid.import')}
          note={transfer.kind === 'export' ? t('aid.exportNote') : t('aid.importNote')}
          actionLabel={transfer.kind === 'export' ? t('aid.export') : t('aid.import')}
          create={transfer.kind === 'export'}
          onSubmit={(passphrase) => (transfer.kind === 'export' ? exportPosts(passphrase) : importPosts(transfer.payload, passphrase))}
          onClose={() => setTransfer(null)}
        />
      )}

      {editing && (
        <Modal title={editing.id ? t('aid.edit') : t('aid.new')} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-4">
            <div className="flex gap-2">
              {(['request', 'offer'] as const).map((type) => (
                <Button
                  key={type}
                  variant={editing.draft.type === type ? 'dark' : 'light'}
                  className="flex-1"
                  aria-pressed={editing.draft.type === type}
                  onClick={() => draftField('type', type)}
                >
                  {t(`aid.type.${type}`)}
                </Button>
              ))}
            </div>
            <Field label={t('aid.field.title')}>
              <input value={editing.draft.title} onChange={(e) => draftField('title', e.target.value)} dir="auto" autoFocus required className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('aid.category')}>
                <select value={editing.draft.category} onChange={(e) => draftField('category', e.target.value)} className={inputClass}>
                  {!isCategory(editing.draft.category) && <option value={editing.draft.category}>{editing.draft.category}</option>}
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`aid.category.${c}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('aid.field.contact')}>
                <input value={editing.draft.contact} onChange={(e) => draftField('contact', e.target.value)} dir="auto" className={inputClass} />
              </Field>
            </div>
            <Field label={t('aid.field.description')}>
              <textarea value={editing.draft.description} onChange={(e) => draftField('description', e.target.value)} dir="auto" rows={3} className={inputClass} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={editing.draft.urgent} onChange={(e) => draftField('urgent', e.target.checked)} className="w-4 h-4 accent-red-600" />
              {t('aid.urgent')}
            </label>
            <Notice tone="warning">{t('aid.contactNote')}</Notice>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="dark" className="flex-1">
                {t('common.save')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

interface PostCardProps {
  post: MutualAidPost;
  status: AidStatus;
  claimedBy: string;
  now: number;
  categoryLabel: string;
  onStatus: (status: AidStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function PostCard({ post, status, claimedBy, now, categoryLabel, onStatus, onEdit, onDelete }: PostCardProps) {
  const t = useT();
  const locale = useLocale();
  const [showContact, setShowContact] = useState(false);
  const isRequest = post.type === 'request';

  return (
    <article className={`bg-white p-6 rounded-3xl border flex flex-col gap-3 ${post.urgent && status === 'open' ? 'border-red-300' : 'border-slate-200'} ${status === 'done' ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${isRequest ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {t(`aid.type.${post.type}`)}
        </span>
        {post.urgent && <span className="px-2 py-1 rounded-lg text-xs font-black uppercase bg-red-100 text-red-700">{t('aid.urgentBadge')}</span>}
        <span className="ms-auto text-xs text-slate-400">{timeAgo(post.timestamp, now, locale)}</span>
      </div>
      <div className="flex-1 space-y-2">
        <h3 dir="auto" className="font-bold text-slate-900 text-lg leading-tight break-words">{post.title}</h3>
        <span className="inline-block text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{categoryLabel}</span>
        <p dir="auto" className="text-slate-600 text-sm break-words whitespace-pre-wrap">{post.description}</p>
        <p className="text-xs font-bold text-slate-500">
          {status === 'claimed' && claimedBy ? t('aid.status.claimedBy', { name: claimedBy }) : t(`aid.status.${status}`)}
        </p>
      </div>
      {post.contact &&
        (showContact ? (
          <p dir="auto" className="bg-slate-900 text-white p-3 rounded-xl text-center font-mono text-sm break-all">{post.contact}</p>
        ) : (
          <Button variant="light" onClick={() => setShowContact(true)}>
            <Phone className="w-4 h-4" aria-hidden="true" /> {t('aid.showContact')}
          </Button>
        ))}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
        {status === 'open' && (
          <Button variant="light" className="!px-3 !py-1.5 !text-xs" onClick={() => onStatus('claimed')}>
            {t('aid.claim')}
          </Button>
        )}
        {status !== 'done' && (
          <Button variant="light" className="!px-3 !py-1.5 !text-xs" onClick={() => onStatus('done')}>
            <Check className="w-4 h-4" aria-hidden="true" /> {t('aid.markDone')}
          </Button>
        )}
        {status !== 'open' && (
          <Button variant="ghost" className="!px-3 !py-1.5 !text-xs" onClick={() => onStatus('open')}>
            {t('aid.reopen')}
          </Button>
        )}
        <IconButton icon={Pencil} label={t('aid.edit')} className="ms-auto" onClick={onEdit} />
        <IconButton icon={Trash2} label={t('aid.delete')} onClick={onDelete} />
      </div>
    </article>
  );
}
