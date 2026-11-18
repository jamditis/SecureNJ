import { useMemo, useState, type FormEvent } from 'react';
import { Minus, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useT } from '../services/i18n';
import { keyOfId } from '../services/schema';
import { clampDelta, isLow, isSupplyAdjustment, isSupplyItem, quantityOf, type SupplyItem } from '../services/supplies';
import { useRecords, useSync } from '../services/sync';
import { Button, EmptyState, Field, IconButton, Modal, ToolHeader, inputClass } from './ui';

interface Draft {
  name: string;
  unit: string;
  location: string;
  lowAt: string;
  notes: string;
  /** Only for a new item: the stock at the start. */
  quantity: string;
}
const EMPTY_DRAFT: Draft = { name: '', unit: '', location: '', lowAt: '0', notes: '', quantity: '0' };

export default function SupplyInventory() {
  const t = useT();
  const { doc } = useSync();
  const { records: items, map } = useRecords('supplies', isSupplyItem, keyOfId);
  const { records: adjustments, map: adjustmentMap } = useRecords('supplyAdjustments', isSupplyAdjustment, keyOfId);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter((item) => term === '' || `${item.name} ${item.location}`.toLowerCase().includes(term))
      .filter((item) => !lowOnly || isLow(item, adjustments))
      .sort((a, b) => Number(isLow(b, adjustments)) - Number(isLow(a, adjustments)) || a.name.localeCompare(b.name));
  }, [items, adjustments, search, lowOnly]);

  /** Adds one record for the change. The quantity is the sum of these records. */
  const adjust = (item: SupplyItem, delta: number) => {
    const change = clampDelta(delta, quantityOf(item.id, adjustments));
    if (change === 0) return;
    const id = crypto.randomUUID();
    adjustmentMap.set(id, { id, itemId: item.id, delta: change, timestamp: Date.now() });
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!editing || editing.draft.name.trim() === '') return;
    const { draft } = editing;
    const id = editing.id ?? crypto.randomUUID();
    doc.transact(() => {
      map.set(id, {
        id,
        name: draft.name.trim(),
        unit: draft.unit.trim(),
        location: draft.location.trim(),
        lowAt: Math.max(0, Number(draft.lowAt) || 0),
        notes: draft.notes.trim(),
      });
      const start = Math.max(0, Number(draft.quantity) || 0);
      if (!editing.id && start > 0) {
        const adjustmentId = crypto.randomUUID();
        adjustmentMap.set(adjustmentId, { id: adjustmentId, itemId: id, delta: start, timestamp: Date.now() });
      }
    });
    setEditing(null);
  };

  const remove = (item: SupplyItem) => {
    if (!window.confirm(t('supplies.deleteConfirm', { name: item.name }))) return;
    doc.transact(() => {
      map.delete(item.id);
      // The map can hold a bad record from a peer, so check each value.
      adjustmentMap.forEach((adjustment: unknown, key) => {
        if (isSupplyAdjustment(adjustment) && adjustment.itemId === item.id) adjustmentMap.delete(key);
      });
    });
  };

  const field = (key: keyof Draft) => ({
    value: editing?.draft[key] ?? '',
    onChange: (event: { target: { value: string } }) => editing && setEditing({ ...editing, draft: { ...editing.draft, [key]: event.target.value } }),
    className: inputClass,
  });

  return (
    <div className="space-y-8">
      <ToolHeader title={t('supplies.title')} subtitle={t('supplies.subtitle')}>
        <Button onClick={() => setEditing({ id: null, draft: EMPTY_DRAFT })}>
          <Plus className="w-5 h-5" aria-hidden="true" /> {t('supplies.new')}
        </Button>
      </ToolHeader>

      <div className="flex flex-col md:flex-row gap-3 md:items-center bg-white p-4 rounded-3xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('supplies.search')} aria-label={t('supplies.search')} className={`${inputClass} pl-9`} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
          {t('supplies.lowOnly')}
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visible.length === 0 ? (
          <EmptyState icon={Package} title={t('supplies.empty')} />
        ) : (
          visible.map((item) => {
            const quantity = quantityOf(item.id, adjustments);
            const low = isLow(item, adjustments);
            const amount = Math.max(1, Math.floor(Number(amounts[item.id]) || 1));
            return (
              <article key={item.id} className={`bg-white p-6 rounded-3xl border space-y-3 ${low ? 'border-red-300' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-lg leading-tight break-words">{item.name}</h3>
                    {item.location && <p className="text-sm text-slate-500 break-words">{item.location}</p>}
                  </div>
                  <div className="flex shrink-0">
                    <IconButton
                      icon={Pencil}
                      label={t('supplies.edit', { name: item.name })}
                      onClick={() => setEditing({ id: item.id, draft: { ...item, lowAt: String(item.lowAt), quantity: '' } })}
                    />
                    <IconButton icon={Trash2} label={t('supplies.delete', { name: item.name })} onClick={() => remove(item)} />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-slate-900">
                  {quantity} <span className="text-base font-bold text-slate-500">{item.unit}</span>
                </p>
                {low && <p className="text-xs font-bold text-red-700">{t('supplies.low', { level: item.lowAt })}</p>}
                {item.notes && <p className="text-sm text-slate-600 break-words whitespace-pre-wrap">{item.notes}</p>}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <Button variant="light" disabled={quantity <= 0} onClick={() => adjust(item, -amount)} aria-label={t('supplies.take', { name: item.name })}>
                    <Minus className="w-4 h-4" aria-hidden="true" /> {t('supplies.takeShort')}
                  </Button>
                  <input
                    type="number"
                    min={1}
                    value={amounts[item.id] ?? '1'}
                    onChange={(event) => setAmounts({ ...amounts, [item.id]: event.target.value })}
                    aria-label={t('supplies.amount', { name: item.name })}
                    className={`${inputClass} !w-20 text-center`}
                  />
                  <Button variant="light" onClick={() => adjust(item, amount)} aria-label={t('supplies.add', { name: item.name })}>
                    <Plus className="w-4 h-4" aria-hidden="true" /> {t('supplies.addShort')}
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {editing && (
        <Modal title={editing.id ? t('supplies.editTitle') : t('supplies.new')} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-4">
            <Field label={t('supplies.field.name')}>
              <input {...field('name')} autoFocus required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              {!editing.id && (
                <Field label={t('supplies.field.quantity')}>
                  <input type="number" min={0} {...field('quantity')} />
                </Field>
              )}
              <Field label={t('supplies.field.unit')}>
                <input {...field('unit')} placeholder={t('supplies.hint.unit')} />
              </Field>
              <Field label={t('supplies.field.lowAt')}>
                <input type="number" min={0} {...field('lowAt')} />
              </Field>
            </div>
            <Field label={t('supplies.field.location')}>
              <input {...field('location')} />
            </Field>
            <Field label={t('supplies.field.notes')}>
              <textarea {...field('notes')} rows={2} />
            </Field>
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
