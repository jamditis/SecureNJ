// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIRST_STEPS, PLAN_SECTIONS } from '../content/familyPlan';
import { decryptText, encryptText } from '../services/crypto';
import { downloadBlob } from '../services/download';
import { lockPlan } from '../services/family';
import { I18nContext, i18nFor, translationOf } from '../services/i18n';
import FamilyPlan from './FamilyPlan';

vi.mock('../services/download', () => ({ downloadBlob: vi.fn() }));

const PASSPHRASE = 'maple river stone cloud forest lamp';
const SAVED = 'Saved as family-plan.locked.txt.';
const OPEN_FAILED = 'Could not open that file. Check the file and the passphrase.';
const ITEMS = PLAN_SECTIONS.flatMap((section) => section.items);

const field = (label: string) => screen.getByLabelText<HTMLInputElement | HTMLTextAreaElement>(label);
const savePassphrase = () => screen.getByLabelText<HTMLInputElement>(/^Passphrase for saving/);
const saveButton = () => screen.getByRole('button', { name: 'Save locked file' });
const filePicker = () => screen.getByLabelText<HTMLInputElement>('Open a saved plan', { selector: 'input' });
const planFile = (text: string, name = 'family-plan.locked.txt') => new File([text], name, { type: 'text/plain' });

/** The text of the last file that the page gave to the device. */
async function savedFile(): Promise<{ text: string; name: string; type: string }> {
  const calls = vi.mocked(downloadBlob).mock.calls;
  const [blob, name] = calls[calls.length - 1];
  return { text: await blob.text(), name, type: blob.type };
}

const unloadIsStopped = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

async function openFile(user: ReturnType<typeof userEvent.setup>, file: File, passphrase: string) {
  await user.upload(filePicker(), file);
  const dialog = await screen.findByRole('dialog', { name: 'Open a saved plan' });
  await user.type(within(dialog).getByLabelText('Passphrase'), passphrase);
  await user.click(within(dialog).getByRole('button', { name: 'Open' }));
}

