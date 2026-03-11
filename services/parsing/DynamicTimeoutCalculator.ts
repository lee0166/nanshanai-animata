/**
 * DynamicTimeoutCalculator - 动态超时计算器
 *
 * 职责：基于历史 API 响应时间，动态计算最优超时时间
 *
 * 核心功能：
 * 1. 记录最近 N 次成功的 API 响应时间
 * 2. 计算平均响应时间
 * 3. 基于平均时间动态计算超时（avgTime * 2.5）
 * 4. 限制在合理范围内（60-300 秒）
 *
 * 计算策略：
 * - 超时时间 = 平均响应时间 × 2.5（安全系数）
 * - 最小超时：60 秒（避免过短）
 * - 最大超时：300 秒（避免过长等待）
 * - 无历史数据时使用默认值：90 秒
 *
 * 使用场景：
 * - LLM API 调用前计算超时
 * - 分镜生成请求超时设置
 * - 任何需要动态超时的场景
 *
 * @module services/parsing/DynamicTimeoutCalculator
 * @version 1.0.0
 */

/**
 * 配置选项
 */
export interface DynamicTimeoutCalculatorConfig {
  /** 历史记录大小（最近 N 次成功响应），默认 5 */
  historySize?: number;
  /** 安全系数（平均时间×系数），默认 2.5 */
  safetyFactor?: number;
  /** 最小超时时间（毫秒），默认 60000ms (60 秒) */
  minTimeout?: number;
  /** 最大超时时间（毫秒），默认 300000ms (300 秒) */
  maxTimeout?: number;
  /** 默认超时时间（无历史数据时），默认 90000ms (90 秒) */
  defaultTimeout?: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<DynamicTimeoutCalculatorConfig> = {
  historySize: 5,
  safetyFactor: 2.5,
  minTimeout: 60000, // 60 秒
  maxTimeout: 300000, // 300 秒
  defaultTimeout: 90000, // 90 秒
};

/**
 * 动态超时计算器
 *
 * 基于历史响应时间动态计算最优超时
 */
export class DynamicTimeoutCalculator {
  private config: Required<DynamicTimeoutCalculatorConfig>;
  private responseTimes: number[] = [];
  private totalCalls: number = 0;
  private successfulCalls: number = 0;

  /**
   * 构造函数
   * @param config - 配置选项
   */
  constructor(config: DynamicTimeoutCalculatorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 记录一次成功的 API 响应时间
   * @param responseTimeMs - 响应时间（毫秒）
   */
  recordResponseTime(responseTimeMs: number): void {
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

    console.log(`[DynamicTimeoutCalculator] Recorded response time: ${responseTimeMs}ms`);
    console.log(`[DynamicTimeoutCalculator] History: [${this.responseTimes.join(', ')}]ms`);
  }

  /**
   * 记录一次失败的 API 调用（不记录时间，只计数）
   */
  recordFailure(): void {
    this.totalCalls++;
    console.log('[DynamicTimeoutCalculator] Recorded failure');
  }

  /**
   * 获取当前计算的超时时间
   * @returns 超时时间（毫秒）
   */
  getTimeout(): number {
    if (this.responseTimes.length === 0) {
      return this.config.defaultTimeout;
    }

    const avgTime = this.getAverageResponseTime();
    const timeout = avgTime * this.config.safetyFactor;
    const clampedTimeout = Math.max(
      this.config.minTimeout,
      Math.min(timeout, this.config.maxTimeout)
    );

    console.log(`[DynamicTimeoutCalculator] Calculated timeout:`);
    console.log(`  - Average response time: ${avgTime.toFixed(0)}ms`);
    console.log(`  - Safety factor: ${this.config.safetyFactor}`);
    console.log(`  - Raw timeout: ${timeout.toFixed(0)}ms`);
    console.log(
      `  - Clamped timeout: ${clampedTimeout.toFixed(0)}ms (${(clampedTimeout / 1000).toFixed(1)}s)`
    );

    return clampedTimeout;
  }

  /**
   * 获取平均响应时间
   * @returns 平均响应时间（毫秒）
   */
  getAverageResponseTime(): number {
    if (this.responseTimes.length === 0) {
      return this.config.defaultTimeout / this.config.safetyFactor;
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
      return `无历史数据，使用默认超时 ${this.config.defaultTimeout / 1000}秒`;
    }

    const avgTime = this.getAverageResponseTime();
    const rawTimeout = avgTime * this.config.safetyFactor;

    if (rawTimeout < this.config.minTimeout) {
      return `平均响应时间 ${avgTime.toFixed(0)}ms × ${this.config.safetyFactor} = ${rawTimeout.toFixed(0)}ms < 最小超时，使用最小超时 ${this.config.minTimeout / 1000}秒`;
    } else if (rawTimeout > this.config.maxTimeout) {
      return `平均响应时间 ${avgTime.toFixed(0)}ms × ${this.config.safetyFactor} = ${rawTimeout.toFixed(0)}ms > 最大超时，使用最大超时 ${this.config.maxTimeout / 1000}秒`;
    } else {
      return `基于最近 ${this.responseTimes.length} 次成功响应的平均时间 ${avgTime.toFixed(0)}ms × ${this.config.safetyFactor} = ${rawTimeout.toFixed(0)}ms`;
    }
  }
}

/**
 * 创建动态超时计算器实例
 * @param config - 配置选项
 * @returns 计算器实例
 */
export function createDynamicTimeoutCalculator(
  config: DynamicTimeoutCalculatorConfig = {}
): DynamicTimeoutCalculator {
  return new DynamicTimeoutCalculator(config);
}
