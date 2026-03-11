# 剧本解析性能优化方案 Spec (v1.0)

> **方案定位**: 基于深度代码分析和日志追踪的性能优化方案
> **核心目标**: 将400字文本解析耗时从287秒降至60-90秒（提升200%+）
> **分析方法**: 代码执行链路追踪 + API调用耗时分析 + 行业对标

---

## 一、问题现状分析

### 1.1 性能数据（来自后端日志）

| 调用阶段   | 输入Token | 输出Token | 耗时       | 问题             |
| ---------- | --------- | --------- | ---------- | ---------------- |
| Metadata   | 915       | 234       | 34.8s      | 结构化输出开销大 |
| 全局上下文 | 915       | 1,020     | 50.0s      | 与metadata串行   |
| 情绪曲线   | 805       | 1,320     | 50.4s      | 与全局上下文串行 |
| 角色提取   | 1,205     | 1,061     | 40.2s      | 输出膨胀         |
| 场景提取   | 1,430     | 975       | 41.5s      | 与角色串行       |
| 分镜生成   | 872       | 2,144     | 69.7s      | 分镜数量过多     |
| **总计**   | **6,142** | **7,754** | **286.8s** | **6次串行调用**  |

### 1.2 行业对标

| 应用         | 400字文本耗时 | 技术方案            | 差距      |
| ------------ | ------------- | ------------------- | --------- |
| 剪映         | 10-30秒       | 云端预训练+并行处理 | **9.6倍** |
| 即梦AI       | 30-60秒       | Seedance 2.0大模型  | **4.8倍** |
| Runway       | 60-120秒      | Gen-2专业模型       | **2.4倍** |
| **当前项目** | **287秒**     | 6次串行API调用      | -         |

### 1.3 核心问题识别

**问题1: 隐藏调用链**

- `extractMetadata()` 内部隐藏调用了 `extractGlobalContext()`
- 导致实际API调用比预期多2次
- 位置: `services/scriptParser.ts:1592-1633`

**问题2: 串行执行**

- 6次API调用全部串行，无并行化
- 全局上下文提取和情绪曲线提取串行（可节省50秒）
- 角色和场景提取串行（可节省40秒）

**问题3: 输出膨胀**

- 400字输入生成2,144字符分镜描述（5.36倍膨胀）
- 强制要求3-5个分镜/场景，未根据文本长度动态调整
- 位置: `services/scriptParser.ts:475-506`

**问题4: 情绪曲线过度提取**

- 短文本(<800字)强制提取情绪曲线
- 耗时50.4秒，产出价值有限

---

## 二、Why

### 2.1 当前系统问题

1. **Fast Path设计失效**
   - 设计意图: 1-2次API调用，60秒完成
   - 实际实现: 6次串行调用，287秒完成
   - Fast Path比Standard Path慢约1倍

2. **调用链路不透明**
   - `extractMetadata` 内部调用 `extractGlobalContext`
   - 从代码阅读角度难以发现隐藏调用
   - 导致所有解析路径都多了2次API调用

3. **缺乏并行化**
   - 角色和场景提取可并行，但代码中是串行
   - 全局上下文和情绪曲线可并行，但代码中是串行

### 2.2 优化后预期效果

| 指标          | 当前  | 优化后      | 提升      |
| ------------- | ----- | ----------- | --------- |
| 400字解析耗时 | 287秒 | 60-90秒     | **+200%** |
| API调用次数   | 6次   | 3-4次       | **-40%**  |
| 输出Token数   | 7,754 | 4,000-5,000 | **-40%**  |
| 并行化程度    | 0%    | 50%+        | **新增**  |

---

## 三、What Changes

### 3.1 Phase 1: 调用链路优化（P0 - 立即实施）

#### 变更1: 显式化全局上下文提取调用

**文件**: `services/scriptParser.ts`
**变更类型**: 重构调用链
**向后兼容**: 是，通过配置开关控制

```typescript
// 当前实现 (隐藏调用)
async extractMetadata(content: string): Promise<ScriptMetadata> {
  const metadata = await this.callStructuredLLM(...);  // 34.8s
  const globalContext = await this.extractGlobalContext(content);  // 50.0s + 50.4s (隐藏!)
  return result;
}

// 优化后 (显式调用)
interface ParseOptions {
  skipGlobalContext?: boolean;  // 新增配置
}

async extractMetadata(content: string, options?: ParseOptions): Promise<ScriptMetadata> {
  const metadata = await this.callStructuredLLM(...);

  // 显式控制是否提取全局上下文
  if (!options?.skipGlobalContext) {
    const globalContext = await this.extractGlobalContext(content);
    // ...
  }

  return result;
}
```

