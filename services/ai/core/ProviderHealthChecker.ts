/**
 * Provider健康检查系统
 * 
 * 功能：
 * - 实时Provider可用性检测
 * - 连接状态监控
 * - 自动故障切换支持
 * - 健康状态历史记录
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import type { ModelConfig } from '../../../types';
import { providerPluginManager } from './ProviderPluginManager';
import { environmentConfigLoader } from './EnvironmentConfigLoader';

/**
 * 健康状态
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  status: HealthStatus;
  providerId: string;
  modelId?: string;
  responseTime: number;
  lastChecked: string;
  message?: string;
  error?: string;
  details?: Record<string, any>;
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  retries: number;
  degradedThreshold: number;
  unhealthyThreshold: number;
}

/**
 * Provider健康状态
 */
export interface ProviderHealth {
  providerId: string;
  overallStatus: HealthStatus;
  models: Map<string, HealthCheckResult>;
  lastCheck: string;
  consecutiveFailures: number;
  averageResponseTime: number;
}

/**
 * 健康检查事件
 */
export interface HealthCheckEvent {
  type: 'status_change' | 'degraded' | 'recovered' | 'failure';
  providerId: string;
  modelId?: string;
  previousStatus?: HealthStatus;
  currentStatus: HealthStatus;
  timestamp: string;
  message?: string;
}

/**
 * 健康检查监听器
 */
export type HealthCheckListener = (event: HealthCheckEvent) => void;

/**
 * 默认健康检查配置
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  enabled: true,
  interval: 60000, // 1分钟
  timeout: 10000,  // 10秒
  retries: 2,
  degradedThreshold: 3000,  // 3秒以上视为降级
  unhealthyThreshold: 10000 // 10秒以上视为不健康
};

/**
 * Provider健康检查器
 */
