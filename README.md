# obsidian-id-lib

Shared doc-id read/ensure for Obsidian plugins: every eligible document gets a
persistent id — markdown notes (incl. `.excalidraw.md`) in the YAML
frontmatter `id` key, `.canvas` files at `metadata.frontmatter.id` in the
canvas JSON — with **cross-plugin write serialization**. Multiple plugins can
bundle this library and ensure ids on the same `file-open` event without
racing each other into duplicate/clobbered ids.

## Usage

One-line adoption:

```ts
import { DocIdServices } from 'obsidian-id-lib';

const docIdService = DocIdServices.createDefault(app.vault);
```

Typical wiring — ensure an id whenever a file gains focus:

```ts
import { Plugin } from 'obsidian';
import { DocIdServices } from 'obsidian-id-lib';

export default class MyPlugin extends Plugin {
  async onload() {
    const docIdService = DocIdServices.createDefault(this.app.vault);
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file !== null && docIdService.isEligible(file)) {
          void docIdService.ensureDocId(file);
        }
      }),
    );
  }
}
```

Custom wiring (DI form — every piece is behind an interface):

```ts
import {
  CanvasDocIdStore,
  CrossPluginPathLock,
  DocIdGeneratorDefault,
  DocIdServiceDefault,
  FrontmatterDocIdStore,
  VaultFileContentAccess,
} from 'obsidian-id-lib';

const files = new VaultFileContentAccess(app.vault); // or your own FileContentAccess
const generator = new DocIdGeneratorDefault();
const docIdService = new DocIdServiceDefault(
  new FrontmatterDocIdStore(files, generator),
  new CanvasDocIdStore(files, generator),
  new CrossPluginPathLock(), // REQUIRED — the cross-plugin lock is the point
);
```

API surface (`DocIdService`):

- `ensureDocId(file)` — lock-guarded read-or-create; the single entry point
  for id **creation**. Returns `null` for unsupported formats or unreadable
  content.
- `getDocId(file)` — READ-ONLY lookup; lock-free and never writes — safe for
  bulk read paths over every vault file.
- `isEligible(file)` — whether the file's format can carry a doc id
  (`md`, `canvas`; raw `.excalidraw` is deliberately unsupported — pure JSON
  with no agreed id location).

## Id format contract

<!-- ap_iZAE3fAcs5zXIWrTiIdx3_E -->

- Generated ids: `docid_{24 random base36 lowercase chars}_e`
  (e.g. `docid_a1b2c3d4e5f6g7h8i9j0k1l2_e`). 36^24 > 2^122 — collision space
  above UUID v4. Base36 lowercase keeps ids safe on case-insensitive
  filesystems.
- **Existing ids of ANY format are honored as-is** (e.g. ids minted by earlier
  tooling, such as uppercase `docid_{21 base62}_E`) — the file is never
  rewritten to "fix" an id.
- An **occupied but unusable id slot** (e.g. `id:` opening a nested mapping,
  or an object value in canvas JSON) is NEVER overwritten — `ensureDocId`
  returns `null`.
- Consumers that use ids as filenames should validate filename safety
  themselves (existing foreign-format ids pass through).

## Window-key compatibility contract (the cross-plugin lock)

<!-- ap_e7fWGWziwxrLmnegjIYKX_E -->

The library is bundled into each consuming plugin, so each plugin runs its
own copy. The ONLY shared state between copies is a lock registry on
`window`/`globalThis` — this is a public cross-plugin API:

- **Key**: `__obsidian_id_lib_path_lock_registry_v1__` (exported as
  `ID_LOCK_REGISTRY_KEY`). Bump the `_v1_` suffix ONLY as a deliberate
  breaking change.
- **Value shape**: a plain `Map<string, Promise<unknown>>` — file path →
  current tail promise. Plain promises only, so differently-versioned bundled
  copies interoperate.
