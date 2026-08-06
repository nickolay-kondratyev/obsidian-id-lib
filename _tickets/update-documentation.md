---
closed_iso: 2026-08-06T17:11:15Z
id: nid_l5dit2fzbb6hfr0g5tih9cr13_e
title: Update documentation
status: closed
deps: []
links: []
created_iso: '2026-08-06T17:04:44Z'
status_updated_iso: 2026-08-06T17:11:15Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib-mirror-1
---
Update documentation:
- README.md to be solely focused for the CONSUMERS of this package.
  - Move the relevant context for development into CLAUDE.md and more in depth documentation into /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib-mirror-1/docs-internal For example '## Releasing' section from README.md is a good call to just move into /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib-mirror-1/docs-internal/how-to-release.md without polluting README.md or CLAUDE.md about it. 


END RESULT:
- CLAUDE.md has information relevant to development of this package.
- README.md has 1) FIRST describing its high level functionality. 2) SECONDLY information on consumption of this package and third mention of the license.

---

## Resolution (completed)

Restructured the docs so `README.md` is consumer-only and all development
context lives in `CLAUDE.md` + `docs-internal/`.

**`README.md`** — now ordered exactly as required:
1. High-level functionality (intro paragraph).
2. Consumption: Installation → Usage → Id-format / cross-plugin-lock contracts
   → Guarantees → Known issues. (`Installation` moved up from the old
   bottom-of-file `Consuming the library` section.)
3. License (MIT).
   Removed all dev-only sections (`Dev`, `Test tiers (BDD)`, `e2e`,
   `Releasing`) and the internal `_tickets/` ticket-id references from Known
   issues. Fixed the dangling `[Dev](#test-tiers-bdd)` in-page anchor.

**`CLAUDE.md`** — was a stub (`See README.md`). Now a succinct dev entry point:
quick-start commands, the load-bearing invariants (domain import boundary,
no-tags-under-`features/`, byte-preserving writes), and a pointer table into
`docs-internal/`.

**`docs-internal/development.md`** (new) — full dev reference: commands, ES2021
runtime-floor rationale, the complete Test-tiers/BDD prose, e2e (real Obsidian)
setup + env knobs, and a Releasing quick-command block. The Releasing detail
was consolidated to point at the pre-existing
`docs-internal/how-to-publish-to-npm.md` runbook rather than creating a
redundant `how-to-release.md` (would have duplicated the existing runbook —
DRY).

All cross-doc relative links verified to resolve.
