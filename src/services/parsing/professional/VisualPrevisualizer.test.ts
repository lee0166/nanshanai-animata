/**
 * VisualPrevisualizer 单元测试
 */

import { describe, it, expect } from 'vitest';
import { VisualPrevisualizer } from './VisualPrevisualizer';
import type { VisualStyle, EraContext } from '../../../../types';

const visualizer = new VisualPrevisualizer();

describe('VisualPrevisualizer', () => {
  // 创建测试用的 VisualStyle
  const createMockVisualStyle = (overrides?: Partial<VisualStyle>): VisualStyle => ({
    artDirection: '写实电影感',
    artStyle: '现代',
    artStyleDescription: '现代都市风格，强调真实感',
    colorPalette: ['蓝色', '灰色', '白色'],
    colorMood: '冷峻压抑',
    cinematography: '电影感构图',
    lightingStyle: '戏剧光',
    ...overrides,
  });

  // 创建测试用的 EraContext
  const createMockEraContext = (overrides?: Partial<EraContext>): EraContext => ({
    era: '现代',
    eraDescription: '当代都市背景',
    location: '上海',
    season: '夏季',
    timeOfDay: '白天',
    ...overrides,
  });

  describe('analyze', () => {
    it('应该正确分析视觉预演', () => {
      const visualStyle = createMockVisualStyle();
      const eraContext = createMockEraContext();

      const result = visualizer.analyze(visualStyle, eraContext);

      // 验证返回结构
      expect(result).toHaveProperty('visualStyle');
      expect(result).toHaveProperty('colorBoard');
      expect(result).toHaveProperty('eraVisualGuide');
      expect(result).toHaveProperty('overallVisualDescription');
      expect(result).toHaveProperty('sceneVisualSuggestions');

      // 验证色彩板
      expect(result.colorBoard).toHaveProperty('primaryColors');
      expect(result.colorBoard).toHaveProperty('moodDescription');
      expect(result.colorBoard).toHaveProperty('cinematographyNotes');
      expect(result.colorBoard).toHaveProperty('lightingSuggestions');

      // 验证时代视觉参考
      expect(result.eraVisualGuide).toHaveProperty('era');
      expect(result.eraVisualGuide).toHaveProperty('location');
      expect(result.eraVisualGuide).toHaveProperty('visualReferences');
      expect(result.eraVisualGuide).toHaveProperty('eraCharacteristics');
      expect(result.eraVisualGuide).toHaveProperty('costumeStyle');
      expect(result.eraVisualGuide).toHaveProperty('architectureStyle');

      // 验证场景视觉建议
      expect(result.sceneVisualSuggestions).toHaveLength(4);
    });

    it('应该正确处理空 eraContext', () => {
      const visualStyle = createMockVisualStyle();

      const result = visualizer.analyze(visualStyle, undefined);

      expect(result.eraVisualGuide.era).toBe('现代');
      expect(result.eraVisualGuide.location).toBe('城市');
    });

    it('应该根据色彩情绪返回正确的描述', () => {
      const colorMoods = [
        { mood: '温暖明亮', expected: '暖色调' },
        { mood: '冷峻压抑', expected: '冷色调' },
        { mood: '复古怀旧', expected: '复古' },
        { mood: '明亮清新', expected: '明亮' },
        { mood: '阴暗沉重', expected: '阴暗' },
        { mood: '鲜艳夺目', expected: '鲜艳' },
        { mood: '柔和淡雅', expected: '柔和' },
        { mood: '神秘莫测', expected: '神秘' },
      ];

      for (const { mood, expected } of colorMoods) {
        const visualStyle = createMockVisualStyle({ colorMood: mood });
        const result = visualizer.analyze(visualStyle, undefined);

        expect(result.colorBoard.moodDescription).toContain(expected);
      }
    });

    it('应该根据时代返回正确的特征', () => {
      const eras = [
        { era: '古代', expected: '传统服饰' },
        { era: '现代', expected: '现代服饰' },
        { era: '民国', expected: '中西合璧' },
        { era: '未来', expected: '科幻元素' },
      ];

      for (const { era, expected } of eras) {
        const visualStyle = createMockVisualStyle();
        const eraContext = createMockEraContext({ era });
        const result = visualizer.analyze(visualStyle, eraContext);

        expect(result.eraVisualGuide.eraCharacteristics).toContain(expected);
      }
    });

    it('应该根据地点返回正确的视觉参考', () => {
      const locations = [
        { location: '北京', expected: '胡同' },
        { location: '上海', expected: '外滩' },
        { location: '纽约', expected: '曼哈顿' },
        { location: '东京', expected: '霓虹灯' },
      ];

      for (const { location, expected } of locations) {
        const visualStyle = createMockVisualStyle();
        const eraContext = createMockEraContext({ location });
        const result = visualizer.analyze(visualStyle, eraContext);

        expect(result.eraVisualGuide.visualReferences).toContain(expected);
      }
    });

    it('应该生成正确的整体视觉描述', () => {
      const visualStyle = createMockVisualStyle();
      const eraContext = createMockEraContext();

      const result = visualizer.analyze(visualStyle, eraContext);

      expect(result.overallVisualDescription).toContain(visualStyle.artDirection);
      expect(result.overallVisualDescription).toContain(visualStyle.colorMood);
      expect(result.overallVisualDescription).toContain(eraContext.era);
      expect(result.overallVisualDescription).toContain(eraContext.location);
      expect(result.overallVisualDescription).toContain(visualStyle.cinematography);
    });

    it('应该生成场景视觉建议', () => {
      const visualStyle = createMockVisualStyle();
      const result = visualizer.analyze(visualStyle, undefined);

      // 应该有4种场景类型的建议
      expect(result.sceneVisualSuggestions).toHaveLength(4);

      // 验证每种场景类型
      const sceneTypes = result.sceneVisualSuggestions.map(s => s.sceneType);
      expect(sceneTypes).toContain('室内场景');
      expect(sceneTypes).toContain('室外场景');
      expect(sceneTypes).toContain('情感场景');
      expect(sceneTypes).toContain('动作场景');

      // 验证每个建议都有必要的字段
      for (const suggestion of result.sceneVisualSuggestions) {
        expect(suggestion).toHaveProperty('sceneType');
        expect(suggestion).toHaveProperty('visualStyle');
        expect(suggestion).toHaveProperty('colorSuggestion');
        expect(suggestion).toHaveProperty('lightingSuggestion');
      }
    });
  });

  describe('getColorHex', () => {
    it('应该返回正确的颜色十六进制值', () => {
      expect(visualizer.getColorHex('红色')).toBe('#E53935');
      expect(visualizer.getColorHex('蓝色')).toBe('#1E88E5');
      expect(visualizer.getColorHex('绿色')).toBe('#43A047');
      expect(visualizer.getColorHex('黄色')).toBe('#FDD835');
      expect(visualizer.getColorHex('黑色')).toBe('#212121');
      expect(visualizer.getColorHex('白色')).toBe('#FAFAFA');
    });

    it('应该通过包含匹配返回颜色', () => {
      // "深红色"包含"红色"，直接匹配"红色"先被找到
      expect(visualizer.getColorHex('深红色')).toBe('#E53935');
      // "深蓝色"包含"蓝色"
      expect(visualizer.getColorHex('深蓝色')).toBe('#1E88E5');
      // "粉红色"包含"红色"，先匹配到"红色"
      expect(visualizer.getColorHex('粉红色')).toBe('#E53935');
      // "桃红色"也匹配"红色"
      expect(visualizer.getColorHex('桃红色')).toBe('#E53935');
    });

    it('应该对未知颜色返回默认灰色', () => {
      expect(visualizer.getColorHex('未知颜色')).toBe('#9E9E9E');
      expect(visualizer.getColorHex('')).toBe('#9E9E9E');
    });
  });
});
