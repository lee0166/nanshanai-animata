/**
 * 模型配置系统桥接器
 *
 * 作用：让新系统兼容现有代码，逐步迁移
 * - 兼容旧的 ModelConfig 类型
 * - 兼容旧的 findModelConfig 函数
 * - 将现有配置导入新系统
 *
 * @author AI Assistant
 * @version 1.0.0
 */

import type { ModelConfig, AppSettings } from '../../types';
import { DEFAULT_MODELS, findModelConfig as oldFindModelConfig } from '../../config/models';
import { modelConfigManager } from './core/ModelConfigManager';
import { environmentConfigLoader } from './core/EnvironmentConfigLoader';
import { modelTemplateRegistry } from '../../config/modelTemplates';

/**
 * 初始化桥接器
 * 将现有配置导入新系统
 */
export function initializeBridge(): void {
  // 清空现有配置（避免重复）
  modelConfigManager.clear();

  // 将 DEFAULT_MODELS 导入新系统
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const model of DEFAULT_MODELS) {
    // 转换旧配置格式到新格式
    const newConfig = convertOldToNew(model);

    // 验证环境（生产环境过滤开发测试模型）
    const envValidation = environmentConfigLoader.validateConfig(newConfig as ModelConfig);
    if (!envValidation.valid) {
      skipped++;
      continue;
    }

    // 添加到新系统
    const result = modelConfigManager.createCustom(newConfig);
    if (result.valid) {
      imported++;
    } else {
      failed++;
    }
  }

  console.log(
    `[ModelConfigBridge] Imported ${imported} models (${skipped} skipped, ${failed} failed)`
  );
}

/**
 * 转换旧配置格式到新格式
 */
function convertOldToNew(oldConfig: ModelConfig): Partial<ModelConfig> {
  return {
    id: oldConfig.id,
    name: oldConfig.name,
    provider: oldConfig.provider,
    modelId: oldConfig.modelId,
    type: oldConfig.type,
    capabilities: oldConfig.capabilities,
    parameters: oldConfig.parameters,
    apiKey: oldConfig.apiKey || '',
    baseUrl: oldConfig.apiUrl || '',
    enabled: true,
    // 保留原有字段
    isDefault: oldConfig.isDefault,
    costPer1KInput: oldConfig.costPer1KInput,
    costPer1KOutput: oldConfig.costPer1KOutput,
    providerOptions: oldConfig.providerOptions,
  };
}

/**
 * 查找模型配置（兼容旧接口）
 */
export function findModelConfig(modelId: string): ModelConfig | undefined {
  // 先在新系统中查找
  const newConfig = modelConfigManager.getAllConfigs().find(c => c.modelId === modelId);
  if (newConfig) {
    return newConfig;
  }

  // 回退到旧系统
  return oldFindModelConfig(modelId);
}

/**
 * 获取所有模型配置（兼容旧接口）
 */
export function getAllModelConfigs(): ModelConfig[] {
  const configs = modelConfigManager.getAllConfigs();

  // 如果新系统为空，回退到旧系统
  if (configs.length === 0) {
    return DEFAULT_MODELS;
  }

  return configs;
}

/**
 * 按类型获取模型（兼容旧接口）
 */
export function getModelsByType(type: 'image' | 'video' | 'llm'): ModelConfig[] {
  return modelConfigManager.getConfigsByType(type);
}

/**
 * 按Provider获取模型（兼容旧接口）
 */
export function getModelsByProvider(provider: string): ModelConfig[] {
  return modelConfigManager.getConfigsByProvider(provider);
}

/**
 * 获取启用的模型
 */
export function getEnabledModels(): ModelConfig[] {
  return modelConfigManager.getEnabledConfigs();
}

/**
 * 导出配置（兼容旧接口）
 */
export function exportModelConfigs(): string {
  const exportData = modelConfigManager.exportConfigs();
  return JSON.stringify(exportData, null, 2);
}

/**
 * 导入配置（兼容旧接口）
 */
export function importModelConfigs(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    const result = modelConfigManager.importConfigs(data);
    return result.valid;
  } catch (error) {
    console.error('[ModelConfigBridge] Import failed:', error);
    return false;
  }
}

/**
 * 从旧系统 settings.models 转换到新系统 ModelConfig[]
 */
export function fromLegacySettings(legacyModels: ModelConfig[]): ModelConfig[] {
  return legacyModels.map(model => convertOldToNew(model) as ModelConfig);
}

/**
 * 从新系统 ModelConfig[] 转换到旧系统 settings.models 格式
 */
export function toLegacySettings(newModels: ModelConfig[]): ModelConfig[] {
  return newModels.map(model => ({
    ...model,
    apiUrl: model.baseUrl || model.apiUrl,
  }));
}

/**
 * 同步新旧系统数据
 * 确保两边数据一致
 */
export function sync(legacySettings?: AppSettings): {
  synced: boolean;
  newConfigs: ModelConfig[];
  legacyConfigs: ModelConfig[];
} {
  const newConfigs = modelConfigManager.getAllConfigs();
  const legacyConfigs = legacySettings?.models || DEFAULT_MODELS;

  // 如果新系统为空，从旧系统导入
  if (newConfigs.length === 0 && legacyConfigs.length > 0) {
    const converted = fromLegacySettings(legacyConfigs);
    for (const config of converted) {
      modelConfigManager.createCustom(config);
    }
    return {
      synced: true,
      newConfigs: modelConfigManager.getAllConfigs(),
      legacyConfigs,
    };
  }

  // 如果旧系统为空，从新系统导出
  if (legacyConfigs.length === 0 && newConfigs.length > 0) {
    return {
      synced: true,
      newConfigs,
      legacyConfigs: toLegacySettings(newConfigs),
    };
  }

  // 两边都有数据，保持原样（新系统优先）
  return {
    synced: true,
    newConfigs,
    legacyConfigs,
  };
}

// 导出新系统的功能（方便使用）
export { modelConfigManager, environmentConfigLoader, modelTemplateRegistry };
