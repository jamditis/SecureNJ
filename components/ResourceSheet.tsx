import { useState } from 'react';
import { Check, Copy, Plus, Printer, Trash2 } from 'lucide-react';
import { NOTE_EXAMPLE, SPANISH_LINKS, STARTER_LISTINGS } from '../content/resourceSheet';
import { useLocale, useT } from '../services/i18n';
import {
  addStarters,
  browserStorage,
  clearDraft,
  contactHref,
  emptyListing,
  loadDraft,
  namedListings,
  removeListing,
  saveDraft,
  sheetText,
  updateListing,
  type ListingField,
  type SheetDraft,
} from '../services/sheet';
import { Button, Field, Notice, ToolHeader, inputClass } from './ui';

const LISTING_FIELDS: readonly ListingField[] = ['name', 'offers', 'when', 'contact'];
const linkClass = 'underline underline-offset-2 hover:text-emerald-700 print:no-underline';

/** A contact shows as a link only if `contactHref` allows its address. */
function Contact({ value }: { value: string }) {
  const href = contactHref(value);
  if (!href) return <span className="block font-semibold break-words">{value}</span>;
  const web = href.startsWith('http');
  return (
    <a href={href} target={web ? '_blank' : undefined} rel={web ? 'noopener noreferrer' : undefined} className={`block font-semibold break-words ${linkClass}`}>
      {value}
    </a>
  );
}

/**
 * A list of local help that a person prints or copies as text. The sheet is
 * on this page only. The browser keeps a draft only while the box is ticked.
 */
export default function ResourceSheet() {
  const t = useT();
  const locale = useLocale();
  const [initial] = useState(() => {
    const draft = loadDraft(browserStorage(), t('sheet.defaultTitle'));
    return { keepDraft: draft !== null, sheet: draft ?? { title: t('sheet.defaultTitle'), note: '', entries: [emptyListing()] } };
  });
  const [sheet, setSheet] = useState<SheetDraft>(initial.sheet);
  const [keepDraft, setKeepDraft] = useState(initial.keepDraft);
  const [draftProblem, setDraftProblem] = useState<'draftNotSaved' | 'draftNotDeleted' | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  /** Each change goes through here, so that the stored draft is the sheet on the screen, or is gone. */
  const apply = (next: SheetDraft, keep: boolean = keepDraft) => {
    setSheet(next);
    setKeepDraft(keep);
    setCopyState('idle');
    if (keep) setDraftProblem(saveDraft(browserStorage(), next) ? null : 'draftNotSaved');
    else setDraftProblem(clearDraft(browserStorage()) ? null : 'draftNotDeleted');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sheetText(sheet));
      setCopyState('copied');
    } catch {
      // The browser has no clipboard on a page without HTTPS, or the person did not allow it.
      setCopyState('failed');
    }
  };

  const listed = namedListings(sheet.entries);

  return (
    <div className="space-y-8">
      <div className="no-print space-y-8">
        <ToolHeader title={t('sheet.title')} subtitle={t('sheet.lede')} synced={false} />
        <Notice tone="warning">{t('sheet.notice')}</Notice>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4">
          <Field label={t('sheet.field.title')}>
            <input value={sheet.title} onChange={(event) => apply({ ...sheet, title: event.target.value })} className={inputClass} />
          </Field>
          <Field label={t('sheet.field.note')}>
            <input value={sheet.note} placeholder={NOTE_EXAMPLE} onChange={(event) => apply({ ...sheet, note: event.target.value })} className={inputClass} />
          </Field>
        </div>

        <section className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">{t('sheet.listings')}</h3>
          {sheet.entries.map((entry, index) => (
            <fieldset key={entry.id} className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4">
              <legend className="px-2 text-sm font-bold text-slate-900">{t('sheet.listing', { number: index + 1 })}</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LISTING_FIELDS.map((field) => (
                  <Field key={field} label={t(`sheet.field.${field}`)}>
                    <input
                      value={entry[field]}
                      onChange={(event) => apply({ ...sheet, entries: updateListing(sheet.entries, entry.id, field, event.target.value) })}
                      className={inputClass}
                    />
                  </Field>
                ))}
              </div>
              <Button
                variant="ghost"
                aria-label={t('sheet.removeListing', { number: index + 1 })}
                onClick={() => apply({ ...sheet, entries: removeListing(sheet.entries, entry.id) })}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" /> {t('sheet.remove')}
              </Button>
            </fieldset>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button variant="light" onClick={() => apply({ ...sheet, entries: [...sheet.entries, emptyListing()] })}>
              <Plus className="w-5 h-5" aria-hidden="true" /> {t('sheet.add')}
            </Button>
            <Button variant="light" onClick={() => apply({ ...sheet, entries: addStarters(sheet.entries, STARTER_LISTINGS) })}>
              {t('sheet.addStarters')}
            </Button>
          </div>

          {locale !== 'en' && (
            <div className="text-xs leading-relaxed p-3 rounded-xl border bg-slate-50 border-slate-200 text-slate-600 space-y-1">
              <p>{t('sheet.startersInEnglish')}</p>
              <ul className="list-disc pl-5">
                {SPANISH_LINKS.map((link) => (
                  <li key={link.id}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {t(`sheet.spanishLink.${link.id}`)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={keepDraft} onChange={(event) => apply(sheet, event.target.checked)} className="w-4 h-4 mt-0.5 shrink-0 accent-emerald-600" />
            <span>{t('sheet.keepDraft')}</span>
          </label>
          {draftProblem && <Notice tone="error">{t(`sheet.${draftProblem}`)}</Notice>}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-900">{t('sheet.yourSheet')}</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => window.print()}>
              <Printer className="w-5 h-5" aria-hidden="true" /> {t('sheet.print')}
            </Button>
            <Button variant="light" onClick={() => void copy()}>
              {copyState === 'copied' ? <Check className="w-5 h-5" aria-hidden="true" /> : <Copy className="w-5 h-5" aria-hidden="true" />}
              <span aria-live="polite">{copyState === 'copied' ? t('common.copied') : t('sheet.copy')}</span>
            </Button>
          </div>
        </div>
        {copyState === 'failed' && <Notice tone="error">{t('sheet.copyFailed')}</Notice>}
      </div>

      <section aria-label={t('sheet.sheetLabel')} className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 space-y-4 text-slate-900 print:border-0 print:p-0 print:rounded-none">
        {sheet.title && <h3 className="text-2xl font-bold break-words">{sheet.title}</h3>}
        {sheet.note && <p className="text-sm text-slate-600 break-words">{sheet.note}</p>}
        {listed.length === 0 ? (
          <p className="no-print text-sm text-slate-500">{t('sheet.empty')}</p>
        ) : (
          <ul className="space-y-4">
            {listed.map((entry) => (
              <li key={entry.id} className="text-sm leading-relaxed break-inside-avoid">
                <strong className="block text-base break-words">{entry.name}</strong>
                {entry.offers && <span className="block break-words">{entry.offers}</span>}
                {entry.when && <span className="block break-words">{entry.when}</span>}
                {entry.contact && <Contact value={entry.contact} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
