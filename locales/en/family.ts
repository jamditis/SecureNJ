/**
 * English text for the family emergency plan.
 *
 * The prompts of the plan, the first steps, and the notes with links are
 * not here. They are reference content in `content/familyPlan.ts`, and
 * they are not translated.
 */
const family = {
  'family.title': 'Family emergency plan',
  'family.summary': 'Writes down who picks up the kids, who to call, and where the papers are. You can save it locked or print it.',
  'family.lede': 'Decide now who does what if someone in your family is detained, so no one has to work it out in a crisis. Fill in only what helps.',
  'family.notice': "This page isn't saved until you save it, and nothing leaves your device. A printed plan isn't protected, so keep it somewhere safe. This isn't legal advice.",
  // Shown only when the language of the app is not English. A list of links follows it.
  'family.englishNotice':
    'The first steps and the questions of the plan are in English. You can write your answers in any language. Official know-your-rights materials in Spanish and other languages:',
  'family.firstSteps': 'Do these first',
  // The heading of the printed plan.
  'family.printTitle': 'Our family emergency plan',

  'family.keep': 'Keep your plan',
  'family.passphrase': 'Passphrase for saving',
  'family.save': 'Save locked file',
  'family.saved': 'Saved as {file}.',
  'family.saveFailed': 'Could not save the plan.',
  'family.open': 'Open a saved plan',
  'family.openNote': 'Type the passphrase of this file.',
  'family.openAction': 'Open',
  'family.openFailed': 'Could not open that file. Check the file and the passphrase.',
  'family.replaceConfirm': 'The changes on this page are not saved. Open a saved plan and replace them?',
  'family.print': 'Print',
} as const;

export default family;
