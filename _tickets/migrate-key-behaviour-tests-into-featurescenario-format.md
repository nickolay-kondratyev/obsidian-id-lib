---
id: nid_bpjraojplvcq3fvma8mezfswe_e
title: "Migrate key behaviour tests into feature/scenario format"
status: open
deps: []
links: [nid_imvuuievshgdtn84dcwsps1eq_e, nid_p5rrzhcp0m9pg9gaq57mpcfn5_e]
created_iso: 2026-08-04T19:14:09Z
status_updated_iso: 2026-08-04T19:14:09Z
type: task
priority: 2
assignee: nickolaykondratyev
tags: [testing, bdd]
---

The BDD wire-up landed (ticket nid_imvuuievshgdtn84dcwsps1eq_e): `features/domain/*.feature` runs under quickpickle+vitest with steps in `tests/domain/steps/`, `features/e2e/*.feature` runs under playwright-bdd with steps in `e2e/steps/`. Only ONE feature stem exists so far (`doc-id`), as a wire-up proof.

This ticket is the MIGRATION of the pre-existing tests that capture user-visible behaviour into feature/scenario format.

Candidates (repo-relative):
- `src/DocIdService.test.ts` — dispatch by extension, eligibility. Mostly behaviour.
- `src/FrontmatterDocIdStore.test.ts` — id honoured as-is, unusable slot never overwritten, byte-preserving writes. Behaviour + a lot of implementation detail.
- `src/CanvasDocIdStore.test.ts` — same shape for canvas JSON.
- `src/CrossPluginPathLock.test.ts` + `src/DocIdServices.lock.test.ts` — the cross-plugin serialization contract. Behaviour a reader cares about, but expressed in promises/ordering; judge carefully.
- `e2e/docId.e2e.ts` — legacy e2e; ask FIRST whether each case belongs in the domain tier instead (expect the scenario count to SHRINK).

Rules that govern this work (verbatim in README.md, full rationale in `docs-internal/bdd-testing-strategy.md`):
- Placement rule 1: only behaviour a non-implementor would care to read becomes a scenario. Combinatorial cases, error paths and boundary values STAY as plain vitest unit tests — the unit tier is permanent, do NOT convert it wholesale.
- Placement rule 2: domain unless it is about the plugin loading / the real Obsidian shell.
- Then steps delegate to an exported function returning a value and assert on it in one line.
- Delete the legacy test only once its replacement is green; no dual maintenance.
- Changes under `features/` get elevated human review — keep the diff readable and small.

Do it incrementally: one stem at a time, `npm test` and `npm run test:e2e` green after each.

