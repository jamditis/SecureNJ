/**
 * English text for the Resources page and the Share page.
 *
 * In the steps of "Host your own copy", `backticks` mark code and
 * [square brackets] mark the text of the link to the code. Keep both marks
 * in a translation.
 */
const infoPages = {
  'resources.navTitle': 'Resources',
  'resources.lede': "Established tools and organizations, and prompts for everyday nonprofit work. This site isn't affiliated with any of them.",
  'resources.englishNotice': 'The names and the notes of the links, and the AI prompts, are in English.',
  'resources.group.communication': 'Private communication',
  'resources.group.rights': 'Know your rights',
  'resources.group.newJersey': 'Help in New Jersey',
  'resources.group.backOffice': 'Advocacy and back-office help',
  'resources.linkLabel': '{name} (opens in a new tab)',
  'resources.promptsTitle': 'AI prompts for back-office work',
  'resources.promptsIntro': 'These work on the free plans of ChatGPT, Gemini, and Claude. Use them to get a first draft faster, then put your own facts and voice back in.',
  'resources.caution.people.lead': 'Protect people first.',
  'resources.caution.people.text': "Don't paste case notes, intake forms, client details, names, or case numbers into a free chatbot. Free tools can keep what you type.",
  'resources.caution.settings.lead': 'Check your settings.',
  'resources.caution.settings.text': "Look for the data controls in each tool, and use a temporary chat if there is one. A temporary chat can still be kept for a while, so it isn't private.",
  'resources.caution.numbers.lead': 'Check every number.',
  'resources.caution.numbers.text': 'Chatbots invent details that sound right. Compare each date, amount, and citation with the source.',
  'resources.caution.work.lead': 'Ask first at work.',
  'resources.caution.work.text': 'Your employer may have rules or confidentiality duties that cover work documents.',
  'resources.copyPrompt': 'Copy prompt',
  'resources.copyFailed': 'The browser did not copy the text. Select the text and copy it by hand.',

  'sharePage.navTitle': 'Share this',
  'sharePage.lede': "Pass it on in the way that fits the people you're trying to reach.",
  'sharePage.noAddress': 'This copy is open from a file on this device, so it has no web address to share. Open the copy that your group hosts, and then come back to this page.',
  'sharePage.textTitle': 'By text message',
  'sharePage.message': 'Free tools to keep your community safe and informed, no account needed: {address}',
  'sharePage.copyMessage': 'Copy message',
  'sharePage.copyFailed': 'The browser did not copy the text. Select the text and copy it by hand.',
  'sharePage.paperTitle': 'On paper',
  'sharePage.paperText': 'Print this flyer for a meeting, a front desk, or a resource table. Some people you want to reach may not have reliable internet.',
  'sharePage.print': 'Print flyer',
  'sharePage.flyerLabel': 'Printable flyer',
  'sharePage.flyerTitle': 'Free tools to keep your community safe and informed',
  'sharePage.flyerIntro': 'No account and no sign-up. Scan the code or type the address.',
  'sharePage.flyerItemTitle': '{title}:',
  'sharePage.flyerUse.message': 'send something sensitive over email, text, or a USB drive.',
  'sharePage.flyerUse.rights': 'keep the words you need in your wallet.',
  'sharePage.flyerUse.family': 'decide now, so no one has to decide in a crisis.',
  'sharePage.flyerUse.sheet': 'get information to people who need it.',
  'sharePage.flyerUse.resources': 'rights guides, New Jersey help, and AI prompts for back-office work.',
  'sharePage.flyerNote': 'For anything sensitive, use Signal first. Leave out names, addresses, and case numbers.',
  'sharePage.qrLabel': 'QR code for {address}',
  'sharePage.hostTitle': 'Host your own copy',
  'sharePage.hostIntro': "Your group can run its own copy. Then you don't depend on this one, and you decide who hosts it. It needs someone who is comfortable with a command line.",
  'sharePage.host.code': 'Fork or download [the code on GitHub].',
  'sharePage.host.build': 'Run `npm install` and then `npm run build`. You need Node.js 22.',
  'sharePage.host.serve':
    'Put the `dist` folder on any static host that serves it over HTTPS. Browsers need HTTPS or localhost for the encryption to work, so a copy on a local network needs a certificate that the devices trust.',
  'sharePage.host.origin':
    'Give the copy a web address that serves nothing else, for example its own subdomain. A different site on the same scheme, host, and port can read and change the data that this app saves in the browser. A project site on GitHub Pages shares these with the other project sites of the same user.',
  'sharePage.host.signaling':
    'To sync group tools between devices, run a signaling server: `npm run signaling` starts one on port 4444. A page from HTTPS can connect only to a `wss://` address, so put the server behind a reverse proxy that has a TLS certificate.',
  'sharePage.host.default':
    'Members type the address of the server in the form that opens a room. To make it the default, put `VITE_SIGNALING_URLS=wss://your-server` in the file `.env.local` and build again.',
  'sharePage.hostDocs': 'The file `README.md` in the code has the full steps. The file `docs/signaling.md` describes the signaling server, and `docs/security.md` lists the limits.',
  'sharePage.linkLabel': '{name} (opens in a new tab)',
} as const;

export default infoPages;
