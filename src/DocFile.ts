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

  /**
   * Extension WITHOUT the dot, e.g. `md` — Obsidian's `TFile.extension`, which
   * is the trailing segment of the file name verbatim.
   *
   * Format dispatch matches it EXACTLY and case-sensitively (`md`, `canvas`),
   * deliberately: Obsidian itself only treats lowercase `.md`/`.canvas` as
   * those formats, so normalizing here would make the library write ids into
   * files the host renders as plain text.
   */
  readonly extension: string;
}
