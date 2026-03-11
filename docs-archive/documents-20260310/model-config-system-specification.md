# 模型配置系统优化规格文档 (Specification)

> **文档版本**: 1.0  
> **更新日期**: 2026-03-06  
> **文档状态**: 待审核

---

## 一、需求背景与目标

### 1.1 业务背景

本项目是一个AI影视资产生成平台，需要接入多种AI模型服务：

- **图像生成**: 用于角色、场景、物品、关键帧生成
- **视频生成**: 用于视频片段生成
- **文本解析**: 用于剧本解析、分镜生成

### 1.2 模型提供商分类

根据用户反馈，模型提供商分为两类：

| 类型         | 提供商                           | 用途           | 生产环境      |
| ------------ | -------------------------------- | -------------- | ------------- |
| **商用模型** | 火山方舟、阿里百炼、OpenAI、Vidu | 正式生产使用   | ✅ 保留       |
| **开发测试** | 魔搭社区 (ModelScope)            | 仅开发阶段测试 | ⚠️ 标记为临时 |

**重要**: 魔搭社区的免费API模型仅用于开发测试，与商用模型有本质区别。生产环境不会接入魔搭社区模型。

### 1.3 优化目标

1. **系统性**: 建立完整的模型配置管理体系
2. **专业性**: 符合火山方舟、阿里百炼等主流平台的接入规范
3. **可扩展**: 支持未来新增模型和提供商
4. **可维护**: 清晰的架构，便于长期维护
5. **生产就绪**: 区分开发测试与生产环境配置

---

## 二、术语定义

| 术语            | 定义                                                     |
| --------------- | -------------------------------------------------------- |
| **Provider**    | 模型服务提供商，如火山方舟、阿里百炼                     |
| **Model**       | 具体的AI模型，如 Doubao-Seedream-4.5                     |
| **Endpoint**    | API接入点，如 `https://ark.cn-beijing.volces.com/api/v3` |
| **Capability**  | 模型能力，如支持参考图、支持文生视频                     |
| **Strategy**    | 提供商特定的请求处理策略                                 |
| **Environment** | 运行环境：development / production                       |

---

## 三、系统架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Model Config System                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Config     │  │   Runtime    │  │     Monitoring       │  │
│  │   Layer      │  │    Layer     │  │       Layer          │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                     │              │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────────▼───────────┐  │
│  │ ModelRegistry│  │ProviderRouter│  │  HealthChecker       │  │
│  │ - Templates  │  │ - Volcengine │  │  - API Key Validate  │  │
│  │ - Instances  │  │ - Aliyun     │  │  - Connectivity      │  │
│  │ - Versions   │  │ - Vidu       │  │  - Rate Limit        │  │
│  └──────────────┘  │ - OpenAI     │  └──────────────────────┘  │
│                    │ - ModelScope │                            │
│  ┌──────────────┐  └──────────────┘  ┌──────────────────────┐  │
│  │  DevOnly     │                     │ PerformanceMonitor   │  │
│  │  (ModelScope)│                     │  - Latency Stats     │  │
│  └──────────────┘                     │  - Success Rate      │  │
│                                       │  - Cost Tracking     │  │
│                                       └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 模块职责

| 模块             | 职责                             | 关键类/接口                           |
| ---------------- | -------------------------------- | ------------------------------------- |
| Config Layer     | 模型配置定义、模板管理、版本控制 | `ModelRegistry`, `ModelTemplate`      |
| Runtime Layer    | Provider路由、请求处理、响应解析 | `ProviderRouter`, `BaseProvider`      |
| Monitoring Layer | 健康检查、性能监控、成本统计     | `HealthChecker`, `PerformanceMonitor` |
| DevOnly          | 开发测试专用模型隔离             | `DevModelManager`                     |

---

## 四、详细设计

### 4.1 配置层设计

#### 4.1.1 模型模板系统

