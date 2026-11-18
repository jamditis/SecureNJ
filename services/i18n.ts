/**
 * All UI text is in `locales/`. A component gets text with `useT()`.
 * To add a language: copy the files in `locales/en/` to a new folder,
 * translate the values, and add the language to `LOCALES`.
 */
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en from '../locales/en/index';
import es from '../locales/es/index';

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** Each language shows its own name, so a reader can find it in any UI language. */
export const LOCALES = {
  en: { label: 'English', messages: en as Messages },
  es: { label: 'Español', messages: es },
} as const;
export type Locale = keyof typeof LOCALES;

const STORAGE_KEY = 'snj.locale';

/** Replaces each `{name}` in a message with the value of `vars.name`. */
export function makeTranslate(messages: Messages): Translate {
  return (key, vars) => {
    const template = messages[key];
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
  };
}

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
  setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18n>({ locale: 'en', t: makeTranslate(en), setLocale: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => pickLocale(localStorage.getItem(STORAGE_KEY), navigator.languages));

  const value = useMemo<I18n>(
    () => ({
      locale,
      t: makeTranslate(LOCALES[locale].messages),
      setLocale: (next) => {
        localStorage.setItem(STORAGE_KEY, next);
        setLocaleState(next);
      },
    }),
    [locale],
  );

  // Screen readers and the browser use these to select a voice and a spell checker.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = value.t('app.title');
  }, [locale, value]);

  return createElement(I18nContext.Provider, { value }, children);
}

export const useI18n = (): I18n => useContext(I18nContext);
export const useT = (): Translate => useContext(I18nContext).t;
export const useLocale = (): Locale => useContext(I18nContext).locale;
