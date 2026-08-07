---
closed_iso: 2026-08-07T20:06:37Z
id: nid_k072laqjvgia3ys3yzvhnk9cc_e
title: fix the duplicate id
status: closed
deps: []
links: []
created_iso: '2026-08-07T20:04:05Z'
status_updated_iso: 2026-08-07T20:06:37Z
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

## Resolution

The described behavior is already implemented and tested — `FrontmatterDocIdStore`
fills degenerate `id` values in place rather than inserting a duplicate key.

- `src/FrontmatterDocIdStore.ts` — `writeIdIntoBlock` matches an existing (but
  value-less) top-level `id` line and replaces it in place
  (`content.replace(FRONTMATTER_ID_LINE_REGEX, 'id: <newId>')`), so `id: ""`,
  `id: ''`, and `id: # comment` are all filled without adding a second key.
  A slot occupied by a nested mapping is protected via
  `isFollowedByIndentedLine` and never overwritten. `parseYamlScalar` reads
  quoted/comment-only values back as absent, so read/write agree by
  construction. (Landed in commits `75d4f09`, `9642e65`.)
- `src/FrontmatterDocIdStore.test.ts` — covers double-quoted, single-quoted, and
  comment-only empty values ("fill … in place (no duplicate key)"), plus the
  degenerate empty frontmatter block and the nested-mapping guard. All 29 tests
  pass.

Remaining work for this ticket was documentation drift: `README.md` still listed
the fixed behavior under **Known issues**. That stale bullet was removed.
