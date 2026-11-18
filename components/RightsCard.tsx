import { Fragment, useId, useMemo, useState, type ReactNode } from 'react';
import { Printer } from 'lucide-react';
import { RAPID_RESPONSE_HOTLINE } from '../content/hotlines';
import { RIGHTS_LINKS } from '../content/rightsCard';
import { englishContent, rightsCardText } from '../services/contentText';
import { useContentText, useLocale, useT } from '../services/i18n';
import { CONTACT_MAX_LENGTH, contactRows, defaultContacts, isDefaultHotline, splitTemplate, type ContactKey } from '../services/rights';
import { Button, Notice, ToolHeader, inputClass } from './ui';

/** A link to a different site. It opens in a new tab and sends no referrer. */
function OutsideLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2 hover:text-emerald-700">
      {children}
    </a>
  );
}

/** A message from the locale file, with a link or a name at each `{slot}`. */
function Rich({ template, slots }: { template: string; slots: Record<string, ReactNode> }) {
  return (
    <>
      {splitTemplate(template).map((part, index) => (
        <Fragment key={index}>{part.kind === 'text' ? part.value : (slots[part.name] ?? `{${part.name}}`)}</Fragment>
      ))}
    </>
  );
}

const labelClass = 'block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5';
const hintClass = 'text-xs text-slate-500 leading-relaxed mt-1.5';
const sectionTitleClass = 'text-lg font-bold text-slate-900';

export default function RightsCard() {
  const t = useT();
  const locale = useLocale();
  const content = useContentText();
  // The card is a machine translation in each language but English. A person
  // can show and print the English text, which is the source.
  const [inEnglish, setInEnglish] = useState(false);
  const cardIsEnglish = inEnglish || locale === 'en';
  const card = useMemo(() => rightsCardText(inEnglish ? englishContent : content), [inEnglish, content]);
  // The three lines are in memory only. A reload of the page removes them.
  const [contacts, setContacts] = useState(defaultContacts);
  const id = useId();
  const rows = contactRows(contacts);
  const showHotlineHint = isDefaultHotline(contacts.hotline);

  const input = (key: ContactKey, hintId?: string) => (
    <input
      id={`${id}-${key}`}
      value={contacts[key]}
      onChange={(event) => setContacts({ ...contacts, [key]: event.target.value })}
      maxLength={CONTACT_MAX_LENGTH}
      autoComplete="off"
      aria-describedby={hintId}
      // A name and a phone number take the direction of their own text.
      dir="auto"
      className={inputClass}
    />
  );

  return (
    <div className="space-y-8">
      <div className="no-print space-y-6">
        <ToolHeader title={t('rights.title')} subtitle={t('rights.lede')} synced={false} />

        <Notice tone="warning">
          <Rich template={t('rights.notice')} slots={{ guide: <OutsideLink href={RIGHTS_LINKS.acluGuide}>{t('rights.notice.guide')}</OutsideLink> }} />
        </Notice>

        {locale !== 'en' && (
          <Notice>
            <Rich
              template={t('rights.translated')}
              slots={{ ilrc: <OutsideLink href={RIGHTS_LINKS.ilrcRedCards}>{t('rights.translated.ilrc')}</OutsideLink> }}
            />
            <label className="flex items-center gap-2 mt-2 font-bold">
              <input type="checkbox" checked={inEnglish} onChange={(event) => setInEnglish(event.target.checked)} className="w-4 h-4 shrink-0 accent-emerald-600" />
              {t('rights.showEnglish')}
            </label>
          </Notice>
        )}

        <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 max-w-xl">
          <div>
            <label htmlFor={`${id}-hotline`} className={labelClass}>
              {t('rights.field.hotline')}
            </label>
            {input('hotline', showHotlineHint ? `${id}-hotline-hint` : undefined)}
            {showHotlineHint && (
              <p id={`${id}-hotline-hint`} className={hintClass}>
                <Rich
                  template={t('rights.hint.hotline')}
                  slots={{
                    name: RAPID_RESPONSE_HOTLINE.name,
                    source: <OutsideLink href={RAPID_RESPONSE_HOTLINE.sourceUrl}>{RAPID_RESPONSE_HOTLINE.sourceName}</OutsideLink>,
                  }}
                />
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${id}-lawyer`} className={labelClass}>
              {t('rights.field.lawyer')}
            </label>
            {input('lawyer')}
          </div>
          <div>
            <label htmlFor={`${id}-contact`} className={labelClass}>
              {t('rights.field.contact')}
            </label>
            {input('contact', `${id}-contact-hint`)}
            <p id={`${id}-contact-hint`} className={hintClass}>
              {t('rights.hint.contact')}
            </p>
          </div>
          <Button onClick={() => window.print()}>
            <Printer className="w-5 h-5" aria-hidden="true" /> {t('rights.print')}
          </Button>
        </div>

        <h3 className={sectionTitleClass}>{t('rights.yourCard')}</h3>
      </div>

      {/* The card is the one part of the page that prints. */}
      <section
        aria-label={t('rights.cardLabel')}
        lang={cardIsEnglish ? 'en' : undefined}
        dir={cardIsEnglish ? 'ltr' : undefined}
        className="bg-white text-black border-2 border-black max-w-xl p-4 text-sm leading-snug space-y-2 break-inside-avoid"
      >
        <h3 className="font-serif text-xl font-bold">{card.title}</h3>
        {card.sections.map((section) => (
          <Fragment key={section.heading}>
            <h4 className="font-bold">{section.heading}</h4>
            <ul className="list-disc ps-5 space-y-0.5">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Fragment>
        ))}
        {rows.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-black pt-2">
            {rows.map((row) => (
              <Fragment key={row.key}>
                <dt className="font-bold">{card.contactLabels[row.key]}</dt>
                <dd dir="auto" className="break-words min-w-0">{row.value}</dd>
              </Fragment>
            ))}
          </dl>
        )}
        <p className="text-xs">{card.sourceLine}</p>
      </section>

      <div className="no-print space-y-6">
        <div className="space-y-2">
          <h3 className={sectionTitleClass}>{t('rights.official.title')}</h3>
          <ul className="list-disc ps-5 space-y-1 text-sm text-slate-700">
            <li>
              <Rich template={t('rights.official.ilrc')} slots={{ link: <OutsideLink href={RIGHTS_LINKS.ilrcRedCards}>{t('rights.official.ilrc.link')}</OutsideLink> }} />
            </li>
            <li>
              <Rich template={t('rights.official.nj')} slots={{ link: <OutsideLink href={RIGHTS_LINKS.njNewAmericans}>{t('rights.official.nj.link')}</OutsideLink> }} />
            </li>
            <li>
              <Rich
                template={t('rights.official.aclu')}
                slots={{
                  spanish: <OutsideLink href={RIGHTS_LINKS.acluGuideSpanish}>{t('rights.official.aclu.spanish')}</OutsideLink>,
                  main: <OutsideLink href={RIGHTS_LINKS.acluGuide}>{t('rights.official.aclu.main')}</OutsideLink>,
                }}
              />
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className={sectionTitleClass}>{t('rights.phone.title')}</h3>
          <ul className="list-disc ps-5 space-y-1 text-sm text-slate-700">
            <li>{t('rights.phone.memorize')}</li>
            <li>{t('rights.phone.passcode')}</li>
            <li>
              <Rich
                template={t('rights.phone.eff')}
                slots={{ link: <OutsideLink href={RIGHTS_LINKS.effSurveillanceSelfDefense}>{t('rights.phone.eff.link')}</OutsideLink> }}
              />
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
