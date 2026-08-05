// Public API of obsidian-id-lib.
// `export type` used for type-only exports — consumers compile with
// isolatedModules, where re-exporting a type as a value is an error.

export type { DocFile } from './DocFile';

export type { DocIdService } from './DocIdService';
export { DocIdServiceDefault } from './DocIdService';

export type { DocIdStore, ExistingIdState } from './DocIdStore';
export { DocIdValues } from './DocIdStore';

export type { DocIdGenerator } from './DocIdGenerator';
export {
  DocIdGeneratorDefault,
  DOC_ID_PREFIX,
  DOC_ID_SUFFIX,
  DOC_ID_RANDOM_LENGTH,
} from './DocIdGenerator';

export { FrontmatterDocIdStore } from './FrontmatterDocIdStore';
export { CanvasDocIdStore } from './CanvasDocIdStore';

export type { FileContentAccess } from './FileContentAccess';

export type { PathLock } from './CrossPluginPathLock';
export { CrossPluginPathLock, ID_LOCK_REGISTRY_KEY } from './CrossPluginPathLock';

// Obsidian-backed adapters — the library's only host-API bridgehead.
export { VaultFileContentAccess } from './obsidian/VaultFileContentAccess';
export { DocIdServices } from './obsidian/DocIdServices';
