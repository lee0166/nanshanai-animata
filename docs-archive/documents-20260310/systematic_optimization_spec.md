# 剧本解析系统全面优化方案

## 一、现状问题总结

### 1.1 核心问题诊断

通过测试发现，Phase 1 优化引入全局上下文后，产生了以下系统性问题：

| 问题类别        | 具体问题                              | 严重程度 |
| --------------- | ------------------------------------- | -------- |
| **性能退化**    | 340字剧本解析耗时10分钟（原应<2分钟） | 🔴 严重  |
| **API成本激增** | 35次API调用，单次平均25秒             | 🔴 严重  |
| **Token溢出**   | 分镜生成需9306 tokens，但限制4000     | 🔴 严重  |
| **数据截断**    | 响应被截断导致JSON解析失败            | 🔴 严重  |
| **设计不合理**  | 每次请求发送完整剧本，重复浪费        | 🟡 中等  |
| **缺少流控**    | 无超时、无重试、无降级机制            | 🟡 中等  |

### 1.2 根本原因分析

**设计层面问题**：

1. **串行架构**：所有解析阶段串行执行，无法并行化
2. **粗粒度调用**：单次调用生成过多内容（15个分镜）
3. **冗余数据传输**：每次请求重复发送完整剧本
4. **静态配置**：max_tokens固定4000，不适应不同场景需求
5. **无自适应机制**：不能根据剧本长度/复杂度动态调整

**架构层面问题**：

1. **缺乏分层设计**：解析、提取、生成耦合在一起
2. **无缓存策略**：相同内容重复解析
3. **无质量评估**：无法判断解析结果是否可用
4. **无降级方案**：模型慢时无替代方案

---

## 二、系统性优化方案

### 2.1 架构重构：三层解析模型

```
┌─────────────────────────────────────────────────────────────┐
│                    剧本解析引擎 (ScriptParser)                 │
├─────────────────────────────────────────────────────────────┤
│  第一层：元数据提取 (Metadata Layer)                           │
│  ├── 剧本类型识别（短剧/长剧/电影）                            │
│  ├── 复杂度评估（字数/角色数/场景数）                          │
│  └── 解析策略选择（快速/标准/深度）                           │
├─────────────────────────────────────────────────────────────┤
│  第二层：内容提取 (Content Layer)                              │
│  ├── 全局上下文（可选，根据复杂度决定是否启用）                 │
│  ├── 角色提取（并行批量处理）                                 │
│  ├── 场景提取（并行批量处理）                                 │
│  └── 关系图谱（角色关系、场景关联）                           │
├─────────────────────────────────────────────────────────────┤
│  第三层：生成层 (Generation Layer)                             │
│  ├── 分镜生成（流式/增量生成）                                │
│  ├── 提示词优化（动态长度控制）                               │
│  └── 质量验证（自动检查+人工确认）                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 动态解析策略

根据剧本复杂度自动选择解析策略：

| 策略         | 适用场景   | API调用次数 | 预估时间 | 功能特性                                     |
| ------------ | ---------- | ----------- | -------- | -------------------------------------------- |
| **快速模式** | <500字短剧 | 5-8次       | <30秒    | 基础metadata+角色+场景，无全局上下文，无分镜 |
| **标准模式** | 500-2000字 | 15-20次     | 2-3分钟  | 完整metadata+全局上下文+角色+场景+关键分镜   |
| **深度模式** | >2000字    | 25-35次     | 5-8分钟  | 完整功能+全部分镜+质量评估+一致性检查        |

**策略选择逻辑**：

```typescript
function selectParseStrategy(script: Script): ParseStrategy {
  const wordCount = script.content.length;
  const complexity = analyzeComplexity(script);

  if (wordCount < 500 && complexity < 0.3) {
    return 'fast'; // 快速模式
  } else if (wordCount < 2000 && complexity < 0.6) {
    return 'standard'; // 标准模式
  } else {
    return 'deep'; // 深度模式
  }
}
```

### 2.3 智能Token管理

**动态max_tokens计算**：

```typescript
function calculateMaxTokens(context: ParseContext): number {
  const baseTokens = 2000;
  const contentLength = context.content.length;
  const expectedOutput = estimateOutputLength(context);

  // 根据内容长度和预期输出动态计算
  return Math.min(
    baseTokens + Math.ceil(contentLength / 10) + expectedOutput,
    16000 // 上限
  );
}
```

**分层Token预算**：
| 阶段 | 预算比例 | 说明 |
|-----|---------|------|
| Metadata | 10% | 基础信息提取 |
| Global Context | 20% | 全局上下文（可选） |
| Characters | 25% | 角色提取（批量并行） |
| Scenes | 25% | 场景提取（批量并行） |
| Shots | 20% | 分镜生成（流式） |

### 2.4 并行化处理

**批量并行提取**：

```typescript
// 角色提取并行化
async function extractCharactersParallel(
  characters: string[],
  content: string,
  batchSize: number = 3
): Promise<Character[]> {
  const batches = chunk(characters, batchSize);
  const results = await Promise.all(batches.map(batch => extractCharacterBatch(batch, content)));
  return flatten(results);
}
```

**分镜流式生成**：

```typescript
// 流式分镜生成，边生成边展示
async function* generateShotsStream(scene: Scene, context: GlobalContext): AsyncGenerator<Shot> {
  const shotCount = estimateShotCount(scene);

  for (let i = 0; i < shotCount; i++) {
    const shot = await generateSingleShot(scene, i, context);
    yield shot;

    // 每生成3个分镜，暂停让用户确认
    if (i > 0 && i % 3 === 0) {
      await waitForUserConfirmation();
    }
  }
}
```

### 2.5 智能Prompt优化

**上下文感知Prompt**：

```typescript
function buildContextAwarePrompt(scene: Scene, fullScript: string): string {
  // 只提取与当前场景相关的剧本片段
  const relevantContent = extractRelevantContent(scene, fullScript);

  return `
【场景信息】
场景名称: ${scene.name}
场景描述: ${scene.description}
涉及角色: ${scene.characters.join(', ')}

【相关剧本片段】
${relevantContent}

【全局风格指导】
${context.visualStyle.artDirection}
色调: ${context.visualStyle.colorMood}

请基于以上信息生成分镜...
  `;
}
```

**动态长度控制**：

```typescript
function controlPromptLength(prompt: string, maxLength: number = 2000): string {
  if (prompt.length <= maxLength) return prompt;

  // 智能截断：保留关键信息，移除冗余
  const sections = parsePromptSections(prompt);
  const priority = ['场景信息', '相关剧本片段', '全局风格指导'];

  let result = '';
  for (const section of priority) {
    if (result.length + sections[section].length < maxLength) {
      result += sections[section];
    } else {
      // 压缩该部分内容
      result += compressSection(sections[section], maxLength - result.length);
      break;
    }
  }

  return result;
}
```

### 2.6 质量保障机制

**自适应质量检查**：

```typescript
interface QualityGate {
  check: (result: ParseResult) => boolean;
  action: 'accept' | 'retry' | 'degrade' | 'fail';
}

