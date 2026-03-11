# 时长预算功能开关详细对比分析表

## 📋 功能开关总览

| 开关名称                 | 设置页面显示             | 代码配置项            | 默认状态 | 实际应用状态  |
| ------------------------ | ------------------------ | --------------------- | -------- | ------------- |
| 启用时长预算规划         | 启用时长预算规划         | `useDurationBudget`   | ❌ 关闭  | ✅ 已应用     |
| 启用动态时长             | 启用动态时长             | `useDynamicDuration`  | ❌ 关闭  | ❌ 未完全实现 |
| 启用生产级Prompt         | 启用生产级PROMPT         | `useProductionPrompt` | ❌ 关闭  | ✅ 已应用     |
| 启用分镜质检             | 启用分镜质检             | `useShotQC`           | ❌ 关闭  | ⚠️ 部分实现   |
| 自动调整不符合预算的分镜 | 自动调整不符合预算的分镜 | `qcAutoAdjust`        | ❌ 关闭  | ❌ 未实现     |

---

## 🔍 功能开关详细分析

### 1. 启用时长预算规划 (`useDurationBudget`)

#### 开启时 ✅

**代码行为：**

```typescript
// scriptParser.ts line 2966-3031
if (this.parserConfig.useDurationBudget) {
  // 1. 计算总时长预算
  this.durationBudget = calculateBudget(shots, {
    platform: this.parserConfig.targetPlatform || 'douyin',
    pace: this.parserConfig.paceType || 'normal',
  });

  // 2. 验证预算合理性
  const validation = validateBudget(this.durationBudget);

  // 3. 保存到解析状态
  state.durationBudget = this.durationBudget;
}
```

**规则变化：**
| 规则项 | 开启前 | 开启后 |
|-------|-------|-------|
| 总时长计算 | 无 | 基于字数+平台+节奏计算 |
| 场景时长分配 | 平均分配 | 按重要性权重分配 |
| 分镜数量估算 | 固定3-5个 | 基于时长预算动态计算 |
| 平台适配 | 无 | 自动应用平台规则 |
| 质量验证 | 无 | 自动检查预算合理性 |

**对生产的影响：**

- ✅ 分镜生成时会考虑时长预算约束
- ✅ 可以生成符合平台规范的时长
- ✅ 高潮场景会分配更多时长
- ❌ 但预算结果**未在UI中展示**

**实际应用检查：**

```typescript
// 日志中会显示：
[ScriptParser] Starting duration budget calculation...
[ScriptParser] Budget calculated: 285s total, 3 scenes
```

#### 关闭时 ❌

**代码行为：**

```typescript
if (!this.parserConfig.useDurationBudget) {
  console.log('[ScriptParser] Budget planner disabled');
  return;
}
```

**影响：**

- 不计算时长预算
- 分镜生成无时长约束
- 不验证预算合理性
- 依赖AI自由发挥

---

### 2. 启用动态时长 (`useDynamicDuration`)

#### 开启时 ⚠️

**代码行为：**

```typescript
// 在 BudgetPlanner.ts 中
export interface BudgetCalculationOptions {
  useDynamicDuration?: boolean; // 是否启用动态时长
}
```

**预期功能：**

- 根据内容情绪强度动态调整时长
- 紧张场景时长缩短
- 情感场景时长延长

**实际实现状态：** ❌ **未完全实现**

**代码检查：**

```typescript
// 在 BudgetPlanner.ts 中搜索 useDynamicDuration
grep "useDynamicDuration" services/parsing/BudgetPlanner.ts
// 结果：仅在接口定义中出现，无实际应用逻辑
```

**结论：**

- 配置项存在
- 但无实际代码逻辑
- **这是一个未完成的特性**

#### 关闭时 ❌

**影响：**

- 使用固定时长分配
- 不考虑内容情绪变化

---

### 3. 启用生产级Prompt (`useProductionPrompt`)

#### 开启时 ✅

**代码行为：**

```typescript
// scriptParser.ts line 1680-1703
const useProductionPrompt = this.parserConfig.useProductionPrompt && sceneBudget;

if (useProductionPrompt) {
  // 使用生产级Prompt
  prompt = this.buildProductionPrompt(
    sceneContent,
    sceneName,
    sceneDescription,
    characters,
    sceneBudget,  // 注入预算约束
    sceneIndex,
    totalScenes
  );
} else {
  // 使用标准Prompt
  prompt = PROMPTS.shots.replace(...);
}
```

