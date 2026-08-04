---
id: nid_avpmbw0w9cskk57061lcfaw3g_e
title: "npm run check fails on a clean checkout (Array.prototype.at vs lib ES2021)"
status: open
deps: []
links: []
created_iso: 2026-08-04T18:24:11Z
status_updated_iso: 2026-08-04T18:24:11Z
type: bug
priority: 1
assignee: nickolaykondratyev
tags: [decide]
---

`npm run check` (tsc -noEmit, root tsconfig.json) FAILS on a clean checkout:

```
src/testSupport/fileFactory.ts(19,37): error TS2550: Property 'at' does not exist on type 'string[]'.
  Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
```

PRE-EXISTING and unrelated to any e2e work — both `src/testSupport/fileFactory.ts`
and `tsconfig.json` come from the original scaffold commit a867be8 and neither was
touched. `npm test` (vitest) passes 69/69 because vitest does not type-check.

This matters beyond the dev loop: `prepublishOnly` runs `npm run check`, so
`npm publish` is currently blocked.

DECIDE (why this was not just fixed in passing): two valid fixes with different
blast radius, and it is an owner call for a PUBLISHED library —
1. Bump `lib` (and possibly `target`) in /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib/tsconfig.json
   from ES2021 to ES2022. Changes what the emitted dist/ and .d.ts assume about
   the consumer runtime. `Array.prototype.at` is Electron 22+/Obsidian-era safe,
   so this is likely fine — but it is a compat contract change.
2. Avoid `.at()` in src/testSupport/fileFactory.ts:19 (e.g. `parts[parts.length - 1]`)
   and keep the ES2021 floor. Zero compat impact; test-support-only change.

Note `tsconfig.build.json` may need the same treatment — check before closing.

