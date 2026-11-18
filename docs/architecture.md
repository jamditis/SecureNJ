# Architecture

## Overview

The app is a static site: React 19, TypeScript, Vite, Tailwind 4. There is no backend. All state is in the browser.

```
index.tsx
  SyncProvider            services/sync.tsx   opens the documents, owns the network
    App                   App.tsx             navigation and the space dialog
      one tool            components/*.tsx    reads and writes records
```

## Layers

| Layer | Folder | Rule |
| --- | --- | --- |
| Tools | `components/` | One file for each tool. A tool has no network or storage code. It gets records from `useRecords` and text from `useT`. |
| Logic | `services/` | Pure functions and hooks, with tests next to the code. No JSX except in `sync.tsx`. |
| Text | `locales/` | All UI text. Components contain no user-visible text. |
| Registry | `tools.ts` | The list of tools. The navigation and the dashboard read it. |

## Data

Two Yjs documents are open at all times.

| Document | Database name | Syncs | Holds |
| --- | --- | --- | --- |
| Shared | `snj-local` with no space, or the room ID in a space | Only in a space | Alerts, confirmations, check-ins, proposals, positions, strokes, posts, claims, shared settings |
| Private | `snj-private` | Never | Phone tree contacts |

Each tool stores records in a named `Y.Map`. A record is a plain object with an `id`. A write replaces the full record, so the last writer wins for that record. Where two members can act on one item at the same time, each action is its own record:

- A position is stored with the key `proposalId:memberId`.
- A confirmation of an alert is stored with the key `sightingId:memberId`.
- The claim state of a mutual aid post is stored in the map `claims` with the post ID as the key. An edit of the post and a claim by a different member then merge.

Shared settings (retention times) are in the map `settings`. They must be shared: an expired record is deleted for the full group, so all members must use the same time. A tool must not write such a setting on each keystroke: use an explicit save.

### Housekeeping

`SyncProvider` runs housekeeping for the open documents every 30 seconds, for as long as the app is open (`startHousekeeping` in `services/sync.tsx`):

1. `purgeExpired` (`services/retention.ts`) deletes expired alerts and posts, and the confirmations, claims, and positions whose parent record is gone. Tools also hide expired records, so the screen does not depend on the time of the next run.
2. If the document changed, the browser database is rewritten to hold the current state only. The database is a log of changes. Without this step, the text of a deleted record stays in the log.

### Records from peers are not trusted

`services/schema.ts` has a type guard and a key function for each record type. `useRecords` drops a record that fails its guard, and a record whose map key is not the key that its content gives (delete and update use that key, so such a record could not be removed). One bad record from one peer cannot stop a tool for the group.

## Spaces and sync

`services/space.ts` derives two values from the space name and the passphrase:

1. A master key: PBKDF2-SHA-256, 600,000 iterations. The salt contains the normalized space name.
2. From the master key, with HKDF and two labels: the room ID (public) and the room password (secret).

`services/sync.tsx` opens a `WebrtcProvider` with these values. `y-webrtc` encrypts the signaling messages and the messages between browser tabs with a key from the room password. The WebRTC data channels are encrypted by WebRTC (DTLS).

Presence (who is online) uses the Yjs awareness protocol. It is not written to the document.

With no space, there is no `WebrtcProvider`. The app opens no network connection.

## Identity

Each browser makes a random member ID for each space on first use (`services/identity.ts`). It tells devices apart inside a space: one position for each member, no confirmation of your own report. It is not an account, and the IDs of one device in two spaces have no link. A member can set a display name. "Leave and delete" removes both.

### Leave a space

`leave` closes the WebRTC provider and the connection to the signaling server, tells the other tabs of the browser to leave (a `BroadcastChannel`), and, if the user asks, deletes the space database. If a space cannot open, the provider forgets it and goes back to local mode, so that the app does not fail at each start.

## Encryption of exports

`services/crypto.ts` has one cipher (AES-256-GCM) and one key derivation (PBKDF2-SHA-256, 600,000 iterations). The file header documents the byte formats. All version 2 passphrases go through `normalizePassphrase`. Version 1 text from the first release stays readable.

The event page (`services/eventExport.ts`) is one HTML file with the encrypted event and an inline script that decrypts it. That script must match the version 2 text format. A test opens the page in a DOM and decrypts it, and the end-to-end test opens the real file in a browser with no network.

## Text and languages

`locales/en.ts` holds all text. `MessageKey` is the type of its keys, so a missing key is a compile error. To add a language, add a file with the same keys and supply it through `I18nContext`.

## Build

`vite.config.ts` adds a content security policy to the production build. It allows scripts and styles from the app only, and network connections to the app host and to WebSocket servers. The Vite dev server needs inline scripts, so the policy is not in dev mode.

The app loads no font, script, or style from a different host.
