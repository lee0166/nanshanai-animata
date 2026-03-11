# 生产级模型配置系统性解决方案

## 问题背景

当前项目面临的核心问题：

1. **模型限制不统一** - 不同模型有不同的 max_tokens 限制（4096/8192/128K等）
2. **配置与实现脱节** - `ModelCapabilityManager` 定义了限制但未被使用
3. **硬编码问题** - 临时修复方案硬编码了 4096，不够灵活
4. **未来扩展性** - 需要支持 256K+ tokens 的新模型

## 行业最佳实践

根据 LLM 应用开发生产实践：

1. **分层配置架构**
   - 模型层：定义模型固有能力（max_tokens, context_window）
   - 任务层：定义任务需求（所需 tokens）
   - 运行时层：动态计算实际使用的 tokens

2. **动态限制计算**
   - 实际 max_tokens = min(任务需求, 模型最大能力)
   - 避免硬编码，根据模型自动适配

3. **配置验证机制**
   - 配置时验证（用户添加模型时）
   - 运行时验证（调用 API 前）
   - 错误时给出清晰的提示

## 系统性解决方案

### 方案架构

```
┌─────────────────────────────────────────────────────────────┐
│                     配置层 (Configuration)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Model Limits │  │ Task Config  │  │ User Config  │      │
│  │  (模型限制)   │  │  (任务配置)   │  │  (用户配置)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     计算层 (Calculation)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  TokenLimitCalculator                               │   │
│  │  - getEffectiveMaxTokens(modelId, taskType)         │   │
│  │  - validateConfig(modelId, requestedTokens)         │   │
│  │  - getModelLimits(modelId)                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     应用层 (Application)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ScriptParser │  │   LLMProvider│  │ 其他服务    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 核心设计原则

1. **单一职责**
   - `ModelCapabilityManager`: 管理模型固有能力
   - `TokenLimitCalculator`: 计算实际 token 限制
   - `ConfigValidator`: 验证配置有效性

2. **开闭原则**
   - 新增模型只需更新配置表
   - 无需修改业务代码

3. **防御式编程**
   - 所有 LLM 调用前自动验证
   - 超出限制时自动调整并记录警告

### 具体实现步骤

#### 步骤1: 完善 ModelCapabilityManager

```typescript
// services/ai/core/ModelCapabilityManager.ts

export interface ModelLimits {
  provider: string;
  modelId: string;
  maxOutputTokens: number; // 最大输出 tokens
  maxInputTokens: number; // 最大输入 tokens
  maxTotalTokens: number; // 最大总 tokens (input + output)
}