- **Protocol** (what `CrossPluginPathLock` implements and any other
  implementation must follow):
  - Acquire by chaining off the path's current tail, **swallowing its
    rejection** (a foreign copy's failed task must not wedge you).
  - Store a tail that **never rejects** (foreign waiters may not swallow).
  - Release is implicit — the tail settles on success or throw. **No
    timeout/expiry.**
  - Only the CURRENT tail deletes its Map entry (`=== next` guard), so a
    predecessor's cleanup can't detach a queued successor.
- Locking is per file path: distinct files run in parallel; same-path
  `ensureDocId` calls serialize FIFO — across plugins.

## Guarantees

- **Idempotency backstop**: even if the lock is bypassed (a third plugin not
  using the lib), each store re-checks for an existing id INSIDE the atomic
  `Vault.process` transform — the second writer sees the id and bails.
  (Canvas caveat: see Known issues — the bail is correct on disk, but the
  returned id can be wrong.)
- **Byte-preserving writes**: frontmatter edits only add/fill the single id
  line via raw-text editing (deliberately NOT `FileManager.processFrontMatter`,
  which re-serializes the whole block and mangles formatting of keys the
  plugin does not own). CRLF preserved; canvas JSON written with Obsidian's
  tab indentation.
- **Malformed content never throws**: unparseable canvas JSON logs
  `console.error` and returns `null`. Empty/whitespace-only canvas content is
  a brand-new canvas (`{}`), not malformed — it gets an id.
- **Read paths never write.**

## Known issues

Open bugs tracked in `_tickets/` (not shipped in the npm package):

- **Canvas: `ensureDocId` can return an id that was not persisted.** When the
  canvas gains an id between the precheck read and the atomic write (lock
  bypassed by a third writer), the write correctly bails but the NEW (unwritten)
  id is returned instead of the persisted one. Ticket
  `nid_37g3zp3ca1k9vxslfrw1i3u3g_e`.
- **Frontmatter: degenerate `id` values mishandled.** `id: ""` / `id: ''`
  leads to a duplicate `id` key being inserted (invalid YAML); `id: # comment`
  is read back with the comment text as the id. Ticket
  `nid_iyor6ne71sou9xiy0d4okfc5z_e`.

## Consuming the library

Published to npm as a compiled package — a bundled ESM `dist/index.js` plus
`.d.ts` types:

```bash
npm install obsidian-id-lib
```

`obsidian` is a types-only **peer dependency** — never bundled into `dist`
(all its imports are type-only and elided at build time). Consumers already
have `obsidian` and mark it external in their plugin build, as every Obsidian
plugin does.

**Runtime floor:** shipped `dist/` is **ES2021** — syntax via esbuild
`--target=es2021`, built-ins via `lib: ES2021` in `tsconfig.build.json`, whose
include is exactly the published graph. ES2022 built-ins (`Array.prototype.at`,
`Object.hasOwn`, …) have an iOS 15.4 floor and esbuild does not down-level
them, so one reaching `dist/` fails `npm run build` rather than throwing on an
iOS 15.0–15.3 webview. The base `tsconfig.json` keeps `lib: ES2022` for the
test tiers, which run on desktop Node/Electron only.

## Dev

```bash
npm install
npm test          # vitest: BOTH the unit and domain-BDD projects
npm run test:domain  # just the domain BDD tier
npm run check     # tsc -noEmit (strict, whole src + tests incl. test files)
npm run test:all  # every gate, in release order: check + check:e2e + test + test:e2e
npm run build     # emit dist/: tsc .d.ts (tsconfig.build.json) + esbuild-bundled index.js
```

`test:all` is the single definition of "everything green" — the release script
runs exactly it, so there is no separate list of tiers to keep in sync. Adding a
tier means adding it here.

### Test tiers (BDD)

Three tiers. Full rationale in
[`docs-internal/bdd-testing-strategy.md`](docs-internal/bdd-testing-strategy.md);
what is in this repo:

```
features/domain/*.feature  -> quickpickle + vitest   (steps: tests/domain/steps/)
features/e2e/*.feature     -> playwright-bdd         (steps: e2e/steps/)
src/**/*.test.ts           -> plain vitest, no Gherkin — a PERMANENT tier
e2e/*.e2e.ts               -> legacy Playwright specs, migrating
```

Scenarios are reviewed by a human: every change under `features/` gets
elevated review. Everything below exists to make that boundary hold.

**Placement rule 1 — BDD scenario vs unit test.** A behaviour gets a Gherkin
scenario when a non-implementor would care to read it. User-facing behaviour
gets scenarios; implementation detail gets unit tests. Scenarios are examples
of behaviour, not exhaustive coverage — combinatorial edge cases, error paths,
and boundary values go in plain unit tests against the domain functions the
steps delegate to. Tiebreaker: if the test would change when you refactor
without changing behaviour, it is a unit test. If you are adding a Scenario
Outline Examples row that no user would recognise as a distinct behaviour,
stop and write a unit test.

**Placement rule 2 — domain vs e2e.** If the scenario can be stated without
mentioning Obsidian's UI, it goes in `features/domain/`. If it is about the
plugin loading, registering its entry points, or interacting with the real
app, it goes in `features/e2e/`. Everything verifiable in domain is verified
in domain; a behaviour gets an e2e scenario only when the journey is critical,
and the e2e version is the thinnest possible restatement — never a copy of the
domain scenario's assertions. Matching stems and `Feature:` titles across the
two tiers (`features/*/doc-id.feature`).

**Scenarios assert exactly what they say.** Step definitions stay thin —
parse, delegate, assert — and never branch on behaviour. Then steps delegate
to an exported domain function that RETURNS a value and assert on that return
value in one visible line; the assertion never lives inside the delegated-to
function. Per-scenario state uses the runner's mechanism (the quickpickle
world / playwright-bdd fixtures); module-level mutable state in step files is
banned.

