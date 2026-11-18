import { Languages } from 'lucide-react';
import { SOURCE_CODE_URL } from '../content/resources';
import { LOCALES, useI18n, type Locale } from '../services/i18n';

/** English is the source text. A person must review each other language before it loses its note. */
const REVIEWED_LOCALES: ReadonlySet<Locale> = new Set<Locale>(['en']);

/**
 * The language choice. For a language that no person has reviewed, it says
 * so, and it gives a place to report an error: a wrong translation of a
 * safety text can mislead a reader.
 */
export default function LanguageSwitch() {
  const { t, locale, setLocale } = useI18n();
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 px-4 text-sm">
        <Languages className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">{t('language.label')}</span>
        <select
          value={locale}
          onChange={(event) => setLocale(event.target.value as Locale)}
          className="flex-1 bg-slate-800 text-white rounded-lg px-2 py-1.5 text-sm"
        >
          {(Object.keys(LOCALES) as Locale[]).map((code) => (
            <option key={code} value={code} lang={code}>
              {LOCALES[code].label}
            </option>
          ))}
        </select>
      </label>
      {!REVIEWED_LOCALES.has(locale) && (
        <p className="px-4 text-xs leading-relaxed text-amber-300">
          {t('language.machineNote')}{' '}
          <a href={`${SOURCE_CODE_URL}/issues`} target="_blank" rel="noopener noreferrer" className="underline">
            {t('language.report')}
          </a>
        </p>
      )}
    </div>
  );
}
