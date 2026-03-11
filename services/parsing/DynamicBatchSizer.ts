/**
 * DynamicBatchSizer - 动态批量大小调整服务
 *
 * 职责：基于 API 调用成功率的滑动窗口统计，动态调整批量大小
 *
 * 核心功能：
 * 1. 维护最近 N 次 API 调用的滑动窗口
 * 2. 计算成功率
 * 3. 根据成功率动态调整批量大小
 * 4. 防止频繁波动
 *
 * 调整策略：
 * - 成功率 > 90%：批量大小 + 1（最大 3）
 * - 成功率 < 70%：批量大小 - 1（最小 1）
 * - 成功率 70-90%：保持不变
 *
 * 使用场景：
 * - 分镜批量生成时确定批量大小
 * - API 调用时动态调整并发数
 *
 * @module services/parsing/DynamicBatchSizer
 * @version 1.0.0
 */

/**
 * 滑动窗口中的 API 调用记录
 */
interface APICallRecord {
  /** 调用时间戳 */
  timestamp: number;
  /** 是否成功 */
  success: boolean;
}

/**
 * 配置选项
 */
export interface DynamicBatchSizerConfig {
  /** 滑动窗口大小（最近 N 次调用），默认 10 */
  windowSize?: number;
  /** 基础批量大小，默认 2 */
  baseBatchSize?: number;
  /** 最小批量大小，默认 1 */
  minBatchSize?: number;
  /** 最大批量大小，默认 3 */
  maxBatchSize?: number;
  /** 高成功率阈值（>此值增加批量），默认 0.9 */
  highSuccessThreshold?: number;
  /** 低成功率阈值（<此值减少批量），默认 0.7 */
  lowSuccessThreshold?: number;
  /** 调整频率限制（每 N 次调用最多调整 1 次），默认 5 */
  adjustmentFrequency?: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<DynamicBatchSizerConfig> = {
  windowSize: 10,
  baseBatchSize: 2,
  minBatchSize: 1,
  maxBatchSize: 3,
  highSuccessThreshold: 0.9,
  lowSuccessThreshold: 0.7,
  adjustmentFrequency: 5,
};

/**
 * 动态批量大小调整器
 *
 * 基于滑动窗口统计的 API 成功率，动态调整批量大小
 */
export class DynamicBatchSizer {
  private config: Required<DynamicBatchSizerConfig>;
  private callHistory: APICallRecord[] = [];
  private currentBatchSize: number;
  private lastAdjustmentCallCount: number = 0;
  private totalCalls: number = 0;

  /**
   * 构造函数
   * @param config - 配置选项
   */
  constructor(config: DynamicBatchSizerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentBatchSize = this.config.baseBatchSize;
  }

  /**
   * 记录一次 API 调用
   * @param success - 是否成功
   */
  recordAPICall(success: boolean): void {
    const record: APICallRecord = {
      timestamp: Date.now(),
      success,
    };

    // 添加到历史记录
    this.callHistory.push(record);
    this.totalCalls++;

    // 维护滑动窗口大小
    if (this.callHistory.length > this.config.windowSize) {
      this.callHistory.shift();
    }

    // 尝试调整批量大小
    this.maybeAdjustBatchSize();
  }

  /**
   * 获取当前最优批量大小
   * @returns 批量大小
   */
  getOptimalBatchSize(): number {
    return this.currentBatchSize;
  }

  /**
   * 获取当前成功率
   * @returns 成功率（0-1）
   */
  getSuccessRate(): number {
    if (this.callHistory.length === 0) {
      return 1.0; // 没有历史记录时返回 100%
    }

    const successCount = this.callHistory.filter(record => record.success).length;
    return successCount / this.callHistory.length;
  }

  /**
   * 获取滑动窗口统计信息
   * @returns 统计信息
   */
  getWindowStats(): {
    totalCalls: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    windowSize: number;
  } {
    const successCount = this.callHistory.filter(record => record.success).length;
    const failureCount = this.callHistory.length - successCount;

    return {
      totalCalls: this.callHistory.length,
      successCount,
      failureCount,
      successRate: this.getSuccessRate(),
      windowSize: this.callHistory.length,
    };
  }

  /**
   * 获取详细的调整建议
   * @returns 调整建议信息
   */
  getAdjustmentAdvice(): {
    currentBatchSize: number;
    recommendedBatchSize: number;
    shouldAdjust: boolean;
    reason: string;
    stats: {
      successRate: number;
      windowSize: number;
      recentCalls: number;
    };
  } {
    const stats = this.getWindowStats();
    const successRate = stats.successRate;
    const recommendedSize = this.calculateRecommendedSize(successRate);
    const shouldAdjust = this.shouldPerformAdjustment(recommendedSize);
    const reason = this.getAdjustmentReason(successRate, recommendedSize);

    return {
      currentBatchSize: this.currentBatchSize,
      recommendedBatchSize: recommendedSize,
      shouldAdjust,
      reason,
      stats: {
        successRate,
        windowSize: stats.windowSize,
        recentCalls: this.totalCalls,
      },
    };
  }