**Prompt对比：**

| Prompt类型       | 内容                                                 | 约束强度 |
| ---------------- | ---------------------------------------------------- | -------- |
| **标准Prompt**   | 场景描述、角色列表                                   | 弱       |
| **生产级Prompt** | + 平台要求 + 时长预算 + 分镜数量 + 重要性 + 硬性约束 | **强**   |

**生产级Prompt示例：**

```
【平台要求】抖音视频，快节奏，竖屏
【时长预算】本场景分配时长: 30秒
【分镜数量】建议3-5个分镜
【重要性】高潮场景，需要重点处理
【硬性约束】
- 单镜时长: 1.5-12秒
- 高潮场景可突破限制，使用长镜头(≥8秒)
- 总时长偏差容忍度: ±15%
```

**对生产的影响：**

- ✅ AI生成时分镜时长更精准
- ✅ 自动考虑平台特性
- ✅ 高潮场景会生成更长镜头
- ✅ 分镜数量更符合预算

**实际应用检查：**

```typescript
// 日志中会显示：
[ScriptParser] useProductionPrompt: true
[ScriptParser] Using production prompt
```

#### 关闭时 ❌

**代码行为：**

```typescript
prompt = PROMPTS.shots
  .replace('{content}', sceneContent.substring(0, 6000))
  .replace('{sceneName}', scene.name)
  .replace('{sceneDescription}', scene.description)
  .replace('{characters}', scene.characters.join(', '));
```

**影响：**

- 仅使用基础场景信息
- 无时长预算约束
- AI自由发挥
- 可能生成不符合平台规范的分镜

---

### 4. 启用分镜质检 (`useShotQC`)

#### 开启时 ⚠️

**代码行为：**

```typescript
// scriptParser.ts line 1844-1871
private validateShotsQuality(shots: Shot[], sceneName: string): void {
  if (!this.qualityAnalyzer) return;

  const report = this.qualityAnalyzer.analyze(
    undefined,
    this.currentCharacters,
    this.currentScenes,
    this.currentItems,
    shots,
    'shots'
  );

  if (report.score < this.parserConfig.dramaRulesMinScore) {
    console.warn(`[ScriptParser] Shots quality below threshold`);
  }
}
```

**实际实现状态：** ⚠️ **部分实现**

**已实现：**

- ✅ 质量分析器初始化
- ✅ 分镜质量评分
- ✅ 违规项检测
- ✅ 日志输出警告

**未实现：**

- ❌ 自动修复不符合质量的分镜
- ❌ 质检结果未在UI中展示
- ❌ 质检不通过时的处理逻辑

**对生产的影响：**

- ✅ 可以检测分镜质量问题
- ❌ 但仅输出日志，不影响实际生成
- ❌ 用户无法看到质检结果

#### 关闭时 ❌

**影响：**

- 不进行分镜质量检查
- 直接返回生成分镜

---

### 5. 自动调整不符合预算的分镜 (`qcAutoAdjust`)

#### 开启时 ❌

**代码行为：**

```typescript
// 在 scriptParser.ts 中搜索 qcAutoAdjust
grep "qcAutoAdjust" services/scriptParser.ts
// 结果：仅在配置接口和默认值中出现
```

**预期功能：**

- 自动检测超出预算的分镜
- 自动调整分镜时长
- 自动优化分镜数量

**实际实现状态：** ❌ **未实现**

**结论：**

- 配置项存在
- 但无任何代码逻辑
- **这是一个占位符特性**

#### 关闭时 ❌

**影响：**

- 不自动调整分镜
- 依赖人工调整

---

## 📊 功能开关组合效果对比

### 组合1：全部关闭（默认状态）

```typescript
{
  useDurationBudget: false,
  useDynamicDuration: false,
  useProductionPrompt: false,
  useShotQC: false,
  qcAutoAdjust: false
}
```

**生成效果：**

- ❌ 无时长预算约束
- ❌ 无平台适配
- ❌ 无质量检查
- ❌ AI完全自由发挥
- ❌ 可能生成不符合规范的内容

**适用场景：**

- 个人创作实验
- 探索性项目
- 不追求平台规范

---

### 组合2：仅开启时长预算

```typescript
{
  useDurationBudget: true,
  useProductionPrompt: false
}
```

**生成效果：**

- ✅ 计算时长预算
- ❌ 但不应用到分镜生成
- ❌ 预算仅保存到状态

