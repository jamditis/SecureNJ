import { describe, expect, it } from 'vitest';
import { HOTLINE_NOTE, LEARN_MORE, PLAN_SECTIONS } from '../content/familyPlan';
import { STARTER_LISTINGS } from '../content/resourceSheet';
import { AI_PROMPTS, RESOURCE_GROUPS } from '../content/resources';
import { RIGHTS_CARD } from '../content/rightsCard';
import en from '../locales/en/index';
import { contentMessages, englishContent, familyPlanText, resourceSheetText, resourcesText, rightsCardText, type ContentLookup } from './contentText';
import { LOCALES, makeContentLookup, makeTranslate, pickLocale, translationOf, type Locale } from './i18n';
import { SOURCE_MESSAGES, numbersOf, slotsOf, translationProblem, usableTranslation } from './messages';

const OTHER_LOCALES = (Object.keys(LOCALES) as Locale[]).filter((code) => code !== 'en');

describe('keys of the reference text', () => {
  const content = contentMessages();

  it('gives each sentence a key that starts with "content." and is not a UI key', () => {
    expect(Object.keys(content).length).toBeGreaterThan(80);
    for (const key of Object.keys(content)) {
      expect(key.startsWith('content.')).toBe(true);
      expect(Object.hasOwn(en, key)).toBe(false);
    }
  });

  it('has each sentence of the rights card', () => {
    const texts = new Set(Object.values(content));
    for (const section of RIGHTS_CARD.sections) {
      expect(texts.has(section.heading)).toBe(true);
      for (const item of section.items) expect(texts.has(item)).toBe(true);
    }
    expect(texts.has(RIGHTS_CARD.sourceLine)).toBe(true);
  });

  it('gives the English text back, with no change, when the lookup is English', () => {
    expect(rightsCardText(englishContent)).toEqual({
      title: RIGHTS_CARD.title,
      sections: RIGHTS_CARD.sections,
      contactLabels: RIGHTS_CARD.contactLabels,
      sourceLine: RIGHTS_CARD.sourceLine,
    });
    const plan = familyPlanText(englishContent);
    expect(plan.sections).toEqual(PLAN_SECTIONS);
    // A note is joined to one message and split again. The parts must be the same.
    expect(plan.learnMore).toEqual(LEARN_MORE);
    expect(plan.hotlineNote).toEqual(HOTLINE_NOTE);
    expect(resourceSheetText(englishContent).starters).toEqual(STARTER_LISTINGS);
    expect(resourcesText(englishContent).groups).toEqual(RESOURCE_GROUPS);
    expect(resourcesText(englishContent).prompts).toEqual(AI_PROMPTS);
  });

  it('does not translate a name, a phone number, or an address of a page', () => {
    const upper: ContentLookup = (_key, english) => english.toUpperCase();
    const sheet = resourceSheetText(upper);
    expect(sheet.starters.map((starter) => starter.name)).toEqual(STARTER_LISTINGS.map((starter) => starter.name));
    for (const [index, group] of resourcesText(upper).groups.entries()) {
      expect(group.items.map((item) => [item.name, item.url])).toEqual(RESOURCE_GROUPS[index].items.map((item) => [item.name, item.url]));
    }
    expect(familyPlanText(upper).sections.flatMap((section) => section.items.map((item) => item.id))).toEqual(
      PLAN_SECTIONS.flatMap((section) => section.items.map((item) => item.id)),
    );
  });

  it('lets a translation move a link in a note, and keeps the address of each link', () => {
    const moved: ContentLookup = (key, english) => {
      if (key === 'content.family.learnMore') return 'Sitio {link1}; guía {link0}.';
      if (key === 'content.family.learnMore.link0') return 'plan de la ILRC';
      return english;
    };
    const links = LEARN_MORE.filter((part) => typeof part !== 'string');
    expect(familyPlanText(moved).learnMore).toEqual([
      'Sitio ',
      { text: links[1].text, href: links[1].href },
      '; guía ',
      { text: 'plan de la ILRC', href: links[0].href },
      '.',
    ]);
  });

  it('keeps a slot that has no link as text, so the fault is visible', () => {
    const wrong: ContentLookup = (key, english) => (key === 'content.family.learnMore' ? 'Ver {link7}.' : english);
    expect(familyPlanText(wrong).learnMore).toEqual(['Ver ', '{link7}', '.']);
  });
});

