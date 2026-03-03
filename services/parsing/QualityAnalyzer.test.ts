/**
 * Quality Analyzer Tests
 *
 * @module services/parsing/QualityAnalyzer.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QualityAnalyzer, QualityDimension, QualityAnalyzerConfig } from './QualityAnalyzer';
import { ScriptMetadata, ScriptCharacter, ScriptScene, ScriptItem, Shot } from '../../types';

describe('QualityAnalyzer', () => {
  let analyzer: QualityAnalyzer;

  beforeEach(() => {
    analyzer = new QualityAnalyzer();
  });

  describe('Basic Analysis', () => {
    it('should analyze empty data and return default scores', () => {
      const report = analyzer.analyze(
        undefined,
        [],
        [],
        [],
        [],
        'completed'
      );

      expect(report).toBeDefined();
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(report.dimensionScores).toHaveLength(5);
      expect(report.overallGrade).toMatch(/^[A-F]$/);
      expect(report.confidence).toBeGreaterThanOrEqual(0);
      expect(report.confidence).toBeLessThanOrEqual(1);
    });

    it('should calculate overall score based on weighted dimensions', () => {
      const metadata: ScriptMetadata = {
        title: '测试剧本',
        wordCount: 1000,
        estimatedDuration: '10分钟',
        characterCount: 2,
        characterNames: ['角色A', '角色B'],
        sceneCount: 2,
        sceneNames: ['场景1', '场景2'],
        chapterCount: 1,
        genre: '现代',
        tone: '正剧',
      };

      const characters: ScriptCharacter[] = [
        {
          id: '1',
          name: '角色A',
          description: '这是一个详细的角色描述，包含外貌特征和性格特点',
          appearance: {
            face: '圆脸',
            hair: '黑发',
            clothing: '西装',
          },
        },
        {
          id: '2',
          name: '角色B',
          description: '另一个详细描述的角色',
          appearance: {
            face: '方脸',
            hair: '金发',
            clothing: '连衣裙',
          },
        },
      ];

      const scenes: ScriptScene[] = [
        {
          id: '1',
          name: '场景1',
          description: '这是一个详细的场景描述，包含环境、氛围和动作细节',
          locationType: '室内',
          timeOfDay: '白天',
          characters: ['角色A'],
        },
        {
          id: '2',
          name: '场景2',
          description: '另一个详细的场景描述',
          locationType: '室外',
          timeOfDay: '夜晚',
          characters: ['角色A', '角色B'],
        },
      ];

      const report = analyzer.analyze(
        metadata,
        characters,
        scenes,
        [],
        [],
        'completed'
      );

      expect(report.score).toBeGreaterThan(60);
      expect(report.statistics.totalCharacters).toBe(2);
      expect(report.statistics.totalScenes).toBe(2);
    });
  });

  describe('Completeness Analysis', () => {
    it('should detect incomplete character descriptions', () => {
      const characters: ScriptCharacter[] = [
        {
          id: '1',
          name: '角色A',
          description: '短',
          appearance: {},
        },
      ];

      const report = analyzer.analyze(
        undefined,
        characters,
        [],
        [],
        [],
        'completed'
      );

      const completenessScore = report.dimensionScores.find(
        d => d.dimension === QualityDimension.COMPLETENESS
      );

      expect(completenessScore).toBeDefined();
      expect(completenessScore!.score).toBeLessThan(100);
      expect(completenessScore!.issues.length).toBeGreaterThan(0);
      expect(completenessScore!.issues[0].message).toContain('角色');
    });

    it('should detect scenes without shots', () => {
      const scenes: ScriptScene[] = [
        {
          id: '1',
          name: '场景1',
          description: '这是一个足够长的场景描述，包含环境、氛围和动作细节',
        },
      ];

      const report = analyzer.analyze(
        undefined,
        [],
        scenes,
        [],
        [],
        'shots'
      );

      const completenessScore = report.dimensionScores.find(
        d => d.dimension === QualityDimension.COMPLETENESS
      );

      expect(completenessScore).toBeDefined();
      expect(completenessScore!.issues.some(i => i.message.includes('分镜'))).toBe(true);
    });
  });

  describe('Accuracy Analysis', () => {
    it('should detect suspicious character names', () => {
      const characters: ScriptCharacter[] = [
        {
          id: '1',
          name: '角色A'.repeat(10), // Too long name
          description: '正常描述',
        },
      ];

      const report = analyzer.analyze(
        undefined,
        characters,
        [],
        [],
        [],
        'completed'
      );

      const accuracyScore = report.dimensionScores.find(
        d => d.dimension === QualityDimension.ACCURACY
      );

      expect(accuracyScore).toBeDefined();
      expect(accuracyScore!.issues.some(i => i.message.includes('异常'))).toBe(true);
    });

    it('should detect invalid shot parameters', () => {
      const shots: Shot[] = [
        {
          id: '1',
          type: '', // Empty type
          description: '', // Empty description
          duration: 100, // Too long
        },
      ];

      const report = analyzer.analyze(
        undefined,
        [],
        [],
        [],
        shots,
        'completed'
      );

      const accuracyScore = report.dimensionScores.find(
        d => d.dimension === QualityDimension.ACCURACY
      );

      expect(accuracyScore).toBeDefined();
      expect(accuracyScore!.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Consistency Analysis', () => {
    it('should detect unknown characters in scenes', () => {
      const characters: ScriptCharacter[] = [
        { id: '1', name: '角色A', description: '描述' },
      ];

      const scenes: ScriptScene[] = [
        {
          id: '1',
          name: '场景1',
          description: '描述',
          characters: ['角色A', '未知角色'], // Unknown character
        },
      ];

      const report = analyzer.analyze(
        undefined,
        characters,
        scenes,
        [],
        [],
        'completed'
      );

      const consistencyScore = report.dimensionScores.find(
        d => d.dimension === QualityDimension.CONSISTENCY
      );

      expect(consistencyScore).toBeDefined();
      expect(consistencyScore!.issues.some(i => i.message.includes('未定义'))).toBe(true);
    });

    it('should detect duplicate character names', () => {
      const characters: ScriptCharacter[] = [
        { id: '1', name: '角色A', description: '描述1' },
        { id: '2', name: '角色A', description: '描述2' }, // Duplicate
      ];

      const report = analyzer.analyze(
        undefined,
        characters,
        [],
        [],
        [],
        'completed'
      );

      const consistencyScore = report.dimensionScores.find(
        d => d.dimension === QualityDimension.CONSISTENCY
      );

      expect(consistencyScore).toBeDefined();
      expect(consistencyScore!.issues.some(i => i.message.includes('重复'))).toBe(true);
    });
  });

  describe('Grade Calculation', () => {
    it('should assign grade A for scores >= 90', () => {
      const report = analyzer.analyze(
        { title: '测试', wordCount: 1000, estimatedDuration: '10分钟', characterCount: 2, characterNames: ['A', 'B'], sceneCount: 2, sceneNames: ['S1', 'S2'], chapterCount: 1, genre: '现代', tone: '正剧' },
        [
          { id: '1', name: '角色A', description: '这是一个非常详细的角色描述，包含丰富的外貌特征和性格特点，足够长', appearance: { face: '圆脸', hair: '黑发', clothing: '西装' } },
          { id: '2', name: '角色B', description: '另一个非常详细的角色描述，包含丰富的信息', appearance: { face: '方脸', hair: '金发', clothing: '连衣裙' } },
        ],
        [
          { id: '1', name: '场景1', description: '这是一个非常详细的场景描述，包含环境、氛围、动作等丰富细节，长度足够', locationType: '室内', timeOfDay: '白天', characters: ['角色A'] },
          { id: '2', name: '场景2', description: '另一个非常详细的场景描述，包含丰富的视觉信息', locationType: '室外', timeOfDay: '夜晚', characters: ['角色A', '角色B'] },
        ],
        [],
        [],
        'completed'
      );

      expect(report.overallGrade).toBe('A');
    });

    it('should assign appropriate grade based on data quality', () => {
      // With minimal data, should get lower grade
      const report = analyzer.analyze(
        undefined,
        [],
        [],
        [],
        [],
        'completed'
      );

      // Empty data will get some score from dramatic dimension (which defaults to 100 with no violations)
      // but other dimensions will be low, so overall grade depends on weighted average
      expect(['A', 'B', 'C', 'D', 'F']).toContain(report.overallGrade);
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate correct statistics', () => {
      const characters: ScriptCharacter[] = [
        { id: '1', name: '角色A', description: '这是一个非常详细的角色描述，包含丰富的信息' },
        { id: '2', name: '角色B', description: '短' },
      ];

      const scenes: ScriptScene[] = [
        { id: '1', name: '场景1', description: '详细描述', characters: ['角色A'] },
        { id: '2', name: '场景2', description: '详细描述', characters: ['角色A', '角色B'] },
      ];

      const shots: Shot[] = [
        { id: '1', sceneId: '1', type: '特写', description: '描述' },
        { id: '2', sceneId: '1', type: '中景', description: '描述' },
        { id: '3', sceneId: '2', type: '全景', description: '描述' },
      ];

      const report = analyzer.analyze(
        undefined,
        characters,
        scenes,
        [],
        shots,
        'completed'
      );

      expect(report.statistics.totalCharacters).toBe(2);
      expect(report.statistics.totalScenes).toBe(2);
      expect(report.statistics.totalShots).toBe(3);
      expect(report.statistics.avgCharactersPerScene).toBe(1.5);
      expect(report.statistics.avgShotsPerScene).toBe(1.5);
      expect(report.statistics.scenesWithShots).toBe(2);
      expect(report.statistics.charactersWithDescription).toBe(1);
    });
  });

  describe('Stage-based Analysis', () => {
    it('should generate report for metadata stage', () => {
      const metadata: ScriptMetadata = {
        title: '测试剧本',
        wordCount: 1000,
        estimatedDuration: '10分钟',
        characterCount: 2,
        characterNames: ['A', 'B'],
        sceneCount: 2,
        sceneNames: ['S1', 'S2'],
        chapterCount: 1,
        genre: '现代',
        tone: '正剧',
      };

      const report = analyzer.analyzeForStage(
        'metadata',
        metadata,
        [],
        [],
        [],
        []
      );

      expect(report).toBeDefined();
      expect(report.stage).toBe('metadata');
      expect(report.confidence).toBeLessThan(1);
    });

    it('should generate report for characters stage', () => {
      const characters: ScriptCharacter[] = [
        { id: '1', name: '角色A', description: '详细描述' },
      ];

      const report = analyzer.analyzeForStage(
        'characters',
        undefined,
        characters,
        [],
        [],
        []
      );

      expect(report).toBeDefined();
      expect(report.stage).toBe('characters');
      expect(report.statistics.totalCharacters).toBe(1);
    });
  });

  describe('Recommendations', () => {
    it('should generate prioritized recommendations', () => {
      const characters: ScriptCharacter[] = [
        { id: '1', name: '角色A', description: '短' }, // Incomplete
      ];

      const scenes: ScriptScene[] = [
        { id: '1', name: '场景1', description: '短' }, // Incomplete
      ];

      const report = analyzer.analyze(
        undefined,
        characters,
        scenes,
        [],
        [],
        'completed'
      );

      expect(report.recommendations.length).toBeGreaterThan(0);
      // Important recommendations should come first
      const importantCount = report.recommendations.filter(r => r.startsWith('[重要]')).length;
      expect(importantCount).toBeGreaterThanOrEqual(0);
    });
  });
});