export class ProviderHealthChecker {
  private healthStatus: Map<string, ProviderHealth> = new Map();
  private checkIntervals: Map<string, number> = new Map();
  private listeners: HealthCheckListener[] = [];
  private config: HealthCheckConfig;

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = { ...DEFAULT_HEALTH_CHECK_CONFIG, ...config };
  }

  /**
   * 注册Provider进行健康检查
   */
  registerProvider(providerId: string, modelConfigs?: ModelConfig[]): void {
    if (this.healthStatus.has(providerId)) {
      return; // 已注册
    }

    const health: ProviderHealth = {
      providerId,
      overallStatus: 'unknown',
      models: new Map(),
      lastCheck: new Date().toISOString(),
      consecutiveFailures: 0,
      averageResponseTime: 0
    };

    // 如果有模型配置，为每个模型初始化状态
    if (modelConfigs) {
      for (const config of modelConfigs) {
        health.models.set(config.modelId, {
          status: 'unknown',
          providerId,
          modelId: config.modelId,
          responseTime: 0,
          lastChecked: new Date().toISOString()
        });
      }
    }

    this.healthStatus.set(providerId, health);

    // 启动定期检查
    if (this.config.enabled) {
      this.startPeriodicCheck(providerId);
    }
  }

  /**
   * 取消注册Provider
   */
  unregisterProvider(providerId: string): void {
    this.stopPeriodicCheck(providerId);
    this.healthStatus.delete(providerId);
  }

  /**
   * 执行健康检查
   */
  async checkHealth(providerId: string, modelId?: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const provider = providerPluginManager.getProvider(providerId);
      
      if (!provider) {
        const result: HealthCheckResult = {
          status: 'unhealthy',
          providerId,
          modelId,
          responseTime: Date.now() - startTime,
          lastChecked: new Date().toISOString(),
          error: 'Provider not found'
        };
        this.updateHealthStatus(result);
        return result;
      }

      // 执行Provider健康检查
      const checkResult = await provider.healthCheck();
      const responseTime = Date.now() - startTime;

      // 根据响应时间确定状态
      let status: HealthStatus = 'healthy';
      if (responseTime > this.config.unhealthyThreshold) {
        status = 'unhealthy';
      } else if (responseTime > this.config.degradedThreshold) {
        status = 'degraded';
      }

      // 如果Provider返回不健康状态
      if (!checkResult.healthy) {
        status = 'unhealthy';
      }

      const result: HealthCheckResult = {
        status,
        providerId,
        modelId,
        responseTime,
        lastChecked: new Date().toISOString(),
        message: checkResult.message,
        details: checkResult.details
      };

      this.updateHealthStatus(result);
      return result;

    } catch (error) {
      const result: HealthCheckResult = {
        status: 'unhealthy',
        providerId,
        modelId,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      this.updateHealthStatus(result);
      return result;
    }
  }

  /**
   * 批量检查所有Provider
   */
  async checkAllHealth(): Promise<Map<string, ProviderHealth>> {
    const promises: Promise<void>[] = [];

    for (const providerId of this.healthStatus.keys()) {
      promises.push(
        this.checkHealth(providerId).then(() => {
          // 检查该Provider下的所有模型
          const health = this.healthStatus.get(providerId);
          if (health) {
            const modelChecks = Array.from(health.models.keys()).map(modelId =>
              this.checkHealth(providerId, modelId)
            );
            return Promise.all(modelChecks).then(() => undefined);
          }
        })
      );
    }

    await Promise.all(promises);
    return new Map(this.healthStatus);
  }

  /**
   * 获取Provider健康状态
   */
  getProviderHealth(providerId: string): ProviderHealth | undefined {
    return this.healthStatus.get(providerId);
  }

  /**
   * 获取所有Provider健康状态
   */
  getAllHealth(): Map<string, ProviderHealth> {
    return new Map(this.healthStatus);
  }

  /**
   * 获取健康的Provider列表
   */
  getHealthyProviders(): string[] {
    const healthy: string[] = [];
    for (const [providerId, health] of this.healthStatus) {
      if (health.overallStatus === 'healthy') {
        healthy.push(providerId);
      }
    }
    return healthy;
  }

  /**
   * 获取不健康的Provider列表
   */
  getUnhealthyProviders(): string[] {
    const unhealthy: string[] = [];
    for (const [providerId, health] of this.healthStatus) {
      if (health.overallStatus === 'unhealthy') {
        unhealthy.push(providerId);
      }
    }
    return unhealthy;
  }

  /**
   * 检查Provider是否健康
   */
  isHealthy(providerId: string): boolean {
    const health = this.healthStatus.get(providerId);
    return health?.overallStatus === 'healthy';
  }

  /**
   * 获取推荐Provider（健康且响应快）
   */
  getRecommendedProvider(preferredProvider?: string): string | null {
    // 如果指定了首选Provider且健康，直接使用
    if (preferredProvider && this.isHealthy(preferredProvider)) {
      return preferredProvider;
    }

    // 获取所有健康的Provider
    const healthy = this.getHealthyProviders();
    if (healthy.length === 0) {
      return null;
    }

    // 按平均响应时间排序
    const sorted = healthy
      .map(id => ({
        id,
        responseTime: this.healthStatus.get(id)?.averageResponseTime || Infinity
      }))
      .sort((a, b) => a.responseTime - b.responseTime);

    return sorted[0]?.id || null;
  }

  /**
   * 添加健康检查监听器
   */
  addListener(listener: HealthCheckListener): () => void {
    this.listeners.push(listener);
    
    // 返回取消订阅函数
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 启动定期检查
   */
  startPeriodicCheck(providerId: string): void {
    // 先停止现有的
    this.stopPeriodicCheck(providerId);

    // 立即执行一次检查
    this.checkHealth(providerId);

    // 设置定时器
    const intervalId = window.setInterval(() => {
      this.checkHealth(providerId);
    }, this.config.interval);

    this.checkIntervals.set(providerId, intervalId);
  }

  /**
   * 停止定期检查
   */
  stopPeriodicCheck(providerId: string): void {
    const intervalId = this.checkIntervals.get(providerId);
    if (intervalId) {
      clearInterval(intervalId);
      this.checkIntervals.delete(providerId);
    }
  }

  /**
   * 启动所有Provider的定期检查
   */
  startAll(): void {
    for (const providerId of this.healthStatus.keys()) {
      this.startPeriodicCheck(providerId);
    }
  }

  /**
   * 停止所有Provider的定期检查
   */
  stopAll(): void {
    for (const providerId of this.checkIntervals.keys()) {
      this.stopPeriodicCheck(providerId);
    }
  }

  /**
   * 更新健康状态
   */
  private updateHealthStatus(result: HealthCheckResult): void {
    const health = this.healthStatus.get(result.providerId);
    if (!health) return;

    const previousStatus = health.overallStatus;
    const previousModelStatus = result.modelId 
      ? health.models.get(result.modelId)?.status 
      : undefined;

    // 更新模型状态
    if (result.modelId) {
      health.models.set(result.modelId, result);
    }

    // 计算整体状态
    const modelStatuses = Array.from(health.models.values()).map(m => m.status);
    const hasUnhealthy = modelStatuses.includes('unhealthy');
    const hasDegraded = modelStatuses.includes('degraded');
    const allHealthy = modelStatuses.every(s => s === 'healthy');

    if (hasUnhealthy) {
      health.overallStatus = 'unhealthy';
      health.consecutiveFailures++;
    } else if (hasDegraded) {
      health.overallStatus = 'degraded';
      health.consecutiveFailures = 0;
    } else if (allHealthy) {
      health.overallStatus = 'healthy';
      health.consecutiveFailures = 0;
    }

    // 计算平均响应时间
    const responseTimes = Array.from(health.models.values())
      .map(m => m.responseTime)
      .filter(rt => rt > 0);
    
    if (responseTimes.length > 0) {
      health.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }

    health.lastCheck = new Date().toISOString();

    // 触发事件
    if (previousStatus !== health.overallStatus || previousModelStatus !== result.status) {
      this.emitEvent({
        type: 'status_change',
        providerId: result.providerId,
        modelId: result.modelId,
        previousStatus: previousModelStatus || previousStatus,
        currentStatus: result.status,
        timestamp: new Date().toISOString(),
        message: result.message || result.error
      });
    }

    // 特定事件
    if (previousStatus !== 'healthy' && health.overallStatus === 'healthy') {
      this.emitEvent({
        type: 'recovered',
        providerId: result.providerId,
        currentStatus: 'healthy',
        timestamp: new Date().toISOString()
      });
    }

    if (previousStatus !== 'unhealthy' && health.overallStatus === 'unhealthy') {
      this.emitEvent({
        type: 'failure',
        providerId: result.providerId,
        currentStatus: 'unhealthy',
        timestamp: new Date().toISOString(),
        message: result.error
      });
    }
  }

  /**
   * 触发事件
   */
  private emitEvent(event: HealthCheckEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[ProviderHealthChecker] Listener error:', error);
      }
    }
  }

  /**
   * 获取健康检查统计
   */
  getStatistics(): {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
    averageResponseTime: number;
  } {
    const stats = {
      total: this.healthStatus.size,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      unknown: 0,
      averageResponseTime: 0
    };

    let totalResponseTime = 0;

    for (const health of this.healthStatus.values()) {
      switch (health.overallStatus) {
        case 'healthy':
          stats.healthy++;
          break;
        case 'degraded':
          stats.degraded++;
          break;
        case 'unhealthy':
          stats.unhealthy++;
          break;
        default:
          stats.unknown++;
      }
      totalResponseTime += health.averageResponseTime;
    }

    if (stats.total > 0) {
      stats.averageResponseTime = totalResponseTime / stats.total;
    }

    return stats;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stopAll();
    this.listeners = [];
    this.healthStatus.clear();
  }
}

// 全局单例
export const providerHealthChecker = new ProviderHealthChecker();

// 便捷导出
export default providerHealthChecker;
