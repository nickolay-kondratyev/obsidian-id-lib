---
closed_iso: 2026-08-06T17:30:39Z
id: nid_mvwpuocg1c6fujschky331zjq_e
title: ''' test:all'' does not work'
status: closed
deps: []
links: []
created_iso: '2026-08-06T17:28:34Z'
status_updated_iso: 2026-08-06T17:30:39Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib-mirror-1
---
```
m:DOCKER d:nickolay-kondratyev_obsidian-id-lib-mirror-1 b:main mirror-1 ○ ❯r
    [cwrite][wrote_to] file:[/tmp/my_cache/1/_r.for_package_json/nameless_cache_1] chars_in_file:[9]
    cat.buffered '/tmp/my_cache/1/_r.for_package_json/nameless_cache_1'

> obsidian-id-lib@0.1.0 test:all
> npm run check && npm run check:e2e && npm run test && npm run test:e2e


> obsidian-id-lib@0.1.0 check
> tsc -noEmit


> obsidian-id-lib@0.1.0 check:e2e
> tsc -noEmit -p e2e/tsconfig.json


> obsidian-id-lib@0.1.0 test
> npm run check:boundaries && vitest run


> obsidian-id-lib@0.1.0 check:boundaries
> depcruise src tests --config .dependency-cruiser.cjs

sh: 1: depcruise: not found
```

## Resolution (closed)

**Root cause:** stale `node_modules`. `dependency-cruiser` (which provides the
`depcruise` binary used by `check:boundaries`) was declared in both
`package.json` devDependencies and `package-lock.json`, but was not physically
present in `node_modules/` — along with ~40 other packages. So the lockfile and
the installed tree had drifted out of sync. This was an environment/install
state issue, not a defect in the scripts or config.

**Fix:** `npm install` reconciled `node_modules` with the lockfile (added 41
packages, including `dependency-cruiser`, restoring `node_modules/.bin/depcruise`).

**Verification:** `npm run test:all` now passes end to end:
- `check` (tsc -noEmit) — ok
- `check:e2e` (tsc -noEmit -p e2e/tsconfig.json) — ok
- `test` → `check:boundaries` (depcruise, no violations, 33 modules) + vitest
  (9 files, 88 tests passed)
- `test:e2e` (real headless Obsidian 1.12.7, 4 tests passed)

No source changes were needed; running `npm install` before `test:all` resolves it.

