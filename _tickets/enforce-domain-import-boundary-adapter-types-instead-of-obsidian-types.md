---
closed_iso: 2026-08-05T02:21:10Z
id: nid_p5rrzhcp0m9pg9gaq57mpcfn5_e
title: Enforce domain import boundary (adapter types instead of Obsidian types)
status: closed
deps: []
links: [nid_imvuuievshgdtn84dcwsps1eq_e, nid_bpjraojplvcq3fvma8mezfswe_e, nid_zpzbyg7nxdjjbw5k5ytjixatr_e]
created_iso: '2026-08-04T19:14:23Z'
status_updated_iso: 2026-08-05T02:21:10Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: [testing, bdd]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib
---
The BDD strategy (`docs-internal/bdd-testing-strategy.md`, "Domain isolation via adapters" + "Enforcement") requires that DOMAIN source consume narrow adapter interfaces with domain-owned types, never the host API — including type-only imports — and that the boundary be enforced in CI (dependency-cruiser with `tsPreCompilationDeps: true`, or eslint-plugin-boundaries).

Current state after the wire-up (ticket nid_imvuuievshgdtn84dcwsps1eq_e): `src/DocIdService.ts`, `src/DocIdStore.ts`, `src/FileContentAccess.ts`, `src/CanvasDocIdStore.ts`, `src/FrontmatterDocIdStore.ts` and `src/testSupport/*` all `import { TFile } from 'obsidian'`, and `src/DocIdServices.ts` imports `Vault`. So do the domain step definitions in `tests/domain/steps/`. Adding the rule today would flag essentially the whole library.

DECISION NEEDED from the human before implementing: this library's PUBLIC API is TFile-shaped (`ensureDocId(file: TFile)`), which is deliberate — consumers hand over the app's own TFile. Options:
  b) Narrow the public API to the structural type as well (breaking-ish for typing, still accepts a TFile structurally). - HUMAN: lets go with narrowing the API and add into /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib/docs instructions on how to adjust to new type for previous consumers.


Whichever is chosen, then: add dependency-cruiser with `tsPreCompilationDeps: true`, a rule banning `obsidian` imports from domain source and from `tests/domain/steps/`, and wire it into `npm test` / CI.


---

## Resolution (2026-08-05, commit 085c442)

Implemented option (b): the public API was narrowed to a domain-owned structural type.

### The domain type

`src/DocFile.ts` — `{ readonly path: string; readonly extension: string }`, the ONLY two facts
the doc-id logic needs. Obsidian's `TFile` satisfies it structurally, so consumers keep passing
`app.vault`'s own files with no cast and no runtime change. Exported from `src/index.ts`.

Every domain signature now takes `DocFile`: `DocIdService`, `DocIdStore`, `FileContentAccess`,
`FrontmatterDocIdStore`, `CanvasDocIdStore`.

### The adapter boundary

`src/obsidian/` is the single sanctioned host-API bridgehead. Moved/added there:

- `src/obsidian/VaultFileContentAccess.ts` (was in `src/FileContentAccess.ts`). It now resolves
  `DocFile -> TFile` via `Vault.getFileByPath(path)` instead of assuming the argument IS a TFile
  — a cast would be a lie now that the parameter is structural. Raises the effective Obsidian
  floor to 1.5.7 and turns "not a vault file" into `File not found: <path>` here rather than deep
  inside Obsidian. Covered by the new `src/obsidian/VaultFileContentAccess.test.ts`.
- `src/obsidian/DocIdServices.ts` (moved; it takes a `Vault`).

`src/DocIdServices.lock.test.ts` was renamed to `src/DocIdServiceLock.test.ts` — it tests
`DocIdServiceDefault` + `CrossPluginPathLock`, not the moved factory.

### Enforcement

`.dependency-cruiser.cjs` with `tsPreCompilationDeps: true` (so `import type` is VISIBLE — without
it the rule would pass vacuously on exactly the imports that matter). Two error rules from
`^(src|tests/domain)/` minus `^src/obsidian/`: no `obsidian`, no Playwright. `e2e/` and `dist/`
excluded. Note: the `obsidian` package is types-only, so dependency-cruiser reports the BARE module
name, hence `to.path: '^obsidian$|node_modules/obsidian/'`.

Wired as `npm run check:boundaries`, run first inside `npm test` (and therefore in `prepublishOnly`).
There is no CI workflow file in this repo — `npm test` IS the gate.

Verified RED before the refactor (11 violations, incl. the `import type` in
`tests/domain/steps/DocIdWorld.ts`) and RED again afterwards when a type-only `obsidian` import was
temporarily re-added to `src/DocIdStore.ts`; green otherwise.

### Fallout

- Fakes are plain objects now (`makeTFile` -> `makeDocFile`), so NOTHING imports `obsidian` at
  runtime in the vitest tiers. `src/testSupport/obsidianMock.ts` and its `vitest.config.ts` alias
  were deleted as dead weight (WHY-NOT comment left in the config).
- `docs/migrating-to-docfile.md`: consumer upgrade guide (the human-requested deliverable) —
  covers "you probably change nothing", the custom-`FileContentAccess` case, the `getFileByPath`
  behaviour change, and the 1.5.7 floor.
- README: new domain-import-boundary paragraph replacing the "no adapter boundary yet" known
  deviation; `DocFile` note under the API surface; `check:boundaries` in the Dev section.
- Version NOT bumped — `docs-internal/how-to-publish-to-npm.md` owns that via `npm version` at
  release time. The next release is a breaking typing change for anyone implementing
  `FileContentAccess`.

### Verified

`npm run check`, `npm run check:boundaries`, `npm test` (81 unit + domain BDD), `npm run build`,
and `npm run test:e2e` against a REAL Obsidian 1.12.7 (4/4 passed) — the last one confirms the
`getFileByPath` resolution works on the production path, not just against fakes.

### Follow-up

`nid_zpzbyg7nxdjjbw5k5ytjixatr_e` — self-test the boundary rule so `tsPreCompilationDeps` cannot be
switched off silently. Only manually verified today.