**预期收益**: 为Fast Path提供跳过全局上下文提取的能力，节省100秒

#### 变更2: Fast Path并行化改造

**文件**: `services/scriptParser.ts`
**变更类型**: 重构 `parseShortScript` 方法
**向后兼容**: 是，保留原有方法作为fallback

```typescript
// 当前实现 (串行)
async parseShortScript(...) {
  state.metadata = await this.extractMetadata(content);  // 135.2s (包含隐藏调用)
  state.characters = await this.extractAllCharactersWithContext(...);  // 40.2s
  state.scenes = await this.extractAllScenesWithContext(...);  // 41.5s (串行!)
  const allShots = await this.generateAllShotsWithContext(...);  // 69.7s
}

// 优化后 (并行)
async parseShortScriptOptimized(...) {
  // Step 1: 并行提取元数据和全局上下文
  const [metadata, globalContext] = await Promise.all([
    this.extractMetadata(content, { skipGlobalContext: true }),  // 34.8s
    this.extractGlobalContext(content)  // 50.0s (并行)
  ]);

  // Step 2: 并行提取角色和场景
  const [characters, scenes] = await Promise.all([
    this.extractAllCharactersWithContext(content, globalContext, ...),  // 40.2s
    this.extractAllScenesWithContext(content, globalContext, ...)  // 41.5s (并行)
  ]);

  // Step 3: 生成分镜 (依赖角色和场景)
  const allShots = await this.generateAllShotsWithContext(content, scenes, ...);  // 69.7s
}
```

**预期收益**: 并行化后总耗时约 85秒 (34.8s + 50.0s + max(40.2s, 41.5s) + 69.7s)

#### 变更3: 全局上下文提取内部并行化

**文件**: `services/parsing/GlobalContextExtractor.ts`
**变更类型**: 重构 `extract` 方法
**向后兼容**: 是

```typescript
// 当前实现 (串行)
async extract(content: string): Promise<GlobalContext> {
  const unifiedContext = await this.extractUnifiedContext(content);      // 50.0s
  const emotionalContext = await this.extractEmotionalArc(content, ...); // 50.4s (串行!)
  return { story, visual, era, emotional, rules };
}

// 优化后 (并行)
async extract(content: string): Promise<GlobalContext> {
  const unifiedContext = await this.extractUnifiedContext(content);  // 50.0s

  // 情绪曲线提取改为可选，且与unifiedContext并行
  const emotionalPromise = this.config.extractEmotionalArc
    ? this.extractEmotionalArc(content, unifiedContext.story)  // 50.4s
    : Promise.resolve(null);

  const emotionalContext = await emotionalPromise;

  return { story, visual, era, emotional: emotionalContext, rules };
}
```

**预期收益**:

- 如果跳过情绪曲线: 节省50.4秒
- 如果保留情绪曲线: 与unifiedContext并行，无额外耗时

---

### 3.2 Phase 2: 输出优化（P1 - 建议实施）

#### 变更4: 动态分镜数量调整

**文件**: `services/scriptParser.ts`
**变更类型**: 修改 `shotsBatch` Prompt
**向后兼容**: 是，通过配置控制

```typescript
// 当前实现 (固定3-5个/场景)
shotsBatch: `
请为每个场景生成3-5个关键分镜
...
`

// 优化后 (根据文本长度动态调整)
private getShotCountByTextLength(textLength: number): string {
  if (textLength < 500) return '1-2个';      // 400字文本只需1-2个分镜
  if (textLength < 1500) return '2-3个';
  if (textLength < 3000) return '3-5个';
  return '3-5个';
}

async generateAllShotsWithContext(content: string, scenes: Scene[], ...) {
  const shotCount = this.getShotCountByTextLength(content.length);
  const prompt = this.PROMPTS.shotsBatch
    .replace('{{shotCount}}', shotCount)
    .replace('{{content}}', content);
  // ...
}
```

**预期收益**: 400字文本分镜输出从2,144字符降至800-1,200字符，节省30% token和时间

#### 变更5: 短文本跳过情绪曲线

**文件**: `services/parsing/GlobalContextExtractor.ts`
**变更类型**: 添加配置开关
**向后兼容**: 是

```typescript
interface GlobalContextExtractorConfig {
  extractEmotionalArc?: boolean;  // 默认true，短文本可设为false
  textLengthThreshold?: number;   // 默认800，低于此值跳过情绪曲线
}

async extract(content: string): Promise<GlobalContext> {
  const shouldExtractEmotional = this.config.extractEmotionalArc !== false
    && content.length >= (this.config.textLengthThreshold || 800);

  // ...
}
```

