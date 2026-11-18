# Lessons

Rules from corrections and from defects that got through. Read this file at the start of a session.

## 2026-11-18

- **No attribution.** The owner said: "no co-authored commits or copy anywhere". Do not add co-author trailers, session links, or "generated with" text to commits, pull requests, comments, or files.
- **A build that passes is not a working app.** The first release built with no error and produced a blank page, because `index.html` had no entry script. Rule: after a build, open the result in a browser. `npm run e2e` does this.
- **A hard-coded third-party endpoint is a silent failure.** Both signaling servers in the first release were gone, and the UI showed only "Offline". Rule: do not depend on a public service that the group does not control. Show the connection state to the user.
- **Check the shape of library events.** The first release read `webrtcPeers.size` on an array, so the peer count was always empty. Rule: read the type or the source of a library before you use an event payload, and do not type it as `any`.
- **A secure-context API can be missing.** `crypto.subtle` does not exist in a page that is not a secure context. The exported event page failed with no message. The end-to-end test found this, not the unit test. Rule: test an exported file in the same way that a user opens it, and show a message when a browser API is missing.
- **A test must fail without its fix.** Two tests were checked by removal of the fix. Rule 4 in `docs/testing.md`.
