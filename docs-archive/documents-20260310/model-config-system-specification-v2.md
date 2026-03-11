# 模型配置系统优化规格文档 V2.0 (可扩展架构版)

> **文档版本**: 2.0  
> **更新日期**: 2026-03-06  
> **文档状态**: 待审核  
> **核心升级**: 插件化Provider架构，支持任意主流大模型供应商无缝接入

---

## 一、需求背景与目标

### 1.1 业务背景

本项目是一个AI影视资产生成平台，需要接入多种AI模型服务：

- **图像生成**: 用于角色、场景、物品、关键帧生成
- **视频生成**: 用于视频片段生成
- **文本解析**: 用于剧本解析、分镜生成

### 1.2 模型提供商分类

根据用户反馈，模型提供商分为两类：

| 类型         | 提供商                                                   | 用途           | 生产环境      |
| ------------ | -------------------------------------------------------- | -------------- | ------------- |
| **商用模型** | 火山方舟、阿里百炼、OpenAI、Vidu、DeepSeek、Kimi、智谱等 | 正式生产使用   | ✅ 保留       |
| **开发测试** | 魔搭社区 (ModelScope)                                    | 仅开发阶段测试 | ⚠️ 标记为临时 |

**重要**: 魔搭社区的免费API模型仅用于开发测试，与商用模型有本质区别。生产环境不会接入魔搭社区模型。

### 1.3 优化目标

1. **系统性**: 建立完整的模型配置管理体系
2. **专业性**: 符合火山方舟、阿里百炼等主流平台的接入规范
3. **高可扩展**: **插件化架构，支持任意主流大模型供应商无缝接入**
4. **可维护**: 清晰的架构，便于长期维护
5. **生产就绪**: 区分开发测试与生产环境配置

---

## 二、术语定义

| 术语                | 定义                                                     |
| ------------------- | -------------------------------------------------------- |
| **Provider**        | 模型服务提供商，如火山方舟、阿里百炼                     |
| **Provider Plugin** | Provider插件，实现特定厂商的API接入                      |
| **Model**           | 具体的AI模型，如 Doubao-Seedream-4.5                     |
| **Endpoint**        | API接入点，如 `https://ark.cn-beijing.volces.com/api/v3` |
| **Capability**      | 模型能力，如支持参考图、支持文生视频                     |
| **Strategy**        | 提供商特定的请求处理策略                                 |
| **Environment**     | 运行环境：development / production                       |
| **Adapter**         | API适配器，处理请求/响应格式转换                         |
| **Protocol**        | 通信协议：OpenAI兼容/自定义协议                          |

---

## 三、系统架构设计（插件化可扩展版）

### 3.1 整体架构（核心升级：插件化Provider系统）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Model Config System v2.0                             │
│                    插件化架构 · 支持任意主流大模型供应商                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Provider Plugin System                           │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │    │
│  │  │火山方舟   │ │阿里百炼   │ │  OpenAI  │ │  Vidu    │ │  ...     │   │    │
│  │  │ Plugin   │ │ Plugin   │ │ Plugin   │ │ Plugin   │ │ Plugin   │   │    │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │    │
│  │       └─────────────┴─────────────┴─────────────┴─────────────┘       │    │
│  │                              ▲                                        │    │
│  │                              │ 统一接口                                │    │
│  │                       ┌──────┴──────┐                                  │    │
│  │                       │ IProvider   │  ← 插件标准接口                   │    │
│  │                       │  Interface  │                                  │    │
│  │                       └──────┬──────┘                                  │    │
│  └──────────────────────────────┼───────────────────────────────────────┘    │
│                                 │                                            │
│  ┌──────────────────────────────┼───────────────────────────────────────┐    │
│  │                              ▼           Core Layers                   │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐        │    │
│  │  │   Config     │  │   Runtime    │  │     Monitoring       │        │    │
│  │  │   Layer      │  │    Layer     │  │       Layer          │        │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘        │    │
│  │         │                 │                     │                     │    │
│  │  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────────▼───────────┐        │    │
│  │  │ModelRegistry │  │ProviderRouter│  │  HealthChecker       │        │    │
│  │  │ - Templates  │  │ - Discovery  │  │  - API Key Validate  │        │    │
│  │  │ - Instances  │  │ - Lifecycle  │  │  - Connectivity      │        │    │
│  │  │ - Versions   │  │ - Fallback   │  │  - Rate Limit        │        │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘        │    │
│  │                                                                        │    │
│  │  ┌──────────────┐  ┌──────────────────────────────────────────┐       │    │
│  │  │  DevOnly     │  │        Protocol Adapter Layer             │       │    │
│  │  │  (ModelScope)│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │       │    │
│  │  └──────────────┘  │  │ OpenAI   │ │ Volcengine│ │ Custom   │  │       │    │
│  │                    │  │ Protocol │ │ Protocol │ │ Protocol │  │       │    │
│  │                    │  └──────────┘ └──────────┘ └──────────┘  │       │    │
│  │                    └──────────────────────────────────────────┘       │    │
│  └───────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 核心架构升级点

| 架构层级         | V1.0设计             | V2.0升级（插件化）     | 价值                         |
| ---------------- | -------------------- | ---------------------- | ---------------------------- |
| **Provider接入** | 硬编码Provider类     | **插件化注册机制**     | 新增Provider无需修改核心代码 |
| **协议适配**     | 每个Provider独立处理 | **Protocol Adapter层** | 支持OpenAI兼容协议批量接入   |
| **配置管理**     | 静态配置数组         | **动态配置+模板继承**  | 支持运行时添加模型配置       |
| **能力声明**     | 固定能力字段         | **可扩展能力标签系统** | 灵活定义模型能力             |
| **健康检查**     | 无                   | **标准化健康检查接口** | 统一验证各Provider可用性     |

