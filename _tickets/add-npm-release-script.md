---
id: nid_59oohp2285wtsjln5c7rvc705_e
title: "add npm release script"
status: open
deps: []
links: []
created_iso: 2026-08-04T17:58:30Z
status_updated_iso: 2026-08-04T17:58:30Z
type: task
priority: 3
assignee: nickolaykondratyev
---

This package is published to NPM to https://www.npmjs.com/package/obsidian-id-lib

Let's add a script that will allow us to publish to NPM using ENV variable `NPM_PUBLISH_TOKEN` as publish token.

This script will also bump the version of the package. By default, bumping the patch version, (first it will bump the version, commit and push on the default branch prior to publishing to NPM)(it will also allow bumping other versions when argument is passed in).

The script will be at top level and called somethinng like `release_to_npm_with_version_bump.sh`

Also as part of the scripts we should run ALL of our tests including end to end and unit tests. Lets make sure we have `npm run test:all` target that can be maintained properly.