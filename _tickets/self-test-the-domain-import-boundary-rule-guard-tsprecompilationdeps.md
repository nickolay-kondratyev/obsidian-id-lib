---
closed_iso: 2026-08-07T18:06:37Z
id: nid_zpzbyg7nxdjjbw5k5ytjixatr_e
title: Self-test the domain import-boundary rule (guard tsPreCompilationDeps)
status: closed
deps: []
links: [nid_p5rrzhcp0m9pg9gaq57mpcfn5_e]
created_iso: '2026-08-05T02:19:13Z'
status_updated_iso: 2026-08-07T18:06:37Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: [testing, bdd]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib
---
The domain import boundary is enforced by `/.dependency-cruiser.cjs` (script `check:boundaries`, run inside `npm test`).

Its teeth depend entirely on `options.tsPreCompilationDeps: true`: with that flag off, `import type { TFile } from 'obsidian'` in domain source becomes INVISIBLE to dependency-cruiser and the rule passes vacuously — exactly the imports the strategy doc (`docs-internal/bdd-testing-strategy.md`, "Domain isolation via adapters") says matter most. Same failure mode if `forbidden[].to.path` stops matching (the `obsidian` package is types-only, so dependency-cruiser reports the BARE module name `obsidian` rather than a `node_modules/...` path — a fragile detail).

Today this is only verified by hand. It was verified manually at implementation time (ticket nid_p5rrzhcp0m9pg9gaq57mpcfn5_e): adding `import type { TFile } from 'obsidian'` to `src/DocIdStore.ts` produced `error domain-no-obsidian`, and removing it went green again.

WANTED: an automated tripwire, in the spirit of `tests/features/FeatureFileTagAudit.ts` — a vitest that proves a TYPE-ONLY host import in domain-shaped source is actually flagged, not merely that the config file contains a flag (config-shape assertions duplicate knowledge and rot).

Design note / the hard part: a fixture that genuinely violates the rule cannot simply live under `src/` or `tests/domain/` — the real `depcruise src tests` run would flag it and turn `npm test` permanently red. Options to weigh: a fixture directory added to `options.exclude` and cruised separately by the test via dependency-cruiser's programmatic API; or cruising a fixture outside those roots with the real rule set re-pointed at it. Prefer whichever keeps the RULE under test rather than a copy of it.

---

## Resolution (2026-08-07)

Added an automated tripwire — runs inside `npm test` (the `unit` vitest project):

- `tests/boundaries/DomainImportBoundaryProbe.ts` — a harness that `require`s the
  SHIPPED `.dependency-cruiser.cjs` (its real `forbidden` rules **and** its real
  `options`, `tsPreCompilationDeps` included), writes a throwaway `src/DomainProbe.ts`
  fixture under gitignored `.tmp/`, and cruises it via dependency-cruiser's
  programmatic `cruise()` API. Two invocation details, both mirroring what the
  `depcruise` CLI itself adds, are the crux: `validate: true` (turns rule checking
  on) and `baseDir: <fixtureRoot>` (remaps the fixture's reported path back to
  `src/DomainProbe.ts` so the real rule's `from: ^(src|tests/domain)/` matches). This
  keeps the fixture invisible to the everyday `depcruise src tests` run — it never
  scans `.tmp/` — so that stays green, while the RULE (not a copy) is under test.
- `tests/boundaries/DomainImportBoundaryProbe.test.ts` — asserts a TYPE-ONLY
  `import type { TFile } from 'obsidian'` in domain-shaped source produces exactly
  one `domain-no-obsidian` violation, plus a negative control (host-free source →
  no violation) proving the harness reports absence too, not always-red.

Chose the programmatic-`cruise` route over touching `options.exclude`: no coupling
of the shipped config to the test, and the fixture is created/destroyed per run.

WHY-NOT feed cruise the parsed tsconfig (the CLI does): a self-contained `import type`
fixture is already seen by `tsPreCompilationDeps` under the TS compiler's defaults, and
`extract-ts-config` is a package subpath this repo's `moduleResolution: node` can't
type-check. The load-bearing flag still rides in via `...options`.

Mutation-verified end-to-end through the real config: flipping
`tsPreCompilationDeps` to `false`, and narrowing `forbidden[].to.path` so it no
longer matches the bare `obsidian` module name, EACH turns the test red (negative
control stays green); reverting goes green. `npm run check` (tsc) and `npm test`
both pass.
