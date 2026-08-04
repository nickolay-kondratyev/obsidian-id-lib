// Bundles the test-only host plugin (which wraps the library source) into a
// loadable Obsidian plugin under .tmp/. Run by scripts/run-e2e.sh; the harness
// copies the output into the throwaway vault.
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import * as esbuild from 'esbuild';

const OUT_DIR = '.tmp/host-plugin';

// Rebuild from empty: the whole dir is copied verbatim into the throwaway vault,
// so anything left behind by an older build would be loaded as if it were current.
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

await esbuild.build({
  entryPoints: ['e2e/fixtures/host-plugin/main.ts'],
  bundle: true,
  // Obsidian loads plugins as CommonJS with a `default` export class.
  format: 'cjs',
  platform: 'browser',
  target: 'es2021',
  // Provided by the app at runtime — must NEVER be bundled.
  external: ['obsidian', 'electron'],
  outfile: `${OUT_DIR}/main.js`,
});

// The manifest must sit beside main.js for Obsidian to load the plugin.
copyFileSync('e2e/fixtures/host-plugin/manifest.json', `${OUT_DIR}/manifest.json`);
