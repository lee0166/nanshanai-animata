# 时长预算功能深度分析报告

## 📋 执行摘要

经过对代码的深入分析，**时长预算功能不仅是一个"时长计算工具"，而是一个完整的"平台适配与内容规控系统"**。它的核心意义在于：

1. **平台规则引擎** - 将抖音/快手/B站/精品的不同平台规则编码为可执行逻辑
2. **内容质量控制器** - 通过时长分配确保叙事节奏符合专业标准
3. **Prompt增强器** - 将预算数据注入AI生成过程，指导分镜创作

---

## 🔍 代码层面的核心发现

### 1. 平台规则引擎（Platform Rule Engine）

**代码位置：** `BudgetPlanner.ts` line 147-252

```typescript
export const PLATFORM_CONFIGS: Record<PlatformType, PlatformConfig> = {
  douyin: {
    name: 'douyin',
    displayName: '抖音',
    paces: {
      fast: { minWordsPerMinute: 250, maxWordsPerMinute: 300, ... },
      normal: { minWordsPerMinute: 200, maxWordsPerMinute: 250, ... },
      slow: { minWordsPerMinute: 150, maxWordsPerMinute: 200, ... }
    },
    recommendedDurationRange: [180, 300], // 3-5分钟
    characteristics: ['竖屏为主', '快节奏', '黄金3秒', '完播率优先']
  },
  // ... 其他平台
};
```

**核心意义：**

- ✅ 将平台运营规则（如"抖音3-5分钟最佳"）编码为系统规则
- ✅ 不同平台有不同的字数/分钟比率（抖音280字/分钟 vs B站200字/分钟）
- ✅ 平台特性影响内容生成策略（竖屏/横屏、快节奏/慢节奏）

---

### 2. 叙事结构控制器（Narrative Structure Controller）

**代码位置：** `BudgetPlanner.ts` line 31-36, 258-279

```typescript
export const SCENE_IMPORTANCE_WEIGHTS: Record<SceneImportance, number> = {
  opening: 0.8, // 开场
  development: 0.6, // 发展
  climax: 1.0, // 高潮
  ending: 0.7, // 结尾
};

export function defaultImportanceMapper(sceneIndex: number, totalScenes: number): SceneImportance {
  const ratio = sceneIndex / totalScenes;
  if (ratio < 0.15)
    return 'opening'; // 前15%为开场
  else if (ratio >= 0.9)
    return 'ending'; // 最后10%为结尾
  else if (ratio >= 0.6 && ratio < 0.9)
    return 'climax'; // 60%-90%为高潮
  else return 'development'; // 15%-60%为发展
}
```

**核心意义：**

- ✅ 自动识别剧本结构（开场/发展/高潮/结尾）
- ✅ 高潮场景分配最高权重（1.0），确保重点突出
- ✅ 发展场景权重较低（0.6），避免拖沓
- ✅ 这是**专业编剧知识**的编码化

---

### 3. Prompt增强与AI指导（Prompt Enhancement）

**代码位置：** `scriptParser.ts` line 1803-1833

```typescript
// 获取平台显示名称
const platformMap: Record<string, string> = {
  douyin: '抖音（竖屏，快节奏）',
  kuaishou: '快手（竖屏，生活化）',
  bilibili: 'B站（横屏，多样化）',
  premium: '精品短剧（横屏，高质量）',
};

// 构建Prompt时注入预算信息
let prompt = PROMPTS.productionShots
  .replace('{targetPlatform}', targetPlatform)
  .replace('{totalDuration}', String(totalDuration))
  .replace('{sceneAllocatedDuration}', String(allocatedDuration))
  .replace('{recommendedShotCount}', String(sceneBudget.shotCount))
  .replace('{minShotDuration}', String(minShotDuration))
  .replace('{maxShotDuration}', String(maxShotDuration))
  .replace('{sceneImportance}', sceneImportance)
  .replace('{climaxRequirement}', climaxRequirement);
```

