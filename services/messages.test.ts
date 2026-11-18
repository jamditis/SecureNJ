import { describe, expect, it } from 'vitest';
import { HOTLINE_NOTE, LEARN_MORE, PLAN_SECTIONS } from '../content/familyPlan';
import { STARTER_LISTINGS } from '../content/resourceSheet';
import { AI_PROMPTS, RESOURCE_GROUPS } from '../content/resources';
import { RIGHTS_CARD } from '../content/rightsCard';
import en from '../locales/en/index';
import { contentMessages, englishContent, familyPlanText, resourceSheetText, resourcesText, rightsCardText, type ContentLookup } from './contentText';
import { LOCALES, makeContentLookup, makeTranslate, pickLocale, translationOf, type Locale } from './i18n';
import { SOURCE_MESSAGES, exactPartsOf, numbersOf, slotsOf, translationProblem, usableTranslation } from './messages';

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
    // A contact becomes a "tel:" or "https:" link on the sheet.
    expect(sheet.starters.map((starter) => starter.contact)).toEqual(STARTER_LISTINGS.map((starter) => starter.contact));
    expect(sheet.starters[0].offers).toBe(STARTER_LISTINGS[0].offers.toUpperCase());
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

  it('refuses a phone number with its parts in a different order or with a part added', () => {
    expect(translationProblem('Call 1-800-308-0878.', 'Llama al 1-308-800-0878.')).toBe('exact');
    expect(translationProblem('Call 1-800-308-0878.', 'Llama al 0878-308-800-1.')).toBe('exact');
    expect(translationProblem('1-800-308-0878', '1-800-308-0878-911')).toBe('numbers');
    expect(translationProblem('1-800-308-0878', '1-800-308-0878-1')).toBe('exact');
    expect(translationProblem('1-800-308-0878', '9-1-800-308-0878')).toBe('exact');
    expect(translationProblem('Call 1-800-308-0878.', '拨打1-800-308-0878。')).toBeNull();
  });

  it('refuses a second phone number that the English text does not have, and accepts the month of a date', () => {
    expect(translationProblem('Dial 211', 'Marca 211 o 911')).toBe('numbers');
    expect(translationProblem('Checked November 2026', '2026年11月核实')).toBeNull();
  });

  it('refuses a changed form number, address of a site, file name, or code span', () => {
    expect(translationProblem('Form I-205 is a warrant', 'El formulario l-205 es una orden')).toBe('exact');
    expect(translationProblem('Dial 211 or nj211.org', 'Marca 211 o nj211.example.com')).toBe('exact');
    expect(translationProblem('Dial 211 or nj211.org', 'Marca 211 o visita nj211.org')).toBeNull();
    expect(translationProblem('Dial 211 or nj211.org', 'Marca 211 o nj211.org.example.com')).toBe('exact');
    expect(translationProblem('Dial 211 or nj211.org', 'Marca 211 o not-nj211.org')).toBe('exact');
    expect(translationProblem('Read nj211.org.', '请访问nj211.org。')).toBeNull();
    expect(translationProblem('lsnj.org', 'https://lsnj-help.example/login')).toBe('exact');
    expect(translationProblem('Saved as witness-notes.locked.txt.', 'Guardado como notas.txt.')).toBe('exact');
    expect(translationProblem('Run `npm run build`.', 'Ejecuta `npm run deploy`.')).toBe('exact');
    expect(translationProblem('Run `npm run build`.', 'Ejecuta `npm run build`.')).toBeNull();
  });

  it('refuses a rights card text that does not keep the sentence to say to an agent in English', () => {
    const english = 'Say: "I do not consent to your entry."';
    const key = 'content.rights.section0.item2';
    expect(translationProblem(english, 'Di: "I do not consent to your entry." (No doy mi consentimiento.)', key)).toBeNull();
    expect(translationProblem(english, '说：“I do not consent to your entry.”（我不同意你们进入。）', key)).toBeNull();
    expect(translationProblem(english, 'Di: "No doy mi consentimiento para que entren."', key)).toBe('quotes');
    expect(translationProblem(english, 'Di: "I consent."', key)).toBe('quotes');
    // The rule is for the rights card. A quoted name in a UI text can have a translation.
    expect(translationProblem('The button "Save"', 'El botón "Guardar"', 'lock.hint')).toBeNull();
  });

  // A rule that the English text itself does not pass would refuse each correct translation.
  it('accepts each English message as a translation of itself', () => {
    const refused = Object.entries(SOURCE_MESSAGES).filter(([key, english]) => translationProblem(english, english, key) !== null);
    expect(refused.map(([key]) => key)).toEqual([]);
    expect(translationProblem('Put it in the file `.env.local`.', 'Ponlo en el archivo `.env.local`.')).toBeNull();
    expect(translationProblem('Put it in the file `.env.local`.', 'Ponlo en el archivo `.env`.')).toBe('exact');
  });

  it('refuses a character that a reader cannot see', () => {
    expect(translationProblem('Open the door', 'Abre‮ la puerta')).toBe('invisible');
    expect(translationProblem('Open the door', 'Abre​ la puerta')).toBe('invisible');
    expect(translationProblem('Open the door', 'افتح؜ الباب')).toBe('invisible');
    expect(translationProblem('Open the door', 'Abre la puerta')).toBeNull();
  });

  it('keeps the sentences to say to an agent in English in each language file', () => {
    const quoted = Object.entries(SOURCE_MESSAGES).filter(([key, english]) => key.startsWith('content.rights.') && /"[^"]+"/.test(english));
    expect(quoted.map(([key]) => key)).toEqual(['content.rights.section0.item2', 'content.rights.section0.item3', 'content.rights.section1.item1']);
    for (const code of OTHER_LOCALES) {
      for (const [key, english] of quoted) {
        for (const quote of english.match(/"[^"]+"/g) ?? []) expect([code, key, translationOf(code)[key]?.includes(quote.slice(1, -1))]).toEqual([code, key, true]);
      }
    }
  });

  it('refuses an empty text and a value that is not text', () => {
    expect(translationProblem('Hello', '  ')).toBe('empty');
    expect(translationProblem('Hello', 5)).toBe('empty');
    expect(translationProblem('Hello', null)).toBe('empty');
  });

  it('reads slots in any order, each number as many times as the text has it, and the parts that must not change', () => {
    expect(slotsOf('{b} then {a}')).toBe(slotsOf('{a} then {b}'));
    expect(numbersOf('Dial 211 or 1-800-308-0878')).toEqual(['211', '1', '800', '308', '0878']);
    expect(exactPartsOf('Dial 211 or 1-800-308-0878, form I-205, see nj211.org and `npm test`')).toEqual(['1-800-308-0878', 'I-205', 'nj211.org', '`npm test`']);
    expect(translationProblem('2 doors and 2 windows', '2 puertas y ventanas')).toBe('numbers');
    expect(translationProblem('2 doors and 2 windows', '2 ventanas y 2 puertas')).toBeNull();
  });
});

