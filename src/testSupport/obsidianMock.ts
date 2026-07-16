// Minimal runtime stand-in for the 'obsidian' npm package.
//
// WHY: the 'obsidian' npm package ships type declarations only — there is no
// runtime JS to import in unit tests. vitest.config.ts aliases 'obsidian' to
// this file so classes like TFile exist at runtime (incl. instanceof checks).
//
// Only contains what unit tests actually touch. Production code still compiles
// against the real 'obsidian' type declarations.

export class TAbstractFile {
  path = '';
  name = '';
}

export class TFile extends TAbstractFile {
  basename = '';
  extension = '';
  stat = { ctime: 0, mtime: 0, size: 0 };
}
