---
id: nid_gd25ffswlpugbok1gruw9nnj5_e
title: Look into fixing the canvas known issue
status: in_progress
deps: []
links: []
created_iso: '2026-08-07T20:22:11Z'
status_updated_iso: '2026-08-07T20:22:32Z'
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib
---
Can we adjust this for canvases, potentially doing another check when getting an id that the id is actually the one that got persisted?

```md file=[$(git.repo_root)/README.md] Lines=[170-173]
- **Canvas: `ensureDocId` can return an id that was not persisted.** When the
  canvas gains an id between the precheck read and the atomic write (lock
  bypassed by a third writer), the write correctly bails but the NEW (unwritten)
  id is returned instead of the persisted one.
```
