# BDD Testing Strategy

Internal doc. Drop into the repo and use it to update the agent instructions file (CLAUDE.md or equivalent) per the section at the end. Written to be host-agnostic: "host API" below means whatever platform the app runs against (Obsidian API, browser DOM, etc.).

## Goal

Scenarios are reviewed by a human. Implementations are written by agents. Agents may write and change feature files, but every change under `features/` is flagged by separate tooling (outside this document) for elevated human review, distinct from regular code review.

Everything here exists to make that boundary hold. Plain-text `.feature` files are the mechanism: a different file type in a different language that cannot compile or execute, so implementation detail cannot leak into them, and the human-reviewed surface stays small and readable.

## The tiers

Three tiers. Two BDD tiers split by directory, plus plain unit tests, which are a permanent tier, not legacy.

```
features/
  domain/*.feature      -> quickpickle + vitest
  e2e/*.feature         -> playwright-bdd
tests/
  domain/steps/         -> no host API imports, no playwright
  e2e/steps/            -> playwright fixtures, page objects
  unit/                 -> (or colocated *.test.ts) plain vitest, no Gherkin
```

**Domain tier** holds most scenarios: parsing, rendering rules, layout decisions, state transitions. Runs in Vitest in milliseconds, with a real watch loop, fake timers, and injected fakes.

**E2E tier** holds a deliberately small number of scenarios: the app loads in its real shell, entry points register, the wiring works. Not where behaviour lives. How the shell is launched is repo-specific and documented next to the e2e config.

**Unit tests** hold everything that is implementation detail. See the placement rules.

A scenario runs entirely in one runner, so the unit of tier choice is the feature file, and the directory is the mechanism. Tags remain for orthogonal, informational concerns only (`@slow`, `@flaky`) and never gate WHETHER a scenario executes — the single carve-out is the e2e viewport-routing pair, which gates only WHERE (see "Viewport routing"). There is no `@wip`: a scenario merges together with its step implementations or not at all.

## Placement rules

These are the two calls agents get wrong most often. Both are restated in the agent instructions file.

### Rule 1: BDD scenario vs unit test

A behaviour gets a Gherkin scenario when a non-implementor would care to read it. User-facing behaviour gets scenarios. Implementation detail gets unit tests.

- Scenarios are examples of behaviour, not exhaustive coverage. A few illustrative scenarios establish the rule; combinatorial edge cases, error paths, and boundary values go in plain unit tests against the domain functions the steps delegate to. Gherkin describes what the rule is; unit tests grind every input against it.
- Tiebreaker: if the test would change when you refactor without changing behaviour, it is a unit test. If it only changes when the product's behaviour changes, it is a scenario candidate.
- Scenario Outlines are for variants a user would recognise as distinct behaviours. If you are adding an Examples row that no user would recognise as a distinct behaviour, stop and write a unit test.
- Do not convert existing unit tests to Gherkin during migration. Unit tests are a permanent tier.

### Rule 2: domain vs e2e

If the scenario can be stated without mentioning the host UI, it goes in `domain/`. If it is about the app loading, registering its entry points, or interacting with the real shell, it goes in `e2e/`. Anything else signals that domain logic has not been pulled out of the host layer yet.

Everything verifiable in domain is verified in domain. A behaviour may additionally get an e2e scenario only when the journey is critical to the user experience, and the e2e version is the thinnest possible restatement (does the happy path work through the real shell), never a copy of the domain scenario's assertions.

**Multiple entry points to one behaviour**: the behaviour gets one intent-level domain scenario ("When the user pins the note"), never one per mechanism. Each binding of an entry point to that intent (button, shortcut, command palette) is wiring, and wiring is the e2e tier's job: one thin e2e scenario per entry point worth verifying, where naming the entry point is legitimate because the entry point is the behaviour under test ("When the user pins the note via the keyboard shortcut"). These assert only that the intent was triggered, never re-asserting the behaviour's consequences. A Scenario Outline with an Examples row per entry point is the natural shape and passes the Outline rule, since users recognise the entry points as distinct. Entry points that share their wiring path and differ only in host registration usually justify a single e2e scenario for the riskiest one, at the implementor's discretion.