**预期收益**: 短文本(<800字)跳过情绪曲线提取，节省50.4秒

---

### 3.3 Phase 3: 架构优化（P2 - 可选实施）

#### 变更6: Fast Path与Standard Path合并

**文件**: `services/scriptParser.ts`, `services/parsing/ParseStrategySelector.ts`
**变更类型**: 重构解析策略选择
**向后兼容**: 是，通过配置控制

```typescript
// 当前问题: Fast Path比Standard Path慢
// 优化方案: Fast Path直接复用Standard Path的并行逻辑

async parseScript(scriptId: string, ..., strategy?: ParseStrategy) {
  const actualStrategy = strategy || this.selectStrategy(content);

  // 对于短文本，使用优化的并行路径
  if (actualStrategy === ParseStrategy.FAST || actualStrategy === ParseStrategy.STANDARD) {
    return this.parseWithParallelExtraction(scriptId, ..., content);
  }

  // 对于长文本，使用分块路径
  if (actualStrategy === ParseStrategy.CHUNKED) {
    return this.parseChunked(scriptId, ..., content);
  }
}

// 统一的并行提取方法
private async parseWithParallelExtraction(...) {
  // 并行化实现 (同变更2)
}
```

**预期收益**: 简化代码逻辑，统一优化效果

---

## 四、ADDED Requirements

### Requirement 1: 显式化全局上下文提取

The system SHALL allow explicit control over global context extraction.

#### Scenario: Fast Path跳过全局上下文

- **GIVEN** 用户上传<800字的短文本
- **WHEN** 系统选择Fast Path策略
- **THEN** 应跳过全局上下文提取
- **AND** 应直接提取元数据、角色、场景、分镜
- **AND** 解析耗时应在60-90秒内

#### Scenario: Standard Path保留全局上下文

- **GIVEN** 用户上传800-5000字的中长文本
- **WHEN** 系统选择Standard Path策略
- **THEN** 应提取全局上下文
- **AND** 应与元数据提取并行执行

### Requirement 2: 并行化角色和场景提取

The system SHALL extract characters and scenes in parallel.

#### Scenario: 短文本并行提取

- **GIVEN** 解析任务需要提取角色和场景
- **WHEN** 系统执行提取
- **THEN** 应使用Promise.all并行执行
- **AND** 总耗时应为两者中较长者，而非两者之和

### Requirement 3: 动态分镜数量

The system SHALL adjust shot count based on text length.

#### Scenario: 短文本减少分镜

- **GIVEN** 用户上传400字文本
- **WHEN** 系统生成分镜
- **THEN** 应生成1-2个分镜/场景
- **AND** 总分镜数应不超过4个

#### Scenario: 长文本保持分镜数

- **GIVEN** 用户上传3000字文本
- **WHEN** 系统生成分镜
- **THEN** 应生成3-5个分镜/场景
- **AND** 符合专业分镜标准

### Requirement 4: 可选情绪曲线提取

The system SHALL make emotional arc extraction optional.

#### Scenario: 短文本跳过情绪曲线

- **GIVEN** 用户上传<800字文本
- **WHEN** 系统提取全局上下文
- **THEN** 应跳过情绪曲线提取
- **AND** 应在质量报告中标注"情绪曲线未提取"

#### Scenario: 长文本保留情绪曲线

- **GIVEN** 用户上传>800字文本
- **WHEN** 系统提取全局上下文
- **THEN** 应提取情绪曲线
- **AND** 应与全局上下文并行执行

---

## 五、实施路线图

### Phase 1: 调用链路优化（2-3小时，立即实施）

**实施顺序**:

1. **变更1** - 显式化全局上下文提取 (1h)
   - 添加`skipGlobalContext`选项
   - 修改`extractMetadata`方法
   - 添加配置开关
2. **变更2** - Fast Path并行化 (1h)
   - 重构`parseShortScript`方法
   - 实现元数据+全局上下文并行
   - 实现角色+场景并行
3. **变更3** - 全局上下文内部并行化 (0.5h)
   - 修改`GlobalContextExtractor.extract`
   - 添加`extractEmotionalArc`配置

**前置条件**: 无

**预期效果**:

- 400字文本耗时: 287s → 85s
- API调用次数: 6次 → 4次
- 并行化程度: 0% → 50%

### Phase 2: 输出优化（1-2小时，建议实施）

**实施顺序**:

1. **变更4** - 动态分镜数量 (1h)
   - 实现`getShotCountByTextLength`
   - 修改`shotsBatch` Prompt
   - 添加配置开关
