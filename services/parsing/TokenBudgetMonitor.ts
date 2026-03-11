/**
 * TokenBudgetMonitor - Token 预算监控服务
 *
 * 职责：监控 Token 使用情况，防止 Token 使用失控
 *
 * 核心功能：
 * 1. 设置 Token 预算上限
 * 2. 实时统计已用 Token
 * 3. 预算使用百分比计算
 * 4. 超出预算时发出警告
 * 5. 预算耗尽时阻止进一步请求
 *
 * 使用场景：
 * - 剧本解析前设置预算
 * - 每次 API 调用后更新使用量
 * - 超出预警线时提示用户
 * - 预算耗尽时停止解析
 *
 * @module services/parsing/TokenBudgetMonitor
 * @version 1.0.0
 */

/**
 * 预算警告级别
 */
export type BudgetWarningLevel = 'none' | 'warning' | 'critical' | 'exhausted';

/**
 * 配置选项
 */
export interface TokenBudgetConfig {
  /** 预算上限（tokens），默认 100000 */
  budgetLimit?: number;
  /** 预警线（使用达到此百分比时警告），默认 0.8 (80%) */
  warningThreshold?: number;
  /** 严重警告线，默认 0.9 (90%) */
  criticalThreshold?: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<TokenBudgetConfig> = {
  budgetLimit: 100000,
  warningThreshold: 0.8,
  criticalThreshold: 0.9,
};

/**
 * Token 预算监控器
 */
export class TokenBudgetMonitor {
  private config: Required<TokenBudgetConfig>;
  private usedTokens: number = 0;
  private totalRequests: number = 0;
  private warningTriggered: boolean = false;
  private criticalTriggered: boolean = false;

  /**
   * 构造函数
   * @param config - 配置选项
   */
  constructor(config: TokenBudgetConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('[TokenBudgetMonitor] Initialized with config:', this.config);
  }

  /**
   * 检查是否可以执行请求
   * @returns 是否允许执行
   */
  canProceed(): boolean {
    return this.usedTokens < this.config.budgetLimit;
  }

  /**
   * 获取当前警告级别
   * @returns 警告级别
   */
  getWarningLevel(): BudgetWarningLevel {
    const usage = this.getUsagePercentage();

    if (usage >= 1.0) {
      return 'exhausted';
    } else if (usage >= this.config.criticalThreshold) {
      return 'critical';
    } else if (usage >= this.config.warningThreshold) {
      return 'warning';
    } else {
      return 'none';
    }
  }

  /**
   * 记录 Token 使用
   * @param tokens - 使用的 Token 数量
   * @returns 是否触发警告
   */
  recordUsage(tokens: number): {
    canProceed: boolean;
    warningLevel: BudgetWarningLevel;
    message?: string;
  } {
    this.usedTokens += tokens;
    this.totalRequests++;

    const warningLevel = this.getWarningLevel();
    const usage = this.getUsagePercentage();

    // 触发警告
    let message: string | undefined;

    if (warningLevel === 'exhausted') {
      message = `❌ Token 预算已耗尽！已使用 ${this.formatNumber(this.usedTokens)}/${this.formatNumber(this.config.budgetLimit)} tokens (${(usage * 100).toFixed(1)}%)`;
      console.error('[TokenBudgetMonitor]', message);
    } else if (warningLevel === 'critical' && !this.criticalTriggered) {
      message = `⚠️ Token 预算严重不足！已使用 ${(usage * 100).toFixed(1)}%，剩余 ${this.formatNumber(this.getRemainingTokens())} tokens`;
      console.warn('[TokenBudgetMonitor]', message);
      this.criticalTriggered = true;
    } else if (warningLevel === 'warning' && !this.warningTriggered) {
      message = `💡 Token 预算使用提醒！已使用 ${(usage * 100).toFixed(1)}%，剩余 ${this.formatNumber(this.getRemainingTokens())} tokens`;
      console.log('[TokenBudgetMonitor]', message);
      this.warningTriggered = true;
    }

    return {
      canProceed: this.canProceed(),
      warningLevel,
      message,
    };
  }

  /**
   * 获取预算使用百分比
   * @returns 使用百分比 (0-1)
   */
  getUsagePercentage(): number {
    return this.usedTokens / this.config.budgetLimit;
  }

  /**
   * 获取剩余 Token 数量
   * @returns 剩余 tokens
   */
  getRemainingTokens(): number {
    return Math.max(0, this.config.budgetLimit - this.usedTokens);
  }

  /**
   * 获取已用 Token 数量
   * @returns 已用 tokens
   */
  getUsedTokens(): number {
    return this.usedTokens;
  }

  /**
   * 获取预算上限
   * @returns 预算上限
   */
  getBudgetLimit(): number {
    return this.config.budgetLimit;
  }

  /**
   * 获取统计信息
   * @returns 统计信息
   */
  getStats(): {
    usedTokens: number;
    budgetLimit: number;
    remainingTokens: number;
    usagePercentage: number;
    totalRequests: number;
    warningLevel: BudgetWarningLevel;
  } {
    return {
      usedTokens: this.usedTokens,
      budgetLimit: this.config.budgetLimit,
      remainingTokens: this.getRemainingTokens(),
      usagePercentage: this.getUsagePercentage(),
      totalRequests: this.totalRequests,
      warningLevel: this.getWarningLevel(),
    };
  }

  /**
   * 重置监控器
   */
  reset(): void {
    this.usedTokens = 0;
    this.totalRequests = 0;
    this.warningTriggered = false;
    this.criticalTriggered = false;
    console.log('[TokenBudgetMonitor] Reset to initial state');
  }

  /**
   * 更新预算配置
   * @param config - 部分配置更新
   */
  updateConfig(config: Partial<TokenBudgetConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[TokenBudgetMonitor] Config updated:', config);
  }

  /**
   * 获取当前配置
   * @returns 当前配置
   */
  getConfig(): TokenBudgetConfig {
    return { ...this.config };
  }

  /**
   * 格式化数字
   */
  private formatNumber(num: number): string {
    return num.toLocaleString('zh-CN');
  }
}

/**
 * 创建 Token 预算监控器实例
 * @param config - 配置选项
 * @returns 监控器实例
 */
export function createTokenBudgetMonitor(config: TokenBudgetConfig = {}): TokenBudgetMonitor {
  return new TokenBudgetMonitor(config);
}
