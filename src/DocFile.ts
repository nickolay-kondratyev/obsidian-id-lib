/**
 * The library's domain-owned view of a vault file: the ONLY two facts the
 * doc-id logic needs — where the file lives and which format it is.
 *
 * WHY not Obsidian's `TFile`: the domain layer must not depend on the host API
 * (docs-internal/bdd-testing-strategy.md, "Domain isolation via adapters"),
 * type-only imports included — a host type in a domain signature forces every
 * fake to satisfy a wide host class. `TFile` satisfies this STRUCTURALLY, so
 * consumers still pass `app.vault`'s own files with no conversion.
 */
export interface DocFile {
  /** Vault-absolute path, e.g. `notes/a.md` — Obsidian's `TFile.path`. */
  readonly path: string;

  /** Lowercase extension WITHOUT the dot, e.g. `md` — Obsidian's `TFile.extension`. */
  readonly extension: string;
}
