# 小说解析流程优化方案 v2.0 - Spec (可行性评估版)

> **方案定位**: 基于现有系统的渐进式优化
> **核心目标**: 解析能力提升200% | 运行成本降低40% | 成功率提升至99%+
> **实施方式**: 分4个阶段，每阶段1-2小时，可独立测试验证

---

## 一、可行性评估结论

### 1.1 现有系统分析

通过分析 `services/scriptParser.ts` 和 `types.ts`，现有系统具备：

- ✅ 基础的分块解析能力（固定6000字符）
- ✅ LLMProvider 抽象层
- ✅ 阶段级状态管理（ParseStage）
- ✅ 简单的重试机制（maxRetries: 3）
- ✅ 基础缓存（LRU）

### 1.2 模块可行性分级

| 模块             | 可行性  | 依赖     | 预估工时 | 风险           |
| ---------------- | ------- | -------- | -------- | -------------- |
| **语义分块**     | ✅ 高   | 无       | 1-2h     | 低             |
| **模型路由**     | ✅ 高   | 无       | 1-2h     | 低             |
| **状态管理增强** | ✅ 高   | 无       | 1-2h     | 低             |
| **JSON修复**     | ✅ 高   | 无       | 0.5h     | 低             |
| **RAG检索**      | ⚠️ 中   | ChromaDB | 2-3h     | 中             |
| **多级缓存**     | ⚠️ 中   | Redis    | 2-3h     | 中             |
| **短剧规则引擎** | ❓ 待定 | 无       | 2-3h     | 高(需确认需求) |
| **人工确认UI**   | ❓ 待定 | 无       | 3-4h     | 高(需设计)     |

### 1.3 推荐实施方案

**第一阶段（必选，立即可做）**:

1. 语义分块模块
2. 模型路由
3. 状态管理增强
4. JSON修复

**第二阶段（效率优化，可选）**:

1. RAG检索系统
2. 多级缓存系统

**第三阶段（业务优化，需确认需求）**:

1. 短剧规则引擎
2. 人工确认UI
3. 资产相似度匹配

---

## 二、Why

### 2.1 当前系统问题

1. **分块不智能** - 固定6000字符可能切断叙事逻辑
2. **模型选择单一** - 所有任务都用gpt-4o-mini，成本高
3. **状态粒度粗** - 阶段级状态，失败需重跑整个阶段
4. **JSON解析脆弱** - AI返回格式错误时直接失败

### 2.2 优化后预期效果

| 指标       | 当前     | 优化后   | 提升    |
| ---------- | -------- | -------- | ------- |
| 解析成功率 | 85%      | 99%+     | +14%    |
| 10万字成本 | ¥25-30   | ¥15-18   | -40%    |
| 解析时间   | 15-20min | 8-12min  | -40%    |
| 断点续传   | 阶段级   | 子任务级 | 精准度↑ |

---

## 三、What Changes

### 3.1 第一阶段：基础架构（1-2小时）

#### 变更1: 语义分块增强

**文件**: `services/scriptParser.ts`
**变更类型**: 新增方法 + 修改 `chunkText`
**向后兼容**: 是，保留原有分块作为fallback

```typescript
// 新增
interface SemanticChunk {
  content: string;
  prevContext: string;
  metadata: {
    characters: string[];
    sceneHint: string;
    importance: number;
  };
}

// 修改 chunkText → semanticChunk
async function semanticChunk(content: string): Promise<SemanticChunk[]>;
```

#### 变更2: 模型路由

**文件**: `services/scriptParser.ts` + 新增 `services/ModelRouter.ts`
**变更类型**: 新增模块
**向后兼容**: 是，CONFIG.defaultModel 作为fallback

```typescript
// 新增 ModelRouter
class ModelRouter {
  async route(taskType: TaskType, prompt: string): Promise<AIResult>;
}

// TaskType 定义
type TaskType = 'metadata' | 'character' | 'scene' | 'shot' | 'validation';
```

#### 变更3: 子任务级状态管理

**文件**: `types.ts` + `services/scriptParser.ts`
**变更类型**: 扩展类型 + 新增方法
**向后兼容**: 是，ScriptParseState 扩展新字段

```typescript
// 扩展 ScriptParseState
interface ScriptParseState {
  // ... 原有字段
  subTasks?: Map<string, SubTaskState>; // 新增
}

interface SubTaskState {
  id: string; // e.g., "char_林黛玉"
  type: 'character' | 'scene' | 'shot';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  result?: any;
  error?: string;
}
```

