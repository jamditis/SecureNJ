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

## Pull request 2 (jamditis/SecureNJ#4). Done, in review.

Decisions from the owner during this work:

- The source of the published site (`gh-pages`) is lost. Rebuild its tools and pages here, in the current look, with its wording for those tools and pages.
- Use its four strict rules: one room for each tool, never store the passphrase, do not save alerts to disk, strong passphrase check everywhere.
- Legal text stays in English in the Spanish UI, with official Spanish links.
- Do not touch the live site until the owner approves a publish.

Platform:

- [x] Offline start: service worker and manifest.
- [x] Spanish with a language switch.
- [x] Encrypted backup and restore, for the records of one tool.
- [x] Invite link with QR code. No passphrase in the link.
- [x] Erase all data, in all tabs. It also removes the data that the published site stored.

Stricter rules:

- [x] One room for each tool.
- [x] The passphrase is never stored and not kept in memory.
- [x] Safety alerts are never written to the device, and have no backup.
- [x] The passphrase rule is in the one encrypt function.

New tools:

- [x] Shift roster.
- [x] Supply inventory.

Ported from the published site:

- [x] Witness notes (covers the "incident log" that was selected).
- [x] Resource sheet and the resources page (cover the "resource directory" that was selected).
- [x] Know your rights card, family emergency plan, photo cleaner.
- [x] Lock a file, and lock a message with a link and a QR code. Old links and old locked text still open.
- [x] Pages: limits, resources, share this. Page addresses as on the published site.

Not done, for a person to do:

- [ ] A native speaker reviews the Spanish text. Strings with an open choice: "reporte" for both an alert report and a check-in; "despejado" for "clear"; "postura" for a position; "preocupación" for a concern; the one legal sentence in the witness notes notice.
- [ ] A person confirms the rapid response hotline number (1-800-308-0878), which comes from the published site.
- [ ] Test the photo cleaner in Safari and Firefox. It was tested in Chromium only.
- [ ] Decide when to publish. The live site still serves the old build.

## Known limits, not in either pull request

- Data at rest in the browser is not encrypted.
- No roles inside a space. Each member can change and delete all data.
- TURN servers that need credentials are not supported.
- The main bundle is about 700 kB. Split it by tool if the load time is a problem.
- The photo cleaner draws a photo at full size. A very large photo can be more than a phone browser permits.
- In the photo cleaner, a cover can be placed with a pointer only, not with the keyboard.
- With no room, all shared tools use one local document.

## Review

Two independent review agents read pull request 1 before merge: one for security, one for correctness. They reported 14 and 13 findings. Two were the same defect. All confirmed findings are fixed in the second commit, each with a test, except the items in the list below.

Fixed after review:

- The signaling connection stayed open after "leave the space".
- The text of deleted and expired records stayed in the browser database log.
- Expiry ran only while the alerts tool or the aid tool was open.
- "Leave and delete" kept the member ID and the name, did not wait for the delete, and did not reach other tabs.
- One member ID linked a device across all spaces. The ID is now different in each space.
- The retention field of the aid board deleted posts for the space on each keystroke.
- A post and its claim state shared one record, so a concurrent edit and claim lost one.
- A space that could not open locked the user out at each start. A `ws://` address on an HTTPS page is now refused.
- A record under a wrong map key could not be deleted.
- The encrypted file name showed the original file name.
- Imported posts kept unknown fields and future times, and expired posts were "added" and then deleted.
- Passphrases were not put in one Unicode form for exports.
- A weak space passphrase got only a warning.
- Whiteboard: a second pointer broke the line, and a redraw removed the line in progress.
- Dialogs: no focus handling, and Escape closed all open dialogs.
- An edit of a status removed its check-in time.
- The file field kept the old file after a mode change.
- The "database not available" message could not show.
- The end-to-end test could not see WebSockets or the STUN server list.
- Three UI texts claimed more than the code did.

Accepted and documented in `docs/security.md`, not fixed:

- Retention depends on the clock and the sync state of each device (limit 6). A fix needs a trusted time source or a different delete model.
- The content security policy permits a WebSocket to any host, because the group sets the signaling server at run time.
- A signaling server can replay old "announce" messages and show false peers. This is in `y-webrtc`.
- The event page is not signed (limit 13).

### Reviews of pull request 2

The Codex review and two independent review agents (security and correctness) read pull request 2. Confirmed findings that are fixed, each with a test:

- "Erase all data" deleted the storage of the full web origin, which GitHub Pages shares between all project sites of a user.
- A backup of the alerts room wrote alerts to the device. A backup made with no room held the records of all local tools, and a restore could sync them into the wrong room.
- A delete and an edit of one record at the same time brought the deleted record back without its child records. A deleted record now leaves a marker.
- Spell check was on for the secret message field.
- About 1 in 340 generated passphrases was refused: one word of the generator list was in the list of common strings.
- An erase could lose a race with a room that was still opening.
- The service worker saved any page in its folder as the app page.
- Two "take" changes from two devices gave a negative stock.
- The unsaved work question did not cover the back button, and an invite link was read only at the first load.
- A browser that cannot list databases kept room databases after an erase.

Accepted and documented, not fixed:

- A browser can offer to save a passphrase. The limits page tells the person to say no.
- The signaling server and the STUN server see IP addresses.
