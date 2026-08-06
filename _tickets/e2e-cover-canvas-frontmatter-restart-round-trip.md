---
id: nid_1s5ujs7nvq1ddrik8iuxnj730_e
title: 'e2e: cover canvas frontmatter + restart round-trip'
status: in_progress
deps: []
links: [nid_ep8dz7rkoyydissrr5e8fvtyy_e]
created_iso: '2026-08-04T18:23:59Z'
status_updated_iso: '2026-08-06T20:05:55Z'
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
