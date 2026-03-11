# 剧本解析性能优化 - 验收检查清单 (v1.0)

> **核心目标**: 将400字文本解析耗时从287秒降至60-90秒
> **验收原则**: 每个Phase完成后必须全部通过才能进入下一阶段

---

## Phase 1: 调用链路优化 - 验收清单

### Task 1: 显式化全局上下文提取调用

- [ ] `ParseOptions`接口已定义，包含`skipGlobalContext`字段
- [ ] `extractMetadata`方法支持`options`参数
- [ ] `ScriptParserConfig`包含`skipGlobalContextForFastPath`配置项
- [ ] 当`skipGlobalContext: true`时，`extractMetadata`不调用`extractGlobalContext`
- [ ] 当`skipGlobalContext: false`时，`extractMetadata`正常调用`extractGlobalContext`
- [ ] 单元测试覆盖两种配置情况
- [ ] 回滚验证通过：设置`skipGlobalContext: false`后行为与优化前一致

### Task 2: Fast Path并行化改造

- [ ] `parseShortScriptOptimized`方法已创建
- [ ] 原有`parseShortScript`方法保留未修改
- [ ] 元数据和全局上下文使用`Promise.all`并行提取
- [ ] 角色和场景使用`Promise.all`并行提取
- [ ] `ScriptParserConfig`包含`useParallelExtraction`配置项
- [ ] 当`useParallelExtraction: true`时，调用`parseShortScriptOptimized`
- [ ] 当`useParallelExtraction: false`时，调用原有`parseShortScript`
- [ ] 集成测试验证并行提取的正确性
- [ ] 400字文本解析耗时 < 120秒（初步目标）
- [ ] API调用次数 <= 4次
- [ ] 回滚验证通过：设置`useParallelExtraction: false`后调用原有方法

### Task 3: 全局上下文提取内部并行化

- [ ] `GlobalContextExtractorConfig`包含`extractEmotionalArc`配置项
- [ ] `GlobalContextExtractor.extract`方法支持跳过情绪曲线提取
- [ ] `ScriptParserConfig`包含`extractEmotionalArc`配置项
- [ ] 当`extractEmotionalArc: false`时，跳过情绪曲线提取
- [ ] 当`extractEmotionalArc: true`时，正常提取情绪曲线
- [ ] 单元测试覆盖两种配置情况
- [ ] 回滚验证通过：设置`extractEmotionalArc: true`后行为与优化前一致

### Phase 1 整体验收

- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] 400字文本解析耗时 < 120秒
- [ ] API调用次数 <= 4次
- [ ] 可通过配置回退到原有行为
- [ ] 代码审查通过（无竞态条件、无内存泄漏）

---

## Phase 2: 输出优化 - 验收清单

### Task 4: 动态分镜数量调整

- [ ] `getShotCountByTextLength`方法已实现
- [ ] <500字文本返回"1-2个"分镜
- [ ] 500-1500字文本返回"2-3个"分镜
- [ ] > 1500字文本返回"3-5个"分镜
- [ ] `PROMPTS.shotsBatch`使用`{{shotCount}}`模板变量
- [ ] `generateAllShotsWithContext`方法替换模板变量
- [ ] `ScriptParserConfig`包含`useDynamicShotCount`配置项
- [ ] `ScriptParserConfig`包含`shotCountOverrides`配置项
- [ ] 当`useDynamicShotCount: true`时，使用动态分镜数
- [ ] 当`useDynamicShotCount: false`时，使用固定分镜数
- [ ] 单元测试覆盖不同文本长度和配置情况
- [ ] 400字文本分镜数 <= 4个
- [ ] 回滚验证通过：设置`useDynamicShotCount: false`后使用固定分镜数

### Task 5: 短文本跳过情绪曲线

- [ ] `GlobalContextExtractorConfig`包含`textLengthThreshold`配置项（默认800）
- [ ] <800字文本自动跳过情绪曲线提取
- [ ] > =800字文本正常提取情绪曲线
- [ ] `QualityReport`类型包含情绪曲线状态字段
- [ ] 质量报告中标注情绪曲线是否提取
- [ ] `ScriptParserConfig`包含`textLengthThreshold`配置项
- [ ] 单元测试覆盖不同文本长度
- [ ] 回滚验证通过：设置`textLengthThreshold: 0`后所有文本都提取情绪曲线