2. **变更5** - 短文本跳过情绪曲线 (0.5h)
   - 添加`textLengthThreshold`配置
   - 修改`GlobalContextExtractor`逻辑

**前置条件**: Phase 1完成

**预期效果**:

- 输出Token数: 7,754 → 4,500
- 分镜生成耗时: 69.7s → 45s
- 情绪曲线耗时(短文本): 50.4s → 0s

### Phase 3: 架构优化（1-2小时，可选实施）

**实施顺序**:

1. **变更6** - Fast Path与Standard Path合并 (1-2h)
   - 重构`ParseStrategySelector`
   - 统一并行提取逻辑
   - 简化代码维护

**前置条件**: Phase 1+2完成

**预期效果**:

- 代码复杂度降低
- 维护成本降低
- 优化效果统一

---

## 六、风险与回退方案

### 6.1 低风险变更

| 变更                 | 风险 | 回退方案                                   |
| -------------------- | ---- | ------------------------------------------ |
| 显式化全局上下文提取 | 低   | 设置`skipGlobalContext: false`恢复原有行为 |
| Fast Path并行化      | 低   | 调用原有`parseShortScript`方法             |
| 全局上下文内部并行化 | 低   | 设置`extractEmotionalArc: true`恢复        |
| 动态分镜数量         | 低   | 设置固定分镜数恢复                         |
| 短文本跳过情绪曲线   | 低   | 降低`textLengthThreshold`恢复              |

### 6.2 风险缓解措施

1. **配置开关**: 所有变更都通过配置开关控制，可随时回退
2. **保留原有方法**: 不删除原有方法，仅添加新方法
3. **渐进式部署**: 先在小范围测试，再全面推广
4. **监控指标**: 监控解析耗时、成功率、输出质量

---

## 七、验收标准

### Phase 1 验收

- [ ] 400字文本解析耗时 < 90秒
- [ ] API调用次数 <= 4次
- [ ] 角色和场景提取并行执行
- [ ] 可通过配置回退到原有行为

### Phase 2 验收

- [ ] 400字文本分镜数 <= 4个
- [ ] 输出Token数减少30%+
- [ ] 短文本(<800字)跳过情绪曲线
- [ ] 质量报告正常生成

### Phase 3 验收

- [ ] Fast Path和Standard Path使用统一并行逻辑
- [ ] 代码复杂度降低
- [ ] 所有单元测试通过

---

## 八、不改动的内容

以下功能已正常工作，不在本次优化范围内：

1. **角色/场景提取质量** - 提取逻辑本身无需修改
2. **分镜生成质量** - 仅调整数量，不修改生成逻辑
3. **上下文注入机制** - 设计合理，仅优化调用时机
4. **断点续传机制** - 已正常工作
5. **质量报告系统** - 已正常工作
6. **前端组件** - 无需修改

---

## 九、复杂度与风险分析

### 9.1 复杂度评估

| 变更                         | 代码复杂度 | 测试复杂度 | 回滚复杂度 | 总体评估  |
| ---------------------------- | ---------- | ---------- | ---------- | --------- |
| 显式化全局上下文提取         | 低         | 低         | 低         | ⭐ 简单   |
| Fast Path并行化              | 中         | 中         | 低         | ⭐⭐ 中等 |
| 全局上下文内部并行化         | 低         | 低         | 低         | ⭐ 简单   |
| 动态分镜数量                 | 低         | 低         | 低         | ⭐ 简单   |
| 短文本跳过情绪曲线           | 低         | 低         | 低         | ⭐ 简单   |
| Fast Path与Standard Path合并 | 中         | 中         | 中         | ⭐⭐ 中等 |

### 9.2 风险评估

| 风险类型         | 风险描述                 | 概率 | 影响 | 缓解措施           |
| ---------------- | ------------------------ | ---- | ---- | ------------------ |
| **性能回退**     | 并行化后某些场景性能下降 | 低   | 中   | 配置开关，可回退   |
| **输出质量下降** | 分镜数量减少影响质量     | 低   | 中   | 质量报告监控       |
| **并发问题**     | Promise.all引入竞态条件  | 低   | 高   | 代码审查，单元测试 |
| **配置错误**     | 用户误配置导致异常       | 中   | 低   | 合理的默认值       |

### 9.3 实施建议

1. **Phase 1必须实施** - 这是解决性能问题的核心
2. **Phase 2建议实施** - 进一步提升性能，风险低
3. **Phase 3可选实施** - 架构优化，可延后

---

**文档版本**: v1.0  
**创建日期**: 2026-03-08  
**分析方法**: 代码执行链路追踪 + API调用耗时分析 + 行业对标  
**核心目标**: 400字文本解析耗时从287秒降至60-90秒
