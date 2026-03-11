# Tasks

## 阶段 1: 全面审查 Max Tokens 计算逻辑

- [x] Task 1.1: 审查 ModelCapabilityManager
  - [x] SubTask 1.1.1: 检查 MODEL_LIMITS 配置是否正确
  - [x] SubTask 1.1.2: 检查 calculateEffectiveMaxTokens 边界处理
  - [x] SubTask 1.1.3: 添加 max_tokens < 1 的保护逻辑
  - [x] SubTask 1.1.4: 验证所有模型限制值

- [x] Task 1.2: 审查 LLMProvider 集成
  - [x] SubTask 1.2.1: 检查 generateText 中的限制应用
  - [x] SubTask 1.2.2: 检查 generateStructured 中的限制应用
  - [x] SubTask 1.2.3: 检查是否有代码路径绕过限制
  - [x] SubTask 1.2.4: 添加请求前的最终验证

- [x] Task 1.3: 审查 scriptParser 调用
  - [x] SubTask 1.3.1: 检查所有 callLLM 调用点
  - [x] SubTask 1.3.2: 检查所有 callStructuredLLM 调用点
  - [x] SubTask 1.3.3: 确保传递的 maxTokens 经过限制检查

## 阶段 2: 修复 artStyle 类型错误

- [x] Task 2.1: 定位所有 artStyle 使用点
  - [x] SubTask 2.1.1: 搜索所有 .artStyle. 和 .artStyle 使用
  - [x] SubTask 2.1.2: 识别需要修复的位置

- [x] Task 2.2: 实现类型安全函数
  - [x] SubTask 2.2.1: 创建 safeString(value, defaultValue) 工具函数
  - [x] SubTask 2.2.2: 创建 safeLowerCase(value, defaultValue) 工具函数
  - [x] SubTask 2.2.3: 在 utils 或 helpers 文件中实现

- [x] Task 2.3: 应用修复
  - [x] SubTask 2.3.1: 修复 GlobalContextExtractor 中的 artStyle 处理
  - [x] SubTask 2.3.2: 修复 VisualRules.ts 中的 artStyle 使用
  - [x] SubTask 2.3.3: 检查其他可能的类型错误点

## 阶段 3: 控制台警告清理

- [x] Task 3.1: 分析警告来源
  - [x] SubTask 3.1.1: 分类整理控制台警告
  - [x] SubTask 3.1.2: 识别可修复的警告
  - [x] SubTask 3.1.3: 识别需要抑制的警告

- [x] Task 3.2: 修复可修复的警告
  - [x] SubTask 3.2.1: 修复已废弃 API 的使用
  - [x] SubTask 3.2.2: 修复缺失的依赖
  - [x] SubTask 3.2.3: 修复类型不匹配问题

- [x] Task 3.3: 抑制不必要的警告
  - [x] SubTask 3.3.1: 添加必要的 eslint-disable 注释
  - [x] SubTask 3.3.2: 配置合理的日志级别

## 阶段 4: 代码健壮性提升

- [x] Task 4.1: 添加防御性编程
  - [x] SubTask 4.1.1: 为关键函数添加参数验证
  - [x] SubTask 4.1.2: 为对象访问添加空值检查
  - [x] SubTask 4.1.3: 为数组操作添加边界检查

- [x] Task 4.2: 改进错误处理
  - [x] SubTask 4.2.1: 统一错误日志格式
  - [x] SubTask 4.2.2: 添加更有用的错误信息
  - [x] SubTask 4.2.3: 确保错误不会导致系统崩溃

## 阶段 5: 测试验证

- [x] Task 5.1: 单元测试
  - [x] SubTask 5.1.1: 测试 calculateEffectiveMaxTokens 边界条件
  - [x] SubTask 5.1.2: 测试 safeString 和 safeLowerCase 函数
  - [x] SubTask 5.1.3: 测试类型错误处理

- [x] Task 5.2: 集成测试
  - [x] SubTask 5.2.1: 测试豆包模型剧本解析
  - [x] SubTask 5.2.2: 测试 DeepSeek 模型剧本解析
  - [x] SubTask 5.2.3: 验证控制台无错误

- [x] Task 5.3: 回归测试
  - [x] SubTask 5.3.1: 测试图像生成功能
  - [x] SubTask 5.3.2: 测试视频生成功能
  - [x] SubTask 5.3.3: 测试模型配置页面

# Task Dependencies

- Task 2 depends on Task 1.1（需要了解限制逻辑）
- Task 3 可以并行执行
- Task 4 依赖于 Task 1, 2, 3
- Task 5 依赖于所有前置任务

# Implementation Order

推荐顺序: 1 → 2 → 3 → 4 → 5

# Implementation Summary

## 完成的修复

### 1. Max Tokens 计算逻辑修复

- **ModelCapabilityManager.ts**: 添加 `requestedTokens < 1` 保护逻辑
- **ModelCapabilityManager.ts**: 修复 `validateTokenConfig` 边界检查
- **LLMProvider.ts**: 添加 `effectiveMaxTokens` 最终验证（范围 [1, 8192]）
- **LLMProvider.ts**: 统一 `generateStructured` 与 `generateText` 的 maxTokens 计算逻辑

### 2. artStyle 类型错误修复

- **GlobalContextExtractor.ts**: 添加类型检查确保 artStyle 是字符串
- **GlobalContextExtractor.ts**: 修复所有视觉上下文字段的类型处理
- **VisualRules.ts**: 添加类型检查防止 toLowerCase 调用失败
- **utils/typeSafe.ts**: 创建类型安全工具函数库

### 3. 代码健壮性提升

- 添加防御性编程处理 LLM 返回的不确定类型数据
- 统一错误日志格式
- 确保错误不会导致系统崩溃

## 测试验证

- 所有单元测试通过
- 集成测试通过（豆包、DeepSeek 模型）
- 回归测试通过（图像、视频生成）
