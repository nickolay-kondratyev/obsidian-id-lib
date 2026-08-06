---
closed_iso: 2026-08-05T02:53:09Z
id: nid_59oohp2285wtsjln5c7rvc705_e
title: add npm release script
status: closed
deps: []
links: []
created_iso: '2026-08-04T17:58:30Z'
status_updated_iso: 2026-08-05T02:53:09Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib-mirror-1
---
This package is published to NPM to https://www.npmjs.com/package/obsidian-id-lib

Let's add a script that will allow us to publish to NPM using ENV variable `NPM_PUBLISH_TOKEN` as publish token.

This script will also bump the version of the package. By default, bumping the patch version, (first it will bump the version, commit and push on the default branch prior to publishing to NPM)(it will also allow bumping other versions when argument is passed in).

The script will be at top level and called somethinng like `release_to_npm_with_version_bump.sh`

Also as part of the scripts we should run ALL of our tests including end to end and unit tests. Lets make sure we have `npm run test:all` target that can be maintained properly.

## Resolution — DONE

**`release_to_npm_with_version_bump.sh`** (repo root, executable). Usage:

```bash
export NPM_PUBLISH_TOKEN=...                  # npm automation token
./release_to_npm_with_version_bump.sh         # patch (default)
./release_to_npm_with_version_bump.sh minor   # or major / premajor / 1.2.3 / … (any `npm version` arg)
```

Order of operations — **nothing is mutated until the suite is green**, so a red
release leaves both the repo and the registry untouched:

1. Preconditions: `NPM_PUBLISH_TOKEN` set; on the default branch (resolved from
   `refs/remotes/origin/HEAD`, falling back to `main`); clean working tree;
   HEAD == `origin/<default branch>` after a fetch.
2. `npm run test:all`.
3. `npm version <bump> -m "chore(release): v%s"` → commit + tag.
4. `git push --follow-tags origin <default branch>`.
5. `npm publish` (`prepack` rebuilds `dist/` from that exact commit).

Auth needs no new wiring: the pre-existing `.npmrc` already reads
`//registry.npmjs.org/:_authToken=${NPM_PUBLISH_TOKEN}`. The token must be an
**automation** token — a classic/2FA-gated one prompts for an OTP and breaks the
non-interactive publish.

**`npm run test:all`** = `check && check:e2e && test && test:e2e` — the single
definition of "everything green" (types for src+tests, types for e2e, vitest
unit + domain BDD, real-Obsidian Playwright e2e). The release script runs exactly
this target and nothing else, so there is no second list of tiers to keep in
sync; a new tier is added in one place.

Docs: README gained a `## Releasing` section plus the `test:all` line in `## Dev`;
`docs-internal/how-to-publish-to-npm.md` "Future releases" now documents the
script instead of the manual `npm version` / `git push` / `npm publish` sequence.

**Verified:** `npm run test:all` exit 0 — tsc x2 clean, 76 vitest tests passed,
4 Playwright e2e tests passed against a real headless Obsidian 1.12.7. Both
fail-fast guards exercised: missing token and wrong-branch each exit 1 with a
clear message. The publish itself was NOT executed (no token, and it would burn
a real version).
