---
id: nid_p5rrzhcp0m9pg9gaq57mpcfn5_e
title: "Enforce domain import boundary (adapter types instead of Obsidian types)"
status: open
deps: []
links: [nid_imvuuievshgdtn84dcwsps1eq_e, nid_bpjraojplvcq3fvma8mezfswe_e]
created_iso: 2026-08-04T19:14:23Z
status_updated_iso: 2026-08-04T19:14:23Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: [testing, bdd, decide]
---

The BDD strategy (`docs-internal/bdd-testing-strategy.md`, "Domain isolation via adapters" + "Enforcement") requires that DOMAIN source consume narrow adapter interfaces with domain-owned types, never the host API — including type-only imports — and that the boundary be enforced in CI (dependency-cruiser with `tsPreCompilationDeps: true`, or eslint-plugin-boundaries).

Current state after the wire-up (ticket nid_imvuuievshgdtn84dcwsps1eq_e): `src/DocIdService.ts`, `src/DocIdStore.ts`, `src/FileContentAccess.ts`, `src/CanvasDocIdStore.ts`, `src/FrontmatterDocIdStore.ts` and `src/testSupport/*` all `import { TFile } from 'obsidian'`, and `src/DocIdServices.ts` imports `Vault`. So do the domain step definitions in `tests/domain/steps/`. Adding the rule today would flag essentially the whole library.

DECISION NEEDED from the human before implementing: this library's PUBLIC API is TFile-shaped (`ensureDocId(file: TFile)`), which is deliberate — consumers hand over the app's own TFile. Options:
  a) Keep TFile in the public API but define a domain-owned `DocFile = { path: string; extension: string }` internally, translate at the boundary, and point the boundary rule at the internals only.
  b) Narrow the public API to the structural type as well (breaking-ish for typing, still accepts a TFile structurally).
  c) Accept the deviation for this repo and record it, since `obsidian` here is a TYPES-ONLY peer dependency that is erased at build time — the practical harm the rule prevents (wide host classes that can only be faked through casts) is already avoided by `src/testSupport/obsidianMock.ts`.

Whichever is chosen, then: add dependency-cruiser with `tsPreCompilationDeps: true`, a rule banning `obsidian` imports from domain source and from `tests/domain/steps/`, and wire it into `npm test` / CI.

