import { describe, expect, it } from 'vitest';
import type { TFile, Vault } from 'obsidian';
import { VaultFileContentAccess } from './VaultFileContentAccess';

const CONTENT = '---\nid: existing\n---\n';

interface VaultCall {
  method: 'cachedRead' | 'process';
  file: TFile | null;
}

/**
 * Minimal Vault stand-in: records which TFile the adapter resolved a DocFile
 * to. `as unknown as Vault` is a BOUNDARY cast — Vault is a wide host class
 * and this adapter is the one place allowed to touch it.
 */
class FakeVault {
  readonly calls: VaultCall[] = [];

  constructor(private readonly fileByPath: ReadonlyMap<string, TFile>) {
  }

  getFileByPath(path: string): TFile | null {
    return this.fileByPath.get(path) ?? null;
  }

  async cachedRead(file: TFile): Promise<string> {
    this.calls.push({ method: 'cachedRead', file });
    return CONTENT;
  }

  async process(file: TFile, transform: (content: string) => string): Promise<string> {
    this.calls.push({ method: 'process', file });
    return transform(CONTENT);
  }

  asVault(): Vault {
    return this as unknown as Vault;
  }
}

/** Stands in for the vault's OWN TFile instance — identity is what is asserted. */
const VAULT_FILE = { path: 'notes/a.md', extension: 'md' } as unknown as TFile;

function setup(): { vault: FakeVault; access: VaultFileContentAccess } {
  const vault = new FakeVault(new Map([[VAULT_FILE.path, VAULT_FILE]]));
  return { vault, access: new VaultFileContentAccess(vault.asVault()) };
}

describe('VaultFileContentAccess', () => {
  describe('cachedRead', () => {
    it('should resolve the DocFile to the vault\'s own TFile before reading', async () => {
      // GIVEN a vault holding the file
      const { vault, access } = setup();
      // WHEN read via the domain-owned DocFile shape (a PLAIN object)
      await access.cachedRead({ path: 'notes/a.md', extension: 'md' });
      // THEN the vault was handed its own TFile instance
      expect(vault.calls).toEqual([{ method: 'cachedRead', file: VAULT_FILE }]);
    });

    it('should return the vault content', async () => {
      // GIVEN
      const { access } = setup();
      // WHEN / THEN
      expect(await access.cachedRead({ path: 'notes/a.md', extension: 'md' })).toBe(CONTENT);
    });

    it('should throw when the path is not a file in the vault', async () => {
      // GIVEN a DocFile that no longer exists in the vault
      const { access } = setup();
      // WHEN / THEN it fails here, not deep inside Obsidian
      await expect(access.cachedRead({ path: 'notes/gone.md', extension: 'md' }))
        .rejects.toThrow('File not found: notes/gone.md');
    });
  });

  describe('process', () => {
    it('should resolve the DocFile to the vault\'s own TFile before writing', async () => {
      // GIVEN
      const { vault, access } = setup();
      // WHEN
      await access.process({ path: 'notes/a.md', extension: 'md' }, (content) => content);
      // THEN
      expect(vault.calls).toEqual([{ method: 'process', file: VAULT_FILE }]);
    });

    it('should throw when the path is not a file in the vault', async () => {
      // GIVEN
      const { access } = setup();
      // WHEN / THEN
      await expect(access.process({ path: 'notes/gone.md', extension: 'md' }, (content) => content))
        .rejects.toThrow('File not found: notes/gone.md');
    });
  });
});
