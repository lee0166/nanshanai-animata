/**
 * DynamicTimeoutCalculator - 动态超时计算器
 *
 * 职责：基于历史 API 响应时间，动态计算最优超时时间
 *
 * 核心功能：
 * 1. 记录最近 N 次成功的 API 响应时间
 * 2. 计算平均响应时间
 * 3. 基于平均时间动态计算超时（动态安全系数）
 * 4. 限制在合理范围内（60-300 秒）
 * 5. 支持任务类型区分（分镜/metadata 等）
 *
 * 计算策略：
 * - 基础超时时间 = 平均响应时间 × 动态安全系数
 * - 动态安全系数：avgTime > 60s 时 1.5，否则 2.0
 * - 最小超时：60 秒（metadata）/ 180 秒（分镜）
 * - 最大超时：300 秒（5 分钟）
 * - 无历史数据时使用默认值：90 秒
 *
 * 使用场景：
 * - LLM API 调用前计算超时
 * - 分镜生成请求超时设置
 * - Metadata 提取超时设置
 *
 * @module services/parsing/DynamicTimeoutCalculator
 * @version 2.0.0
 */

/**
 * 任务类型枚举
 */
export enum TaskType {
  /** 分镜生成 */
  SHOTS = 'shots',
  /** Metadata 提取 */
  METADATA = 'metadata',
  /** 角色提取 */
  CHARACTER = 'character',
  /** 场景提取 */
  SCENE = 'scene',
  /** 物品提取 */
  ITEM = 'item',
  /** 通用任务 */
  GENERAL = 'general',
}

/**
 * 模型性能画像
 */
export interface ModelPerformanceProfile {
  /** 模型 ID */
  modelId: string;
  /** 移动平均响应时间（毫秒） */
  avgResponseTime: number;
  /** 稳定性评分 (0-1)，1 表示最稳定 */
  stabilityScore: number;
  /** 超时率 (0-1) */
  timeoutRate: number;
  /** 最后更新时间 */
  lastUpdateTime: number;
}

/**
 * 配置选项
 */
export interface DynamicTimeoutCalculatorConfig {
  /** 历史记录大小（最近 N 次成功响应），默认 10 */
  historySize?: number;
  /** 基础安全系数（默认 2.0） */
  baseSafetyFactor?: number;
  /** 最小超时时间（毫秒），默认 60000ms (60 秒) */
  minTimeout?: number;
  /** 最大超时时间（毫秒），默认 900000ms (15 分钟) */
  maxTimeout?: number;
  /** 默认超时时间（无历史数据时），默认 120000ms (2 分钟) */
  defaultTimeout?: number;
  /** 任务类型，默认通用 */
  taskType?: TaskType;
  /** 长响应阈值（毫秒），超过此值认为响应较慢，默认 90000ms */
  longResponseThreshold?: number;
  /** 长响应时的安全系数，默认 1.5 */
  longResponseSafetyFactor?: number;
  /** 当前模型 ID（用于性能画像） */
  modelId?: string;
}

/**
 * 默认配置 - 基于生产环境优化
 */
const DEFAULT_CONFIG: Required<DynamicTimeoutCalculatorConfig> = {
  historySize: 10, // 最近 10 次成功响应（更多历史数据）
  baseSafetyFactor: 2.0,
  minTimeout: 60000, // 60 秒（通用最小）
  maxTimeout: 900000, // 900 秒（15 分钟，支持长文本）
  defaultTimeout: 120000, // 120 秒（2 分钟，提升默认值）
  taskType: TaskType.GENERAL,
  longResponseThreshold: 90000, // 90 秒（提升阈值）
  longResponseSafetyFactor: 1.5,
  modelId: 'unknown', // 模型 ID
};

/**
 * 任务类型特定配置 - 基于真实复杂度
 */
const TASK_TYPE_CONFIGS: Record<
  TaskType,
  Partial<DynamicTimeoutCalculatorConfig> & { baseComplexity?: number }
