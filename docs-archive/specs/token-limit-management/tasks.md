# Tasks

## 阶段 1：完善 ModelCapabilityManager（基础）

- [x] Task 1.1: 添加 getModelLimits 函数
  - [x] SubTask 1.1.1: 实现精确匹配逻辑
  - [x] SubTask 1.1.2: 实现 Provider + ModelId 组合匹配
  - [x] SubTask 1.1.3: 实现模糊匹配（处理版本号差异）
  - [x] SubTask 1.1.4: 添加 JSDoc 注释

- [x] Task 1.2: 添加 calculateEffectiveMaxTokens 函数
  - [x] SubTask 1.2.1: 实现限制计算逻辑
  - [x] SubTask 1.2.2: 添加 wasLimited 标记
  - [x] SubTask 1.2.3: 添加 modelFound 标记
  - [x] SubTask 1.2.4: 添加警告日志

- [x] Task 1.3: 添加 validateTokenConfig 函数
  - [x] SubTask 1.3.1: 实现验证逻辑
  - [x] SubTask 1.3.2: 添加错误信息
  - [x] SubTask 1.3.3: 添加建议信息

- [x] Task 1.4: 导出 MODEL_LIMITS 常量
  - [x] SubTask 1.4.1: 添加 export 语句

## 阶段 2：在 LLMProvider 中集成（核心）

- [x] Task 2.1: 导入 calculateEffectiveMaxTokens
  - [x] SubTask 2.1.1: 在 LLMProvider.ts 顶部添加 import

- [x] Task 2.2: 修改 generateText 方法
  - [x] SubTask 2.2.1: 获取原始 maxTokens
  - [x] SubTask 2.2.2: 调用 calculateEffectiveMaxTokens
  - [x] SubTask 2.2.3: 使用 effectiveMaxTokens 发送请求
  - [x] SubTask 2.2.4: 添加限制调整日志

- [x] Task 2.3: 修改 generateStructured 方法
  - [x] SubTask 2.3.1: 获取原始 maxTokens
  - [x] SubTask 2.3.2: 调用 calculateEffectiveMaxTokens
  - [x] SubTask 2.3.3: 使用 effectiveMaxTokens 发送请求
  - [x] SubTask 2.3.4: 添加限制调整日志

## 阶段 3：移除 scriptParser 硬编码（清理）

- [x] Task 3.1: 移除 callLLM 中的硬编码
  - [x] SubTask 3.1.1: 删除 if (this.model.includes('doubao-lite')) 判断
  - [x] SubTask 3.1.2: 简化 maxTokens 获取逻辑

- [x] Task 3.2: 移除 callStructuredLLM 中的硬编码
  - [x] SubTask 3.2.1: 删除 if (this.model.includes('doubao-lite')) 判断
  - [x] SubTask 3.2.2: 简化 maxTokens 获取逻辑

- [x] Task 3.3: 移除 initializeContextExtractor 中的硬编码
  - [x] SubTask 3.3.1: 删除 if (this.model.includes('doubao-lite')) 判断
  - [x] SubTask 3.3.2: 简化 maxTokens 获取逻辑

- [x] Task 3.4: 清理调试日志
  - [x] SubTask 3.4.1: 移除冗余的 console.log

## 阶段 4：扩展模型配置表（扩展）

- [x] Task 4.1: 添加豆包系列变体
  - [x] SubTask 4.1.1: 添加 doubao-lite-4k-240515
  - [x] SubTask 4.1.2: 添加 doubao-lite-32k-240515
  - [x] SubTask 4.1.3: 添加 doubao-pro 系列变体

- [x] Task 4.2: 预留未来模型
  - [x] SubTask 4.2.1: 添加 256K+ tokens 模型占位
  - [x] SubTask 4.2.2: 添加注释说明

## 阶段 5：测试验证