// 完整的模型限制表
const MODEL_LIMITS: ModelLimits[] = [
  // 豆包系列
  {
    provider: 'volcengine',
    modelId: 'doubao-lite-4k',
    maxOutputTokens: 4096,
    maxInputTokens: 4096,
    maxTotalTokens: 4096,
  },
  {
    provider: 'volcengine',
    modelId: 'doubao-lite-32k',
    maxOutputTokens: 4096,
    maxInputTokens: 32768,
    maxTotalTokens: 32768,
  },
  {
    provider: 'volcengine',
    modelId: 'doubao-lite-32k-character-250228',
    maxOutputTokens: 4096,
    maxInputTokens: 32768,
    maxTotalTokens: 32768,
  },
  {
    provider: 'volcengine',
    modelId: 'doubao-lite-128k',
    maxOutputTokens: 4096,
    maxInputTokens: 131072,
    maxTotalTokens: 131072,
  },
  {
    provider: 'volcengine',
    modelId: 'doubao-pro-4k',
    maxOutputTokens: 4096,
    maxInputTokens: 4096,
    maxTotalTokens: 4096,
  },
  {
    provider: 'volcengine',
    modelId: 'doubao-pro-32k',
    maxOutputTokens: 4096,
    maxInputTokens: 32768,
    maxTotalTokens: 32768,
  },
  {
    provider: 'volcengine',
    modelId: 'doubao-pro-128k',
    maxOutputTokens: 4096,
    maxInputTokens: 131072,
    maxTotalTokens: 131072,
  },

  // DeepSeek 系列
  {
    provider: 'volcengine',
    modelId: 'deepseek-v3',
    maxOutputTokens: 8192,
    maxInputTokens: 65536,
    maxTotalTokens: 65536,
  },
  {
    provider: 'volcengine',
    modelId: 'deepseek-r1',
    maxOutputTokens: 8192,
    maxInputTokens: 65536,
    maxTotalTokens: 65536,
  },

  // OpenAI 系列
  {
    provider: 'openai',
    modelId: 'gpt-4o',
    maxOutputTokens: 4096,
    maxInputTokens: 128000,
    maxTotalTokens: 128000,
  },
  {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    maxOutputTokens: 16384,
    maxInputTokens: 128000,
    maxTotalTokens: 128000,
  },
  {
    provider: 'openai',
    modelId: 'gpt-4-turbo',
    maxOutputTokens: 4096,
    maxInputTokens: 128000,
    maxTotalTokens: 128000,
  },
  {
    provider: 'openai',
    modelId: 'gpt-3.5-turbo',
    maxOutputTokens: 4096,
    maxInputTokens: 16385,
    maxTotalTokens: 16385,
  },

  // Anthropic Claude 系列
  {
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet',
    maxOutputTokens: 8192,
    maxInputTokens: 200000,
    maxTotalTokens: 200000,
  },
  {
    provider: 'anthropic',
    modelId: 'claude-3-opus',
    maxOutputTokens: 4096,
    maxInputTokens: 200000,
    maxTotalTokens: 200000,
  },

  // 阿里云百炼
  {
    provider: 'aliyun',
    modelId: 'qwen-vl-max',
    maxOutputTokens: 4096,
    maxInputTokens: 32768,
    maxTotalTokens: 32768,
  },
  {
    provider: 'aliyun',
    modelId: 'qwen-turbo',
    maxOutputTokens: 4096,
    maxInputTokens: 8192,
    maxTotalTokens: 8192,
  },
  {
    provider: 'aliyun',
    modelId: 'qwen-plus',
    maxOutputTokens: 4096,
    maxInputTokens: 32768,
    maxTotalTokens: 32768,
  },
  {
    provider: 'aliyun',
    modelId: 'qwen-max',
    maxOutputTokens: 4096,
    maxInputTokens: 32768,
    maxTotalTokens: 32768,
  },

  // 未来支持 256K+ 的模型
  {
    provider: 'openai',
    modelId: 'gpt-4o-256k',
    maxOutputTokens: 16384,
    maxInputTokens: 256000,
    maxTotalTokens: 256000,
  },
  {
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-256k',
    maxOutputTokens: 8192,
    maxInputTokens: 256000,
    maxTotalTokens: 256000,
  },
];

/**
 * 获取模型的限制参数
 */
export function getModelLimits(modelId: string, provider?: string): ModelLimits | undefined {
  // 1. 精确匹配
  let limit = MODEL_LIMITS.find(l => l.modelId === modelId);

  // 2. 如果提供了 provider，进行 provider + modelId 匹配
  if (!limit && provider) {
    limit = MODEL_LIMITS.find(l => l.provider === provider && l.modelId === modelId);
  }

  // 3. 模糊匹配（处理版本号差异，如 doubao-lite-32k-character-250228）
  if (!limit) {
    limit = MODEL_LIMITS.find(l => {
      // 检查 modelId 是否包含基础型号
      const baseModelId = l.modelId.split('-').slice(0, 3).join('-'); // doubao-lite-32k
      return modelId.includes(baseModelId) || baseModelId.includes(modelId);
    });
  }

  return limit;
}

/**
 * 计算实际有效的 maxTokens
 * @param modelId 模型ID
 * @param requestedTokens 请求的 tokens 数
 * @param provider Provider ID（可选）
 * @returns 实际有效的 tokens 数
 */
