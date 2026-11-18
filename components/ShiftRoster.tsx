import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { CalendarClock, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useLocale, useT } from '../services/i18n';
import { deleteRecords } from '../services/retention';
import { keyOfId } from '../services/schema';
import {
  isPast,
  isShift,
  isShiftSignup,
  keyOfSignup,
  openSlots,
  readShiftDraft,
  signupKey,
  signupsOf,
  toShiftDraft,
  type Shift,
  type ShiftDraft,
  type ShiftProblem,
} from '../services/shifts';
import { useRecords, useSync } from '../services/sync';
import { useNow } from '../services/time';
import { Button, EmptyState, Field, IconButton, Modal, Notice, ToolHeader, inputClass } from './ui';

const EMPTY_DRAFT: ShiftDraft = { title: '', location: '', date: '', startTime: '', endTime: '', needed: '1', notes: '' };

export default function ShiftRoster() {
  const t = useT();
  const locale = useLocale();
  const now = useNow();
  const { doc, memberId, memberName } = useSync();
  const { records: shifts, map } = useRecords('shifts', isShift, keyOfId);
  const { records: signups, map: signupMap } = useRecords('shiftSignups', isShiftSignup, keyOfSignup);
  const [showPast, setShowPast] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; draft: ShiftDraft } | null>(null);
  const [problem, setProblem] = useState<ShiftProblem | null>(null);

  const visible = useMemo(
    () => shifts.filter((shift) => showPast || !isPast(shift, now)).sort((a, b) => a.start - b.start),
    [shifts, showPast, now],
  );

  const remove = useCallback(
    (shift: Shift) => {
      if (!window.confirm(t('shifts.deleteConfirm'))) return;
      doc.transact(() => {
        deleteRecords(doc, 'shifts', [shift.id]);
        // The map can hold a bad record from a peer, so check each value.
        signupMap.forEach((signup: unknown, key) => {
          if (isShiftSignup(signup) && signup.shiftId === shift.id) signupMap.delete(key);
        });
      });
    },
    [doc, signupMap, t],
  );

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const fields = readShiftDraft(editing.draft);
    if (typeof fields === 'string') {
      setProblem(fields);
      return;
    }
    const id = editing.id ?? crypto.randomUUID();
    map.set(id, { id, ...fields });
    setEditing(null);
    setProblem(null);
  };

  const toggleSignup = (shift: Shift) => {
    const key = signupKey(shift.id, memberId);
    if (signupMap.has(key)) signupMap.delete(key);
    else signupMap.set(key, { shiftId: shift.id, memberId, name: memberName });
  };

  const field = (key: keyof ShiftDraft) => ({
    value: editing?.draft[key] ?? '',
    onChange: (event: { target: { value: string } }) => editing && setEditing({ ...editing, draft: { ...editing.draft, [key]: event.target.value } }),
    className: inputClass,
  });

  const day = (time: number) => new Date(time).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  const clock = (time: number) => new Date(time).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="space-y-8">
      <ToolHeader title={t('shifts.title')} subtitle={t('shifts.subtitle')}>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showPast} onChange={(event) => setShowPast(event.target.checked)} className="w-4 h-4 accent-emerald-600" />
          {t('shifts.showPast')}
        </label>
        <Button onClick={() => setEditing({ id: null, draft: EMPTY_DRAFT })}>
          <Plus className="w-5 h-5" aria-hidden="true" /> {t('shifts.new')}
        </Button>
      </ToolHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visible.length === 0 ? (
          <EmptyState icon={CalendarClock} title={t('shifts.empty')} />
        ) : (
          visible.map((shift) => {
            const people = signupsOf(shift, signups);
            const open = openSlots(shift, signups);
            const mine = signupMap.has(signupKey(shift.id, memberId));
            const past = isPast(shift, now);
            return (
              <article key={shift.id} className={`bg-white p-6 rounded-3xl border space-y-3 ${past ? 'opacity-60 border-slate-200' : open > 0 ? 'border-amber-300' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <h3 dir="auto" className="font-bold text-slate-900 text-lg leading-tight break-words min-w-0">{shift.title}</h3>
                  <div className="flex shrink-0">
                    <IconButton icon={Pencil} label={t('shifts.edit')} onClick={() => setEditing({ id: shift.id, draft: toShiftDraft(shift) })} />
                    <IconButton icon={Trash2} label={t('shifts.delete')} onClick={() => remove(shift)} />
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-700">
                  {day(shift.start)} · {clock(shift.start)} – {clock(shift.end)}
                </p>
                {shift.location && (
                  <p className="text-sm text-slate-600 flex items-start gap-1">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" aria-hidden="true" />
                    <span dir="auto" className="break-words min-w-0">{shift.location}</span>
                  </p>
                )}
                {shift.notes && <p dir="auto" className="text-sm text-slate-600 break-words whitespace-pre-wrap">{shift.notes}</p>}
                <p className={`text-xs font-bold ${open > 0 && !past ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {open > 0 ? t('shifts.needsMore', { count: open, signed: people.length, needed: shift.needed }) : t('shifts.full', { signed: people.length, needed: shift.needed })}
                </p>
                {people.length > 0 && (
                  <ul className="flex flex-wrap gap-1">
                    {people.map((person) => (
                      <li key={person.memberId} dir="auto" className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                        {person.name || t('common.anonymous')}
                      </li>
                    ))}
                  </ul>
                )}
                {!past && (
                  <Button variant={mine ? 'dark' : 'light'} className="w-full" aria-pressed={mine} onClick={() => toggleSignup(shift)}>
                    {mine ? t('shifts.leave') : t('shifts.signUp')}
                  </Button>
                )}
              </article>
            );
          })
        )}
      </div>

      {editing && (
        <Modal
          title={editing.id ? t('shifts.edit') : t('shifts.new')}
          onClose={() => {
            setEditing(null);
            setProblem(null);
          }}
        >
          <form onSubmit={save} className="space-y-4">
            <Field label={t('shifts.field.title')}>
              <input {...field('title')} dir="auto" autoFocus required placeholder={t('shifts.hint.title')} />
            </Field>
            <Field label={t('shifts.field.location')}>
              <input {...field('location')} dir="auto" />
            </Field>
            <Field label={t('shifts.field.date')}>
              <input type="date" {...field('date')} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('shifts.field.start')}>
                <input type="time" {...field('startTime')} required />
              </Field>
              <Field label={t('shifts.field.end')}>
                <input type="time" {...field('endTime')} required />
              </Field>
            </div>
            <Field label={t('shifts.field.needed')}>
              <input type="number" min={1} max={999} {...field('needed')} required />
            </Field>
            <Field label={t('shifts.field.notes')}>
              <textarea {...field('notes')} dir="auto" rows={2} />
            </Field>
            {problem && <Notice tone="error">{t(`shifts.problem.${problem}`)}</Notice>}
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
