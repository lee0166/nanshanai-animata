/**
 * ScreenplayStructureAnalyzer 单元测试
 */

import { describe, it, expect } from 'vitest';
import { ScreenplayStructureAnalyzer } from './ScreenplayStructureAnalyzer';
import type { StoryStructure, EmotionalPoint } from '../../../../types';

const analyzer = new ScreenplayStructureAnalyzer();

describe('ScreenplayStructureAnalyzer', () => {
  // 创建测试用的 StoryStructure
  const createMockStructure = (overrides?: Partial<StoryStructure>): StoryStructure => ({
    structureType: 'three_act',
    act1: '主角介绍，日常生活',
    act2a: '冲突开始，踏上旅程',
    act2b: '面对困难，内心挣扎',
    act3: '最终决战，解决问题',
    midpoint: '发现真相，世界观崩塌',
    climax: '与反派最终对决',
    ...overrides,
  });

  // 创建测试用的 EmotionalPoint
  const createMockEmotionalArc = (): EmotionalPoint[] => [
    { plotPoint: '开场', emotion: '平静', intensity: 3, colorTone: '明亮', percentage: 0 },
    { plotPoint: '催化剂', emotion: '紧张', intensity: 6, colorTone: '阴暗', percentage: 15 },
    { plotPoint: '中点转折', emotion: '焦虑', intensity: 8, colorTone: '冷色', percentage: 50 },
    { plotPoint: '高潮', emotion: '激动', intensity: 10, colorTone: '鲜艳', percentage: 85 },
    { plotPoint: '结局', emotion: '喜悦', intensity: 5, colorTone: '温暖', percentage: 100 },
  ];

  describe('analyze', () => {
    it('应该正确分析剧本结构', () => {
      const structure = createMockStructure();
      const emotionalArc = createMockEmotionalArc();
      const wordCount = 10000;

      const result = analyzer.analyze(structure, emotionalArc, wordCount);

      // 验证返回结构
      expect(result).toHaveProperty('structure');
      expect(result).toHaveProperty('actLengths');
      expect(result).toHaveProperty('pacingAnalysis');
      expect(result).toHaveProperty('structureScore');

      // 验证幕长度
      expect(result.actLengths).toHaveProperty('act1');
      expect(result.actLengths).toHaveProperty('act2a');
      expect(result.actLengths).toHaveProperty('act2b');
      expect(result.actLengths).toHaveProperty('act3');

      // 验证节奏分析
      expect(result.pacingAnalysis).toHaveProperty('tensionCurve');
      expect(result.pacingAnalysis).toHaveProperty('turningPoints');
      expect(result.pacingAnalysis).toHaveProperty('pacingDescription');
      expect(result.pacingAnalysis).toHaveProperty('climaxPosition');

      // 验证结构评分
      expect(result.structureScore).toHaveProperty('overall');
      expect(result.structureScore).toHaveProperty('completeness');
      expect(result.structureScore).toHaveProperty('balance');
      expect(result.structureScore).toHaveProperty('emotionalArc');
    });

    it('应该正确计算幕长度（三幕式）', () => {
      const structure = createMockStructure({ structureType: 'three_act' });
      const emotionalArc = createMockEmotionalArc();
      const wordCount = 10000;

      const result = analyzer.analyze(structure, emotionalArc, wordCount);

      // 三幕式各占25%
      expect(result.actLengths.act1.percentage).toBe(25);
      expect(result.actLengths.act2a.percentage).toBe(25);
      expect(result.actLengths.act2b.percentage).toBe(25);
      expect(result.actLengths.act3.percentage).toBe(25);

      // 验证字数计算
      expect(result.actLengths.act1.wordCount).toBe(2500);
      expect(result.actLengths.act2a.wordCount).toBe(2500);
      expect(result.actLengths.act2b.wordCount).toBe(2500);
      expect(result.actLengths.act3.wordCount).toBe(2500);
    });

    it('应该正确计算幕长度（英雄之旅）', () => {
      const structure = createMockStructure({ structureType: 'hero_journey' });
      const emotionalArc = createMockEmotionalArc();
      const wordCount = 10000;

      const result = analyzer.analyze(structure, emotionalArc, wordCount);

      // 英雄之旅：启程(20%)、启蒙(60%)、归来(20%)
      expect(result.actLengths.act1.percentage).toBe(20);
      expect(result.actLengths.act2a.percentage).toBe(30);
      expect(result.actLengths.act2b.percentage).toBe(30);
      expect(result.actLengths.act3.percentage).toBe(20);
    });

    it('应该正确识别转折点', () => {
      const structure = createMockStructure();
      const emotionalArc: EmotionalPoint[] = [
        { plotPoint: '开场', emotion: '平静', intensity: 3, colorTone: '明亮', percentage: 0 },
        { plotPoint: '催化剂', emotion: '紧张', intensity: 6, colorTone: '阴暗', percentage: 15 },
        { plotPoint: '中点转折', emotion: '焦虑', intensity: 8, colorTone: '冷色', percentage: 50 },
        { plotPoint: '高潮对决', emotion: '激动', intensity: 10, colorTone: '鲜艳', percentage: 85 },
        { plotPoint: '危机时刻', emotion: '恐惧', intensity: 9, colorTone: '阴暗', percentage: 90 },
        { plotPoint: '结局', emotion: '喜悦', intensity: 5, colorTone: '温暖', percentage: 100 },
      ];

      const result = analyzer.analyze(structure, emotionalArc, 10000);

      // 应该识别出包含关键词的转折点
      expect(result.pacingAnalysis.turningPoints).toContain('催化剂');
      expect(result.pacingAnalysis.turningPoints).toContain('中点转折');
      expect(result.pacingAnalysis.turningPoints).toContain('高潮对决');
      expect(result.pacingAnalysis.turningPoints).toContain('危机时刻');
    });

    it('应该正确计算高潮位置', () => {
      const structure = createMockStructure();
      const emotionalArc: EmotionalPoint[] = [
        { plotPoint: '开场', emotion: '平静', intensity: 3, colorTone: '明亮', percentage: 0 },
        { plotPoint: '发展', emotion: '紧张', intensity: 6, colorTone: '阴暗', percentage: 50 },
        { plotPoint: '高潮', emotion: '激动', intensity: 10, colorTone: '鲜艳', percentage: 75 },
        { plotPoint: '结局', emotion: '喜悦', intensity: 5, colorTone: '温暖', percentage: 100 },
      ];

      const result = analyzer.analyze(structure, emotionalArc, 10000);

      // 高潮在索引2，共4个点，位置应该是 2/4 = 50%
      expect(result.pacingAnalysis.climaxPosition).toBe(50);
    });

    it('应该正确计算结构完整性', () => {
      const structure = createMockStructure({
        act1: '第一幕内容',
        act2a: '第二幕上内容',
        act2b: '第二幕下内容',
        act3: '第三幕内容',
        midpoint: '中点转折',
        climax: '高潮',
      });

      const result = analyzer.analyze(structure, [], 10000);

      // 所有字段都有值，完整性应该是100
      expect(result.structureScore.completeness).toBe(100);
    });

    it('应该正确计算结构完整性（部分缺失）', () => {
      const structure = createMockStructure({
        act1: '第一幕内容',
        act2a: '',
        act2b: '第二幕下内容',
        act3: '',
        midpoint: '中点转折',
        climax: '',
      });

      const result = analyzer.analyze(structure, [], 10000);

      // 6个字段中只有3个有值，完整性应该是50
      expect(result.structureScore.completeness).toBe(50);
    });

    it('应该正确计算情绪曲线评分', () => {
      const structure = createMockStructure();
      const emotionalArc: EmotionalPoint[] = [
        { plotPoint: '开场', emotion: '平静', intensity: 1, colorTone: '明亮', percentage: 0 },
        { plotPoint: '发展', emotion: '紧张', intensity: 5, colorTone: '阴暗', percentage: 50 },
        { plotPoint: '高潮', emotion: '激动', intensity: 10, colorTone: '鲜艳', percentage: 75 },
        { plotPoint: '结局', emotion: '喜悦', intensity: 3, colorTone: '温暖', percentage: 100 },
      ];

      const result = analyzer.analyze(structure, emotionalArc, 10000);

      // 4个情绪点 + 强度范围9 + 有高潮(>=8)
      // 30 + 35 + 35 = 100
      expect(result.structureScore.emotionalArc).toBe(100);
    });

    it('应该正确处理空 emotionalArc', () => {
      const structure = createMockStructure();
      const result = analyzer.analyze(structure, [], 10000);

      expect(result.pacingAnalysis.tensionCurve).toHaveLength(0);
      expect(result.pacingAnalysis.pacingDescription).toBe('无情绪曲线数据');
      expect(result.pacingAnalysis.climaxPosition).toBe(0);
      expect(result.structureScore.emotionalArc).toBe(0);
    });

    it('应该正确生成节奏描述', () => {
      const structure = createMockStructure();
      const emotionalArc: EmotionalPoint[] = [
        { plotPoint: '开场', emotion: '平静', intensity: 2, colorTone: '明亮', percentage: 0 },
        { plotPoint: '发展', emotion: '紧张', intensity: 4, colorTone: '阴暗', percentage: 50 },
        { plotPoint: '结局', emotion: '喜悦', intensity: 3, colorTone: '温暖', percentage: 100 },
      ];

      const result = analyzer.analyze(structure, emotionalArc, 10000);

      // 平均强度较低，应该描述为平缓
      expect(result.pacingAnalysis.pacingDescription).toContain('平缓');
    });
  });

  describe('getStructureTypeDisplayName', () => {
    it('应该返回正确的结构类型名称', () => {
      expect(analyzer.getStructureTypeDisplayName('three_act')).toBe('三幕式结构');
      expect(analyzer.getStructureTypeDisplayName('hero_journey')).toBe('英雄之旅');
      expect(analyzer.getStructureTypeDisplayName('five_act')).toBe('五幕式结构');
      expect(analyzer.getStructureTypeDisplayName('other')).toBe('其他结构');
      expect(analyzer.getStructureTypeDisplayName('unknown')).toBe('未知结构');
    });
  });

  describe('getStructureTypeDescription', () => {
    it('应该返回正确的结构类型描述', () => {
      expect(analyzer.getStructureTypeDescription('three_act')).toContain('三幕式');
      expect(analyzer.getStructureTypeDescription('hero_journey')).toContain('英雄之旅');
      expect(analyzer.getStructureTypeDescription('five_act')).toContain('五幕式');
    });
  });
});