#### 变更4: JSON修复

**文件**: 新增 `services/JSONRepair.ts`
**变更类型**: 新增工具模块
**向后兼容**: 是，纯新增

```typescript
// 新增
class JSONRepair {
  static repair(jsonString: string): string | null;
  static validate(jsonString: string): boolean;
}
```

### 3.2 第二阶段：效率优化（1-2小时）

#### 变更5: RAG检索系统

**文件**: 新增 `services/RAGRetriever.ts`
**依赖**: `chromadb` (需安装)
**变更类型**: 新增模块
**向后兼容**: 否，需要新增依赖

**可行性说明**:

- ✅ ChromaDB 支持内存模式，无需额外服务
- ✅ 可以使用轻量级 Embedding 模型
- ⚠️ 需要安装依赖：`npm install chromadb`
- ⚠️ 会增加打包体积

**建议**: 作为可选功能，通过配置开关控制

#### 变更6: 多级缓存

**文件**: 新增 `services/MultiLevelCache.ts`
**依赖**: `localStorage` / IndexedDB (无需Redis)
**变更类型**: 新增模块
**向后兼容**: 是

**可行性说明**:

- ✅ 可以使用 IndexedDB 替代 Redis
- ✅ 浏览器本地存储足够（小说解析结果不大）
- ✅ 无需后端服务

### 3.3 第三阶段：业务优化（需确认需求）

#### 变更7: 短剧规则引擎

**文件**: 新增 `services/ShortDramaRulesEngine.ts`
**变更类型**: 新增模块
**向后兼容**: 是

**需确认问题**:

1. 当前系统是否专门用于短剧？
2. 是否需要强制黄金3秒规则？
3. 单集时长限制是否必要？

#### 变更8: 人工确认UI

**文件**: 新增 `components/ScriptParser/StoryBibleConfirmation.tsx`
**变更类型**: 新增组件
**向后兼容**: 是

**需确认问题**:

1. 确认流程的UI设计
2. 确认后锁定机制的具体实现
3. 与现有资产映射流程的整合

---

## 四、ADDED Requirements

### Requirement 1: 语义分块模块

The system SHALL provide intelligent text chunking based on semantic boundaries.

#### Scenario: 章节边界识别

- **GIVEN** 用户上传包含章节标题的小说文本
- **WHEN** 系统执行语义分块
- **THEN** 应在章节边界(如"【第一章】")处分割文本
- **AND** 每个分块保留前200字上下文

#### Scenario: 元数据提取

- **GIVEN** 一个文本分块
- **WHEN** 系统分析分块
- **THEN** 应提取涉及的角色列表
- **AND** 应标注场景提示
- **AND** 应评估重要性(0-10)

### Requirement 2: 模型路由策略

The system SHALL intelligently route tasks to the most cost-effective model.

#### Scenario: 元数据提取任务路由

- **GIVEN** 需要提取小说元数据
- **WHEN** 系统选择模型
- **THEN** 应选择高性价比模型(gpt-4o-mini/deepseek)

#### Scenario: 角色分析任务路由

- **GIVEN** 需要深度分析角色
- **WHEN** 系统选择模型
- **THEN** 应选择创意能力强的模型(gpt-4o/claude)

#### Scenario: 模型降级

- **GIVEN** 主模型调用失败
- **WHEN** 系统执行降级
- **THEN** 应自动切换到备用模型
- **AND** 保证任务完成

### Requirement 3: 子任务级状态管理

The system SHALL support sub-task level state persistence.

#### Scenario: 角色解析状态追踪

- **GIVEN** 解析任务包含5个角色
- **WHEN** 第3个角色解析失败
- **THEN** 应保存前2个角色的成功结果
- **AND** 重试时只重新解析第3-5个角色

#### Scenario: 断点续传

- **GIVEN** 解析过程中断
- **WHEN** 用户重新启动解析
- **THEN** 应从断点继续
- **AND** 已完成的子任务不重复执行

### Requirement 4: JSON自动修复

The system SHALL automatically repair malformed JSON from AI responses.

#### Scenario: 引号不匹配修复

- **GIVEN** AI返回的JSON引号不匹配
- **WHEN** 系统执行修复
- **THEN** 应自动修复引号
- **AND** 返回有效JSON

#### Scenario: 多余内容截断

