# SecureNJ

A local resilience toolkit for community organizers, legal aid groups, and mutual aid networks. It runs in the browser. There is no backend, no account, and no central database. A group hosts its own copy and controls its own data.

Read [docs/security.md](docs/security.md) before you use it for sensitive work. It states what the toolkit protects and what it does not.

## Tools

Send something privately:

- **Lock a message**: locks text with a passphrase. Gives a link, a QR code, and the locked text.
- **Lock a file**: makes one locked HTML file that opens in any browser with the passphrase.
- **Event coordinator**: makes one locked HTML file with the details of an event.

Get ready before you need it:

- **Know your rights card**: a printable card.
- **Family emergency plan**: a plan to fill in, print, and save as a locked file.
- **Phone tree**: a contact list and a call tree. Each person gets a card that names only the people they call.

Document and share:

- **Witness notes**: a guided form for what you saw, saved as a locked file.
- **Photo cleaner**: removes hidden data from a photo and covers parts of it.
- **Resource sheet**: a printable sheet of hotlines and help that a group edits.

Work as a group (each tool has its own room):

- **Safety alerts**: report enforcement activity, confirm reports, mark a location as clear. Never saved on the device.
- **Group check-in**: each member shows a status. The board flags a member who needs support or who misses a check-in time.
- **Mutual aid board**: requests and offers that members claim and mark as done.
- **Consensus builder**: proposals, positions, and written concerns.
- **Whiteboard**: a shared drawing surface.
- **Shift roster**: shifts with sign-up. Shows the shifts that still need people.
- **Supply inventory**: stock, location, and low-stock flags.

The app is in English, Spanish, Portuguese (Brazil), Haitian Creole, Chinese (Simplified), and Arabic. English is the source text. Each other language is a machine translation that no person reviewed, and the app says so. This includes the text of the rights card, which can also show in English. It opens with no connection after the first visit.

## How it works

- **Local first.** Data is saved in the browser (IndexedDB). With no room, nothing leaves the device.
- **Rooms.** A group agrees on a group name and a passphrase. Each shared tool has its own room: the room ID and the room password come from the name, the passphrase, and the tool. A person who does not have the passphrase cannot find a room or read its messages. The app does not store the passphrase: a member types it at each visit, for each tool.
- **Peer to peer.** Members sync directly over WebRTC (Yjs). A small signaling server introduces the peers to each other. Your group runs this server. See [docs/signaling.md](docs/signaling.md).
- **Clone and own.** Fork the repo, build it, and serve the static files from an origin that serves nothing else.

[docs/architecture.md](docs/architecture.md) describes the design.

## Run it

Prerequisite: Node.js 22.

```bash
npm install
```

```bash
npm run dev
```

The app is at `http://localhost:3000`. To sync between devices, you also need a signaling server. For a test on one computer:

```bash
npm run signaling
```

Then type `ws://localhost:4444` in the room form of a tool.

## Build and host

```bash
npm run build
```

Serve the `dist/` folder from any static host over HTTPS. The build uses relative paths, so it works in a subfolder. Set the response header `Content-Security-Policy: frame-ancestors 'none'` on the host.

Optional build settings go in `.env.local`. See [.env.example](.env.example).

## Publish to GitHub Pages

Each push to `main` publishes the live site. A merge of a pull request is a push. There is no step for a person.

The workflow "Publish to the live site" runs all checks, builds `main`, and writes the build to the `gh-pages` branch, which GitHub Pages serves. Then it waits until the live site serves the new page. A build that fails a check is not published. The history of `gh-pages` keeps each earlier build: to go back, revert the last commit on `gh-pages`, or revert the change on `main`.

To publish `main` again with no new commit, open the Actions tab, select "Publish to the live site", then "Run workflow".

Optional repository variables: `VITE_SIGNALING_URLS` (the default signaling servers) and `VITE_SITE_URL` (the address for link previews, if the site has its own domain).

## Check your changes

```bash
npm run check
```

This runs the type check, lint, unit tests, the build, and the end-to-end test. [docs/testing.md](docs/testing.md) describes the tests and the review checklist.

## Status

Early stage. The tools work and have tests, but no outside party has audited the code. Data in the browser is not encrypted at rest. Review [docs/security.md](docs/security.md) and the code in `services/` before you depend on it.
