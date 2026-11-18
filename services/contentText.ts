/**
 * Gives a key to each sentence of the reference text in `content/`, so that
 * the text can have a translation.
 *
 * Each function here takes a lookup and returns one part of the content in
 * the language of the lookup. The same functions give the English text and
 * its keys to the translation script (`contentMessages`), so the keys cannot
 * be different in the two places.
 *
 * Not translated: phone numbers, addresses of pages, the contact of a
 * listing, and the names of organizations and products. A reader must find
 * the same name on the page that the link opens, and a value that becomes a
 * link must not come from a language file.
 */
import { FIRST_STEPS, HOTLINE_NOTE, LANGUAGE_LINKS, LEARN_MORE, PLAN_SECTIONS, type NotePart, type PlanSection } from '../content/familyPlan';
import { NOTE_EXAMPLE, STARTER_LISTINGS, type StarterListing } from '../content/resourceSheet';
import { AI_PROMPTS, RESOURCE_GROUPS, type AiPrompt, type ResourceGroup } from '../content/resources';
import { RIGHTS_CARD } from '../content/rightsCard';

/** Returns the text for a key in one language. `english` is the source text, and the result when no translation exists. */
export type ContentLookup = (key: string, english: string) => string;

/** The lookup for English: the source text. */
export const englishContent: ContentLookup = (_key, english) => english;

export interface RightsCardText {
  title: string;
  sections: readonly { heading: string; items: readonly string[] }[];
  contactLabels: Record<keyof typeof RIGHTS_CARD.contactLabels, string>;
  sourceLine: string;
}

export function rightsCardText(text: ContentLookup): RightsCardText {
  return {
    title: text('content.rights.title', RIGHTS_CARD.title),
    sections: RIGHTS_CARD.sections.map((section, s) => ({
      heading: text(`content.rights.section${s}.heading`, section.heading),
      items: section.items.map((item, i) => text(`content.rights.section${s}.item${i}`, item)),
    })),
    contactLabels: {
      hotline: text('content.rights.label.hotline', RIGHTS_CARD.contactLabels.hotline),
      lawyer: text('content.rights.label.lawyer', RIGHTS_CARD.contactLabels.lawyer),
      contact: text('content.rights.label.contact', RIGHTS_CARD.contactLabels.contact),
    },
    sourceLine: text('content.rights.source', RIGHTS_CARD.sourceLine),
  };
}

/**
 * A note is a sentence with links in it. A translation must be free to move
 * a link, so the sentence is one message with a slot for each link
 * (`{link0}`, `{link1}`), and the text of each link is a message of its own.
 */
function noteText(text: ContentLookup, key: string, parts: readonly NotePart[]): NotePart[] {
  const links = parts.filter((part) => typeof part !== 'string');
  let next = 0;
  const template = parts.map((part) => (typeof part === 'string' ? part : `{link${next++}}`)).join('');
  const linkTexts = links.map((link, index) => text(`${key}.link${index}`, link.text));
  return text(key, template)
    .split(/(\{link\d+\})/)
    .filter((piece) => piece !== '')
    .map((piece) => {
      const index = Number(/^\{link(\d+)\}$/.exec(piece)?.[1] ?? -1);
      return links[index] ? { text: linkTexts[index], href: links[index].href } : piece;
    });
}

export interface FamilyPlanText {
  sections: readonly PlanSection[];
  firstSteps: readonly string[];
  learnMore: readonly NotePart[];
  hotlineNote: readonly NotePart[];
  languageLinks: readonly { text: string; href: string }[];
}

export function familyPlanText(text: ContentLookup): FamilyPlanText {
  return {
    sections: PLAN_SECTIONS.map((section, s) => ({
      section: text(`content.family.section${s}`, section.section),
      items: section.items.map((item) => ({
        ...item,
        label: text(`content.family.${item.id}.label`, item.label),
        ...(item.hint ? { hint: text(`content.family.${item.id}.hint`, item.hint) } : {}),
      })),
    })),
    firstSteps: FIRST_STEPS.map((step, index) => text(`content.family.step${index}`, step)),
    learnMore: noteText(text, 'content.family.learnMore', LEARN_MORE),
    hotlineNote: noteText(text, 'content.family.hotlineNote', HOTLINE_NOTE),
    languageLinks: LANGUAGE_LINKS.map((link, index) => ({ ...link, text: text(`content.family.languageLink${index}`, link.text) })),
  };
}

export interface ResourceSheetText {
  starters: readonly StarterListing[];
  noteExample: string;
}

export function resourceSheetText(text: ContentLookup): ResourceSheetText {
  return {
    // Only the description has a translation. The name is the name of an
    // organization, and the contact is a phone number or an address that
    // becomes a link: a language file must not be able to change it.
    starters: STARTER_LISTINGS.map((listing, index) => ({
      ...listing,
      offers: text(`content.sheet.starter${index}.offers`, listing.offers),
    })),
    noteExample: text('content.sheet.noteExample', NOTE_EXAMPLE),
  };
}

export interface ResourcesText {
  groups: readonly ResourceGroup[];
  prompts: readonly AiPrompt[];
}

export function resourcesText(text: ContentLookup): ResourcesText {
  return {
    // The heading of a group is a UI message (`resources.group.<id>`).
    groups: RESOURCE_GROUPS.map((group) => ({
      ...group,
      items: group.items.map((item, index) => ({ ...item, note: text(`content.resources.${group.id}.item${index}.note`, item.note) })),
    })),
    prompts: AI_PROMPTS.map((prompt, index) => ({
      title: text(`content.resources.prompt${index}.title`, prompt.title),
      when: text(`content.resources.prompt${index}.when`, prompt.when),
      text: text(`content.resources.prompt${index}.text`, prompt.text),
    })),
  };
}

/** Each key of the reference text, with its English text. The translation script reads this. */
export function contentMessages(): Record<string, string> {
  const found: Record<string, string> = {};
  const record: ContentLookup = (key, english) => {
    if (key in found && found[key] !== english) throw new Error(`Two texts have the key ${key}`);
    found[key] = english;
    return english;
  };
  rightsCardText(record);
  familyPlanText(record);
  resourceSheetText(record);
  resourcesText(record);
  return found;
}
