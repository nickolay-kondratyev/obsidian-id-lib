import { TFile, Vault } from 'obsidian';

/**
 * Minimal file-content seam the doc-id stores need — the library's only
 * file-IO boundary. Any object with these two methods structurally satisfies
 * it, so consumers can substitute their own vault-file utility.
 */
export interface FileContentAccess {
  /** Fast cached read of the file's current content. */
  cachedRead(file: TFile): Promise<string>;

  /**
   * Atomically reads, transforms, and saves a file's content
   * (Obsidian Vault.process — avoids the read()+modify() race).
   */
  process(file: TFile, transform: (content: string) => string): Promise<void>;
}

/** FileContentAccess backed by an Obsidian Vault. */
export class VaultFileContentAccess implements FileContentAccess {
  constructor(private readonly vault: Vault) {
  }

  cachedRead(file: TFile): Promise<string> {
    return this.vault.cachedRead(file);
  }

  async process(file: TFile, transform: (content: string) => string): Promise<void> {
    await this.vault.process(file, transform);
  }
}
