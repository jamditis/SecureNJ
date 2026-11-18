/**
 * GENERATED FILE. Do not edit it by hand.
 *
 * Reference content of the family emergency plan: the sections and prompts,
 * the first steps, the notes with their links, and the default hotline number.
 * A script copied each string from the record of the old build
 * (content-verbatim.json, bundle index-BhtmjXkj.js,
 * SHA-256 fd1bb203d05dec801be311c2304417d62e11af75ff0fc9495b20823e408bb2a9),
 * so that no prompt, link, or number was typed again. The text is not
 * translated: people rely on the exact words and numbers.
 *
 * To change this file, change the source and run the script again
 * (gen-family-plan.py). The test in services/family.test.ts compares this
 * content with a SHA-256 digest and fails if one character changes.
 */

export interface PlanItem {
  /** The key of the answer in a saved plan. The old build uses the same keys. */
  id: string;
  label: string;
  /** Shown on the screen only. A hint does not print. */
  hint?: string;
  /** True for an answer of more than one line. */
  long?: boolean;
}

export interface PlanSection {
  section: string;
  items: readonly PlanItem[];
}

/** A piece of a note: plain text, or a link to an outside page. */
export type NotePart = string | { text: string; href: string };

export const PLAN_SECTIONS: readonly PlanSection[] = [
  {
    section: "People to call first",
    items: [
      { id: "contact1", label: "First emergency contact and phone" },
      { id: "contact2", label: "Second emergency contact and phone" },
      { id: "lawyer", label: "Lawyer or legal group and phone" },
      { id: "hotline", label: "Rapid response hotline" },
      { id: "consulate", label: "Consulate phone", hint: "Only if this applies to you." },
    ],
  },
  {
    section: "Children and others who depend on you",
    items: [
      { id: "kids", label: "Children, schools, and daycares", long: true },
      { id: "pickup", label: "Who can pick them up, and who has told the school", long: true },
      { id: "care", label: "Who will care for them, and for how long", long: true },
      { id: "health", label: "Medicines, allergies, doctors, and insurance", long: true },
      { id: "others", label: "Others who depend on you, including pets", long: true },
    ],
  },
  {
    section: "Papers and money",
    items: [
      { id: "docs", label: "Where you keep important papers", hint: "Passports, birth certificates, immigration papers, and court documents.", long: true },
      { id: "alien", label: "A-number and country of birth", hint: "Family can use these to find someone with the ICE detainee locator. Leave this blank if you prefer not to write it down." },
      { id: "money", label: "Bills, rent, and who can reach your money", long: true },
    ],
  },
  {
    section: "What to tell your family",
    items: [
      { id: "wishes", label: "What you want to happen, in your own words", long: true },
    ],
  },
];

/** The list "Do these first". */
export const FIRST_STEPS: readonly string[] = [
  "Choose who will care for your children, and talk to them now.",
  "Ask a lawyer which papers your state accepts for a caregiver, such as a power of attorney. The rules vary by state.",
  "Update the school and daycare pickup lists.",
  "Have everyone memorize at least two phone numbers.",
  "Keep copies of important papers somewhere a trusted person can reach them.",
  "Show your family the ICE detainee locator, and tell them where this plan is.",
  "Check this plan every few months.",
];

/** The note under the first steps. */
export const LEARN_MORE: readonly NotePart[] = [
  "Learn more in the ",
  { text: "ILRC family preparedness plan", href: "https://www.ilrc.org/community-resources/know-your-rights/step-step-family-preparedness-plan" },
  ". Some of its details are specific to California. The ",
  { text: "ICE detainee locator", href: "https://locator.ice.gov/odls/homePage.do" },
  " is a government site, so a search there isn't private.",
];

/** The answers that a new plan starts with. The old build fills in the hotline number. */
export const DEFAULT_ANSWERS: Readonly<Record<string, string>> = {
  hotline: "1-800-308-0878",
};

/** The item that holds the default hotline number. */
export const HOTLINE_ITEM_ID = "hotline";

/**
 * Where the default hotline number comes from, and the request to confirm it.
 * The old build shows this note on the rights card, next to the same number.
 * `content/hotlines.ts` holds the same number and source: merge the two files.
 */
export const HOTLINE_NOTE: readonly NotePart[] = [
  "This is the NY/NJ Rapid Response Network number, as listed by the ",
  { text: "National Network for Immigrant and Refugee Rights", href: "https://nnirr.org/education-resources/community-resources-legal-assistance-recursos-comunitarios-asistencia-legal/immigration-hotlines-lineas-directas-de-inmigracion/" },
  ". Call it to confirm before you print or share it.",
];

/** The links of the old build to official material in Spanish and in other languages. */
export const LANGUAGE_LINKS: readonly { text: string; href: string }[] = [
  { text: "ILRC red cards", href: "https://www.ilrc.org/red-cards-tarjetas-rojas" },
  { text: "NJ Office of New Americans", href: "https://nj.gov/humanservices/njnewamericans/rights/rights/" },
  { text: "ACLU guide in Spanish", href: "https://www.aclu.org/files/kyr/MKG17-KYR-PoliceImmigrationFBI-OnePager-Spanish-v01.pdf" },
];
