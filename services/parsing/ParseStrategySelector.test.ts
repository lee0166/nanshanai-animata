/**
 * ParseStrategySelector Unit Tests
 * 
 * Tests for automatic strategy selection based on text length
 * 
 * @module services/parsing/ParseStrategySelector.test
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ParseStrategySelector, ParseStrategy, DEFAULT_STRATEGY_CONFIG } from './ParseStrategySelector';

describe('ParseStrategySelector', () => {
  let selector: ParseStrategySelector;

  beforeEach(() => {
    selector = new ParseStrategySelector();
  });

  describe('Strategy Selection', () => {
    it('should select fast path for short texts (< 800 words)', () => {
      const shortText = '这是一个短文本。'.repeat(50); // ~250 characters
      const result = selector.selectStrategy(shortText);

      expect(result.strategy).toBe('fast');
      expect(result.wordCount).toBeLessThan(800);
      expect(result.reason).toContain('短文本');
      expect(result.estimatedTime).toBe(60);
      expect(result.recommendedBatchSize).toBe(10);
    });

    it('should select standard path for medium texts (800-5000 words)', () => {
      const mediumText = '这是一个中等长度文本。'.repeat(400); // ~2000 characters
      const result = selector.selectStrategy(mediumText);

      expect(result.strategy).toBe('standard');
      expect(result.wordCount).toBeGreaterThanOrEqual(800);
      expect(result.wordCount).toBeLessThanOrEqual(5000);
      expect(result.reason).toContain('标准解析');
      expect(result.recommendedBatchSize).toBe(5);
    });

    it('should select chunked path for long texts (> 5000 words)', () => {
      const longText = '这是一个长文本。'.repeat(1500); // ~7500 characters
      const result = selector.selectStrategy(longText);

      expect(result.strategy).toBe('chunked');
      expect(result.wordCount).toBeGreaterThan(5000);
      expect(result.reason).toContain('长文本');
      expect(result.recommendedBatchSize).toBe(3);
    });

    it('should handle empty text', () => {
      const result = selector.selectStrategy('');

      expect(result.strategy).toBe('fast');
      expect(result.wordCount).toBe(0);
    });

    it('should handle text with only whitespace', () => {
      const result = selector.selectStrategy('   \n\t   ');

      expect(result.strategy).toBe('fast');
      expect(result.wordCount).toBe(0);
    });
  });

  describe('Word Counting', () => {
    it('should count Chinese characters correctly', () => {
      const text = '你好世界';
      const result = selector.selectStrategy(text);

      expect(result.wordCount).toBe(4);
    });

    it('should count English words correctly', () => {
      const text = 'Hello world test';
      const result = selector.selectStrategy(text);

      expect(result.wordCount).toBe(3);
    });

    it('should count mixed Chinese and English', () => {
      const text = 'Hello 世界 world 你好';
      const result = selector.selectStrategy(text);

      expect(result.wordCount).toBe(6); // 2 English + 4 Chinese
    });

    it('should count numbers as words', () => {
      const text = '123 456 789';
      const result = selector.selectStrategy(text);

      expect(result.wordCount).toBe(3);
    });

    it('should handle mixed content', () => {
      const text = 'Hello 世界 123 test 测试';
      const result = selector.selectStrategy(text);

      expect(result.wordCount).toBe(7); // 2 English + 2 Chinese + 1 number + 2 Chinese
    });
  });

  describe('Forced Strategy', () => {
    it('should allow forcing fast strategy', () => {
      selector.forceStrategy('fast');
      const longText = '这是一个长文本。'.repeat(1500);
      const result = selector.selectStrategy(longText);

      expect(result.strategy).toBe('fast');
      expect(result.reason).toBe('用户强制选择');
    });

    it('should allow forcing standard strategy', () => {
      selector.forceStrategy('standard');
      const shortText = '短文本';
      const result = selector.selectStrategy(shortText);

      expect(result.strategy).toBe('standard');
      expect(result.reason).toBe('用户强制选择');
    });

    it('should allow forcing chunked strategy', () => {
      selector.forceStrategy('chunked');
      const shortText = '短文本';
      const result = selector.selectStrategy(shortText);

      expect(result.strategy).toBe('chunked');
      expect(result.reason).toBe('用户强制选择');
    });

    it('should reset to auto when forcing undefined', () => {
      selector.forceStrategy('fast');
      selector.forceStrategy(undefined);
      
      const shortText = '短文本';
      const result = selector.selectStrategy(shortText);

      expect(result.strategy).toBe('fast'); // Should auto-select fast for short text
      expect(result.reason).not.toBe('用户强制选择');
    });
  });

  describe('Configuration', () => {
    it('should use custom thresholds', () => {
      const customSelector = new ParseStrategySelector({
        fastPathThreshold: 500,
        chunkedPathThreshold: 3000
      });

      // Text with 3500 characters should be chunked with custom threshold of 3000
      const longText = '这是一个长文本。'.repeat(700); // ~3500 characters
      const result = customSelector.selectStrategy(longText);

      expect(result.strategy).toBe('chunked'); // Should be chunked with custom threshold
    });

    it('should update config dynamically', () => {
      selector.updateConfig({ fastPathThreshold: 100 });
      
      const shortText = '这是一个短文本。'.repeat(30); // ~150 characters
      const result = selector.selectStrategy(shortText);

      expect(result.strategy).toBe('standard'); // Should be standard with new threshold
    });

    it('should return current config', () => {
      const config = selector.getConfig();

      expect(config.fastPathThreshold).toBe(DEFAULT_STRATEGY_CONFIG.fastPathThreshold);
      expect(config.chunkedPathThreshold).toBe(DEFAULT_STRATEGY_CONFIG.chunkedPathThreshold);
      expect(config.standardBatchSize).toBe(DEFAULT_STRATEGY_CONFIG.standardBatchSize);
    });
  });

  describe('Complexity Calculation', () => {
    it('should calculate low complexity for simple text', () => {
      const simpleText = '这是一个简单的文本。';
      const complexity = selector.calculateComplexity(simpleText);

      expect(complexity).toBeLessThan(30);
    });

    it('should calculate high complexity for complex text', () => {
      // Create a longer complex text to ensure high complexity score
      const complexText = `
        第一章 开端
        
        这是一个复杂的文本，包含对话："你好，"他说，"今天天气不错。"
        场景：在古老的城堡中，主角发现了秘密。
        冲突升级，战斗开始！真相逐渐浮出水面。
        
        第二章 发展
        
        更多的对话和场景描述。爱恨情仇交织。
        决战时刻到来，转折出现。
        
        角色：主角、配角、反派
        场景：城堡、森林、战场
        
        "这是另一段对话，"她说，"非常重要。"
        "是的，"他回答，"我们必须行动。"
        
        第三章 高潮
        
        最终对决开始。角色们展现出真正的力量。
        场景切换：从城堡到战场，再到神秘的密室。
        
        转折：原来一切都是计划好的！
        真相大白，所有谜题解开。
        
        第四章 结局
        
        和平恢复。角色们各奔东西。
        场景：夕阳下的城堡，温馨而宁静。
        
        "再见了，"主角说，"我们的冒险结束了。"
        "但新的旅程即将开始，"配角微笑着说。
      `.repeat(3); // Repeat to increase length and complexity
      const complexity = selector.calculateComplexity(complexText);

      expect(complexity).toBeGreaterThan(30);
    });

    it('should return 0 for empty text', () => {
      const complexity = selector.calculateComplexity('');
      expect(complexity).toBe(0);
    });
  });

  describe('Strategy Descriptions', () => {
    it('should provide description for fast strategy', () => {
      const desc = ParseStrategySelector.getStrategyDescription('fast');

      expect(desc.title).toBe('快速解析');
      expect(desc.description).toContain('短文本');
      expect(desc.icon).toBe('⚡');
    });

    it('should provide description for standard strategy', () => {
      const desc = ParseStrategySelector.getStrategyDescription('standard');

      expect(desc.title).toBe('标准解析');
      expect(desc.description).toContain('中等长度');
      expect(desc.icon).toBe('📄');
    });

    it('should provide description for chunked strategy', () => {
      const desc = ParseStrategySelector.getStrategyDescription('chunked');

      expect(desc.title).toBe('分块解析');
      expect(desc.description).toContain('长文本');
      expect(desc.icon).toBe('📚');
    });
  });

  describe('Edge Cases', () => {
    it('should handle text at exact threshold boundaries', () => {
      // Create text with exactly 800 Chinese characters
      const textAt800 = '字'.repeat(800);
      const result = selector.selectStrategy(textAt800);

      // Should be standard (>= 800)
      expect(result.strategy).toBe('standard');
    });

    it('should handle text at 5000 boundary', () => {
      // Create text with exactly 5000 Chinese characters
      const textAt5000 = '字'.repeat(5000);
      const result = selector.selectStrategy(textAt5000);

      // Should be standard (<= 5000)
      expect(result.strategy).toBe('standard');
    });

    it('should handle text with special characters', () => {
      const textWithSpecialChars = '!@#$%^&*()_+{}|:<>?~`-=[]\\;\',./';
      const result = selector.selectStrategy(textWithSpecialChars);

      expect(result.wordCount).toBe(0); // No Chinese, English, or numbers
      expect(result.strategy).toBe('fast');
    });

    it('should handle very long text', () => {
      const veryLongText = '这是一个很长的文本。'.repeat(10000);
      const result = selector.selectStrategy(veryLongText);

      expect(result.strategy).toBe('chunked');
      expect(result.wordCount).toBeGreaterThan(5000);
    });
  });
});