describe('check of a translated message', () => {
  it('accepts a translation that keeps the slots and the numbers', () => {
    expect(translationProblem('Send {count} alerts to {name}.', 'Envía {count} alertas a {name}.')).toBeNull();
    expect(translationProblem('Call 1-800-308-0878 before 5 pm.', 'Llama al 1-800-308-0878 antes de las 5 de la tarde.')).toBeNull();
    expect(translationProblem('Updated August 4, 2026.', '更新于2026年8月4日。')).toBeNull();
  });

  it('refuses a translation with a slot that is missing, added, or renamed', () => {
    expect(translationProblem('Hello {name}', 'Hola')).toBe('slots');
    expect(translationProblem('Hello', 'Hola {name}')).toBe('slots');
    expect(translationProblem('Hello {name}', 'Hola {nombre}')).toBe('slots');
    expect(translationProblem('{a} and {a}', '{a}')).toBe('slots');
  });

  it('refuses a translation that changes a number, so a phone number cannot change', () => {
    expect(translationProblem('Call 1-800-308-0878.', 'Llama al 1-800-308-0879.')).toBe('numbers');
    expect(translationProblem('Form I-205', 'Formulario I')).toBe('numbers');
    // Digits of a different numeral system are not the same text for a phone keypad.
    expect(translationProblem('Dial 211', 'اتصل بالرقم ٢١١')).toBe('numbers');
  });

  it('refuses an empty text and a value that is not text', () => {
    expect(translationProblem('Hello', '  ')).toBe('empty');
    expect(translationProblem('Hello', 5)).toBe('empty');
    expect(translationProblem('Hello', null)).toBe('empty');
  });

  it('reads slots in any order, and each number as many times as the text has it', () => {
    expect(slotsOf('{b} then {a}')).toBe(slotsOf('{a} then {b}'));
    expect(numbersOf('Dial 211 or 1-800-308-0878')).toEqual(['211', '1', '800', '308', '0878']);
    expect(translationProblem('2 doors and 2 windows', '2 puertas y ventanas')).toBe('numbers');
    expect(translationProblem('2 doors and 2 windows', '2 ventanas y 2 puertas')).toBeNull();
  });
});

describe('language file at run time', () => {
  const source = { greeting: 'Hello {name}', phone: 'Call 211' };

  it('uses only the entries that are safe to show', () => {
    const file = { greeting: 'Hola {name}', phone: 'Llama al 212', unknown: 'x', __proto__: 'y' };
    expect(usableTranslation(file, source)).toEqual({ greeting: 'Hola {name}' });
  });

  it('gives no entry for a file that is not an object', () => {
    expect(usableTranslation(null, source)).toEqual({});
    expect(usableTranslation('text', source)).toEqual({});
  });

  it('shows the English text for a key with no translation', () => {
    const t = makeTranslate({ 'common.cancel': 'Cancelar' });
    expect(t('common.cancel')).toBe('Cancelar');
    expect(t('common.close')).toBe(en['common.close']);
    const content = makeContentLookup({ 'content.rights.title': 'Conoce tus derechos' });
    expect(content('content.rights.title', 'Know your rights')).toBe('Conoce tus derechos');
    expect(content('content.rights.source', 'Source')).toBe('Source');
  });
});

describe('languages of the app', () => {
  it('selects a language from the browser, and the saved choice first', () => {
    expect(pickLocale(null, ['pt-BR', 'en'])).toBe('pt');
    expect(pickLocale(null, ['zh-CN'])).toBe('zh');
    expect(pickLocale(null, ['ar-EG'])).toBe('ar');
    expect(pickLocale(null, ['ht'])).toBe('ht');
    expect(pickLocale(null, ['fr-FR', 'de'])).toBe('en');
    expect(pickLocale('es', ['ar'])).toBe('es');
    expect(pickLocale('xx', ['ar'])).toBe('ar');
  });

  it('sets right to left for Arabic only', () => {
    expect(OTHER_LOCALES.filter((code) => LOCALES[code].dir === 'rtl')).toEqual(['ar']);
  });

  // A fault in a language file does not break the app: the entry is dropped
  // and the English text shows. This test makes the fault visible instead.
  it.each(OTHER_LOCALES)('has a file for %s in which each entry is a known key with a safe text', (code) => {
    const file = LOCALES[code].file as Record<string, unknown>;
    const faults = Object.entries(file).flatMap(([key, text]) => {
      if (!Object.hasOwn(SOURCE_MESSAGES, key)) return [`${key}: unknown key`];
      const problem = translationProblem(SOURCE_MESSAGES[key], text);
      return problem ? [`${key}: ${problem}`] : [];
    });
    expect(faults).toEqual([]);
    expect(Object.keys(translationOf(code))).toHaveLength(Object.keys(file).length);
  });

  it.each(OTHER_LOCALES)('has no direction control character in the text for %s', (code) => {
    const file = LOCALES[code].file as Record<string, string>;
    const withControl = Object.entries(file).filter(([, text]) => /[‎‏‪-‮⁦-⁩]/.test(text));
    expect(withControl.map(([key]) => key)).toEqual([]);
  });

  it.each(OTHER_LOCALES)('tells a reader of %s, in that language, that the text is a machine translation', (code) => {
    const note = translationOf(code)['language.machineNote'];
    expect(note).toBeTruthy();
    expect(note).not.toBe(en['language.machineNote']);
  });
});
