/// <reference types="vite/client" />

/**
 * The domain tier's single vitest `setupFiles` entry: registers EVERY
 * `*.steps.ts` in this directory.
 *
 * WHY: vitest resolves `setupFiles` entries as literal paths (globs there are
 * silently treated as a missing file), so naming step files one by one in
 * `vitest.config.ts` would make "add a feature" mean "edit the runner config" —
 * a step a contributor has no reason to expect. `import.meta.glob` is Vite's
 * build-time expansion, so the set is still resolved statically.
 */
import.meta.glob('./*.steps.ts', { eager: true });