This is the standard shape in the testing literature: the domain tier is subcutaneous testing (full behaviour verified just under the UI), and the e2e tier is the thin UI layer on top that verifies interface wiring and never business logic.

## Viewport routing (e2e tier)

The e2e tier runs every scenario on two browser projects — one mobile, one
desktop — by default. An untagged scenario runs on BOTH; the duplicated run of
viewport-agnostic scenarios is an accepted tax (the tier is deliberately thin,
and a developer iterating locally can target a single project).

A scenario whose behaviour genuinely exists on only one viewport carries
exactly ONE of `@mobile-only` / `@desktop-only`. Each project excludes the
OPPOSITE tag (the mobile project runs `not @desktop-only`, the desktop project
runs `not @mobile-only`), so tagging never adds a third run: untagged runs
twice, tagged runs once, and nothing needs a positive tag to run at all.

These are ROUTING tags, not exclusions — every scenario still executes on at
least one project, which is why they do not break the no-tag-exclusions rule
in substance. These consequences are enforced, not assumed:

- **Both tags on one scenario is forbidden** — it would run nowhere. Guarded by
  `src/features-audit/tag-audit.ts` (a `npm test` unit test reading the feature
  files) rather than by trusting review to spot it. It has to be STATIC: a
  scenario filtered out of both projects produces no failure at all, only an
  absence, so the e2e run itself can never report it.
- **The tag vocabulary is closed.** These two are the only tags permitted
  anywhere under `features/`; a new tag that selects or excludes scenarios is the
  bypass this document's Enforcement section exists to stop. The closure is not
  merely stylistic: playwright-bdd assigns its OWN meaning to `@skip`, `@fixme`,
  `@only`, `@fail`, `@slow`, `@retries:N`, `@timeout:N` and `@mode:` — a pasted
  `@skip` drops the scenario, and an `@only` drops every other one, both silently.
  The same audit rejects any other tag, and rejects a viewport tag under
  `features/domain/`.
- **The two tag strings are RESERVED WORDS — they may appear only on a tag line.**
  Playwright matches `grepInvert` against the test title, and playwright-bdd
  assembles that title from the Feature/Rule/Scenario name, the Examples name, the
  substituted Examples CELL values, or a `# title-format:` comment — so a scenario
  merely *named* after `@desktop-only` vanishes from the mobile project exactly as
  if it were tagged (verified, not theorised). The audit bans the text on ANY
  non-tag line rather than enumerating those title paths, because the list of
  paths is playwright-bdd's to grow; prose says "desktop only", without the `@`.
  The feature file's NAME is banned territory too: Playwright greps the joined
  titlePath, which begins with the spec file path bddgen derives from it.
- **One source for the two tag strings** — `features/viewport-tags.ts`, imported
  by `playwright.config.ts` (which builds its `grepInvert` from it) and by the
  audit. A tag renamed in only one of the two would otherwise leave the audit
  blessing a tag no project reacts to.
- **The CONFIG side is guarded by count reconciliation.** A custom reporter on the
  full `npm run test:e2e` (`e2e/scenario-count-reporter.ts`, pure logic in
  `features/scenario-count.ts`) compares the tests each project actually EXECUTED
  against the count derived from `features/e2e` on disk, and fails the run on a
  shortfall — catching what the static audit cannot see: a narrowed `features`
  glob, an added `grep`, a changed `testDir`, a project dropped, a scenario
  skipped at runtime. It parses with `@cucumber/gherkin`, playwright-bdd's own
  parser (declared in `devDependencies`, not borrowed from playwright-bdd's
  install layout), and reads the feature DIRECTORY rather than the
  config's glob — an expectation derived through the thing under test would prove
  nothing. It also reports a scenario that routes NOWHERE, which pure counts
  would balance to zero on both sides. Deliberate limits: it reconciles COUNTS,
  not identities (routing the wrong scenario to the wrong project balances); it
  reads the English Gherkin dialect only and REPORTS any other rather than
  miscounting it; and only `npm run test:e2e` enables it — an ad-hoc subset run
  (`npx playwright test --grep ...`, `npm run test:feature`) is meant to run
  less, and a check that cries wolf there gets ignored on the run that matters.
  Filters forwarded through the script (`npm run test:e2e -- --project X`) do
  still trip it, and are named in the failure message, because a self-narrowed
  run is not distinguishable from a config that dropped a project — which is
  precisely what must never pass. The one hole a runtime check cannot cover is
  its own arming (a run configured without the reporter has no reporter to
  complain), so the env var in `package.json` and the reporter line in the config
  are asserted statically in `npm test` alongside the tag audit.

