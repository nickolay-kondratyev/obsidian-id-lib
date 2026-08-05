import { TFile, Vault } from 'obsidian';
import { DocFile } from '../DocFile';
import { FileContentAccess } from '../FileContentAccess';

/**
 * FileContentAccess backed by an Obsidian Vault — the adapter that translates
 * the domain's `DocFile` into the host's `TFile`.
 *
 * Lives under src/obsidian/ because that directory is the library's ONLY
 * sanctioned host-API bridgehead (enforced by .dependency-cruiser.cjs).
 */
export class VaultFileContentAccess implements FileContentAccess {
  constructor(private readonly vault: Vault) {
  }

  // async (not a bare `return`) so a failed resolve REJECTS rather than
  // throwing synchronously out of a Promise-returning method.
  async cachedRead(file: DocFile): Promise<string> {
    return this.vault.cachedRead(this.resolve(file));
  }

  async process(file: DocFile, transform: (content: string) => string): Promise<void> {
    await this.vault.process(this.resolve(file), transform);
  }

  /**
   * Looks the file up in the vault by path.
   *
   * WHY-NOT casting the DocFile to TFile: DocFile is a STRUCTURAL type, so a
   * caller may legitimately hand over a plain `{ path, extension }`. A cast
   * would be a lie that only surfaces deep inside Obsidian; the lookup is a
   * hash-map hit and turns "not a real vault file" into an honest error here.
   * (Requires Obsidian >= 1.5.7 for `Vault.getFileByPath`.)
   */
  private resolve(file: DocFile): TFile {
    const resolved = this.vault.getFileByPath(file.path);
    if (resolved === null) {
      throw new Error(`File not found: ${file.path}`);
    }
    return resolved;
  }
}
