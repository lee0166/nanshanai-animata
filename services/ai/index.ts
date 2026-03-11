/**
 * AI服务统一入口
 *
 * 功能：
 * - 整合所有AI服务模块
 * - 提供简洁的API接口
 * - 自动初始化和配置
 *
 * @author AI Assistant
 * @version 2.0.0
 */

// 核心模块
export * from './core';

// Provider插件
export * from './providers/plugins';

// 桥接器（兼容旧代码）
export * from './ModelConfigBridge';

// 导入核心服务
import { providerPluginManager } from './core/ProviderPluginManager';
import { modelConfigManager } from './core/ModelConfigManager';
import { environmentConfigLoader } from './core/EnvironmentConfigLoader';
import { providerHealthChecker } from './core/ProviderHealthChecker';
import { configDiagnostics } from './core/ConfigDiagnostics';
import { smartRouter } from './core/SmartRouter';
import { modelTemplateRegistry } from '../../config/modelTemplates';
import { initializeBridge } from './ModelConfigBridge';

/**
 * AI服务配置选项
 */
export interface AIServiceOptions {
  enableHealthCheck?: boolean;
  healthCheckInterval?: number;
  routingStrategy?:
    | 'round-robin'
    | 'weighted'
    | 'least-response-time'
    | 'health-first'
    | 'capability-match';
  enableDiagnostics?: boolean;
  environment?: string;
}

/**
 * AI服务初始化结果
 */
export interface AIServiceInitResult {
  success: boolean;
  environment: string;
  loadedProviders: number;
  loadedModels: number;
  warnings: string[];
  errors: string[];
}

/**
 * AI服务主类
 */
export class AIService {
  private initialized = false;
  private options: AIServiceOptions;

  constructor(options: AIServiceOptions = {}) {
    this.options = {
      enableHealthCheck: true,
      healthCheckInterval: 60000,
      routingStrategy: 'health-first',
      enableDiagnostics: true,
      ...options,
    };
  }

  /**
   * 初始化AI服务
   */
  async initialize(): Promise<AIServiceInitResult> {
    const result: AIServiceInitResult = {
      success: false,
      environment: '',
      loadedProviders: 0,
      loadedModels: 0,
      warnings: [],
      errors: [],
    };

    try {
      // 1. 检测环境
      const env = this.options.environment || environmentConfigLoader.getCurrentEnvironment();
      result.environment = env;

      // 2. 初始化桥接器（将现有配置导入新系统）
      initializeBridge();

      // 3. 获取环境安全提示
      const warnings = environmentConfigLoader.getSecurityWarnings();
      result.warnings.push(...warnings);

      // 4. 设置路由策略
      if (this.options.routingStrategy) {
        smartRouter.setStrategy(this.options.routingStrategy);
      }

      // 5. 初始化健康检查
      if (this.options.enableHealthCheck) {
        providerHealthChecker.startAll();
      }

      // 6. 运行诊断
      if (this.options.enableDiagnostics) {
        const diagnosticReport = configDiagnostics.generateReport();
        if (diagnosticReport.summary.errors > 0) {
          result.errors.push(`Found ${diagnosticReport.summary.errors} configuration errors`);
        }
        if (diagnosticReport.summary.warnings > 0) {
          result.warnings.push(`Found ${diagnosticReport.summary.warnings} configuration warnings`);
        }
      }

      // 7. 统计加载的Provider和模型
      result.loadedProviders = providerPluginManager.getAllProviders().length;
      result.loadedModels = modelConfigManager.getAllConfigs().length;

      result.success = true;
      this.initialized = true;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Initialization failed');
      console.error('[AIService] Initialization failed:', error);
    }

    return result;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    providerHealthChecker.stopAll();
    providerHealthChecker.destroy();
    this.initialized = false;
    console.log('[AIService] Destroyed');
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    initialized: boolean;
    environment: string;
    providers: number;
    models: number;
    healthyProviders: number;
  } {
    return {
      initialized: this.initialized,
      environment: environmentConfigLoader.getCurrentEnvironment(),
      providers: providerPluginManager.getAllProviders().length,
      models: modelConfigManager.getAllConfigs().length,
      healthyProviders: providerHealthChecker.getHealthyProviders().length,
    };
  }
}

// 全局单例
export const aiService = new AIService();

// 便捷导出
export default aiService;

// 挂载到window对象，方便调试
if (typeof window !== 'undefined') {
  (window as any).aiDebug = {
    aiService,
    providerPluginManager,
    modelConfigManager,
    environmentConfigLoader,
    providerHealthChecker,
    configDiagnostics,
    smartRouter,
    modelTemplateRegistry,
    // 便捷方法
    getAllModels: () => modelConfigManager.getAllConfigs(),
    getModelsByType: (type: string) => modelConfigManager.getConfigsByType(type as any),
    getEnvironment: () => environmentConfigLoader.getCurrentEnvironment(),
    getSecurityWarnings: () => environmentConfigLoader.getSecurityWarnings(),
    generateDiagnosticReport: () => configDiagnostics.generateReport(),
    testRoute: (type: string, capability: string) =>
      smartRouter.route({ type: type as any, capability }),
    // 运行自动测试
    runAutoTests: async () => {
      const { autoTester } = await import('./__tests__/auto-verification');
      return autoTester.runAllTests();
    },
  };
}

// 重新导出所有核心模块（方便直接导入）
export {
  providerPluginManager,
  modelConfigManager,
  environmentConfigLoader,
  providerHealthChecker,
  configDiagnostics,
  smartRouter,
  modelTemplateRegistry,
  initializeBridge,
};