Routing is for behaviour that differs by device — a nav that collapses on
phones, a flow that only exists on one form factor. It is never the fix for a
layout assertion that fails on one screen size: pixel measurements and wrap
thresholds are implementation detail under placement rule 1 and stay in the
unit/legacy tiers. Viewport is not a domain concept; the tags are meaningless
in `features/domain/` and banned there.

## Scenarios assert exactly what they say

A scenario must never be ambiguous with a fat implementation underneath. If "Then the heading is rendered correctly" secretly asserts fifteen things inside the step definition, the specification has moved into unsupervised implementation code and the human review of the feature file is worthless. A scenario asserts precisely what it says, no more. The extra assertions belong in unit tests against the delegated-to function.

Step definitions stay thin: parse arguments, delegate, assert. No behavioural branching in a step definition; if behaviour needs to branch, the scenario is wrong.

One behaviour per scenario: a scenario that verifies two rules is two scenarios. Scenarios are independent and order-agnostic; no scenario assumes another has run or relies on state it left behind. Independence is what makes parallel execution and the per-scenario state rule below work.

Then steps delegate to a named, exported domain function that *returns a value*, and the step asserts on that return value. The assertion never lives inside the delegated-to function: a function that asserts internally is a test helper that will accumulate checks over time, which is the fat-step problem one level down. Return-and-assert keeps the domain function production-shaped and reusable by the unit tier, and keeps the assertion visible in the step as exactly one line matching the scenario's claim.

Step implementations are trusted to agents; there is no human review of step files. The step assertion check under Follow-ups is a tripwire against this trust degrading, not a substitute for it.

### Scenario state

State shared between Given/When/Then within a scenario uses the runner's per-scenario mechanism: the world object in the domain tier (quickpickle), fixtures in the e2e tier (playwright-bdd). Module-level mutable state in step files is banned; it leaks between scenarios and breaks parallel execution. Design steps so scenarios can run in parallel from day one.

## Vocabulary

Step text is shared across tiers as a writing convention, not as code. The same phrasing may have two implementations in two registries; nothing is shared at runtime. The value is that feature files read consistently.

