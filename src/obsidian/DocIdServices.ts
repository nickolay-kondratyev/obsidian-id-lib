// `import type` so this module erases to zero host imports at runtime — see the
// same note in VaultFileContentAccess.ts.
import type { Vault } from 'obsidian';
import { DocIdService, DocIdServiceDefault } from '../DocIdService';
import { DocIdGeneratorDefault } from '../DocIdGenerator';
import { FrontmatterDocIdStore } from '../FrontmatterDocIdStore';
import { CanvasDocIdStore } from '../CanvasDocIdStore';
import { VaultFileContentAccess } from './VaultFileContentAccess';
import { CrossPluginPathLock } from '../CrossPluginPathLock';

/** Static factory for the default production wiring. */
export class DocIdServices {
  private constructor() {
  }

  /**
   * Wires generator + both stores + the cross-plugin window lock.
   * One-line adoption: `DocIdServices.createDefault(app.vault)`.
   */
  static createDefault(vault: Vault): DocIdService {
    const fileContentAccess = new VaultFileContentAccess(vault);
    const docIdGenerator = new DocIdGeneratorDefault();
    return new DocIdServiceDefault(
      new FrontmatterDocIdStore(fileContentAccess, docIdGenerator),
      new CanvasDocIdStore(fileContentAccess, docIdGenerator),
      new CrossPluginPathLock(),
    );
  }
}
