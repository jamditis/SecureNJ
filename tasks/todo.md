# Plan: improve and expand the toolkit

Decisions from the owner (2026-11-18):

- Pull request 1: foundation and all current tools. **Done, in review.**
- Pull request 2: four new tools and four platform capabilities. **Not started.**
- Sync: `y-webrtc` with a signaling server that the group runs.

## Baseline findings (measured on 2026-11-18)

Defects in `main` before this work:

1. The build was a blank page. `index.html` had no entry script.
2. All installs shared the same public rooms, with no password.
3. Sync did not connect. The two hard-coded signaling servers are gone.
4. The peer count never showed. The code read `.size` on an array.
5. The app was not offline-first. Tailwind and fonts came from CDNs. The exported event page also loaded Tailwind from a CDN.
6. The UI made false security claims ("No data leaves your browser", "Data is encrypted").
7. The retention setting of one device deleted data for all peers.
8. The phone tree lost all contacts when the user opened a different tool. Its export was plain JSON, although the UI said "encrypted". Its import accepted any JSON.
9. The whiteboard stored pixel coordinates, so a drawing moved on a different screen size. The eraser painted the background color.
10. Secure file share could not encrypt files.
11. Crypto: 100,000 PBKDF2 iterations, base64 that failed on large payloads, no format version.
12. No tests, no lint, no CI, no `CLAUDE.md`. One type error. The Gemini key was injected into the client bundle with no use.

## Pull request 1

### Phase 0: foundation

- [x] Entry script. No import map, no CDN, no web fonts. Tailwind 4 in the build. System fonts.
- [x] Removed the unused Gemini key injection and the AI Studio metadata file.
- [x] SVG favicon, Open Graph tags and image, content security policy in the build.
- [x] Vitest, ESLint, strict TypeScript, GitHub Actions workflow.
- [x] End-to-end test in Chromium with two members and a local signaling server.
- [x] Group spaces: room ID and room password from the passphrase.
- [x] One Yjs document for each space, one provider, shared hooks.
- [x] Signaling servers are a setting. `npm run signaling`. `docs/signaling.md`.
- [x] Crypto version 2: 600,000 iterations, version prefix, files, safe base64. Version 1 stays readable.
- [x] Guards for records from peers.
- [x] All UI text in `locales/en.ts` (prepares the Spanish translation).
- [x] Corrected security claims. `docs/security.md` with the limits.
- [x] `CLAUDE.md`, `docs/architecture.md`, `docs/testing.md` with the review checklist.

### Phase 1: current tools

- [x] Safety alerts: structured fields, confirmation by other members, "mark as clear", shared retention.
- [x] Mutual aid: status (open, claimed, done), edit, urgent flag, shared retention, encrypted export and import.
- [x] Group check-in: note, check-in time with an overdue flag, online state, leave the board.
- [x] Consensus: close and open again, written concerns, result summary, one position for each member.
- [x] Whiteboard: coordinates as fractions of the board, pointer events, line widths, real erase, undo, PNG export.
- [x] Phone tree: saved in the private document, real tree with a branch setting, a call card for each person, encrypted export, validated import.
- [x] Secure share: files, random passphrase, inline errors.
- [x] Event coordinator: export page with no network requests and its own content security policy.
- [x] Dashboard: live counts and space status.

## Pull request 2 (selected by the owner, not started)

New tools:

- [ ] Shift roster: volunteer shifts with sign-up. Shows shifts with too few people.
- [ ] Incident log: time-stamped observer notes with an encrypted export.
- [ ] Resource directory: hotlines, legal aid, and shelter contacts that the group maintains. Printable. The group supplies the content.
- [ ] Supply inventory: stock, location, low-stock flags.

Platform:

- [ ] Installable offline app: service worker and manifest.
- [ ] Panic wipe: one action deletes all local data, the saved space, and the offline cache.
- [ ] Encrypted backup and restore of a full space, and an invite link with a QR code. The passphrase is never in the link.
- [ ] Spanish translation with a language switch.

## Known limits, not in either pull request

- Data at rest in the browser is not encrypted.
- No roles inside a space. Each member can change and delete all data.
- TURN servers that need credentials are not supported.
- The main bundle is 546 kB (168 kB compressed). Split it by tool if the load time is a problem.

## Review

See the end of this file after the review agents finish.
