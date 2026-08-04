---
closed_iso: 2026-08-04T18:24:40Z
id: nid_ep8dz7rkoyydissrr5e8fvtyy_e
title: Add e2e test wire up
status: closed
deps: []
links: [nid_1s5ujs7nvq1ddrik8iuxnj730_e]
created_iso: '2026-08-04T18:01:44Z'
status_updated_iso: 2026-08-04T18:24:40Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib
---
GOAL: add e2e wire up with one simple test.

Look at /Users/nkondrat/vintrin-env/_cross_repo_comm/obsidian-id-lib-e2e-setup.md for information on how to add e2e test.

## Resolution — DONE

Playwright + CDP-attach to a REAL Obsidian (Electron), per the cross-repo note.
`npm run test:e2e` is zero-setup on Linux/Docker and passes headless:

```
setup-obsidian-bin: using cached binary (Obsidian 1.12.7).
run-e2e: no display detected — using headless Obsidian flags: --ozone-platform=headless --disable-gpu
  ✓  1 e2e/docId.e2e.ts:25:1 › WHEN ensureDocId runs on a note without frontmatter THEN the returned id is on disk
  1 passed
```

Verified real (not a vacuous pass): after the run the throwaway vault copy at
`.tmp/e2e/vault/plain.md` carries `id: docid_nj4pzgbpy7thuzfqrhtuyp5k_e`, i.e.
Obsidian booted and the library's `Vault.process` write landed on disk.

### What was added

- `scripts/setup-obsidian-bin.sh` — downloads + caches a PINNED Obsidian
  (`.tar.gz`, not AppImage — no FUSE in containers). `OBSIDIAN_VERSION` is
  overridable, which matters for a compat library: run against a consumer's
  `minAppVersion` floor on demand.
- `scripts/run-e2e.sh` — resolves the binary, auto-defaults headless Chromium
  flags when no display exists, type-checks, builds the host plugin, runs Playwright.
- `e2e/obsidianHarness.ts` — spawn with `--user-data-dir` sandbox +
  `--remote-debugging-port=0`, parse the DevTools ws endpoint off stderr,
  `chromium.connectOverCDP`, wait `workspace.layoutReady`, `setEnable(true)` +
  `enablePlugin`. Single seam for the undocumented `window.app` globals.
- `e2e/fixtures/host-plugin/` — test-only plugin importing `src/index` (working
  tree, not npm) and exposing `docIdService`; `build.mjs` bundles it with esbuild.
- `e2e/fixtures/vault/plain.md` — fixture; the vault is re-copied per run so the
  library's mutating writes never touch source control.
- `e2e/docId.e2e.ts`, `e2e/playwright.config.ts`, `e2e/tsconfig.json`.
- package.json: `test:e2e`, `check:e2e`, `setup:obsidian`; devDeps
  `@playwright/test@1.61.1` and `@types/node` (the e2e tsconfig needs it).
  e2e stays OUT of `npm test` — vitest gate stays fast; e2e is a release gate.
- README "e2e (real Obsidian)" section: commands + env knobs.

### Deliberately left out (scope was "one simple test")

- Canvas frontmatter + restart round-trip (`relaunch()`), the two highest-value
  real-app assertions → ticket `nid_1s5ujs7nvq1ddrik8iuxnj730_e`.
- Window-size seeding: dropped on purpose. It exists in the plugin repo only
  because headless Obsidian's tiny window makes real pointer clicks miss; this
  suite is API-only and never clicks.

### Called out

`npm run check` fails on a clean checkout for a PRE-EXISTING reason unrelated to
this work (`Array.prototype.at` vs `lib: ES2021`, both files from scaffold commit
a867be8). It also blocks `npm publish` via `prepublishOnly`. Not fixed here
because the fix is an owner call for a published library → ticket
`nid_avpmbw0w9cskk57061lcfaw3g_e` (tagged `decide`).

## Notes

**2026-08-04T18:32:22Z**

CORRECTION to "Deliberately left out": window sizing is NOT dropped. Owner wants
UI-clicking specs later, so the harness now supports real pointer clicks.

Findings while implementing it:
- The usual workaround (seeding `<userdata>/<vaultId>.json` with 1280x800) is
  VERIFIED INEFFECTIVE under `--ozone-platform=headless` — Obsidian ignores the
  seeded geometry and the renderer still reports 300x200. Do not re-add it.
- What works: `Emulation.setDeviceMetricsOverride` over a CDP session, applied
  after the vault window appears and BEFORE layoutReady (panes size off the
  observed viewport). Verified live: renderer reports 1280x800, and a real
  Playwright click on the "Open command palette" ribbon action opens the palette.
- Re-applied on every connect, so a future relaunch() gets it too.

Also added for the "new notes get ids" direction:
- `ObsidianHarness.createFile()` — creates through `vault.create` so the app owns
  the file (returns nothing; TFile's object graph is circular and cannot cross
  the CDP serialization boundary).
- `e2e/docId.e2e.ts`: note created inside the running app gets an id on disk.
- `e2e/harnessClickability.e2e.ts`: guards that clicks land, so a viewport
  regression fails loudly next to its cause instead of as a "flaky UI spec".

Suite: 3 passed.
