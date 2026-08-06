---
id: nid_e7phu93lqo8nmwh330i9miws1_e
title: 'npm run check is red: Array.prototype.at with lib ES2021'
status: in_progress
deps: []
links: []
created_iso: '2026-08-04T19:14:32Z'
status_updated_iso: '2026-08-06T19:11:06Z'
type: bug
priority: 2
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-id-lib
---
PRE-EXISTING breakage, discovered while wiring up BDD (ticket nid_imvuuievshgdtn84dcwsps1eq_e) — verified on a clean `git worktree` of HEAD with `npm ci`, so it is NOT caused by that change.

```
$ npm run check
src/testSupport/fileFactory.ts(19,37): error TS2550: Property 'at' does not exist on type 'string[]'.
  Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
```

`tsconfig.json` sets `"lib": ["ES2021", "DOM"]` and `src/testSupport/fileFactory.ts:19` uses `path.split('/').at(-1)`.

This matters beyond the annoyance: `prepublishOnly` runs `npm run check`, so `npm publish` is currently blocked.

Two fixes, pick one:
- Replace `.at(-1)` with index arithmetic (keeps the ES2021 floor, which matches the `target`).
- Raise `lib` to ES2022 (Obsidian ships a modern Electron, so it is safe at runtime) and leave `target` alone.
