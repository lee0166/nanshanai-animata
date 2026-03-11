/**
 * CircuitBreaker - 熔断器服务
 *
 * 职责：防止系统雪崩效应，保护系统稳定性
 *
 * 核心功能：
 * 1. 三种状态管理（Closed 正常、Open 熔断、Half-Open 半开）
 * 2. 失败计数器实现
 * 3. 自动熔断（连续失败 5 次）
 * 4. 暂停和恢复逻辑（30 秒后尝试恢复）
 * 5. 状态转换日志记录
 *
 * 状态转换：
 * - Closed → Open: 连续失败 5 次
 * - Open → Half-Open: 暂停 30 秒后
 * - Half-Open → Closed: 一次成功
 * - Half-Open → Open: 再次失败
 *
 * 使用场景：
 * - API 调用前检查是否可以执行
 * - 记录 API 调用的成功/失败
 * - 防止在系统不稳定时继续请求
 *
 * @module services/parsing/CircuitBreaker
 * @version 1.0.0
 */

/**
 * 熔断器状态
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * 熔断器配置
 */
export interface CircuitBreakerConfig {
  /** 连续失败多少次后触发熔断，默认 5 */
  failureThreshold?: number;
  /** 熔断后暂停时间（毫秒），默认 30000ms (30 秒) */
  resetTimeout?: number;
  /** 半开状态下允许多少次试探请求，默认 1 */
  halfOpenMaxAttempts?: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  resetTimeout: 30000,
  halfOpenMaxAttempts: 1,
};

/**
 * 熔断器类
 */
export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig>;
  private state: CircuitState = 'closed';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenAttempts: number = 0;
  private totalCircuitBreaks: number = 0;

  /**
   * 构造函数
   * @param config - 配置选项
   */
  constructor(config: CircuitBreakerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('[CircuitBreaker] Initialized with config:', this.config);
  }

  /**
   * 检查是否可以执行请求
   * @returns 是否允许执行
   */
  canProceed(): boolean {
    const now = Date.now();

    switch (this.state) {
      case 'closed':
        return true;

      case 'open': {
        // 检查是否已过暂停期
        const timeSinceLastFailure = now - this.lastFailureTime;
        if (timeSinceLastFailure >= this.config.resetTimeout) {
          this.transitionTo('half-open');
          return true;
        }
        return false;
      }

      case 'half-open':
        // 半开状态允许有限的试探请求
        return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;

      default:
        return true;
    }
  }

  /**
   * 记录一次成功
   */
  recordSuccess(): void {
    this.successCount++;
    this.halfOpenAttempts = 0;

    if (this.state === 'half-open') {
      // 半开状态下成功，关闭熔断器
      this.transitionTo('closed');
      this.failureCount = 0;
      console.log('[CircuitBreaker] Circuit closed after successful probe');
    } else if (this.state === 'closed') {
      // 正常状态下成功，重置失败计数
      this.failureCount = 0;
    }
  }

  /**
   * 记录一次失败
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.halfOpenAttempts++;

    if (this.state === 'half-open') {
      // 半开状态下失败，立即重新熔断
      this.transitionTo('open');
      this.totalCircuitBreaks++;
      console.log('[CircuitBreaker] Circuit re-opened after failed probe');
    } else if (this.state === 'closed') {
      // 正常状态下达到失败阈值，触发熔断
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo('open');
        this.totalCircuitBreaks++;
        console.log(
          `[CircuitBreaker] Circuit opened after ${this.failureCount} consecutive failures`
        );
      }
    }
  }

  /**
   * 获取当前状态
   * @returns 当前状态
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 获取状态描述
   * @returns 状态描述
   */
  getStateDescription(): string {
    switch (this.state) {
      case 'closed':
        return '正常状态';
      case 'open': {
        const timeSinceFailure = Date.now() - this.lastFailureTime;
        const remainingTime = Math.max(0, this.config.resetTimeout - timeSinceFailure);
        return `熔断状态（${(remainingTime / 1000).toFixed(1)}秒后可恢复）`;
      }
      case 'half-open':
        return '半开状态（试探恢复中）';
      default:
        return '未知状态';
    }
  }

  /**
   * 获取统计信息
   * @returns 统计信息
   */
  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    totalCircuitBreaks: number;
    halfOpenAttempts: number;
    timeSinceLastFailure: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCircuitBreaks: this.totalCircuitBreaks,
      halfOpenAttempts: this.halfOpenAttempts,
      timeSinceLastFailure: Date.now() - this.lastFailureTime,
    };
  }

  /**
   * 重置熔断器
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
    console.log('[CircuitBreaker] Reset to initial state');
  }

  /**
   * 强制打开熔断器（用于手动维护）
   */
  forceOpen(): void {
    this.transitionTo('open');
    this.lastFailureTime = Date.now();
    this.totalCircuitBreaks++;
    console.log('[CircuitBreaker] Manually opened');
  }

  /**
   * 强制关闭熔断器（用于手动维护）
   */
  forceClose(): void {
    this.transitionTo('closed');
    this.failureCount = 0;
    console.log('[CircuitBreaker] Manually closed');
  }

  /**
   * 状态转换
   * @param newState - 新状态
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    console.log(`[CircuitBreaker] State transition: ${oldState} → ${newState}`);
    console.log(`[CircuitBreaker] Stats:`, this.getStats());
  }
}

/**
 * 创建熔断器实例
 * @param config - 配置选项
 * @returns 熔断器实例
 */
export function createCircuitBreaker(config: CircuitBreakerConfig = {}): CircuitBreaker {
  return new CircuitBreaker(config);
}
