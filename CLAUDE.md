# SecureNJ

A browser-only toolkit for community organizers. No backend. Data is in IndexedDB through Yjs and syncs peer to peer in a "space" that a group opens with a name and a passphrase.

Read `docs/architecture.md` first. Read `docs/security.md` before you change `services/crypto.ts`, `services/space.ts`, or `services/sync.tsx`.

## Commands

- `npm run dev`: dev server on port 3000
- `npm run check`: type check, lint, tests, build, end-to-end test. Run it before each commit.
- `npm test`: unit and component tests only
- `npm run e2e`: end-to-end test. Needs `npm run build` first.
- `npm run signaling`: local signaling server on port 4444

## Files

Root:

- `index.html`, `index.tsx`, `index.css`: entry. Tailwind 4, system fonts.
- `App.tsx`: navigation, the space dialog, and the active tool.
- `tools.ts`: the list of tools. Add a tool here and in `VIEWS` in `App.tsx`.
- `types.ts`: record types.
- `vite.config.ts`: build, content security policy, test config.
- `test-setup.ts`: IndexedDB and Web Crypto for tests.

`components/` (one file for each tool; no storage or network code):

- `Dashboard.tsx`: tool cards with live counts, space status.
- `Sightings.tsx`: safety alerts.
- `StatusBoard.tsx`: group check-in.
- `ConsensusBuilder.tsx`: proposals and positions.
- `TacticalWhiteboard.tsx`: shared canvas.
- `MutualAid.tsx`: requests and offers.
- `EventCreator.tsx`: encrypted event page.
- `PhoneTree.tsx`: contacts and call tree. Private document.
- `SecureShare.tsx`: text and file encryption.
- `SpaceDialog.tsx`: create, join, leave a space.
- `ui.tsx`: shared parts (Button, Modal, Field, PassphraseInput, ToolHeader).
- `test-utils.tsx`, `tools.test.tsx`: component tests.

`services/` (logic; tests are in `*.test.ts` next to the code):

- `sync.tsx`: `SyncProvider`, `useSync`, `useRecords`, `useSharedSetting`, `useOnlineMembers`.
- `space.ts`: key derivation for a space, signaling address parser, saved space.
- `crypto.ts`: passphrase encryption for text and files.
- `passphrase.ts`: random passphrase.
- `schema.ts`: type guards for records from peers and files.
- `retention.ts`: expiry of shared records.
- `alerts.ts`, `status.ts`, `consensus.ts`, `phoneTree.ts`, `whiteboard.ts`: logic for one tool each.
- `eventExport.ts`: builds the event page.
- `identity.ts`: member ID and display name.
- `i18n.ts`: `useT`. `time.ts`: relative time. `download.ts`: save a file. `config.ts`: build settings.

Other:

- `locales/en.ts`: all UI text.
- `e2e/smoke.mjs`: end-to-end test.
- `docs/`: architecture, security, signaling, testing (with the review checklist).
- `tasks/todo.md`: the plan and its status. `tasks/lessons.md`: rules from past corrections.

## Rules

- No user-visible text in components. Add a key to `locales/en.ts` and use `useT()`.
- UI text and docs use sentence case and simple, direct English.
- A tool reads shared data only through `useRecords` with a guard from `schema.ts`.
- Do not read-modify-write a field that two members can change at the same time. Use one record for each member and action (see positions and confirmations).
- A setting that causes deletes must be a shared setting (`useSharedSetting`).
- No request to a different host. No CDN. The end-to-end test fails on one.
- Do not state a security property in the UI or docs unless a test shows it.
- Bug fix: write the failing test first.
- Commit messages say why. Do not add co-author trailers or tool attribution text to commits, pull requests, or files.
- Use the checklist in `docs/testing.md` before you finish.
