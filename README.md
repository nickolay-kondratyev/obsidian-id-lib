# obsidian-id-lib

Shared doc-id read/ensure for Obsidian plugins: every eligible document gets a
persistent id — markdown notes (incl. `.excalidraw.md`) in the YAML
frontmatter `id` key, `.canvas` files at `metadata.frontmatter.id` in the
canvas JSON — with **cross-plugin write serialization**. Multiple plugins can
bundle this library and ensure ids on the same `file-open` event without
racing each other into duplicate/clobbered ids.

## Installation

Published to npm as a compiled package — a bundled ESM `dist/index.js` plus
`.d.ts` types:

```bash
npm install obsidian-id-lib
```

`obsidian` is a types-only **peer dependency** — never bundled into `dist`
(all its imports are type-only and elided at build time). Consumers already
have `obsidian` and mark it external in their plugin build, as every Obsidian
plugin does.

**Obsidian floor: 1.5.7** (`peerDependencies`), because
`VaultFileContentAccess` resolves a `DocFile` to the vault's own `TFile` via
`Vault.getFileByPath`. Consuming plugins should also set `minAppVersion` to at
least `1.5.7` in their `manifest.json` — the peer range guards the build, the
manifest guards the user.

**Runtime floor:** shipped `dist/` is **ES2021**. ES2022 built-ins
(`Array.prototype.at`, `Object.hasOwn`, …) have an iOS 15.4 floor, so the build
deliberately fails rather than ship one that would throw on an iOS 15.0–15.3
webview.

## Usage

One-line adoption:

```ts
import { DocIdServices } from 'obsidian-id-lib';

const docIdService = DocIdServices.createDefault(app.vault);
```

Typical wiring — ensure an id whenever a file gains focus:

```ts
import { Plugin } from 'obsidian';
import { DocIdServices } from 'obsidian-id-lib';

export default class MyPlugin extends Plugin {
  async onload() {
    const docIdService = DocIdServices.createDefault(this.app.vault);
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file !== null && docIdService.isEligible(file)) {
          void docIdService.ensureDocId(file);
        }
      }),
    );
  }
}
```

Custom wiring (DI form — every piece is behind an interface):

```ts
import {
  CanvasDocIdStore,
  CrossPluginPathLock,
  DocIdGeneratorDefault,
  DocIdServiceDefault,
  FrontmatterDocIdStore,
  VaultFileContentAccess,
} from 'obsidian-id-lib';

const files = new VaultFileContentAccess(app.vault); // or your own FileContentAccess
const generator = new DocIdGeneratorDefault();
const docIdService = new DocIdServiceDefault(
  new FrontmatterDocIdStore(files, generator),
  new CanvasDocIdStore(files, generator),
  new CrossPluginPathLock(), // REQUIRED — the cross-plugin lock is the point
);
```

API surface (`DocIdService`):

- `ensureDocId(file)` — lock-guarded read-or-create; the single entry point
  for id **creation**. Returns `null` for unsupported formats or unreadable
  content.
- `getDocId(file)` — READ-ONLY lookup; lock-free and never writes — safe for
  bulk read paths over every vault file.
- `isEligible(file)` — whether the file's format can carry a doc id
  (`md`, `canvas`; raw `.excalidraw` is deliberately unsupported — pure JSON
  with no agreed id location).

Every `file` above is a **`DocFile`** — the library's own two-field view of a
vault file (`{ path, extension }`), not Obsidian's `TFile`. `TFile` satisfies
it structurally, so you keep passing `app.vault`'s own files with no cast and
no conversion. Upgrading from a `TFile`-typed release:
[`docs/migrating-to-docfile.md`](docs/migrating-to-docfile.md).

## Id format contract

<!-- ap_iZAE3fAcs5zXIWrTiIdx3_E -->

- Generated ids: `docid_{24 random base36 lowercase chars}_e`
  (e.g. `docid_a1b2c3d4e5f6g7h8i9j0k1l2_e`). 36^24 > 2^122 — collision space
  above UUID v4. Base36 lowercase keeps ids safe on case-insensitive
  filesystems.
- **Existing ids of ANY format are honored as-is** (e.g. ids minted by earlier
  tooling, such as uppercase `docid_{21 base62}_E`) — the file is never
  rewritten to "fix" an id.
- An **occupied but unusable id slot** (e.g. `id:` opening a nested mapping,
  or an object value in canvas JSON) is NEVER overwritten — `ensureDocId`
  returns `null`.
- Consumers that use ids as filenames should validate filename safety
  themselves (existing foreign-format ids pass through).

## Window-key compatibility contract (the cross-plugin lock)

<!-- ap_e7fWGWziwxrLmnegjIYKX_E -->

The library is bundled into each consuming plugin, so each plugin runs its
own copy. The ONLY shared state between copies is a lock registry on
`window`/`globalThis` — this is a public cross-plugin API:

- **Key**: `__obsidian_id_lib_path_lock_registry_v1__` (exported as
  `ID_LOCK_REGISTRY_KEY`). Bump the `_v1_` suffix ONLY as a deliberate
  breaking change.
- **Value shape**: a plain `Map<string, Promise<unknown>>` — file path →
  current tail promise. Plain promises only, so differently-versioned bundled
  copies interoperate.
- **Protocol** (what `CrossPluginPathLock` implements and any other
  implementation must follow):
  - Acquire by chaining off the path's current tail, **swallowing its
    rejection** (a foreign copy's failed task must not wedge you).
  - Store a tail that **never rejects** (foreign waiters may not swallow).
  - Release is implicit — the tail settles on success or throw. **No
    timeout/expiry.**
  - Only the CURRENT tail deletes its Map entry (`=== next` guard), so a
    predecessor's cleanup can't detach a queued successor.
- Locking is per file path: distinct files run in parallel; same-path
  `ensureDocId` calls serialize FIFO — across plugins.

The key, plain-`Map` value shape, and native-`Promise` tails are pinned by a
`cross-version wire contract` test suite (`src/CrossPluginPathLock.test.ts`), so
they can only change as a deliberate, breaking edit — not silently. This is the
settled interop surface: everything else in the library may evolve freely.

## Guarantees

- **Idempotency backstop**: even if the lock is bypassed (a third plugin not
  using the lib), each store re-checks for an existing id INSIDE the atomic
  `Vault.process` transform — the second writer sees the id and bails.
  (Canvas caveat: see Known issues — the bail is correct on disk, but the
  returned id can be wrong.)
- **Byte-preserving writes**: frontmatter edits only add/fill the single id
  line via raw-text editing (deliberately NOT `FileManager.processFrontMatter`,
  which re-serializes the whole block and mangles formatting of keys the
  plugin does not own). CRLF preserved; canvas JSON written with Obsidian's
  tab indentation.
- **Malformed content never throws**: unparseable canvas JSON logs
  `console.error` and returns `null`. Empty/whitespace-only canvas content is
  a brand-new canvas (`{}`), not malformed — it gets an id.
- **Read paths never write.**

## Known issues

- **Canvas: `ensureDocId` can return an id that was not persisted.** When the
  canvas gains an id between the precheck read and the atomic write (lock
  bypassed by a third writer), the write correctly bails but the NEW (unwritten)
  id is returned instead of the persisted one.
- **Frontmatter: degenerate `id` values mishandled.** `id: ""` / `id: ''`
  leads to a duplicate `id` key being inserted (invalid YAML); `id: # comment`
  is read back with the comment text as the id.

## License

[MIT](LICENSE.md)