export function calculateEffectiveMaxTokens(
  modelId: string,
  requestedTokens: number,
  provider?: string
): { effectiveTokens: number; wasLimited: boolean; maxAllowed: number } {
  const limits = getModelLimits(modelId, provider);

  if (!limits) {
    // 未知模型，使用请求的 tokens，但记录警告
    console.warn(
      `[ModelCapabilityManager] Unknown model: ${modelId}, using requested tokens: ${requestedTokens}`
    );
    return { effectiveTokens: requestedTokens, wasLimited: false, maxAllowed: requestedTokens };
  }

  const effectiveTokens = Math.min(requestedTokens, limits.maxOutputTokens);
  return {
    effectiveTokens,
    wasLimited: effectiveTokens < requestedTokens,
    maxAllowed: limits.maxOutputTokens,
  };
}

/**
 * 验证配置是否有效
 */
export function validateTokenConfig(
  modelId: string,
  requestedTokens: number,
  provider?: string
): { valid: boolean; error?: string; suggestion?: string } {
  const limits = getModelLimits(modelId, provider);

  if (!limits) {
    return {
      valid: false,
      error: `未知模型: ${modelId}`,
      suggestion: '请检查模型ID是否正确，或联系管理员添加该模型的配置',
    };
  }

  if (requestedTokens > limits.maxOutputTokens) {
    return {
      valid: false,
      error: `请求的 tokens (${requestedTokens}) 超过模型最大限制 (${limits.maxOutputTokens})`,
      suggestion: `建议将 maxTokens 设置为 ${limits.maxOutputTokens} 或更小`,
    };
  }

  return { valid: true };
}
```

#### 步骤2: 创建 TokenLimitCalculator 服务

```typescript
// services/ai/core/TokenLimitCalculator.ts

import { getModelLimits, calculateEffectiveMaxTokens } from './ModelCapabilityManager';

export interface TokenCalculationResult {
  effectiveMaxTokens: number;
  wasLimited: boolean;
  originalRequest: number;
  modelMaxAllowed: number;
  warning?: string;
}

/**
 * Token 限制计算器
 * 统一管理所有 LLM 调用的 token 限制计算
 */
export class TokenLimitCalculator {
  /**
   * 计算实际有效的 maxTokens
   * 这是主要的入口方法，所有 LLM 调用前都应该使用此方法
   */
  static calculateMaxTokens(
    modelId: string,
    requestedTokens: number,
    provider?: string,
    context?: string // 调用上下文，用于日志
  ): TokenCalculationResult {
    const result = calculateEffectiveMaxTokens(modelId, requestedTokens, provider);

    if (result.wasLimited) {
      console.warn(
        `[TokenLimitCalculator] Token limit applied for ${context || 'LLM call'}: ` +
          `requested=${requestedTokens}, allowed=${result.maxAllowed}, ` +
          `effective=${result.effectiveTokens}`
      );
    }

    return {
      effectiveMaxTokens: result.effectiveTokens,
      wasLimited: result.wasLimited,
      originalRequest: requestedTokens,
      modelMaxAllowed: result.maxAllowed,
      warning: result.wasLimited
        ? `Token limit applied: ${result.effectiveTokens}/${requestedTokens} (model max: ${result.maxAllowed})`
        : undefined,
    };
  }

  /**
   * 批量计算多个任务的 token 限制
   * 用于剧本解析等复杂场景
   */
  static calculateForTasks(
    modelId: string,
    taskConfigs: Array<{ taskType: string; requestedTokens: number }>,
    provider?: string
  ): Map<string, TokenCalculationResult> {
    const results = new Map<string, TokenCalculationResult>();

    for (const config of taskConfigs) {
      const result = this.calculateMaxTokens(
        modelId,
        config.requestedTokens,
        provider,
        config.taskType
      );
      results.set(config.taskType, result);
    }

    return results;
  }

  /**
   * 获取模型的完整限制信息
   */
  static getModelInfo(modelId: string, provider?: string) {
    return getModelLimits(modelId, provider);
  }
}

