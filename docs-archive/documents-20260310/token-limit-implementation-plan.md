# Token 限制管理系统 - 详细实施计划

## 一、现状分析

### 1.1 当前问题

- `ModelCapabilityManager.ts` 只有类型定义和常量，没有导出函数
- `scriptParser.ts` 中硬编码了 `if (this.model.includes('doubao-lite'))` 判断
- 没有统一的 token 限制计算机制

### 1.2 现有代码结构

```
services/
├── ai/
│   ├── core/
│   │   ├── ModelCapabilityManager.ts    # 只有常量定义，需要完善
│   │   └── ModelConfigManager.ts
│   └── providers/
│       ├── LLMProvider.ts              # 需要集成 token 限制
│       └── BaseProvider.ts
├── scriptParser.ts                      # 需要替换硬编码
└── parsing/
    └── GlobalContextExtractor.ts       # 需要集成 token 限制
```

## 二、实施目标

1. **短期目标**：完善 `ModelCapabilityManager`，提供统一的 token 限制查询和计算
2. **中期目标**：在 `LLMProvider` 中自动应用 token 限制
3. **长期目标**：所有 LLM 调用自动适配模型限制，无需业务代码关心

## 三、详细实施步骤

### 阶段 1：完善 ModelCapabilityManager（第 1 步）

**目标**：将现有的常量定义扩展为完整的服务模块

**文件**：`services/ai/core/ModelCapabilityManager.ts`

**修改内容**：

```typescript
// 1. 扩展现有接口
export interface ModelLimits {
  provider: string;
  modelId: string;
  maxTokens: number; // 最大输出 tokens
  maxInputTokens: number; // 最大输入 tokens
  description?: string; // 模型描述（可选）
}

// 2. 添加查询函数（在文件末尾添加）

/**
 * 获取模型的限制参数
 * @param modelId 模型ID
 * @param provider Provider ID（可选）
 * @returns 模型限制参数，如果找不到返回 undefined
 */
export function getModelLimits(modelId: string, provider?: string): ModelLimits | undefined {
  // 精确匹配
  let limit = MODEL_LIMITS.find(l => l.modelId === modelId);

  // 如果提供了 provider，进行 provider + modelId 匹配
  if (!limit && provider) {
    limit = MODEL_LIMITS.find(l => l.provider === provider && l.modelId === modelId);
  }

  // 模糊匹配（处理版本号差异，如 doubao-lite-32k-character-250228）
  if (!limit) {
    limit = MODEL_LIMITS.find(l => {
      // 提取基础型号（如 doubao-lite-32k）
      const baseModelId = l.modelId.split('-').slice(0, 3).join('-');
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
 * @returns 计算结果
 */
export function calculateEffectiveMaxTokens(
  modelId: string,
  requestedTokens: number,
  provider?: string
): {
  effectiveTokens: number;
  wasLimited: boolean;
  maxAllowed: number;
  modelFound: boolean;
} {
  const limits = getModelLimits(modelId, provider);

  if (!limits) {
    // 未知模型，使用请求的 tokens，但标记为未找到
    console.warn(
      `[ModelCapabilityManager] Unknown model: ${modelId}, using requested tokens: ${requestedTokens}`
    );
    return {
      effectiveTokens: requestedTokens,
      wasLimited: false,
      maxAllowed: requestedTokens,
      modelFound: false,
    };
  }

  const effectiveTokens = Math.min(requestedTokens, limits.maxTokens);
  return {
    effectiveTokens,
    wasLimited: effectiveTokens < requestedTokens,
    maxAllowed: limits.maxTokens,
    modelFound: true,
  };
}

/**
 * 验证 token 配置是否有效
 * @param modelId 模型ID
 * @param requestedTokens 请求的 tokens 数
 * @param provider Provider ID（可选）
 * @returns 验证结果
 */
export function validateTokenConfig(
  modelId: string,
  requestedTokens: number,
  provider?: string
): {
  valid: boolean;
  error?: string;
  suggestion?: string;
  maxAllowed?: number;
} {
  const limits = getModelLimits(modelId, provider);

  if (!limits) {
    return {
      valid: true, // 未知模型允许通过，但会记录警告
      error: `未知模型: ${modelId}`,
      suggestion: '请检查模型ID是否正确，或联系管理员添加该模型的配置',
    };
  }

  if (requestedTokens > limits.maxTokens) {
    return {
      valid: false,
      error: `请求的 tokens (${requestedTokens}) 超过模型最大限制 (${limits.maxTokens})`,
      suggestion: `建议将 maxTokens 设置为 ${limits.maxTokens} 或更小`,
      maxAllowed: limits.maxTokens,
    };
  }

  return { valid: true, maxAllowed: limits.maxTokens };
}

// 3. 导出常量供外部使用
export { MODEL_LIMITS };
```

