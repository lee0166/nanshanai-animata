/**
 * 智能路由与负载均衡器
 *
 * 功能：
 * - 根据模型能力自动选择最佳Provider
 * - 负载均衡（轮询、权重、最少连接）
 * - 故障自动切换
 * - 响应时间优化
 *
 * @author AI Assistant
 * @version 1.0.0
 */

import type { ModelConfig } from '../../../types';
import { providerHealthChecker, type HealthStatus } from './ProviderHealthChecker';
import { providerPluginManager } from './ProviderPluginManager';
import { modelConfigManager } from './ModelConfigManager';

/**
 * 路由策略
 */
export type RoutingStrategy = 'round-robin' | 'weighted' | 'least-response-time' | 'health-first' | 'capability-match';

/**
 * 路由请求
 */
export interface RoutingRequest {
  type: 'image' | 'video' | 'llm';
  capability: string;
  preferredProvider?: string;
  excludedProviders?: string[];
  priority?: number;
  timeout?: number;
}

/**
 * 路由结果
 */
export interface RoutingResult {
  providerId: string;
  modelConfig: ModelConfig;
  strategy: RoutingStrategy;
  reason: string;
  estimatedResponseTime?: number;
  alternatives: string[];
}

/**
 * Provider权重
 */
export interface ProviderWeight {
  providerId: string;
  weight: number;
  currentConnections: number;
  totalRequests: number;
  successfulRequests: number;
  averageResponseTime: number;
}

/**
 * 路由统计
 */
export interface RoutingStatistics {
  totalRequests: number;
  successfulRoutes: number;
  failedRoutes: number;
  averageDecisionTime: number;
  strategyUsage: Map<RoutingStrategy, number>;
}

/**
 * 智能路由器
 */
export class SmartRouter {
  private strategy: RoutingStrategy = 'health-first';
  private weights: Map<string, ProviderWeight> = new Map();
  private roundRobinIndex: number = 0;
  private statistics: RoutingStatistics = {
    totalRequests: 0,
    successfulRoutes: 0,
    failedRoutes: 0,
    averageDecisionTime: 0,
    strategyUsage: new Map()
  };
  private fallbackEnabled: boolean = true;
  private maxRetries: number = 3;

  constructor(strategy: RoutingStrategy = 'health-first') {
    this.strategy = strategy;
    this.initializeWeights();
  }

  /**
   * 初始化权重
   */
  private initializeWeights(): void {
    const configs = modelConfigManager.getAllConfigs();
    for (const config of configs) {
      this.weights.set(config.provider, {
        providerId: config.provider,
        weight: 1,
        currentConnections: 0,
        totalRequests: 0,
        successfulRequests: 0,
        averageResponseTime: 0
      });
    }
  }

  /**
   * 设置路由策略
   */
  setStrategy(strategy: RoutingStrategy): void {
    this.strategy = strategy;
  }

  /**
   * 获取当前策略
   */
  getStrategy(): RoutingStrategy {
    return this.strategy;
  }

  /**
   * 路由请求到最佳Provider
   */
  async route(request: RoutingRequest): Promise<RoutingResult | null> {
    const startTime = Date.now();
    this.statistics.totalRequests++;

    try {
      // 获取候选Provider
      const candidates = this.getCandidates(request);
      
      if (candidates.length === 0) {
        this.statistics.failedRoutes++;
        return null;
      }

      // 根据策略选择Provider
      let selected: ModelConfig;
      let reason: string;

      switch (this.strategy) {
        case 'round-robin':
          selected = this.roundRobinSelect(candidates);
          reason = '轮询选择';
          break;
        case 'weighted':
          selected = this.weightedSelect(candidates);
          reason = '权重选择';
          break;
        case 'least-response-time':
          selected = this.leastResponseTimeSelect(candidates);
          reason = '最小响应时间';
          break;
        case 'capability-match':
          selected = this.capabilityMatchSelect(candidates, request);
          reason = '能力匹配度';
          break;
        case 'health-first':
        default:
          selected = this.healthFirstSelect(candidates);
          reason = '健康优先';
          break;
      }

      // 记录策略使用
      const currentUsage = this.statistics.strategyUsage.get(this.strategy) || 0;
      this.statistics.strategyUsage.set(this.strategy, currentUsage + 1);

      // 更新权重统计
      this.updateWeightStats(selected.provider, true);

      // 计算决策时间
      const decisionTime = Date.now() - startTime;
      this.updateAverageDecisionTime(decisionTime);

      this.statistics.successfulRoutes++;

      // 获取备选Provider
      const alternatives = candidates
        .filter(c => c.provider !== selected.provider)
        .slice(0, 3)
        .map(c => c.provider);

      return {
        providerId: selected.provider,
        modelConfig: selected,
        strategy: this.strategy,
        reason,
        estimatedResponseTime: this.getEstimatedResponseTime(selected.provider),
        alternatives
      };

    } catch (error) {
      this.statistics.failedRoutes++;
      console.error('[SmartRouter] Routing failed:', error);
      return null;
    }
  }

