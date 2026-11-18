# Architecture

## Overview

The app is a static site: React 19, TypeScript, Vite, Tailwind 4. There is no backend. All state is in the browser.

```
index.tsx
  SyncProvider            services/sync.tsx   opens the documents, owns the network
    App                   App.tsx             navigation, addresses, and the page
      RoomGate            components/RoomGate.tsx   the room of a shared tool
        one tool          components/*.tsx    reads and writes records
```

## Layers

| Layer | Folder | Rule |
| --- | --- | --- |
| Tools | `components/` | One file for each tool. A tool has no network or storage code. It gets records from `useRecords` and text from `useT`. |
| Logic | `services/` | Pure functions and hooks, with tests next to the code. No JSX except in `sync.tsx`. |
| Text | `locales/`, `content/` | All UI text and reference text. Components contain no user-visible text. |
| Registry | `tools.ts` | The list of tools. The navigation and the dashboard read it. |

## Data

Each shared tool has its own Yjs document. `ToolScope` (in `services/sync.tsx`) gives a tool its document through `SyncContext`, so a tool calls `useSync` and `useRecords` and does not know where its data comes from.

| Document | Database name | Syncs | Holds |
| --- | --- | --- | --- |
| Room of one tool | The room ID | Yes | The records of that tool |
| Room of safety alerts | None: memory only | Yes | Alerts and confirmations |
| Local | `snj-local` | Never | The records of each tool that the member uses with no room |
| Local, memory only | None | Never | Local safety alerts. Gone after a reload. |
| Private | `snj-private` | Never | Phone tree contacts |

Tools that are not in "Work as a group" keep data in component state only, or save a locked file. The resource sheet keeps an optional draft in `localStorage`.

Each tool stores records in a named `Y.Map`. A record is a plain object with an `id`. A write replaces the full record, so the last writer wins for that record. Where two members can act on one item at the same time, each action is its own record:

- A position is stored with the key `proposalId:memberId`.
- A confirmation of an alert is stored with the key `sightingId:memberId`.
- A sign-up for a shift is stored with the key `shiftId:memberId`.
- The claim state of a mutual aid post is stored in the map `claims` with the post ID as the key. An edit of the post and a claim by a different member then merge.
- The quantity of a supply item is the sum of adjustment records, not a field.

Shared settings (retention times) are in the map `settings` of the document of the tool. They must be shared: an expired record is deleted for the full group, so all members must use the same time. A tool must not write such a setting on each keystroke: use an explicit save.

The record types and guards of the first tools are in `types.ts` and `services/schema.ts`. A newer tool keeps its types and guards in its own service file (for example `services/shifts.ts`).

### Housekeeping

Each open document gets housekeeping every 30 seconds, for as long as it is open (`startHousekeeping` in `services/sync.tsx`):

1. `purgeExpired` (`services/retention.ts`) deletes expired alerts and posts, and the child records (confirmations, claims, positions, sign-ups, adjustments) whose parent record is gone. Tools also hide expired records, so the screen does not depend on the time of the next run.
2. If the document changed and has a database, the database is rewritten to hold the current state only. The database is a log of changes. Without this step, the text of a deleted record stays in the log.

### Records from peers are not trusted

`services/schema.ts` has a type guard and a key function for each record type. `useRecords` drops a record that fails its guard, and a record whose map key is not the key that its content gives (delete and update use that key, so such a record could not be removed). One bad record from one peer cannot stop a tool for the group.

## Rooms and sync

`RoomGate` (in `components/RoomGate.tsx`) is the door of each shared tool. A member types the group name and the passphrase, or uses the tool on the device only.

`services/space.ts` derives two values from the tool, the group name, and the passphrase:

1. A master key: PBKDF2-SHA-256, 600,000 iterations. The salt contains the tool and the normalized group name, so each tool has its own room.
2. From the master key, with HKDF and two labels: the room ID (public) and the room password (secret).

The passphrase goes to this derivation and is then dropped. Nothing stores the passphrase or the group name. The form of the next tool is filled with the group name and the servers from memory, and the member types the passphrase again.

`openSession` opens a `WebrtcProvider` with these values. `y-webrtc` encrypts the signaling messages and the messages between browser tabs with a key from the room password. The WebRTC data channels are encrypted by WebRTC (DTLS).

