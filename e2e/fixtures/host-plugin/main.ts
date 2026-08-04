import { Plugin } from 'obsidian';
// Import the LIBRARY SOURCE (not the published package) so e2e exercises the
// working tree.
import { DocIdServices } from '../../../src/index';
import type { DocIdService } from '../../../src/index';

/**
 * Test-only Obsidian plugin. Its ONLY job is to construct the library exactly
 * as a real consumer does and expose it on the plugin instance, which the
 * harness reaches via `app.plugins.plugins[<id>].docIdService`.
 *
 * Keep this DUMB: no logic, no convenience wrappers. Anything clever here is
 * logic the e2e suite would be testing instead of the library.
 */
export default class ObsidianIdLibE2eHost extends Plugin {
  docIdService!: DocIdService;

  override onload(): void {
    this.docIdService = DocIdServices.createDefault(this.app.vault);
  }
}
