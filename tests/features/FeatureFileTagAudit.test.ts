import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { FeatureFileTagAudit } from './FeatureFileTagAudit';

/** Throwaway fixture root — `.tmp/` (gitignored) rather than the system temp dir. */
const SCRATCH_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '.tmp',
);

describe('FeatureFileTagAudit', () => {
  describe('the repo\'s own feature files', () => {
    it('carry no tags outside the permitted vocabulary', () => {
      expect(new FeatureFileTagAudit().violations()).toEqual([]);
    });

    // Without this, a broken glob or a moved directory would make the audit
    // above pass by auditing nothing at all.
    it('are actually found by the audit', () => {
      expect(new FeatureFileTagAudit().auditedFiles()).toEqual([
        'features/domain/doc-id.feature',
        'features/e2e/doc-id.feature',
      ]);
    });
  });

  describe('a feature file carrying a tag', () => {
    const tempDirs: string[] = [];

    afterEach(() => {
      while (tempDirs.length > 0) {
        fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
      }
    });

    function auditOf(featureFileBody: string): FeatureFileTagAudit {
      fs.mkdirSync(SCRATCH_DIR, { recursive: true });
      const root = fs.mkdtempSync(path.join(SCRATCH_DIR, 'tag-audit-'));
      tempDirs.push(root);
      const featuresDir = path.join(root, 'features', 'domain');
      fs.mkdirSync(featuresDir, { recursive: true });
      fs.writeFileSync(path.join(featuresDir, 'probe.feature'), featureFileBody);
      return new FeatureFileTagAudit(path.join(root, 'features'));
    }

    it('is reported', () => {
      const body = 'Feature: Probe\n\n  @skip\n  Scenario: Skipped\n    Given nothing\n';
      expect(auditOf(body).violations()).toEqual([
        { file: 'features/domain/probe.feature', line: 3, tag: '@skip' },
      ]);
    });

    it('is not confused with an email address in prose', () => {
      const body = 'Feature: Probe\n\n  Ask someone@example.com.\n\n  Scenario: Fine\n    Given nothing\n';
      expect(auditOf(body).violations()).toEqual([]);
    });
  });
});
