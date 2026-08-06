# CLAUDE.md

Consumer-facing overview (what the library does, install, API, contracts):
[`README.md`](README.md). This file is for developing the library.

## Quick start

```bash
npm install
npm test          # vitest: unit + domain-BDD
npm run test:all  # every gate in release order (check + check:e2e + test + test:e2e)
```

`test:all` is the single definition of "everything green" — the release script
runs exactly it. Adding a test tier means adding it there.

## Load-bearing invariants (do not break silently)

- **Domain import boundary** — `src/` (except `src/obsidian/`) and domain steps
  must NEVER import `obsidian`, **type-only imports included**. The domain
  speaks its own `DocFile` (`src/DocFile.ts`); `src/obsidian/` is the only
  host-API bridgehead. Enforced by `npm run check:boundaries`.
- **No tags under `features/`** — a tag on any line can silently vanish a
  scenario, so the vocabulary is closed/empty and `tests/features/FeatureFileTagAudit.ts`
  fails the build on any tag.
- **Byte-preserving writes** — frontmatter edits do raw-text single-line
  insertion, deliberately NOT `FileManager.processFrontMatter`. See README's
  Guarantees before touching a store.

## Deeper docs (`docs-internal/`)

| File | When |
| --- | --- |
| [`development.md`](docs-internal/development.md) | Commands, test tiers, e2e setup, releasing — the full dev reference |
| [`bdd-testing-strategy.md`](docs-internal/bdd-testing-strategy.md) | Rationale behind the BDD tiers and placement rules |
| [`how-to-publish-to-npm.md`](docs-internal/how-to-publish-to-npm.md) | Full npm release runbook (first-time setup, rollback) |
