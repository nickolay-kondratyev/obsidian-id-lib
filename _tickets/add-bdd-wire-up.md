---
closed_iso: 2026-08-04T19:15:45Z
id: nid_imvuuievshgdtn84dcwsps1eq_e
title: Add BDD wire up
status: closed
deps: []
links: [nid_bpjraojplvcq3fvma8mezfswe_e, nid_p5rrzhcp0m9pg9gaq57mpcfn5_e, nid_frudoe3d1o5bg56ze33cbm28z_e]
created_iso: '2026-08-04T19:03:50Z'
status_updated_iso: 2026-08-04T19:15:45Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib
---
Look at `/Users/nkondrat/vintrin-env/_cross_repo_comm/bdd-ts.md` and add BDD wire up for this package.

Add a simple test for e2e BDD and domain bdd. 

Add a follow-up to which will state to create migration of pre-existing key tests into feature/scenario format.

## Resolution (2026-08-04) — DONE

Strategy doc copied into the repo as `docs-internal/bdd-testing-strategy.md`.

**Domain tier** — quickpickle + vitest:
- `features/domain/doc-id.feature` (3 scenarios: id minted, existing id honored, ineligible format gets none).
- Steps `tests/domain/steps/docId.steps.ts`, per-scenario state via a custom world `tests/domain/steps/DocIdWorld.ts` (fake vault + the library wired as `DocIdServices.createDefault` wires it).
- `vitest.config.ts` split into two projects: `unit` (`src/**/*.test.ts`) and `domain` (`features/domain/**/*.feature`). `npm test` runs both; `npm run test:domain` runs the tier alone.
- `tsconfig.json` include extended to `tests/**/*.ts` so the steps are type-checked.

**E2E tier** — playwright-bdd on the existing real-Obsidian harness:
- `features/e2e/doc-id.feature` (1 thin scenario, matching stem/Feature title).
- Steps `e2e/steps/docId.steps.ts`; harness + note state as playwright-bdd fixtures in `e2e/steps/obsidianFixtures.ts` (test-scoped, one Obsidian boot per scenario).
- `e2e/playwright.config.ts` now has two projects: `bdd` (generated specs) and `legacy` (`*.e2e.ts`). `scripts/run-e2e.sh` runs `bddgen` before Playwright; output goes to `.tmp/e2e-bdd/` (gitignored, never source).

**Enforcement done:** undefined steps hard-fail in BOTH runners (verified by probe in each); quickpickle's `todoTags`/`skipTags`/`failTags`/`softFailTags` emptied, so no tag can decide WHETHER a scenario runs. The e2e Then step was falsified (deliberately wrong expectation → red) to prove it is not vacuous.

**Agent instructions** (placement rules 1 & 2, thin steps / return-and-assert, features/ review boundary, migration policy) added to `README.md`, which `CLAUDE.md` points at.

**Verified:** `npm test` 72 passed (7 files, incl. 3 domain scenarios); `npm run test:e2e` 4 passed (1 bdd + 3 legacy).

**Deliberate deviations from the strategy doc** (80/20; recorded, not silent):
- Viewport-routing tags, the tag audit and the scenario-count reconciler are NOT implemented — they guard two browser projects, and this e2e tier drives one real Obsidian window.
- No dependency-cruiser boundary rule yet: domain source imports Obsidian types today (the public API is `TFile`-shaped by design). Ticket `nid_p5rrzhcp0m9pg9gaq57mpcfn5_e` (tagged `decide`).

**Follow-ups filed:**
- `nid_bpjraojplvcq3fvma8mezfswe_e` — migrate pre-existing key behaviour tests into feature/scenario format (the follow-up this ticket asked for).
- `nid_p5rrzhcp0m9pg9gaq57mpcfn5_e` — domain import boundary + dependency-cruiser.
- `nid_e7phu93lqo8nmwh330i9miws1_e` — PRE-EXISTING red `npm run check` (`Array.prototype.at` vs `lib: ES2021`), confirmed on a clean worktree of HEAD; blocks `npm publish`.

## Correction (2026-08-04, adversarial review)

The "Enforcement done" claim above about TAGS was **wrong** — corrected in follow-up commit. Two probes:

- Domain tier: `@skip` on a scenario still skipped it, run stayed GREEN. The emptied `todoTags`/`skipTags`/`failTags`/`softFailTags` had no effect at all: quickpickle merges options with lodash `defaultsDeep`, which merges arrays INDEX-WISE, so `[]` leaves every default tag in place.
- E2E tier: `@skip` made `bddgen` emit ZERO specs, exit 0, print nothing. Nothing in the wire-up guarded playwright-bdd's tags — the "tag audit not implemented" deviation was justified by viewport routing, but the audit's other job (closed tag vocabulary) is orthogonal to it and was silently dropped.

Fixed by `tests/features/FeatureFileTagAudit.ts` — a STATIC `npm test` check banning any tag under `features/`, covering both tiers; falsified against both. The ineffective quickpickle options block was removed rather than left lying, with the `defaultsDeep` trap recorded as a WHY-NOT in `vitest.config.ts`.

The undefined-step claim DID hold: re-verified by probe in the domain tier (`missingSteps: 'fail-on-gen'` covers the e2e side).

Also fixed: `setupFiles` named the one step file literally, so adding a feature meant editing `vitest.config.ts`. Now `tests/domain/steps/allSteps.ts` expands them via `import.meta.glob` (vitest does NOT glob `setupFiles` — verified).

Still not implemented, now recorded in README: no scenario-count reconciler, so narrowing a runner config's feature glob shrinks the run silently.
