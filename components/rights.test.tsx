// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RAPID_RESPONSE_HOTLINE } from '../content/hotlines';
import { RIGHTS_CARD, RIGHTS_LINKS } from '../content/rightsCard';
import { I18nContext, i18nFor, translationOf, type Locale } from '../services/i18n';
import RightsCard from './RightsCard';

afterEach(cleanup);

const renderIn = (locale: Locale, ui: ReactElement = <RightsCard />) =>
  render(<I18nContext.Provider value={i18nFor(locale)}>{ui}</I18nContext.Provider>);

const card = (name = 'Printable rights card') => screen.getByRole('region', { name });
const cardTexts = (element: HTMLElement, selector: string) => Array.from(element.querySelectorAll(selector), (node) => node.textContent);
const CARD_ITEMS = RIGHTS_CARD.sections.flatMap((section) => [...section.items]);

describe('know your rights card', () => {
  it('shows each line of the card with the exact text of the content file, in the same order', () => {
    renderIn('en');
    expect(cardTexts(card(), 'h3')).toEqual([RIGHTS_CARD.title]);
    expect(cardTexts(card(), 'h4')).toEqual(RIGHTS_CARD.sections.map((section) => section.heading));
    expect(cardTexts(card(), 'li')).toEqual(CARD_ITEMS);
    expect(cardTexts(card(), 'ul').length).toBe(3);
    expect(cardTexts(card(), 'p')).toEqual([RIGHTS_CARD.sourceLine]);
  });

  it('starts with the rapid response number on the card and no other phone row', () => {
    renderIn('en');
    expect(screen.getByLabelText<HTMLInputElement>('Rapid response hotline').value).toBe(RAPID_RESPONSE_HOTLINE.number);
    expect(screen.getByLabelText<HTMLInputElement>('Your lawyer or legal group (optional)').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('Emergency contact phone (optional)').value).toBe('');
    expect(cardTexts(card(), 'dt')).toEqual(['Hotline']);
    expect(cardTexts(card(), 'dd')).toEqual([RAPID_RESPONSE_HOTLINE.number]);
  });

  it('puts each line on the card while the person types', async () => {
    const user = userEvent.setup();
    renderIn('en');
    await user.type(screen.getByLabelText('Your lawyer or legal group (optional)'), 'Legal group 555-0102');
    await user.type(screen.getByLabelText('Emergency contact phone (optional)'), '555-0101');
    expect(cardTexts(card(), 'dt')).toEqual(['Hotline', 'Lawyer', 'Emergency contact']);
    expect(cardTexts(card(), 'dd')).toEqual([RAPID_RESPONSE_HOTLINE.number, 'Legal group 555-0102', '555-0101']);
  });

  it('removes the hotline row when the person clears the line, and shows no empty list', async () => {
    const user = userEvent.setup();
    renderIn('en');
    await user.clear(screen.getByLabelText('Rapid response hotline'));
    expect(card().querySelector('dl')).toBeNull();
    expect(within(card()).queryByText('Hotline')).toBeNull();
    // The rights text does not depend on the phone lines.
    expect(cardTexts(card(), 'li')).toEqual(CARD_ITEMS);
  });

  it('shows no row for a line that holds only spaces', async () => {
    const user = userEvent.setup();
    renderIn('en');
    await user.type(screen.getByLabelText('Your lawyer or legal group (optional)'), '   ');
    expect(cardTexts(card(), 'dt')).toEqual(['Hotline']);
  });

  it('names the source of the hotline number only while the line holds that number', async () => {
    const user = userEvent.setup();
    renderIn('en');
    const hint = `This is the ${RAPID_RESPONSE_HOTLINE.name} number, as listed by the ${RAPID_RESPONSE_HOTLINE.sourceName}. Call it to confirm before you print or share it.`;
    const hasHint = () => Array.from(document.querySelectorAll('p')).some((p) => p.textContent === hint);
    expect(hasHint()).toBe(true);
    expect(screen.getByRole('link', { name: RAPID_RESPONSE_HOTLINE.sourceName }).getAttribute('href')).toBe(RAPID_RESPONSE_HOTLINE.sourceUrl);

    const hotline = screen.getByLabelText('Rapid response hotline');
    await user.clear(hotline);
    await user.type(hotline, '555-0100');
    expect(hasHint()).toBe(false);
    expect(cardTexts(card(), 'dd')).toEqual(['555-0100']);
  });

  it('opens the print dialog of the browser', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderIn('en');
    await user.click(screen.getByRole('button', { name: 'Print card' }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('prints the card only: all other parts of the page are hidden on paper', () => {
    const { container } = renderIn('en');
    const parts = Array.from(container.firstElementChild?.children ?? []);
    expect(parts.length).toBe(3);
    expect(parts.filter((part) => !part.classList.contains('no-print'))).toEqual([card()]);
    expect(card().closest('.no-print')).toBeNull();
    expect(card().querySelector('.no-print')).toBeNull();
    expect(screen.getByRole('button', { name: 'Print card' }).closest('.no-print')).not.toBeNull();
  });

  it('does not save what the person types', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const open = vi.spyOn(indexedDB, 'open');
    const databasesBefore = (await indexedDB.databases()).length;
    const { unmount } = renderIn('en');
    expect(screen.getByText("Most of this applies regardless of immigration status. Add your numbers, then print and cut the card. The site doesn't save what you type.")).toBeTruthy();
    expect(screen.getByText('Never synced')).toBeTruthy();

    await user.type(screen.getByLabelText('Your lawyer or legal group (optional)'), 'Legal group 555-0102');
    await user.type(screen.getByLabelText('Emergency contact phone (optional)'), '555-0101');
    expect(setItem).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
    expect((await indexedDB.databases()).length).toBe(databasesBefore);
    expect(window.location.href).not.toContain('555');
    for (const field of screen.getAllByRole('textbox')) expect(field.getAttribute('autocomplete')).toBe('off');

    // A new visit to the page starts empty again.
    unmount();
    renderIn('en');
    expect(screen.getByLabelText<HTMLInputElement>('Emergency contact phone (optional)').value).toBe('');
    expect(cardTexts(card(), 'dd')).toEqual([RAPID_RESPONSE_HOTLINE.number]);
  });

  it('links to the official cards of the old build, in a new tab and with no referrer', () => {
    renderIn('en');
    const href = (name: string) => screen.getByRole('link', { name }).getAttribute('href');
    expect(href("ACLU's guide")).toBe(RIGHTS_LINKS.acluGuide);
    expect(href('ILRC red cards')).toBe(RIGHTS_LINKS.ilrcRedCards);
    expect(href('NJ Office of New Americans')).toBe(RIGHTS_LINKS.njNewAmericans);
    expect(href('ACLU guide in Spanish')).toBe(RIGHTS_LINKS.acluGuideSpanish);
    expect(href('main guide')).toBe(RIGHTS_LINKS.acluGuide);
    expect(href("EFF's Surveillance Self-Defense")).toBe(RIGHTS_LINKS.effSurveillanceSelfDefense);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(7);
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noreferrer');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });

  it('does not show the notice about English text in English', () => {
    renderIn('en');
    expect(screen.queryByText(/The card text is in English only/)).toBeNull();
  });
});

describe('know your rights card in Spanish', () => {
  const es = translationOf('es');

  it('shows the card in Spanish, with the sentences to say to an agent in English', () => {
    renderIn('es');
    const spanish = card('Tarjeta de derechos para imprimir');
    expect(cardTexts(spanish, 'h3')).toEqual(['Conoce tus derechos']);
    const items = cardTexts(spanish, 'li');
    expect(items).toHaveLength(CARD_ITEMS.length);
    items.forEach((item, index) => expect(item).not.toBe(CARD_ITEMS[index]));
    expect(items).toContain('Di: "I do not consent to your entry." (No doy mi consentimiento para que entren.)');
    expect(cardTexts(spanish, 'dt')).toEqual([es['content.rights.label.hotline']]);
    // The card has the language of the page.
    expect(spanish.getAttribute('lang')).toBeNull();
  });

  it('marks each sentence to say to an agent as English and left to right, also in a right to left card', () => {
    renderIn('ar');
    const arabic = screen.getByRole('region');
    const marked = Array.from(arabic.querySelectorAll('bdi'));
    expect(marked.map((node) => [node.getAttribute('lang'), node.getAttribute('dir')])).toEqual(Array(marked.length).fill(['en', 'ltr']));
    expect(marked.map((node) => node.textContent)).toEqual([
      'I do not consent to your entry.',
      'I do not consent to your entry or to your search of these premises. I am exercising my right to remain silent. I wish to speak with a lawyer as soon as possible.',
      'I am exercising my right to remain silent.',
    ]);
  });

  it('prints on a translated card that it is a machine translation, and not on the English card', async () => {
    const user = userEvent.setup();
    renderIn('es');
    const shown = card('Tarjeta de derechos para imprimir');
    const note = es['rights.printNote'] as string;
    expect(note).toMatch(/traducción automática/i);
    // The note is inside the part of the page that prints.
    expect(within(shown).getByText(note).closest('.no-print')).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Mostrar la tarjeta en inglés' }));
    expect(within(shown).queryByText(note)).toBeNull();
  });

  it('shows and prints the English card, with the same text as in English mode, when the person asks', async () => {
    const user = userEvent.setup();
    renderIn('en');
    await user.type(screen.getByLabelText('Emergency contact phone (optional)'), '555-0101');
    const english = card().innerHTML;
    cleanup();

    renderIn('es');
    await user.type(screen.getByLabelText('Teléfono de tu contacto de emergencia (opcional)'), '555-0101');
    await user.click(screen.getByRole('checkbox', { name: 'Mostrar la tarjeta en inglés' }));
    const shown = card('Tarjeta de derechos para imprimir');
    // The field IDs are not in the card, so the two cards must be the same markup.
    expect(shown.innerHTML).toBe(english);
    expect(cardTexts(shown, 'li')).toEqual(CARD_ITEMS);
    // Screen readers then read the card with an English voice, and it stays left to right.
    expect(shown.getAttribute('lang')).toBe('en');
    expect(shown.getAttribute('dir')).toBe('ltr');
  });

  it('has no choice of an English card in English', () => {
    renderIn('en');
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(card().getAttribute('lang')).toBe('en');
  });

  it('says that the card text is a machine translation and links to the official cards', () => {
    renderIn('es');
    const notice = screen.getByText(/El texto de la tarjeta es una traducción automática/);
    expect(notice.textContent).toContain(
      'El texto de la tarjeta es una traducción automática. Un abogado(a) no lo ha revisado. Para una tarjeta oficial en muchos idiomas, usa las tarjetas rojas del ILRC.',
    );
    expect(within(notice).getByRole('link', { name: 'tarjetas rojas del ILRC' }).getAttribute('href')).toBe(RIGHTS_LINKS.ilrcRedCards);
    // The notice is for the screen, not for the printed card.
    expect(notice.closest('.no-print')).not.toBeNull();
  });

  it('shows the page around the card in Spanish and keeps the hotline number', () => {
    renderIn('es');
    expect(screen.getByRole('heading', { name: /Tarjeta de derechos/, level: 2 })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Imprimir la tarjeta' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Línea de ayuda de respuesta rápida').value).toBe(RAPID_RESPONSE_HOTLINE.number);
    expect(screen.getByRole('link', { name: RAPID_RESPONSE_HOTLINE.sourceName }).getAttribute('href')).toBe(RAPID_RESPONSE_HOTLINE.sourceUrl);
    expect(document.body.textContent).not.toMatch(/\{\w+\}/);
  });
});