> = {
  // 分镜生成（最复杂）
  [TaskType.SHOTS]: {
    minTimeout: 180000, // 最小 3 分钟
    maxTimeout: 900000, // 最大 15 分钟
    baseComplexity: 2.5,
  },
  // 场景提取（复杂）⭐ 重点优化对象
  [TaskType.SCENE]: {
    minTimeout: 120000, // 最小 2 分钟（从 60 秒提升）
    maxTimeout: 900000, // 最大 15 分钟
    baseComplexity: 1.5,
  },
  // 角色提取（中等）
  [TaskType.CHARACTER]: {
    minTimeout: 90000, // 最小 90 秒（从 60 秒提升）
    maxTimeout: 600000, // 最大 10 分钟
    baseComplexity: 1.0,
  },
  // 元数据提取（简单）
  [TaskType.METADATA]: {
    minTimeout: 60000,
    maxTimeout: 300000,
    baseComplexity: 0.8,
  },
  // 物品提取（简单）
  [TaskType.ITEM]: {
    minTimeout: 60000,
    maxTimeout: 300000,
    baseComplexity: 0.9,
  },
  [TaskType.GENERAL]: {
    baseComplexity: 1.0,
  },
};

/**
 * 动态超时计算器 2.0
 *
 * 基于多维度因子智能计算超时时间：
 * - 内容长度因子：1 千字 vs 10 万字
 * - 任务复杂度因子：元数据 vs 分镜生成
 * - 模型特性因子：qwen-max vs glm-4
 * - 历史性能因子：基于移动平均和稳定性评分
 *
 * 核心公式：
 * timeout = baseTime × contentFactor × complexityFactor × modelFactor × safetyFactor
 */
export class DynamicTimeoutCalculator {
  private config: Required<DynamicTimeoutCalculatorConfig>;
  private responseTimes: number[] = [];
  private totalCalls: number = 0;
  private successfulCalls: number = 0;
  private timeoutCount: number = 0;

  // 模型性能画像（支持多模型）
  private modelProfiles: Map<string, ModelPerformanceProfile> = new Map();

  /**
   * 构造函数
   * @param config - 配置选项
   * @param taskType - 任务类型（可选，用于覆盖配置中的任务类型）
   */
  constructor(config: DynamicTimeoutCalculatorConfig = {}, taskType?: TaskType) {
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      taskType: taskType ?? config.taskType ?? DEFAULT_CONFIG.taskType,
    };

