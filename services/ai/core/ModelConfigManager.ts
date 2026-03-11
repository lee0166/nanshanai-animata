/**
 * 模型配置管理器
 *
 * 功能：
 * - 运行时动态配置创建
 * - 配置验证
 * - 配置导入导出
 * - 配置版本管理
 *
 * @author AI Assistant
 * @version 1.0.0
 */

import type { ModelConfig, ModelType, ModelCapabilities, ModelParameter } from '../../../types';
import { ModelTemplateRegistry, modelTemplateRegistry } from '../../../config/modelTemplates';
import { ProviderPluginManager, providerPluginManager } from './ProviderPluginManager';

/**
 * 配置验证结果
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
}

export interface ConfigValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ConfigValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

/**
 * 配置导出格式
 */
export interface ConfigExportFormat {
  version: string;
  exportedAt: string;
  configs: ModelConfig[];
  metadata: {
    total: number;
    providers: string[];
    types: ModelType[];
  };
}

/**
 * 配置创建选项
 */
export interface ConfigCreateOptions {
  templateId?: string;
  providerId?: string;
  baseConfig?: Partial<ModelConfig>;
  overrides?: Partial<ModelConfig>;
}

/**
 * 配置版本信息
 */
export interface ConfigVersion {
  version: number;
  updatedAt: string;
  changes: string[];
  config: ModelConfig;
}

/**
 * 动态配置管理器
 */
export class ModelConfigManager {
  private configs: Map<string, ModelConfig> = new Map();
  private versions: Map<string, ConfigVersion[]> = new Map();
  private templateRegistry: ModelTemplateRegistry;
  private pluginManager: ProviderPluginManager;

  constructor(
    templateRegistry: ModelTemplateRegistry = modelTemplateRegistry,
    pluginManager: ProviderPluginManager = providerPluginManager
  ) {
    this.templateRegistry = templateRegistry;
    this.pluginManager = pluginManager;
  }

  /**
   * 从模板创建配置
   */
  createFromTemplate(
    templateId: string,
    customConfig: Partial<ModelConfig> = {}
  ): ConfigValidationResult & { config?: ModelConfig } {
    const template = this.templateRegistry.getTemplate(templateId);

    if (!template) {
      return {
        valid: false,
        errors: [
          {
            field: 'templateId',
            message: `模板 ${templateId} 不存在`,
            code: 'TEMPLATE_NOT_FOUND',
          },
        ],
        warnings: [],
      };
    }

    // 从模板生成基础配置
    const baseConfig: ModelConfig = {
      id: customConfig.id || this.generateConfigId(),
      name: customConfig.name || template.name,
      type: template.type,
      provider: customConfig.provider || template.providerOptions?.defaultProvider || 'custom',
      modelId: customConfig.modelId || template.id,
      apiKey: customConfig.apiKey || '',
      baseUrl: customConfig.baseUrl || template.providerOptions?.defaultEndpoint || '',
      enabled: customConfig.enabled ?? true,
      capabilities: {
        ...template.capabilities,
        ...customConfig.capabilities,
      },
      parameters: this.mergeParameters(template.parameters, customConfig.parameters || []),
      ...template.providerOptions?.additionalConfig,
    };

    // 合并自定义配置
    const finalConfig: ModelConfig = {
      ...baseConfig,
      ...customConfig,
      capabilities: {
        ...baseConfig.capabilities,
        ...customConfig.capabilities,
      },
    };

    // 验证配置
    const validation = this.validateConfig(finalConfig);

    if (validation.valid) {
      this.configs.set(finalConfig.id, finalConfig);
      this.saveVersion(finalConfig);
      return { ...validation, config: finalConfig };
    }

    return validation;
  }

  /**
   * 创建自定义配置
   */
  createCustom(config: Partial<ModelConfig>): ConfigValidationResult & { config?: ModelConfig } {
    const finalConfig: ModelConfig = {
      id: config.id || this.generateConfigId(),
      name: config.name || '未命名模型',
      type: config.type || 'image',
      provider: config.provider || 'custom',
      modelId: config.modelId || '',
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || '',
      enabled: config.enabled ?? true,
      capabilities: config.capabilities || {
        textToImage: config.type === 'image',
        imageToVideo: config.type === 'video',
        textToVideo: config.type === 'video',
        textToText: config.type === 'llm',
      },
      parameters: config.parameters || [],
    };

    const validation = this.validateConfig(finalConfig);

    if (validation.valid) {
      this.configs.set(finalConfig.id, finalConfig);
      this.saveVersion(finalConfig);
      return { ...validation, config: finalConfig };
    }

    return validation;
  }

