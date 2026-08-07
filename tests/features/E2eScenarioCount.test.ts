import { describe, expect, it } from 'vitest';
import {
  NonEnglishFeatureError,
  countScenariosInFeature,
  countScenariosOnDisk,
} from '../../e2e/scenarioCount';

/**
 * Unit tests for the disk-side scenario counter behind the e2e reconciler.
 * These grind the counting rule; the reconciler's wiring is proved separately
 * by E2eReporterWiring.test.ts. See docs-internal/bdd-testing-strategy.md.
 */
describe('countScenariosInFeature', () => {
  describe('a plain scenario', () => {
    it('counts once', () => {
      const body = 'Feature: F\n\n  Scenario: One\n    Given a thing\n';
      expect(countScenariosInFeature(body, 'f.feature')).toBe(1);
    });
  });

  describe('two scenarios', () => {
    it('count twice', () => {
      const body =
        'Feature: F\n\n  Scenario: One\n    Given a thing\n\n  Scenario: Two\n    Given a thing\n';
      expect(countScenariosInFeature(body, 'f.feature')).toBe(2);
    });
  });

  describe('a scenario outline', () => {
    // playwright-bdd instantiates one spec per Examples DATA row, never the
    // header — the counter must expand the same way or the reconciler drifts.
    it('counts one per examples data row', () => {
      const body =
        'Feature: F\n\n  Scenario Outline: Each\n    Given <n>\n\n    Examples:\n      | n |\n      | 1 |\n      | 2 |\n      | 3 |\n';
      expect(countScenariosInFeature(body, 'f.feature')).toBe(3);
    });
  });

  describe('scenarios nested under a Rule', () => {
    it('are counted', () => {
      const body =
        'Feature: F\n\n  Rule: R\n\n    Scenario: One\n      Given a thing\n\n    Scenario: Two\n      Given a thing\n';
      expect(countScenariosInFeature(body, 'f.feature')).toBe(2);
    });
  });

  describe('a Background', () => {
    it('adds no scenarios of its own', () => {
      const body =
        'Feature: F\n\n  Background:\n    Given setup\n\n  Scenario: One\n    Given a thing\n';
      expect(countScenariosInFeature(body, 'f.feature')).toBe(1);
    });
  });

  describe('a non-English dialect', () => {
    // The reconciler reads English only, and REPORTS anything else rather than
    // miscounting localised keywords it does not recognise.
    it('is refused, not miscounted', () => {
      const body = '# language: fr\nFonctionnalité: F\n\n  Scénario: Un\n    Soit une chose\n';
      expect(() => countScenariosInFeature(body, 'f.feature')).toThrow(NonEnglishFeatureError);
    });
  });
});

describe('countScenariosOnDisk', () => {
  describe("the repo's own features/e2e", () => {
    // Anchors the reconciler to the real tree: this must move in lockstep with
    // features/e2e/*.feature (currently a single scenario).
    it('totals the scenarios on disk', () => {
      expect(countScenariosOnDisk().total).toBe(1);
    });
  });
});
