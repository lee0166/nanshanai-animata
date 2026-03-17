/**
 * 质量评估规则配置加载器
 *
 * 负责加载、验证和提供质量评估规则配置
 * 采用单例模式确保全局配置一致性
 */

import type { QualityRulesConfig } from './QualityRulesConfig';
import { DEFAULT_QUALITY_RULES } from './QualityRulesConfig';

// 配置文件路径
const CONFIG_PATH = '/config/quality-rules.json';
const STORAGE_KEY = 'quality_rules_config';

/**
 * 配置验证错误
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public details?: string[]
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * 质量规则配置加载器
 */
export class QualityRulesLoader {
  private static instance: QualityRulesLoader;
  private config: QualityRulesConfig | null = null;
  private isLoading = false;
  private loadPromise: Promise<QualityRulesConfig> | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): QualityRulesLoader {
    if (!QualityRulesLoader.instance) {
      QualityRulesLoader.instance = new QualityRulesLoader();
    }
    return QualityRulesLoader.instance;
  }

  /**
   * 加载配置
   * 优先级：1. 内存缓存 2. 本地存储 3. 配置文件 4. 默认配置
   */
  async loadConfig(): Promise<QualityRulesConfig> {
    // 如果已有配置，直接返回
    if (this.config) {
      return this.config;
    }

    // 如果正在加载，返回进行中的Promise
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this.doLoadConfig();

    try {
      this.config = await this.loadPromise;
      return this.config;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 实际加载逻辑
   */
  private async doLoadConfig(): Promise<QualityRulesConfig> {
    try {
      // 1. 尝试从本地存储加载用户自定义配置
      const storedConfig = this.loadFromStorage();
      if (storedConfig) {
        console.log('[QualityRulesLoader] Loaded config from localStorage');
        return storedConfig;
      }

      // 2. 尝试从配置文件加载
      const fileConfig = await this.loadFromFile();
      if (fileConfig) {
        console.log('[QualityRulesLoader] Loaded config from file');
        return fileConfig;
      }

      // 3. 使用默认配置
      console.log('[QualityRulesLoader] Using default config');
      return { ...DEFAULT_QUALITY_RULES };
    } catch (error) {
      console.error('[QualityRulesLoader] Failed to load config:', error);
      return { ...DEFAULT_QUALITY_RULES };
    }
  }

  /**
   * 从本地存储加载配置
   */
  private loadFromStorage(): QualityRulesConfig | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const config = JSON.parse(stored) as QualityRulesConfig;
      if (this.validateConfig(config)) {
        return config;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 从配置文件加载
   */
  private async loadFromFile(): Promise<QualityRulesConfig | null> {
    try {
      const response = await fetch(CONFIG_PATH);
      if (!response.ok) {
        console.warn(`[QualityRulesLoader] Failed to fetch config: ${response.status}`);
        return null;
      }

      const config = (await response.json()) as QualityRulesConfig;
      if (this.validateConfig(config)) {
        return config;
      }
      return null;
    } catch (error) {
      console.warn('[QualityRulesLoader] Error loading config file:', error);
      return null;
    }
  }

  /**
   * 验证配置格式
   */
  private validateConfig(config: unknown): config is QualityRulesConfig {
    if (!config || typeof config !== 'object') {
      console.error('[QualityRulesLoader] Config is not an object');
      return false;
    }

    const c = config as Partial<QualityRulesConfig>;

    // 验证必需字段
    if (!c.version || typeof c.version !== 'string') {
      console.error('[QualityRulesLoader] Missing or invalid version');
      return false;
    }

    if (!c.thresholds || typeof c.thresholds !== 'object') {
      console.error('[QualityRulesLoader] Missing or invalid thresholds');
      return false;
    }

    if (!c.weights || typeof c.weights !== 'object') {
      console.error('[QualityRulesLoader] Missing or invalid weights');
      return false;
    }

    if (!c.scoring || typeof c.scoring !== 'object') {
      console.error('[QualityRulesLoader] Missing or invalid scoring');
      return false;
    }

    if (!c.consistencyRules || typeof c.consistencyRules !== 'object') {
      console.error('[QualityRulesLoader] Missing or invalid consistencyRules');
      return false;
    }

    // 验证权重总和
    const weightValues = Object.values(c.weights).map(w => w.value);
    const totalWeight = weightValues.reduce((sum, w) => sum + w, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      console.warn(`[QualityRulesLoader] Weight sum is ${totalWeight}, expected 1.0`);
      // 不阻止加载，但发出警告
    }

    return true;
  }

  /**
   * 获取当前配置
   * 如果未加载，会自动加载
   */
  async getConfig(): Promise<QualityRulesConfig> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config!;
  }

  /**
   * 同步获取配置（仅用于已加载的情况）
   */
  getConfigSync(): QualityRulesConfig | null {
    return this.config;
  }

  /**
   * 更新配置
   * 会验证并保存到本地存储
   */
  async updateConfig(updates: Partial<QualityRulesConfig>): Promise<void> {
    const current = await this.getConfig();
    const newConfig = { ...current, ...updates };

    // 验证新配置
    if (!this.validateConfig(newConfig)) {
      throw new ConfigValidationError('Invalid configuration');
    }

    // 更新内存中的配置
    this.config = newConfig;

    // 保存到本地存储
    this.saveToStorage(newConfig);

    console.log('[QualityRulesLoader] Config updated successfully');
  }

  /**
   * 更新特定权重
   */
  async updateWeight(dimension: string, value: number): Promise<void> {
    const config = await this.getConfig();
    const weightConfig = config.weights[dimension];

    if (!weightConfig) {
      throw new ConfigValidationError(`Unknown dimension: ${dimension}`);
    }

    // 验证范围
    if (value < weightConfig.range[0] || value > weightConfig.range[1]) {
      throw new ConfigValidationError(
        `Weight ${dimension} must be between ${weightConfig.range[0]} and ${weightConfig.range[1]}`
      );
    }

    // 更新权重
    config.weights[dimension].value = value;

    // 重新验证权重总和
    const weightValues = Object.values(config.weights).map(w => w.value);
    const totalWeight = weightValues.reduce((sum, w) => sum + w, 0);

    if (Math.abs(totalWeight - 1.0) > 0.01) {
      console.warn(`[QualityRulesLoader] Weight sum is now ${totalWeight}, expected 1.0`);
    }

    await this.updateConfig(config);
  }

  /**
   * 更新特定阈值
   */
  async updateThreshold(key: string, value: number): Promise<void> {
    const config = await this.getConfig();
    const thresholdConfig = config.thresholds[key];

    if (!thresholdConfig) {
      throw new ConfigValidationError(`Unknown threshold: ${key}`);
    }

    // 验证范围
    if (value < thresholdConfig.range[0] || value > thresholdConfig.range[1]) {
      throw new ConfigValidationError(
        `Threshold ${key} must be between ${thresholdConfig.range[0]} and ${thresholdConfig.range[1]}`
      );
    }

    // 更新阈值
    config.thresholds[key].value = value;

    await this.updateConfig(config);
  }

  /**
   * 保存到本地存储
   */
  private saveToStorage(config: QualityRulesConfig): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('[QualityRulesLoader] Failed to save to localStorage:', error);
    }
  }

  /**
   * 重置为默认配置
   */
  async resetToDefault(): Promise<void> {
    this.config = { ...DEFAULT_QUALITY_RULES };
    this.saveToStorage(this.config);
    console.log('[QualityRulesLoader] Config reset to default');
  }

  /**
   * 清除本地存储的配置
   */
  clearStorage(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      this.config = null;
      console.log('[QualityRulesLoader] Storage cleared');
    } catch (error) {
      console.error('[QualityRulesLoader] Failed to clear storage:', error);
    }
  }

  /**
   * 获取配置版本信息
   */
  async getVersionInfo(): Promise<{ version: string; lastUpdated: string; source: string }> {
    const config = await this.getConfig();
    const stored = localStorage.getItem(STORAGE_KEY);

    let source = 'default';
    if (stored) {
      source = 'localStorage';
    } else {
      try {
        const response = await fetch(CONFIG_PATH);
        if (response.ok) source = 'file';
      } catch {
        // ignore
      }
    }

    return {
      version: config.version,
      lastUpdated: config.lastUpdated,
      source,
    };
  }
}

/**
 * 便捷函数：获取配置加载器实例
 */
export const getQualityRulesLoader = (): QualityRulesLoader => {
  return QualityRulesLoader.getInstance();
};

/**
 * 便捷函数：异步获取配置
 */
export const getQualityRulesConfig = async (): Promise<QualityRulesConfig> => {
  return getQualityRulesLoader().getConfig();
};