**验证方式**：

```typescript
// 测试代码
import { getModelLimits, calculateEffectiveMaxTokens } from './ModelCapabilityManager';

// 测试 1：已知模型
const limits = getModelLimits('doubao-lite-32k-character-250228');
console.log(limits); // 应该返回豆包 lite 32k 的限制

// 测试 2：计算 effective tokens
const result = calculateEffectiveMaxTokens('doubao-lite-32k', 5000);
console.log(result); // { effectiveTokens: 4096, wasLimited: true, maxAllowed: 4096, modelFound: true }

// 测试 3：未知模型
const result2 = calculateEffectiveMaxTokens('unknown-model', 5000);
console.log(result2); // { effectiveTokens: 5000, wasLimited: false, maxAllowed: 5000, modelFound: false }
```

### 阶段 2：在 LLMProvider 中集成（第 2 步）

**目标**：在 LLM 调用前自动应用 token 限制

**文件**：`services/ai/providers/LLMProvider.ts`

**修改内容**：

```typescript
// 1. 导入函数
import { calculateEffectiveMaxTokens } from '../core/ModelCapabilityManager';

// 2. 修改 generateText 方法
async generateText(
  prompt: string,
  config: ModelConfig,
  systemPrompt?: string,
  extraParams?: Record<string, any>
): Promise<LLMResult> {
  try {
    // ... 原有代码 ...

    // 获取 maxTokens（原有逻辑）
    const maxTokens = extraParams?.maxTokens ??
      config.parameters?.find(p => p.name === 'maxTokens')?.defaultValue ??
      config.capabilities?.maxTokens ?? 4000;

    // 新增：根据模型限制调整 maxTokens
    const tokenLimit = calculateEffectiveMaxTokens(
      config.modelId,
      maxTokens,
      config.provider
    );

    // 如果 token 被限制，记录日志（仅记录一次，避免重复）
    if (tokenLimit.wasLimited) {
      console.warn(
        `[LLMProvider] Token limit applied for ${config.modelId}: ` +
        `${tokenLimit.effectiveTokens}/${maxTokens} (model max: ${tokenLimit.maxAllowed})`
      );
    }

    // 使用调整后的 effectiveMaxTokens
    const effectiveMaxTokens = tokenLimit.effectiveTokens;

    const requestBody = {
      model: config.modelId,
      messages,
      max_tokens: effectiveMaxTokens,  // 使用调整后的值
      temperature,
    };

    // ... 原有代码 ...
  }
}

// 3. 修改 generateStructured 方法（同样的逻辑）
async generateStructured<T>(
  prompt: string,
  config: ModelConfig,
  schema: z.ZodType<T>,
  schemaDescription: string,
  systemPrompt?: string
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    // ... 原有代码 ...

    // 获取 maxTokens
    const maxTokens = config.parameters?.find(p => p.name === 'maxTokens')?.defaultValue ??
      config.capabilities?.maxTokens ?? 4000;

    // 新增：根据模型限制调整 maxTokens
    const tokenLimit = calculateEffectiveMaxTokens(
      config.modelId,
      maxTokens,
      config.provider
    );

    const effectiveMaxTokens = tokenLimit.effectiveTokens;

    // ... 使用 effectiveMaxTokens ...
  }
}
```

**优势**：

- 业务代码无需关心 token 限制
- 自动适配所有模型
- 集中管理，易于维护

### 阶段 3：移除 scriptParser 中的硬编码（第 3 步）

**目标**：移除硬编码的 `if (this.model.includes('doubao-lite'))` 判断

**文件**：`services/scriptParser.ts`

**修改内容**：

```typescript
// 1. 移除硬编码限制（3 处）

// 修改前：
let maxTokens = taskConfig.maxTokens;
if (this.model.includes('doubao-lite')) {
  maxTokens = Math.min(maxTokens, 4096);
}

// 修改后：
// 直接使用 taskConfig.maxTokens，因为 LLMProvider 会自动处理限制
const maxTokens = taskConfig.maxTokens;

// 2. 简化日志（可选）
// 移除详细的调试日志，只保留关键信息
```

**说明**：

- 由于 `LLMProvider` 已经自动处理 token 限制，`scriptParser` 无需再处理
- 简化代码，减少维护成本

### 阶段 4：更新模型配置（第 4 步）

**目标**：确保模型配置表包含所有支持的模型

**文件**：`services/ai/core/ModelCapabilityManager.ts`

**更新内容**：

