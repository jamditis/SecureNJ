// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_PROMPTS, RESOURCE_GROUPS, SOURCE_CODE_URL } from '../content/resources';
import { I18nContext, i18nFor, makeTranslate, translationOf, type Locale } from '../services/i18n';
import ResourcesPage from './ResourcesPage';
import SharePage from './SharePage';

// The address of a page in a test cannot be a file. This switch gives the
// share page the answer that a copy from a file gets.
const openedFromFile = vi.hoisted(() => ({ value: false }));
vi.mock('../services/sharePage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/sharePage')>();
  return { ...actual, appAddress: (location: Location) => (openedFromFile.value ? null : actual.appAddress(location)) };
});

const renderIn = (locale: Locale, ui: ReactElement) =>
  render(<I18nContext.Provider value={i18nFor(locale)}>{ui}</I18nContext.Provider>);

const ADDRESS = 'http://localhost:3000/toolkit/';

beforeEach(() => {
  openedFromFile.value = false;
  window.history.replaceState(null, '', '/toolkit/?from=test#/share');
});
afterEach(cleanup);

describe('resources page', () => {
  it('shows each link of the content file with its note', () => {
    render(<ResourcesPage />);
    const links = screen.getAllByRole('link');
    const items = RESOURCE_GROUPS.flatMap((group) => group.items);
    expect(links).toHaveLength(16);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(items.map((item) => item.url));
    for (const item of items) {
      expect(screen.getByRole('link', { name: `${item.name} (opens in a new tab)` }).getAttribute('href')).toBe(item.url);
      expect(screen.getByText(item.note)).toBeTruthy();
    }
  });

  it('opens each link in a new tab and gives the other site no handle on this page and no referrer', () => {
    render(<ResourcesPage />);
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\//);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('shows the four group headings and the four cautions', () => {
    render(<ResourcesPage />);
    for (const group of RESOURCE_GROUPS) expect(screen.getByRole('heading', { level: 3, name: group.heading })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'AI prompts for back-office work' })).toBeTruthy();
    for (const lead of ['Protect people first.', 'Check your settings.', 'Check every number.', 'Ask first at work.']) {
      expect(screen.getByText(lead).tagName).toBe('STRONG');
    }
    expect(screen.getByText(/Free tools can keep what you type\./)).toBeTruthy();
  });

  it('copies the exact text of a prompt and marks only that card as copied', async () => {
    const user = userEvent.setup();
    render(<ResourcesPage />);
    expect(screen.getAllByRole('article')).toHaveLength(6);
    const [first, second] = AI_PROMPTS;
    const firstCard = screen.getByRole('article', { name: first.title });
    const secondCard = screen.getByRole('article', { name: second.title });
    expect(within(firstCard).getByText(first.when)).toBeTruthy();
    expect(within(firstCard).getByText(first.text)).toBeTruthy();

    await user.click(within(firstCard).getByRole('button', { name: 'Copy prompt' }));
    expect(await navigator.clipboard.readText()).toBe(first.text);
    expect(within(firstCard).getByRole('button', { name: 'Copied' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Copy prompt' })).toHaveLength(5);
    expect(screen.getByRole('status').textContent).toBe('Copied');

    // The mark stays until a different prompt is copied.
    await user.click(within(secondCard).getByRole('button', { name: 'Copy prompt' }));
    expect(await navigator.clipboard.readText()).toBe(second.text);
    expect(within(secondCard).getByRole('button', { name: 'Copied' })).toBeTruthy();
    expect(within(firstCard).getByRole('button', { name: 'Copy prompt' })).toBeTruthy();
  });

  it('says so when the browser does not copy, and does not mark the card as copied', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    render(<ResourcesPage />);
    const card = screen.getByRole('article', { name: AI_PROMPTS[2].title });
    await user.click(within(card).getByRole('button', { name: 'Copy prompt' }));
    expect(within(card).getByRole('alert').textContent).toBe('The browser did not copy the text. Select the text and copy it by hand.');
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('shows no notice about English in English', () => {
    render(<ResourcesPage />);
    expect(screen.queryByText(makeTranslate()('resources.namesNotice'))).toBeNull();
  });

  it('in Spanish, has the notes and the prompts in Spanish, and keeps the name of each link in English', async () => {
    const es = translationOf('es');
    const user = userEvent.setup();
    renderIn('es', <ResourcesPage />);
    expect(screen.getByRole('heading', { level: 2, name: 'Recursos' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Conoce tus derechos' })).toBeTruthy();
    expect(screen.getByText('Los nombres de los enlaces están en inglés, para que puedas encontrar el mismo nombre en la página que se abre.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Copiar la instrucción' })).toHaveLength(6);

    const item = RESOURCE_GROUPS[0].items[0];
    const link = screen.getByRole('link', { name: `${item.name} (se abre en una pestaña nueva)` });
    expect(link.getAttribute('href')).toBe(item.url);
    // A screen reader reads the English name with an English voice.
    expect(within(link).getByText(item.name).getAttribute('lang')).toBe('en');
    expect(screen.getByText('Mensajes y llamadas cifrados. Úsalo primero para todo lo delicado, y activa los mensajes temporales.')).toBeTruthy();
    expect(screen.queryByText(item.note)).toBeNull();

    // The prompt that the visitor copies is the Spanish text.
    const card = screen.getByRole('article', { name: 'De notas de reunión a lista de tareas' });
    await user.click(within(card).getByRole('button', { name: 'Copiar la instrucción' }));
    const copied = await navigator.clipboard.readText();
    expect(copied).toBe(es['content.resources.prompt0.text']);
    expect(copied).not.toBe(AI_PROMPTS[0].text);
  });
});

describe('share page', () => {
  it('shows a text message with the address of this copy, with nothing from after the "#"', () => {
    window.history.replaceState(null, '', '/toolkit/?from=test#/secure-share/LOCKEDTEXT');
    render(<SharePage />);
    expect(screen.getByText(`Free tools to keep your community safe and informed, no account needed: ${ADDRESS}`)).toBeTruthy();
    expect(document.body.textContent).not.toContain('LOCKEDTEXT');
    expect(document.body.textContent).not.toContain('from=test');
  });

  it('copies the message and then shows "Copied"', async () => {
    const user = userEvent.setup();
    render(<SharePage />);
    await user.click(screen.getByRole('button', { name: 'Copy message' }));
    expect(await navigator.clipboard.readText()).toBe(`Free tools to keep your community safe and informed, no account needed: ${ADDRESS}`);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy message' })).toBeNull();
  });

  it('says so when the browser does not copy the message', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    render(<SharePage />);
    await user.click(screen.getByRole('button', { name: 'Copy message' }));
    expect(screen.getByRole('alert').textContent).toBe('The browser did not copy the text. Select the text and copy it by hand.');
    expect(screen.getByRole('button', { name: 'Copy message' })).toBeTruthy();
  });

  it('has a flyer with the address, the four tools and the resources, and a QR code for the address', () => {
    render(<SharePage />);
    const flyer = screen.getByRole('region', { name: 'Printable flyer' });
    expect(within(flyer).getByRole('heading', { level: 3, name: 'Free tools to keep your community safe and informed' })).toBeTruthy();
    expect(within(flyer).getByText('No account and no sign-up. Scan the code or type the address.')).toBeTruthy();
    expect(within(flyer).getByText(ADDRESS)).toBeTruthy();
    expect(within(flyer).getByRole('img', { name: `QR code for ${ADDRESS}` })).toBeTruthy();

    const t = makeTranslate();
    const lines = within(flyer).getAllByRole('listitem').map((item) => item.textContent);
    expect(lines).toEqual([
      `${t('lock.messageTitle')}: send something sensitive over email, text, or a USB drive.`,
      `${t('rights.title')}: keep the words you need in your wallet.`,
      `${t('family.title')}: decide now, so no one has to decide in a crisis.`,
      `${t('sheet.title')}: get information to people who need it.`,
      'Resources: rights guides, New Jersey help, and AI prompts for back-office work.',
    ]);
    expect(within(flyer).getByText('For anything sensitive, use Signal first. Leave out names, addresses, and case numbers.')).toBeTruthy();
  });

  it('draws a different QR code for a different address', () => {
    const cells = () => screen.getByRole('img').innerHTML;
    render(<SharePage />);
    const first = cells();
    cleanup();
    window.history.replaceState(null, '', '/a-different-folder/');
    render(<SharePage />);
    expect(screen.getByRole('img', { name: 'QR code for http://localhost:3000/a-different-folder/' })).toBeTruthy();
    expect(cells()).not.toBe(first);
  });

  it('prints when the visitor clicks "Print flyer"', async () => {
    const user = userEvent.setup();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    render(<SharePage />);
    await user.click(screen.getByRole('button', { name: 'Print flyer' }));
    expect(print).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('puts only the flyer on paper', () => {
    render(<SharePage />);
    const flyer = screen.getByRole('region', { name: 'Printable flyer' });
    expect(flyer.closest('.no-print')).toBeNull();
    for (const name of ['Share this', 'By text message', 'On paper', 'Host your own copy']) {
      expect(screen.getByRole('heading', { name }).closest('.no-print'), name).not.toBeNull();
    }
    for (const button of screen.getAllByRole('button')) expect(button.closest('.no-print')).not.toBeNull();
    expect(screen.getByRole('link').closest('.no-print')).not.toBeNull();
  });

  it('shows no message, flyer, or QR code for a copy that is open from a file, and says why', () => {
    openedFromFile.value = true;
    render(<SharePage />);
    expect(screen.getByText(/it has no web address to share/)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Printable flyer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy message' })).toBeNull();
    expect(document.body.textContent).not.toContain('null');
    expect(screen.getByRole('heading', { name: 'Host your own copy' })).toBeTruthy();
  });

  it('lists the steps to host a copy, with the commands as code and a safe link to the code', () => {
    render(<SharePage />);
    const steps = Array.from(document.querySelectorAll('ol > li'));
    expect(steps).toHaveLength(6);
    expect(steps[0].textContent).toBe('Fork or download the code on GitHub.');
    expect(steps[1].textContent).toBe('Run npm install and then npm run build. You need Node.js 22.');
    const code = Array.from(document.querySelectorAll('ol code')).map((element) => element.textContent);
    expect(code).toEqual(['npm install', 'npm run build', 'dist', 'npm run signaling', 'wss://', 'VITE_SIGNALING_URLS=wss://your-server', '.env.local']);

    const link = screen.getByRole('link', { name: 'the code on GitHub (opens in a new tab)' });
    expect(link.getAttribute('href')).toBe(SOURCE_CODE_URL);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    // The marks of the locale text are not shown.
    expect(document.body.textContent).not.toMatch(/[`[\]]/);
  });

  it('is in Spanish in Spanish mode, with the same address', () => {
    renderIn('es', <SharePage />);
    expect(screen.getByRole('heading', { level: 2, name: 'Comparte esto' })).toBeTruthy();
    expect(screen.getByText(`Herramientas gratuitas para mantener a tu comunidad segura e informada, sin necesidad de una cuenta: ${ADDRESS}`)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copiar el mensaje' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Imprimir el volante' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Volante para imprimir' })).toBeTruthy();
    expect(screen.getByRole('img', { name: `Código QR de ${ADDRESS}` })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Aloja tu propia copia' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'el código en GitHub (se abre en una pestaña nueva)' }).getAttribute('href')).toBe(SOURCE_CODE_URL);
  });
});
