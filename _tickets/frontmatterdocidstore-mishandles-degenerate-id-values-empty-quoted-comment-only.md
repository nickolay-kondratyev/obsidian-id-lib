---
closed_iso: 2026-08-06T17:19:08Z
id: nid_iyor6ne71sou9xiy0d4okfc5z_e
title: FrontmatterDocIdStore mishandles degenerate id values (empty-quoted, comment-only)
status: closed
deps: [nid_ep8dz7rkoyydissrr5e8fvtyy_e]
links: [nid_37g3zp3ca1k9vxslfrw1i3u3g_e]
created_iso: '2026-08-04T17:38:51Z'
status_updated_iso: 2026-08-06T17:19:08Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [bug]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib
---
Two related defects in src/FrontmatterDocIdStore.ts, both verified by repro:

1) DUPLICATE id KEY on empty-string value. For frontmatter containing id: "" (or id: ''), readIdFromRawContent treats it as absent (empty scalar), but FRONTMATTER_VALUELESS_ID_LINE_REGEX requires nothing after the colon so it does not match either — writeIdIntoBlock falls through to "no id key → insert as first entry" (src/FrontmatterDocIdStore.ts:119-120). Result:

---
id: docid_NEW_e
id: ""
title: x
---

Duplicate mapping key = invalid YAML; which value tools see is parser-dependent.

2) COMMENT TEXT RETURNED AS ID. For id: # todo, the greedy [ \t]* in FRONTMATTER_ID_LINE_REGEX consumes the whitespace before #, so parseYamlScalar's comment-strip regex /\s#.*$/ (which requires leading whitespace) never fires (src/FrontmatterDocIdStore.ts:141-148). getId/ensureDocId return "# todo" as the doc id. YAML semantics: this value is null.

Fix direction: treat empty-quoted and comment-only value lines as fillable (extend the fill-in-place path used for valueless id:), and fix parseYamlScalar so a value that is pure comment yields empty → absent. Fixing the read side (2) makes case (2) take the write path — ensure that write fills in place, not duplicate-inserts.

Start with failing tests in src/FrontmatterDocIdStore.test.ts for: id: "", id: '', id: # comment — for both getId and ensureId (asserting resulting content has exactly one id line).

## Acceptance Criteria

- Failing tests first for id: "", id: '', id: # comment (getId returns null; ensureId fills in place; exactly one id line in resulting frontmatter).
- No duplicate id key can be produced.
- All existing tests pass (npm test).
- e2e test is added if appropriate.

## Resolution (closed)

Fixed in `src/FrontmatterDocIdStore.ts`. The two defects were resolved together
by making read and write agree by construction — a line is fillable iff
`parseYamlScalar` sees no usable value in it:

1. **Empty-quoted value (`id: ""` / `id: ''`)** — `FRONTMATTER_ID_LINE_REGEX`
   now captures the whole remainder after `id:` with `(.*)` (previously a
   valueless-only regex). Such a line matches in `writeIdIntoBlock`, so it takes
   the fill-in-place path (`content.replace(...)`) instead of falling through to
   duplicate-insert. No duplicate `id` key can be produced.

2. **Comment-only value (`id: # todo`)** — `parseYamlScalar` strips comments with
   `/(?:^|\s)#.*$/` (the `^|` alternative catches a `#` that begins the value
   after the captured whitespace was trimmed), so a pure-comment value yields
   empty → read returns null and the write fills it in place.

A nested-mapping guard (`isFollowedByIndentedLine`) prevents overwriting an
occupied `id:` slot that opens a nested mapping (e.g. `id: # c` followed by
indented entries).

Tests in `src/FrontmatterDocIdStore.test.ts` cover getId (returns null) and
ensureId (fills in place, exactly one id line) for `id: ""`, `id: ''`,
`id: # todo`, plus the nested-mapping-with-comment guard case. All 88 unit/BDD
tests pass (`npm test`).
