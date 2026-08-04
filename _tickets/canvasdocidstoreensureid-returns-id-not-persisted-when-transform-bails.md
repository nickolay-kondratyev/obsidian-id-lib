---
id: nid_37g3zp3ca1k9vxslfrw1i3u3g_e
title: "CanvasDocIdStore.ensureId returns id not persisted when transform bails"
status: open
deps: [nid_ep8dz7rkoyydissrr5e8fvtyy_e]
links: [nid_iyor6ne71sou9xiy0d4okfc5z_e]
created_iso: 2026-08-04T17:38:41Z
status_updated_iso: 2026-08-04T17:38:41Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [bug]
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
