---
id: nid_mvwpuocg1c6fujschky331zjq_e
title: ''' test:all'' does not work'
status: in_progress
deps: []
links: []
created_iso: '2026-08-06T17:28:34Z'
status_updated_iso: '2026-08-06T17:29:11Z'
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
