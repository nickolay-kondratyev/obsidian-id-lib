import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ARMING_ENV_VAR, E2eReporterWiring, REPORTER_MODULE } from './E2eReporterWiring';

/** Throwaway fixture root — `.tmp/` (gitignored) rather than the system temp dir. */
const SCRATCH_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '.tmp',
);

const ARMED_RUN_SCRIPT = `#!/usr/bin/env bash\nexport ${ARMING_ENV_VAR}=1\nexec npx playwright test\n`;
const ARMED_CONFIG = `process.env['${ARMING_ENV_VAR}'] ? [['${REPORTER_MODULE}']] : [];\n`;

describe('E2eReporterWiring', () => {
  describe("the repo's own e2e wiring", () => {
    it('arms the scenario-count reporter', () => {
      expect(new E2eReporterWiring().gaps()).toEqual([]);
    });
  });

  describe('a repo whose wiring is broken', () => {
    const tempDirs: string[] = [];

    afterEach(() => {
      while (tempDirs.length > 0) {
        fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
      }
    });

    function wiringOf(runScript: string, config: string): E2eReporterWiring {
      fs.mkdirSync(SCRATCH_DIR, { recursive: true });
      const root = fs.mkdtempSync(path.join(SCRATCH_DIR, 'reporter-wiring-'));
      tempDirs.push(root);
      fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
      fs.mkdirSync(path.join(root, 'e2e'), { recursive: true });
      fs.writeFileSync(path.join(root, 'scripts', 'run-e2e.sh'), runScript);
      fs.writeFileSync(path.join(root, 'e2e', 'playwright.config.ts'), config);
      return new E2eReporterWiring(root);
    }

    it('is fully armed when both files wire it', () => {
      expect(wiringOf(ARMED_RUN_SCRIPT, ARMED_CONFIG).gaps()).toEqual([]);
    });

    it('flags a run script that never exports the arming env var', () => {
      const disarmed = '#!/usr/bin/env bash\nexec npx playwright test\n';
      expect(wiringOf(disarmed, ARMED_CONFIG).gaps()).toEqual([
        { file: 'scripts/run-e2e.sh', problem: expect.stringContaining(ARMING_ENV_VAR) },
      ]);
    });

    it('flags a config that never references the reporter module', () => {
      const withoutReporter = `process.env['${ARMING_ENV_VAR}'] ? [] : [];\n`;
      expect(wiringOf(ARMED_RUN_SCRIPT, withoutReporter).gaps()).toEqual([
        { file: 'e2e/playwright.config.ts', problem: expect.stringContaining(REPORTER_MODULE) },
      ]);
    });
  });
});
