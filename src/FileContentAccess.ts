import { DocFile } from './DocFile';

/**
 * Minimal file-content seam the doc-id stores need — the library's only
 * file-IO boundary. Any object with these two methods structurally satisfies
 * it, so consumers can substitute their own vault-file utility.
 *
 * The Obsidian-backed implementation lives outside the domain, in
 * `src/obsidian/VaultFileContentAccess.ts`.
 */
export interface FileContentAccess {
  /** Fast cached read of the file's current content. */
  cachedRead(file: DocFile): Promise<string>;

  /**
   * Atomically reads, transforms, and saves a file's content
   * (Obsidian Vault.process — avoids the read()+modify() race).
   */
  process(file: DocFile, transform: (content: string) => string): Promise<void>;
}
