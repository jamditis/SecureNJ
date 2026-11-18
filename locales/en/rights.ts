/**
 * English text for the page around the know-your-rights card. The text of the
 * card itself is in `content/rightsCard.ts`: it is not translated.
 * A name in braces, for example {link}, is the position of a link or a name.
 */
const rights = {
  'rights.title': 'Know your rights card',
  'rights.summary': 'A printable card on what to do if immigration agents come to your home, stop you, or detain you.',
  'rights.lede': "Most of this applies regardless of immigration status. Add your numbers, then print and cut the card. The site doesn't save what you type.",
  'rights.notice':
    "This is general information from the {guide} (updated August 4, 2026), not legal advice. A lawyer hasn't reviewed this short version. For anything you plan to hand out, use an official card from the list below. Rules differ by situation and status, and they can change, so ask an immigration lawyer about your case.",
  'rights.notice.guide': "ACLU's guide",
  'rights.englishOnly': 'The card text is in English only. For an official card in Spanish, use the {ilrc} or the {aclu}.',
  'rights.englishOnly.ilrc': 'ILRC red cards',
  'rights.englishOnly.aclu': 'ACLU guide in Spanish',
  'rights.field.hotline': 'Rapid response hotline',
  'rights.hint.hotline': 'This is the {name} number, as listed by the {source}. Call it to confirm before you print or share it.',
  'rights.field.lawyer': 'Your lawyer or legal group (optional)',
  'rights.field.contact': 'Emergency contact phone (optional)',
  'rights.hint.contact': 'Leave out a name if the card could be taken from you. Try to memorize these numbers too.',
  'rights.print': 'Print card',
  'rights.yourCard': 'Your card',
  'rights.cardLabel': 'Printable rights card',
  'rights.official.title': 'Official cards and other languages',
  'rights.official.ilrc': "{link}: free printable cards in many languages. They're always free, so be careful of anyone charging for them.",
  'rights.official.ilrc.link': 'ILRC red cards',
  'rights.official.nj': '{link}: state materials for individuals, businesses, and airports, in many languages.',
  'rights.official.nj.link': 'NJ Office of New Americans',
  'rights.official.aclu': '{spanish}, with more languages on the {main}.',
  'rights.official.aclu.spanish': 'ACLU guide in Spanish',
  'rights.official.aclu.main': 'main guide',
  'rights.phone.title': 'Get your phone ready',
  'rights.phone.memorize': 'Memorize key phone numbers, because you may not keep your phone.',
  'rights.phone.passcode': 'Use a long passcode, and hide message previews on your lock screen.',
  'rights.phone.eff': 'Read {link} for more on protecting your phone at protests and at the border.',
  'rights.phone.eff.link': "EFF's Surveillance Self-Defense",
} as const;

export default rights;
