---
id: nid_k072laqjvgia3ys3yzvhnk9cc_e
title: fix the duplicate id
status: in_progress
deps: []
links: []
created_iso: '2026-08-07T20:04:05Z'
status_updated_iso: '2026-08-07T20:05:10Z'
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib
---
If we had empty ids we should just generate and id and replace it instead of having a new id added.
```md file=[$(git.repo_root)/README.md] Lines=[174-176]
- **Frontmatter: degenerate `id` values mishandled.** `id: ""` / `id: ''`
  leads to a duplicate `id` key being inserted (invalid YAML); `id: # comment`
  is read back with the comment text as the id.
```
UNLESS there are issues with doing so.
