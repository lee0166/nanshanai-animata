# 🎬 剧本解析-物品提取优化方案（分阶段实施）

> ⚠️ **重要提示：此文档为关键待办事项，优化完成并验收前不可删除！**
> 
> 📅 创建日期：2026-03-16
> 🎯 状态：待开发（P0优先级）
> 👤 负责人：待分配
> ✅ 验收标准：见各阶段验收标准
> 📊 实施策略：**分阶段渐进式优化**

---

## 📋 目录

1. [总体实施策略](#一总体实施策略)
2. [Phase 1: 基础版（快速可用）](#二phase-1基础版快速可用)
3. [Phase 2: 增强版（质量提升）](#三phase-2增强版质量提升)
4. [Phase 3: 完整版（专业级）](#四phase-3完整版专业级)
5. [各阶段对比](#五各阶段对比)
6. [决策记录](#六决策记录)
7. [附录](#七附录)

---

## 一、总体实施策略

### 1.1 分阶段路线图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        分阶段实施路线图                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  当前状态                                                                 │
│  └── 提取率: ~10%                                                        │
│      └── 仅Ultra-Short路径工作                                            │
│                                                                         │
│      ↓ 1-2天                                                             │
│                                                                         │
│  Phase 1: 基础版 ✅ 目标: 让功能"可用"                                    │
│  ├── 提取率: ~70-80%                                                     │
│  ├── 增加耗时: +15秒                                                     │
│  ├── 代码改动: ~100行                                                    │
│  └── 风险: 极低（复用现有机制）                                           │
│                                                                         │
│      ↓ 稳定运行1-2周后                                                    │
│                                                                         │
│  Phase 2: 增强版 ✅ 目标: 让功能"好用"                                    │
│  ├── 提取率: ~85-90%                                                     │
│  ├── 增加耗时: +25秒                                                     │
│  ├── 代码改动: ~300行                                                    │
│  └── 新增: 验证层、缓存机制                                               │
│                                                                         │
│      ↓ 稳定运行2-4周后                                                    │
│                                                                         │
│  Phase 3: 完整版 ✅ 目标: 让功能"专业"                                    │
│  ├── 提取率: >95%                                                        │
│  ├── 增加耗时: +35秒                                                     │
│  ├── 代码改动: ~1000行                                                   │
│  └── 新增: 行业标准分类、多维度评分、场景绑定                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心原则

| 原则 | 说明 |
|------|------|
| **渐进式交付** | 每个Phase独立可用，不依赖后续Phase |
| **风险可控** | 每个Phase都有完整的降级策略 |
| **快速验证** | 每个Phase都有明确的验收标准 |
| **平滑升级** | 后续Phase在前一Phase基础上增量开发 |
| **随时回滚** | 每个Phase都有回滚方案 |

### 1.3 升级触发条件

| 从 | 到 | 触发条件 |
|----|----|---------|
| Phase 1 | Phase 2 | 基础版稳定运行1-2周，提取率达到70% |
| Phase 2 | Phase 3 | 增强版稳定运行2-4周，用户反馈良好 |

---

## 二、Phase 1: 基础版（快速可用）

### 2.1 目标

- **核心目标**：让物品提取功能从"不可用"变为"可用"
- **提取率目标**：70-80%
- **时间目标**：1-2天完成
- **风险目标**：零风险（完全复用现有机制）

### 2.2 方案设计

#### 2.2.1 核心策略

```
轻量级Prompt + 30秒超时 + 降级到空数组
```

#### 2.2.2 轻量级Prompt（约400 tokens）

```typescript
// services/scriptParser.ts
// 在现有 prompts 对象中添加

itemsBatchLightweight: `
请基于以下剧本内容，提取重要道具/物品。

【剧本内容】
{content}

【提取要求】
1. 只提取对剧情有明显作用的道具（武器、工具、饰品、文档、生物等）
2. 普通物品（桌椅、衣服等）不需要提取
3. 每个道具包含：名称、描述、分类、所属角色（如有）

【输出格式】
[
  {
    "name": "道具名称",
    "description": "简短描述，30字以内",
    "category": "weapon/tool/jewelry/document/creature/animal/other",
    "owner": "所属角色名（可选）"
  }
]

【重要提示】
- 必须返回JSON数组，即使没有道具也返回空数组[]
- 限时任务，请在简洁和完整之间平衡
`,
```

#### 2.2.3 核心提取函数（约50行）

```typescript
// services/scriptParser.ts
// 添加在现有extractAllCharactersWithContext之后

/**
 * Phase 1: 轻量级道具提取
 * 在现有超时机制内完成，失败时返回空数组不阻断流程
 */
private async extractItemsLightweight(
  content: string,
  characters: ScriptCharacter[],
  timeout: number = 30000 // 30秒独立超时
): Promise<ScriptItem[]> {
  const startTime = Date.now();
  
  try {
    // 使用轻量级Prompt
    const prompt = this.prompts.itemsBatchLightweight.replace('{content}', content);
    
    // 复用现有API调用机制（带超时控制）
    const response = await this.callLLMWithTimeout(prompt, { timeout });
    
    // 解析JSON
    const items = this.parseJsonSafely(response, []);
    
    // 简单后处理
    return items.map((item: any, index: number) => ({
      id: crypto.randomUUID(),
      name: item.name || `道具${index + 1}`,
      description: item.description || '',
      category: item.category || 'other',
      owner: item.owner || '',
      importance: 'minor', // 简化：只分major/minor
      visualPrompt: item.description || '',
    }));
    
  } catch (error) {
    console.warn('[ScriptParser] Items extraction failed or timeout:', error);
    // 降级策略：返回空数组，不阻断流程
    return [];
  }
}

/**
 * 带超时的LLM调用（复用现有机制）
 */
private async callLLMWithTimeout(
  prompt: string, 
  options: { timeout: number }
): Promise<string> {
  return Promise.race([
    this.callLLM(prompt),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), options.timeout)
    )
  ]);
}
```

#### 2.2.4 集成到解析路径（约30行）

```typescript
// 在parseShortScript, parseShortScriptOptimized, parseChunkedScript, parseScript中
// 在提取scenes之后，生成分镜之前添加：

// Step X: 轻量级道具提取（Phase 1新增）
try {
  onProgress?.('items', 55, '正在提取道具...');
  
  // 使用30秒超时，确保在整体60-90秒超时范围内
  state.items = await this.extractItemsLightweight(
    content,
    state.characters || [],
    30000 // 30秒超时，快速失败
  );
  
  console.log(`[ScriptParser] Extracted ${state.items.length} items`);
} catch (e) {
  // 降级：任何错误都不阻断流程
  console.warn('[ScriptParser] Items extraction skipped:', e);
  state.items = [];
}
```

### 2.3 实施步骤

#### Day 1: 核心实现（4-6小时）

| 时间 | 任务 | 产出 |
|------|------|------|
| 0.5h | 添加轻量级Prompt | `itemsBatchLightweight` |
| 2h | 实现提取函数 | `extractItemsLightweight()` |
| 2h | 集成到4个解析路径 | 修改4个parse函数 |
| 1-2h | 本地测试 | 测试通过 |

#### Day 2: 验证优化（2-4小时）

| 时间 | 任务 | 产出 |
|------|------|------|
| 2h | 准确率测试 | 测试报告 |
| 1h | 性能测试 | 性能报告 |
| 1h | 代码审查 | 审查通过 |

### 2.4 验收标准

| 验收项 | 标准 | 测试方法 |
|-------|------|---------|
| 道具提取率 | >70% | 10个测试剧本统计 |
| 关键道具识别率 | >80% | 人工标注对比 |
| 解析流程稳定性 | 100%通过 | 100次解析无阻断 |
| 超时合规性 | <30秒 | 监控提取耗时 |
| 降级成功率 | 100% | 模拟失败场景 |
| 代码改动量 | <100行 | 代码审查 |

### 2.5 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 提取率不达70% | 中 | 中 | 快速迭代Prompt，1小时内调整 |
| 超时影响整体流程 | 低 | 高 | 30秒独立超时，已预留缓冲 |
| 与现有降级冲突 | 低 | 中 | 完全复用现有机制 |

### 2.6 回滚方案

```typescript
// 如需回滚，只需注释掉以下代码块：

// Phase 1: 轻量级道具提取（注释即回滚）
// try {
//   onProgress?.('items', 55, '正在提取道具...');
//   state.items = await this.extractItemsLightweight(...);
// } catch (e) {
//   state.items = [];
// }

// 回滚后行为：state.items保持undefined，前端显示空列表
```

---

## 三、Phase 2: 增强版（质量提升）

### 3.1 目标

- **核心目标**：提升提取质量和稳定性
- **提取率目标**：85-90%
- **时间目标**：3-5天完成
- **前提条件**：Phase 1稳定运行1-2周

### 3.2 相比Phase 1的增强点

```
Phase 1: 轻量级提取 ──→ Phase 2: 增强提取
├── Prompt: 400 tokens  ├── Prompt: 800 tokens（增加上下文）
├── 超时: 30秒          ├── 超时: 45秒（增加验证时间）
├── 无验证              ├── 基础验证层（完整性检查）
├── 无缓存              ├── 简单缓存机制
└── 提取率: 70-80%      └── 提取率: 85-90%
```

### 3.3 方案设计

#### 3.3.1 增强Prompt（约800 tokens）

```typescript
itemsBatchEnhanced: `
请基于以下剧本内容，提取所有重要道具/物品。

【剧本内容】
{content}

【已识别角色】（供参考）
{characterList}

【提取要求】
1. 提取所有对剧情有作用的道具，包括：
   - 明确提到的道具（如"他掏出一把钥匙"）
   - 暗示存在的道具（如"她打开车门"→车钥匙）
   - 角色标志性物品
2. 不要提取普通物品（桌椅、衣服等）
3. 每个道具包含：名称、描述、分类、所属角色、重要性

【输出格式】
[
  {
    "name": "道具名称",
    "description": "描述，50字以内",
    "category": "weapon/tool/jewelry/document/creature/animal/other",
    "owner": "所属角色名",
    "importance": "major/minor"
  }
]

【自检清单】
- [ ] 是否遗漏了剧情关键道具？
- [ ] 是否包含了角色标志性物品？
`,
```

#### 3.3.2 基础验证层

```typescript
// Phase 2: 基础验证
interface ItemValidationResult {
  valid: boolean;
  issues: string[];
  retryRecommended: boolean;
}

private validateExtractedItems(
  script: string,
  items: ScriptItem[]
): ItemValidationResult {
  const issues: string[] = [];
  
  // 检查1：是否为空（可能遗漏）
  if (items.length === 0) {
    // 检查剧本长度，长剧本应该有道具
    if (script.length > 1000) {
      issues.push('长剧本但未提取到道具，可能遗漏');
    }
  }
  
  // 检查2：关键道具指标
  const hasMajorItems = items.some(i => i.importance === 'major');
  if (!hasMajorItems && script.length > 2000) {
    issues.push('未识别到重要道具，建议重试');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    retryRecommended: issues.length > 0 && items.length < 3
  };
}
```

#### 3.3.3 简单缓存机制

```typescript
// Phase 2: 简单缓存
interface ItemExtractionCache {
  scriptHash: string;
  itemCount: number;
  items: ScriptItem[];
  timestamp: number;
}

private itemCache: Map<string, ItemExtractionCache> = new Map();

private async extractItemsWithCache(
  content: string,
  characters: ScriptCharacter[]
): Promise<ScriptItem[]> {
  const hash = this.simpleHash(content);
  const cached = this.itemCache.get(hash);
  
  // 缓存有效（24小时内）
  if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
    console.log('[ScriptParser] Using cached items:', cached.itemCount);
    return cached.items;
  }
  
  // 提取并缓存
  const items = await this.extractItemsEnhanced(content, characters);
  this.itemCache.set(hash, {
    scriptHash: hash,
    itemCount: items.length,
    items,
    timestamp: Date.now()
  });
  
  return items;
}
```

### 3.4 实施步骤

#### Week 1: 核心增强（3-4天）

| 天数 | 任务 | 产出 |
|------|------|------|
| Day 1 | 升级Prompt | `itemsBatchEnhanced` |
| Day 2 | 实现验证层 | `validateExtractedItems()` |
| Day 3 | 实现缓存机制 | `extractItemsWithCache()` |
| Day 4 | 集成测试 | 测试通过 |

#### Week 2: 验证优化（2-3天）

| 天数 | 任务 | 产出 |
|------|------|------|
| Day 5-6 | 准确率测试 | 提取率>85% |
| Day 7 | 性能优化 | 耗时<45秒 |

### 3.5 验收标准

| 验收项 | 标准 | 对比Phase 1 |
|-------|------|------------|
| 道具提取率 | >85% | +15% |
| 关键道具识别率 | >90% | +10% |
| 平均耗时 | <45秒 | +15秒 |
| 缓存命中率 | >50% | 新增 |
| 重试成功率 | >80% | 新增 |

---

## 四、Phase 3: 完整版（专业级）

### 4.1 目标

- **核心目标**：达到影视行业标准的专业级道具提取
- **提取率目标**：>95%
- **时间目标**：8-12天完成
- **前提条件**：Phase 2稳定运行2-4周

### 4.2 相比Phase 2的增强点

```
Phase 2: 增强提取 ──→ Phase 3: 专业级提取
├── 分类: 7个         ├── 分类: 20+行业标准分类
├── 重要性: 二分类     ├── 重要性: 0-100分量化评分
├── 描述: 简单         ├── 描述: 分层（brief/detailed/visual/narrative）
├── 无场景关联         ├── 场景绑定（关联到具体场景）
├── 基础验证           ├── 完整质量门（4维度验证）
├── 简单缓存           ├── 智能缓存（LRU + 失效策略）
└── 提取率: 85-90%     └── 提取率: >95%
```

### 4.3 方案设计（完整版）

#### 4.3.1 行业标准分类体系

```typescript
// Phase 3: 行业标准分类
export enum PropCategory {
  // Hero Props
  HERO_WEAPON = 'hero_weapon',
  HERO_TOOL = 'hero_tool',
  HERO_ARTIFACT = 'hero_artifact',
  HERO_DOCUMENT = 'hero_document',
  
  // Set Dressing
  FURNITURE = 'furniture',
  DECORATION = 'decoration',
  APPLIANCE = 'appliance',
  VEHICLE = 'vehicle',
  
  // Hand Props
  HAND_WEAPON = 'hand_weapon',
  HAND_TOOL = 'hand_tool',
  PERSONAL_ITEM = 'personal_item',
  
  // Costume
  JEWELRY = 'jewelry',
  ACCESSORY = 'accessory',
  
  // Living
  CREATURE = 'creature',
  ANIMAL = 'animal',
  PLANT = 'plant',
  
  // Special
  SFX_PROP = 'sfx_prop',
  CGI_ELEMENT = 'cgi_element',
  
  OTHER = 'other',
}
```

#### 4.3.2 多维度重要性评分

```typescript
// Phase 3: 多维度评分
export interface PropImportanceScore {
  plotNecessity: number;      // 剧情必要性 (0-25)
  frequency: number;          // 出现频率 (0-25)
  visualProminence: number;   // 视觉突出度 (0-25)
  characterAssociation: number; // 角色关联度 (0-25)
  total: number;              // 总分 (0-100)
}

export type PropImportanceLevel = 'critical' | 'major' | 'supporting' | 'background';
```

#### 4.3.3 完整Schema（见原文档）

包含：
- 分层描述（brief/detailed/visual/narrative）
- 视觉属性（era/material/color/condition/size）
- 场景关联（sceneIds/firstAppearance）
- 剧本引用（scriptReferences）
- 生图提示词（generatedPrompts）

#### 4.3.4 完整质量门

```typescript
// Phase 3: 完整质量门
export const propExtractionQualityGate: QualityGate = {
  stage: 'prop-extraction',
  criteria: [
    { metric: 'coverage', threshold: 0.9, operator: '>=' },
    { metric: 'heroPropsIdentified', threshold: 0.95, operator: '>=' },
    { metric: 'classificationValidity', threshold: 0.95, operator: '>=' },
    { metric: 'descriptionCompleteness', threshold: 0.9, operator: '>=' }
  ],
  onFailure: 'retry',
  maxRetries: 3
};
```

### 4.4 实施步骤

#### Week 1-2: 核心重构（6-8天）

| 天数 | 任务 | 产出 |
|------|------|------|
| Day 1-2 | 新分类体系 | 更新Schema和类型定义 |
| Day 3-4 | 道具理解框架 | 实现PUF核心模块 |
| Day 5-6 | 多维度评分 | 实现ImportanceEvaluator |
| Day 7-8 | 场景绑定 | 实现SceneBinder |

#### Week 3: 验证优化（3-4天）

| 天数 | 任务 | 产出 |
|------|------|------|
| Day 9-10 | 完整质量门 | 实现4维度验证 |
| Day 11 | 智能缓存 | LRU + 失效策略 |
| Day 12 | 集成测试 | 全路径测试通过 |

### 4.5 验收标准

| 验收项 | 标准 | 对比Phase 2 |
|-------|------|------------|
| 道具提取率 | >95% | +10% |
| 关键道具识别率 | >98% | +8% |
| 分类准确率 | >90% | 新增 |
| 场景关联准确率 | >95% | 新增 |
| 描述完整性 | >95% | 新增 |

---

## 五、各阶段对比

### 5.1 功能对比

| 功能 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| **提取率** | 70-80% | 85-90% | >95% |
| **关键道具识别率** | 80% | 90% | >98% |
| **分类体系** | 7分类 | 7分类 | 20+行业标准分类 |
| **重要性评分** | 二分类 | 二分类 | 0-100分量化 |
| **分层描述** | ❌ | ❌ | ✅ |
| **场景绑定** | ❌ | ❌ | ✅ |
| **验证层** | ❌ 降级 | 基础验证 | 完整质量门 |
| **缓存机制** | ❌ | 简单缓存 | 智能缓存 |
| **Prompt长度** | 400 tokens | 800 tokens | 2500 tokens |

### 5.2 性能对比

| 指标 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| **增加耗时** | +15秒 | +25秒 | +35秒 |
| **API调用次数** | +1次 | +1次 | +1-2次 |
| **单次成本增加** | ~$0.01 | ~$0.02 | ~$0.04 |
| **超时设置** | 30秒 | 45秒 | 60秒 |
| **降级策略** | 空数组 | 空数组/重试 | 多级降级 |

### 5.3 实施对比

| 指标 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| **开发时间** | 1-2天 | 3-5天 | 8-12天 |
| **代码改动量** | ~100行 | ~300行 | ~1000行 |
| **风险等级** | 极低 | 低 | 中 |
| **回滚难度** | 极易 | 容易 | 中等 |
| **前置条件** | 无 | Phase 1稳定1-2周 | Phase 2稳定2-4周 |

### 5.4 决策矩阵

| 场景 | 推荐Phase | 原因 |
|------|----------|------|
| 时间紧急，需快速上线 | Phase 1 | 1-2天完成，零风险 |
| 资源有限，需控制成本 | Phase 1 | 最小投入，最大收益 |
| 追求稳定，逐步迭代 | Phase 1 → 2 → 3 | 渐进式升级，风险可控 |
| 质量要求高，时间充裕 | Phase 3 | 一步到位，专业级 |
| 已上线，需优化 | Phase 2/3 | 基于现有基础升级 |

---

## 六、决策记录

### 6.1 分阶段策略决策

| 决策点 | 选择 | 原因 |
|-------|------|------|
| **实施策略** | 分阶段渐进式 | 降低风险，快速验证，平滑升级 |
| **Phase 1目标** | 让功能"可用" | 解决90%问题，最小投入 |
| **Phase 2目标** | 让功能"好用" | 提升质量，增加稳定性 |
| **Phase 3目标** | 让功能"专业" | 达到行业标准，完整功能 |
| **升级触发** | 稳定运行+指标达标 | 数据驱动，避免盲目升级 |

### 6.2 各阶段关键决策

#### Phase 1决策

| 决策点 | 选择 | 原因 |
|-------|------|------|
| Prompt复杂度 | 轻量级（400 tokens） | 30秒内完成，保证稳定性 |
| 超时设置 | 30秒独立超时 | 比整体超时早，确保降级空间 |
| 验证层 | 不复用，直接降级 | 最小改动，零风险 |
| 缓存 | 不实现 | 简化实现，后续升级添加 |
| 分类体系 | 保持现有7分类 | 不引入新复杂性 |

#### Phase 2决策

| 决策点 | 选择 | 原因 |
|-------|------|------|
| Prompt增强 | 增加上下文（800 tokens） | 提升准确率，不超时 |
| 验证层 | 基础验证（2-3检查点） | 识别明显问题，触发重试 |
| 缓存 | 简单Map缓存 | 减少重复调用，提升性能 |
| 重试机制 | 1次重试 | 平衡质量和耗时 |

#### Phase 3决策

| 决策点 | 选择 | 原因 |
|-------|------|------|
| 分类体系 | 20+行业标准分类 | 与制片流程对齐 |
| 重要性评分 | 0-100分量化 | 精确排序和筛选 |
| 验证层 | 完整质量门（4维度） | 确保产出质量 |
| 缓存 | LRU + 失效策略 | 智能管理，长期优化 |

---

## 七、附录

### 7.1 各阶段代码变更清单

#### Phase 1变更清单

| 文件 | 变更类型 | 行数 | 说明 |
|------|---------|------|------|
| `services/scriptParser.ts` | 修改 | ~80行 | 添加轻量级Prompt和提取函数 |
| `types.ts` | 无需修改 | 0 | 复用现有类型 |
| `ParsingSchemas.ts` | 无需修改 | 0 | 复用现有Schema |

#### Phase 2变更清单

| 文件 | 变更类型 | 行数 | 说明 |
|------|---------|------|------|
| `services/scriptParser.ts` | 修改 | ~100行 | 升级Prompt，添加验证和缓存 |
| `services/parsing/ItemValidator.ts` | 新建 | ~80行 | 基础验证层 |
| `services/parsing/ItemCache.ts` | 新建 | ~60行 | 简单缓存实现 |

#### Phase 3变更清单

| 文件 | 变更类型 | 行数 | 说明 |
|------|---------|------|------|
| `types.ts` | 修改 | ~100行 | 更新ScriptItem接口 |
| `services/parsing/ParsingSchemas.ts` | 修改 | ~150行 | 新Schema定义 |
| `services/parsing/PropUnderstandingFramework.ts` | 新建 | ~400行 | PUF核心实现 |
| `services/parsing/QualityGate.ts` | 修改 | ~100行 | 完整质量门 |
| `services/scriptParser.ts` | 修改 | ~200行 | 集成完整版 |
| `components/ScriptParser/ItemMapping.tsx` | 修改 | ~50行 | 适配新数据结构 |

### 7.2 升级检查清单

#### Phase 1 → Phase 2升级检查

- [ ] Phase 1稳定运行1-2周
- [ ] 提取率达到70%以上
- [ ] 无重大bug报告
- [ ] 性能监控正常
- [ ] 团队评估通过

#### Phase 2 → Phase 3升级检查

- [ ] Phase 2稳定运行2-4周
- [ ] 提取率达到85%以上
- [ ] 用户反馈良好
- [ ] 性能指标达标
- [ ] 资源（时间/人力）充足

### 7.3 回滚方案

#### Phase 1回滚

```bash
# 方法1：注释代码（1分钟）
# 注释掉extractItemsLightweight调用块

# 方法2：Git回滚（如果已提交）
git revert <commit-hash>
```

#### Phase 2回滚

```bash
# 回滚到Phase 1版本
git checkout <phase1-commit-hash>

# 或切换功能开关
const ENABLE_PHASE_2 = false; // 切换为false即回滚
```

#### Phase 3回滚

```bash
# 回滚到Phase 2版本
git checkout <phase2-commit-hash>

# 或降级到简化模式
const PROP_EXTRACTION_MODE = 'phase2'; // 'phase3' | 'phase2' | 'phase1'
```

### 7.4 监控指标

#### 各阶段需要监控的指标

| 指标 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| 提取率 | ✅ | ✅ | ✅ |
| 耗时 | ✅ | ✅ | ✅ |
| 超时率 | ✅ | ✅ | ✅ |
| 降级率 | ✅ | ✅ | ✅ |
| 缓存命中率 | ❌ | ✅ | ✅ |
| 重试成功率 | ❌ | ✅ | ✅ |
| 分类准确率 | ❌ | ❌ | ✅ |
| 场景关联准确率 | ❌ | ❌ | ✅ |

---

## ⚠️ 删除条件

**此文档在以下条件满足后方可删除：**

1. ✅ Phase 1已完成并稳定运行
2. ✅ Phase 2已完成并稳定运行（如计划实施）
3. ✅ Phase 3已完成并稳定运行（如计划实施）
4. ✅ 所有验收标准达标
5. ✅ 生产环境稳定运行30天
6. ✅ 相关技术文档已更新
7. ✅ 团队内部知识转移完成

**在满足以上条件前，此文档为关键项目文档，不可删除！**

---

*本文档最后更新：2026-03-16*
*文档版本：v2.0（分阶段实施版）*
*文档状态：待开发（P0优先级）*