  /**
   * 重置调整器状态
   * @param resetToBatchSize - 重置后的批量大小（可选，默认为基础批量大小）
   */
  reset(resetToBatchSize?: number): void {
    this.callHistory = [];
    this.currentBatchSize = resetToBatchSize ?? this.config.baseBatchSize;
    this.lastAdjustmentCallCount = 0;
    this.totalCalls = 0;
  }

  /**
   * 更新配置
   * @param config - 部分配置更新
   */
  updateConfig(config: Partial<DynamicBatchSizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   * @returns 当前配置
   */
  getConfig(): DynamicBatchSizerConfig {
    return { ...this.config };
  }

  /**
   * 获取总调用次数
   * @returns 总调用次数
   */
  getTotalCalls(): number {
    return this.totalCalls;
  }

  /**
   * 获取历史调用记录
   * @returns 调用记录数组
   */
  getCallHistory(): APICallRecord[] {
    return [...this.callHistory];
  }

  /**
   * 尝试调整批量大小
   */
  private maybeAdjustBatchSize(): void {
    const recommendedSize = this.calculateRecommendedSize(this.getSuccessRate());

    if (this.shouldPerformAdjustment(recommendedSize)) {
      this.adjustBatchSize(recommendedSize);
    }
  }

  /**
   * 计算推荐的批量大小
   * @param successRate - 成功率
   * @returns 推荐的批量大小
   */
  private calculateRecommendedSize(successRate: number): number {
    if (successRate > this.config.highSuccessThreshold) {
      // 成功率高，增加批量大小
      return Math.min(this.currentBatchSize + 1, this.config.maxBatchSize);
    } else if (successRate < this.config.lowSuccessThreshold) {
      // 成功率低，减少批量大小
      return Math.max(this.currentBatchSize - 1, this.config.minBatchSize);
    } else {
      // 成功率中等，保持不变
      return this.currentBatchSize;
    }
  }

  /**
   * 判断是否应该执行调整
   * @param recommendedSize - 推荐的批量大小
   * @returns 是否应该调整
   */
  private shouldPerformAdjustment(recommendedSize: number): boolean {
    // 如果推荐大小与当前大小相同，不需要调整
    if (recommendedSize === this.currentBatchSize) {
      return false;
    }

    // 检查是否达到调整频率限制
    const callsSinceLastAdjustment = this.totalCalls - this.lastAdjustmentCallCount;
    if (callsSinceLastAdjustment < this.config.adjustmentFrequency) {
      return false;
    }

    // 确保有足够的历史记录
    if (this.callHistory.length < Math.min(5, this.config.windowSize)) {
      return false;
    }

    return true;
  }

  /**
   * 获取调整原因
   * @param successRate - 成功率
   * @param recommendedSize - 推荐大小
   * @returns 调整原因描述
   */
  private getAdjustmentReason(successRate: number, recommendedSize: number): string {
    if (recommendedSize > this.currentBatchSize) {
      return `成功率 ${Math.round(successRate * 100)}% > ${Math.round(this.config.highSuccessThreshold * 100)}%，增加批量大小`;
    } else if (recommendedSize < this.currentBatchSize) {
      return `成功率 ${Math.round(successRate * 100)}% < ${Math.round(this.config.lowSuccessThreshold * 100)}%，减少批量大小`;
    } else {
      return `成功率 ${Math.round(successRate * 100)}% 在正常范围内，保持当前批量大小`;
    }
  }

  /**
   * 执行批量大小调整
   * @param newSize - 新的批量大小
   */
  private adjustBatchSize(newSize: number): void {
    const oldSize = this.currentBatchSize;
    this.currentBatchSize = newSize;
    this.lastAdjustmentCallCount = this.totalCalls;

    console.log(`[DynamicBatchSizer] 批量大小调整：${oldSize} → ${newSize}`);
    console.log(
      `[DynamicBatchSizer] 原因：${this.getAdjustmentReason(this.getSuccessRate(), newSize)}`
    );
    console.log(`[DynamicBatchSizer] 统计：${JSON.stringify(this.getWindowStats())}`);
  }
}

/**
 * 创建动态批量大小调整器实例
 * @param config - 配置选项
 * @returns 调整器实例
 */
export function createDynamicBatchSizer(config: DynamicBatchSizerConfig = {}): DynamicBatchSizer {
  return new DynamicBatchSizer(config);
}
