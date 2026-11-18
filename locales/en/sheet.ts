/**
 * English text for the resource sheet. The starter listings and the example
 * for the note field are not here: they are exact reference content in
 * `content/resourceSheet.ts`.
 */
const sheet = {
  'sheet.title': 'Resource sheet',
  'sheet.summary': 'Makes a one-page list of local help that you can print or copy into a group chat.',
  'sheet.lede': 'Make a one-page list of local help for a front desk, a community fridge, or a group chat. Print it or copy it as text.',
  'sheet.notice':
    "Only list places that want to be public. Don't include safe houses, private homes, or anyone's immigration status. Call each listing to confirm before you share, and put the date on the sheet.",
  'sheet.field.title': 'Title',
  'sheet.defaultTitle': 'Community resources',
  'sheet.field.note': 'Short note',
  'sheet.listings': 'Listings',
  'sheet.listing': 'Listing {number}',
  'sheet.field.name': 'Name',
  'sheet.field.offers': 'What it offers',
  'sheet.field.when': 'When and where',
  'sheet.field.contact': 'Phone or website',
  'sheet.remove': 'Remove',
  'sheet.removeListing': 'Remove listing {number}',
  'sheet.add': 'Add a listing',
  'sheet.addStarters': 'Add New Jersey starters',
  'sheet.startersInEnglish':
    'The New Jersey starters are in English, because the names and the numbers must be exact. You can change them after you add them. Material in Spanish:',
  'sheet.spanishLink.ilrc': 'ILRC red cards',
  'sheet.spanishLink.nnirr': 'Hotline list of the National Network for Immigrant and Refugee Rights',
  'sheet.spanishLink.aclu': 'ACLU guide in Spanish',
  'sheet.keepDraft': "Save a draft in this browser. It isn't encrypted, so don't use this on a shared device. Uncheck to delete the draft.",
  'sheet.draftNotSaved': 'The browser did not save the draft. The sheet is on this page only. Print it or copy it before you close the page.',
  'sheet.draftNotDeleted': 'The browser did not delete the draft. Delete the data of this site in the settings of the browser.',
  'sheet.yourSheet': 'Your sheet',
  'sheet.print': 'Print',
  'sheet.copy': 'Copy as text',
  'sheet.copyFailed': 'The browser did not copy the text. Select the text of the sheet and copy it.',
  'sheet.sheetLabel': 'Printable resource sheet',
  'sheet.empty': 'Your listings appear here.',
} as const;

export default sheet;
