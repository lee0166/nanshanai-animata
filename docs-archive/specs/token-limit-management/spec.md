# Token 限制管理系统 Spec

## Why

当前项目中 LLM 调用的 max_tokens 参数存在以下问题：

1. **硬编码限制** - scriptParser.ts 中硬编码了 `if (this.model.includes('doubao-lite'))` 判断
2. **配置与实现脱节** - ModelCapabilityManager 定义了模型限制但未被使用
3. **缺乏统一管理** - 各模块自行处理 token 限制，难以维护
4. **未来扩展性差** - 无法自动适配 256K+ tokens 的新模型

这导致：

- 豆包-lite-32k 等模型实际只支持 4096 tokens，但请求发送了 5000/6000，导致 API 报错
- 新增模型需要修改多处代码
- 用户无法了解模型的真实限制

## What Changes

### 1. 完善 ModelCapabilityManager

在 `services/ai/core/ModelCapabilityManager.ts` 中：

- **添加查询函数** `getModelLimits(modelId, provider?)` - 获取模型限制
- **添加计算函数** `calculateEffectiveMaxTokens(modelId, requestedTokens, provider?)` - 计算实际有效的 tokens
- **添加验证函数** `validateTokenConfig(modelId, requestedTokens, provider?)` - 验证配置是否有效
- **导出常量** `MODEL_LIMITS` - 供外部使用

### 2. 在 LLMProvider 中集成

在 `services/ai/providers/LLMProvider.ts` 中：

- **导入** `calculateEffectiveMaxTokens` 函数
- **修改 generateText** - 调用前自动计算 effectiveMaxTokens
- **修改 generateStructured** - 同样应用 token 限制
- **添加日志** - 记录 token 限制调整情况

### 3. 移除 scriptParser 硬编码

在 `services/scriptParser.ts` 中：

- **移除硬编码判断** - 删除 `if (this.model.includes('doubao-lite'))`
- **简化代码** - 直接使用 taskConfig.maxTokens，由 LLMProvider 处理限制

### 4. 扩展模型配置表

在 `services/ai/core/ModelCapabilityManager.ts` 中：

- **添加更多模型** - 补充豆包系列变体
- **预留未来模型** - 添加 256K+ tokens 模型占位

## Impact

### 受影响的文件

- `services/ai/core/ModelCapabilityManager.ts` - 添加核心函数
- `services/ai/providers/LLMProvider.ts` - 集成 token 限制
- `services/scriptParser.ts` - 移除硬编码

### 向后兼容性

- ✅ 现有功能不受影响
- ✅ 未知模型使用请求的 tokens（带警告日志）
- ✅ 所有修改都是新增或简化，不破坏现有逻辑

## ADDED Requirements

### Requirement: 统一 Token 限制查询

The system SHALL provide a unified way to query model token limits.

#### Scenario: 查询已知模型限制

- **GIVEN** 模型 ID 为 "doubao-lite-32k"
- **WHEN** 调用 `getModelLimits("doubao-lite-32k")`
- **THEN** 返回 `{ maxTokens: 4096, maxInputTokens: 32768 }`

#### Scenario: 查询未知模型

- **GIVEN** 模型 ID 为 "unknown-model"
- **WHEN** 调用 `getModelLimits("unknown-model")`
- **THEN** 返回 `undefined`
- **AND** 记录警告日志

#### Scenario: 模糊匹配模型

- **GIVEN** 模型 ID 为 "doubao-lite-32k-character-250228"
- **WHEN** 调用 `getModelLimits("doubao-lite-32k-character-250228")`
- **THEN** 匹配到 "doubao-lite-32k" 的限制
- **AND** 返回 `{ maxTokens: 4096, maxInputTokens: 32768 }`

### Requirement: 自动计算 Effective Max Tokens

The system SHALL automatically calculate effective max tokens based on model limits.

#### Scenario: 请求超出限制

- **GIVEN** 模型 "doubao-lite-32k" 最大支持 4096 tokens
- **AND** 请求 5000 tokens
- **WHEN** 调用 `calculateEffectiveMaxTokens("doubao-lite-32k", 5000)`
- **THEN** 返回 `{ effectiveTokens: 4096, wasLimited: true, maxAllowed: 4096 }`
- **AND** 记录警告日志

#### Scenario: 请求未超出限制

- **GIVEN** 模型 "deepseek-v3" 最大支持 8192 tokens
- **AND** 请求 5000 tokens
- **WHEN** 调用 `calculateEffectiveMaxTokens("deepseek-v3", 5000)`
- **THEN** 返回 `{ effectiveTokens: 5000, wasLimited: false, maxAllowed: 8192 }`

### Requirement: LLM 调用自动应用限制

The system SHALL automatically apply token limits in LLMProvider.

#### Scenario: 豆包模型调用

- **GIVEN** 配置使用 "doubao-lite-32k" 模型
- **AND** maxTokens 设置为 5000
- **WHEN** 调用 `llmProvider.generateText()`
- **THEN** 实际发送的 max_tokens 为 4096
- **AND** 记录限制调整日志

#### Scenario: DeepSeek 模型调用

- **GIVEN** 配置使用 "deepseek-v3" 模型
- **AND** maxTokens 设置为 5000
- **WHEN** 调用 `llmProvider.generateText()`
- **THEN** 实际发送的 max_tokens 为 5000（未超出限制）

### Requirement: 验证 Token 配置

The system SHALL validate token configuration before use.

#### Scenario: 配置超出限制

- **GIVEN** 模型 "doubao-lite-32k" 最大支持 4096 tokens
- **AND** 用户配置 maxTokens 为 6000
- **WHEN** 调用 `validateTokenConfig("doubao-lite-32k", 6000)`
- **THEN** 返回 `{ valid: false, error: "...", suggestion: "..." }`

#### Scenario: 配置有效

- **GIVEN** 模型 "doubao-lite-32k" 最大支持 4096 tokens
- **AND** 用户配置 maxTokens 为 3000
- **WHEN** 调用 `validateTokenConfig("doubao-lite-32k", 3000)`
- **THEN** 返回 `{ valid: true }`

## Technical Notes

### 数据流

```
业务代码请求 → LLMProvider → calculateEffectiveMaxTokens → API 调用
                     ↑
            ModelCapabilityManager (MODEL_LIMITS)
```

### 模型限制表结构

```typescript
interface ModelLimits {
  provider: string; // 服务商
  modelId: string; // 模型ID
  maxTokens: number; // 最大输出 tokens
  maxInputTokens: number; // 最大输入 tokens
  description?: string; // 描述（可选）
}
```

### 匹配策略

1. **精确匹配** - modelId 完全匹配
2. **Provider + ModelId** - 组合匹配
3. **模糊匹配** - 处理版本号差异（如 character-250228）

### 日志规范

```
[ModelCapabilityManager] Unknown model: {modelId}, using requested tokens: {tokens}
[LLMProvider] Token limit applied for {modelId}: {effective}/{requested} (model max: {max})
```

### 默认值策略

- 未知模型：使用请求的 tokens（带警告）
- 已知模型：使用 min(请求值, 模型最大值)

## Implementation Strategy

1. **阶段 1** - 完善 ModelCapabilityManager（基础，低风险）
2. **阶段 2** - 在 LLMProvider 中集成（核心，中风险）
3. **阶段 3** - 移除 scriptParser 硬编码（清理，低风险）
4. **阶段 4** - 扩展模型配置表（扩展，低风险）
5. **阶段 5** - 添加配置验证（优化，可选）
