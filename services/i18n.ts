/**
 * All UI text is in `locales/`. A component gets text with `useT()`.
 *
 * English is the source: `locales/en/` for UI text, `content/` for reference
 * text. Each other language is one file, `locales/<code>.json`, which a
 * machine writes (`scripts/translate.ts`). A message with no translation, or
 * with a translation that fails the check in `messages.ts`, shows in English.
 *
 * To add a language: add it to `LOCALES` and to `TARGETS` in
 * `scripts/translate.ts`, and add an empty file `locales/<code>.json`.
 */
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en from '../locales/en/index';
import ar from '../locales/ar.json';
import es from '../locales/es.json';
import ht from '../locales/ht.json';
import pt from '../locales/pt.json';
import zh from '../locales/zh.json';
import { englishContent, type ContentLookup } from './contentText';
import { usableTranslation, type Translation } from './messages';

export type MessageKey = keyof typeof en;
export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

interface LocaleInfo {
  /** The name of the language in that language, so a reader can find it in any UI language. */
  label: string;
  /** The value of the `lang` attribute of the page. */
  htmlLang: string;
  /** The direction of the text. */
  dir: 'ltr' | 'rtl';
  /** The content of the language file. `null` for English, which is the source. */
  file: unknown;
}

export const LOCALES = {
  en: { label: 'English', htmlLang: 'en', dir: 'ltr', file: null },
  es: { label: 'Español', htmlLang: 'es', dir: 'ltr', file: es },
  pt: { label: 'Português (Brasil)', htmlLang: 'pt-BR', dir: 'ltr', file: pt },
  ht: { label: 'Kreyòl ayisyen', htmlLang: 'ht', dir: 'ltr', file: ht },
  zh: { label: '简体中文', htmlLang: 'zh-Hans', dir: 'ltr', file: zh },
  ar: { label: 'العربية', htmlLang: 'ar', dir: 'rtl', file: ar },
} as const satisfies Record<string, LocaleInfo>;
export type Locale = keyof typeof LOCALES;

const STORAGE_KEY = 'snj.locale';
const NO_TRANSLATION: Translation = {};
const checked = new Map<Locale, Translation>();

/** The translated messages of a language that are safe to show. Empty for English. */
export function translationOf(locale: Locale): Translation {
  if (locale === 'en') return NO_TRANSLATION;
  let translation = checked.get(locale);
  if (!translation) {
    translation = usableTranslation(LOCALES[locale].file);
    checked.set(locale, translation);
  }
  return translation;
}

/**
 * Returns the function that gives the text of a key. A key with no
 * translation gives the English text. Each `{name}` in the text is replaced
 * with the value of `vars.name`.
 */
export function makeTranslate(translation: Translation = NO_TRANSLATION): Translate {
  return (key, vars) => {
    const template = translation[key] ?? en[key];
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
  };
}

/** Returns the lookup for reference text (see `contentText.ts`). */
export const makeContentLookup =
  (translation: Translation = NO_TRANSLATION): ContentLookup =>
  (key, english) =>
    translation[key] ?? english;

const isLocale = (value: string): value is Locale => Object.hasOwn(LOCALES, value);

/** The saved choice of the user comes first, then the languages of the browser, then English. */
export function pickLocale(saved: string | null, browserLanguages: readonly string[]): Locale {
  if (saved && isLocale(saved)) return saved;
  for (const language of browserLanguages) {
    const base = language.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

export interface I18n {
  locale: Locale;
  t: Translate;
  /** The lookup for reference text. */
  content: ContentLookup;
  setLocale: (locale: Locale) => void;
}

/** The value of the context for one language. Tests use it to show a component in that language. */
export function i18nFor(locale: Locale, setLocale: (locale: Locale) => void = () => {}): I18n {
  const translation = translationOf(locale);
  return { locale, t: makeTranslate(translation), content: makeContentLookup(translation), setLocale };
}

export const I18nContext = createContext<I18n>({ locale: 'en', t: makeTranslate(), content: englishContent, setLocale: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => pickLocale(localStorage.getItem(STORAGE_KEY), navigator.languages));

  const value = useMemo<I18n>(
    () =>
      i18nFor(locale, (next) => {
        localStorage.setItem(STORAGE_KEY, next);
        setLocaleState(next);
      }),
    [locale],
  );

  // Screen readers and the browser use the language to select a voice and a
  // spell checker. The direction puts the layout on the correct side.
  useEffect(() => {
    document.documentElement.lang = LOCALES[locale].htmlLang;
    document.documentElement.dir = LOCALES[locale].dir;
    document.title = value.t('app.title');
  }, [locale, value]);

  return createElement(I18nContext.Provider, { value }, children);
}

export const useI18n = (): I18n => useContext(I18nContext);
export const useT = (): Translate => useContext(I18nContext).t;
export const useLocale = (): Locale => useContext(I18nContext).locale;
export const useContentText = (): ContentLookup => useContext(I18nContext).content;