```typescript
// config/modelTemplates.ts

/**
 * 模型模板 - 定义同类模型的通用配置
 * 用于减少重复配置，便于统一管理
 */
export interface ModelTemplate {
  id: string;
  name: string;
  provider: CommercialProvider | 'modelscope';
  type: 'image' | 'video' | 'llm';

  // 能力定义
  capabilities: ModelCapabilities;

  // 参数定义
  parameters: ModelParameter[];

  // 提供商特定选项
  providerOptions: ProviderSpecificOptions;

  // 环境限制
  environment: 'all' | 'development' | 'production';
}

/**
 * 商用提供商枚举
 */
export type CommercialProvider =
  | 'volcengine' // 火山方舟
  | 'aliyun' // 阿里百炼
  | 'openai' // OpenAI
  | 'vidu' // Vidu
  | 'deepseek' // DeepSeek官方
  | 'moonshot' // Moonshot
  | 'zhipu'; // 智谱AI

/**
 * 提供商特定选项
 */
export interface ProviderSpecificOptions {
  volcengine?: {
    strategy: 'seedream-4' | 'seedream-3' | 'default';
    endpoint: 'ark' | 'custom';
    apiVersion: 'v3' | 'v4';
  };
  aliyun?: {
    endpoint: 'dashscope' | 'custom';
    apiVersion: 'v1';
    region?: 'cn-beijing' | 'cn-shanghai' | 'cn-hangzhou';
  };
  vidu?: {
    endpoint: 'ent-v2' | 'custom';
    authType: 'token' | 'bearer';
  };
  openai?: {
    endpoint: 'official' | 'azure' | 'custom';
    apiVersion?: string;
  };
}
```

#### 4.1.2 火山方舟模板

```typescript
// 火山方舟 - 图像生成模板
const VOLCENGINE_IMAGE_TEMPLATE: ModelTemplate = {
  id: 'template-volcengine-image',
  name: '火山方舟图像生成模板',
  provider: 'volcengine',
  type: 'image',

  capabilities: {
    supportsReferenceImage: true,
    maxReferenceImages: 10,
    maxBatchSize: 4,
    supportedResolutions: ['1K', '2K', '4K'],
    supportedAspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
    responseFormats: ['url', 'b64_json'],
  },

  parameters: [
    {
      name: 'resolution',
      type: 'select',
      label: '分辨率',
      options: [
        { label: '1K (1920x1080)', value: '1K' },
        { label: '2K (2560x1440)', value: '2K' },
        { label: '4K (3840x2160)', value: '4K' },
      ],
      defaultValue: '2K',
    },
    {
      name: 'aspectRatio',
      type: 'select',
      label: '宽高比',
      options: [
        { label: '1:1', value: '1:1', ratio: 1 },
        { label: '16:9', value: '16:9', ratio: 16 / 9 },
        { label: '9:16', value: '9:16', ratio: 9 / 16 },
        { label: '4:3', value: '4:3', ratio: 4 / 3 },
        { label: '3:4', value: '3:4', ratio: 3 / 4 },
        { label: '3:2', value: '3:2', ratio: 3 / 2 },
        { label: '2:3', value: '2:3', ratio: 2 / 3 },
        { label: '21:9', value: '21:9', ratio: 21 / 9 },
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
    {
      name: 'seed',
      type: 'number',
      label: '随机种子',
      defaultValue: -1,
      description: '-1表示随机',
    },
    {
      name: 'watermark',
      type: 'boolean',
      label: '水印',
      defaultValue: false,
    },
  ],

  providerOptions: {
    volcengine: {
      strategy: 'seedream-4',
      endpoint: 'ark',
      apiVersion: 'v3',
    },
  },

  environment: 'all',
};
```

#### 4.1.3 阿里百炼模板

```typescript
// 阿里百炼 - LLM模板
const ALIYUN_LLM_TEMPLATE: ModelTemplate = {
  id: 'template-aliyun-llm',
  name: '阿里百炼LLM模板',
  provider: 'aliyun',
  type: 'llm',

  capabilities: {
    maxContextLength: 32000,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsFunctionCalling: true,
  },

  parameters: [
    {
      name: 'temperature',
      type: 'number',
      label: '温度',
      min: 0,
      max: 2,
      step: 0.1,
      defaultValue: 0.3,
    },
    {
      name: 'maxTokens',
      type: 'number',
      label: '最大Token数',
      min: 100,
      max: 32000,
      step: 100,
      defaultValue: 4000,
    },
    {
      name: 'topP',
      type: 'number',
      label: 'Top P',
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.9,
    },
    {
      name: 'presencePenalty',
      type: 'number',
      label: '存在惩罚',
      min: -2,
      max: 2,
      step: 0.1,
      defaultValue: 0,
    },
    {
      name: 'frequencyPenalty',
      type: 'number',
      label: '频率惩罚',
      min: -2,
      max: 2,
      step: 0.1,
      defaultValue: 0,
    },
  ],

  providerOptions: {
    aliyun: {
      endpoint: 'dashscope',
      apiVersion: 'v1',
      region: 'cn-beijing',
    },
  },

  environment: 'all',
};
```

