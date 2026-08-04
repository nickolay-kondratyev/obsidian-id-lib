---
id: nid_frudoe3d1o5bg56ze33cbm28z_e
title: "Reconcile executed e2e scenario count against features/e2e on disk"
status: open
deps: []
links: [nid_imvuuievshgdtn84dcwsps1eq_e]
created_iso: 2026-08-04T21:49:41Z
status_updated_iso: 2026-08-04T21:49:41Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [testing, bdd]
---

The BDD wire-up (nid_imvuuievshgdtn84dcwsps1eq_e) left one enforcement hole from `docs-internal/bdd-testing-strategy.md` ("Enforcement" / "Viewport routing"): nothing proves the e2e BDD tier actually EXECUTED the scenarios that exist on disk.

What is covered today: `tests/features/FeatureFileTagAudit.ts` (run by `npm test`) bans any tag under `features/` and pins the exact list of feature files, so a deleted/moved feature file or a pasted `@skip`/`@only` fails the build.

What is NOT covered: narrowing the selection in `e2e/playwright.config.ts` — the `features` glob passed to `defineBddConfig`, `featuresRoot`, a dropped `bdd` project, an added `grep` — shrinks the run SILENTLY and stays green. Same for a scenario skipped at runtime.

Proposed (per the strategy doc): a custom Playwright reporter enabled only on the full `npm run test:e2e`, comparing tests executed per project against the scenario count derived by parsing `features/e2e/` on disk with `@cucumber/gherkin` (declared as a direct devDependency, not borrowed from playwright-bdd) — reading the DIRECTORY, not the config glob, since an expectation derived through the thing under test proves nothing. Fail the run on a shortfall, and name forwarded filters (`npm run test:e2e -- --project X`) in the failure message.

Also assert statically (in `npm test`, next to the tag audit) that the reporter is actually wired into `e2e/playwright.config.ts`: a run configured without the reporter has no reporter to complain.

Current state of the deviation is recorded in README.md under "Known deviations".