  /**
   * 获取候选Provider
   */
  private getCandidates(request: RoutingRequest): ModelConfig[] {
    // 获取所有启用的配置
    let configs = modelConfigManager.getEnabledConfigs();

    // 按类型过滤
    configs = configs.filter(c => c.type === request.type);

    // 按能力过滤
    configs = configs.filter(c => {
      const caps = c.capabilities;
      switch (request.capability) {
        case 'textToImage':
          return caps?.textToImage;
        case 'imageToImage':
          return caps?.imageToImage;
        case 'imageToVideo':
          return caps?.imageToVideo;
        case 'textToVideo':
          return caps?.textToVideo;
        case 'textToText':
          return caps?.textToText;
        default:
          return true;
      }
    });

    // 排除指定的Provider
    if (request.excludedProviders) {
      configs = configs.filter(c => !request.excludedProviders?.includes(c.provider));
    }

    // 优先使用指定的Provider
    if (request.preferredProvider) {
      const preferred = configs.find(c => c.provider === request.preferredProvider);
      if (preferred && providerHealthChecker.isHealthy(request.preferredProvider)) {
        // 将优先的Provider放到最前面
        configs = [preferred, ...configs.filter(c => c.provider !== request.preferredProvider)];
      }
    }

    // 过滤掉不健康的Provider
    configs = configs.filter(c => providerHealthChecker.isHealthy(c.provider));

    return configs;
  }

  /**
   * 轮询选择
   */
  private roundRobinSelect(candidates: ModelConfig[]): ModelConfig {
    const index = this.roundRobinIndex % candidates.length;
    this.roundRobinIndex = (this.roundRobinIndex + 1) % candidates.length;
    return candidates[index];
  }

  /**
   * 权重选择
   */
  private weightedSelect(candidates: ModelConfig[]): ModelConfig {
    const totalWeight = candidates.reduce((sum, c) => {
      const weight = this.weights.get(c.provider)?.weight || 1;
      return sum + weight;
    }, 0);

    let random = Math.random() * totalWeight;
    
    for (const candidate of candidates) {
      const weight = this.weights.get(candidate.provider)?.weight || 1;
      random -= weight;
      if (random <= 0) {
        return candidate;
      }
    }

    return candidates[candidates.length - 1];
  }

  /**
   * 最小响应时间选择
   */
  private leastResponseTimeSelect(candidates: ModelConfig[]): ModelConfig {
    return candidates.reduce((best, current) => {
      const bestTime = this.getEstimatedResponseTime(best.provider);
      const currentTime = this.getEstimatedResponseTime(current.provider);
      return currentTime < bestTime ? current : best;
    });
  }

  /**
   * 健康优先选择
   */
  private healthFirstSelect(candidates: ModelConfig[]): ModelConfig {
    // 首先选择健康的
    const healthy = candidates.filter(c => providerHealthChecker.isHealthy(c.provider));
    
    if (healthy.length > 0) {
      // 在健康的里面选择响应时间最短的
      return this.leastResponseTimeSelect(healthy);
    }

    // 如果没有健康的，返回第一个（允许降级）
    return candidates[0];
  }

  /**
   * 能力匹配度选择
   */
  private capabilityMatchSelect(candidates: ModelConfig[], request: RoutingRequest): ModelConfig {
    // 计算每个候选者的匹配分数
    const scored = candidates.map(c => {
      let score = 0;
      const caps = c.capabilities;

      // 基础能力匹配
      if (request.capability && caps) {
        if ((caps as Record<string, boolean>)[request.capability]) {
          score += 10;
        }
      }

      // 健康状态加分
      if (providerHealthChecker.isHealthy(c.provider)) {
        score += 5;
      }

      // 响应时间加分（越快分越高）
      const avgTime = this.getEstimatedResponseTime(c.provider);
      if (avgTime > 0) {
        score += Math.max(0, 5 - avgTime / 1000);
      }

      // 成功率加分
      const weight = this.weights.get(c.provider);
      if (weight && weight.totalRequests > 0) {
        const successRate = weight.successfulRequests / weight.totalRequests;
        score += successRate * 3;
      }

      return { config: c, score };
    });

    // 按分数排序，返回最高分
    scored.sort((a, b) => b.score - a.score);
    return scored[0].config;
  }