**You may write and change files under `features/`** — those changes receive
elevated human review. Never edit generated spec output (`.tmp/e2e-bdd/`,
regenerated every run). Undefined steps must be implemented, not left pending:
both runners hard-fail on them.

**No tags under `features/`.** The tag vocabulary is closed and, in this repo,
empty. Both runners give tags the power to make a scenario vanish silently —
quickpickle's `@skip`/`@todo`/`@wip`/`@fails`/`@soft`, playwright-bdd's
`@skip`/`@fixme`/`@only` — and neither can be configured out of it. So a tag on
any line under `features/` fails `npm test`, via
`tests/features/FeatureFileTagAudit.ts`. The check is static because a removed
scenario produces no failure, only an absence, which no runner can report.

**Migration policy.** Old-style unit and e2e tests keep running and adding to
them is allowed. But when old-style tests that capture BEHAVIOUR are added or
modified, either migrate that behaviour into the right BDD tier inline (when
small) or file a migration ticket. Delete the legacy test once its replacement
is green — no dual maintenance.

Known deviations from the strategy doc, tracked in `_tickets/`: domain source
still imports Obsidian types directly (no adapter boundary, so no
dependency-cruiser rule yet); the e2e viewport-routing tags do not apply — the
e2e tier drives one real Obsidian window, not two browser projects; and there
is no scenario-count reconciler, so narrowing a runner config's feature glob
would shrink the run silently. The tag audit pins the exact set of feature
files, which catches a deleted or moved one but not a narrowed glob.

### e2e (real Obsidian)

`npm test` stays fast and hermetic; the e2e suite is a **release gate** that
drives a REAL Obsidian (Electron) under Playwright, on a throwaway copy of
`e2e/fixtures/vault`, with a test-only host plugin that wires the library
exactly as a consumer does.

```bash
npm run test:e2e                      # Linux/Docker: zero setup (downloads a pinned Obsidian once)
npm run test:e2e -- docId.e2e.ts      # extra args pass through to Playwright
npm run test:e2e -- --project bdd     # just the e2e BDD tier
npm run check:e2e                     # type-check the e2e/ tree only
```

It runs two Playwright projects: `bdd` (the `features/e2e/*.feature` tier,
compiled by playwright-bdd into `.tmp/e2e-bdd/` on every run) and `legacy`
(the pre-BDD `*.e2e.ts` specs). The BDD tier boots one real Obsidian per
scenario; the legacy specs share one per file.

Env knobs:

| Var | Purpose |
| --- | --- |
| `OBSIDIAN_PATH` | Path to an Obsidian binary. **Required on macOS/Windows** (no auto-download): `export OBSIDIAN_PATH='/Applications/Obsidian.app/Contents/MacOS/Obsidian'` |
| `OBSIDIAN_VERSION` | Which release to auto-download (default `1.12.7`). Use it to run against a consumer's `minAppVersion` floor or a newer release. |
| `OBSIDIAN_CACHE_DIR` | Where the downloaded binary is cached (default `~/.cache/obsidian-e2e`), shared across checkouts. |
| `OBSIDIAN_E2E_EXTRA_ARGS` | Extra Chromium flags. Auto-defaults to `--ozone-platform=headless --disable-gpu` when no display is detected. |

What belongs here: only what a fake vault **cannot** prove — Obsidian's own
behaviour (canvas serialization, `Vault.process` bytes, `metadataCache`,
restart round-trip). Everything else stays in the vitest suite; every case here
costs an Electron boot.

Specs can create notes in the running app (`harness.createFile`) and drive the
UI with **real pointer clicks** — the harness forces a 1280×800 layout viewport
via CDP, because headless Obsidian otherwise renders in a ~300×200 window where
clicks silently miss while DOM assertions still pass.
`e2e/harnessClickability.e2e.ts` guards exactly that.

## Releasing

```bash
export NPM_PUBLISH_TOKEN=...                 # npm automation token; .npmrc reads it
./release_to_npm_with_version_bump.sh        # patch bump; `minor` / `major` / `1.2.3` also accepted
```

It runs `npm run test:all` first, then bumps the version, commits, tags, pushes
the default branch, and publishes. Nothing is mutated until the suite is green.
Full runbook (first-time setup, verification, rollback):
[`docs-internal/how-to-publish-to-npm.md`](docs-internal/how-to-publish-to-npm.md).
`prepack` builds `dist/` and `prepublishOnly` runs `check` + tests, so even a
bare `npm publish` ships a fresh, type-checked, tested build.

Follow-up: add ESLint to this repo (the code arrived lint-clean from the
visit-history plugin's obsidianmd ESLint setup).

## License

[MIT](LICENSE.md)