### 3.3 模块职责

| 模块                       | 职责                             | 关键类/接口                                          |
| -------------------------- | -------------------------------- | ---------------------------------------------------- |
| **Provider Plugin System** | 插件化Provider管理               | `IProvider`, `ProviderPluginManager`                 |
| **Protocol Adapter Layer** | API协议适配                      | `IProtocolAdapter`, `OpenAIAdapter`, `CustomAdapter` |
| **Config Layer**           | 模型配置定义、模板管理、版本控制 | `ModelRegistry`, `ModelTemplate`                     |
| **Runtime Layer**          | Provider路由、请求处理、响应解析 | `ProviderRouter`, `ProviderLifecycle`                |
| **Monitoring Layer**       | 健康检查、性能监控、成本统计     | `HealthChecker`, `PerformanceMonitor`                |
| **DevOnly**                | 开发测试专用模型隔离             | `DevModelManager`                                    |

---

## 四、详细设计（可扩展架构）

### 4.1 Provider插件系统（核心设计）

#### 4.1.1 标准Provider接口

```typescript
// services/ai/core/IProvider.ts

/**
 * Provider插件标准接口
 * 所有Provider插件必须实现此接口
 *
 * 设计原则：
 * 1. 接口稳定 - 不轻易变更，保证向后兼容
 * 2. 最小必需 - 只定义核心方法，扩展通过配置实现
 * 3. 协议无关 - 具体协议由Adapter处理
 */
export interface IProvider {
  /** Provider唯一标识 */
  readonly id: string;

  /** Provider显示名称 */
  readonly name: string;

  /** 支持的模型类型 */
  readonly supportedTypes: ('image' | 'video' | 'llm')[];

  /** 默认协议适配器类型 */
  readonly defaultProtocol: 'openai' | 'volcengine' | 'aliyun' | 'custom';

  /**
   * 初始化Provider
   * @param config Provider配置
   */
  initialize(config: ProviderInitConfig): Promise<void>;

  /**
   * 图像生成
   */
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;

  /**
   * 视频生成
   */
  generateVideo?(request: VideoGenerationRequest): Promise<VideoGenerationResponse>;

  /**
   * 文本生成
   */
  generateText?(request: TextGenerationRequest): Promise<TextGenerationResponse>;

  /**
   * 验证配置有效性
   */
  validateConfig(config: ModelConfig): Promise<ValidationResult>;

  /**
   * 健康检查
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * 获取可用模型列表
   */
  listModels?(): Promise<ModelInfo[]>;

  /**
   * 销毁Provider（资源清理）
   */
  dispose?(): Promise<void>;
}

/**
 * Provider初始化配置
 */
export interface ProviderInitConfig {
  /** API密钥 */
  apiKey?: string;

  /** 自定义API端点 */
  baseUrl?: string;

  /** 超时设置（毫秒） */
  timeout?: number;

  /** 重试次数 */
  maxRetries?: number;

  /** 额外配置 */
  options?: Record<string, any>;
}
```

#### 4.1.2 Provider插件管理器