  /**
   * 验证配置
   */
  validateConfig(config: ModelConfig): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // 必填字段验证
    if (!config.name || config.name.trim() === '') {
      errors.push({
        field: 'name',
        message: '模型名称不能为空',
        code: 'NAME_REQUIRED',
      });
    }

    if (!config.modelId || config.modelId.trim() === '') {
      errors.push({
        field: 'modelId',
        message: '模型ID不能为空',
        code: 'MODEL_ID_REQUIRED',
      });
    }

    if (!config.provider || config.provider.trim() === '') {
      errors.push({
        field: 'provider',
        message: 'Provider不能为空',
        code: 'PROVIDER_REQUIRED',
      });
    }

    // API密钥验证（根据环境）
    if (this.isProduction() && (!config.apiKey || config.apiKey.trim() === '')) {
      // 生产环境允许空API密钥（可能从环境变量读取）
      warnings.push({
        field: 'apiKey',
        message: 'API密钥为空，请确保通过环境变量配置',
        suggestion: '设置对应的环境变量或在配置中提供API密钥',
      });
    }

    // 能力验证
    if (!config.capabilities) {
      errors.push({
        field: 'capabilities',
        message: '模型能力配置不能为空',
        code: 'CAPABILITIES_REQUIRED',
      });
    }

    // Provider特定验证
    const providerValidation = this.validateProviderSpecific(config);
    errors.push(...providerValidation.errors);
    warnings.push(...providerValidation.warnings);