### Phase 2 整体验收

- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] 400字文本解析耗时 < 90秒（最终目标）
- [ ] 400字文本分镜数 <= 4个
- [ ] 输出Token数减少30%+（从7,754降至~4,500）
- [ ] 短文本(<800字)跳过情绪曲线
- [ ] 质量报告正常生成
- [ ] 可通过配置回退到原有行为

---

## Phase 3: 架构优化 - 验收清单

### Task 6: Fast Path与Standard Path合并

- [ ] `parseWithParallelExtraction`方法已创建
- [ ] 方法整合Fast Path和Standard Path的公共逻辑
- [ ] `ParseStrategySelector`简化策略选择逻辑
- [ ] Fast Path和Standard Path都使用`parseWithParallelExtraction`
- [ ] Chunked Path保持独立逻辑
- [ ] `ScriptParserConfig`包含`unifiedParsingLogic`配置项
- [ ] 当`unifiedParsingLogic: true`时，使用统一并行逻辑
- [ ] 当`unifiedParsingLogic: false`时，使用原有策略选择逻辑
- [ ] 集成测试验证Fast Path使用并行逻辑
- [ ] 集成测试验证Standard Path使用并行逻辑
- [ ] 集成测试验证Chunked Path保持独立
- [ ] 回滚验证通过：设置`unifiedParsingLogic: false`后使用原有策略

### Phase 3 整体验收

- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] Fast Path和Standard Path使用统一并行逻辑
- [ ] 代码复杂度降低（代码行数减少或逻辑简化）
- [ ] 可通过配置回退到原有策略

---

## 全量验收清单

### 性能指标

- [ ] 400字文本解析耗时 < 90秒（目标60-90秒）
- [ ] API调用次数 <= 4次（优化前6次）
- [ ] 输出Token数减少40%+（从7,754降至~4,500）
- [ ] 并行化程度 >= 50%

### 功能完整性

- [ ] 元数据提取功能正常
- [ ] 角色提取功能正常
- [ ] 场景提取功能正常
- [ ] 分镜生成功能正常
- [ ] 质量报告生成功能正常
- [ ] 断点续传功能正常

### 配置与回滚

- [ ] 所有优化都可通过配置开关控制
- [ ] 所有配置都有合理的默认值
- [ ] 设置所有配置为false后，行为与优化前一致
- [ ] 400字文本解析耗时回到287秒左右（验证回滚有效）

### 代码质量

- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] 代码审查通过（无竞态条件、无内存泄漏）
- [ ] TypeScript类型检查通过
- [ ] ESLint检查通过

### 文档完整性

- [ ] 配置文档已更新
- [ ] API文档已更新（如有变化）
- [ ] 回滚文档已更新
- [ ] 性能基准测试报告已生成

---

## 性能基准测试

### 测试用例

| 用例     | 文本长度 | 场景数 | 角色数 | 优化前耗时 | Phase 1目标 | Phase 2目标 |
| -------- | -------- | ------ | ------ | ---------- | ----------- | ----------- |
| 短文本   | 400字    | 2      | 2      | 287s       | < 120s      | < 90s       |
| 中等文本 | 1500字   | 5      | 4      | ~600s      | < 300s      | < 240s      |
| 长文本   | 3000字   | 8      | 6      | ~1200s     | < 600s      | < 480s      |

### 测试方法

1. 使用相同的小说文本进行测试
2. 记录每个API调用的耗时和token数
3. 重复测试3次取平均值
4. 对比优化前后的性能数据

---

## 验收签字

| Phase    | 验收日期 | 验收人 | 状态      | 备注 |
| -------- | -------- | ------ | --------- | ---- |
| Phase 1  |          |        | ⬜ 待验收 |      |
| Phase 2  |          |        | ⬜ 待验收 |      |
| Phase 3  |          |        | ⬜ 待验收 |      |
| 全量验收 |          |        | ⬜ 待验收 |      |

---

**文档版本**: v1.0  
**创建日期**: 2026-03-08  
**核心目标**: 400字文本解析耗时从287秒降至60-90秒
