# Checklist

## 阶段 1：完善 ModelCapabilityManager

- [x] getModelLimits 函数实现正确
  - [x] 精确匹配返回正确限制
  - [x] Provider + ModelId 组合匹配正确
  - [x] 模糊匹配处理版本号差异
  - [x] 未知模型返回 undefined

- [x] calculateEffectiveMaxTokens 函数实现正确
  - [x] 超出限制时返回 effectiveTokens = maxAllowed
  - [x] 未超出限制时返回 effectiveTokens = requestedTokens
  - [x] wasLimited 标记正确
  - [x] modelFound 标记正确
  - [x] 未知模型时记录警告日志

- [x] validateTokenConfig 函数实现正确
  - [x] 有效配置返回 valid: true
  - [x] 无效配置返回 valid: false 和错误信息
  - [x] 提供有用的建议信息

- [x] MODEL_LIMITS 常量已导出

## 阶段 2：在 LLMProvider 中集成

- [x] calculateEffectiveMaxTokens 已正确导入

- [x] generateText 方法已修改
  - [x] 调用 calculateEffectiveMaxTokens
  - [x] 使用 effectiveMaxTokens 发送请求
  - [x] 限制调整时记录日志

- [x] generateStructured 方法已修改
  - [x] 调用 calculateEffectiveMaxTokens
  - [x] 使用 effectiveMaxTokens 发送请求
  - [x] 限制调整时记录日志

## 阶段 3：移除 scriptParser 硬编码

- [x] callLLM 中的硬编码已移除
  - [x] 删除 if (this.model.includes('doubao-lite'))
  - [x] 简化 maxTokens 获取逻辑

- [x] callStructuredLLM 中的硬编码已移除
  - [x] 删除 if (this.model.includes('doubao-lite'))
  - [x] 简化 maxTokens 获取逻辑

- [x] initializeContextExtractor 中的硬编码已移除
  - [x] 删除 if (this.model.includes('doubao-lite'))
  - [x] 简化 maxTokens 获取逻辑

- [x] 调试日志已清理

## 阶段 4：扩展模型配置表

- [x] 豆包系列变体已添加
- [x] 未来模型占位已添加

## 阶段 5：测试验证

- [x] 单元测试通过
  - [x] getModelLimits 所有场景
  - [x] calculateEffectiveMaxTokens 所有场景
  - [x] validateTokenConfig 所有场景

- [ ] 集成测试通过
  - [ ] 豆包模型剧本解析成功
  - [ ] DeepSeek 模型剧本解析成功
  - [ ] 日志输出正确

- [ ] 回归测试通过
  - [ ] 图像生成功能正常
  - [ ] 视频生成功能正常
  - [ ] 模型配置页面正常

## 生产就绪检查

- [x] 代码审查通过
- [ ] 所有测试通过
- [ ] 文档已更新
- [ ] 回滚方案已验证

---

## 测试指南

### 单元测试（浏览器控制台）

1. 打开浏览器开发者工具 (F12)
2. 切换到 Console 面板
3. 复制粘贴以下代码并回车执行：

```javascript
// 动态导入模块
const module = await import('/src/services/ai/core/ModelCapabilityManager.ts');
const { getModelLimits, calculateEffectiveMaxTokens, validateTokenConfig } = module;

// 测试 1: getModelLimits - 已知模型
const limits1 = getModelLimits('doubao-lite-32k');
console.assert(limits1?.maxTokens === 4096, '豆包 lite 32k 应该限制 4096');

// 测试 2: getModelLimits - 模糊匹配
const limits2 = getModelLimits('doubao-lite-32k-character-250228');
console.assert(limits2?.maxTokens === 4096, '应该匹配到 doubao-lite-32k');

// 测试 3: calculateEffectiveMaxTokens - 超出限制
const result1 = calculateEffectiveMaxTokens('doubao-lite-32k', 5000);
console.assert(result1.effectiveTokens === 4096, '应该限制到 4096');
console.assert(result1.wasLimited === true, '应该标记为受限');

// 测试 4: calculateEffectiveMaxTokens - 未超出限制
const result2 = calculateEffectiveMaxTokens('deepseek-v3', 5000);
console.assert(result2.effectiveTokens === 5000, '应该保持 5000');
console.assert(result2.wasLimited === false, '不应该受限');

// 测试 5: validateTokenConfig - 有效配置
const valid = validateTokenConfig('doubao-lite-32k', 3000);
console.assert(valid.valid === true, '3000 应该有效');

// 测试 6: validateTokenConfig - 无效配置
const invalid = validateTokenConfig('doubao-lite-32k', 6000);
console.assert(invalid.valid === false, '6000 应该无效');

console.log('所有测试完成！');
```

### 集成测试

刷新页面后，在控制台运行：

```javascript
// 测试 LLMProvider 集成
// 1. 检查模型配置
const module = await import('/src/services/ai/core/ModelCapabilityManager.ts');
const { getModelLimits } = module;

// 查看豆包模型限制
const doubaoLimits = getModelLimits('doubao-lite-32k');
console.log('豆包模型限制:', doubaoLimits);

// 查看 DeepSeek 模型限制
const deepseekLimits = getModelLimits('deepseek-v3');
console.log('DeepSeek 模型限制:', deepseekLimits);
```

### 回归测试

- [ ] 测试图像生成功能是否正常
- [ ] 测试视频生成功能是否正常
- [ ] 测试模型配置页面是否正常

---

## 修复记录

### 2026-03-06: 修复 LLMProvider 日志错误

**问题**: LLMProvider.ts 中引用了不存在的属性 `tokenLimit.modelMaxTokens`

**修复**: 将 `tokenLimit.modelMaxTokens` 改为 `tokenLimit.maxAllowed`

**文件**: `services/ai/providers/LLMProvider.ts` (第 77 行和第 225 行)
