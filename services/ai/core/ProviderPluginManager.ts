import {
  IProvider,
  ProviderMetadata,
  ProviderNotFoundError,
  ProviderNotAvailableError,
} from "./IProvider";

/**
 * Provider插件管理器
 *
 * 职责：
 * 1. 插件注册与发现
 * 2. 插件生命周期管理
 * 3. 环境感知加载（开发/生产）
 * 4. 插件依赖管理
 */
export class ProviderPluginManager {
  private plugins = new Map<string, IProvider>();
  private metadata = new Map<string, ProviderMetadata>();
  private readonly isDevMode: boolean;

  constructor() {
    this.isDevMode =
      (import.meta as any).env?.DEV || process.env.NODE_ENV === "development";
  }

  /**
   * 注册Provider插件
   *
   * 示例：
   * ```typescript
   * // 注册火山方舟插件
   * pluginManager.register(new VolcengineProviderPlugin(), {
   *   environment: 'all',  // 'all' | 'development' | 'production'
   *   priority: 100,       // 加载优先级
   * });
   *
   * // 注册魔搭社区插件（仅开发环境）
   * pluginManager.register(new ModelscopeProviderPlugin(), {
   *   environment: 'development',
   *   priority: 50,
   * });
   * ```
   */
  register(provider: IProvider, metadata: ProviderMetadata): void {
    // 环境检查
    if (!this.canLoadInEnvironment(metadata.environment)) {
      console.warn(
        `[ProviderPluginManager] Skipping ${provider.id} - not available in current environment`
      );
      return;
    }

    // 重复检查
    if (this.plugins.has(provider.id)) {
      throw new Error(`Provider ${provider.id} is already registered`);
    }

    this.plugins.set(provider.id, provider);
    this.metadata.set(provider.id, metadata);

    console.log(
      `[ProviderPluginManager] Registered: ${provider.name} (${provider.id})`
    );
  }

  /**
   * 批量注册插件（从配置自动加载）
   */
  async registerFromConfig(
    providers: Array<{ provider: IProvider; metadata: ProviderMetadata }>
  ): Promise<void> {
    // 按优先级排序
    const sorted = providers.sort(
      (a, b) => a.metadata.priority - b.metadata.priority
    );

    for (const { provider, metadata } of sorted) {
      this.register(provider, metadata);
    }

    console.log(
      `[ProviderPluginManager] Registered ${this.plugins.size} providers`
    );
  }

  /**
   * 获取Provider实例
   */
  getProvider(id: string): IProvider {
    const provider = this.plugins.get(id);
    if (!provider) {
      // 检查是否是开发环境专用
      const meta = this.metadata.get(id);
      if (meta?.environment === "development" && !this.isDevMode) {
        throw new ProviderNotAvailableError(
          id,
          `Provider ${id} is DEVELOPMENT ONLY and cannot be used in production`
        );
      }
      throw new ProviderNotFoundError(id);
    }
    return provider;
  }

  /**
   * 获取所有可用Provider
   */
  getAllProviders(): IProvider[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 按类型获取Provider
   */
  getProvidersByType(type: "image" | "video" | "llm"): IProvider[] {
    return this.getAllProviders().filter((p) => p.supportedTypes.includes(type));
  }

  /**
   * 检查Provider是否存在
   */
  hasProvider(id: string): boolean {
    return this.plugins.has(id);
  }

  /**
   * 获取Provider元数据
   */
  getMetadata(id: string): ProviderMetadata | undefined {
    return this.metadata.get(id);
  }

  /**
   * 获取所有Provider信息
   */
  getProviderInfos(): Array<{
    id: string;
    name: string;
    supportedTypes: ("image" | "video" | "llm")[];
    metadata: ProviderMetadata;
  }> {
    return this.getAllProviders().map((p) => ({
      id: p.id,
      name: p.name,
      supportedTypes: p.supportedTypes,
      metadata: this.metadata.get(p.id)!,
    }));
  }

  /**
   * 初始化所有Provider
   */
  async initializeAll(configs: Record<string, any>): Promise<void> {
    for (const [id, provider] of this.plugins) {
      const config = configs[id];
      if (config) {
        try {
          await provider.initialize(config);
          console.log(`[ProviderPluginManager] Initialized: ${id}`);
        } catch (error) {
          console.error(
            `[ProviderPluginManager] Failed to initialize ${id}:`,
            error
          );
        }
      }
    }
  }

  /**
   * 销毁所有Provider
   */
  async disposeAll(): Promise<void> {
    for (const [id, provider] of this.plugins) {
      if (provider.dispose) {
        try {
          await provider.dispose();
          console.log(`[ProviderPluginManager] Disposed: ${id}`);
        } catch (error) {
          console.error(
            `[ProviderPluginManager] Failed to dispose ${id}:`,
            error
          );
        }
      }
    }
    this.plugins.clear();
    this.metadata.clear();
  }

  /**
   * 检查当前环境是否可加载
   */
  private canLoadInEnvironment(
    environment: "all" | "development" | "production"
  ): boolean {
    if (environment === "all") return true;
    if (environment === "development") return this.isDevMode;
    if (environment === "production") return !this.isDevMode;
    return false;
  }
}

// 全局单例
let globalPluginManager: ProviderPluginManager | null = null;

/**
 * 获取Provider插件管理器实例
 */
export function getProviderPluginManager(): ProviderPluginManager {
  if (!globalPluginManager) {
    globalPluginManager = new ProviderPluginManager();
  }
  return globalPluginManager;
}

/**
 * 重置Provider插件管理器（主要用于测试）
 */
export function resetProviderPluginManager(): void {
  globalPluginManager = null;
}
