/**
 * 配置迁移工具
 * 从1.0版本配置迁移到2.0版本
 */

import type { ScriptParserConfig, PromptMode } from '../../types';

export class ConfigMigrator {
  /**
   * 检测当前环境
   */
  static getEnvironment(): 'development' | 'production' {
    // 注意：在非Vite环境中，这个方法可能需要调整
    return (import.meta as any).env?.DEV === true ? 'development' : 'production';
  }

  /**
   * 迁移旧配置到新配置
   */
  static migrateConfig(oldConfig: any): any {
    const newConfig: any = { ...oldConfig };

    // 只有在没有设置 promptMode 的情况下才迁移旧配置
    // 避免覆盖用户在UI中选择的模式！
    if (!newConfig.promptMode && oldConfig.useProductionPrompt !== undefined) {
      newConfig.promptMode = oldConfig.useProductionPrompt ? 'professional' : 'standard';

      // 记录迁移日志
      console.warn(
        `[ConfigMigrator] Deprecated: useProductionPrompt is deprecated, ` +
          `automatically migrated to promptMode: ${newConfig.promptMode}`
      );
    }

    // 如果没有设置，使用环境默认值
    if (!newConfig.promptMode) {
      const env = this.getEnvironment();
      newConfig.promptMode = env === 'development' ? 'standard' : 'professional';
    }

    return newConfig;
  }

  /**
   * 获取默认配置
   */
  static getDefaultConfig(): any {
    const env = this.getEnvironment();
    return {
      promptMode: env === 'development' ? 'standard' : 'professional',
      defaultModeByEnvironment: {
        development: 'standard',
        production: 'professional',
      },
    };
  }
}
