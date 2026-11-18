# Testing

## Commands

| Command | What it does |
| --- | --- |
| `npm run typecheck` | TypeScript in strict mode |
| `npm run lint` | ESLint, with the React hooks rules |
| `npm test` | Unit and component tests (Vitest) |
| `npm run build` | Production build |
| `npm run e2e` | End-to-end test in Chromium. Run the build first. |
| `npm run check` | All of the above, in sequence |

CI runs the same steps on each pull request (`.github/workflows/ci.yml`).

## Where tests go

| Kind | File | Environment |
| --- | --- | --- |
| Logic | `services/<name>.test.ts`, next to the code | Node |
| Tools | `components/tools.test.tsx` | jsdom, with documents in memory (`components/test-utils.tsx`) |
| Full app | `e2e/smoke.mjs` | Chromium, the production build, a local signaling server |

## Rules

1. **A bug fix starts with a test that fails.** Write the test, see it fail, then fix the code.
2. **Logic goes in `services/` as pure functions**, so that a test does not need a browser.
3. **A test name states the behavior**, not the function name. Example: "keeps a claim that a different member makes during an edit".
4. **A test must be able to fail.** After you write a test for a fix, remove the fix one time and confirm that the test fails.
5. **Security claims need a test.** If the UI or the docs say "X is not sent" or "X cannot be read", a test must show it. The end-to-end test fails on a request to a different host, on a browser error, and when a wrong passphrase shows data.
6. **Component tests use real Yjs documents**, not mocks. Use `createTestSync()` and assert on the document.

## What the end-to-end test proves

1. Local mode saves data and keeps it after a reload.
2. Two browser profiles in one space sync over WebRTC through the signaling server.
3. Local data does not go into a space.
4. A confirmation from one member reaches the other member.
5. A wrong passphrase gives a different, empty space.
6. The exported event page opens from disk with no network and decrypts.
7. The page makes no request to a different host and reports no error. This includes a violation of the content security policy.

## Review checklist

Use this list before you ask for a review, and when you review.

- [ ] `npm run check` passes.
- [ ] Each changed behavior has a test. Each bug fix has a test that failed before the fix.
- [ ] No user-visible text in components. New text is in `locales/en.ts`, in sentence case.
- [ ] A new record type has a guard in `services/schema.ts`, and the tool reads it through `useRecords`.
- [ ] A write does not overwrite a field that a different member can change at the same time. If it can, use one record for each member and action.
- [ ] No setting that deletes shared data is local to one device.
- [ ] No new request to a different host. No new dependency without a reason in the pull request.
- [ ] Each security claim in the UI and the docs is true. `docs/security.md` is updated if a limit changed.
- [ ] Controls have an accessible name. A new dialog closes with Escape.
- [ ] `CLAUDE.md` and `docs/` are updated if a file was added, moved, or removed.
- [ ] The commit message says why, not what.
