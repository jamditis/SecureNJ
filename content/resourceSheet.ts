/**
 * GENERATED FILE. Do not edit it by hand.
 *
 * Reference content of the resource sheet: the New Jersey starter listings,
 * the example for the note field, and the links to material in Spanish.
 * A script copied each string from the record of the old build
 * (content-verbatim.json, bundle index-BhtmjXkj.js), so that no name, phone number, or
 * address was typed again. The names and the numbers are not translated:
 * people rely on them. The descriptions are (see `services/contentText.ts`).
 *
 * To change this file, change the source and run the script again. The test
 * in services/sheet.test.ts compares this content with the digest below.
 */

export interface StarterListing {
  name: string;
  offers: string;
  when: string;
  contact: string;
}

export const STARTER_LISTINGS: readonly StarterListing[] = [
  { name: "NJ 211", offers: "Referrals for housing, food, utilities, and other needs", when: "", contact: "Dial 211 or nj211.org" },
  { name: "Legal Services of New Jersey", offers: "Free civil legal help for people with low incomes", when: "", contact: "lsnj.org" },
  { name: "NY/NJ Rapid Response Network", offers: "Hotline for immigration raids and detentions", when: "", contact: "1-800-308-0878" },
];

/** The example in the note field. It tells the person to put a date on the sheet. */
export const NOTE_EXAMPLE = "Checked November 2026";

/** Material in Spanish or in many languages that the old build links to. */
export const SPANISH_LINKS = [
  { id: "ilrc", url: "https://www.ilrc.org/red-cards-tarjetas-rojas" },
  { id: "nnirr", url: "https://nnirr.org/education-resources/community-resources-legal-assistance-recursos-comunitarios-asistencia-legal/immigration-hotlines-lineas-directas-de-inmigracion/" },
  { id: "aclu", url: "https://www.aclu.org/files/kyr/MKG17-KYR-PoliceImmigrationFBI-OnePager-Spanish-v01.pdf" },
] as const;

/** SHA-256 of JSON.stringify({ starters, noteExample, spanishLinks }) as read from the source. */
export const SOURCE_DIGEST = "7b4863ce3fb0a7ce42a120b3c3f9753b9ad279f03a4d38685b1bb1c3d8e90bbb";
