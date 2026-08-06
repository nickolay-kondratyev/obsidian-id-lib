---
closed_iso: 2026-08-06T20:14:22Z
id: nid_1s5ujs7nvq1ddrik8iuxnj730_e
title: 'e2e: cover canvas frontmatter + restart round-trip'
status: closed
deps: []
links: [nid_ep8dz7rkoyydissrr5e8fvtyy_e]
created_iso: '2026-08-04T18:23:59Z'
status_updated_iso: 2026-08-06T20:14:22Z
type: task
priority: 2
assignee: nickolaykondratyev
tags: [e2e]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib
---
The e2e wire-up landed (ticket nid_ep8dz7rkoyydissrr5e8fvtyy_e) with ONE smoke spec:
`e2e/docId.e2e.ts` asserts ensureDocId writes an id to `plain.md` on disk.

The two HIGHEST-value real-Obsidian assertions are still missing (a fake vault
cannot prove either):

1. **Canvas `metadata.frontmatter.id`** — the library stores canvas ids at a
   location that was never introduced by an Obsidian core release; it relies on
   the canvas format's arbitrary-key forward compatibility. It can silently
   break in ANY Obsidian version and only a real app catches it. Add a
   `.canvas` fixture under `e2e/fixtures/vault/` and assert an id survives an
   ensureDocId write AND a round-trip through core canvas.
2. **Restart round-trip** — prove an id written in one session is read back off
   DISK in the next, not out of an in-memory cache. Needs an
   `ObsidianHarness.relaunch()` (close + spawnAndConnect against the SAME vault
   copy, deliberately WITHOUT re-seeding it); `e2e/obsidianHarness.ts` is
   structured for this but the method was left out as YAGNI.

Also worth adding once the above are in: `getDocId` on an id-less note returns
null AND mints nothing (read paths never write).

Keep the suite small — every case costs an Electron boot. See
/Users/nkondrat/vintrin-env/_cross_repo_comm/obsidian-id-lib-e2e-setup.md §7
for the scope rule.

---

## Resolution (2026-08-06) — DONE, verified green

All three assertions landed in ONE new spec file that shares a SINGLE Electron
boot (`e2e/docIdGuarantees.e2e.ts`), keeping the suite within the §7 budget.
`npm run test:all` is green (90 vitest + 7 e2e).

**1. Canvas `metadata.frontmatter.id` + core-canvas round-trip.**
- Fixture: `e2e/fixtures/vault/diagram.canvas` (one text node, no id).
- Test asserts `ensureDocId` writes the id at `metadata.frontmatter.id` on disk,
  then drives Obsidian's OWN core canvas editor and asserts the id survives.
- New harness method `ObsidianHarness.roundTripCanvasThroughCore(path)`: opens
  the canvas in the core `canvas` view, makes a genuine model edit (nudges a
  node via `node.moveTo`), calls `canvas.requestSave()`, and waits
  DETERMINISTICALLY (not a fixed sleep) until core's own `view.lastSavedData`
  changes — i.e. the debounced write actually flushed. Probed against Obsidian
  1.12.7: core's `getData()` preserves the arbitrary `metadata` key by spreading
  the originally-loaded object, so the id round-trips.

**2. Restart round-trip.**
- New `ObsidianHarness.relaunch()`: `close()` + `spawnAndConnect()` against the
  SAME vault copy, deliberately WITHOUT `prepareVaultCopy`/`prepareSandboxConfigDir`
  (no re-seed). The three lifecycle fields (`browser`/`obsidianProcess`/`page`)
  were made non-readonly so relaunch can swap them while keeping harness identity.
- Verified relaunch REALLY reboots (throwaway probe): new OS pid AND a fresh
  renderer (a marker set on `window` in session 1 is gone in session 2). So the
  session-2 `getDocId` returning the session-1 id can only come from reading disk,
  not a warm cache. (Relaunch is fast — ~0.5s — because Obsidian boots quickly
  when warm; the pid/marker check confirms it is a true restart, not a no-op.)

**3. Read-only `getDocId` mints nothing.**
- Asserts `getDocId` on an id-less note returns null AND leaves the on-disk bytes
  byte-for-byte unchanged.
