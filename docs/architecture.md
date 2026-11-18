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
| Shared | `snj-local` with no space, or the room ID in a space | Only in a space | Alerts, check-ins, proposals, positions, strokes, posts, shared settings |
| Private | `snj-private` | Never | Phone tree contacts |

Each tool stores records in a named `Y.Map`. A record is a plain object with an `id`. A write replaces the full record, so the last writer wins for that record. Where two members can act on one item at the same time, each action is its own record:

- A position is stored with the key `proposalId:memberId`.
- A confirmation of an alert is stored with the key `sightingId:memberId`.

Shared settings (retention times) are in the map `settings`. They must be shared: an expired record is deleted for the full group, so all members must use the same time.

### Records from peers are not trusted

`services/schema.ts` has a type guard for each record type. `useRecords` drops a record that fails its guard. One bad record from one peer cannot stop a tool for the group.

## Spaces and sync

`services/space.ts` derives two values from the space name and the passphrase:

1. A master key: PBKDF2-SHA-256, 600,000 iterations. The salt contains the normalized space name.
2. From the master key, with HKDF and two labels: the room ID (public) and the room password (secret).

`services/sync.tsx` opens a `WebrtcProvider` with these values. `y-webrtc` encrypts the signaling messages and the messages between browser tabs with a key from the room password. The WebRTC data channels are encrypted by WebRTC (DTLS).

Presence (who is online) uses the Yjs awareness protocol. It is not written to the document.

With no space, there is no `WebrtcProvider`. The app opens no network connection.

## Identity

Each browser makes a random member ID on first use (`services/identity.ts`). It tells devices apart inside a space: one position for each member, no confirmation of your own report. It is not an account. A member can set a display name.

## Encryption of exports

`services/crypto.ts` has one cipher (AES-256-GCM) and one key derivation (PBKDF2-SHA-256, 600,000 iterations). The file header documents the byte formats. Version 1 text from the first release stays readable.

The event page (`services/eventExport.ts`) is one HTML file with the encrypted event and an inline script that decrypts it. That script must match the version 2 text format. A test opens the page in a DOM and decrypts it, and the end-to-end test opens the real file in a browser with no network.

## Text and languages

`locales/en.ts` holds all text. `MessageKey` is the type of its keys, so a missing key is a compile error. To add a language, add a file with the same keys and supply it through `I18nContext`.

## Build

`vite.config.ts` adds a content security policy to the production build. It allows scripts and styles from the app only, and network connections to the app host and to WebSocket servers. The Vite dev server needs inline scripts, so the policy is not in dev mode.

The app loads no font, script, or style from a different host.
