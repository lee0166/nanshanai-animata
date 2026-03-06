import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IterativeRefinementEngine,
  IterativeRefinementConfig,
  IterativeRefinementResult,
} from './IterativeRefinementEngine';
import { ScriptMetadata, ScriptCharacter, ScriptScene } from '../../../types';

describe('IterativeRefinementEngine', () => {
  let engine: IterativeRefinementEngine;
  let config: Partial<IterativeRefinementConfig>;
  let metadata: ScriptMetadata;
  let characters: ScriptCharacter[];
  let scenes: ScriptScene[];

  beforeEach(() => {
    config = {
      maxIterations: 3,
      targetQualityScore: 80,
      minImprovementThreshold: 1,
      autoApplySafeRefinements: true,
      confidenceThreshold: 0.7,
      verboseLogging: false,
    };

    engine = new IterativeRefinementEngine(config);

    metadata = {
      title: '测试剧本',
      format: 'movie',
      characters: [],
      scenes: [],
    } as ScriptMetadata;

    characters = [
      { id: 'char-1', name: '张三', description: '主角', importance: 'major' },
      { id: 'char-2', name: '李四', description: '配角', importance: 'minor' },
    ];

    scenes = [
      { id: 'scene-1', title: '场景一', description: '开场', characters: ['张三'] },
      { id: 'scene-2', title: '场景二', description: '发展', characters: ['张三', '李四'] },
    ];
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const defaultEngine = new IterativeRefinementEngine();
      expect(defaultEngine).toBeDefined();
      expect(defaultEngine.getConfig().maxIterations).toBe(5);
    });

    it('should merge custom config with defaults', () => {
      const customEngine = new IterativeRefinementEngine({
        maxIterations: 10,
        targetQualityScore: 90,
      });
      expect(customEngine.getConfig().maxIterations).toBe(10);
      expect(customEngine.getConfig().targetQualityScore).toBe(90);
    });
  });

  describe('refine', () => {
    it('should execute refinement process', async () => {
      const result = await engine.refine(metadata, characters, scenes);

      expect(result).toBeDefined();
      expect(result.totalIterations).toBeGreaterThan(0);
      expect(result.initialQualityScore).toBeDefined();
      expect(result.finalQualityScore).toBeDefined();
    });

    it('should return iteration results', async () => {
      const result = await engine.refine(metadata, characters, scenes);

      expect(result.iterationResults).toBeDefined();
      expect(result.iterationResults.length).toBeGreaterThan(0);
    });

    it('should generate a report', async () => {
      const result = await engine.refine(metadata, characters, scenes);

      expect(result.report).toBeDefined();
      expect(result.report.length).toBeGreaterThan(0);
    });

    it('should include stats', async () => {
      const result = await engine.refine(metadata, characters, scenes);

      expect(result.stats).toBeDefined();
      expect(result.stats.totalChecks).toBeGreaterThanOrEqual(0);
    });

    it('should stop at max iterations', async () => {
      const limitedEngine = new IterativeRefinementEngine({
        maxIterations: 2,
        verboseLogging: false,
      });

      const result = await limitedEngine.refine(metadata, characters, scenes);

      expect(result.totalIterations).toBeLessThanOrEqual(2);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      engine.updateConfig({ maxIterations: 10 });
      expect(engine.getConfig().maxIterations).toBe(10);
    });

    it('should merge partial config', () => {
      const originalTargetScore = engine.getConfig().targetQualityScore;
      engine.updateConfig({ maxIterations: 8 });
      expect(engine.getConfig().maxIterations).toBe(8);
      expect(engine.getConfig().targetQualityScore).toBe(originalTargetScore);
    });
  });

  describe('getConfig', () => {
    it('should return current config', () => {
      const config = engine.getConfig();
      expect(config).toBeDefined();
      expect(config.maxIterations).toBe(3);
    });

    it('should return a copy of config', () => {
      const config1 = engine.getConfig();
      const config2 = engine.getConfig();
      expect(config1).not.toBe(config2);
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = engine.getStats();
      expect(stats.totalChecks).toBe(0);
      expect(stats.totalActionsApplied).toBe(0);
    });

    it('should return a copy of stats', () => {
      const stats1 = engine.getStats();
      const stats2 = engine.getStats();
      expect(stats1).not.toBe(stats2);
    });
  });

  describe('resetStats', () => {
    it('should reset statistics', async () => {
      // Run a refinement to generate some stats
      await engine.refine(metadata, characters, scenes);
      expect(engine.getStats().totalChecks).toBeGreaterThan(0);

      // Reset stats
      engine.resetStats();
      expect(engine.getStats().totalChecks).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty characters', async () => {
      const result = await engine.refine(metadata, [], scenes);
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should handle empty scenes', async () => {
      const result = await engine.refine(metadata, characters, []);
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should handle minimal metadata', async () => {
      const minimalMetadata = { title: '', format: 'movie' } as ScriptMetadata;
      const result = await engine.refine(minimalMetadata, characters, scenes);
      expect(result).toBeDefined();
    });

    it('should handle very low target score', async () => {
      const lowTargetEngine = new IterativeRefinementEngine({
        targetQualityScore: 10,
        maxIterations: 2,
        verboseLogging: false,
      });

      const result = await lowTargetEngine.refine(metadata, characters, scenes);
      expect(result).toBeDefined();
    });

    it('should handle very high target score', async () => {
      const highTargetEngine = new IterativeRefinementEngine({
        targetQualityScore: 99,
        maxIterations: 2,
        verboseLogging: false,
      });

      const result = await highTargetEngine.refine(metadata, characters, scenes);
      expect(result).toBeDefined();
    });
  });

  describe('iteration results', () => {
    it('should include consistency results in each iteration', async () => {
      const result = await engine.refine(metadata, characters, scenes);

      for (const iteration of result.iterationResults) {
        expect(iteration.consistencyResult).toBeDefined();
        expect(iteration.consistencyResult.violations).toBeDefined();
      }
    });

    it('should include quality results in each iteration', async () => {
      const result = await engine.refine(metadata, characters, scenes);

      for (const iteration of result.iterationResults) {
        expect(iteration.qualityResult).toBeDefined();
        expect(iteration.qualityResult.overallScore).toBeDefined();
      }
    });

    it('should include refinement results in each iteration', async () => {
      const result = await engine.refine(metadata, characters, scenes);

      for (const iteration of result.iterationResults) {
        expect(iteration.refinementResult).toBeDefined();
        expect(iteration.refinementResult.appliedActions).toBeDefined();
        expect(iteration.refinementResult.skippedActions).toBeDefined();
      }
    });

    it('should track improvement in each iteration', async () => {
      const result = await engine.refine(metadata, characters, scenes);

      for (const iteration of result.iterationResults) {
        expect(iteration.improvement).toBeDefined();
        expect(iteration.qualityScoreBefore).toBeDefined();
        expect(iteration.qualityScoreAfter).toBeDefined();
      }
    });
  });
});
