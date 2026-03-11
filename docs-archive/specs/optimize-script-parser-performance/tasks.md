# 剧本解析性能优化 - 任务清单 (v1.0)

> **核心目标**: 将400字文本解析耗时从287秒降至60-90秒（提升200%+）
> **实施策略**: 分3个阶段，每阶段可独立测试验证，风险可控

---

## 实施策略

**总体原则**:

1. **优先解决性能瓶颈** - 并行化调用链路，减少串行等待
2. **所有改动通过配置开关控制** - 支持随时回退到原有行为
3. **保留原有方法** - 不删除代码，仅添加新方法
4. **渐进式部署** - 先Phase 1核心优化，验证后再进行Phase 2/3

---

## Phase 1: 调用链路优化（P0 - 立即实施）

### Task 1: 显式化全局上下文提取调用

**描述**: 将`extractMetadata`内部的隐藏调用`extractGlobalContext`显式化，提供跳过选项
**优先级**: P0
**预估工时**: 1小时
**风险**: 低
**回滚方式**: 设置 `skipGlobalContext: false`

**实施步骤**:

1. [x] 1.1 在`types.ts`中添加`ParseOptions`接口
   ```typescript
   interface ParseOptions {
     skipGlobalContext?: boolean;
   }
   ```
2. [x] 1.2 修改`scriptParser.ts`中的`extractMetadata`方法签名
   - 添加`options?: ParseOptions`参数
   - 将内部调用`extractGlobalContext`改为条件执行
3. [x] 1.3 在`ScriptParserConfig`中添加配置项
   ```typescript
   interface ScriptParserConfig {
     skipGlobalContextForFastPath?: boolean; // 默认true
   }
   ```
4. [x] 1.4 编写单元测试
   - 测试`skipGlobalContext: true`时跳过全局上下文提取
   - 测试`skipGlobalContext: false`时正常提取
5. [x] 1.5 验证回滚功能
   - 设置`skipGlobalContext: false`
   - 验证行为与优化前一致

**修改文件**:

- 修改: `services/scriptParser.ts` (~30行)
- 修改: `types.ts` (~10行新增类型)

**验收标准**:

- [ ] `extractMetadata`支持`skipGlobalContext`选项
- [ ] Fast Path可以跳过全局上下文提取
- [ ] 可通过配置回退到原有行为
- [ ] 单元测试通过

---

### Task 2: Fast Path并行化改造

**描述**: 重构`parseShortScript`方法，实现元数据+全局上下文并行，角色+场景并行
**优先级**: P0
**预估工时**: 1小时
**风险**: 中
**回滚方式**: 调用原有`parseShortScript`方法

**实施步骤**:

1. [x] 2.1 创建新的`parseShortScriptOptimized`方法
   - 复制原有`parseShortScript`方法作为基础
   - 保留原有方法不变（用于回退）
2. [x] 2.2 实现元数据和全局上下文并行提取
   ```typescript
   const [metadata, globalContext] = await Promise.all([
     this.extractMetadata(content, { skipGlobalContext: true }),
     this.extractGlobalContext(content),
   ]);
   ```
3. [x] 2.3 实现角色和场景并行提取
   ```typescript
   const [characters, scenes] = await Promise.all([
     this.extractAllCharactersWithContext(content, globalContext, metadata.characterNames),
     this.extractAllScenesWithContext(content, globalContext, metadata.sceneNames),
   ]);
   ```
4. [x] 2.4 修改`parseScript`方法，使用新的并行方法
   - 添加配置开关`useParallelExtraction`
   - 默认启用并行化
5. [x] 2.5 编写集成测试
   - 测试并行提取的正确性
   - 测试总耗时是否减少
6. [x] 2.6 验证回滚功能
   - 设置`useParallelExtraction: false`
   - 验证调用原有`parseShortScript`方法

**修改文件**:

- 修改: `services/scriptParser.ts` (~100行新增)

**验收标准**:

- [ ] 元数据和全局上下文并行提取
- [ ] 角色和场景并行提取
- [ ] 400字文本耗时 < 120秒（Phase 1目标）
- [ ] 可通过配置回退到原有行为
- [ ] 集成测试通过

---

### Task 3: 全局上下文提取内部并行化

**描述**: 修改`GlobalContextExtractor.extract`方法，使情绪曲线提取与unifiedContext并行
**优先级**: P0
**预估工时**: 0.5小时
**风险**: 低
**回滚方式**: 设置 `extractEmotionalArc: true`

**实施步骤**:

1. [x] 3.1 在`GlobalContextExtractorConfig`中添加配置项
   ```typescript
   interface GlobalContextExtractorConfig {
     extractEmotionalArc?: boolean; // 默认true
   }
   ```
2. [x] 3.2 修改`GlobalContextExtractor.extract`方法
   - 将`extractEmotionalArc`改为条件执行
   - 支持与`extractUnifiedContext`并行（如果架构允许）
3. [x] 3.3 在`ScriptParserConfig`中添加对应配置
   ```typescript
   interface ScriptParserConfig {
     extractEmotionalArc?: boolean; // 默认true
   }
   ```
