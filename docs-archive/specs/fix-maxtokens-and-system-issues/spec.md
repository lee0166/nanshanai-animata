# 系统性修复 Max Tokens 计算及系统问题 Spec

## Why

项目在移除 ChromaDB 后，测试剧本解析时出现大量错误：

1. **max_tokens 超出范围错误** - API 返回 `Range of max_tokens should be [1, 8192]`
2. **visualContext.artStyle 类型错误** - `toLowerCase is not a function`
3. **大量警告信息** - 控制台日志中有大量警告需要清理

这些问题反复出现，说明需要系统性地审查和修复相关代码。

## What Changes

### 修复 1: Max Tokens 计算逻辑

- **问题**: LLMProvider 发送的 max_tokens 超出模型限制
- **原因**:
  - ModelCapabilityManager 中的限制配置可能不正确
  - LLMProvider 可能没有正确应用限制
  - 某些代码路径绕过了限制检查
- **修复**: 全面审查并修复 tokens 计算逻辑

### 修复 2: artStyle 类型错误

- **问题**: `visualContext.artStyle.toLowerCase()` 调用失败
- **原因**: LLM 返回的 artStyle 可能是数组或对象，不是字符串
- **修复**: 添加类型检查和容错处理

### 修复 3: 控制台警告清理

- **问题**: 控制台有大量警告信息
- **修复**: 识别并修复或抑制不必要的警告

### 修复 4: 代码健壮性提升

- **问题**: 多处代码假设数据类型正确，缺乏容错
- **修复**: 添加防御性编程，增强代码健壮性

## Impact

- Affected specs: token-limit-management (需要重新审视)
- Affected code:
  - `services/ai/providers/LLMProvider.ts`
  - `services/ai/core/ModelCapabilityManager.ts`
  - `services/scriptParser.ts`
  - `services/parsing/GlobalContextExtractor.ts`

## ADDED Requirements

### Requirement: Max Tokens 计算正确性

The system SHALL ensure max_tokens parameter never exceeds model limits.

#### Scenario: Normal case

- **GIVEN** 用户配置 maxTokens = 4000
- **WHEN** 调用豆包-lite-32k 模型
- **THEN** 实际发送的 max_tokens ≤ 4096

#### Scenario: Exceeds limit

- **GIVEN** 用户配置 maxTokens = 10000
- **WHEN** 调用豆包-lite-32k 模型
- **THEN** 实际发送的 max_tokens = 4096
- **AND** 记录警告日志

#### Scenario: Below minimum

- **GIVEN** 计算出的 max_tokens < 1
- **WHEN** 发送 API 请求
- **THEN** 使用默认值 1024
- **AND** 记录警告日志

### Requirement: Type Safety for LLM Responses

The system SHALL handle unexpected data types from LLM responses gracefully.

#### Scenario: artStyle is array

- **GIVEN** LLM 返回 artStyle = ["cinematic"]
- **WHEN** 调用 toLowerCase()
- **THEN** 使用默认值 'cinematic'
- **AND** 记录警告日志

#### Scenario: artStyle is object

- **GIVEN** LLM 返回 artStyle = {style: "cinematic"}
- **WHEN** 调用 toLowerCase()
- **THEN** 使用默认值 'cinematic'
- **AND** 记录警告日志

### Requirement: Console Warning Cleanup

The system SHALL minimize unnecessary console warnings.

#### Scenario: Deprecation warnings

- **GIVEN** 使用已废弃的 API
- **WHEN** 代码执行
- **THEN** 迁移到新 API 或添加抑制注释

## MODIFIED Requirements

### Requirement: Token Limit Management (from token-limit-management spec)

**Current**: 已实现基础限制检查

**Modified**:

- 修复边界条件（max_tokens < 1 的情况）
- 确保所有代码路径都经过限制检查
- 添加更详细的日志记录

## REMOVED Requirements

None
