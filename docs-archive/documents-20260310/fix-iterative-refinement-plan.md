# 修复迭代优化引擎未启用问题 - 执行计划

## 问题诊断

基于后端日志分析，发现以下关键问题：

### 日志证据

```
第 74 行: ScriptManager.tsx:489 [ScriptManager] 完整解析模式，ScriptParser配置: {useSemanticChunking: true, useDramaRules: true, dramaRulesMinScore: 60, useCache: true, cacheTTL: 3600000}
```

**问题**: ScriptManager 打印的 parserConfig 中**缺少** `enableIterativeRefinement` 和 `iterativeRefinementConfig` 字段。

### 根本原因

1. 虽然已修改 ScriptManager.tsx 添加配置，但浏览器可能缓存了旧代码
2. Vite 热更新可能没有正确重新编译修改的文件
3. 需要强制清除缓存并重启服务器

---

## 修复步骤

### 步骤 1: 验证修改是否正确保存

- 读取 ScriptManager.tsx 第 386-408 行
- 确认 `enableIterativeRefinement: true` 已正确添加

### 步骤 2: 强制清除所有缓存

- 删除 `node_modules/.vite` 目录
- 删除浏览器缓存（LocalStorage、IndexedDB）
- 重启开发服务器

### 步骤 3: 添加调试日志

- 在 ScriptManager.tsx 第 408 行后添加日志，打印完整的 parserConfig
- 确保能看到 `enableIterativeRefinement` 的值

### 步骤 4: 验证修复

- 重新上传测试小说
- 查看控制台日志，确认：
  - `[ScriptParser] Initialized with config` 包含 `enableIterativeRefinement: true`
  - `[ScriptParser] IterativeRefinementEngine initialized` 出现
  - `[ScriptParser] Starting iterative refinement...` 出现

---

## 验证清单

修复成功后，控制台应显示：

- [ ] `ScriptManager` 打印的 config 包含 `enableIterativeRefinement: true`
- [ ] `ScriptParser` 打印的 config 包含 `enableIterativeRefinement: true`
- [ ] `[ScriptParser] IterativeRefinementEngine initialized`
- [ ] `[ScriptParser] Starting iterative refinement...`
- [ ] `[IterativeRefinementEngine] Starting refinement process...`
- [ ] `[IterativeRefinementEngine] Found X violations`
- [ ] `[IterativeRefinementEngine] Quality score: XX`

---

## 如果仍失败

如果上述步骤后问题仍然存在，可能原因：

1. 修改保存到了错误的文件位置
2. 有其他地方覆盖了配置
3. TypeScript 编译错误导致修改未生效

需要进一步检查：

- ScriptManager.tsx 的实际内容
- 是否存在多个 ScriptManager.tsx 文件
- TypeScript 编译是否有错误