4. [x] 3.4 编写单元测试
   - 测试`extractEmotionalArc: false`时跳过情绪曲线
   - 测试`extractEmotionalArc: true`时正常提取
5. [x] 3.5 验证回滚功能
   - 设置`extractEmotionalArc: true`
   - 验证行为与优化前一致

**修改文件**:

- 修改: `services/parsing/GlobalContextExtractor.ts` (~30行)
- 修改: `services/scriptParser.ts` (~10行，配置传递)

**验收标准**:

- [ ] `GlobalContextExtractor`支持`extractEmotionalArc`选项
- [ ] 可通过配置跳过情绪曲线提取
- [ ] 可通过配置回退到原有行为
- [ ] 单元测试通过

---

## Phase 2: 输出优化（P1 - 建议实施）

### Task 4: 动态分镜数量调整

**描述**: 根据文本长度动态调整分镜数量要求，短文本减少分镜数
**优先级**: P1
**预估工时**: 1小时
**风险**: 低
**回滚方式**: 使用固定分镜数Prompt

**实施步骤**:

1. [x] 4.1 在`scriptParser.ts`中添加动态分镜数量方法
   ```typescript
   private getShotCountByTextLength(textLength: number): string {
     if (textLength < 500) return '1-2个';
     if (textLength < 1500) return '2-3个';
     if (textLength < 3000) return '3-5个';
     return '3-5个';
   }
   ```
2. [x] 4.2 修改`PROMPTS.shotsBatch`，使用模板变量
   ```typescript
   shotsBatch: `
   请为每个场景生成{{shotCount}}关键分镜
   ...
   `;
   ```
3. [x] 4.3 修改`generateAllShotsWithContext`方法
   - 调用`getShotCountByTextLength`获取分镜数
   - 替换Prompt中的模板变量
4. [x] 4.4 在`ScriptParserConfig`中添加配置
   ```typescript
   interface ScriptParserConfig {
     useDynamicShotCount?: boolean; // 默认true
     shotCountOverrides?: {
       // 可选覆盖
       shortText?: string; // <500字
       mediumText?: string; // 500-1500字
       longText?: string; // >1500字
     };
   }
   ```
5. [x] 4.5 编写单元测试
   - 测试不同文本长度返回正确的分镜数
   - 测试配置覆盖功能
6. [x] 4.6 验证回滚功能
   - 设置`useDynamicShotCount: false`
   - 验证使用固定分镜数

**修改文件**:

- 修改: `services/scriptParser.ts` (~50行)

**验收标准**:

- [ ] 400字文本分镜数 <= 4个
- [ ] 1000字文本分镜数 <= 6个
- [ ] 3000字文本分镜数 <= 10个
- [ ] 可通过配置回退到固定分镜数
- [ ] 单元测试通过

---

### Task 5: 短文本跳过情绪曲线

**描述**: 对于短文本(<800字)，自动跳过情绪曲线提取
**优先级**: P1
**预估工时**: 0.5小时
**风险**: 低
**回滚方式**: 降低`textLengthThreshold`

**实施步骤**:

1. [x] 5.1 在`GlobalContextExtractorConfig`中添加阈值配置
   ```typescript
   interface GlobalContextExtractorConfig {
     textLengthThreshold?: number; // 默认800
   }
   ```
2. [x] 5.2 修改`GlobalContextExtractor.extract`方法
   - 根据文本长度和阈值决定是否提取情绪曲线
   ```typescript
   const shouldExtractEmotional =
     this.config.extractEmotionalArc !== false &&
     content.length >= (this.config.textLengthThreshold || 800);
   ```
3. [x] 5.3 在质量报告中标注情绪曲线未提取
   - 修改`QualityReport`类型，添加字段
   - 在`extract`方法中记录跳过的原因
4. [x] 5.4 在`ScriptParserConfig`中添加对应配置
   ```typescript
   interface ScriptParserConfig {
     textLengthThreshold?: number; // 默认800
   }
   ```
5. [x] 5.5 编写单元测试
   - 测试<800字文本跳过情绪曲线
   - 测试>=800字文本正常提取情绪曲线
6. [x] 5.6 验证回滚功能
   - 设置`textLengthThreshold: 0`
   - 验证所有文本都提取情绪曲线

**修改文件**:

- 修改: `services/parsing/GlobalContextExtractor.ts` (~20行)
- 修改: `types.ts` (~5行，QualityReport扩展)
- 修改: `services/scriptParser.ts` (~10行，配置传递)

**验收标准**:

- [ ] <800字文本跳过情绪曲线提取
- [ ] > =800字文本正常提取情绪曲线
- [ ] 质量报告中标注情绪曲线状态
- [ ] 可通过配置调整阈值
- [ ] 单元测试通过

---

## Phase 3: 架构优化（P2 - 可选实施）

### Task 6: Fast Path与Standard Path合并

**描述**: 重构解析策略选择，Fast Path和Standard Path使用统一的并行提取逻辑
**优先级**: P2
**预估工时**: 1-2小时
**风险**: 中
**回滚方式**: 保留原有策略选择逻辑