```typescript
// 在 MODEL_LIMITS 中添加更多模型（按需添加）
const MODEL_LIMITS: ModelLimits[] = [
  // 现有模型...

  // 添加更多豆包模型变体
  {
    provider: 'volcengine',
    modelId: 'doubao-lite-4k-240515',
    maxTokens: 4096,
    maxInputTokens: 4096,
  },
  {
    provider: 'volcengine',
    modelId: 'doubao-lite-32k-240515',
    maxTokens: 4096,
    maxInputTokens: 32768,
  },

  // 添加未来支持的大模型（预留）
  {
    provider: 'openai',
    modelId: 'gpt-5',
    maxTokens: 32768,
    maxInputTokens: 256000,
    description: 'Future model',
  },
  {
    provider: 'anthropic',
    modelId: 'claude-4',
    maxTokens: 16384,
    maxInputTokens: 256000,
    description: 'Future model',
  },

  // 更多模型...
];
```

### 阶段 5：添加配置验证（第 5 步，可选）

**目标**：在用户添加模型时进行验证

**文件**：`components/Settings/ModelConfigForm.tsx`（或相关组件）

**修改内容**：

```typescript
import { validateTokenConfig } from '../../../services/ai/core/ModelCapabilityManager';

// 在保存模型配置时验证
function handleSaveModel() {
  const validation = validateTokenConfig(modelId, maxTokens, provider);

  if (!validation.valid) {
    // 显示错误提示
    showError(validation.error, validation.suggestion);
    return;
  }

  // 继续保存
  saveModelConfig();
}
```

## 四、实施顺序

### 推荐实施顺序

1. **第 1 步**：完善 `ModelCapabilityManager`（基础）
   - 风险：低
   - 影响：仅添加新函数，不影响现有功能
   - 测试：可以独立测试

2. **第 2 步**：在 `LLMProvider` 中集成（核心）
   - 风险：中
   - 影响：所有 LLM 调用都会经过此逻辑
   - 测试：需要测试各种模型

3. **第 3 步**：移除 `scriptParser` 硬编码（清理）
   - 风险：低
   - 影响：简化代码
   - 测试：验证剧本解析功能正常

4. **第 4 步**：更新模型配置（扩展）
   - 风险：低
   - 影响：仅添加新模型
   - 按需进行

5. **第 5 步**：添加配置验证（优化）
   - 风险：低
   - 影响：用户体验
   - 可选

## 五、测试策略

### 单元测试

```typescript
// tests/ModelCapabilityManager.test.ts
describe('ModelCapabilityManager', () => {
  test('getModelLimits - 已知模型', () => {
    const limits = getModelLimits('doubao-lite-32k');
    expect(limits).toBeDefined();
    expect(limits?.maxTokens).toBe(4096);
  });

  test('getModelLimits - 未知模型', () => {
    const limits = getModelLimits('unknown-model');
    expect(limits).toBeUndefined();
  });

  test('calculateEffectiveMaxTokens - 超出限制', () => {
    const result = calculateEffectiveMaxTokens('doubao-lite-32k', 5000);
    expect(result.effectiveTokens).toBe(4096);
    expect(result.wasLimited).toBe(true);
  });

  test('calculateEffectiveMaxTokens - 未超出限制', () => {
    const result = calculateEffectiveMaxTokens('doubao-lite-32k', 3000);
    expect(result.effectiveTokens).toBe(3000);
    expect(result.wasLimited).toBe(false);
  });
});
```

### 集成测试

1. **测试剧本解析**：使用豆包模型解析小说，验证 token 限制生效
2. **测试模型切换**：切换不同模型，验证自动适配
3. **测试未知模型**：使用未配置的模型，验证默认行为

## 六、回滚方案

如果出现问题，可以：

1. **回滚 LLMProvider 修改**：移除 `calculateEffectiveMaxTokens` 调用
2. **恢复 scriptParser 硬编码**：重新添加 `if (this.model.includes('doubao-lite'))`
3. **保留 ModelCapabilityManager**：新添加的函数不影响现有代码

## 七、监控和日志

### 关键指标

- Token 限制触发次数
- 未知模型调用次数
- 各模型的实际使用 token 数

### 日志规范

```
[LLMProvider] Token limit applied for {modelId}: {effective}/{requested} (model max: {max})
[ModelCapabilityManager] Unknown model: {modelId}, using requested tokens: {tokens}
```

## 八、总结

这个实施计划：

- ✅ 分阶段实施，风险可控
- ✅ 向后兼容，不影响现有功能
- ✅ 集中管理，易于维护
- ✅ 支持未来扩展（256K+ tokens）
- ✅ 生产级设计（验证、日志、错误处理）
