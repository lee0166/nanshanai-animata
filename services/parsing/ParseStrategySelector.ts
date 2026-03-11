/**
 * ParseStrategySelector - 剧本解析策略选择器
 *
 * 根据文本长度、内容特征自动选择最优解析策略
 * 支持用户强制覆盖策略选择
 *
 * @module services/parsing/ParseStrategySelector
 * @version 1.0.0
 */

export type ParseStrategy = 'fast' | 'standard' | 'chunked';

export interface StrategySelection {
  strategy: ParseStrategy;
  reason: string;
  wordCount: number;
  estimatedTime: number; // Estimated time in seconds
  recommendedBatchSize: number;
}

export interface StrategySelectorConfig {
  /** Fast path threshold (words) */
  fastPathThreshold: number;
  /** Chunked path threshold (words) */
  chunkedPathThreshold: number;
  /** User forced strategy (optional) */
  forcedStrategy?: ParseStrategy;
  /** Batch size for standard path */
  standardBatchSize: number;
  /** Batch size for chunked path */
  chunkedBatchSize: number;
}

export const DEFAULT_STRATEGY_CONFIG: StrategySelectorConfig = {
  fastPathThreshold: 800,
  chunkedPathThreshold: 5000,
  standardBatchSize: 5,
  chunkedBatchSize: 3,
};

export class ParseStrategySelector {
  private config: StrategySelectorConfig;

  constructor(config: Partial<StrategySelectorConfig> = {}) {
    this.config = { ...DEFAULT_STRATEGY_CONFIG, ...config };
  }

  /**
   * Select the optimal parsing strategy based on content
   * @param content - Script content
   * @returns Strategy selection result
   */
  selectStrategy(content: string): StrategySelection {
    // Check for user forced strategy
    if (this.config.forcedStrategy) {
      return this.createSelection(this.config.forcedStrategy, '用户强制选择', content);
    }

    const wordCount = this.countWords(content);

    // Fast path: < 800 words
    if (wordCount < this.config.fastPathThreshold) {
      return this.createSelection(
        'fast',
        `短文本快速路径 (${wordCount} < ${this.config.fastPathThreshold} 字)`,
        content,
        60 // ~60 seconds for fast path
      );
    }

    // Chunked path: > 5000 words
    if (wordCount > this.config.chunkedPathThreshold) {
      return this.createSelection(
        'chunked',
        `长文本分块路径 (${wordCount} > ${this.config.chunkedPathThreshold} 字)`,
        content,
        Math.ceil(wordCount / 500) * 30 // ~30s per 500 words
      );
    }

    // Standard path: 800-5000 words
    return this.createSelection(
      'standard',
      `标准解析路径 (${this.config.fastPathThreshold}-${this.config.chunkedPathThreshold} 字)`,
      content,
      Math.ceil(wordCount / 200) * 15 // ~15s per 200 words
    );
  }

  /**
   * Force a specific strategy (user override)
   * @param strategy - Strategy to force
   */
  forceStrategy(strategy: ParseStrategy | undefined): void {
    this.config.forcedStrategy = strategy;
  }

  /**
   * Update configuration
   * @param config - Partial configuration update
   */
  updateConfig(config: Partial<StrategySelectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): StrategySelectorConfig {
    return { ...this.config };
  }

  /**
   * Create a strategy selection result
   * @private
   */
  private createSelection(
    strategy: ParseStrategy,
    reason: string,
    content: string,
    estimatedTime?: number
  ): StrategySelection {
    const wordCount = this.countWords(content);

    let batchSize = this.config.standardBatchSize;
    if (strategy === 'chunked') {
      batchSize = this.config.chunkedBatchSize;
    } else if (strategy === 'fast') {
      batchSize = 10; // Fast path handles more in one call
    }

    return {
      strategy,
      reason,
      wordCount,
      estimatedTime: estimatedTime || this.estimateTime(wordCount, strategy),
      recommendedBatchSize: batchSize,
    };
  }

  /**
   * Estimate parsing time based on word count and strategy
   * @private
   */
  private estimateTime(wordCount: number, strategy: ParseStrategy): number {
    switch (strategy) {
      case 'fast':
        // Fast path: 1-2 API calls, ~30-60s
        return 60;
      case 'standard':
        // Standard: ~15s per 200 words
        return Math.ceil(wordCount / 200) * 15;
      case 'chunked':
        // Chunked: ~30s per 500 words (with overhead)
        return Math.ceil(wordCount / 500) * 30;
      default:
        return Math.ceil(wordCount / 200) * 15;
    }
  }

  /**
   * Count words in content (Chinese characters + English words)
   * @param content - Text content
   * @returns Word count
   * @private
   */
  private countWords(content: string): number {
    const trimmed = content.trim();
    if (!trimmed) return 0;

    // Count Chinese characters
    const chineseChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length;

    // Count English words (sequences of letters)
    const englishWords = (trimmed.match(/[a-zA-Z]+/g) || []).length;

    // Count numbers as words
    const numbers = (trimmed.match(/\d+/g) || []).length;

    return chineseChars + englishWords + numbers;
  }

  /**
   * Calculate text complexity score (0-100)
   * Higher score = more complex = needs more processing
   * @param content - Text content
   * @returns Complexity score
   */
  calculateComplexity(content: string): number {
    const trimmed = content.trim();
    if (!trimmed) return 0;

    let score = 0;

    // Factor 1: Length (0-40 points)
    const wordCount = this.countWords(trimmed);
    score += Math.min(40, wordCount / 100);

    // Factor 2: Character density (0-20 points)
    const lines = trimmed.split('\n').length;
    const avgCharsPerLine = trimmed.length / Math.max(1, lines);
    score += Math.min(20, avgCharsPerLine / 20);

    // Factor 3: Dialogue density (0-20 points)
    const dialogueMatches = (trimmed.match(/[""""'']([^""""'']*?)[""""'']/g) || []).length;
    score += Math.min(20, dialogueMatches * 2);

    // Factor 4: Scene/character indicators (0-20 points)
    const sceneIndicators = (trimmed.match(/(场景|地点|时间|第[一二三四五六七八九十\d]+章)/g) || [])
      .length;
    const characterIndicators = (trimmed.match(/(角色|人物|主角|配角)/g) || []).length;
    score += Math.min(20, (sceneIndicators + characterIndicators) * 2);

    return Math.min(100, Math.round(score));
  }

  /**
   * Get strategy description for UI display
   * @param strategy - Parse strategy
   * @returns Human-readable description
   */
  static getStrategyDescription(strategy: ParseStrategy): {
    title: string;
    description: string;
    icon: string;
  } {
    switch (strategy) {
      case 'fast':
        return {
          title: '快速解析',
          description: '适用于短文本，1-2次API调用完成',
          icon: '⚡',
        };
      case 'standard':
        return {
          title: '标准解析',
          description: '适用于中等长度文本，分批处理',
          icon: '📄',
        };
      case 'chunked':
        return {
          title: '分块解析',
          description: '适用于长文本，智能分块处理',
          icon: '📚',
        };
      default:
        return {
          title: '自动选择',
          description: '根据文本长度自动选择最优策略',
          icon: '🤖',
        };
    }
  }
}

export default ParseStrategySelector;