beforeEach(() => {
  vi.mocked(downloadBlob).mockClear();
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('family plan: form', () => {
  it('shows the title, the notice, the 7 first steps, and each question of the 4 sections', () => {
    render(<FamilyPlan />);
    expect(screen.getByRole('heading', { name: /^Family emergency plan/ })).toBeTruthy();
    expect(
      screen.getByText(
        "This page isn't saved until you save it, and nothing leaves your device. A printed plan isn't protected, so keep it somewhere safe. This isn't legal advice.",
      ),
    ).toBeTruthy();

    const steps = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(steps.map((step) => step.textContent)).toEqual(FIRST_STEPS);

    for (const section of PLAN_SECTIONS) expect(screen.getByRole('heading', { name: section.section })).toBeTruthy();
    expect(ITEMS).toHaveLength(14);
    for (const item of ITEMS) {
      const control = field(item.label);
      expect(control.id).toBe(`fp-${item.id}`);
      expect(control.tagName).toBe(item.long ? 'TEXTAREA' : 'INPUT');
      expect(control.getAttribute('placeholder')).toBeNull();
      if (!item.long) expect(control.getAttribute('autocomplete')).toBe('off');
    }
  });

  it('starts with the hotline number and no other answer', () => {
    render(<FamilyPlan />);
    for (const item of ITEMS) expect(field(item.label).value).toBe(item.id === 'hotline' ? '1-800-308-0878' : '');
  });

  it('says where the hotline number comes from and asks the person to confirm it, until the number changes', async () => {
    const user = userEvent.setup();
    render(<FamilyPlan />);
    const hotline = field('Rapid response hotline');
    const note = 'This is the NY/NJ Rapid Response Network number, as listed by the National Network for Immigrant and Refugee Rights. Call it to confirm before you print or share it.';
    expect(document.getElementById(hotline.getAttribute('aria-describedby') ?? '')?.textContent).toBe(note);

    await user.clear(hotline);
    await user.type(hotline, '555-0100');
    expect(screen.queryByText(/NY\/NJ Rapid Response Network/)).toBeNull();
    expect(hotline.getAttribute('aria-describedby')).toBeNull();
  });

  it('ties each hint to its field', () => {
    render(<FamilyPlan />);
    for (const item of ITEMS.filter((it) => it.hint)) {
      const hint = document.getElementById(field(item.label).getAttribute('aria-describedby') ?? '');
      expect(hint?.textContent).toBe(item.hint);
    }
  });

  it('opens the outside pages in a new tab with no referrer', () => {
    render(<FamilyPlan />);
    const links = screen.getAllByRole<HTMLAnchorElement>('link');
    expect(links.map((link) => link.textContent)).toEqual(['ILRC family preparedness plan', 'ICE detainee locator', 'National Network for Immigrant and Refugee Rights']);
    for (const link of links) {
      expect(link.href.startsWith('https://')).toBe(true);
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noreferrer');
    }
    expect(links[0].closest('p')?.textContent).toBe(
      "Learn more in the ILRC family preparedness plan. Some of its details are specific to California. The ICE detainee locator is a government site, so a search there isn't private.",
    );
  });
});

describe('family plan: privacy', () => {
  it('stores nothing in the browser and sends nothing while the person types, saves, and prints', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const fetchSpy = vi.fn();
    const socketSpy = vi.fn();
    const requestSpy = vi.fn();
    const beaconSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', socketSpy);
    vi.stubGlobal('XMLHttpRequest', requestSpy);
    Object.defineProperty(navigator, 'sendBeacon', { value: beaconSpy, configurable: true });
    const databases = (await indexedDB.databases()).length;
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(<FamilyPlan />);
    await user.type(field('Children, schools, and daycares'), 'Ana, Lincoln School');
    await user.type(savePassphrase(), PASSPHRASE);
    await user.click(saveButton());
    await screen.findByText(SAVED);
    await user.click(screen.getByRole('button', { name: 'Print' }));

    expect(print).toHaveBeenCalledTimes(1);
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length + sessionStorage.length).toBe(0);
    expect((await indexedDB.databases()).length).toBe(databases);
    expect(document.cookie).toBe('');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(socketSpy).not.toHaveBeenCalled();
    expect(requestSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
  });

  it('does not keep the answers when the page closes and opens again', async () => {
    const user = userEvent.setup();
    const first = render(<FamilyPlan />);
    await user.type(field('First emergency contact and phone'), 'Rosa 555-0100');
    first.unmount();
    render(<FamilyPlan />);
    expect(field('First emergency contact and phone').value).toBe('');
  });

  it('saves a locked file that does not contain the answers as plain text, and that the passphrase opens', async () => {
    const user = userEvent.setup();
    render(<FamilyPlan />);
    await user.type(field('First emergency contact and phone'), 'Rosa Diaz 555-0100');
    await user.type(field('Where you keep important papers'), 'Blue folder');
    await user.type(savePassphrase(), PASSPHRASE);
    await user.click(saveButton());
    expect((await screen.findByRole('status')).textContent).toBe(SAVED);

    const file = await savedFile();
    expect(file.name).toBe('family-plan.locked.txt');
    expect(file.type).toBe('text/plain');
    for (const text of ['Rosa', '555-0100', 'Blue folder', '1-800-308-0878', 'contact1']) expect(file.text).not.toContain(text);
    expect(JSON.parse(await decryptText(file.text, PASSPHRASE))).toEqual({
      contact1: 'Rosa Diaz 555-0100',
      hotline: '1-800-308-0878',
      docs: 'Blue folder',
    });
  });

  it('does not save with a weak passphrase, and says why', async () => {
    const user = userEvent.setup();
    render(<FamilyPlan />);
    await user.click(saveButton());
    expect(screen.getByRole('alert').textContent).toBe('Use a passphrase of at least 12 characters.');

    await user.type(savePassphrase(), 'password password');
    await user.click(saveButton());
    expect(screen.getByRole('alert').textContent).toBe('That passphrase is easy to guess. Use the dice button to make a stronger one.');
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('takes the "saved" message away after a change', async () => {
    const user = userEvent.setup();
    render(<FamilyPlan />);
    await user.type(savePassphrase(), PASSPHRASE);
    await user.click(saveButton());
    await screen.findByText(SAVED);
    await user.type(field('Consulate phone'), '5');
    expect(screen.queryByText(SAVED)).toBeNull();
  });

  it('asks before the browser leaves the page with a change that is not in a file', async () => {
    const user = userEvent.setup();
    render(<FamilyPlan />);
    expect(unloadIsStopped()).toBe(false);
    await user.type(field('Consulate phone'), '555-0199');
    expect(unloadIsStopped()).toBe(true);

    await user.type(savePassphrase(), PASSPHRASE);
    await user.click(saveButton());
    await screen.findByText(SAVED);
    expect(unloadIsStopped()).toBe(false);
  });
});

describe('family plan: open a saved plan', () => {
  const stored = { hotline: '555-0100', kids: 'Ana, Lincoln School\nLuis, Oak daycare', wishes: 'Stay together' };

  it('asks for the passphrase after the file is selected, and fills the form', async () => {
    const user = userEvent.setup();
    render(<FamilyPlan />);
    expect(filePicker().accept).toBe('.txt,text/plain');
    await openFile(user, planFile(await lockPlan(stored, PASSPHRASE)), PASSPHRASE);

    await vi.waitFor(() => expect(field('Children, schools, and daycares').value).toBe(stored.kids));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(field('Rapid response hotline').value).toBe('555-0100');
    expect(field('What you want to happen, in your own words').value).toBe('Stay together');
    expect(field('Consulate phone').value).toBe('');
    // The next save uses the passphrase that the person knows.
    expect(savePassphrase().value).toBe(PASSPHRASE);
    expect(unloadIsStopped()).toBe(false);
  });

  it('keeps the form and lets the person try again after a wrong passphrase', async () => {
    const user = userEvent.setup();
    render(<FamilyPlan />);
    await openFile(user, planFile(await lockPlan(stored, PASSPHRASE)), 'maple river stone cloud forest lamb');
    const dialog = screen.getByRole('dialog');
    expect((await within(dialog).findByRole('alert')).textContent).toBe(OPEN_FAILED);
    expect(field('Rapid response hotline').value).toBe('1-800-308-0878');

    const passphrase = within(dialog).getByLabelText('Passphrase');
    await user.clear(passphrase);
    await user.type(passphrase, PASSPHRASE);
    await user.click(within(dialog).getByRole('button', { name: 'Open' }));
    await vi.waitFor(() => expect(field('Rapid response hotline').value).toBe('555-0100'));
  });

  it('keeps the form when the file is not a locked file', async () => {
    const user = userEvent.setup();
    render(<FamilyPlan />);
    await user.type(field('Consulate phone'), '555-0199');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await openFile(user, planFile('{"hotline":"000"}', 'notes.txt'), PASSPHRASE);
    expect((await within(screen.getByRole('dialog')).findByRole('alert')).textContent).toBe(OPEN_FAILED);
    expect(field('Rapid response hotline').value).toBe('1-800-308-0878');
    expect(field('Consulate phone').value).toBe('555-0199');
  });

  it('keeps the form when the locked file holds something that is not a plan', async () => {
    const user = userEvent.setup();
    render(<FamilyPlan />);
    // The file of a different tool, locked with the same passphrase. The old page took it and emptied the form.
    const other = await encryptText('{"where":"Broad St"}', PASSPHRASE);
    await openFile(user, planFile(other), PASSPHRASE);
    expect((await within(screen.getByRole('dialog')).findByRole('alert')).textContent).toBe(OPEN_FAILED);
    expect(field('Rapid response hotline').value).toBe('1-800-308-0878');
  });

  it('does not read a file that is too large to be a plan', async () => {
    const user = userEvent.setup();
    render(<FamilyPlan />);
    await user.upload(filePicker(), planFile('A'.repeat(1024 * 1024 + 1)));
    expect((await screen.findByRole('alert')).textContent).toBe(OPEN_FAILED);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks before a saved plan replaces changes that are not in a file', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<FamilyPlan />);
    const file = planFile(await lockPlan(stored, PASSPHRASE));

    await user.type(field('Consulate phone'), '555-0199');
    await user.upload(filePicker(), file);
    expect(confirm).toHaveBeenCalledWith('The changes on this page are not saved. Open a saved plan and replace them?');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(field('Consulate phone').value).toBe('555-0199');

    confirm.mockReturnValue(true);
    await openFile(user, file, PASSPHRASE);
    await vi.waitFor(() => expect(field('Consulate phone').value).toBe(''));
  });

  it('does not ask when the form has no change', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<FamilyPlan />);
    await user.upload(filePicker(), planFile('x'));
    expect(confirm).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});

describe('family plan: print', () => {
  it('prints the title of the plan, each question, and the full answer, but not the notes, the hints, or the buttons', async () => {
    const user = userEvent.setup();
    const { container } = render(<FamilyPlan />);
    const answer = 'Ana, Lincoln School, 8:00 to 3:00.\nLuis, Oak daycare.\n'.repeat(12).trim();
    await user.click(field('Children, schools, and daycares'));
    await user.paste(answer);

    const printed = (element: Element | null) => element !== null && element.closest('.no-print') === null && !element.classList.contains('print:hidden');

    expect(printed(screen.getByRole('heading', { name: 'Our family emergency plan' }))).toBe(true);
    for (const section of PLAN_SECTIONS) expect(printed(screen.getByRole('heading', { name: section.section }))).toBe(true);
    for (const item of ITEMS) expect(printed(container.querySelector(`label[for="fp-${item.id}"]`))).toBe(true);

    // A field cuts a long answer off on paper. The printed copy is plain text that grows.
    expect(printed(field('Children, schools, and daycares'))).toBe(false);
    const copy = Array.from(container.querySelectorAll('p')).find((p) => p.textContent === answer);
    expect(copy).toBeTruthy();
    expect(printed(copy ?? null)).toBe(true);
    expect(copy?.className).toContain('print:block');
    expect(copy?.className).toContain('whitespace-pre-wrap');
    expect(printed(screen.getByText('1-800-308-0878'))).toBe(true);

    expect(printed(screen.getByText(/^This page isn't saved until you save it/))).toBe(false);
    expect(printed(screen.getByRole('heading', { name: 'Do these first' }))).toBe(false);
    expect(printed(screen.getByText('Only if this applies to you.'))).toBe(false);
    expect(printed(screen.getByText(/Call it to confirm before you print or share it/))).toBe(false);
    for (const button of screen.getAllByRole('button')) expect(printed(button)).toBe(false);
    expect(printed(savePassphrase())).toBe(false);
  });
});

describe('family plan: Spanish', () => {
  const es = translationOf('es');
  const renderSpanish = () =>
    render(
      <I18nContext.Provider value={i18nFor('es')}>
        <FamilyPlan />
      </I18nContext.Provider>,
    );

  it('shows the questions and the first steps in Spanish, and says that they are a machine translation', () => {
    renderSpanish();
    expect(screen.getByRole('heading', { name: /^Plan familiar de emergencia/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar archivo bloqueado' })).toBeTruthy();

    const notice = screen.getByText(/^Los primeros pasos y las preguntas del plan son una traducción automática\./);
    const links = within(notice.parentElement as HTMLElement).getAllByRole<HTMLAnchorElement>('link');
    expect(links.map((link) => [link.textContent, link.href])).toEqual([
      ['Tarjetas rojas del ILRC', 'https://www.ilrc.org/red-cards-tarjetas-rojas'],
      [es['content.family.languageLink1'], 'https://nj.gov/humanservices/njnewamericans/rights/rights/'],
      ['Guía de la ACLU en español', 'https://www.aclu.org/files/kyr/MKG17-KYR-PoliceImmigrationFBI-OnePager-Spanish-v01.pdf'],
    ]);

    expect(screen.getByText('Elige quién va a cuidar a tus hijos y habla con esa persona ahora.')).toBeTruthy();
    expect(screen.queryByText(FIRST_STEPS[0])).toBeNull();
    for (const item of ITEMS) {
      const label = es[`content.family.${item.id}.label`] as string;
      expect(label).not.toBe(item.label);
      // The text is in the language of the page, and an answer can be in any language.
      expect(field(label).closest('[lang]')).toBeNull();
    }
  });

  it('shows the guide that exists only in Spanish to a reader of Spanish only', () => {
    render(
      <I18nContext.Provider value={i18nFor('zh')}>
        <FamilyPlan />
      </I18nContext.Provider>,
    );
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('https://www.ilrc.org/red-cards-tarjetas-rojas');
    expect(hrefs).not.toContain('https://www.aclu.org/files/kyr/MKG17-KYR-PoliceImmigrationFBI-OnePager-Spanish-v01.pdf');
  });

  it('does not show the language notice in English', () => {
    render(<FamilyPlan />);
    expect(screen.queryByRole('link', { name: 'ACLU guide in Spanish' })).toBeNull();
  });

  it('saves and opens the same file as the English form', async () => {
    const user = userEvent.setup();
    renderSpanish();
    await user.type(field('Teléfono del consulado'), '555-0199');
    await user.type(screen.getByLabelText(/^Frase de contraseña para guardar/), PASSPHRASE);
    await user.click(screen.getByRole('button', { name: 'Guardar archivo bloqueado' }));
    expect((await screen.findByRole('status')).textContent).toBe('Guardado como family-plan.locked.txt.');
    expect(JSON.parse(await decryptText((await savedFile()).text, PASSPHRASE))).toEqual({ hotline: '1-800-308-0878', consulate: '555-0199' });
  });
});