**核心意义：**

- ✅ **预算数据直接指导AI生成**
- ✅ AI知道："这是抖音视频，需要快节奏，这个场景分配了30秒"
- ✅ AI知道："这是高潮场景，需要长镜头和特殊处理"
- ✅ 从"盲目生成"升级为"目标导向生成"

---

### 4. 质量验证系统（Quality Validation）

**代码位置：** `BudgetPlanner.ts` line 511-558

```typescript
export function validateBudget(budget: DurationBudget): {
  valid: boolean;
  issues: string[];
  suggestions: string[];
} {
  // 检查7000字的目标范围
  if (budget.totalWordCount >= 6500 && budget.totalWordCount <= 7500) {
    if (budget.totalDuration < 210) {
      issues.push(`总时长 ${budget.totalDuration}秒 低于目标范围 210-300秒`);
    }
  }

  // 检查平均每镜时长
  if (budget.averageShotDuration < 1.5) {
    issues.push(`平均每镜时长过短，可能导致画面切换过快`);
  } else if (budget.averageShotDuration > 8) {
    issues.push(`平均每镜时长过长，可能导致节奏拖沓`);
  }

  // 检查高潮部分占比
  const climaxRatio = budget.climaxDuration / totalDuration;
  if (climaxRatio < 0.15) {
    suggestions.push('高潮部分占比偏低');
  } else if (climaxRatio > 0.4) {
    suggestions.push('高潮部分占比偏高');
  }
}
```

**核心意义：**

- ✅ 自动验证内容是否符合平台规范
- ✅ 检查专业标准（如"平均每镜1.5-8秒"）
- ✅ 提供优化建议（如"高潮占比偏低"）

---

### 5. 动态调整机制（Dynamic Adjustment）

**代码位置：** `scriptParser.ts` line 2360-2395

```typescript
// Get scene budget if available
const sceneBudget = this.durationBudget?.sceneBudgets.find(
  sb => sb.sceneName === scene.name
);

// 选择使用生产级Prompt或标准Prompt
const useProductionPrompt = this.parserConfig.useProductionPrompt && sceneBudget;

if (useProductionPrompt) {
  // 使用生产级Prompt（包含预算约束）
  prompt = this.buildProductionPrompt(
    sceneContent,
    scene.name,
    scene.description,
    scene.characters,
    sceneBudget,  // 注入预算数据
    sceneIndex,
    totalScenes
  );
} else {
  // 使用标准Prompt（无预算约束）
  prompt = PROMPTS.shots.replace(...);
}
```

**核心意义：**

- ✅ 预算数据**实时影响**分镜生成
- ✅ 不同场景可以有不同的时长约束
- ✅ 高潮场景可以突破常规时长限制

---

## 🎯 功能存在的真正意义

### 意义1：平台适配自动化

**问题：** 不同平台有不同的内容规范

- 抖音：3-5分钟，快节奏，竖屏
- B站：5-10分钟，中节奏，横屏
- 精品短剧：10-20分钟，慢节奏，电影质感

**解决方案：**

```typescript
// 自动选择平台规则
const budget = calculateBudget(shots, {
  platform: 'douyin', // 抖音规则
  pace: 'fast', // 快节奏
});
// 结果：7000字 → 210-300秒，280字/分钟
```

**价值：** 无需人工记忆平台规则，系统自动适配

---

### 意义2：叙事节奏控制

**问题：** AI生成的分镜可能节奏混乱

- 开场拖沓，高潮不足
- 场景时长分配不合理
- 缺乏专业编剧的"节奏感"

**解决方案：**

```typescript
// 场景重要性权重
const weights = {
  opening: 0.8, // 开场要短，快速入戏
  development: 0.6, // 发展可以快
  climax: 1.0, // 高潮要长，重点突出
  ending: 0.7, // 结尾适中
};

// 时长分配算法
const combinedRatio = weightRatio * 0.6 + wordRatio * 0.4;
const allocatedDuration = targetTotalDuration * combinedRatio;
```