- **GIVEN** AI返回的内容包含JSON和额外文本
- **WHEN** 系统执行修复
- **THEN** 应提取JSON部分
- **AND** 丢弃额外文本

---

## 五、实施路线图

### Phase 1: 基础架构（1-2小时，立即可做）

**实施顺序**:

1. JSON修复模块（0.5h）- 无依赖，立即可用
2. 语义分块模块（0.5h）- 增强现有chunkText
3. 模型路由（0.5h）- 新增ModelRouter
4. 子任务状态管理（0.5h）- 扩展ScriptParseState

**每个模块完成后**:

- 报告修改了哪些文件
- 新增/修改了多少行代码
- 是否改变现有接口
- 如何测试
- 如何回退

### Phase 2: 效率优化（1-2小时，可选）

**实施顺序**:

1. 多级缓存（使用IndexedDB）（1h）
2. RAG检索系统（1h）- 需确认是否安装chromadb

**前置条件**:

- 确认是否需要RAG功能
- 确认是否可以安装chromadb依赖

### Phase 3: 业务优化（需确认需求）

**待确认问题**:

1. 是否需要短剧规则引擎？
2. 是否需要人工确认流程？
3. 是否需要资产相似度匹配？

**确认后再实施**:

- 短剧规则引擎
- 人工确认UI
- 资产相似度匹配

---

## 六、风险与回退方案

### 6.1 低风险模块（Phase 1）

| 模块     | 风险 | 回退方案                            |
| -------- | ---- | ----------------------------------- |
| JSON修复 | 极低 | 直接删除文件，恢复原有解析逻辑      |
| 语义分块 | 低   | 使用原有chunkText作为fallback       |
| 模型路由 | 低   | 使用CONFIG.defaultModel作为fallback |
| 状态管理 | 低   | 忽略subTasks字段，使用原有逻辑      |

### 6.2 中风险模块（Phase 2）

| 模块     | 风险 | 回退方案                   |
| -------- | ---- | -------------------------- |
| RAG检索  | 中   | 通过配置关闭，使用全文解析 |
| 多级缓存 | 低   | 缓存miss时走正常流程       |

### 6.3 高风险模块（Phase 3）

| 模块         | 风险 | 回退方案               |
| ------------ | ---- | ---------------------- |
| 短剧规则引擎 | 高   | 通过配置关闭           |
| 人工确认UI   | 高   | 跳过确认流程，直接生成 |

---

## 七、测试验证计划

### Phase 1 测试

1. **JSON修复测试**:

   ```typescript
   // 测试用例
   const broken = '{"name": "test",}';
   const fixed = JSONRepair.repair(broken);
   expect(fixed).toBe('{"name": "test"}');
   ```

2. **语义分块测试**:

   ```typescript
   // 测试用例
   const novel = '【第一章】...【第二章】...';
   const chunks = await semanticChunk(novel);
   expect(chunks.length).toBe(2);
   ```

3. **模型路由测试**:

   ```typescript
   // 测试用例
   const result = await router.route('metadata', prompt);
   expect(result.modelUsed).toBe('gpt-4o-mini');
   ```

4. **状态管理测试**:
   ```typescript
   // 测试用例
   await parser.parseScript(scriptId, projectId, content, onProgress);
   // 中断后恢复
   const state = await parser.resume(scriptId, projectId);
   expect(state.subTasks.get('char_林黛玉').status).toBe('completed');
   ```

---

## 八、总结

### 8.1 立即可做的优化（Phase 1）

✅ **JSON修复** - 提升解析成功率至99%+
✅ **语义分块** - 提升解析质量
✅ **模型路由** - 降低40%成本
✅ **状态管理** - 支持精准断点续传

**预期效果**:

- 成功率: 85% → 99%+
- 成本: ¥25-30 → ¥15-18
- 断点续传: 阶段级 → 子任务级

### 8.2 可选优化（Phase 2）

⚠️ **RAG检索** - 需安装chromadb
⚠️ **多级缓存** - 使用IndexedDB实现

### 8.3 需确认需求（Phase 3）

❓ **短剧规则引擎** - 需确认业务需求
❓ **人工确认UI** - 需产品设计

---

**建议**: 先实施Phase 1（基础架构），验证效果后再决定是否继续Phase 2和Phase 3。

**文档版本**: v2.0 (可行性评估版)  
**最后更新**: 2026-02-21