// 导出单例
export const tokenLimitCalculator = new TokenLimitCalculator();
```

#### 步骤3: 在 LLMProvider 中集成

```typescript
// services/ai/providers/LLMProvider.ts

import { TokenLimitCalculator } from '../core/TokenLimitCalculator';

// 在 generateText 方法中
async generateText(
  prompt: string,
  config: ModelConfig,
  systemPrompt?: string,
  extraParams?: Record<string, any>
): Promise<LLMResult> {
  // ... 其他代码 ...

  // 计算实际有效的 maxTokens
  const tokenCalc = TokenLimitCalculator.calculateMaxTokens(
    config.modelId,
    maxTokens,
    config.provider,
    'generateText'
  );

  if (tokenCalc.wasLimited) {
    console.warn(`[LLMProvider] ${tokenCalc.warning}`);
  }

  const requestBody = {
    model: config.modelId,
    messages,
    max_tokens: tokenCalc.effectiveMaxTokens, // 使用计算后的值
    temperature,
  };

  // ... 其他代码 ...
}

// 在 generateStructured 方法中同样处理
```

#### 步骤4: 在 scriptParser 中使用

```typescript
// services/scriptParser.ts

import { TokenLimitCalculator } from './ai/core/TokenLimitCalculator';

// 修改 callLLM 方法
private async callLLM(
  prompt: string,
  taskType: TaskType,
  retryCount: number = 0
): Promise<string> {
  const taskConfig = TASK_CONFIG[taskType];

  // 使用 TokenLimitCalculator 计算实际有效的 maxTokens
  const tokenCalc = TokenLimitCalculator.calculateMaxTokens(
    this.model,
    taskConfig.maxTokens,
    'llm', // provider
    `scriptParser.callLLM.${taskType}`
  );

  // 如果 token 被限制，记录警告
  if (tokenCalc.wasLimited) {
    console.warn(`[ScriptParser] ${tokenCalc.warning}`);
  }

  // 使用计算后的 effectiveMaxTokens
  const maxTokens = tokenCalc.effectiveMaxTokens;

  // ... 其他代码 ...
}

// 同样修改 callStructuredLLM 和 initializeContextExtractor
```

#### 步骤5: 添加配置验证（可选但推荐）

```typescript
// 在用户添加/编辑模型配置时验证
import { validateTokenConfig } from './ai/core/ModelCapabilityManager';

function validateModelConfig(modelId: string, maxTokens: number): boolean {
  const validation = validateTokenConfig(modelId, maxTokens);

  if (!validation.valid) {
    // 在 UI 中显示错误提示
    showError(validation.error, validation.suggestion);
    return false;
  }

  return true;
}
```

### 优势对比

| 特性         | 硬编码方案    | 系统性方案            |
| ------------ | ------------- | --------------------- |
| **扩展性**   | ❌ 需修改代码 | ✅ 只需更新配置表     |
| **维护性**   | ❌ 分散在多处 | ✅ 集中管理           |
| **可配置**   | ❌ 固定值     | ✅ 支持任意模型       |
| **错误提示** | ❌ API 报错   | ✅ 提前验证，友好提示 |
| **日志记录** | ❌ 无         | ✅ 自动记录限制调整   |
| **未来模型** | ❌ 不支持     | ✅ 支持 256K+ tokens  |

### 实施建议

1. **第一阶段**（立即实施）
   - 完善 `ModelCapabilityManager`
   - 创建 `TokenLimitCalculator`
   - 在 `LLMProvider` 中集成

2. **第二阶段**（后续优化）
   - 在 `scriptParser` 中使用
   - 添加 UI 配置验证
   - 添加监控和告警

3. **长期维护**
   - 定期更新模型限制表
   - 根据实际使用情况调整
   - 支持用户自定义模型限制

## 总结

这个系统性方案：

- ✅ 解决了当前问题（豆包 4096 限制）
- ✅ 支持未来扩展（256K+ tokens）
- ✅ 生产级设计（验证、日志、错误处理）
- ✅ 零硬编码（纯配置驱动）
- ✅ 向后兼容（不影响现有功能）