describe('language file at run time', () => {
  const source = { greeting: 'Hello {name}', phone: 'Call 211' };

  it('uses only the entries that are safe to show', () => {
    // A language file arrives as parsed JSON, where "__proto__" is a key like any other.
    const file: unknown = JSON.parse('{"greeting":"Hola {name}","phone":"Llama al 212","unknown":"x","__proto__":"y","toString":"z"}');
    const usable = usableTranslation(file, source);
    expect(usable).toEqual({ greeting: 'Hola {name}' });
    expect(Object.keys(usable)).toEqual(['greeting']);
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
      const problem = translationProblem(SOURCE_MESSAGES[key], text, key);
      return problem ? [`${key}: ${problem}`] : [];
    });
    expect(faults).toEqual([]);
    expect(Object.keys(translationOf(code))).toHaveLength(Object.keys(file).length);
  });

  // If one of these had no translation, a reader would get the notice in English, which they may not read.
  const NOTICES = ['language.machineNote', 'language.report', 'rights.translated', 'rights.showEnglish', 'rights.printNote', 'family.translatedNotice', 'limits.not.14.lead', 'limits.not.14.text'] as const;

  it.each(OTHER_LOCALES)('tells a reader of %s, in that language, that the text is a machine translation', (code) => {
    for (const key of NOTICES) {
      const note = translationOf(code)[key];
      expect([key, Boolean(note)]).toEqual([key, true]);
      expect([key, note]).not.toEqual([key, en[key]]);
    }
  });
});
