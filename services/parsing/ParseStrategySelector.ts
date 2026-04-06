/**
 * ParseStrategySelector - 剧本解析策略选择器
 *
 * 根据文本长度、内容特征自动选择最优解析策略
 * 支持用户强制覆盖策略选择
 *
 * @module services/parsing/ParseStrategySelector
 * @version 1.0.0
 */

export type ParseStrategy = 'standard' | 'chunked';

export interface StrategySelection {
  strategy: ParseStrategy;
  reason: string;
  wordCount: number;
  estimatedTime: number; // Estimated time in seconds
  recommendedBatchSize: number;
}

export interface StrategySelectorConfig {
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

    // Chunked path: > 5000 words
    if (wordCount > this.config.chunkedPathThreshold) {
      return this.createSelection(
        'chunked',
        `长文本分块路径 (${wordCount} > ${this.config.chunkedPathThreshold} 字)`,
        content
      );
    }

    // Standard path: <= 5000 words
    return this.createSelection(
      'standard',
      `标准解析路径 (${wordCount} <= ${this.config.chunkedPathThreshold} 字)`,
      content
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
    content: string
  ): StrategySelection {
    const wordCount = this.countWords(content);

    let batchSize = this.config.standardBatchSize;
    if (strategy === 'chunked') {
      batchSize = this.config.chunkedBatchSize;
    }

    return {
      strategy,
      reason,
      wordCount,
      estimatedTime: 0, // 预估时间已移除，保留字段用于兼容
      recommendedBatchSize: batchSize,
    };
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

    // 数字不计入字数（基于搜索结果：数字通常不算单独的"词"）
    return chineseChars + englishWords;
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
