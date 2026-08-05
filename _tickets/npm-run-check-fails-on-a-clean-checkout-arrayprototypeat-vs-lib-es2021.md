---
id: nid_avpmbw0w9cskk57061lcfaw3g_e
title: npm run check fails on a clean checkout (Array.prototype.at vs lib ES2021)
status: in_progress
deps: []
links: []
created_iso: '2026-08-04T18:24:11Z'
status_updated_iso: '2026-08-05T01:00:49Z'
type: bug
priority: 1
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib
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

--------------------------------------------------------------------------------

HERE is info from consumers who have looked at this ticket

consumer 1 recommendation:
```
- Bump lib to ES2022 in both tsconfig.json and tsconfig.build.json (the ticket's note to check the build config is correct — they must agree or dist/'s .d.ts assumes a different floor than what type-checked).
- Leave target at ES2021 unless there's a separate reason to move it. Nothing in the reported error requires it, and it keeps the emit byte-identical.
- Option 2 (parts[parts.length - 1]) also works and is zero-risk, but it leaves the library's stated floor a lie relative to where its consumers actually run, and the next .at() re-opens the same ticket. Note that under this repo's noUncheckedIndexedAccess the index form yields string | undefined anyway — same handling burden, less clarity.
```

consumer 2 recommendation:
```
Bump lib only. Do NOT bump target. The lib's build:js is pinned esbuild --target=es2021; raising tsc's target would desync the two for no gain.

Supporting facts I verified:
- This repo already does exactly that: tsconfig.json here is target: ES2021 + lib: ["ES2022", "DOM"], and it has the identical .at(-1) in src/testSupport/fileFactory.ts:19. So the sole consumer of the lib already sits on the ES2022 lib floor.
- Nothing ES2022 ships today: grep for .at( / Object.hasOwn in node_modules/obsidian-id-lib/dist/index.js → 0 hits; same grep over this plugin's non-test src/ → 0 hits. Both usages are test-support only, which never reaches a user's device.

The ES2022 library surface is tiny anyway: {Array,String,TypedArray}.prototype.at, Object.hasOwn, Error.cause, RegExp d/hasIndices. Only the first two have a Safari-15.4 floor.

Recommendation

Take fix #1, lib only — in the id-lib's tsconfig.json and tsconfig.build.json (the ticket's closing note is right; both need it, since .d.ts emit resolves against lib too).

Rationale: it unblocks npm publish (prepublishOnly → npm run check), matches the consumer's existing config so the two repos stop diverging, and the residual risk is confined to iOS 15.0–15.3 users and only materializes if someone later writes an ES2022 built-in into production code. Fix #2 is a genuine zero-risk one-liner, but it leaves the two tsconfigs inconsistent and the papercut will recur the next time anyone reaches for .at().

If you want the belt-and-braces version: bump lib, and add a note in the lib README that shipped code targets ES2021 semantics for mobile-webview safety.

One thing I could not verify: submodules/obsidian-id-lib/ is empty in this container (uninitialized submodule, no .gitmodules), and the host path /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib isn't mounted here — so I read the lib's package.json and built dist/ from node_modules/, and could not read its actual tsconfig.json / tsconfig.build.json. Confirm the lib line in both before editing.

Sources: Obsidian Help — Mobile app (https://obsidian.md/help/mobile), Obsidian changelog (https://obsidian.md/changelog/)
```
