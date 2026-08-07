---
id: nid_zpzbyg7nxdjjbw5k5ytjixatr_e
title: Self-test the domain import-boundary rule (guard tsPreCompilationDeps)
status: in_progress
deps: []
links: [nid_p5rrzhcp0m9pg9gaq57mpcfn5_e]
created_iso: '2026-08-05T02:19:13Z'
status_updated_iso: '2026-08-07T17:42:46Z'
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
