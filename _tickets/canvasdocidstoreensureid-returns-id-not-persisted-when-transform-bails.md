---
closed_iso: 2026-08-06T17:29:05Z
id: nid_37g3zp3ca1k9vxslfrw1i3u3g_e
title: CanvasDocIdStore.ensureId returns id not persisted when transform bails
status: closed
deps: [nid_ep8dz7rkoyydissrr5e8fvtyy_e]
links: [nid_iyor6ne71sou9xiy0d4okfc5z_e]
created_iso: '2026-08-04T17:38:41Z'
status_updated_iso: 2026-08-06T17:29:05Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [bug]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib
---
In src/CanvasDocIdStore.ts ensureId(), the transform passed to fileContentAccess.process() correctly bails (returns content unchanged) when the canvas gained an id between the precheck cachedRead and the atomic write, or when the content became malformed mid-flight. BUT ensureId then returns newId unconditionally (src/CanvasDocIdStore.ts:47).

Verified repro: a foreign writer inserts docid_FOREIGN_e between the reads; the file persists docid_FOREIGN_e but the caller receives docid_NEWLY_GENERATED_e. Also returns newId instead of null when content turned malformed between reads.

This breaks the README "idempotency backstop" guarantee: the second writer bails on WRITE but reports the WRONG id, so consumers indexing by the returned id diverge from the vault.

Fix: mirror the WriteOutcome pattern already used in src/FrontmatterDocIdStore.ts — capture the id actually observed/written inside the transform closure and return that (existing id on bail, null on malformed, newId on write).

Start with a failing test (see src/CanvasDocIdStore.test.ts; src/testSupport/ContentSwappingFileContentAccess.ts exists for exactly this race simulation).

## Acceptance Criteria

- Failing test first: ensureId returns the FOREIGN id when content gains an id between precheck and process.
- e2e test is added if appropriate.
- ensureId returns null when content becomes malformed between precheck and process.
- All existing tests pass (npm test).

## Resolution (closed)

Fixed by mirroring the `WriteOutcome` pattern from `src/FrontmatterDocIdStore.ts`.

- Added a `WriteOutcome { content, id }` interface and a private
  `writeIdIntoContent(content, newId, path)` in `src/CanvasDocIdStore.ts` that
  re-parses inside the atomic transform and returns the id that actually
  persists: existing id on id-gained bail, `null` on malformed-mid-flight bail,
  `newId` on a real write.
- `ensureId()` now captures `resultId` from the outcome inside the
  `process()` closure and returns THAT, instead of unconditionally returning
  `newId`.

Tests added to `src/CanvasDocIdStore.test.ts` (both fail against the old
unconditional `return newId`):
- returns the concurrently-written FOREIGN id (not the generated one) when it
  bails on write.
- returns `null` when content turns malformed between precheck and atomic write.

No e2e added: the failure is a mid-`process()` race that only the
`ContentSwappingFileContentAccess` unit harness can deterministically reproduce;
a real-Obsidian e2e cannot inject content in that window.

`npm test` green (90 tests).
