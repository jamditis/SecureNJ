# SecureNJ

A local resilience toolkit for community organizers, legal aid groups, and mutual aid networks. It runs in the browser. There is no backend, no account, and no central database. A group hosts its own copy and controls its own data.

Read [docs/security.md](docs/security.md) before you use it for sensitive work. It states what the toolkit protects and what it does not.

## Tools

Shared with your space:

- **Safety alerts**: report enforcement activity, confirm reports from other members, mark a location as clear. Reports expire.
- **Group check-in**: each member shows a status. The board flags a member who needs support or who misses a check-in time.
- **Consensus builder**: proposals, positions (support, reservations, stand aside, block), and written concerns.
- **Whiteboard**: a shared drawing surface for site maps and routes.
- **Mutual aid board**: requests and offers that members claim and mark as done.

On your device only:

- **Event coordinator**: makes one encrypted HTML file with the details of an event. The file opens on any device with no connection.
- **Phone tree**: a contact list and a call tree. Each person gets a card that names only the people they call. The list never syncs.
- **Secure share**: encrypts text or a file with a passphrase.

## How it works

- **Local first.** Data is saved in the browser (IndexedDB). With no space, nothing leaves the device.
- **Spaces.** A group agrees on a space name and a passphrase. Members who type the same two values get the same shared data. The room ID and the room password come from the passphrase, so a person who does not have the passphrase cannot find the room or read its messages.
- **Peer to peer.** Members sync directly over WebRTC (Yjs). A small signaling server introduces the peers to each other. Your group runs this server. See [docs/signaling.md](docs/signaling.md).
- **Clone and own.** Fork the repo, build it, and serve the static files from any host.

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

Then type `ws://localhost:4444` in the space dialog.

## Build and host

```bash
npm run build
```

Serve the `dist/` folder from any static host over HTTPS. The build uses relative paths, so it works in a subfolder.

Optional build settings go in `.env.local`. See [.env.example](.env.example).

## Check your changes

```bash
npm run check
```

This runs the type check, lint, unit tests, the build, and the end-to-end test. [docs/testing.md](docs/testing.md) describes the tests and the review checklist.

## Status

Early stage. The tools work and have tests, but no outside party has audited the code. Data in the browser is not encrypted at rest. Review [docs/security.md](docs/security.md) and the code in `services/` before you depend on it.