**实施步骤**:

1. [ ] 6.1 创建统一的并行提取方法`parseWithParallelExtraction`
   - 整合Fast Path和Standard Path的公共逻辑
   - 支持配置控制提取深度
2. [ ] 6.2 修改`ParseStrategySelector`，简化策略选择
   - Fast Path和Standard Path都返回`parseWithParallelExtraction`
   - Chunked Path保持独立
3. [ ] 6.3 在`ScriptParserConfig`中添加配置
   ```typescript
   interface ScriptParserConfig {
     unifiedParsingLogic?: boolean; // 默认true
   }
   ```
4. [ ] 6.4 编写集成测试
   - 测试Fast Path使用并行逻辑
   - 测试Standard Path使用并行逻辑
   - 测试Chunked Path保持独立
5. [ ] 6.5 验证回滚功能
   - 设置`unifiedParsingLogic: false`
   - 验证使用原有策略选择逻辑

**修改文件**:

- 修改: `services/scriptParser.ts` (~50行)
- 修改: `services/parsing/ParseStrategySelector.ts` (~30行)

**验收标准**:

- [ ] Fast Path和Standard Path使用统一并行逻辑
- [ ] Chunked Path保持独立
- [ ] 可通过配置回退到原有策略
- [ ] 集成测试通过

---

## Task Dependencies

```
Phase 1 (核心优化 - 必须实施):
Task 1 (显式化全局上下文) ─┐
Task 3 (全局上下文内部并行) ┼─→ 可并行执行
                           │
Task 2 (Fast Path并行化) ───┘ → 依赖Task 1和Task 3

Phase 2 (输出优化 - 建议实施):
Task 4 (动态分镜数量) ───────┐
Task 5 (短文本跳过情绪曲线) ─┴─→ 可并行执行

Phase 3 (架构优化 - 可选实施):
Task 6 (Fast/Standard合并) ───→ 依赖Phase 1完成
```

---

## 回滚验证清单

### Task 1 回滚验证

- [ ] 设置 `skipGlobalContext: false`
- [ ] 验证`extractMetadata`内部调用`extractGlobalContext`
- [ ] 验证行为与优化前一致

### Task 2 回滚验证

- [ ] 设置 `useParallelExtraction: false`
- [ ] 验证调用原有`parseShortScript`方法
- [ ] 验证串行执行

### Task 3 回滚验证

- [ ] 设置 `extractEmotionalArc: true`
- [ ] 验证所有文本都提取情绪曲线
- [ ] 验证行为与优化前一致

### Task 4 回滚验证

- [ ] 设置 `useDynamicShotCount: false`
- [ ] 验证使用固定分镜数（3-5个/场景）
- [ ] 验证行为与优化前一致

### Task 5 回滚验证

- [ ] 设置 `textLengthThreshold: 0`
- [ ] 验证所有文本都提取情绪曲线
- [ ] 验证行为与优化前一致

### Task 6 回滚验证

- [ ] 设置 `unifiedParsingLogic: false`
- [ ] 验证使用原有策略选择逻辑
- [ ] 验证Fast Path和Standard Path行为不同

### 全量回滚验证

- [ ] 所有配置设置为原有行为
- [ ] 验证400字文本解析耗时回到287秒左右
- [ ] 验证所有功能正常

---

## 验收检查清单

### Phase 1 完成后

- [ ] 400字文本解析耗时 < 120秒（初步目标）
- [ ] API调用次数 <= 4次
- [ ] 角色和场景提取并行执行
- [ ] 可通过配置回退到原有行为
- [ ] 所有单元测试通过

### Phase 2 完成后

- [ ] 400字文本解析耗时 < 90秒（最终目标）
- [ ] 400字文本分镜数 <= 4个
- [ ] 输出Token数减少30%+
- [ ] 短文本(<800字)跳过情绪曲线
- [ ] 质量报告正常生成

### Phase 3 完成后

- [ ] Fast Path和Standard Path使用统一并行逻辑
- [ ] 代码复杂度降低
- [ ] 维护成本降低
- [ ] 所有集成测试通过

---

## 性能监控指标

### 关键指标

| 指标          | 当前值 | Phase 1目标 | Phase 2目标 | 测量方法 |
| ------------- | ------ | ----------- | ----------- | -------- |
| 400字解析耗时 | 287s   | < 120s      | < 90s       | 后端日志 |
| API调用次数   | 6次    | <= 4次      | <= 4次      | 后端日志 |
| 输出Token数   | 7,754  | ~6,000      | ~4,500      | 后端日志 |
| 并行化程度    | 0%     | 50%         | 60%         | 代码审查 |
| 分镜数(400字) | 9个    | 9个         | <= 4个      | 解析结果 |

### 监控方法

1. **后端日志** - 记录每个API调用的耗时和token数
2. **性能埋点** - 在关键节点添加性能监控
3. **质量报告** - 监控解析质量是否下降

---

**文档版本**: v1.0  
**创建日期**: 2026-03-08  
**核心目标**: 400字文本解析耗时从287秒降至60-90秒
