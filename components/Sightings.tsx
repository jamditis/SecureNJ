import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { Clock, Eye, MapPin, Settings, ShieldAlert, ShieldCheck, Siren, Trash2 } from 'lucide-react';
import { alertState, confirmationKey, countConfirmations } from '../services/alerts';
import { useLocale, useT } from '../services/i18n';
import { ALERT_RETENTION, deleteRecords, expiredIds } from '../services/retention';
import { isConfirmation, isSighting, keyOfConfirmation, keyOfId } from '../services/schema';
import { useRecords, useSharedSetting, useSync } from '../services/sync';
import { timeAgo, useNow } from '../services/time';
import type { Sighting, SightingType } from '../types';
import { Button, EmptyState, Field, IconButton, Modal, Notice, ToolHeader, inputClass } from './ui';

const TYPES: SightingType[] = ['raid', 'checkpoint', 'surveillance', 'other'];
const RETENTION_HOURS = [1, 4, 12, 24];

const TYPE_STYLE: Record<SightingType, string> = {
  raid: 'bg-red-100 text-red-800 border-red-200',
  checkpoint: 'bg-orange-100 text-orange-800 border-orange-200',
  surveillance: 'bg-amber-100 text-amber-800 border-amber-200',
  other: 'bg-slate-100 text-slate-800 border-slate-200',
};

const EMPTY_REPORT = { type: 'raid' as SightingType, location: '', description: '', size: '', uniform: '', equipment: '' };