- Step text names intent, not mechanism (declarative style, in BDD terms). `When the user clicks #submit` is a test script in costume: which widget triggers a behaviour is implementation, and a widget-phrased step cannot even be implemented honestly in the headless domain tier. Write `When the user submits the form`. Litmus question for any step or scenario wording: would this need to change if the implementation changed but the behaviour didn't? If yes, rework it. Selectors and widget identifiers never appear in step text in any tier. In the e2e tier, shell-level concepts are fine when the shell is the behaviour under test (`Then the plugin's ribbon icon appears`).
- Matching stems: when a feature exists in both tiers, use the same file stem and the same `Feature:` title (`features/domain/graph-pinning.feature`, `features/e2e/graph-pinning.feature`). Reviewing the totality of a feature's scenarios is then `features/*/<stem>.feature`.

## Domain isolation via adapters

There is no hard ban on the host API in the codebase; e2e needs it and so does the production wiring. The rule is that *domain source* consumes narrow adapter interfaces (e.g. a metadata provider) rather than importing the host API directly. Host-backed implementations live outside the domain boundary; domain-tier tests inject fakes.

The ban includes type-only imports. `import type` is erased at runtime, but it couples domain signatures to the host's vocabulary and forces fakes to satisfy host types, which are typically wide classes that can only be faked through casts. Adapter interfaces are defined in domain-owned types (`{ path: string }`, not the host's file class); the adapter implementation translates at the boundary. Configure the import-boundary tooling to see type-only imports (for dependency-cruiser, `tsPreCompilationDeps: true`), or the rule is unenforced.

Mirror types are used by domain source, domain fakes, and unit tests. The e2e tier does not use them and does not fake the host: e2e exists to verify the real wiring, and a partially faked host in an e2e test is a slow domain test giving false confidence. Wanting a fake to make an e2e scenario testable is the signal that the behaviour belongs in the domain tier. The only things stubbed in e2e are sources of nondeterminism external to the app and its shell: third-party network calls, the clock.

## Coexistence and migration

Old-style unit and e2e suites stay where they are and keep running. Both old and new styles run in CI as separate targets for as long as migration takes.

- Migrate step by step. The repo is never required to migrate wholesale.
- It is OK to add tests in the old style when that is the pragmatic move for the task at hand.
- However: when old-style tests that capture *behaviour* are modified or added to, plan the migration. Default is to file a migration ticket for moving that behaviour into the appropriate BDD tier. The implementor agent may instead migrate inline at its discretion when the migration is genuinely small; the resulting `features/` changes go through the elevated review flagging like any other.
- When migrating a legacy e2e test, first ask whether it belongs in the domain tier; much legacy e2e is domain logic tested indirectly. Expect scenario counts to shrink.
- Delete the legacy test when its replacement is green. No per-test dual-maintenance period.

## Enforcement

- **Undefined steps fail CI.** Both runners can report an unmatched step as pending; configure both to hard-fail instead, otherwise an agent can pass by not implementing something.
- **Import boundaries in CI.** `tests/domain/steps/` and domain source must not import the host API or Playwright. Enforce with dependency-cruiser or eslint-plugin-boundaries, not by convention.
- **CI runs everything.** No tag exclusions, no scenario filtering in CI. Viewport ROUTING (above) is not an exclusion — every scenario still runs on at least one project, and the per-project count reconciliation proves it. The files that select what runs (runner configs, include globs, CI workflow) are part of the enforcement surface: narrowing them is the same bypass as editing generated specs, and changes to them warrant the same scrutiny as `features/` changes. The cheap backstop behind that scrutiny is in place for the e2e tier: the executed scenario count per project is reconciled against the count on disk (see "Viewport routing"), so narrowing one of those files fails the run instead of shrinking it.
- **Generated specs are not source.** playwright-bdd compiles `.feature` files into spec files before Playwright runs. The generated directory is gitignored and regenerated in CI; editing generated specs bypasses scenario review and is never acceptable.
- **Agent instructions.** The two placement rules and the vocabulary convention live in the agent instructions file.

Note: the tooling that flags `features/` changes for elevated review (the review boundary itself) is separate and out of scope here.

## Adoption checklist (per repo)

1. Module system (ESM/CJS) and transpile setup for both runner configs.
2. Is Vitest already the unit runner? quickpickle assumes it.
3. Vitest projects/workspace setup: the domain BDD tier and the unit tier both run in Vitest but need separate configs (setup files, environment, includes). Split them as Vitest projects so `vitest` in the unit watch loop does not pick up Gherkin specs and vice versa.
4. Playwright is presumed to already exist without BDD; playwright-bdd is additive on top of it. Reuse the existing `playwright.config`, fixtures, and page objects: register the generated spec directory as a new Playwright project alongside the legacy spec project. If the repo already has `.feature`-consuming BDD on the Playwright side, adopt it as the e2e tier as-is and only align layout, conventions, and enforcement.
5. Where do the legacy suites live, and what are their npm scripts? Keep new targets separate.
6. Does a domain boundary already exist in source, or does logic sit alongside host API calls? Add the dependency-cruiser rule banning host API imports from domain source *first* and see what breaks; that output is the real scope. If a large share of logic cannot run without the host API, this is a refactor with tests attached, and should be planned as one.
7. How is the app shell launched for e2e, and is that fixture worker- or test-scoped?
8. Wire playwright-bdd's codegen step into the test scripts; gitignore its output.
9. Locate or create the agent instructions file and add the placement rules.

## Decisions

Recorded so they are not relitigated:

- Plain `.feature` files over a typed/fluent scenario DSL. Boundary strength over type safety.
- Agents may write and change feature files. The review boundary is enforced by separate tooling that flags `features/` changes for elevated human review, not by banning agent edits.
- Step implementations are trusted to agents without human review. Then steps follow return-and-assert (delegate to an exported domain function returning a value, assert in the step); the step assertion check is a follow-up tripwire, not a gate.
- Directory split over tag split: quickpickle can select by tag but cannot exclude by tag, and directories tell a reviewer the tier before they read a line.
- No shared tier. A scenario runs in exactly one tier; critical journeys get a separate thin e2e scenario under a matching stem.
- Two runners accepted despite the config overhead (two configs, two watch modes, two reporters).
- quickpickle for the domain tier, with cucumber-js as the named fallback: it consumes the same `.feature` files and near-identical step signatures, so the exit is a config swap plus mechanical step-file edits. quickpickle is MIT and forkable if a quick fix is ever needed, but prefer the fallback over maintaining a fork long-term.
- No CODEOWNERS for now; features/ change flagging is deferred to separate tooling.
- No behavioural branching in step definitions; assertions beyond the scenario's literal text go in unit tests.
- No `@wip` and no tag exclusions in CI. Simplicity over the ability to merge scenarios ahead of implementation, which the agent workflow does not need.
- Amended 2026-08: the e2e viewport-routing pair `@mobile-only`/`@desktop-only` may gate WHERE a scenario runs (which viewport project), never WHETHER it runs. Chosen over a third tagged-only project (untagged scenarios would need repartitioning) and over keeping viewport-divergent behaviour out of Gherkin (would cap the SPEC-slimming direction). Guarded by the runs-somewhere count reconciliation; the tag vocabulary stays closed at these two.
- Host API ban in domain source includes type-only imports; adapter interfaces use domain-owned types. Isolation and cheap fakes over the convenience of reusing host types.
- Per-scenario state via the runner's mechanism (world object / fixtures); module-level mutable state banned in step files.
- For a pure library or CLI with no shell, an empty e2e tier is not a violation; it may instead become a smoke test of the published artifact.
- No host fakes in e2e; stub only external nondeterminism (third-party network, clock). Wanting a fake in e2e means the behaviour belongs in domain.
- One intent-level domain scenario per behaviour; one thin e2e scenario per entry-point binding worth verifying. Entry points may be named in e2e step text; selectors still may not.

## Follow-ups (out of scope for initial adoption)

- **Vocabulary drift check**: script pairs shared step phrases across tiers with their implementations; a cheap model flags pairs whose implementations no longer agree at the domain level; flags file migration-style tickets. Tripwire, not proof.
- **Step assertion check**: CI heuristic that a step definition asserts on the return value of a delegated-to function.
- **Mutation testing** on the domain tier.
- **features/ change flagging for elevated review** (the review-boundary tooling mentioned above).

## What goes into the agent instructions file

Keep the agent instructions short and point here for the rest. Include verbatim:

1. Placement rule 1 (BDD vs unit, with the refactor tiebreaker and the Outline rule).
2. Placement rule 2 (domain vs e2e, with the thin-e2e-duplicate rule).
3. Scenarios assert exactly what they say; step definitions are thin, never branch on behaviour, and Then steps delegate to an exported domain function and assert on its return value.
4. You may write and change files under `features/`; these changes receive elevated human review. Never edit generated spec output; undefined steps must be implemented, not left pending.
5. The migration policy: old-style additions are allowed, behaviour-test changes in old style require a migration ticket or a small inline migration at the implementor's discretion.
