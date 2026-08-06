---
id: nid_caf6vr2nqq5g2pwjdn2wcmiva_e
title: locking mechanism to function cross versions
status: in_progress
deps: []
links: []
created_iso: '2026-08-05T02:33:02Z'
status_updated_iso: '2026-08-06T22:21:49Z'
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib
---
We should make sure the locking mechanism that is used to make sure there is no races (if there are multiple id libraries running side by side). Works fine if there are multiple DIFFERENT versions of the id library. Since different versions of the plugins may live next to each other using this library.

With that said while other parts of the code can evolve, we want to make sure we settle on the key parts of the locking mechanism to make sure different versions of it can live side by side and respect each other.