export default function Sightings() {
  const t = useT();
  const locale = useLocale();
  const now = useNow();
  const { doc, memberId, space } = useSync();
  const { records: sightings, map } = useRecords('sightings', isSighting, keyOfId);
  const { records: confirmations, map: confirmationMap } = useRecords('confirmations', isConfirmation, keyOfConfirmation);
  const [retention, setRetention] = useSharedSetting(ALERT_RETENTION);
  const [isReporting, setIsReporting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [report, setReport] = useState(EMPTY_REPORT);

  /** Deletes reports and the confirmations that belong to them. */
  const remove = useCallback(
    (ids: string[]) => {
      doc.transact(() => {
        // The marker keeps a deleted report deleted if a member changes it at the same time.
        deleteRecords(doc, 'sightings', ids);
        // The map can hold a bad record from a peer, so check each value.
        confirmationMap.forEach((confirmation: unknown, key) => {
          if (isConfirmation(confirmation) && ids.includes(confirmation.sightingId)) confirmationMap.delete(key);
        });
      });
    },
    [doc, confirmationMap],
  );
  // The data layer deletes expired reports. This filter hides them until it does.
  const sorted = useMemo(() => {
    const expired = new Set(expiredIds(sightings, now, retention));
    return sightings.filter((s) => !expired.has(s.id)).sort((a, b) => b.timestamp - a.timestamp);
  }, [sightings, now, retention]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (report.location.trim() === '') return;
    const id = crypto.randomUUID();
    map.set(id, { ...report, id, timestamp: Date.now(), reporterId: memberId, clearedAt: null });
    setReport(EMPTY_REPORT);
    setIsReporting(false);
  };

  const toggleConfirm = (sighting: Sighting) => {
    const key = confirmationKey(sighting.id, memberId);
    if (confirmationMap.has(key)) confirmationMap.delete(key);
    else confirmationMap.set(key, { sightingId: sighting.id, memberId });
  };

  const toggleClear = (sighting: Sighting) => {
    map.set(sighting.id, { ...sighting, clearedAt: sighting.clearedAt === null ? Date.now() : null });
  };

  const text = (key: keyof typeof EMPTY_REPORT) => ({
    value: report[key],
    onChange: (event: { target: { value: string } }) => setReport({ ...report, [key]: event.target.value }),
    className: inputClass,
    // A report can be in a different language than the UI.
    dir: 'auto',
  });

  return (
    <div className="space-y-8">
      <ToolHeader title={t('alerts.title')} subtitle={t('alerts.subtitle', { hours: retention })}>
        <IconButton icon={Settings} label={t('alerts.settings')} onClick={() => setShowSettings(!showSettings)} />
        <Button variant="danger" onClick={() => setIsReporting(true)}>
          <Siren className="w-5 h-5" aria-hidden="true" /> {t('alerts.report')}
        </Button>
      </ToolHeader>

      {showSettings && (
        <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-3">
          <Field label={t('alerts.retention')}>
            <select value={retention} onChange={(event) => setRetention(Number(event.target.value))} className={inputClass}>
              {RETENTION_HOURS.map((hours) => (
                <option key={hours} value={hours}>
                  {t('alerts.retentionOption', { hours })}
                </option>
              ))}
            </select>
          </Field>
          <Notice>{t('alerts.retentionNote')}</Notice>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sorted.length === 0 ? (
          <EmptyState icon={ShieldAlert} title={t('alerts.empty')} text={t('alerts.emptyNote')} />
        ) : (
          sorted.map((item) => {
            const state = alertState(item, confirmations);
            const count = countConfirmations(item, confirmations);
            const mine = item.reporterId === memberId;
            const confirmedByMe = confirmationMap.has(confirmationKey(item.id, memberId));
            const details = (['size', 'uniform', 'equipment'] as const).filter((key) => item[key] !== '');
            return (
              <article
                key={item.id}
                className={`bg-white p-6 rounded-3xl border shadow-sm space-y-3 ${state === 'cleared' ? 'border-slate-200 opacity-70' : state === 'confirmed' ? 'border-red-300' : 'border-slate-200'}`}
              >
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${TYPE_STYLE[item.type]}`}>
                    {t(`alerts.type.${item.type}`)}
                  </span>
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" aria-hidden="true" /> {timeAgo(item.timestamp, now, locale)}
                  </span>
                </div>
                <p
                  className={`text-xs font-bold ${state === 'cleared' ? 'text-emerald-700' : state === 'confirmed' ? 'text-red-700' : 'text-amber-700'}`}
                >
                  {state === 'confirmed' ? t('alerts.state.confirmed', { count }) : t(`alerts.state.${state}`)}
                </p>
                <h3 className="font-bold text-slate-900 text-lg flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span dir="auto" className="break-words min-w-0">{item.location}</span>
                </h3>
                {item.description && <p dir="auto" className="text-slate-600 text-sm break-words whitespace-pre-wrap">{item.description}</p>}
                {details.length > 0 && (
                  <dl className="text-xs text-slate-600 space-y-1">
                    {details.map((key) => (
                      <div key={key}>
                        <dt className="inline font-bold">{t(`alerts.field.${key}`)}: </dt>
                        <dd dir="auto" className="inline break-words">{item[key]}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <Button
                    variant={confirmedByMe ? 'dark' : 'light'}
                    className="!px-3 !py-1.5 !text-xs"
                    disabled={mine || state === 'cleared'}
                    title={mine ? t('alerts.ownReport') : undefined}
                    aria-pressed={confirmedByMe}
                    onClick={() => toggleConfirm(item)}
                  >
                    <Eye className="w-4 h-4" aria-hidden="true" /> {t('alerts.confirm')}
                  </Button>
                  <Button variant="light" className="!px-3 !py-1.5 !text-xs" onClick={() => toggleClear(item)}>
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    {item.clearedAt === null ? t('alerts.markClear') : t('alerts.reopen')}
                  </Button>
                  <IconButton icon={Trash2} label={t('alerts.remove')} className="ms-auto" onClick={() => remove([item.id])} />
                </div>
              </article>
            );
          })
        )}
      </div>

      {isReporting && (
        <Modal title={t('alerts.reportTitle')} onClose={() => setIsReporting(false)}>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((type) => (
                <Button
                  key={type}
                  variant={report.type === type ? 'dark' : 'light'}
                  aria-pressed={report.type === type}
                  onClick={() => setReport({ ...report, type })}
                >
                  {t(`alerts.type.${type}`)}
                </Button>
              ))}
            </div>
            <Field label={t('alerts.field.location')}>
              <input {...text('location')} autoFocus required placeholder={t('alerts.hint.location')} />
            </Field>
            <Field label={t('alerts.field.description')}>
              <textarea {...text('description')} rows={2} placeholder={t('alerts.hint.description')} />
            </Field>
            <Field label={t('alerts.field.size')}>
              <input {...text('size')} placeholder={t('alerts.hint.size')} />
            </Field>
            <Field label={t('alerts.field.uniform')}>
              <input {...text('uniform')} placeholder={t('alerts.hint.uniform')} />
            </Field>
            <Field label={t('alerts.field.equipment')}>
              <input {...text('equipment')} placeholder={t('alerts.hint.equipment')} />
            </Field>
            <Notice tone="warning">{t('alerts.safety')}</Notice>
            <Notice>{space ? t('alerts.goesToSpace', { name: space.name }) : t('alerts.staysLocal')}</Notice>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setIsReporting(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="danger" className="flex-1">
                {t('alerts.send')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