  /**
   * 设置Provider权重
   */
  setProviderWeight(providerId: string, weight: number): void {
    const weightData = this.weights.get(providerId);
    if (weightData) {
      weightData.weight = Math.max(0.1, weight);
    }
  }

  /**
   * 获取Provider权重
   */
  getProviderWeight(providerId: string): number {
    return this.weights.get(providerId)?.weight || 1;
  }

  /**
   * 获取估计响应时间
   */
  private getEstimatedResponseTime(providerId: string): number {
    const health = providerHealthChecker.getProviderHealth(providerId);
    return health?.averageResponseTime || 5000;
  }

  /**
   * 更新权重统计
   */
  private updateWeightStats(providerId: string, success: boolean): void {
    const weight = this.weights.get(providerId);
    if (weight) {
      weight.totalRequests++;
      weight.currentConnections++;
      if (success) {
        weight.successfulRequests++;
      }
    }
  }

  /**
   * 释放连接
   */
  releaseConnection(providerId: string): void {
    const weight = this.weights.get(providerId);
    if (weight) {
      weight.currentConnections = Math.max(0, weight.currentConnections - 1);
    }
  }

  /**
   * 更新平均决策时间
   */
  private updateAverageDecisionTime(decisionTime: number): void {
    const total = this.statistics.totalRequests;
    this.statistics.averageDecisionTime = 
      (this.statistics.averageDecisionTime * (total - 1) + decisionTime) / total;
  }

  /**
   * 获取路由统计
   */
  getStatistics(): RoutingStatistics {
    return { ...this.statistics };
  }

  /**
   * 重置统计
   */
  resetStatistics(): void {
    this.statistics = {
      totalRequests: 0,
      successfulRoutes: 0,
      failedRoutes: 0,
      averageDecisionTime: 0,
      strategyUsage: new Map()
    };
  }

  /**
   * 启用/禁用故障转移
   */
  setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled;
  }

  /**
   * 设置最大重试次数
   */
  setMaxRetries(retries: number): void {
    this.maxRetries = Math.max(0, retries);
  }

  /**
   * 执行带故障转移的请求
   */
  async routeWithFallback(
    request: RoutingRequest,
    execute: (result: RoutingResult) => Promise<any>
  ): Promise<{ success: boolean; result?: any; attempts: number; errors: string[] }> {
    const errors: string[] = [];
    let attempts = 0;
    const excludedProviders: string[] = [...(request.excludedProviders || [])];

    while (attempts < this.maxRetries) {
      const routeResult = await this.route({
        ...request,
        excludedProviders
      });

      if (!routeResult) {
        return { success: false, attempts, errors: [...errors, 'No available provider'] };
      }

      attempts++;

      try {
        const result = await execute(routeResult);
        this.releaseConnection(routeResult.providerId);
        return { success: true, result, attempts, errors };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`[${routeResult.providerId}] ${errorMsg}`);
        
        // 排除失败的Provider
        excludedProviders.push(routeResult.providerId);
        this.releaseConnection(routeResult.providerId);

        if (!this.fallbackEnabled) {
          break;
        }
      }
    }

    return { success: false, attempts, errors };
  }

  /**
   * 预热Provider
   */
  async warmup(providers?: string[]): Promise<void> {
    const targetProviders = providers || Array.from(this.weights.keys());
    
    await Promise.all(
      targetProviders.map(async providerId => {
        try {
          const health = await providerHealthChecker.checkHealth(providerId);
          console.log(`[SmartRouter] Provider ${providerId} warmed up: ${health.status}`);
        } catch (error) {
          console.warn(`[SmartRouter] Failed to warmup ${providerId}:`, error);
        }
      })
    );
  }

  /**
   * 获取负载分布
   */
  getLoadDistribution(): { providerId: string; load: number; percentage: number }[] {
    const totalConnections = Array.from(this.weights.values())
      .reduce((sum, w) => sum + w.currentConnections, 0);

    if (totalConnections === 0) {
      return Array.from(this.weights.keys()).map(id => ({
        providerId: id,
        load: 0,
        percentage: 0
      }));
    }

    return Array.from(this.weights.entries()).map(([providerId, weight]) => ({
      providerId,
      load: weight.currentConnections,
      percentage: (weight.currentConnections / totalConnections) * 100
    }));
  }
}

// 全局单例
export const smartRouter = new SmartRouter();

// 便捷导出
export default smartRouter;