#### 4.1.4 魔搭社区模板（开发测试专用）

```typescript
// 魔搭社区 - 开发测试专用模板
const MODELSCOPE_DEV_TEMPLATE: ModelTemplate = {
  id: 'template-modelscope-dev',
  name: '魔搭社区开发测试模板',
  provider: 'modelscope',
  type: 'image', // 或 llm

  capabilities: {
    supportsReferenceImage: true,
    maxReferenceImages: 5,
    maxBatchSize: 1,
    // 注意：魔搭社区能力有限，仅用于测试
  },

  parameters: [
    // 简化参数，仅基础功能
    {
      name: 'resolution',
      type: 'select',
      label: '分辨率',
      options: [{ label: '1024x1024', value: '1024x1024' }],
      defaultValue: '1024x1024',
    },
  ],

  providerOptions: {},

  // ⚠️ 关键：仅开发环境可用
  environment: 'development',
};
```

### 4.2 运行时层设计

#### 4.2.1 Provider路由系统

```typescript
// services/ai/core/ProviderRouter.ts

/**
 * Provider路由器
 * 负责根据模型配置选择正确的Provider并路由请求
 */
export class ProviderRouter {
  private providers = new Map<string, BaseProvider>();
  private devMode: boolean;

  constructor(devMode: boolean = false) {
    this.devMode = devMode;
    this.registerProviders();
  }

  private registerProviders(): void {
    // 商用Provider - 所有环境都注册
    this.providers.set('volcengine', new VolcengineProvider());
    this.providers.set('aliyun', new AliyunProvider());
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('vidu', new ViduProvider());

    // 开发测试Provider - 仅开发环境注册
    if (this.devMode) {
      this.providers.set('modelscope', new ModelscopeProvider());
      console.warn('[ProviderRouter] ModelScope provider registered for DEVELOPMENT ONLY');
    }
  }

  /**
   * 获取Provider
   * @throws 如果环境不匹配或Provider不存在
   */
  getProvider(providerId: string): BaseProvider {
    const provider = this.providers.get(providerId);

    if (!provider) {
      // 检查是否是开发环境专用Provider
      if (providerId === 'modelscope' && !this.devMode) {
        throw new Error(
          'ModelScope provider is DEVELOPMENT ONLY. ' +
            'It cannot be used in production environment.'
        );
      }
      throw new Error(`Provider not found: ${providerId}`);
    }

    return provider;
  }

  /**
   * 检查Provider是否可用
   */
  isProviderAvailable(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /**
   * 获取所有可用Provider
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
```

#### 4.2.2 火山方舟Provider实现