- [x] Task 5.1: 单元测试
  - [x] SubTask 5.1.1: 测试 getModelLimits - 已知模型
  - [x] SubTask 5.1.2: 测试 getModelLimits - 未知模型
  - [x] SubTask 5.1.3: 测试 getModelLimits - 模糊匹配
  - [x] SubTask 5.1.4: 测试 calculateEffectiveMaxTokens - 超出限制
  - [x] SubTask 5.1.5: 测试 calculateEffectiveMaxTokens - 未超出限制
  - [x] SubTask 5.1.6: 测试 validateTokenConfig - 有效配置
  - [x] SubTask 5.1.7: 测试 validateTokenConfig - 无效配置

- [ ] Task 5.2: 集成测试
  - [ ] SubTask 5.2.1: 测试豆包模型剧本解析
  - [ ] SubTask 5.2.2: 测试 DeepSeek 模型剧本解析
  - [ ] SubTask 5.2.3: 测试未知模型默认行为
  - [ ] SubTask 5.2.4: 验证日志输出

- [ ] Task 5.3: 回归测试
  - [ ] SubTask 5.3.1: 测试图像生成不受影响
  - [ ] SubTask 5.3.2: 测试视频生成不受影响
  - [ ] SubTask 5.3.3: 测试模型配置页面正常

# Task Dependencies

- Task 2 depends on Task 1（需要 calculateEffectiveMaxTokens 函数）
- Task 3 depends on Task 2（需要 LLMProvider 先集成）
- Task 4 is independent（可以并行）
- Task 5 depends on Task 2, Task 3（需要核心功能完成）

# Implementation Order

推荐顺序：1 → 2 → 3 → 5（Task 4 可并行）

---

# 测试执行指南

## 浏览器控制台单元测试

在浏览器控制台执行以下代码：

```javascript
(async () => {
  const { getModelLimits, calculateEffectiveMaxTokens, validateTokenConfig } =
    await import('/src/services/ai/core/ModelCapabilityManager.ts');

  console.log('=== Token 限制管理系统测试 ===\n');

  // 测试 1
  const l1 = getModelLimits('doubao-lite-32k');
  console.log('1. getModelLimits("doubao-lite-32k"):', l1);
  console.assert(l1?.maxTokens === 4096, '✗ Test 1 failed');

  // 测试 2
  const l2 = getModelLimits('doubao-lite-32k-character-250228');
  console.log('2. getModelLimits("doubao-lite-32k-character-250228"):', l2);
  console.assert(l2?.maxTokens === 4096, '✗ Test 2 failed');

  // 测试 3
  const r1 = calculateEffectiveMaxTokens('doubao-lite-32k', 5000);
  console.log('3. calculateEffectiveMaxTokens("doubao-lite-32k", 5000):', r1);
  console.assert(r1.effectiveTokens === 4096 && r1.wasLimited, '✗ Test 3 failed');

  // 测试 4
  const r2 = calculateEffectiveMaxTokens('deepseek-v3', 5000);
  console.log('4. calculateEffectiveMaxTokens("deepseek-v3", 5000):', r2);
  console.assert(r2.effectiveTokens === 5000 && !r2.wasLimited, '✗ Test 4 failed');

  // 测试 5
  const v1 = validateTokenConfig('doubao-lite-32k', 3000);
  console.log('5. validateTokenConfig("doubao-lite-32k", 3000):', v1);
  console.assert(v1.valid === true, '✗ Test 5 failed');

  // 测试 6
  const v2 = validateTokenConfig('doubao-lite-32k', 6000);
  console.log('6. validateTokenConfig("doubao-lite-32k", 6000):', v2);
  console.assert(v2.valid === false, '✗ Test 6 failed');

  console.log('\n=== 测试完成 ===');
})();
```

## 修复记录

### 2026-03-06

**问题**: LLMProvider.ts 第 77 行和第 225 行引用了不存在的属性 `tokenLimit.modelMaxTokens`

**修复**: 将 `tokenLimit.modelMaxTokens` 改为 `tokenLimit.maxAllowed`

**状态**: ✅ 已修复
