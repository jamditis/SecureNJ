// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTE_EXAMPLE, SPANISH_LINKS, STARTER_LISTINGS } from '../content/resourceSheet';
import { I18nContext, LOCALES, makeTranslate } from '../services/i18n';
import { DRAFT_KEY, LEGACY_DRAFT_KEY, LINK_PROTOCOLS } from '../services/sheet';
import ResourceSheet from './ResourceSheet';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const sheet = () => screen.getByRole('region', { name: 'Printable resource sheet' });
const listingForm = (number: number) => screen.getByRole('group', { name: `Listing ${number}` });
const listingForms = () => screen.getAllByRole('group', { name: /^Listing \d+$/ });
const draftBox = () => screen.getByRole<HTMLInputElement>('checkbox', { name: /Save a draft in this browser/ });

const fillListing = async (user: ReturnType<typeof userEvent.setup>, number: number, fields: Partial<Record<'Name' | 'What it offers' | 'When and where' | 'Phone or website', string>>) => {
  for (const [label, value] of Object.entries(fields)) {
    await user.type(within(listingForm(number)).getByLabelText(label), value);
  }
};

describe('resource sheet', () => {
  it('starts with the default title, one empty listing, and no draft box ticked', () => {
    render(<ResourceSheet />);
    expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe('Community resources');
    expect(screen.getByLabelText<HTMLInputElement>('Short note').placeholder).toBe(NOTE_EXAMPLE);
    expect(listingForms()).toHaveLength(1);
    expect(draftBox().checked).toBe(false);
    expect(within(sheet()).getByRole('heading', { name: 'Community resources' })).toBeTruthy();
    expect(within(sheet()).getByText('Your listings appear here.')).toBeTruthy();
  });

  it('shows the title, the note, and each listing with a name on the sheet', async () => {
    const user = userEvent.setup();
    render(<ResourceSheet />);
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Help near you');
    await user.type(screen.getByLabelText('Short note'), 'Checked today');
    await fillListing(user, 1, { Name: 'Food pantry', 'What it offers': 'Groceries', 'When and where': 'Sat 9-12, Main St', 'Phone or website': 'Ask at the desk' });
    await user.click(screen.getByRole('button', { name: 'Add a listing' }));
    await fillListing(user, 2, { 'What it offers': 'A listing without a name' });

    expect(within(sheet()).getByRole('heading', { name: 'Help near you' })).toBeTruthy();
    expect(within(sheet()).getByText('Checked today')).toBeTruthy();
    const items = within(sheet()).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toBe('Food pantryGroceriesSat 9-12, Main StAsk at the desk');
    expect(within(sheet()).queryByText('A listing without a name')).toBeNull();
    expect(within(sheet()).queryByText('Your listings appear here.')).toBeNull();
  });

  it('removes a listing, and leaves one empty listing when the last one is removed', async () => {
    const user = userEvent.setup();
    render(<ResourceSheet />);
    await fillListing(user, 1, { Name: 'First' });
    await user.click(screen.getByRole('button', { name: 'Add a listing' }));
    await fillListing(user, 2, { Name: 'Second' });

    await user.click(screen.getByRole('button', { name: 'Remove listing 1' }));
    expect(listingForms()).toHaveLength(1);
    expect(within(listingForm(1)).getByLabelText<HTMLInputElement>('Name').value).toBe('Second');

    await user.click(screen.getByRole('button', { name: 'Remove listing 1' }));
    expect(listingForms()).toHaveLength(1);
    expect(within(listingForm(1)).getByLabelText<HTMLInputElement>('Name').value).toBe('');
    expect(within(sheet()).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('adds the New Jersey starters with the exact names and contacts of the reference content', async () => {
    const user = userEvent.setup();
    render(<ResourceSheet />);
    await user.click(screen.getByRole('button', { name: 'Add New Jersey starters' }));

    // The empty first listing is dropped.
    expect(listingForms()).toHaveLength(STARTER_LISTINGS.length);
    STARTER_LISTINGS.forEach((starter, index) => {
      const form = within(listingForm(index + 1));
      expect(form.getByLabelText<HTMLInputElement>('Name').value).toBe(starter.name);
      expect(form.getByLabelText<HTMLInputElement>('What it offers').value).toBe(starter.offers);
      expect(form.getByLabelText<HTMLInputElement>('When and where').value).toBe(starter.when);
      expect(form.getByLabelText<HTMLInputElement>('Phone or website').value).toBe(starter.contact);
    });
    const items = within(sheet()).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(STARTER_LISTINGS.map((starter) => starter.name + starter.offers + starter.when + starter.contact));

    // A second press adds them a second time, after the listings that have a name.
    await user.click(screen.getByRole('button', { name: 'Add New Jersey starters' }));
    expect(listingForms()).toHaveLength(2 * STARTER_LISTINGS.length);
  });

  it('prints with the print function of the browser', async () => {
    const user = userEvent.setup();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    render(<ResourceSheet />);
    await user.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('keeps the form and the buttons off the paper, and the sheet on it', () => {
    render(<ResourceSheet />);
    expect(sheet().closest('.no-print')).toBeNull();
    for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('textbox'), draftBox()]) {
      expect(control.closest('.no-print')).not.toBeNull();
    }
    expect(screen.getByText('Your listings appear here.').closest('.no-print')).not.toBeNull();
  });
});

describe('copy as text', () => {
  it('copies the title, the note, and one line for each listing with a name', async () => {
    const user = userEvent.setup();
    render(<ResourceSheet />);
    await user.type(screen.getByLabelText('Short note'), 'Checked today');
    await fillListing(user, 1, { Name: 'Food pantry', 'What it offers': 'Groceries', 'Phone or website': '973-555-0100' });
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    expect(await navigator.clipboard.readText()).toBe('Community resources\n\nChecked today\n\nFood pantry | Groceries | 973-555-0100');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('shows "Copy as text" again after a change of the sheet or of the draft box', async () => {
    const user = userEvent.setup();
    render(<ResourceSheet />);
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    await user.type(screen.getByLabelText('Short note'), 'x');
    expect(screen.getByRole('button', { name: 'Copy as text' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    await user.click(draftBox());
    expect(screen.getByRole('button', { name: 'Copy as text' })).toBeTruthy();
  });

  it('says so when the browser does not copy the text', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('NotAllowedError'));
    render(<ResourceSheet />);
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    expect((await screen.findByRole('alert')).textContent).toContain('The browser did not copy the text.');
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
  });
});

describe('draft in the browser', () => {
  it('stores nothing while the box is not ticked', async () => {
    const user = userEvent.setup();
    render(<ResourceSheet />);
    await fillListing(user, 1, { Name: 'Food pantry', 'Phone or website': '973-555-0100' });
    await user.click(screen.getByRole('button', { name: 'Add New Jersey starters' }));
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('stores the sheet as plain JSON while the box is ticked, and deletes it when the box is cleared', async () => {
    const user = userEvent.setup();
    render(<ResourceSheet />);
    await fillListing(user, 1, { Name: 'Food pantry' });
    await user.click(draftBox());
    await user.type(screen.getByLabelText('Short note'), 'Checked today');

    // "It isn't encrypted": the text is readable in storage.
    const stored = localStorage.getItem(DRAFT_KEY) ?? '';
    expect(stored).toContain('Food pantry');
    expect(JSON.parse(stored)).toMatchObject({ title: 'Community resources', note: 'Checked today', entries: [{ name: 'Food pantry', offers: '', when: '', contact: '' }] });
    expect(Object.keys(localStorage)).toEqual([DRAFT_KEY]);

    // "Uncheck to delete the draft."
    await user.click(draftBox());
    expect(localStorage.length).toBe(0);
    await user.type(screen.getByLabelText('Short note'), ' again');
    expect(localStorage.length).toBe(0);
  });

  it('opens a stored draft with the box ticked', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: 'Our list', note: 'N', entries: [{ id: 'a', name: 'Clinic', offers: 'Care', when: '', contact: '211' }] }));
    render(<ResourceSheet />);
    expect(draftBox().checked).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe('Our list');
    expect(within(sheet()).getByText('Clinic')).toBeTruthy();
  });

  it('keeps the sheet of a person who used the first version of the site, and removes the old key', async () => {
    const user = userEvent.setup();
    const old = { title: 'Old list', note: 'Checked May', entries: [{ id: 'a', name: 'Clinic', offers: 'Care', when: 'Mon', contact: '211' }] };
    localStorage.setItem(LEGACY_DRAFT_KEY, JSON.stringify(old));
    render(<ResourceSheet />);

    expect(draftBox().checked).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe('Old list');
    expect(within(listingForm(1)).getByLabelText<HTMLInputElement>('Name').value).toBe('Clinic');
    expect(localStorage.getItem(LEGACY_DRAFT_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '')).toEqual(old);

    // The box deletes the draft, with no copy left under the old key.
    await user.click(draftBox());
    expect(localStorage.length).toBe(0);
  });

  it('opens with an empty sheet when the stored value is damaged', () => {
    localStorage.setItem(DRAFT_KEY, '{"title":5,"entries":[null,{"name":{}}]');
    render(<ResourceSheet />);
    expect(draftBox().checked).toBe(false);
    expect(listingForms()).toHaveLength(1);
  });

  it('says so when the browser does not save the draft', async () => {
    const user = userEvent.setup();
    render(<ResourceSheet />);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    await user.click(draftBox());
    expect(screen.getByRole('alert').textContent).toContain('The browser did not save the draft.');
  });
});

describe('links on the sheet', () => {
  const contactOnSheet = async (contact: string) => {
    const user = userEvent.setup();
    render(<ResourceSheet />);
    await fillListing(user, 1, { Name: 'Place' });
    // Paste, because `type` reads some characters as key names.
    await user.click(within(listingForm(1)).getByLabelText('Phone or website'));
    await user.paste(contact);
    return within(sheet());
  };

  it('shows a javascript: address as plain text and not as a link', async () => {
    const onSheet = await contactOnSheet('javascript:alert(document.domain)');
    expect(onSheet.getByText('javascript:alert(document.domain)').closest('a')).toBeNull();
    expect(onSheet.queryAllByRole('link')).toHaveLength(0);
    expect(sheet().querySelector('a')).toBeNull();
  });

  it.each(['JAVASCRIPT:alert(1)', ' javascript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', 'file:///etc/passwd'])('makes no link for %s', async (contact) => {
    await contactOnSheet(contact);
    expect(sheet().querySelector('a')).toBeNull();
  });

  it('makes a web address a link that opens in a new tab and sends no referrer', async () => {
    const onSheet = await contactOnSheet('https://www.example.org/help');
    const link = onSheet.getByRole<HTMLAnchorElement>('link', { name: 'https://www.example.org/help' });
    expect(link.getAttribute('href')).toBe('https://www.example.org/help');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
  });

  it('makes a phone number a link that calls the number', async () => {
    const onSheet = await contactOnSheet('1-800-555-0100');
    expect(onSheet.getByRole('link', { name: '1-800-555-0100' }).getAttribute('href')).toBe('tel:18005550100');
  });

  it('uses only http, https, tel, and mailto for the links of the starters and of typed contacts', async () => {
    const user = userEvent.setup();
    render(<ResourceSheet />);
    await user.click(screen.getByRole('button', { name: 'Add New Jersey starters' }));
    for (const contact of ['help@example.org', 'http://example.org', 'tel:211', 'javascript:alert(1)', 'mailto:a@example.org']) {
      await user.click(screen.getByRole('button', { name: 'Add a listing' }));
      const number = listingForms().length;
      await fillListing(user, number, { Name: `Place ${number}` });
      await user.click(within(listingForm(number)).getByLabelText('Phone or website'));
      await user.paste(contact);
    }
    const links = Array.from(sheet().querySelectorAll('a'));
    expect(links).toHaveLength(5);
    for (const link of links) expect(LINK_PROTOCOLS).toContain(new URL(link.getAttribute('href') ?? '').protocol);
  });
});

describe('resource sheet in Spanish', () => {
  const renderInSpanish = () =>
    render(
      <I18nContext.Provider value={{ locale: 'es', t: makeTranslate(LOCALES.es.messages), setLocale: () => {} }}>
        <ResourceSheet />
      </I18nContext.Provider>,
    );

  it('says that the starters are in English and links to the material in Spanish of the old site', () => {
    renderInSpanish();
    expect(screen.getByText(/Las entradas iniciales de Nueva Jersey están en inglés/)).toBeTruthy();
    const hrefs = ['Tarjetas rojas del ILRC', 'Lista de líneas de ayuda de la National Network for Immigrant and Refugee Rights', 'Guía de la ACLU en español'].map((name) =>
      screen.getByRole('link', { name }).getAttribute('href'),
    );
    expect(hrefs).toEqual(SPANISH_LINKS.map((link) => link.url));
  });

  it('adds the starters in English, with no translation', async () => {
    const user = userEvent.setup();
    renderInSpanish();
    await user.click(screen.getByRole('button', { name: 'Agregar entradas iniciales de Nueva Jersey' }));
    const items = within(screen.getByRole('region', { name: 'Hoja de recursos para imprimir' })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(STARTER_LISTINGS.map((starter) => starter.name + starter.offers + starter.when + starter.contact));
    expect(screen.getByLabelText<HTMLInputElement>('Nota corta').placeholder).toBe(NOTE_EXAMPLE);
  });

  it('does not show the note about English in the English app', () => {
    render(<ResourceSheet />);
    expect(screen.queryByText(/The New Jersey starters are in English/)).toBeNull();
  });
});
