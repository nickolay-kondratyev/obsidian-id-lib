---
closed_iso: 2026-08-07T17:59:03Z
id: nid_frudoe3d1o5bg56ze33cbm28z_e
title: Reconcile executed e2e scenario count against features/e2e on disk
status: closed
deps: []
links: [nid_imvuuievshgdtn84dcwsps1eq_e]
created_iso: '2026-08-04T21:49:41Z'
status_updated_iso: 2026-08-07T17:59:03Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [testing, bdd]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib-mirror-1
---
The BDD wire-up (nid_imvuuievshgdtn84dcwsps1eq_e) left one enforcement hole from `docs-internal/bdd-testing-strategy.md` ("Enforcement" / "Viewport routing"): nothing proves the e2e BDD tier actually EXECUTED the scenarios that exist on disk.

What is covered today: `tests/features/FeatureFileTagAudit.ts` (run by `npm test`) bans any tag under `features/` and pins the exact list of feature files, so a deleted/moved feature file or a pasted `@skip`/`@only` fails the build.

What is NOT covered: narrowing the selection in `e2e/playwright.config.ts` — the `features` glob passed to `defineBddConfig`, `featuresRoot`, a dropped `bdd` project, an added `grep` — shrinks the run SILENTLY and stays green. Same for a scenario skipped at runtime.

Proposed (per the strategy doc): a custom Playwright reporter enabled only on the full `npm run test:e2e`, comparing tests executed per project against the scenario count derived by parsing `features/e2e/` on disk with `@cucumber/gherkin` (declared as a direct devDependency, not borrowed from playwright-bdd) — reading the DIRECTORY, not the config glob, since an expectation derived through the thing under test proves nothing. Fail the run on a shortfall, and name forwarded filters (`npm run test:e2e -- --project X`) in the failure message.

Also assert statically (in `npm test`, next to the tag audit) that the reporter is actually wired into `e2e/playwright.config.ts`: a run configured without the reporter has no reporter to complain.

Current state of the deviation is recorded in README.md under "Known deviations".

## Resolution (closed 2026-08-07)

Implemented the scenario-count reconciler exactly as proposed.

- **`@cucumber/gherkin` + `@cucumber/messages`** added as direct, exact-pinned
  `devDependencies` (not borrowed from playwright-bdd's install layout).
- **`e2e/scenarioCount.ts`** — pure logic. Parses every `*.feature` under
  `features/e2e/` on disk (the DIRECTORY, resolved from the file's own location,
  never the config glob), counting one per `Scenario`, one per `Scenario
  Outline` Examples data-row, recursing into `Rule`s. Reads the English dialect
  only and THROWS `NonEnglishFeatureError` on any other rather than miscounting.
- **`e2e/scenarioCountReporter.ts`** — a Playwright reporter. Tallies the
  scenarios each BDD project actually EXECUTED (skips = did not execute) and,
  in `onEnd`, reconciles against the disk count; returns `{ status: 'failed' }`
  on any mismatch. Identifies a BDD project STRUCTURALLY (its `testDir` is the
  playwright-bdd generated dir, handed in via options), so a renamed/dropped
  project surfaces as "No BDD project ran". Names forwarded filters
  (`--project`, `--grep`, file paths) in the failure message.
- **Armed only on the full run**: `scripts/run-e2e.sh` exports
  `E2E_RECONCILE_SCENARIO_COUNT=1`; `e2e/playwright.config.ts` gates the reporter
  line on that env var. An ad-hoc `npx playwright test` subset run stays off.
- **Static arming assertion** (the hole a runtime check can't cover):
  `tests/features/E2eReporterWiring.ts` (+`.test.ts`), in `npm test` alongside
  the tag audit, asserts the env var is exported in the script and the reporter
  is gated+listed in the config.
- **Unit tests**: `tests/features/E2eScenarioCount.test.ts` covers plain
  scenarios, outline expansion, Rule nesting, Background, non-English refusal,
  and the real disk total (1).

Verified: `npm test` green (104 tests); full `npm run test:e2e` green (7 passed,
reconciler armed and silent); and a deliberately shrunk `bash scripts/run-e2e.sh
--project legacy` FAILS with exit 1, printing "No BDD project ran" and naming
the forwarded `--project legacy` filter.

Docs: the deviation note in `docs-internal/development.md` now records the
config-side hole as CLOSED (only the viewport-routing deviation remains).
