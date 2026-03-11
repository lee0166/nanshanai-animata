/**
 * 环境感知配置加载器
 *
 * 功能：
 * - 根据环境自动过滤开发测试专用模型
 * - 生产环境严格隔离魔搭社区等非商用API
 * - 支持环境变量覆盖配置
 * - 开发/测试/生产多环境适配
 *
 * @author AI Assistant
 * @version 1.0.0
 */

import type { ModelConfig, Environment } from '../../../types';
import { modelConfigManager } from './ModelConfigManager';

/**
 * 环境配置
 */
export interface EnvironmentConfig {
  name: string;
  isProduction: boolean;
  allowedProviders: string[];
  blockedProviders: string[];
  requireApiKey: boolean;
  allowDevModels: boolean;
  maxConcurrentJobs: number;
  requestTimeout: number;
  enableRetry: boolean;
  maxRetries: number;
}

/**
 * 预定义环境配置
 */
export const ENVIRONMENT_CONFIGS: Record<string, EnvironmentConfig> = {
  development: {
    name: 'development',
    isProduction: false,
    allowedProviders: ['*'], // 允许所有
    blockedProviders: [],
    requireApiKey: false,
    allowDevModels: true,
    maxConcurrentJobs: 2,
    requestTimeout: 120000,
    enableRetry: true,
    maxRetries: 3,
  },

  testing: {
    name: 'testing',
    isProduction: false,
    allowedProviders: ['*'],
    blockedProviders: [],
    requireApiKey: true, // 测试环境也建议验证API密钥
    allowDevModels: true,
    maxConcurrentJobs: 4,
    requestTimeout: 180000,
    enableRetry: true,
    maxRetries: 2,
  },

  staging: {
    name: 'staging',
    isProduction: false,
    allowedProviders: ['volcengine', 'aliyun', 'openai', 'anthropic', 'google'],
    blockedProviders: ['modelscope', 'localhost', '127.0.0.1'],
    requireApiKey: true,
    allowDevModels: false,
    maxConcurrentJobs: 8,
    requestTimeout: 300000,
    enableRetry: true,
    maxRetries: 3,
  },

  production: {
    name: 'production',
    isProduction: true,
    allowedProviders: ['volcengine', 'aliyun', 'openai', 'anthropic', 'google'],
    blockedProviders: ['modelscope', 'localhost', '127.0.0.1', '0.0.0.0'],
    requireApiKey: true,
    allowDevModels: false,
    maxConcurrentJobs: 16,
    requestTimeout: 600000,
    enableRetry: true,
    maxRetries: 5,
  },
};

/**
 * 开发测试专用Provider标识
 */
export const DEV_ONLY_PROVIDERS = [
  'modelscope',
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'test',
  'mock',
];

/**
 * 开发测试专用模型标识
 */
export const DEV_ONLY_MODEL_PATTERNS = [
  /modelscope/i,
  /test-/i,
  /mock-/i,
  /dev-/i,
  /localhost/i,
  /127\.0\.0\.1/i,
];

/**
 * 环境感知配置加载器
 */
export class EnvironmentConfigLoader {
  private currentEnv: string;
  private envConfig: EnvironmentConfig;

  constructor(env?: string) {
    this.currentEnv = env || this.detectEnvironment();
    this.envConfig = this.loadEnvironmentConfig(this.currentEnv);
  }

  /**
   * 检测当前环境
   */
  private detectEnvironment(): string {
    // 浏览器环境
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;

      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
      }

      if (hostname.includes('staging') || hostname.includes('test')) {
        return 'staging';
      }