```typescript
// services/ai/providers/VolcengineProvider.ts

/**
 * 火山方舟Provider
 * 支持：图像生成、视频生成、文本生成
 *
 * API文档参考：
 * - 图像生成：https://www.volcengine.com/docs/82379/1541594
 * - 视频生成：https://www.volcengine.com/docs/82379/xxxxxx
 * - 文本生成：https://www.volcengine.com/docs/82379/xxxxxx
 */
export class VolcengineProvider extends BaseProvider {
  readonly id = 'volcengine';
  readonly name = '火山方舟';
  readonly supportedTypes = ['image', 'video', 'llm'] as const;

  // 火山方舟API配置
  private readonly defaultConfig = {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    timeout: 120000, // 120秒
    maxRetries: 3,
  };

  /**
   * 图像生成
   *
   * 火山方舟图像生成API特点：
   * 1. 支持文生图、图生图
   * 2. 支持批量生成（sequential_image_generation）
   * 3. 支持多种分辨率
   * 4. 返回格式支持URL和Base64
   */
  async generateImage(
    prompt: string,
    config: ModelConfig,
    options: ImageGenerationOptions
  ): Promise<ImageGenerationResult> {
    const apiKey = this.getApiKey(config);
    const strategy = this.getStrategy(config);

    // 构建请求体
    const requestBody = strategy.prepareRequest({
      prompt,
      modelId: config.modelId,
      size: this.resolveSize(options.aspectRatio, options.resolution),
      referenceImages: options.referenceImages,
      count: options.count,
      guidanceScale: options.guidanceScale,
      extraParams: options.extraParams,
    });

    // 发送请求
    const response = await this.makeRequest(
      `${this.getBaseUrl(config)}/images/generations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      },
      this.defaultConfig.timeout
    );

    // 解析响应
    return this.parseImageResponse(response, config);
  }

  /**
   * 视频生成
   */
  async generateVideo(
    prompt: string,
    config: ModelConfig,
    options: VideoGenerationOptions
  ): Promise<VideoGenerationResult> {
    // 实现类似图像生成...
  }

  /**
   * 文本生成
   *
   * 火山方舟文本生成API特点：
   * 1. OpenAI兼容格式
   * 2. 支持流式输出
   * 3. 支持JSON模式
   * 4. 支持function calling
   */
  async generateText(
    prompt: string,
    config: ModelConfig,
    options: TextGenerationOptions
  ): Promise<TextGenerationResult> {
    const apiKey = this.getApiKey(config);

    const requestBody = {
      model: config.modelId,
      messages: [
        ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 4000,
      stream: false,
      // 火山方舟特定参数
      ...(config.providerOptions?.volcengine?.enableThinking !== undefined && {
        enable_thinking: config.providerOptions.volcengine.enableThinking,
      }),
    };

    const response = await this.makeRequest(
      `${this.getBaseUrl(config)}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      },
      this.defaultConfig.timeout
    );

    return this.parseTextResponse(response);
  }

  /**
   * 验证API密钥
   *
   * 火山方舟验证方式：
   * 1. 调用模型列表接口验证密钥有效性
   * 2. 检查密钥权限
   */
  async validateApiKey(config: ModelConfig): Promise<ApiValidationResult> {
    try {
      const apiKey = this.getApiKey(config);

      // 调用轻量级接口验证
      const response = await this.makeRequest(
        `${this.getBaseUrl(config)}/models`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
        10000 // 10秒超时
      );

      if (response.status === 200) {
        return { valid: true };
      } else if (response.status === 401) {
        return { valid: false, error: 'API密钥无效或已过期' };
      } else {
        return { valid: false, error: `验证失败: ${response.status}` };
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  private getStrategy(config: ModelConfig): IVolcengineStrategy {
    const strategyType = config.providerOptions?.volcengine?.strategy;

    switch (strategyType) {
      case 'seedream-4':
        return new Seedream4Strategy();
      case 'seedream-3':
        return new Seedream3Strategy();
      default:
        return new DefaultStrategy();
    }
  }

  private getBaseUrl(config: ModelConfig): string {
    return config.apiUrl || this.defaultConfig.baseUrl;
  }
}
```

#### 4.2.3 阿里百炼Provider实现

```typescript
// services/ai/providers/AliyunProvider.ts

/**
 * 阿里百炼Provider
 * 支持：文本生成、图像生成
 *
 * API文档参考：
 * - https://help.aliyun.com/zh/model-studio/developer-reference/api-details-of-llama-llm
 *
 * 特点：
 * 1. OpenAI兼容API格式
 * 2. 支持通义千问系列模型
 * 3. 支持多种区域接入点
 */
export class AliyunProvider extends BaseProvider {
  readonly id = 'aliyun';
  readonly name = '阿里百炼';
  readonly supportedTypes = ['llm', 'image'] as const;

  private readonly defaultConfig = {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    timeout: 120000,
    maxRetries: 3,
  };

  /**
   * 文本生成
   *
   * 阿里百炼API特点：
   * 1. OpenAI兼容格式
   * 2. 支持流式输出
   * 3. 支持JSON模式
   * 4. 支持工具调用
   */
  async generateText(
    prompt: string,
    config: ModelConfig,
    options: TextGenerationOptions
  ): Promise<TextGenerationResult> {
    const apiKey = this.getApiKey(config);

    const requestBody: any = {
      model: config.modelId,
      messages: [
        ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 4000,
      stream: false,
    };

    // 添加可选参数
    if (options.topP !== undefined) requestBody.top_p = options.topP;
    if (options.presencePenalty !== undefined)
      requestBody.presence_penalty = options.presencePenalty;
    if (options.frequencyPenalty !== undefined)
      requestBody.frequency_penalty = options.frequencyPenalty;

    // JSON模式
    if (options.jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await this.makeRequest(
      `${this.getBaseUrl(config)}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      },
      this.defaultConfig.timeout
    );

    return this.parseTextResponse(response);
  }

  /**
   * 验证API密钥
   */
  async validateApiKey(config: ModelConfig): Promise<ApiValidationResult> {
    try {
      const apiKey = this.getApiKey(config);

      // 调用模型列表接口验证
      const response = await this.makeRequest(
        `${this.getBaseUrl(config)}/models`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
        10000
      );

      if (response.status === 200) {
        return { valid: true };
      } else if (response.status === 401) {
        return { valid: false, error: 'API密钥无效' };
      } else {
        return { valid: false, error: `验证失败: ${response.status}` };
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  private getBaseUrl(config: ModelConfig): string {
    return config.apiUrl || this.defaultConfig.baseUrl;
  }
}
```

### 4.3 监控层设计

#### 4.3.1 健康检查系统

```typescript
// services/ai/core/HealthChecker.ts

/**
 * 模型健康检查器
 *
 * 检查项：
 * 1. API密钥有效性
 * 2. 网络连通性
 * 3. 服务可用性
 * 4. 限流状态
 */
export class ModelHealthChecker {
  private cache = new Map<string, HealthCheckResult>();
  private cacheExpiry = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 执行健康检查
   */
  async check(modelConfig: ModelConfig): Promise<HealthCheckResult> {
    const cacheKey = modelConfig.id;
    const cached = this.cache.get(cacheKey);

    // 检查缓存
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached;
    }

    // 执行检查
    const result = await this.performCheck(modelConfig);

    // 更新缓存
    this.cache.set(cacheKey, result);

    return result;
  }

  private async performCheck(config: ModelConfig): Promise<HealthCheckResult> {
    const provider = providerRouter.getProvider(config.provider);
    const checks: HealthChecks = {
      apiKey: { status: 'unknown' },
      connectivity: { status: 'unknown' },
      service: { status: 'unknown' },
    };

    // 1. 检查API密钥
    try {
      const validation = await provider.validateApiKey(config);
      checks.apiKey = {
        status: validation.valid ? 'pass' : 'fail',
        message: validation.error,
      };
    } catch (error) {
      checks.apiKey = {
        status: 'fail',
        message: error.message,
      };
    }

    // 2. 检查连通性
    try {
      const startTime = Date.now();
      await this.checkConnectivity(config);
      checks.connectivity = {
        status: 'pass',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      checks.connectivity = {
        status: 'fail',
        message: error.message,
      };
    }

    // 3. 检查服务可用性
    if (checks.apiKey.status === 'pass' && checks.connectivity.status === 'pass') {
      checks.service = { status: 'pass' };
    } else {
      checks.service = { status: 'fail' };
    }

    // 计算整体状态
    const overallStatus = this.calculateOverallStatus(checks);

    return {
      modelId: config.id,
      status: overallStatus,
      checks,
      timestamp: Date.now(),
    };
  }

  private calculateOverallStatus(checks: HealthChecks): HealthStatus {
    if (checks.apiKey.status === 'fail' || checks.connectivity.status === 'fail') {
      return 'unhealthy';
    }
    if (checks.apiKey.status === 'pass' && checks.connectivity.status === 'pass') {
      return 'healthy';
    }
    return 'degraded';
  }
}

export interface HealthCheckResult {
  modelId: string;
  status: HealthStatus;
  checks: HealthChecks;
  timestamp: number;
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthChecks {
  apiKey: { status: 'pass' | 'fail' | 'unknown'; message?: string };
  connectivity: { status: 'pass' | 'fail' | 'unknown'; latency?: number; message?: string };
  service: { status: 'pass' | 'fail' | 'unknown'; message?: string };
}
```

### 4.4 开发测试专用模块

```typescript
// services/ai/dev/DevModelManager.ts

/**
 * 开发测试模型管理器
 *
 * ⚠️ 重要说明：
 * 1. 魔搭社区模型仅用于开发测试
 * 2. 生产环境不会接入魔搭社区
 * 3. 所有魔搭社区相关代码都应在生产构建时被排除
 */
export class DevModelManager {
  private readonly isDevMode: boolean;

  constructor() {
    this.isDevMode = import.meta.env.DEV || process.env.NODE_ENV === 'development';

    if (!this.isDevMode) {
      console.warn('[DevModelManager] Running in PRODUCTION mode. ModelScope is disabled.');
    }
  }

  /**
   * 检查是否可以使用开发测试模型
   */
  canUseDevModels(): boolean {
    return this.isDevMode;
  }

  /**
   * 获取开发测试专用模型列表
   */
  getDevModels(): ModelConfig[] {
    if (!this.isDevMode) {
      return [];
    }

    return [
      {
        id: 'dev-modelscope-z-image',
        name: '[开发测试] 通义万相 Z-Image',
        provider: 'modelscope',
        modelId: 'Tongyi-MAI/Z-Image',
        type: 'image',
        // ...
      },
      {
        id: 'dev-modelscope-qwen',
        name: '[开发测试] 魔搭通义千问',
        provider: 'modelscope',
        modelId: 'qwen/Qwen2-72B-Instruct',
        type: 'llm',
        // ...
      },
    ];
  }

  /**
   * 标记开发测试模型
   */
  markAsDevModel(model: ModelConfig): ModelConfig {
    return {
      ...model,
      name: `[开发测试] ${model.name}`,
      metadata: {
        ...model.metadata,
        isDevOnly: true,
        devWarning: '此模型仅用于开发测试，生产环境不可用',
      },
    };
  }
}
```

---

## 五、模型清单

### 5.1 商用模型清单

#### 5.1.1 火山方舟 (Volcengine)

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

#### 5.1.2 阿里百炼 (Aliyun)

| 模型ID                | 名称           | 类型 | 状态      | 生产就绪 |
| --------------------- | -------------- | ---- | --------- | -------- |
| aliyun-llm-qwen-max   | 通义千问 Max   | llm  | ✅ active | ✅       |
| aliyun-llm-qwen-plus  | 通义千问 Plus  | llm  | ✅ active | ✅       |
| aliyun-llm-qwen-turbo | 通义千问 Turbo | llm  | ✅ active | ✅       |

#### 5.1.3 OpenAI

| 模型ID                 | 名称        | 类型 | 状态      | 生产就绪 |
| ---------------------- | ----------- | ---- | --------- | -------- |
| openai-llm-gpt-4o      | GPT-4o      | llm  | ✅ active | ✅       |
| openai-llm-gpt-4o-mini | GPT-4o Mini | llm  | ✅ active | ✅       |

#### 5.1.4 Vidu

| 模型ID               | 名称             | 类型  | 状态      | 生产就绪 |
| -------------------- | ---------------- | ----- | --------- | -------- |
| vidu-img-q2          | Vidu Q2          | image | ✅ active | ✅       |
| vidu-img-q1          | Vidu Q1          | image | ✅ active | ✅       |
| vidu-vid-2.0         | Vidu 2.0         | video | ✅ active | ✅       |
| vidu-vid-q2          | Vidu Q2          | video | ✅ active | ✅       |
| vidu-vid-q2-pro      | Vidu Q2 Pro      | video | ✅ active | ✅       |
| vidu-vid-q2-turbo    | Vidu Q2 Turbo    | video | ✅ active | ✅       |
| vidu-vid-q2-pro-fast | Vidu Q2 Pro Fast | video | ✅ active | ✅       |
| vidu-vid-q1-classic  | Vidu Q1 Classic  | video | ✅ active | ✅       |
| vidu-vid-q1          | Vidu Q1          | video | ✅ active | ✅       |

### 5.2 开发测试专用模型

| 模型ID                 | 名称                        | 类型  | 状态        | 环境限制    |
| ---------------------- | --------------------------- | ----- | ----------- | ----------- |
| dev-modelscope-z-image | [开发测试] 通义万相 Z-Image | image | ⚠️ dev-only | development |
| dev-modelscope-qwen    | [开发测试] 魔搭通义千问     | llm   | ⚠️ dev-only | development |

---

## 六、实施任务清单

### 阶段1: 基础架构重构 (预计1周)

#### 任务1.1: 创建模型模板系统

- [ ] 创建 `config/modelTemplates.ts`
- [ ] 定义 `ModelTemplate` 接口
- [ ] 创建火山方舟模板
- [ ] 创建阿里百炼模板
- [ ] 创建Vidu模板
- [ ] 创建魔搭社区开发测试模板（标记为dev-only）

#### 任务1.2: 重构Provider架构

- [ ] 创建 `services/ai/core/ProviderRouter.ts`
- [ ] 实现环境感知Provider注册
- [ ] 重构 `VolcengineProvider` 符合火山方舟API规范
- [ ] 创建 `AliyunProvider` 符合百炼API规范
- [ ] 实现 `validateApiKey` 方法

#### 任务1.3: 开发测试模型隔离

- [ ] 创建 `services/ai/dev/DevModelManager.ts`
- [ ] 实现开发测试模型标记
- [ ] 添加生产环境禁用逻辑
- [ ] 添加警告日志

### 阶段2: 监控与验证系统 (预计1周)

#### 任务2.1: 健康检查系统

- [ ] 创建 `services/ai/core/HealthChecker.ts`
- [ ] 实现API密钥验证
- [ ] 实现连通性检查
- [ ] 实现服务可用性检查
- [ ] 添加缓存机制

#### 任务2.2: 性能监控系统

- [ ] 创建 `services/ai/core/PerformanceMonitor.ts`
- [ ] 实现延迟统计
- [ ] 实现成功率统计
- [ ] 实现成本追踪

#### 任务2.3: UI集成

- [ ] 在Settings页面添加健康检查按钮
- [ ] 显示模型健康状态
- [ ] 显示性能指标

### 阶段3: 模型配置管理优化 (预计1周)

#### 任务3.1: 配置验证系统

- [ ] 创建配置验证器
- [ ] 验证API密钥格式
- [ ] 验证模型ID有效性
- [ ] 验证参数范围

#### 任务3.2: 模型版本管理

- [ ] 添加模型版本字段
- [ ] 实现弃用标记
- [ ] 实现替换提示

#### 任务3.3: 批量操作

- [ ] 实现批量健康检查
- [ ] 实现批量验证
- [ ] 添加并发控制

### 阶段4: 文档与测试 (预计0.5周)

#### 任务4.1: 文档编写

- [ ] 更新架构文档
- [ ] 编写Provider接入指南
- [ ] 编写模型配置指南

#### 任务4.2: 测试覆盖

- [ ] 单元测试
- [ ] 集成测试
- [ ] 端到端测试

---

## 七、验收标准

### 7.1 功能验收

| 验收项       | 验收标准                                |
| ------------ | --------------------------------------- |
| 火山方舟接入 | 支持图像/视频/文本生成，符合官方API规范 |
| 阿里百炼接入 | 支持文本生成，符合官方API规范           |
| 魔搭社区隔离 | 开发环境可用，生产环境自动禁用          |
| 健康检查     | 能检测API密钥、连通性、服务可用性       |
| 性能监控     | 能统计延迟、成功率、成本                |

### 7.2 代码质量

| 验收项   | 验收标准                |
| -------- | ----------------------- |
| 类型安全 | 无any类型，严格类型检查 |
| 测试覆盖 | 核心功能覆盖率>80%      |
| 文档完整 | 所有公共API有JSDoc注释  |

### 7.3 性能要求

| 验收项   | 验收标准       |
| -------- | -------------- |
| 健康检查 | 单次检查<5秒   |
| 模型切换 | 切换延迟<100ms |
| 内存占用 | 不高于现有水平 |

---

## 八、附录

### 8.1 火山方舟API参考

- 官方文档：https://www.volcengine.com/docs/82379
- API Key管理：https://www.volcengine.com/docs/82379/1541594
- 图像生成：https://www.volcengine.com/docs/82379/1541601
- 文本生成：https://www.volcengine.com/docs/82379/1541596

### 8.2 阿里百炼API参考

- 官方文档：https://help.aliyun.com/zh/model-studio
- 通义千问API：https://help.aliyun.com/zh/model-studio/developer-reference/api-details-of-llama-llm
- API Key管理：https://help.aliyun.com/zh/model-studio/user-guide/create-api-key

### 8.3 环境变量配置

```bash
# 开发环境
NODE_ENV=development
VITE_ENABLE_DEV_MODELS=true

# 生产环境
NODE_ENV=production
VITE_ENABLE_DEV_MODELS=false
```

---

**文档结束**
