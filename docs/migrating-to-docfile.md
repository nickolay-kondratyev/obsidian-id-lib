# Migrating from `TFile` to `DocFile`

The library's public API no longer mentions Obsidian's `TFile`. Every file
parameter is now `DocFile` — the library's own two-field view of a vault file:

```ts
export interface DocFile {
  readonly path: string;       // Obsidian's TFile.path
  readonly extension: string;  // Obsidian's TFile.extension (no dot)
}
```

## Do I have to change anything?

**Almost certainly not.** `DocFile` is a *structural* type and `TFile` has both
fields, so an Obsidian `TFile` still satisfies every signature with no cast and
no conversion:

```ts
this.registerEvent(
  this.app.workspace.on('file-open', (file) => {   // file: TFile | null
    if (file !== null && docIdService.isEligible(file)) {
      void docIdService.ensureDocId(file);          // still compiles, unchanged
    }
  }),
);
```

Nothing changes at runtime either: the object you hand over is the same object.

## What DID change

### 1. Your own `FileContentAccess` implementation (only if you have one)

If you substituted your own file-IO seam, its methods now receive a `DocFile`
instead of a `TFile`. TypeScript's method parameters are bivariant, so an
existing `cachedRead(file: TFile)` still type-checks against the interface — but
it is now a **lie**: the library may hand you any `{ path, extension }`. Widen
the parameter and resolve the vault file yourself:

```ts
// before
class MyFileAccess implements FileContentAccess {
  cachedRead(file: TFile): Promise<string> {
    return this.vault.cachedRead(file);
  }
}

// after
class MyFileAccess implements FileContentAccess {
  async cachedRead(file: DocFile): Promise<string> {
    const resolved = this.vault.getFileByPath(file.path);
    if (resolved === null) {
      throw new Error(`File not found: ${file.path}`);
    }
    return this.vault.cachedRead(resolved);
  }
  // ...same for process()
}
```

That is exactly what the bundled `VaultFileContentAccess` does.

There is no type-level way to "keep taking a `TFile`" safely: narrowing your
parameter back to `TFile` still compiles (that is the bivariance above) but it
does not stop the library handing you a plain object — it only hides that it
can. Resolve by path, as above.

### 2. `VaultFileContentAccess` resolves by path

`VaultFileContentAccess` now looks the file up with `Vault.getFileByPath(path)`
before touching it, rather than assuming the argument *is* a `TFile`.
Consequences:

- **Minimum Obsidian version 1.5.7** (when `Vault.getFileByPath` was added).
  Declared as `peerDependencies: { "obsidian": ">=1.5.7" }`, which protects
  your *build*. It does NOT protect your users — **also raise
  `minAppVersion` to at least `1.5.7` in your plugin's `manifest.json`**,
  otherwise a user on an older Obsidian installs your plugin happily and every
  `ensureDocId` dies with `this.vault.getFileByPath is not a function`.
- Passing a path that is not a file in the vault now rejects with
  `File not found: <path>` instead of failing somewhere inside Obsidian.

### 3. Import paths of the Obsidian-backed pieces

Only the *package* entry point matters and it is unchanged:

```ts
import { DocIdServices, VaultFileContentAccess } from 'obsidian-id-lib';
```

Inside the repo they moved to `src/obsidian/` — the library's single sanctioned
host-API bridgehead. Deep imports into `dist/` were never supported.

## Why

The BDD testing strategy (`docs-internal/bdd-testing-strategy.md`, "Domain
isolation via adapters") requires domain source to consume domain-owned types
rather than the host API — **including type-only imports**, which are erased at
runtime but still force every fake to satisfy a wide host class. The boundary is
enforced in CI by `.dependency-cruiser.cjs` (`npm run check:boundaries`, part of
`npm test`), with `tsPreCompilationDeps: true` so `import type` is visible to
the rule.

The practical win for consumers: the library is testable — and mockable in
*your* tests — with a two-field object literal.
