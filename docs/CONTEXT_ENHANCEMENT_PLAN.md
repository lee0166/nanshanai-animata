# 分层上下文增强方案实施计划

> **状态**: 待启动  
> **创建时间**: 2026-02-11  
> **预计工期**: 5.5天  
> **优先级**: 高  

---

## 一、方案概述

### 1.1 问题背景
当前小说解析存在**上下文丢失**问题：
- 角色分析只提取包含角色名的段落，缺少全局故事背景
- 场景分析只提取包含场景名的段落，缺少世界观信息
- 导致角色形象、场景氛围与原著不符，需要大量人工修正

### 1.2 解决方案
引入**分层上下文机制**：
1. **全局上下文提取**：先提取故事梗概、世界观、视觉风格、关键事件
2. **上下文传递**：将全局上下文传入每个角色/场景的分析过程
3. **增强Prompt**：在Prompt中增加【故事背景】章节

### 1.3 预期收益
- 角色一致性提升 40%
- 场景氛围准确度提升 35%
- 用户手动修改成本降低 50%

---

## 二、技术方案

### 2.1 架构变更

```
当前流程：
Metadata → Character/Scene (局部提取) → Shots

新流程：
Metadata → Context (全局提取) → Character/Scene (局部+全局) → Shots
```

### 2.2 类型定义扩展

```typescript
// types.ts 新增
export interface ScriptContext {
  summary: string;        // 故事梗概（300-500字）
  worldSetting: string;   // 世界观/时代背景（100字）
  visualStyle: string;    // 整体视觉风格（50字）
  keyEvents: string[];    // 关键事件时间线（5-10条）
}

// ScriptMetadata 扩展
export interface ScriptMetadata {
  // ... 原有字段
  context?: ScriptContext;  // 新增：全局上下文
}

// ScriptParseState 扩展
export interface ScriptParseState {
  // ... 原有字段
  context?: ScriptContext;  // 新增：保存上下文
}
```

### 2.3 Prompt模板变更

**角色分析Prompt变更：**

```diff
  请基于以下信息，分析角色"{characterName}"。

+ 【故事背景】
+ {context}
+
  【角色相关段落】
  {content}
```

**场景分析Prompt变更：**

```diff
  请基于以下信息，分析场景"{sceneName}"。

+ 【故事背景】
+ {context}
+
  【场景相关段落】
  {content}
```

---

## 三、实施步骤

### 阶段1：基础准备（0.5天）

#### 任务1.1：类型定义扩展
**文件**: `types.ts`
**内容**:
1. 新增 `ScriptContext` 接口
2. 修改 `ScriptMetadata` 添加 `context` 字段（可选）
3. 修改 `ScriptParseState` 添加 `context` 字段（可选）

**代码示例**:
```typescript
export interface ScriptContext {
  summary: string;
  worldSetting: string;
  visualStyle: string;
  keyEvents: string[];
}
```

#### 任务1.2：Feature Flag准备
**文件**: `services/scriptParser.ts`
**内容**: 添加开关控制
```typescript
const CONFIG = {
  // ... 原有配置
  enableContextEnhancement: true, // 功能开关
};
```

---

### 阶段2：核心实现（3天）

#### 任务2.1：上下文提取函数
**文件**: `services/scriptParser.ts`
**函数**: `extractContext(content: string): Promise<ScriptContext>`
**实现步骤**:
1. 创建新的Prompt模板 `PROMPTS.context`
2. 调用LLM提取全局信息
3. 解析并验证返回结果
4. 缓存结果

**Prompt设计**:
```typescript
const PROMPTS = {
  context: `
请快速阅读以下剧本/小说，提取全局上下文信息：

【剧本内容】
{content}

请提取：
1. 故事梗概（300字以内，包含主线剧情）
2. 世界观/时代背景（100字以内，如：古代修仙世界、赛博朋克未来都市）
3. 整体视觉风格（50字以内，如：唯美古风、暗黑哥特、明亮治愈）
4. 关键事件时间线（5-10条，格式：时间点 - 事件简述）

请严格按JSON格式输出：
{
  "summary": "故事梗概",
  "worldSetting": "世界观描述",
  "visualStyle": "视觉风格",
  "keyEvents": ["时间点1 - 事件1", "时间点2 - 事件2"]
}
`,
};
```

#### 任务2.2：修改角色解析
**文件**: `services/scriptParser.ts`
**函数**: `extractCharacter()`
**修改内容**:
1. 函数签名增加 `context` 参数
2. Prompt模板增加【故事背景】章节
3. 更新缓存key（包含context hash）

**代码变更**:
```typescript
// 原函数
async extractCharacter(content: string, characterName: string): Promise<ScriptCharacter>

// 新函数
async extractCharacter(
  content: string, 
  characterName: string, 
  context?: ScriptContext
): Promise<ScriptCharacter>
```

#### 任务2.3：修改场景解析
**文件**: `services/scriptParser.ts`
**函数**: `extractScene()`
**修改内容**: 同任务2.2

#### 任务2.4：修改批量解析
**文件**: `services/scriptParser.ts`
**函数**: `extractAllCharacters()`, `extractAllScenes()`
**修改内容**: 传递context参数到单个解析函数

#### 任务2.5：修改主流程
**文件**: `services/scriptParser.ts`
**函数**: `parseScript()`, `parseStage()`
**修改内容**:
1. 在metadata提取后，增加context提取阶段
2. 将context传递到后续阶段
3. 保存context到parseState