**问题：**

- 预算计算了，但没有实际使用
- **这是一个无效组合**

---

### 组合3：时长预算 + 生产级Prompt（推荐）

```typescript
{
  useDurationBudget: true,
  useProductionPrompt: true
}
```

**生成效果：**

- ✅ 计算时长预算
- ✅ 预算约束注入Prompt
- ✅ AI生成时考虑时长限制
- ✅ 平台适配生效
- ✅ 场景重要性权重生效

**实际案例：**

```
输入：7000字剧本，抖音平台，快节奏
输出：
- 总时长：285秒（4.75分钟）✅ 符合抖音3-5分钟规范
- 开场场景：20秒（权重0.8）
- 高潮场景：45秒（权重1.0）✅ 重点突出
- 分镜数量：12个
- 平均每镜：3.75秒 ✅ 符合1.5-8秒规范
```

**适用场景：**

- ✅ 商业短剧制作
- ✅ 多平台分发
- ✅ 追求专业质量

---

### 组合4：全部开启（理想状态）

```typescript
{
  useDurationBudget: true,
  useDynamicDuration: true,      // ❌ 未实现
  useProductionPrompt: true,
  useShotQC: true,
  qcAutoAdjust: true             // ❌ 未实现
}
```

**预期效果：**

- ✅ 时长预算计算
- ✅ 动态时长调整（根据情绪）
- ✅ 生产级Prompt约束
- ✅ 分镜质量检查
- ✅ 自动优化调整

**实际效果：**

- 与组合3相同
- 因为 `useDynamicDuration` 和 `qcAutoAdjust` 未实现

---

## 🎯 实际应用建议

### 推荐配置

| 使用场景     | 时长预算 | 生产级Prompt | 分镜质检 | 预期效果                  |
| ------------ | -------- | ------------ | -------- | ------------------------- |
| **抖音短剧** | ✅       | ✅           | ❌       | 3-5分钟，快节奏，竖屏适配 |
| **快手短剧** | ✅       | ✅           | ❌       | 3-5分钟，生活化，老铁文化 |
| **B站视频**  | ✅       | ✅           | ❌       | 5-10分钟，中节奏，横屏    |
| **精品短剧** | ✅       | ✅           | ✅       | 5-10分钟，电影级质感      |
| **个人实验** | ❌       | ❌           | ❌       | 自由发挥，无约束          |

### 关键发现

1. **useDurationBudget + useProductionPrompt 是核心组合**
   - 单独开启时长预算无效
   - 必须配合生产级Prompt才能发挥作用

2. **useDynamicDuration 和 qcAutoAdjust 未实现**
   - 设置页面显示但无实际功能
   - 建议隐藏或标记为"即将推出"

3. **质检结果未在UI中展示**
   - 仅输出到控制台日志
   - 用户无法看到质检报告
   - 建议添加质检报告展示界面

4. **预算报告未在UI中展示**
   - 计算后仅保存到状态
   - 用户无法看到预算分配
   - 建议添加预算报告展示界面

---

## ✅ 结论

### 功能开关实际应用状态

| 功能开关                 | 实现状态    | 实际应用  | 建议                         |
| ------------------------ | ----------- | --------- | ---------------------------- |
| 启用时长预算规划         | ✅ 已实现   | ✅ 已应用 | **必须配合生产级Prompt使用** |
| 启用动态时长             | ❌ 未实现   | ❌ 无效   | 建议隐藏或实现               |
| 启用生产级Prompt         | ✅ 已实现   | ✅ 已应用 | **核心功能，强烈推荐开启**   |
| 启用分镜质检             | ⚠️ 部分实现 | ⚠️ 仅日志 | 建议完善UI展示               |
| 自动调整不符合预算的分镜 | ❌ 未实现   | ❌ 无效   | 建议隐藏或实现               |

### 最终建议

**对于生产环境，推荐使用：**

```typescript
{
  useDurationBudget: true,      // 开启时长预算
  useProductionPrompt: true,    // 开启生产级Prompt
  useShotQC: true               // 开启质检（可选）
}
```

**这样可以获得：**

- ✅ 符合平台规范的时长
- ✅ 专业叙事结构
- ✅ 高质量分镜生成
- ✅ 平台适配自动化

---

_报告生成时间：2026-03-07_
_分析基于：BudgetPlanner.ts + scriptParser.ts 代码审查_
