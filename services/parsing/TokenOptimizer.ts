/**
 * TokenOptimizer - Token 优化器
 *
 * 职责：基于任务内容和复杂度，动态计算最优 Token 分配
 *
 * 核心功能：
 * 1. 分析内容长度和复杂度
 * 2. 计算基础 Token 需求
 * 3. 添加动态安全余量（10%-20%）
 * 4. 限制 Token 范围（避免浪费）
 *
 * 优化策略：
 * - 短文本：高安全余量（20%）
 * - 中等文本：中等安全余量（15%）
 * - 长文本：低安全余量（10%）
 *
 * 使用场景：
 * - Metadata 提取
 * - 角色解析
 * - 场景解析
 * - 分镜生成
 * - 剧情分析
 *
 * @module services/parsing/TokenOptimizer
 * @version 1.0.0
 */

/**
 * 任务类型
 */
export type TaskType = 'metadata' | 'character' | 'scene' | 'shots' | 'plot-analysis' | 'globalContext';

/**
 * Token 计算配置
 */
export interface TokenConfig {
  /** 基础 Token（固定开销） */
  baseTokens: number;
  /** 每字符 Token 系数 */
  tokensPerChar: number;
  /** 最小 Token */
  minTokens: number;
  /** 最大 Token */
  maxTokens: number;
  /** 安全余量系数（0.1-0.2） */
  safetyMargin: number;
}

/**
 * Token 计算结果
 */
export interface TokenCalculation {
  /** 计算后的 Token 数量 */
  tokens: number;
  /** 基础 Token（不含安全余量） */
  baseTokens: number;
  /** 安全余量 Token */
  safetyTokens: number;
  /** 安全余量系数 */
  safetyMargin: number;
}

/**
 * Token 优化器
 */
export class TokenOptimizer {
  /**
   * 默认配置
   */
  private static readonly DEFAULT_CONFIGS: Record<TaskType, TokenConfig> = {
    metadata: {
      baseTokens: 500, // Prompt + 系统指令
      tokensPerChar: 1.5, // 每字符约 1.5 tokens
      minTokens: 2000,
      maxTokens: 6000,
      safetyMargin: 0.2, // 短文本，高安全余量
    },
    character: {
      baseTokens: 800,
      tokensPerChar: 1.8, // 角色描述需要更多 tokens
      minTokens: 3000,
      maxTokens: 8000,
      safetyMargin: 0.15,
    },
    scene: {
      baseTokens: 800,
      tokensPerChar: 1.6,
      minTokens: 3000,
      maxTokens: 8000,
      safetyMargin: 0.15,
    },
    shots: {
      baseTokens: 1000,
      tokensPerChar: 2.0, // 分镜需要详细描述
      minTokens: 4000,
      maxTokens: 10000,
      safetyMargin: 0.15,
    },
    'plot-analysis': {
      baseTokens: 600,
      tokensPerChar: 1.5,
      minTokens: 2500,
      maxTokens: 6000,
      safetyMargin: 0.18,
    },
    globalContext: {
      baseTokens: 700,
      tokensPerChar: 1.6,
      minTokens: 3000,
      maxTokens: 7000,
      safetyMargin: 0.18,
    },
  };

  /**
   * 计算最优 Token 数量
   *
   * @param content - 任务内容
   * @param taskType - 任务类型
   * @param customConfig - 自定义配置（可选）
   * @returns Token 计算结果
   */
  calculateTokens(
    content: string,
    taskType: TaskType,
    customConfig?: Partial<TokenConfig>
  ): TokenCalculation {
    // 合并配置
    const config = {
      ...TokenOptimizer.DEFAULT_CONFIGS[taskType],
      ...customConfig,
    };

    // 计算内容长度
    const contentLength = content.length;

    // 计算基础 Token（不含安全余量）
    const rawTokens = Math.ceil(config.baseTokens + contentLength * config.tokensPerChar);

    // 计算安全余量 Token
    const safetyTokens = Math.ceil(rawTokens * config.safetyMargin);

    // 总 Token
    const totalTokens = rawTokens + safetyTokens;

    // 限制范围
    const clampedTokens = Math.max(config.minTokens, Math.min(config.maxTokens, totalTokens));

    console.log(`[TokenOptimizer] Token calculation:`);
    console.log(`  - Task type: ${taskType}`);
    console.log(`  - Content length: ${contentLength} chars`);
    console.log(`  - Base tokens: ${config.baseTokens} + (${contentLength} × ${config.tokensPerChar}) = ${rawTokens}`);
    console.log(`  - Safety margin: ${config.safetyMargin * 100}% (${safetyTokens} tokens)`);
    console.log(`  - Raw total: ${totalTokens}`);
    console.log(`  - Clamped: [${config.minTokens}, ${config.maxTokens}] → ${clampedTokens}`);

    return {
      tokens: clampedTokens,
      baseTokens: rawTokens,
      safetyTokens,
      safetyMargin: config.safetyMargin,
    };
  }

  /**
   * 基于复杂度计算 Token（高级）
   *
   * @param content - 任务内容
   * @param complexity - 复杂度评分（0-10）
   * @param taskType - 任务类型
   * @returns Token 计算结果
   */
  calculateTokensWithComplexity(
    content: string,
    complexity: number,
    taskType: TaskType
  ): TokenCalculation {
    // 限制复杂度范围
    const clampedComplexity = Math.max(0, Math.min(10, complexity));

    // 根据复杂度调整 tokensPerChar
    const baseConfig = TokenOptimizer.DEFAULT_CONFIGS[taskType];
    const complexityMultiplier = 1 + (clampedComplexity / 10) * 0.5; // 1.0-1.5x

    const customConfig: Partial<TokenConfig> = {
      tokensPerChar: baseConfig.tokensPerChar * complexityMultiplier,
    };

    console.log(`[TokenOptimizer] Complexity-based calculation:`);
    console.log(`  - Complexity: ${clampedComplexity}/10`);
    console.log(`  - Multiplier: ${complexityMultiplier.toFixed(2)}x`);

    return this.calculateTokens(content, taskType, customConfig);
  }

  /**
   * 获取默认配置
   *
   * @param taskType - 任务类型
   * @returns Token 配置
   */
  getDefaultConfig(taskType: TaskType): TokenConfig {
    return { ...TokenOptimizer.DEFAULT_CONFIGS[taskType] };
  }

  /**
   * 估算 Token 节省量
   *
   * @param content - 内容
   * @param taskType - 任务类型
   * @param oldFixedTokens - 旧的固定 Token 数
   * @returns 节省的 Token 数量和百分比
   */
  estimateSavings(content: string, taskType: TaskType, oldFixedTokens: number): {
    savedTokens: number;
    savedPercentage: number;
    newTokens: number;
  } {
    const calculation = this.calculateTokens(content, taskType);
    const savedTokens = oldFixedTokens - calculation.tokens;
    const savedPercentage = Math.round((savedTokens / oldFixedTokens) * 100);

    return {
      savedTokens,
      savedPercentage,
      newTokens: calculation.tokens,
    };
  }
}

/**
 * 创建 Token 优化器实例
 */
export function createTokenOptimizer(): TokenOptimizer {
  return new TokenOptimizer();
}