    // 应用任务类型特定配置
    const taskConfig = TASK_TYPE_CONFIGS[mergedConfig.taskType];
    this.config = {
      ...mergedConfig,
      ...taskConfig,
    } as Required<DynamicTimeoutCalculatorConfig>;
  }

  /**
   * 记录一次成功的 API 响应时间（同时更新模型性能画像）
   * @param responseTimeMs - 响应时间（毫秒）
   * @param modelId - 模型 ID（可选，用于性能画像）
   */
  recordResponseTime(responseTimeMs: number, modelId?: string): void {
    if (responseTimeMs <= 0) {
      console.warn('[DynamicTimeoutCalculator] Invalid response time:', responseTimeMs);
      return;
    }

    // 添加到历史记录
    this.responseTimes.push(responseTimeMs);
    this.successfulCalls++;
    this.totalCalls++;

    // 维护历史记录大小
    if (this.responseTimes.length > this.config.historySize) {
      this.responseTimes.shift();
    }

    // 更新模型性能画像
    const actualModelId = modelId || this.config.modelId || 'unknown';
    this.recordModelPerformance(actualModelId, responseTimeMs);

    console.log(`[DynamicTimeoutCalculator] Recorded response time: ${responseTimeMs}ms`);
    console.log(`[DynamicTimeoutCalculator] History: [${this.responseTimes.join(', ')}]ms`);
  }

  /**
   * 记录一次失败的 API 调用（不记录时间，只计数）
   */
  recordFailure(): void {
    this.totalCalls++;
    this.timeoutCount++;
    console.log('[DynamicTimeoutCalculator] Recorded failure');
  }

  /**
   * 记录模型性能数据（用于模型因子计算）
   * @param modelId - 模型 ID
   * @param responseTimeMs - 响应时间
   */
  private recordModelPerformance(modelId: string, responseTimeMs: number): void {
    const profile = this.modelProfiles.get(modelId) || {
      modelId,
      avgResponseTime: 0,
      stabilityScore: 1.0,
      timeoutRate: 0,
      lastUpdateTime: Date.now(),
    };

    // 移动平均（EMA）：新值占 30%，旧值占 70%
    profile.avgResponseTime = profile.avgResponseTime * 0.7 + responseTimeMs * 0.3;

    // 计算稳定性评分（基于方差）
    const variance = Math.abs(responseTimeMs - profile.avgResponseTime) / profile.avgResponseTime;
    profile.stabilityScore = Math.max(0, Math.min(1, profile.stabilityScore * (1 - variance)));

    // 更新超时率
    profile.timeoutRate = this.timeoutCount / this.totalCalls;
    profile.lastUpdateTime = Date.now();

    this.modelProfiles.set(modelId, profile);

    console.log(`[DynamicTimeoutCalculator] Model profile updated for ${modelId}:`);
    console.log(`  - Avg response time: ${(profile.avgResponseTime / 1000).toFixed(1)}s`);
    console.log(`  - Stability score: ${profile.stabilityScore.toFixed(2)}`);
    console.log(`  - Timeout rate: ${(profile.timeoutRate * 100).toFixed(1)}%`);
  }

  /**
   * 计算内容长度因子
   * @param contentLength - 内容长度（字符数）
   * @returns 内容因子 [0.5 - 3.0]
   */
  private calculateContentFactor(contentLength?: number): number {
    if (!contentLength || contentLength <= 0) {
      return 1.0;
    }

    // 分段计算策略
    if (contentLength <= 2000) {
      // 2000 字以内：基准值 1.0
      return 1.0;
    } else if (contentLength <= 10000) {
      // 2000-10000 字：线性增长
      return 1.0 + (contentLength - 2000) / 8000;
    } else if (contentLength <= 50000) {
      // 1 万 -5 万字：对数增长
      return 2.0 + Math.log10(contentLength / 10000) * 0.8;
    } else {
      // 50 万字以上：饱和增长
      return 2.8 + Math.log10(contentLength / 50000) * 0.4;
    }
  }

  /**
   * 计算任务复杂度因子
   * @param itemCount - 输出项数量（角色数/场景数/分镜数）
   * @param promptLength - Prompt 长度
   * @returns 复杂度因子 [0.8 - 5.0]
   */
  private calculateComplexityFactor(itemCount?: number, promptLength?: number): number {
    const taskConfig = TASK_TYPE_CONFIGS[this.config.taskType];
    const baseComplexity = taskConfig?.baseComplexity || 1.0;

    // 物品数量因子（对数增长）
    const itemFactor = itemCount && itemCount > 0 ? 1 + Math.log10(itemCount) * 0.3 : 1.0;

    // Prompt 长度因子（线性修正）
    const promptFactor =
      promptLength && promptLength > 3000 ? 1 + (promptLength - 3000) / 10000 : 1.0;

    const complexityFactor = baseComplexity * itemFactor * promptFactor;

    console.log(`[DynamicTimeoutCalculator] Complexity factor calculation:`);
    console.log(`  - Base complexity (${this.config.taskType}): ${baseComplexity.toFixed(2)}`);
    console.log(`  - Item count: ${itemCount ?? 0}, factor: ${itemFactor.toFixed(2)}`);
    console.log(`  - Prompt length: ${promptLength ?? 0}, factor: ${promptFactor.toFixed(2)}`);
    console.log(`  - Final complexity factor: ${complexityFactor.toFixed(2)}`);

    return Math.max(0.8, Math.min(5.0, complexityFactor));
  }

  /**
   * 获取模型因子（基于模型性能画像）
   * @returns 模型因子 [0.8 - 1.5]
   */
  private getModelFactor(): number {
    const modelId = this.config.modelId || 'unknown';
    const profile = this.modelProfiles.get(modelId);

    if (!profile) {
      return 1.0; // 无历史数据，使用基准值
    }

    // 稳定性差时，增加安全余量
    const stabilityFactor = 1.0 + (1 - profile.stabilityScore) * 0.5;

    console.log(
      `[DynamicTimeoutCalculator] Model factor for ${modelId}: ${stabilityFactor.toFixed(2)}`
    );
    console.log(`  - Stability score: ${profile.stabilityScore.toFixed(2)}`);

    return Math.max(0.8, Math.min(1.5, stabilityFactor));
  }

  /**
   * 基于内容预估基础时间（无历史数据时使用）
   * @param contentLength - 内容长度
   * @param promptLength - Prompt 长度
   * @returns 预估基础时间（毫秒）
   */
  private estimateBaseTimeFromContent(contentLength?: number, promptLength?: number): number {
    const baseTime = this.config.defaultTimeout;

    if (!contentLength && !promptLength) {
      return baseTime;
    }

    // 优先使用 prompt 长度（更准确）
    if (promptLength && promptLength > 0) {
      // 假设 3000 字符 prompt 需要 baseTime
      const estimatedTime = (promptLength / 3000) * baseTime;
      return Math.max(60000, Math.min(estimatedTime, 600000));
    }

    // 使用内容长度
    if (contentLength && contentLength > 0) {
      // 假设 2000 字需要 baseTime
      const estimatedTime = (contentLength / 2000) * baseTime;
      return Math.max(60000, Math.min(estimatedTime, 600000));
    }

    return baseTime;
  }

  /**
   * 限制超时在合理范围内
   * @param timeout - 计算的超时值
   * @returns 限制后的超时值
   */
  private clampTimeout(timeout: number): number {
    const clamped = Math.max(this.config.minTimeout, Math.min(timeout, this.config.maxTimeout));

    console.log(`[DynamicTimeoutCalculator] Timeout clamped:`);
    console.log(`  - Raw: ${(timeout / 1000).toFixed(1)}s`);
    console.log(
      `  - Min: ${this.config.minTimeout / 1000}s, Max: ${this.config.maxTimeout / 1000}s`
    );
    console.log(`  - Clamped: ${(clamped / 1000).toFixed(1)}s`);

    return clamped;
  }

  /**
   * 获取当前计算的超时时间（增强版：支持多维度因子）
   * @param contentLength - 内容长度（可选）
   * @param itemCount - 输出项数量（可选）
   * @param promptLength - Prompt 长度（可选）
   * @returns 超时时间（毫秒）
   */
  getTimeout(contentLength?: number, itemCount?: number, promptLength?: number): number {
    // 1. 计算基础时间
    let baseTime: number;
    if (this.responseTimes.length > 0) {
      baseTime = this.getAverageResponseTime();
      console.log(
        `[DynamicTimeoutCalculator] Using historical average: ${(baseTime / 1000).toFixed(1)}s`
      );
    } else {
      baseTime = this.estimateBaseTimeFromContent(contentLength, promptLength);
      console.log(
        `[DynamicTimeoutCalculator] Using content-based estimate: ${(baseTime / 1000).toFixed(1)}s`
      );
    }

    // 2. 计算内容长度因子
    const contentFactor = this.calculateContentFactor(contentLength);

    // 3. 计算任务复杂度因子
    const complexityFactor = this.calculateComplexityFactor(itemCount, promptLength);

    // 4. 获取模型因子
    const modelFactor = this.getModelFactor();

    // 5. 计算动态安全系数
    const safetyFactor = this.calculateDynamicSafetyFactor(baseTime);

    // 6. 最终超时 = 基础时间 × 内容因子 × 复杂度因子 × 模型因子 × 安全系数
    const timeout = baseTime * contentFactor * complexityFactor * modelFactor * safetyFactor;

    console.log(`[DynamicTimeoutCalculator] === Timeout Calculation (2.0 Enhanced) ===`);
    console.log(`  - Base time: ${(baseTime / 1000).toFixed(1)}s`);
    console.log(`  - Content factor: ${contentFactor.toFixed(2)}`);
    console.log(`  - Complexity factor: ${complexityFactor.toFixed(2)}`);
    console.log(`  - Model factor: ${modelFactor.toFixed(2)}`);
    console.log(`  - Safety factor: ${safetyFactor.toFixed(2)}`);
    console.log(`  - Raw timeout: ${(timeout / 1000).toFixed(1)}s`);

    // 7. 限制在合理范围内
    return this.clampTimeout(timeout);
  }

  /**
   * 计算动态安全系数（增强版：考虑响应时间、模型稳定性、任务类型）
   * @param avgTime - 平均响应时间（毫秒）
   * @returns 动态安全系数 [1.3 - 3.0]
   */
  private calculateDynamicSafetyFactor(avgTime: number): number {
    // 1. 基础安全系数：响应时间越长，安全系数越低（避免过度保守）
    let baseFactor = 2.0;
    if (avgTime > 120000) {
      baseFactor = 1.5; // >2 分钟：1.5 倍
    } else if (avgTime > 90000) {
      baseFactor = 1.8; // 1.5-2 分钟：1.8 倍
    } else if (avgTime > 60000) {
      baseFactor = 2.0; // 1-1.5 分钟：2.0 倍
    }

    // 2. 根据模型稳定性调整
    const modelId = this.config.modelId || 'unknown';
    const profile = this.modelProfiles.get(modelId);
    if (profile && profile.stabilityScore < 0.7) {
      baseFactor += 0.3; // 稳定性差，增加安全系数
    }

    // 3. 根据任务类型调整（分镜生成需要更保守）
    if (this.config.taskType === TaskType.SHOTS) {
      baseFactor += 0.2;
    }

    // 4. 限制范围
    const safetyFactor = Math.max(1.3, Math.min(3.0, baseFactor));

    console.log(`[DynamicTimeoutCalculator] Safety factor calculation:`);
    console.log(
      `  - Base factor (from avgTime ${(avgTime / 1000).toFixed(1)}s): ${baseFactor.toFixed(2)}`
    );
    if (profile) {
      console.log(`  - Model stability adjustment: +${profile.stabilityScore < 0.7 ? 0.3 : 0}`);
    }
    console.log(
      `  - Task type adjustment: ${this.config.taskType === TaskType.SHOTS ? '+0.2' : '0'}`
    );
    console.log(`  - Final safety factor: ${safetyFactor.toFixed(2)}`);

    return safetyFactor;
  }

  /**
   * 获取平均响应时间
   * @returns 平均响应时间（毫秒）
   */
  getAverageResponseTime(): number {
    if (this.responseTimes.length === 0) {
      return this.config.defaultTimeout / this.config.baseSafetyFactor;
    }

    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.responseTimes.length;
  }

  /**
   * 获取响应时间的统计信息
   * @returns 统计信息对象
   */
  getStats(): {
    count: number;
    min: number;
    max: number;
    avg: number;
    latest: number | null;
    history: number[];
  } {
    if (this.responseTimes.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        latest: null,
        history: [],
      };
    }

    return {
      count: this.responseTimes.length,
      min: Math.min(...this.responseTimes),
      max: Math.max(...this.responseTimes),
      avg: this.getAverageResponseTime(),
      latest: this.responseTimes[this.responseTimes.length - 1],
      history: [...this.responseTimes],
    };
  }

  /**
   * 获取成功率
   * @returns 成功率（0-1）
   */
  getSuccessRate(): number {
    if (this.totalCalls === 0) {
      return 1.0;
    }
    return this.successfulCalls / this.totalCalls;
  }

  /**
   * 获取总调用次数
   * @returns 总调用次数
   */
  getTotalCalls(): number {
    return this.totalCalls;
  }

  /**
   * 获取成功调用次数
   * @returns 成功调用次数
   */
  getSuccessfulCalls(): number {
    return this.successfulCalls;
  }

  /**
   * 重置计算器状态
   */
  reset(): void {
    this.responseTimes = [];
    this.totalCalls = 0;
    this.successfulCalls = 0;
    console.log('[DynamicTimeoutCalculator] Reset');
  }

  /**
   * 更新配置
   * @param config - 部分配置更新
   */
  updateConfig(config: Partial<DynamicTimeoutCalculatorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   * @returns 当前配置
   */
  getConfig(): DynamicTimeoutCalculatorConfig {
    return { ...this.config };
  }

  /**
   * 获取详细的超时建议
   * @returns 超时建议信息
   */
  getTimeoutAdvice(): {
    recommendedTimeout: number;
    reason: string;
    stats: {
      count: number;
      avg: number;
      min: number;
      max: number;
      latest: number | null;
      successRate: number;
    };
  } {
    const stats = this.getStats();
    const timeout = this.getTimeout();
    const reason = this.getTimeoutReason();

    return {
      recommendedTimeout: timeout,
      reason,
      stats: {
        count: stats.count,
        avg: stats.avg,
        min: stats.min,
        max: stats.max,
        latest: stats.latest,
        successRate: this.getSuccessRate(),
      },
    };
  }

  /**
   * 获取超时计算原因
   * @returns 原因描述
   */
  private getTimeoutReason(): string {
    if (this.responseTimes.length === 0) {
      return `无历史数据，使用默认超时 ${this.config.defaultTimeout / 1000}秒（任务类型：${this.config.taskType}）`;
    }

    const avgTime = this.getAverageResponseTime();
    const safetyFactor = this.calculateDynamicSafetyFactor(avgTime);
    const rawTimeout = avgTime * safetyFactor;

    if (rawTimeout < this.config.minTimeout) {
      return `平均响应时间 ${avgTime.toFixed(0)}ms × ${safetyFactor.toFixed(2)} = ${rawTimeout.toFixed(0)}ms < 最小超时（${this.config.minTimeout / 1000}秒，任务类型：${this.config.taskType}），使用最小超时`;
    } else if (rawTimeout > this.config.maxTimeout) {
      return `平均响应时间 ${avgTime.toFixed(0)}ms × ${safetyFactor.toFixed(2)} = ${rawTimeout.toFixed(0)}ms > 最大超时，使用最大超时 ${this.config.maxTimeout / 1000}秒`;
    } else {
      return `基于最近 ${this.responseTimes.length} 次成功响应的平均时间 ${avgTime.toFixed(0)}ms × ${safetyFactor.toFixed(2)} = ${rawTimeout.toFixed(0)}ms（任务类型：${this.config.taskType}）`;
    }
  }

  /**
   * 获取任务类型
   * @returns 当前任务类型
   */
  getTaskType(): TaskType {
    return this.config.taskType;
  }

  /**
   * 更新任务类型
   * @param taskType - 新的任务类型
   */
  setTaskType(taskType: TaskType): void {
    const taskConfig = TASK_TYPE_CONFIGS[taskType];
    this.config = {
      ...this.config,
      taskType,
      ...taskConfig,
    } as Required<DynamicTimeoutCalculatorConfig>;

    console.log(`[DynamicTimeoutCalculator] Task type updated to: ${taskType}`);
    console.log(`[DynamicTimeoutCalculator] New min timeout: ${this.config.minTimeout / 1000}s`);
  }

  /**
   * 设置模型 ID（用于性能画像）
   * @param modelId - 模型 ID
   */
  setModelId(modelId: string): void {
    this.config.modelId = modelId;
    console.log(`[DynamicTimeoutCalculator] Model ID set to: ${modelId}`);
  }

  /**
   * 获取模型性能画像
   * @param modelId - 模型 ID
   * @returns 模型性能画像（如果存在）
   */
  getModelProfile(modelId: string): ModelPerformanceProfile | undefined {
    return this.modelProfiles.get(modelId);
  }

  /**
   * 获取所有模型的性能统计
   * @returns 所有模型的性能画像
   */
  getAllModelProfiles(): Map<string, ModelPerformanceProfile> {
    return new Map(this.modelProfiles);
  }
}

/**
 * 创建动态超时计算器实例
 * @param config - 配置选项
 * @param taskType - 任务类型（可选）
 * @returns 计算器实例
 */
export function createDynamicTimeoutCalculator(
  config: DynamicTimeoutCalculatorConfig = {},
  taskType?: TaskType
): DynamicTimeoutCalculator {
  return new DynamicTimeoutCalculator(config, taskType);
}