**价值：** 自动应用专业编剧的叙事结构知识

---

### 意义3：AI生成质量提升

**问题：** AI生成内容时缺乏"目标感"

- 不知道视频总时长应该是多少
- 不知道每个场景应该占多长时间
- 不知道平台特性要求

**解决方案：**

```typescript
// Prompt中注入预算约束
prompt = `
【平台要求】抖音视频，快节奏，竖屏
【时长预算】本场景分配时长: 30秒
【分镜数量】建议3-5个分镜
【重要性】高潮场景，需要重点处理
【特殊要求】高潮场景可突破常规时长限制，使用长镜头
`;
```

**价值：** AI生成从"盲目"变为"目标导向"

---

### 意义4：内容质量保障

**问题：** 生成的内容可能不符合专业标准

- 平均每镜时长过短（<1.5秒）→ 画面切换过快
- 平均每镜时长过长（>8秒）→ 节奏拖沓
- 高潮占比过低（<15%）→ 缺乏重点

**解决方案：**

```typescript
// 自动验证
const validation = validateBudget(budget);
if (validation.issues.length > 0) {
  console.warn('预算验证警告:', validation.issues);
  // 如："高潮部分占比偏低，建议增加高潮场景时长分配"
}
```

**价值：** 自动检查并提示专业标准问题

---

## 📊 实际应用场景

### 场景1：抖音短剧制作

**配置：**

```typescript
{
  platform: 'douyin',
  pace: 'fast',
  useProductionPrompt: true
}
```

**效果：**

- 7000字 → 210-300秒（3.5-5分钟）
- 280字/分钟，快节奏
- 竖屏适配
- 黄金3秒开场要求

### 场景2：精品短剧制作

**配置：**

```typescript
{
  platform: 'premium',
  pace: 'slow',
  useProductionPrompt: true
}
```

**效果：**

- 7000字 → 300-600秒（5-10分钟）
- 150字/分钟，慢节奏
- 电影级质感
- 精细叙事

### 场景3：多平台适配

**同一剧本，不同平台：**

```typescript
// 抖音版本
const douyinBudget = calculateBudget(shots, { platform: 'douyin', pace: 'fast' });
// 结果：180秒，快节奏

// B站版本
const bilibiliBudget = calculateBudget(shots, { platform: 'bilibili', pace: 'normal' });
// 结果：300秒，中节奏

// 精品版本
const premiumBudget = calculateBudget(shots, { platform: 'premium', pace: 'slow' });
// 结果：450秒，慢节奏
```

---

## ✅ 结论

### 时长预算功能的真正意义：

| 层面       | 意义           | 代码体现                 |
| ---------- | -------------- | ------------------------ |
| **平台层** | 平台规则引擎   | PLATFORM_CONFIGS         |
| **叙事层** | 叙事结构控制器 | SCENE_IMPORTANCE_WEIGHTS |
| **AI层**   | Prompt增强器   | buildProductionPrompt    |
| **质量层** | 质量验证系统   | validateBudget           |
| **应用层** | 动态调整机制   | useProductionPrompt      |

### 核心价值：

1. **不是简单的"时长计算"**
2. **而是"平台适配 + 叙事控制 + AI指导 + 质量保障"的完整系统**
3. **将专业编剧知识和平台运营规则编码为可执行逻辑**
4. **让AI生成从"盲目"变为"目标导向"**

### 建议：

**该功能应该被充分利用**，建议：

1. 在设置页面添加"推荐配置"快捷按钮
2. 在解析结果页面展示预算报告
3. 添加预算预览功能（解析前就能看到预估时长）
4. 添加平台对比功能（同一剧本在不同平台的预算对比）

---

_报告生成时间：2026-03-07_
_分析基于：BudgetPlanner.ts (702行) + scriptParser.ts 集成点_