      if (hostname.includes('prod') || hostname.includes('production')) {
        return 'production';
      }
    }

    // Node环境
    if (typeof process !== 'undefined') {
      const nodeEnv = process.env.NODE_ENV;

      if (nodeEnv === 'production') {
        return 'production';
      }

      if (nodeEnv === 'test' || nodeEnv === 'testing') {
        return 'testing';
      }

      if (nodeEnv === 'staging') {
        return 'staging';
      }
    }

    return 'development';
  }

  /**
   * 加载环境配置
   */
  private loadEnvironmentConfig(env: string): EnvironmentConfig {
    const config = ENVIRONMENT_CONFIGS[env];
    if (config) {
      return config;
    }

    // 自定义环境，继承production配置
    return {
      ...ENVIRONMENT_CONFIGS.production,
      name: env,
    };
  }

  /**
   * 获取当前环境名称
   */
  getCurrentEnvironment(): string {
    return this.currentEnv;
  }

  /**
   * 获取当前环境配置
   */
  getEnvironmentConfig(): EnvironmentConfig {
    return this.envConfig;
  }

  /**
   * 检查是否生产环境
   */
  isProduction(): boolean {
    return this.envConfig.isProduction;
  }

  /**
   * 检查Provider是否允许
   */
  isProviderAllowed(provider: string): boolean {
    // 检查是否在黑名单
    if (this.envConfig.blockedProviders.includes(provider.toLowerCase())) {
      return false;
    }

    // 检查是否在白名单（*表示允许所有）
    if (this.envConfig.allowedProviders.includes('*')) {
      return true;
    }

    return this.envConfig.allowedProviders.includes(provider.toLowerCase());
  }

  /**
   * 检查是否为开发测试专用模型
   */
  isDevOnlyModel(config: ModelConfig): boolean {
    // 检查Provider
    if (DEV_ONLY_PROVIDERS.includes(config.provider.toLowerCase())) {
      return true;
    }

    // 检查模型ID
    if (DEV_ONLY_MODEL_PATTERNS.some(pattern => pattern.test(config.modelId))) {
      return true;
    }

    // 检查模型名称
    if (DEV_ONLY_MODEL_PATTERNS.some(pattern => pattern.test(config.name))) {
      return true;
    }

    // 检查baseUrl
    if (config.baseUrl) {
      const lowerUrl = config.baseUrl.toLowerCase();
      if (DEV_ONLY_PROVIDERS.some(dev => lowerUrl.includes(dev))) {
        return true;
      }
    }

    return false;
  }

  /**
   * 过滤配置列表
   */
  filterConfigs(configs: ModelConfig[]): ModelConfig[] {
    return configs.filter(config => {
      // 检查Provider是否允许
      if (!this.isProviderAllowed(config.provider)) {
        console.warn(
          `[EnvironmentConfigLoader] 过滤掉不允许的Provider: ${config.provider} (${config.name})`
        );
        return false;
      }

      // 检查是否为开发测试专用模型
      if (!this.envConfig.allowDevModels && this.isDevOnlyModel(config)) {
        console.warn(`[EnvironmentConfigLoader] 过滤掉开发测试专用模型: ${config.name}`);
        return false;
      }

      return true;
    });
  }

  /**
   * 验证配置
   */
  validateConfig(config: ModelConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查Provider
    if (!this.isProviderAllowed(config.provider)) {
      errors.push(`Provider "${config.provider}" 在当前环境 (${this.currentEnv}) 中不被允许`);
    }

    // 检查开发测试模型
    if (!this.envConfig.allowDevModels && this.isDevOnlyModel(config)) {
      errors.push(`模型 "${config.name}" 是开发测试专用模型，在当前环境中不允许使用`);
    }

    // 检查API密钥
    if (this.envConfig.requireApiKey && (!config.apiKey || config.apiKey.trim() === '')) {
      // 生产环境允许从环境变量读取，所以这里只是警告
      if (this.isProduction()) {
        console.warn(
          `[EnvironmentConfigLoader] 模型 "${config.name}" 未配置API密钥，请确保通过环境变量提供`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 应用环境覆盖
   */
  applyEnvironmentOverrides(config: ModelConfig): ModelConfig {
    const overrides: Partial<ModelConfig> = {};

    // 从环境变量读取API密钥（如果配置中为空）
    if (typeof process !== 'undefined' && (!config.apiKey || config.apiKey.trim() === '')) {
      const envKeyName = `API_KEY_${config.provider.toUpperCase()}_${config.modelId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      const envKey =
        process.env[envKeyName] || process.env[`API_KEY_${config.provider.toUpperCase()}`];

      if (envKey) {
        overrides.apiKey = envKey;
      }
    }

    // 从环境变量读取baseUrl
    if (typeof process !== 'undefined' && (!config.baseUrl || config.baseUrl.trim() === '')) {
      const envUrlName = `API_URL_${config.provider.toUpperCase()}`;
      const envUrl = process.env[envUrlName];

      if (envUrl) {
        overrides.baseUrl = envUrl;
      }
    }

    return {
      ...config,
      ...overrides,
    };
  }

  /**
   * 加载并过滤配置
   */
  loadConfigs(configs: ModelConfig[]): ModelConfig[] {
    // 先过滤
    const filtered = this.filterConfigs(configs);

    // 再应用环境覆盖
    return filtered.map(config => this.applyEnvironmentOverrides(config));
  }

  /**
   * 获取安全提示
   */
  getSecurityWarnings(): string[] {
    const warnings: string[] = [];

    if (this.isProduction()) {
      warnings.push('当前为生产环境，开发测试专用模型已被自动过滤');
      warnings.push('API密钥建议通过环境变量配置，避免硬编码');
    } else if (this.currentEnv === 'development') {
      warnings.push('当前为开发环境，允许使用魔搭社区等测试模型');
      warnings.push('请注意：开发测试模型不适合生产环境使用');
    }

    return warnings;
  }

  /**
   * 获取模型环境标签
   */
  getModelEnvironmentLabel(config: ModelConfig): { label: string; color: string } | null {
    if (this.isDevOnlyModel(config)) {
      return {
        label: '开发测试',
        color: '#f59e0b', // amber
      };
    }

    if (this.isProduction()) {
      return {
        label: '生产就绪',
        color: '#10b981', // emerald
      };
    }

    return null;
  }
}

// 全局单例
export const environmentConfigLoader = new EnvironmentConfigLoader();

// 便捷导出
export default environmentConfigLoader;