````typescript
// services/ai/core/ProviderPluginManager.ts

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
    this.isDevMode = import.meta.env.DEV || process.env.NODE_ENV === 'development';
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

    console.log(`[ProviderPluginManager] Registered: ${provider.name} (${provider.id})`);
  }

  /**
   * 批量注册插件（从配置自动加载）
   */
  async registerFromConfig(): Promise<void> {
    // 核心Provider（所有环境）
    const coreProviders: Array<{ provider: IProvider; metadata: ProviderMetadata }> = [
      { provider: new VolcengineProviderPlugin(), metadata: { environment: 'all', priority: 100 } },
      { provider: new AliyunProviderPlugin(), metadata: { environment: 'all', priority: 100 } },
      { provider: new OpenAIProviderPlugin(), metadata: { environment: 'all', priority: 100 } },
      { provider: new ViduProviderPlugin(), metadata: { environment: 'all', priority: 100 } },
      { provider: new DeepSeekProviderPlugin(), metadata: { environment: 'all', priority: 100 } },
      { provider: new KimiProviderPlugin(), metadata: { environment: 'all', priority: 100 } },
      { provider: new ZhipuProviderPlugin(), metadata: { environment: 'all', priority: 100 } },
    ];

    // 开发测试Provider（仅开发环境）
    const devProviders: Array<{ provider: IProvider; metadata: ProviderMetadata }> = [
      {
        provider: new ModelscopeProviderPlugin(),
        metadata: { environment: 'development', priority: 50 },
      },
    ];

    // 注册核心Provider
    for (const { provider, metadata } of coreProviders) {
      this.register(provider, metadata);
    }

    // 注册开发测试Provider
    for (const { provider, metadata } of devProviders) {
      this.register(provider, metadata);
    }

    console.log(`[ProviderPluginManager] Registered ${this.plugins.size} providers`);
  }

  /**
   * 获取Provider实例
   */
  getProvider(id: string): IProvider {
    const provider = this.plugins.get(id);
    if (!provider) {
      // 检查是否是开发环境专用
      const meta = this.metadata.get(id);
      if (meta?.environment === 'development' && !this.isDevMode) {
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
  getProvidersByType(type: 'image' | 'video' | 'llm'): IProvider[] {
    return this.getAllProviders().filter(p => p.supportedTypes.includes(type));
  }

  /**
   * 检查当前环境是否可加载
   */
  private canLoadInEnvironment(environment: 'all' | 'development' | 'production'): boolean {
    if (environment === 'all') return true;
    if (environment === 'development') return this.isDevMode;
    if (environment === 'production') return !this.isDevMode;
    return false;
  }
}

/**
 * Provider元数据
 */
export interface ProviderMetadata {
  /** 环境限制 */
  environment: 'all' | 'development' | 'production';

  /** 加载优先级（数字越小优先级越高） */
  priority: number;

  /** 依赖的其他Provider */
  dependencies?: string[];

  /** 版本要求 */
  version?: string;
}
````

### 4.2 协议适配器层（Protocol Adapter Layer）

#### 4.2.1 协议适配器接口

```typescript
// services/ai/core/adapters/IProtocolAdapter.ts

/**
 * 协议适配器接口
 *
 * 设计目的：
 * 1. 统一不同厂商API的调用方式
 * 2. 支持OpenAI兼容协议批量接入
 * 3. 简化新Provider接入成本
 */
export interface IProtocolAdapter {
  /**
   * 构建请求体
   */
  buildRequest(params: AdapterRequestParams): unknown;

  /**
   * 解析响应体
   */
  parseResponse(response: unknown): AdapterResponse;

  /**
   * 处理错误
   */
  handleError(error: unknown): AdapterError;

  /**
   * 获取认证头
   */
  getAuthHeaders(apiKey: string): Record<string, string>;

  /**
   * 获取API端点
   */
  getEndpoint(baseUrl: string, operation: string): string;
}

/**
 * OpenAI兼容协议适配器
 *
 * 适用厂商：阿里百炼、DeepSeek、Kimi、智谱等
 */
export class OpenAIProtocolAdapter implements IProtocolAdapter {
  buildRequest(params: AdapterRequestParams): unknown {
    return {
      model: params.modelId,
      messages: params.messages,
      temperature: params.temperature ?? 0.3,
      max_tokens: params.maxTokens ?? 4000,
      stream: false,
      ...params.extraParams,
    };
  }

  parseResponse(response: unknown): AdapterResponse {
    const data = response as any;
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
      model: data.model,
      raw: data,
    };
  }

  handleError(error: unknown): AdapterError {
    // 统一错误处理
    const err = error as any;
    return {
      code: err.error?.code || 'unknown_error',
      message: err.error?.message || String(error),
      type: this.classifyError(err.status),
    };
  }

  getAuthHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
  }

  getEndpoint(baseUrl: string, operation: string): string {
    const operations: Record<string, string> = {
      chat: '/chat/completions',
      models: '/models',
      embeddings: '/embeddings',
    };
    return `${baseUrl}${operations[operation] || '/' + operation}`;
  }

  private classifyError(status: number): ErrorType {
    if (status === 401) return 'auth_error';
    if (status === 429) return 'rate_limit';
    if (status >= 500) return 'server_error';
    return 'request_error';
  }
}

/**
 * 火山方舟协议适配器
 *
 * 特点：
 * 1. 图像生成使用自定义格式
 * 2. 视频生成使用任务系统
 * 3. 文本生成兼容OpenAI格式
 */
export class VolcengineProtocolAdapter implements IProtocolAdapter {
  private imageAdapter = new VolcengineImageAdapter();
  private videoAdapter = new VolcengineVideoAdapter();
  private textAdapter = new OpenAIProtocolAdapter(); // 文本兼容OpenAI

  buildRequest(params: AdapterRequestParams): unknown {
    switch (params.operation) {
      case 'image_generation':
        return this.imageAdapter.buildRequest(params);
      case 'video_generation':
        return this.videoAdapter.buildRequest(params);
      case 'chat':
        return this.textAdapter.buildRequest(params);
      default:
        throw new Error(`Unsupported operation: ${params.operation}`);
    }
  }

  parseResponse(response: unknown): AdapterResponse {
    // 根据响应类型选择适配器
    // ...
  }

  // ... 其他方法
}
```

#### 4.2.2 使用协议适配器快速接入新Provider

```typescript
/**
 * 示例：使用OpenAI协议适配器快速接入新Provider
 *
 * 以接入"零一万物"为例，只需30行代码：
 */

// 1. 创建Provider插件类
export class LingyiProviderPlugin implements IProvider {
  readonly id = 'lingyi';
  readonly name = '零一万物';
  readonly supportedTypes = ['llm'] as const;
  readonly defaultProtocol = 'openai' as const;

  private adapter: OpenAIProtocolAdapter;
  private config: ProviderInitConfig;

  async initialize(config: ProviderInitConfig): Promise<void> {
    this.config = config;
    this.adapter = new OpenAIProtocolAdapter();
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const body = this.adapter.buildRequest({
      modelId: request.modelId,
      messages: request.messages,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });

    const response = await fetch(
      this.adapter.getEndpoint(this.config.baseUrl || 'https://api.lingyiwanwu.com/v1', 'chat'),
      {
        method: 'POST',
        headers: this.adapter.getAuthHeaders(this.config.apiKey!),
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    return this.adapter.parseResponse(data);
  }

  async validateConfig(config: ModelConfig): Promise<ValidationResult> {
    // 验证API密钥
    try {
      const response = await fetch(
        this.adapter.getEndpoint(config.apiUrl || 'https://api.lingyiwanwu.com/v1', 'models'),
        { headers: this.adapter.getAuthHeaders(config.apiKey!) }
      );
      return { valid: response.status === 200 };
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    // 健康检查实现
    // ...
  }
}

// 2. 注册插件
pluginManager.register(new LingyiProviderPlugin(), {
  environment: 'all',
  priority: 100,
});
```

### 4.3 模型模板系统（可扩展版）

#### 4.3.1 模板继承机制

```typescript
// config/modelTemplates.ts

/**
 * 模型模板系统 - 支持继承和覆盖
 *
 * 设计原则：
 * 1. 基础模板定义通用配置
 * 2. 厂商模板继承基础模板
 * 3. 具体模型继承厂商模板
 * 4. 支持运行时覆盖
 */

/**
 * 基础图像生成模板
 */
export const BASE_IMAGE_TEMPLATE: ModelTemplate = {
  id: 'template-base-image',
  name: '基础图像生成模板',
  type: 'image',

  // 通用能力
  capabilities: {
    supportsReferenceImage: true,
    maxReferenceImages: 5,
    maxBatchSize: 1,
    supportedResolutions: ['1K', '2K', '4K'],
    supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
  },

  // 通用参数
  parameters: [
    {
      name: 'resolution',
      type: 'select',
      label: '分辨率',
      options: [
        { label: '1K', value: '1K' },
        { label: '2K', value: '2K' },
        { label: '4K', value: '4K' },
      ],
      defaultValue: '2K',
    },
    {
      name: 'aspectRatio',
      type: 'select',
      label: '宽高比',
      options: [
        { label: '1:1', value: '1:1' },
        { label: '16:9', value: '16:9' },
        { label: '9:16', value: '9:16' },
        { label: '4:3', value: '4:3' },
        { label: '3:4', value: '3:4' },
      ],
      defaultValue: '16:9',
    },
    {
      name: 'guidanceScale',
      type: 'number',
      label: '引导系数',
      min: 1,
      max: 20,
      step: 0.1,
      defaultValue: 3.5,
    },
  ],

  // 环境限制
  environment: 'all',
};

/**
 * 火山方舟图像模板 - 继承基础模板
 */
export const VOLCENGINE_IMAGE_TEMPLATE: ModelTemplate = {
  id: 'template-volcengine-image',
  name: '火山方舟图像生成模板',
  type: 'image',

  // 继承基础模板
  extends: 'template-base-image',

  // 覆盖和扩展
  capabilities: {
    // 继承基础能力并扩展
    ...BASE_IMAGE_TEMPLATE.capabilities,
    supportsReferenceImage: true,
    maxReferenceImages: 10, // 火山支持更多参考图
    maxBatchSize: 4, // 支持批量生成
    minPixels: 3686400,
    maxPixels: 16777216,
  },

  // 参数覆盖
  parameters: [
    // 继承基础参数
    ...BASE_IMAGE_TEMPLATE.parameters,
    // 添加火山特有参数
    {
      name: 'watermark',
      type: 'boolean',
      label: '水印',
      defaultValue: false,
    },
    {
      name: 'seed',
      type: 'number',
      label: '随机种子',
      defaultValue: -1,
      description: '-1表示随机',
    },
  ],

  // Provider特定配置
  providerOptions: {
    provider: 'volcengine',
    protocol: 'volcengine',
    strategy: 'seedream-4',
  },

  environment: 'all',
};

/**
 * 模板注册表
 */
export class ModelTemplateRegistry {
  private templates = new Map<string, ModelTemplate>();

  register(template: ModelTemplate): void {
    // 处理继承
    if (template.extends) {
      const parent = this.templates.get(template.extends);
      if (parent) {
        template = this.mergeTemplate(parent, template);
      }
    }

    this.templates.set(template.id, template);
  }

  /**
   * 合并模板（继承逻辑）
   */
  private mergeTemplate(parent: ModelTemplate, child: ModelTemplate): ModelTemplate {
    return {
      ...parent,
      ...child,
      capabilities: {
        ...parent.capabilities,
        ...child.capabilities,
      },
      parameters: this.mergeParameters(parent.parameters, child.parameters),
    };
  }

  /**
   * 合并参数（子模板可覆盖父模板）
   */
  private mergeParameters(parent: ModelParameter[], child: ModelParameter[]): ModelParameter[] {
    const merged = new Map<string, ModelParameter>();

    // 先添加父模板参数
    for (const param of parent) {
      merged.set(param.name, param);
    }

    // 子模板参数覆盖
    for (const param of child) {
      merged.set(param.name, { ...merged.get(param.name), ...param });
    }

    return Array.from(merged.values());
  }

  getTemplate(id: string): ModelTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): ModelTemplate[] {
    return Array.from(this.templates.values());
  }
}
```

### 4.4 动态配置系统

#### 4.4.1 运行时模型配置

````typescript
// services/ai/core/ModelConfigManager.ts

/**
 * 动态模型配置管理器
 *
 * 支持：
 * 1. 运行时添加/修改模型配置
 * 2. 配置持久化
 * 3. 配置验证
 * 4. 热更新
 */
export class ModelConfigManager {
  private configs = new Map<string, RuntimeModelConfig>();
  private templateRegistry: ModelTemplateRegistry;

  constructor(templateRegistry: ModelTemplateRegistry) {
    this.templateRegistry = templateRegistry;
  }

  /**
   * 从模板创建模型配置
   *
   * 示例：
   * ```typescript
   * const config = configManager.createFromTemplate(
   *   'template-volcengine-image',
   *   {
   *     id: 'my-custom-model',
   *     name: '我的自定义模型',
   *     modelId: 'doubao-custom-001',
   *     apiKey: 'xxx',
   *   }
   * );
   * ```
   */
  createFromTemplate(
    templateId: string,
    overrides: Partial<RuntimeModelConfig>
  ): RuntimeModelConfig {
    const template = this.templateRegistry.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const config: RuntimeModelConfig = {
      id: overrides.id || `${templateId}-${Date.now()}`,
      name: overrides.name || template.name,
      provider: overrides.provider || template.providerOptions?.provider || 'custom',
      modelId: overrides.modelId || '',
      type: template.type,
      capabilities: { ...template.capabilities, ...overrides.capabilities },
      parameters: template.parameters,
      ...overrides,
    };

    // 验证配置
    this.validateConfig(config);

    // 存储配置
    this.configs.set(config.id, config);

    return config;
  }

  /**
   * 验证配置有效性
   */
  validateConfig(config: RuntimeModelConfig): ValidationResult {
    const errors: string[] = [];

    // 验证必需字段
    if (!config.id) errors.push('Missing required field: id');
    if (!config.name) errors.push('Missing required field: name');
    if (!config.provider) errors.push('Missing required field: provider');
    if (!config.modelId) errors.push('Missing required field: modelId');

    // 验证Provider是否存在
    try {
      pluginManager.getProvider(config.provider);
    } catch (error) {
      errors.push(`Provider not found: ${config.provider}`);
    }

    // 验证API密钥格式（基础验证）
    if (config.apiKey) {
      if (config.apiKey.length < 10) {
        errors.push('API key seems too short');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 导出配置
   */
  exportConfig(configId: string): string {
    const config = this.configs.get(configId);
    if (!config) throw new Error(`Config not found: ${configId}`);

    // 移除敏感信息
    const exportable = { ...config };
    delete exportable.apiKey;

    return JSON.stringify(exportable, null, 2);
  }

  /**
   * 导入配置
   */
  importConfig(json: string, apiKey?: string): RuntimeModelConfig {
    const data = JSON.parse(json);

    if (apiKey) {
      data.apiKey = apiKey;
    }

    return this.createFromTemplate(data.templateId || 'template-base', data);
  }
}

/**
 * 运行时模型配置
 */
export interface RuntimeModelConfig extends ModelConfig {
  /** 基于的模板ID */
  templateId?: string;

  /** 是否为用户自定义 */
  isCustom?: boolean;

  /** 创建时间 */
  createdAt?: number;

  /** 更新时间 */
  updatedAt?: number;

  /** 配置来源 */
  source?: 'builtin' | 'user' | 'imported';
}
````

### 4.5 开发测试模型隔离（增强版）

```typescript
// services/ai/dev/DevModelManager.ts

/**
 * 开发测试模型管理器 V2
 *
 * 增强功能：
 * 1. 更明显的视觉标记
 * 2. 生产环境完全禁用
 * 3. 使用警告和确认
 * 4. 自动清理机制
 */
export class DevModelManager {
  private readonly isDevMode: boolean;
  private readonly warningShown = new Set<string>();

  constructor() {
    this.isDevMode = import.meta.env.DEV || process.env.NODE_ENV === 'development';
  }

  /**
   * 检查是否可以使用开发测试模型
   */
  canUseDevModels(): boolean {
    return this.isDevMode;
  }

  /**
   * 标记模型为开发测试专用
   */
  markAsDevModel<T extends { name: string; id: string }>(model: T): T {
    const markedName = `🔧 [开发测试-仅本地可用] ${model.name}`;

    // 显示警告（每个模型只显示一次）
    if (!this.warningShown.has(model.id)) {
      console.warn(
        `%c[DevModelManager] 开发测试模型警告`,
        'color: orange; font-weight: bold;',
        `\n模型: ${model.name}`,
        `\n此模型仅用于开发测试，生产环境不可用`,
        `\n生产环境请使用商用模型（火山方舟、阿里百炼等）`
      );
      this.warningShown.add(model.id);
    }

    return {
      ...model,
      name: markedName,
      metadata: {
        ...((model as any).metadata || {}),
        isDevOnly: true,
        devWarning: '⚠️ 此模型仅用于开发测试，生产环境不可用',
        productionAlternative: '请使用火山方舟、阿里百炼等商用模型',
      },
    };
  }

  /**
   * 获取开发测试专用模型列表
   */
  getDevModels(): ModelConfig[] {
    if (!this.isDevMode) {
      console.warn('[DevModelManager] 生产环境已禁用所有开发测试模型');
      return [];
    }

    const devModels: ModelConfig[] = [
      {
        id: 'dev-modelscope-z-image',
        name: '通义万相 Z-Image',
        provider: 'modelscope',
        modelId: 'Tongyi-MAI/Z-Image',
        type: 'image',
        capabilities: {
          supportsReferenceImage: true,
          maxReferenceImages: 5,
          maxBatchSize: 1,
        },
      },
      {
        id: 'dev-modelscope-qwen',
        name: '魔搭通义千问',
        provider: 'modelscope',
        modelId: 'qwen/Qwen2-72B-Instruct',
        type: 'llm',
        capabilities: {
          maxContextLength: 32000,
        },
      },
    ];

    return devModels.map(m => this.markAsDevModel(m));
  }

  /**
   * 生产环境检查（严格模式）
   */
  enforceProductionSafety(config: ModelConfig): void {
    if (!this.isDevMode && this.isDevModel(config)) {
      throw new Error(
        `🚫 生产环境禁止使用开发测试模型: ${config.name}\n` +
          `请使用商用模型替代:\n` +
          `- 图像生成: 火山方舟 Seedream 系列\n` +
          `- LLM: 阿里百炼通义千问、DeepSeek、Kimi 等`
      );
    }
  }

  /**
   * 检查是否为开发测试模型
   */
  isDevModel(config: ModelConfig): boolean {
    return (
      config.provider === 'modelscope' ||
      config.id?.startsWith('dev-') ||
      (config.metadata as any)?.isDevOnly === true
    );
  }

  /**
   * 获取生产环境替代建议
   */
  getProductionAlternative(devModelType: 'image' | 'video' | 'llm'): string[] {
    const alternatives: Record<string, string[]> = {
      image: ['volc-img-seedream-4.5', 'volc-img-seedream-4.0', 'vidu-img-q2'],
      video: ['volc-vid-seedance-1.5-pro', 'vidu-vid-2.0', 'vidu-vid-q2'],
      llm: ['aliyun-llm-qwen-max', 'volc-llm-deepseek-v3.2', 'volc-llm-kimi-k2'],
    };

    return alternatives[devModelType] || [];
  }
}
```

---

## 五、主流大模型供应商接入指南

### 5.1 已规划接入的供应商

| 供应商       | 类型          | 协议       | 接入难度 | 状态      |
| ------------ | ------------- | ---------- | -------- | --------- |
| **火山方舟** | 图像/视频/LLM | 自定义     | 中       | ✅ 已接入 |
| **阿里百炼** | LLM           | OpenAI兼容 | 低       | ✅ 已接入 |
| **Vidu**     | 图像/视频     | 自定义     | 中       | ✅ 已接入 |
| **OpenAI**   | LLM           | 官方协议   | 低       | ✅ 已接入 |
| **DeepSeek** | LLM           | OpenAI兼容 | 低       | ✅ 已接入 |
| **Kimi**     | LLM           | OpenAI兼容 | 低       | ✅ 已接入 |
| **智谱AI**   | LLM           | OpenAI兼容 | 低       | ✅ 已接入 |
| **零一万物** | LLM           | OpenAI兼容 | 低       | 📝 预留   |
| **MiniMax**  | LLM/视频      | OpenAI兼容 | 低       | 📝 预留   |
| **商汤**     | 图像/视频     | 自定义     | 中       | 📝 预留   |
| **百度千帆** | LLM/图像      | OpenAI兼容 | 低       | 📝 预留   |
| **腾讯混元** | LLM/图像      | 自定义     | 中       | 📝 预留   |

### 5.2 快速接入新Provider（3步完成）

```typescript
/**
 * 步骤1: 创建Provider插件（约30行代码）
 */
// services/ai/providers/plugins/NewProviderPlugin.ts
export class NewProviderPlugin implements IProvider {
  readonly id = 'newprovider';
  readonly name = '新供应商';
  readonly supportedTypes = ['llm'] as const;
  readonly defaultProtocol = 'openai' as const;

  private adapter: IProtocolAdapter;

  async initialize(config: ProviderInitConfig): Promise<void> {
    this.adapter = createProtocolAdapter(this.defaultProtocol);
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    // 使用协议适配器处理请求
    const body = this.adapter.buildRequest(request);
    const response = await this.makeRequest(body);
    return this.adapter.parseResponse(response);
  }

  async validateConfig(config: ModelConfig): Promise<ValidationResult> {
    // 验证实现
  }

  async healthCheck(): Promise<HealthCheckResult> {
    // 健康检查实现
  }
}

/**
 * 步骤2: 注册插件（1行代码）
 */
// 在 ProviderPluginManager 中注册
pluginManager.register(new NewProviderPlugin(), {
  environment: 'all',
  priority: 100,
});

/**
 * 步骤3: 添加模型配置（可选，也可运行时动态添加）
 */
// config/models.ts 或运行时动态添加
const newModel = configManager.createFromTemplate('template-openai-llm', {
  id: 'newprovider-llm-model',
  name: '新供应商模型',
  provider: 'newprovider',
  modelId: 'model-id-from-provider',
});
```

### 5.3 协议适配器选择指南

| 供应商类型 | 推荐协议适配器              | 接入成本  | 示例供应商                     |
| ---------- | --------------------------- | --------- | ------------------------------ |
| OpenAI兼容 | `OpenAIProtocolAdapter`     | ⭐ 极低   | 阿里百炼、DeepSeek、Kimi、智谱 |
| 火山方舟   | `VolcengineProtocolAdapter` | ⭐⭐ 低   | 火山方舟                       |
| Vidu       | `ViduProtocolAdapter`       | ⭐⭐ 低   | Vidu                           |
| 完全自定义 | `CustomProtocolAdapter`     | ⭐⭐⭐ 中 | 需要自定义适配器               |

---

## 六、模型清单（可扩展版）

### 6.1 商用模型清单

#### 6.1.1 火山方舟 (Volcengine)

| 模型ID                         | 名称                       | 类型  | 状态      | 生产就绪 |
| ------------------------------ | -------------------------- | ----- | --------- | -------- |
| volc-img-seedream-4.5          | 豆包 Seedream 4.5          | image | ✅ active | ✅       |
| volc-img-seedream-4.0          | 豆包 Seedream 4.0          | image | ✅ active | ✅       |
| volc-img-seedream-3.0-t2i      | 豆包 Seedream 3.0 T2I      | image | ✅ active | ✅       |
| volc-vid-seedance-1.5-pro      | 豆包 Seedance 1.5 Pro      | video | ✅ active | ✅       |
| volc-vid-seedance-1.0-pro      | 豆包 Seedance 1.0 Pro      | video | ✅ active | ✅       |
| volc-vid-seedance-1.0-pro-fast | 豆包 Seedance 1.0 Pro Fast | video | ✅ active | ✅       |
| volc-vid-seedance-1.0-lite-i2v | 豆包 Seedance 1.0 Lite I2V | video | ✅ active | ✅       |
| volc-llm-doubao-pro            | 豆包 Pro                   | llm   | ✅ active | ✅       |
| volc-llm-doubao-lite           | 豆包 Lite                  | llm   | ✅ active | ✅       |
| volc-llm-seed-1.8              | 豆包 Seed 1.8              | llm   | ✅ active | ✅       |
| volc-llm-seed-1.6              | 豆包 Seed 1.6              | llm   | ✅ active | ✅       |
| volc-llm-deepseek-v3.2         | DeepSeek V3.2              | llm   | ✅ active | ✅       |
| volc-llm-deepseek-r1           | DeepSeek R1                | llm   | ✅ active | ✅       |
| volc-llm-kimi-k2               | Kimi K2                    | llm   | ✅ active | ✅       |
| volc-llm-glm-4                 | 智谱 GLM-4                 | llm   | ✅ active | ✅       |

#### 6.1.2 阿里百炼 (Aliyun)

| 模型ID                | 名称           | 类型 | 状态      | 生产就绪 |
| --------------------- | -------------- | ---- | --------- | -------- |
| aliyun-llm-qwen-max   | 通义千问 Max   | llm  | ✅ active | ✅       |
| aliyun-llm-qwen-plus  | 通义千问 Plus  | llm  | ✅ active | ✅       |
| aliyun-llm-qwen-turbo | 通义千问 Turbo | llm  | ✅ active | ✅       |

#### 6.1.3 其他商用模型

| 提供商   | 模型ID                 | 名称          | 类型  | 状态      |
| -------- | ---------------------- | ------------- | ----- | --------- |
| OpenAI   | openai-llm-gpt-4o      | GPT-4o        | llm   | ✅ active |
| OpenAI   | openai-llm-gpt-4o-mini | GPT-4o Mini   | llm   | ✅ active |
| Vidu     | vidu-img-q2            | Vidu Q2       | image | ✅ active |
| Vidu     | vidu-vid-2.0           | Vidu 2.0      | video | ✅ active |
| DeepSeek | deepseek-llm-v3.2      | DeepSeek V3.2 | llm   | ✅ active |
| Kimi     | kimi-llm-k2            | Kimi K2       | llm   | ✅ active |
| 智谱     | zhipu-llm-glm-4        | GLM-4         | llm   | ✅ active |

### 6.2 开发测试专用模型

| 模型ID                 | 名称                           | 类型  | 状态        | 环境限制    |
| ---------------------- | ------------------------------ | ----- | ----------- | ----------- |
| dev-modelscope-z-image | 🔧 [开发测试] 通义万相 Z-Image | image | ⚠️ dev-only | development |
| dev-modelscope-qwen    | 🔧 [开发测试] 魔搭通义千问     | llm   | ⚠️ dev-only | development |

---

## 七、实施任务清单（可扩展架构版）

### 阶段1: 插件化基础架构 (预计1.5周)

#### 任务1.1: 创建Provider插件系统

- [ ] 创建 `services/ai/core/IProvider.ts` 标准接口
- [ ] 创建 `services/ai/core/ProviderPluginManager.ts` 插件管理器
- [ ] 实现插件注册、发现、生命周期管理
- [ ] 实现环境感知加载（开发/生产）
- [ ] 添加插件依赖管理

#### 任务1.2: 创建协议适配器层

- [ ] 创建 `services/ai/core/adapters/IProtocolAdapter.ts` 接口
- [ ] 实现 `OpenAIProtocolAdapter`（通用适配器）
- [ ] 实现 `VolcengineProtocolAdapter`（火山专用）
- [ ] 实现 `ViduProtocolAdapter`（Vidu专用）
- [ ] 创建适配器工厂 `ProtocolAdapterFactory`

#### 任务1.3: 重构现有Provider为插件

- [ ] 重构 `VolcengineProvider` → `VolcengineProviderPlugin`
- [ ] 重构 `ViduProvider` → `ViduProviderPlugin`
- [ ] 重构 `ModelscopeProvider` → `ModelscopeProviderPlugin`（开发测试）
- [ ] 创建 `AliyunProviderPlugin`（阿里百炼）
- [ ] 创建 `OpenAIProviderPlugin`
- [ ] 创建 `DeepSeekProviderPlugin`
- [ ] 创建 `KimiProviderPlugin`
- [ ] 创建 `ZhipuProviderPlugin`

### 阶段2: 模板与配置系统 (预计1周)

#### 任务2.1: 创建模型模板系统

- [ ] 创建 `config/modelTemplates.ts` 模板定义
- [ ] 实现模板继承机制
- [ ] 创建基础模板（图像/视频/LLM）
- [ ] 创建厂商模板（火山/阿里/Vidu）
- [ ] 实现 `ModelTemplateRegistry` 模板注册表

#### 任务2.2: 动态配置管理

- [ ] 创建 `services/ai/core/ModelConfigManager.ts`
- [ ] 实现运行时配置创建
- [ ] 实现配置验证系统
- [ ] 实现配置导入/导出
- [ ] 实现配置持久化

#### 任务2.3: 开发测试模型隔离增强

- [ ] 重构 `DevModelManager` V2
- [ ] 添加更明显的视觉标记 `🔧 [开发测试-仅本地可用]`
- [ ] 实现生产环境严格禁用
- [ ] 添加使用警告和确认
- [ ] 实现自动替代建议

### 阶段3: 监控与验证系统 (预计1周)

#### 任务3.1: 健康检查系统

- [ ] 创建 `services/ai/core/HealthChecker.ts`
- [ ] 实现标准化健康检查接口
- [ ] 实现API密钥验证
- [ ] 实现连通性检查
- [ ] 实现服务可用性检查
- [ ] 添加健康检查缓存机制

#### 任务3.2: 性能监控系统

- [ ] 创建 `services/ai/core/PerformanceMonitor.ts`
- [ ] 实现延迟统计
- [ ] 实现成功率追踪
- [ ] 实现成本估算
- [ ] 实现性能指标存储

#### 任务3.3: UI集成

- [ ] 在Settings页面添加Provider管理Tab
- [ ] 显示Provider健康状态
- [ ] 显示模型性能指标
- [ ] 添加一键健康检查按钮
- [ ] 添加开发测试模型警告UI

### 阶段4: 预留扩展能力 (预计0.5周)

#### 任务4.1: 预留新Provider快速接入能力

- [ ] 创建Provider插件脚手架生成器
- [ ] 编写《新Provider接入指南》
- [ ] 提供示例代码模板
- [ ] 创建接入检查清单

#### 任务4.2: 预留配置扩展点

- [ ] 设计配置扩展接口
- [ ] 实现运行时Provider注册
- [ ] 实现动态模型添加
- [ ] 添加配置热更新支持

#### 任务4.3: 文档与测试

- [ ] 编写架构文档
- [ ] 编写Provider接入指南
- [ ] 编写模型配置指南
- [ ] 添加单元测试
- [ ] 添加集成测试

---

## 八、验收标准

### 8.1 功能验收

| 验收项     | 验收标准                                            |
| ---------- | --------------------------------------------------- |
| 插件化架构 | 新增Provider无需修改核心代码，只需实现IProvider接口 |
| 协议适配器 | 支持OpenAI兼容协议，可批量接入同类供应商            |
| 模板系统   | 支持模板继承，减少70%重复配置代码                   |
| 动态配置   | 支持运行时添加/修改模型配置                         |
| 健康检查   | 统一接口，支持所有Provider健康检查                  |
| 魔搭隔离   | 开发环境可用，生产环境完全禁用并有明确提示          |
| 扩展预留   | 提供新Provider接入脚手架，30行代码完成接入          |

### 8.2 代码质量

| 验收项   | 验收标准                |
| -------- | ----------------------- |
| 类型安全 | 无any类型，严格类型检查 |
| 接口稳定 | IProvider接口向后兼容   |
| 测试覆盖 | 核心功能覆盖率>80%      |
| 文档完整 | 所有公共API有JSDoc注释  |

### 8.3 性能要求

| 验收项   | 验收标准                   |
| -------- | -------------------------- |
| 插件加载 | 所有Provider插件加载<500ms |
| 健康检查 | 单次检查<5秒               |
| 模型切换 | 切换延迟<100ms             |
| 内存占用 | 不高于现有水平             |

---

## 九、附录

### 9.1 主流大模型供应商API参考

| 供应商   | 文档地址                                              | 协议类型   |
| -------- | ----------------------------------------------------- | ---------- |
| 火山方舟 | https://www.volcengine.com/docs/82379                 | 自定义     |
| 阿里百炼 | https://help.aliyun.com/zh/model-studio               | OpenAI兼容 |
| OpenAI   | https://platform.openai.com/docs                      | 官方协议   |
| DeepSeek | https://platform.deepseek.com/docs                    | OpenAI兼容 |
| Kimi     | https://platform.moonshot.cn/docs                     | OpenAI兼容 |
| 智谱AI   | https://open.bigmodel.cn/dev/howuse/introduction      | OpenAI兼容 |
| 零一万物 | https://platform.lingyiwanwu.com/docs                 | OpenAI兼容 |
| MiniMax  | https://platform.minimaxi.com/document                | OpenAI兼容 |
| 商汤     | https://console.sensecore.cn/docs                     | 自定义     |
| 百度千帆 | https://cloud.baidu.com/doc/WENXINWORKSHOP/index.html | OpenAI兼容 |
| 腾讯混元 | https://cloud.tencent.com/document/product/1729       | 自定义     |

### 9.2 环境变量配置

```bash
# 开发环境
NODE_ENV=development
VITE_ENABLE_DEV_MODELS=true
VITE_LOG_LEVEL=debug

# 生产环境
NODE_ENV=production
VITE_ENABLE_DEV_MODELS=false
VITE_LOG_LEVEL=error
```

### 9.3 快速接入检查清单

接入新Provider时，请检查：

- [ ] 实现 `IProvider` 接口
- [ ] 选择合适的协议适配器
- [ ] 实现 `validateConfig` 方法
- [ ] 实现 `healthCheck` 方法
- [ ] 在 `ProviderPluginManager` 中注册
- [ ] 添加模型配置（或支持动态添加）
- [ ] 编写单元测试
- [ ] 更新文档

---

**文档结束**

> 💡 **核心设计理念**: 通过插件化架构和协议适配器层，实现"一次开发，任意接入"的目标。未来接入新的大模型供应商，只需30行代码即可完成。
