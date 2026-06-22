# SecureNJ

A local resilience toolkit — a suite of clone-and-own tools for community organizers and mutual aid groups. It runs entirely in the browser with no central server: collaborators sync directly over WebRTC and data persists locally in the browser via IndexedDB.

## What's in it

- Dashboard — a single landing view across the tools below.
- Status board — track the state of people, places, or tasks during an event.
- Mutual aid — post and claim needs and offers.
- Phone tree — organize a call and contact chain for fast outreach.
- Consensus builder — run a simple group decision or vote.
- Event creator — set up and coordinate an event.
- Tactical whiteboard — a shared canvas for planning.
- Secure share — hand off a text payload through an encrypted, link-based exchange (see `services/crypto.ts`).
- Sightings — log reports from the field (uses the camera when you grant permission).

## How it works

- Offline-first: state is stored locally with `y-indexeddb`, so the app keeps working without a connection.
- Peer-to-peer sync: collaborators share state directly over `y-webrtc` (Yjs), with no central database.
- Clone and own: fork the repo, host the static build yourself, and the toolkit stays under your control.

## Tech stack

- React 19 and TypeScript, built with Vite
- Tailwind CSS for styling, lucide-react for icons
- Yjs (`y-webrtc`, `y-indexeddb`) for sync and local persistence
- Web Crypto for the secure-share payloads
- Some features call the Gemini API; provide a key only if you use them

## Run locally

Prerequisites: Node.js.

1. Install dependencies:
   ```bash
   npm install
   ```
2. For features that call Gemini, set `GEMINI_API_KEY` in `.env.local`:
   ```
   GEMINI_API_KEY=your-key-here
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

Build a static bundle with `npm run build`, then serve the `dist/` output from any static host.

## Status

Early-stage. The tools run in the browser today, but this is a clone-and-own starting point to adapt for a specific group. Review the code — especially `services/crypto.ts` — before relying on it for anything sensitive.