    // 参数验证
    const paramValidation = this.validateParameters(config);
    errors.push(...paramValidation.errors);
    warnings.push(...paramValidation.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Provider特定验证
   */
  private validateProviderSpecific(config: ModelConfig): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    switch (config.provider) {
      case 'volcengine':
        if (!config.baseUrl || !config.baseUrl.includes('volces.com')) {
          warnings.push({
            field: 'baseUrl',
            message: '火山方舟API地址通常包含 volces.com',
            suggestion: '请确认使用正确的火山方舟接入点地址',
          });
        }
        break;

      case 'aliyun':
      case ' bailian':
        if (!config.baseUrl || !config.baseUrl.includes('aliyun.com')) {
          warnings.push({
            field: 'baseUrl',
            message: '阿里云百炼API地址通常包含 aliyun.com',
            suggestion: '请确认使用正确的阿里云百炼接入点地址',
          });
        }
        break;

      case 'openai':
        if (config.baseUrl && !config.baseUrl.includes('openai.com')) {
          warnings.push({
            field: 'baseUrl',
            message: '非官方OpenAI地址，请确认这是兼容OpenAI协议的第三方服务',
            suggestion: '如果是第三方兼容服务，请确保API格式兼容',
          });
        }
        break;

      case 'modelscope':
        if (this.isProduction()) {
          errors.push({
            field: 'provider',
            message: '魔搭社区API仅用于开发测试，生产环境禁止使用',
            code: 'DEV_ONLY_PROVIDER_IN_PROD',
          });
        } else {
          warnings.push({
            field: 'provider',
            message: '魔搭社区API仅限开发测试使用，不适合生产环境',
            suggestion: '生产环境请使用火山方舟、阿里云百炼等商用服务',
          });
        }
        break;
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * 参数验证
   */
  private validateParameters(config: ModelConfig): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    if (!config.parameters) return { valid: true, errors, warnings };

    for (const param of config.parameters) {
      // 参数名称验证
      if (!param.name || param.name.trim() === '') {
        errors.push({
          field: 'parameters',
          message: '参数名称不能为空',
          code: 'PARAM_NAME_REQUIRED',
        });
      }

      // 数值范围验证
      if (param.type === 'number') {
        if (param.min !== undefined && param.max !== undefined && param.min > param.max) {
          errors.push({
            field: `parameters.${param.name}`,
            message: `参数 ${param.name} 的最小值不能大于最大值`,
            code: 'PARAM_RANGE_INVALID',
          });
        }

        if (param.defaultValue !== undefined) {
          const defaultVal = Number(param.defaultValue);
          if (param.min !== undefined && defaultVal < param.min) {
            warnings.push({
              field: `parameters.${param.name}`,
              message: `参数 ${param.name} 的默认值小于最小值`,
              suggestion: `建议将默认值设置为 ${param.min} 或更大`,
            });
          }
          if (param.max !== undefined && defaultVal > param.max) {
            warnings.push({
              field: `parameters.${param.name}`,
              message: `参数 ${param.name} 的默认值大于最大值`,
              suggestion: `建议将默认值设置为 ${param.max} 或更小`,
            });
          }
        }
      }

      // 选项验证
      if (param.type === 'select' && (!param.options || param.options.length === 0)) {
        errors.push({
          field: `parameters.${param.name}`,
          message: `选择型参数 ${param.name} 必须提供选项列表`,
          code: 'PARAM_OPTIONS_REQUIRED',
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * 更新配置
   */
  updateConfig(
    configId: string,
    updates: Partial<ModelConfig>
  ): ConfigValidationResult & { config?: ModelConfig } {
    const existing = this.configs.get(configId);
    if (!existing) {
      return {
        valid: false,
        errors: [
          {
            field: 'configId',
            message: `配置 ${configId} 不存在`,
            code: 'CONFIG_NOT_FOUND',
          },
        ],
        warnings: [],
      };
    }

    const updated: ModelConfig = {
      ...existing,
      ...updates,
      capabilities: {
        ...existing.capabilities,
        ...updates.capabilities,
      },
      parameters: updates.parameters || existing.parameters,
    };

    const validation = this.validateConfig(updated);

    if (validation.valid) {
      this.configs.set(configId, updated);
      this.saveVersion(updated);
      return { ...validation, config: updated };
    }

    return validation;
  }

  /**
   * 删除配置
   */
  deleteConfig(configId: string): boolean {
    const deleted = this.configs.delete(configId);
    if (deleted) {
      this.versions.delete(configId);
    }
    return deleted;
  }

  /**
   * 获取配置
   */
  getConfig(configId: string): ModelConfig | undefined {
    return this.configs.get(configId);
  }

  /**
   * 获取所有配置
   */
  getAllConfigs(): ModelConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * 按类型获取配置
   */
  getConfigsByType(type: ModelType): ModelConfig[] {
    return this.getAllConfigs().filter(c => c.type === type);
  }

  /**
   * 按Provider获取配置
   */
  getConfigsByProvider(provider: string): ModelConfig[] {
    return this.getAllConfigs().filter(c => c.provider === provider);
  }

  /**
   * 获取启用的配置
   */
  getEnabledConfigs(): ModelConfig[] {
    return this.getAllConfigs().filter(c => c.enabled !== false);
  }

  /**
   * 导出配置
   */
  exportConfigs(configIds?: string[]): ConfigExportFormat {
    const configs = configIds
      ? (configIds.map(id => this.configs.get(id)).filter(Boolean) as ModelConfig[])
      : this.getAllConfigs();

    const providers = [...new Set(configs.map(c => c.provider))];
    const types = [...new Set(configs.map(c => c.type))];

    // 导出时移除敏感信息
    const sanitizedConfigs = configs.map(c => ({
      ...c,
      apiKey: c.apiKey ? '***REDACTED***' : '',
    }));

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      configs: sanitizedConfigs,
      metadata: {
        total: configs.length,
        providers,
        types,
      },
    };
  }

  /**
   * 导入配置
   */
  importConfigs(
    data: ConfigExportFormat,
    options: { overwrite?: boolean; prefix?: string } = {}
  ): ConfigValidationResult & { imported: number; failed: number } {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];
    let imported = 0;
    let failed = 0;

    for (const config of data.configs) {
      // 生成新ID避免冲突
      const newId = options.prefix
        ? `${options.prefix}_${config.id}`
        : this.configs.has(config.id) && !options.overwrite
          ? `${config.id}_imported_${Date.now()}`
          : config.id;

      const configToImport: ModelConfig = {
        ...config,
        id: newId,
        // 导入的配置默认禁用，需要手动启用
        enabled: false,
      };

      const validation = this.validateConfig(configToImport);

      if (validation.valid) {
        this.configs.set(newId, configToImport);
        this.saveVersion(configToImport);
        imported++;
      } else {
        failed++;
        errors.push(
          ...validation.errors.map(e => ({
            ...e,
            message: `[${config.name}] ${e.message}`,
          }))
        );
      }

      warnings.push(
        ...validation.warnings.map(w => ({
          ...w,
          message: `[${config.name}] ${w.message}`,
        }))
      );
    }

    return {
      valid: failed === 0,
      errors,
      warnings,
      imported,
      failed,
    };
  }

  /**
   * 获取配置历史版本
   */
  getConfigVersions(configId: string): ConfigVersion[] {
    return this.versions.get(configId) || [];
  }

  /**
   * 回滚到指定版本
   */
  rollbackToVersion(configId: string, version: number): ModelConfig | undefined {
    const versions = this.versions.get(configId);
    if (!versions) return undefined;

    const targetVersion = versions.find(v => v.version === version);
    if (!targetVersion) return undefined;

    const config = { ...targetVersion.config };
    this.configs.set(configId, config);
    this.saveVersion(config, [`回滚到版本 ${version}`]);
    return config;
  }

  /**
   * 克隆配置
   */
  cloneConfig(
    configId: string,
    newName?: string
  ): ConfigValidationResult & { config?: ModelConfig } {
    const existing = this.configs.get(configId);
    if (!existing) {
      return {
        valid: false,
        errors: [
          {
            field: 'configId',
            message: `配置 ${configId} 不存在`,
            code: 'CONFIG_NOT_FOUND',
          },
        ],
        warnings: [],
      };
    }

    const cloned: ModelConfig = {
      ...existing,
      id: this.generateConfigId(),
      name: newName || `${existing.name} (副本)`,
      enabled: false, // 克隆的配置默认禁用
    };

    const validation = this.validateConfig(cloned);

    if (validation.valid) {
      this.configs.set(cloned.id, cloned);
      this.saveVersion(cloned);
      return { ...validation, config: cloned };
    }

    return validation;
  }

  /**
   * 批量启用/禁用
   */
  batchSetEnabled(configIds: string[], enabled: boolean): number {
    let updated = 0;
    for (const id of configIds) {
      const config = this.configs.get(id);
      if (config) {
        config.enabled = enabled;
        this.saveVersion(config, [`批量${enabled ? '启用' : '禁用'}`]);
        updated++;
      }
    }
    return updated;
  }

  /**
   * 批量删除
   */
  batchDelete(configIds: string[]): number {
    let deleted = 0;
    for (const id of configIds) {
      if (this.deleteConfig(id)) {
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * 保存版本
   */
  private saveVersion(config: ModelConfig, changes?: string[]): void {
    const versions = this.versions.get(config.id) || [];
    const newVersion: ConfigVersion = {
      version: versions.length + 1,
      updatedAt: new Date().toISOString(),
      changes: changes || ['配置更新'],
      config: { ...config },
    };
    versions.push(newVersion);

    // 只保留最近20个版本
    if (versions.length > 20) {
      versions.shift();
    }

    this.versions.set(config.id, versions);
  }

  /**
   * 合并参数
   */
  private mergeParameters(
    templateParams: ModelParameter[],
    customParams: ModelParameter[]
  ): ModelParameter[] {
    const merged = new Map<string, ModelParameter>();

    // 先添加模板参数
    for (const param of templateParams) {
      merged.set(param.name, param);
    }

    // 覆盖自定义参数
    for (const param of customParams) {
      merged.set(param.name, param);
    }

    return Array.from(merged.values());
  }

  /**
   * 生成配置ID
   */
  private generateConfigId(): string {
    return `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 检查是否生产环境
   */
  private isProduction(): boolean {
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  }

  /**
   * 清空所有配置
   */
  clear(): void {
    this.configs.clear();
    this.versions.clear();
  }
}

// 全局单例
export const modelConfigManager = new ModelConfigManager();

// 便捷导出
export default modelConfigManager;
