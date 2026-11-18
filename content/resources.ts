/**
 * GENERATED FILE. Do not edit it by hand.
 *
 * Reference content of the Resources page and the Share page: the outside
 * links with their notes, the AI prompts, and the address of the source code.
 * A script copied each string from the record of the old build
 * (content-verbatim.json, bundle index-BhtmjXkj.js), so that no address was
 * typed again. The names, the notes, and the prompts are not translated.
 *
 * The AI prompts are text that a visitor copies into a chatbot. For this app
 * they are data: the app shows them and copies them, and nothing more.
 *
 * To change this file, change the source and run the script again. The test
 * in services/sharePage.test.ts compares this content with the digest below.
 */

export type ResourceGroupId = "communication" | "rights" | "newJersey" | "backOffice";

export interface ResourceLink {
  name: string;
  url: string;
  note: string;
}

export interface ResourceGroup {
  /** The locale key of the heading is `resources.group.<id>`. */
  id: ResourceGroupId;
  /** The heading in English, as in the source. */
  heading: string;
  items: readonly ResourceLink[];
}

export interface AiPrompt {
  title: string;
  when: string;
  text: string;
}

export const RESOURCE_GROUPS: readonly ResourceGroup[] = [
  {
    id: "communication",
    heading: "Private communication",
    items: [
      {
        name: "Signal",
        url: "https://signal.org/download/",
        note: "Encrypted messages and calls. Use this first for anything sensitive, and turn on disappearing messages.",
      },
      {
        name: "Newsroom safety plan (Center for Cooperative Media)",
        url: "https://centerforcooperativemedia.org/safety/",
        note: "A guided plan for field, digital, legal, source-protection, and wellbeing risks. Your draft stays on your device. Adapted from work by the Journalism Protection Initiative at CUNY.",
      },
      {
        name: "CryptPad",
        url: "https://cryptpad.org/",
        note: "Encrypted shared documents and spreadsheets in the browser.",
      },
      {
        name: "Surveillance Self-Defense (EFF)",
        url: "https://ssd.eff.org/",
        note: "Plain guides on phones, passwords, protests, and surveillance.",
      },
    ],
  },
  {
    id: "rights",
    heading: "Know your rights",
    items: [
      {
        name: "ACLU: know your rights",
        url: "https://www.aclu.org/know-your-rights",
        note: "Guides for police stops, protests, immigration, and more.",
      },
      {
        name: "ACLU of New Jersey",
        url: "https://www.aclu-nj.org/",
        note: "State-specific rights information and legal work.",
      },
      {
        name: "Red cards (Immigrant Legal Resource Center)",
        url: "https://www.ilrc.org/red-cards-tarjetas-rojas",
        note: "Printable cards that state a person's rights in many languages.",
      },
      {
        name: "Informed Immigrant",
        url: "https://informedimmigrant.com/",
        note: "Immigration guides and help finding legal services.",
      },
      {
        name: "National Lawyers Guild mass defense",
        url: "https://www.nlg.org/massdefenseprogram/",
        note: "Legal support for protests and legal observers.",
      },
    ],
  },
  {
    id: "newJersey",
    heading: "Help in New Jersey",
    items: [
      {
        name: "NJ 211",
        url: "https://www.nj211.org/",
        note: "Statewide referrals for housing, food, utilities, and other needs.",
      },
      {
        name: "Legal Services of New Jersey",
        url: "https://www.lsnj.org/",
        note: "Free civil legal help for people with low incomes.",
      },
      {
        name: "NJ Alliance for Immigrant Justice",
        url: "https://www.njaij.org/",
        note: "Statewide immigrant rights coalition.",
      },
      {
        name: "NJ Coalition to End Homelessness",
        url: "https://www.njceh.org/",
        note: "Statewide homelessness policy, training, and the Garden State Leaders program.",
      },
    ],
  },
  {
    id: "backOffice",
    heading: "Advocacy and back-office help",
    items: [
      {
        name: "NJCEH advocacy alerts",
        url: "https://www.njceh.org/advocacyalerts",
        note: "Current homelessness advocacy opportunities in New Jersey.",
      },
      {
        name: "NJ Legislature",
        url: "https://www.njleg.state.nj.us/",
        note: "Search bills and check the source before you repeat a claim.",
      },
      {
        name: "AI and automation guides (Center for Cooperative Media)",
        url: "https://centerforcooperativemedia.org/resources/ai/",
        note: "Free guides written for small teams. Written for newsrooms, and most of it applies to nonprofits.",
      },
    ],
  },
];

export const AI_PROMPTS: readonly AiPrompt[] = [
  {
    title: "Meeting notes to a task list",
    when: "After a staff or board meeting",
    text: "Here are my meeting notes, with names removed: [notes]. List each decision, each task, who owns it, and the due date. Mark anything unclear. Do not add anything that is not in the notes.",
  },
  {
    title: "Long document to a plain summary",
    when: "Funder guidelines, state notices, board packets",
    text: "Summarize this document in plain language: [document]. List the deadlines, what we must do, and any amounts. Quote the section for each point so I can check it.",
  },
  {
    title: "Grant first draft",
    when: "When a blank application is the hard part",
    text: "Here are the funder's questions: [questions]. Here are the facts about our program: [facts]. Write an outline for each answer and list the information that is missing. Do not invent numbers or outcomes.",
  },
  {
    title: "One announcement, many formats",
    when: "Events and deadlines",
    text: "Here are the event details: [details]. Write a short email, a flyer blurb, a 160-character text message, and a social post. Use plain language and do not add details I did not give you.",
  },
  {
    title: "Volunteer or new staff checklist",
    when: "When one person holds all the knowledge",
    text: "Here is how we do this task now: [rough notes]. Turn this into a step-by-step checklist for a new volunteer. List anything I did not explain.",
  },
  {
    title: "Public comment or testimony opening",
    when: "When you have the facts and need a structure",
    text: "I am an advocate speaking about [issue]. I have direct experience with it. Here are the facts I want to use: [three or four plain facts, no names, no case numbers]. Write a two-minute spoken opening. Use plain language, and do not invent statistics or cite sources I have not given you.",
  },
];

/** The repository of the code, for "Host your own copy". */
export const SOURCE_CODE_URL = "https://github.com/jamditis/SecureNJ";

/** SHA-256 of JSON.stringify({ groups, prompts, sourceCodeUrl }) as read from the source. */
export const SOURCE_DIGEST = "0202301da6634583cfcb5f22164b6442e8142ed59f908b59fa9b875423a591a3";
