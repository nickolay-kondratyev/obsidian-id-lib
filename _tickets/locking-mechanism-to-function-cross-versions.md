---
closed_iso: 2026-08-06T22:24:32Z
id: nid_caf6vr2nqq5g2pwjdn2wcmiva_e
title: locking mechanism to function cross versions
status: closed
deps: []
links: []
created_iso: '2026-08-05T02:33:02Z'
status_updated_iso: 2026-08-06T22:24:32Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib
---
We should make sure the locking mechanism that is used to make sure there is no races (if there are multiple id libraries running side by side). Works fine if there are multiple DIFFERENT versions of the id library. Since different versions of the plugins may live next to each other using this library.

With that said while other parts of the code can evolve, we want to make sure we settle on the key parts of the locking mechanism to make sure different versions of it can live side by side and respect each other.

## Resolution (2026-08-06)

The cross-version locking mechanism was already implemented and behaviorally
sound (`src/CrossPluginPathLock.ts`, contract at README
`ap_e7fWGWziwxrLmnegjIYKX_E`). The lock's shared state is a versioned registry on
`window`/`globalThis` (`__obsidian_id_lib_path_lock_registry_v1__`) holding a
plain `Map<string, Promise<unknown>>` of path → tail promise. The protocol
(acquire by chaining off the tail while swallowing its rejection; store a
never-rejecting native-Promise tail; implicit release; `=== next` cleanup guard)
is what lets differently-versioned bundled copies serialize same-path work
through one chain. Existing behavioral tests already cover two-copy serialization
(AC-L6) and foreign pre-seeded pending/rejecting tails (AC-L7a/b).

**The gap that this ticket closed:** nothing pinned the *wire contract* itself.
Every test imported `ID_LOCK_REGISTRY_KEY` as a symbol, so a future version could
silently rename the key, bump `_v1_`, or change the value shape away from a plain
`Map` / native `Promise` — all tests would still pass, yet interop with an
already-deployed older version would silently break (each copy would create its
own registry and same-path work would NOT serialize across versions).

**Change made** (commit `d6dadc5`):
- Added a `cross-version wire contract` test suite in
  `src/CrossPluginPathLock.test.ts` pinning the three parts a foreign copy
  depends on: (1) the frozen key literal
  `__obsidian_id_lib_path_lock_registry_v1__`, (2) the plain-`Map` value shape,
  (3) native-`Promise` tails. These fail on any silent contract change, forcing a
  deliberate breaking edit.
- Documented the guard in README's compatibility contract section: the key,
  value shape, and tail type are the settled interop surface; everything else may
  evolve freely.

Full gate green: `npm test` → 93 passed, boundaries clean.
