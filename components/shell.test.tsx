// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../locales/en/index';
import es from '../locales/es/index';
import { I18nContext, LOCALES, makeTranslate } from '../services/i18n';
import { hasUnsavedWork, useUnsavedWork } from '../services/unsaved';
import { TOOLS, readRoute } from '../tools';
import LanguageSwitch from './LanguageSwitch';
import LimitsPage from './LimitsPage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('page about limits', () => {
  it('shows each limit, in English and in Spanish', () => {
    render(<LimitsPage />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4 + 13 + 5);
    expect(screen.getByText("Data on your device isn't encrypted.")).toBeTruthy();
    cleanup();

    render(
      <I18nContext.Provider value={{ locale: 'es', t: makeTranslate(LOCALES.es.messages), setLocale: () => {} }}>
        <LimitsPage />
      </I18nContext.Provider>,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(4 + 13 + 5);
    expect(screen.getByText('Los datos en tu dispositivo no están cifrados.')).toBeTruthy();
  });
});

describe('language switch', () => {
  const inSpanish = (ui: React.ReactElement) => (
    <I18nContext.Provider value={{ locale: 'es', t: makeTranslate(LOCALES.es.messages), setLocale: () => {} }}>{ui}</I18nContext.Provider>
  );

  it('tells a reader of the Spanish text that a machine made it and that no person reviewed it', () => {
    render(inSpanish(<LanguageSwitch />));
    expect(screen.getByText(/traducción automática/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Avisar de un error' });
    expect(link.getAttribute('href')).toBe('https://github.com/jamditis/SecureNJ/issues');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('shows no such note for English, which is the source text', () => {
    render(<LanguageSwitch />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByLabelText('Language')).toBeTruthy();
  });
});

describe('text in two languages', () => {
  it('has the same placeholders in each Spanish message as in the English message', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(',');
    const different = (Object.keys(en) as (keyof typeof en)[]).filter((key) => placeholders(en[key]) !== placeholders(es[key]));
    expect(different).toEqual([]);
  });

  it('has no empty Spanish message', () => {
    expect(Object.entries(es).filter(([, text]) => text.trim() === '')).toEqual([]);
  });
});

describe('page addresses', () => {
  it('reads the page and the rest of the address', () => {
    expect(readRoute('#/phone-tree')).toEqual({ page: 'phone-tree', payload: '' });
    expect(readRoute('#/secure-share/snj2.abc%2Fdef/more')).toEqual({ page: 'secure-share', payload: 'snj2.abc%2Fdef/more' });
  });

  it('opens the start page for an unknown or empty address', () => {
    expect(readRoute('').page).toBe('dashboard');
    expect(readRoute('#/no-such-page').page).toBe('dashboard');
    expect(readRoute('#/__proto__').page).toBe('dashboard');
  });

  it('knows the address of each tool, which includes the addresses of the published site', () => {
    const oldAddresses = ['secure-share', 'lock-file', 'event-creator', 'rights-card', 'family-plan', 'phone-tree', 'witness-notes', 'photo-cleaner', 'resource-sheet', 'mutual-aid', 'status-board', 'safety-alerts', 'consensus', 'whiteboard', 'limits', 'resources', 'share'];
    for (const id of oldAddresses) expect(readRoute(`#/${id}`).page).toBe(id);
    for (const tool of TOOLS) expect(readRoute(`#/${tool.id}`).page).toBe(tool.id);
  });
});

describe('unsaved work', () => {
  function Tool({ dirty }: { dirty: boolean }) {
    useUnsavedWork(dirty);
    return null;
  }

  it('knows when a tool holds work that is not saved', () => {
    const { rerender, unmount } = render(<Tool dirty={false} />);
    expect(hasUnsavedWork()).toBe(false);
    rerender(<Tool dirty />);
    expect(hasUnsavedWork()).toBe(true);
    rerender(<Tool dirty={false} />);
    expect(hasUnsavedWork()).toBe(false);
    rerender(<Tool dirty />);
    unmount();
    expect(hasUnsavedWork()).toBe(false);
  });

  it('asks the browser to warn on reload or close only while work is not saved', () => {
    const { rerender } = render(<Tool dirty />);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    rerender(<Tool dirty={false} />);
    const later = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
  });
});