Presence (who is online) uses the Yjs awareness protocol. It is not written to the document.

A tool with no room has no `WebrtcProvider`. With no open room, the app opens no network connection.

## Identity

Each browser makes a random member ID for each room on first use (`services/identity.ts`). It tells devices apart inside a room: one position for each member, no confirmation of your own report. It is not an account, and the IDs of one device in two rooms have no link. The member ID of the alerts room is not saved: it is new at each visit. A member can set a display name.

### Leave a room, erase the device

`closeRoom` closes the WebRTC provider and the connection to the signaling server, and tells the other tabs of the browser to leave that room (a `BroadcastChannel`). "Clear from this browser" also deletes the database of the room and its member ID. "Erase all data" (`services/wipe.ts`) removes the stored values, the databases, the offline copy, and the service worker of this app, in all tabs. It removes only names that this app or the earlier published site own, because other sites on the same origin share the storage.

## Pages, sections, and addresses

`tools.ts` lists the pages (start page, limits, resources, share), the four sections, and the tools. The address holds the page (`#/phone-tree`), so a link to a page works. The addresses are the same as on the earlier published site. `#/secure-share/<locked text>` opens a locked message.

## Reference content

`content/` holds text that people rely on and that must not change by accident: the rights card, the family plan prompts, the starter entries of the resource sheet, the resource links, and the hotline number. Each file was generated by a script from the published site, and a test pins a checksum of it. The files hold the English text. `services/contentText.ts` gives a key to each sentence, so that the text has a translation in each language. Phone numbers, addresses of pages, and the names of organizations have no key and are the same in each language. The rights card can also show in English in each language, because English is the text that was checked against the source.

## Encryption of exports

`services/crypto.ts` has one cipher (AES-256-GCM) and one key derivation (PBKDF2-SHA-256, 600,000 iterations). The file header documents the byte formats. All new passphrases go through `normalizePassphrase` and `passphraseProblem`: the one encrypt function refuses a weak passphrase, so no tool can skip the rule. Text with no version prefix, from the published site or from the first release, stays readable.

A locked file (`services/lockedFile.ts`) and the event page are HTML files that decrypt themselves, built in the same way.

The event page (`services/eventExport.ts`) is one HTML file with the encrypted event and an inline script that decrypts it. That script must match the version 2 text format. A test opens the page in a DOM and decrypts it, and the end-to-end test opens the real file in a browser with no network.

## Text and languages

English is the source. `locales/en/` holds the UI text, one file for each area, and `content/` holds the reference text. `MessageKey` is the type of the English UI keys, so a wrong key in code is a compile error.

Each other language is one file, `locales/<code>.json`: a flat map from key to text, for UI keys and for the keys of the reference text. A machine writes these files: the agent that changes English text writes the translations in the same pull request. No person reviews them, and the language switch says so in each language but English.

Rules that the code enforces:

- A key with no translation shows in English. A missing translation does not break a build or a page.
- `translationProblem` in `services/messages.ts` checks each translated message when the app starts: the slots (`{name}`) must be the same as in English, and each number of the English text must be there in Western digits. An entry that fails shows in English. A test fails for each such entry, so the fault is visible.
- `locales/<code>.stamp.json` holds a short hash of the English text that each translation was made from. When the English text changes, the stamp no longer matches, and `npm test` fails until the translation is made again (`scripts/translate.ts` has the steps). This stops a translation that says what the English text no longer says.
- Arabic is right to left. `I18nProvider` sets `lang` and `dir` on the page. Components use layout classes that follow the direction (`ms-4`, not `ml-4`), and `components/direction.test.ts` fails on a class that names a physical side.

`I18nProvider` selects the saved language first, then the language of the browser, then English. To add a language: add it to `LOCALES` in `services/i18n.ts`, add `locales/<code>.json` with `{}`, and translate.

## Build

`vite.config.ts` adds a content security policy to the production build. It allows scripts and styles from the app only, and network connections to the app host and to WebSocket servers. The Vite dev server needs inline scripts, so the policy is not in dev mode.

The app loads no font, script, or style from a different host.
