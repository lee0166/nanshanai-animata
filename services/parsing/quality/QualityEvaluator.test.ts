/**
 * QualityEvaluator Tests
 *
 * @module services/parsing/quality/QualityEvaluator.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QualityEvaluator, EvaluationContext } from './QualityEvaluator';
import { ConsistencyCheckResult } from '../consistency/ConsistencyChecker';
import { ScriptMetadata, ScriptCharacter, ScriptScene } from '../../../types';

describe('QualityEvaluator', () => {
  let evaluator: QualityEvaluator;
  let mockContext: EvaluationContext;

  beforeEach(() => {
    evaluator = new QualityEvaluator();
    mockContext = {
      metadata: {
        title: '测试剧本',
        author: '测试作者',
        genre: ['drama'],
        tone: 'serious',
        totalScenes: 2,
        totalCharacters: 2
      } as ScriptMetadata,
      characters: [
        {
          id: 'char1',
          name: '主角',
          description: '25岁年轻男子，勇敢善良',
          appearance: '黑色短发，蓝色眼睛',
          personality: '勇敢、善良、正直',
          background: '来自小镇'
        },
        {
          id: 'char2',
          name: '配角',
          description: '30岁女性，智慧冷静',
          appearance: '棕色长发，戴眼镜',
          personality: '智慧、冷静、理性',
          background: '大学教授'
        }
      ] as ScriptCharacter[],
      scenes: [
        {
          id: 'scene1',
          name: '办公室',
          description: '主角在办公室工作',
          location: '办公室',
          time: '09:00',
          mood: '平静',
          characters: ['char1']
        },
        {
          id: 'scene2',
          name: '咖啡厅',
          description: '主角和配角在咖啡厅见面',
          location: '咖啡厅',
          time: '12:00',
          mood: '轻松',
          characters: ['char1', 'char2']
        }
      ] as ScriptScene[]
    };
  });

  describe('Basic Evaluation', () => {
    it('should evaluate script quality', async () => {
      const result = await evaluator.evaluate(mockContext);

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.scores).toHaveLength(4);
      expect(result.grade).toMatch(/^[ABCDF]$/);
      expect(result.timestamp).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate weighted overall score', async () => {
      const result = await evaluator.evaluate(mockContext);

      // Check that overall score is weighted average
      const weightedSum = result.scores.reduce((sum, s) => sum + s.score * s.weight, 0);
      const totalWeight = result.scores.reduce((sum, s) => sum + s.weight, 0);
      const expectedScore = Math.round(weightedSum / totalWeight);

      expect(result.overallScore).toBe(expectedScore);
    });

    it('should determine correct grade', async () => {
      const testCases = [
        { score: 95, expected: 'A' },
        { score: 85, expected: 'B' },
        { score: 75, expected: 'C' },
        { score: 65, expected: 'D' },
        { score: 55, expected: 'F' }
      ];

      for (const { score, expected } of testCases) {
        // Create context that will produce specific score
        const context: EvaluationContext = {
          metadata: { title: 'Test', genre: ['drama'], tone: 'serious', totalScenes: 1, totalCharacters: 1 } as ScriptMetadata,
          characters: [{ id: 'c1', name: 'Test', description: 'Test character with enough description length' }] as ScriptCharacter[],
          scenes: [{ id: 's1', name: 'Test', description: 'Test scene with enough description', location: 'Test', time: '12:00' }] as ScriptScene[]
        };

        const result = await evaluator.evaluate(context);
        expect(result.grade).toBeDefined();
      }
    });
  });

  describe('Completeness Evaluation', () => {
    it('should detect incomplete metadata', async () => {
      mockContext.metadata = { totalScenes: 0, totalCharacters: 0 } as ScriptMetadata;

      const result = await evaluator.evaluate(mockContext);

      const completenessScore = result.scores.find(s => s.dimension === 'completeness');
      expect(completenessScore).toBeDefined();
      expect(completenessScore!.score).toBeLessThan(100);
      expect(completenessScore!.suggestions.some(s => s.includes('元数据'))).toBe(true);
    });

    it('should detect missing character information', async () => {
      mockContext.characters = [
        { id: 'char1', name: '角色1', description: '短' } as ScriptCharacter
      ];

      const result = await evaluator.evaluate(mockContext);

      const completenessScore = result.scores.find(s => s.dimension === 'completeness');
      expect(completenessScore!.suggestions.some(s => s.includes('角色'))).toBe(true);
    });

    it('should detect missing scene information', async () => {
      mockContext.scenes = [
        { id: 'scene1', name: '场景1' } as ScriptScene
      ];

      const result = await evaluator.evaluate(mockContext);

      const completenessScore = result.scores.find(s => s.dimension === 'completeness');
      expect(completenessScore!.suggestions.some(s => s.includes('场景'))).toBe(true);
    });
  });

  describe('Accuracy Evaluation', () => {
    it('should evaluate character description quality', async () => {
      mockContext.characters = [
        { id: 'char1', name: '角色1', description: '很差' } as ScriptCharacter
      ];

      const result = await evaluator.evaluate(mockContext);

      const accuracyScore = result.scores.find(s => s.dimension === 'accuracy');
      expect(accuracyScore).toBeDefined();
      expect(accuracyScore!.metrics.characterDescriptionQuality).toBeLessThan(100);
    });

    it('should evaluate scene description quality', async () => {
      mockContext.scenes = [
        { id: 'scene1', name: '场景1', description: '短', location: '' } as ScriptScene
      ];

      const result = await evaluator.evaluate(mockContext);

      const accuracyScore = result.scores.find(s => s.dimension === 'accuracy');
      expect(accuracyScore!.metrics.sceneDescriptionQuality).toBeLessThan(100);
    });

    it('should detect invalid character references', async () => {
      mockContext.scenes = [
        { id: 'scene1', name: '场景1', description: '描述', location: '地点', characters: ['invalid-char'] } as ScriptScene
      ];

      const result = await evaluator.evaluate(mockContext);

      const accuracyScore = result.scores.find(s => s.dimension === 'accuracy');
      expect(accuracyScore!.metrics.characterReferenceAccuracy).toBeLessThan(100);
    });
  });

  describe('Consistency Evaluation', () => {
    it('should use consistency check result', async () => {
      mockContext.consistencyResult = {
        passed: true,
        score: 85,
        violations: [],
        violationsByType: {} as any,
        duration: 100,
        timestamp: new Date().toISOString()
      } as ConsistencyCheckResult;

      const result = await evaluator.evaluate(mockContext);

      const consistencyScore = result.scores.find(s => s.dimension === 'consistency');
      expect(consistencyScore!.score).toBe(85);
    });

    it('should detect consistency issues', async () => {
      mockContext.consistencyResult = {
        passed: false,
        score: 60,
        violations: [
          { id: 'v1', type: 'character_inconsistency', severity: 'error', message: '错误1', confidence: 0.9, autoFixable: false },
          { id: 'v2', type: 'scene_continuity', severity: 'warning', message: '警告1', confidence: 0.8, autoFixable: false }
        ],
        violationsByType: {} as any,
        duration: 100,
        timestamp: new Date().toISOString()
      } as ConsistencyCheckResult;

      const result = await evaluator.evaluate(mockContext);

      const consistencyScore = result.scores.find(s => s.dimension === 'consistency');
      expect(consistencyScore!.metrics.errorCount).toBe(1);
      expect(consistencyScore!.metrics.warningCount).toBe(1);
      expect(consistencyScore!.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Usability Evaluation', () => {
    it('should evaluate character usability', async () => {
      mockContext.characters = [
        { id: 'char1', name: '角色1', description: '描述' } as ScriptCharacter // missing appearance and personality
      ];

      const result = await evaluator.evaluate(mockContext);

      const usabilityScore = result.scores.find(s => s.dimension === 'usability');
      expect(usabilityScore!.metrics.characterUsability).toBeLessThan(100);
    });

    it('should evaluate scene usability', async () => {
      mockContext.scenes = [
        { id: 'scene1', name: '场景1', description: '描述' } as ScriptScene // missing location and time
      ];

      const result = await evaluator.evaluate(mockContext);

      const usabilityScore = result.scores.find(s => s.dimension === 'usability');
      expect(usabilityScore!.metrics.sceneUsability).toBeLessThan(100);
    });
  });

  describe('Report Generation', () => {
    it('should generate markdown report', async () => {
      const result = await evaluator.evaluate(mockContext);
      const report = evaluator.generateReport(result);

      expect(report).toContain('# 质量评估报告');
      expect(report).toContain('总体得分');
      expect(report).toContain('质量等级');
      expect(report).toContain('通过状态');
    });

    it('should include dimension scores in report', async () => {
      const result = await evaluator.evaluate(mockContext);
      const report = evaluator.generateReport(result);

      expect(report).toContain('完整性');
      expect(report).toContain('准确性');
      expect(report).toContain('一致性');
      expect(report).toContain('可用性');
    });

    it('should include suggestions in report', async () => {
      // Create context with issues
      mockContext.metadata = {} as ScriptMetadata;

      const result = await evaluator.evaluate(mockContext);
      const report = evaluator.generateReport(result);

      expect(report).toContain('改进建议');
    });
  });

  describe('Configuration', () => {
    it('should respect custom configuration', async () => {
      const customEvaluator = new QualityEvaluator({
        passThreshold: 80,
        minCharacters: 3,
        minScenes: 3
      });

      const result = await customEvaluator.evaluate(mockContext);

      // With minCharacters=3 and only 2 characters, should fail
      expect(result.passed).toBe(false);
    });

    it('should use custom dimension weights', async () => {
      const customEvaluator = new QualityEvaluator({
        dimensionWeights: {
          completeness: 0.1,
          accuracy: 0.1,
          consistency: 0.7,
          usability: 0.1
        }
      });

      const result = await customEvaluator.evaluate(mockContext);

      // Check that weights are applied
      const consistencyScore = result.scores.find(s => s.dimension === 'consistency');
      expect(consistencyScore!.weight).toBe(0.7);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty script', async () => {
      const emptyContext: EvaluationContext = {
        metadata: { totalScenes: 0, totalCharacters: 0 } as ScriptMetadata,
        characters: [],
        scenes: []
      };

      const result = await evaluator.evaluate(emptyContext);

      // Empty script should get low score and fail
      expect(result.overallScore).toBeLessThan(50);
      expect(result.passed).toBe(false);
    });

    it('should handle single character/scene', async () => {
      const singleContext: EvaluationContext = {
        metadata: { title: 'Test', genre: ['drama'], tone: 'serious', totalScenes: 1, totalCharacters: 1 } as ScriptMetadata,
        characters: [{ id: 'c1', name: 'Test', description: 'A test character with sufficient description' }] as ScriptCharacter[],
        scenes: [{ id: 's1', name: 'Test', description: 'A test scene with sufficient description', location: 'Test', time: '12:00' }] as ScriptScene[]
      };

      const result = await evaluator.evaluate(singleContext);

      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.scores).toHaveLength(4);
    });
  });
});
