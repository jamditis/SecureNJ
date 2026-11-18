/**
 * All UI text is in `locales/`. A component gets text with `useT()`.
 * To add a language: copy `locales/en.ts`, translate the values, and
 * supply the result through `I18nContext`.
 */
import { createContext, useContext } from 'react';
import en from '../locales/en';

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** Replaces each `{name}` in a message with the value of `vars.name`. */
export function makeTranslate(messages: Messages): Translate {
  return (key, vars) => {
    const template = messages[key];
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
  };
}

export interface I18n {
  locale: string;
  t: Translate;
}

export const I18nContext = createContext<I18n>({ locale: 'en', t: makeTranslate(en) });

export const useT = (): Translate => useContext(I18nContext).t;
export const useLocale = (): string => useContext(I18nContext).locale;