**流程变更**:
```typescript
// 新增阶段
if (!state.context) {
  state.context = await this.extractContext(content);
  await this.saveState(scriptId, projectId, state);
}

// 传递context
const character = await this.extractCharacter(
  content, 
  name, 
  state.context
);
```

---

### 阶段3：Prompt优化（1天）

#### 任务3.1：角色Prompt优化
**文件**: `services/scriptParser.ts`
**模板**: `PROMPTS.character`, `PROMPTS.charactersBatch`
**优化内容**:
1. 增加【故事背景】章节占位符
2. 强调结合世界观理解角色
3. 示例展示如何使用context

**示例**:
```typescript
const PROMPTS = {
  character: `
请基于以下信息，分析角色"{characterName}"。

【故事背景】
{context}

【角色相关段落】
{content}

请提取以下信息...

重要提示：
1. 结合故事背景理解角色服饰、身份的象征意义
2. 参考关键事件时间线，判断角色当前时期的状态
3. 依据视觉风格，保持描述的一致性
`,
};
```

#### 任务3.2：场景Prompt优化
**文件**: `services/scriptParser.ts`
**模板**: `PROMPTS.scene`, `PROMPTS.scenesBatch`
**优化内容**: 同任务3.1

---

### 阶段4：测试验证（1天）

#### 任务4.1：单元测试
**文件**: `services/scriptParser.test.ts`
**测试用例**:
1. 正常提取context
2. context解析失败回退
3. 带context的角色解析
4. 带context的场景解析
5. 缓存机制验证

#### 任务4.2：集成测试
**测试场景**:
1. 短篇故事（< 3000字）
2. 中篇小说（3万-10万字）
3. 长篇小说（> 10万字）
4. 多角色复杂关系
5. 时间跨度大的故事

#### 任务4.3：效果对比
**评估指标**:
1. 角色visualPrompt准确度（人工评分）
2. 场景visualPrompt准确度（人工评分）
3. 用户修改次数统计
4. API调用成本对比

---

## 四、文件变更清单

| 文件路径 | 变更类型 | 变更内容 | 优先级 |
|----------|----------|----------|--------|
| `types.ts` | 修改 | 新增ScriptContext，扩展Metadata和ParseState | 高 |
| `services/scriptParser.ts` | 修改 | 核心逻辑，新增extractContext，修改所有解析函数 | 高 |
| `services/scriptParser.test.ts` | 修改 | 新增测试用例 | 中 |

---

## 五、风险评估与缓解

### 5.1 高风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Token成本增加 | API费用上升15-20% | 1. 压缩context至300字<br>2. 复用context，只提取一次<br>3. 提供开关可关闭功能 |
| 解析时间延长 | 增加1个API调用 | 1. 异步处理<br>2. 显示进度<br>3. 可跳过context阶段 |

### 5.2 中风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Context质量不稳定 | 影响解析结果 | 1. 增加人工编辑入口<br>2. 提供context预览<br>3. 可手动修正context |
| 缓存失效 | 重复解析 | 修改缓存策略，context变化时更新缓存 |

### 5.3 低风险

- 类型兼容性：向后兼容，context为可选字段
- 存储兼容性：IndexedDB自动处理新字段
- 功能回滚：通过feature flag可随时关闭

---

## 六、回滚方案

### 6.1 快速回滚
```typescript
// services/scriptParser.ts
const CONFIG = {
  enableContextEnhancement: false, // 设为false立即回滚
};
```

### 6.2 数据回滚
- 旧数据无需处理（context字段为undefined）
- 新数据向下兼容（旧版本忽略context字段）

---

## 七、验收标准

### 7.1 功能验收
- [ ] 能正常提取全局context
- [ ] 角色解析能接收并使用context
- [ ] 场景解析能接收并使用context
- [ ] 解析结果保存包含context
- [ ] Feature flag能控制功能开关

### 7.2 效果验收
- [ ] 角色visualPrompt包含世界观信息
- [ ] 场景visualPrompt与整体风格一致
- [ ] 长文本（>10万字）解析质量提升
- [ ] 用户手动修改次数减少50%以上

### 7.3 性能验收
- [ ] 解析时间增加不超过30%
- [ ] API成本增加不超过20%
- [ ] 缓存命中率保持80%以上

---

## 八、后续优化方向

### 8.1 短期优化（1-2个月）
1. Context人工编辑功能
2. Context质量评分
3. 基于用户反馈优化Prompt

### 8.2 中期优化（3-6个月）
1. 角色时间线追踪（角色成长/变化）
2. 场景氛围一致性检查
3. 跨章节信息关联

### 8.3 长期优化（6-12个月）
1. 自动Context优化（基于用户修正学习）
2. 多小说对比分析（同世界观）
3. Context模板库（古装/现代/科幻等）

---

## 九、参考文档

- [原始分析文档](./CONTEXT_ANALYSIS.md)（如有）
- [Prompt工程最佳实践](./PROMPT_GUIDE.md)（如有）
- [LLM API文档](https://platform.openai.com/docs)

---

## 十、变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-02-11 | v1.0 | 初始版本 | AI Assistant |

---

**备注**: 本计划可随时调阅，实施前请确认项目当前状态和需求优先级。