const qualityGates: QualityGate[] = [
  {
    // 检查JSON完整性
    check: r => isValidJSON(r.rawResponse),
    action: 'retry',
  },
  {
    // 检查内容完整性
    check: r => r.completeness > 0.8,
    action: 'retry',
  },
  {
    // 检查响应时间
    check: r => r.duration < 30000,
    action: 'degrade', // 超时则降级到快速模式
  },
];
```

**自动降级策略**：

```typescript
async function parseWithDegradation(
  script: Script,
  preferredStrategy: ParseStrategy
): Promise<ParseResult> {
  const strategies = ['deep', 'standard', 'fast'];
  const startIndex = strategies.indexOf(preferredStrategy);

  for (let i = startIndex; i < strategies.length; i++) {
    try {
      const result = await parseWithStrategy(script, strategies[i]);
      if (result.quality > 0.7) {
        return result;
      }
    } catch (error) {
      console.warn(`Strategy ${strategies[i]} failed, trying next...`);
    }
  }

  throw new Error('All parsing strategies failed');
}
```

### 2.7 缓存与复用

**多级缓存策略**：

```typescript
interface CacheStrategy {
  // L1: 内存缓存（当前会话）
  memory: Map<string, ParseResult>;

  // L2: IndexedDB缓存（本地持久化）
  indexedDB: {
    store: 'parse-cache',
    ttl: 7 * 24 * 60 * 60 * 1000,  // 7天
    key: (script) => hash(script.content)
  };

  // L3: 服务端缓存（如启用）
  server: {
    endpoint: '/api/cache',
    ttl: 30 * 24 * 60 * 60 * 1000,  // 30天
  };
}
```

**全局上下文缓存**：

```typescript
// 全局上下文只需提取一次，后续复用
class GlobalContextCache {
  private cache = new Map<string, GlobalContext>();

  async get(scriptHash: string): Promise<GlobalContext | null> {
    // 检查缓存
    if (this.cache.has(scriptHash)) {
      return this.cache.get(scriptHash)!;
    }

    // 检查IndexedDB
    const cached = await indexedDB.get(`global-context-${scriptHash}`);
    if (cached) {
      this.cache.set(scriptHash, cached);
      return cached;
    }

    return null;
  }
}
```

---

## 三、实施路线图

### Phase 1: 紧急修复（1-2天）

- [ ] 修复max_tokens不足问题（动态计算）
- [ ] 添加超时控制（30秒超时+重试）
- [ ] 实现快速模式（禁用全局上下文选项）

### Phase 2: 架构优化（1周）

- [ ] 实现三层解析模型
- [ ] 添加动态策略选择
- [ ] 实现并行化提取

### Phase 3: 智能优化（2周）

- [ ] 实现智能Prompt优化
- [ ] 添加质量保障机制
- [ ] 实现流式分镜生成

### Phase 4: 完善（1周）

- [ ] 实现多级缓存
- [ ] 添加性能监控
- [ ] 完善降级策略

---

## 四、预期效果

| 指标              | 当前             | 优化后            | 提升  |
| ----------------- | ---------------- | ----------------- | ----- |
| 340字剧本解析时间 | 10分钟           | 30秒（快速模式）  | 20倍  |
| API调用次数       | 35次             | 5-8次（快速模式） | 5-7倍 |
| 单次调用时间      | 25秒             | <5秒              | 5倍   |
| Token利用率       | 低（重复发送）   | 高（智能裁剪）    | 3倍   |
| 用户体验          | 差（长时间等待） | 好（流式展示）    | -     |

---

## 五、风险评估

| 风险             | 概率 | 影响 | 缓解措施                     |
| ---------------- | ---- | ---- | ---------------------------- |
| 重构引入新bug    | 中   | 高   | 完善测试覆盖，渐进式发布     |
| 模型兼容性问题   | 低   | 中   | 多模型测试，保留回滚方案     |
| 性能优化不达预期 | 低   | 高   | 设定明确的性能指标，持续监控 |
| 用户学习成本     | 中   | 低   | 提供清晰的使用文档和默认配置 |
