# 分镜时长预算生产级优化方案 Spec (v1.0)

> **方案定位**: 解决"7000字小说→43个分镜→2分28秒"生产不可用的系统性问题
> **核心目标**: 建立从字数到总时长预算、从场景到分镜数、从内容到单镜时长的三层控制体系
> **分析方法**: 基于后端日志分析 + 行业对标 + 代码现状核实

---

## 一、问题现状深度分析（基于事实）

### 1.1 后端日志证据

**日志来源**: `d:\kemeng\后端日志.txt`

**关键发现**:

```
第69行: [ScriptParser] Iterative refinement disabled（已修复，现在enabled）
第530-562行: 完整迭代优化流程日志
  - Initial quality score: 62
  - Found 0 violations
  - Quality score: 62
    [completeness] 60/25
    [accuracy] 44/25
    [consistency] 80/30
    [usability] 60/20
  - Generated 2 actions
  - Applied: 0, Skipped: 2, Failed: 0
  - Improvement: 0.00（低于阈值2，停止迭代）
```

**分镜生成相关日志**:

```
第1565行: [ScriptParser] ---------- Generating Shots for Scene: 杂役院 ----------
第1582行: Prompt: PROMPTS.shots.replace(...)（使用固定prompt）
第1593行: Generated ${shots.length} shots（无时长校验）
第1601行: 打印每个shot的duration（从LLM返回）
```

### 1.2 代码现状核实

**文件**: `services/scriptParser.ts`

**PROMPTS.shots 定义**（第416-446行）:

```typescript
shots: `
请为以下场景生成分镜脚本。
...
4. 每个场景生成5-15个镜头  ← 无总时长约束

请严格按以下JSON数组格式输出：
[
  {
    ...
    "duration": 3,  ← 硬编码示例值
    ...
  }
]
`;
```

**generateShots方法**（第1559-1616行）:

- 无总时长预算参数
- 无场景权重参数
- 无单镜时长范围约束
- 生成后无时长校验

### 1.3 与行业标准差距

| 维度           | 当前项目              | 行业标准             | 差距       |
| -------------- | --------------------- | -------------------- | ---------- |
| **总时长控制** | 无预算，累加得2分28秒 | 7000字→3-5分钟       | 🔴 偏差50% |
| **分镜数控制** | 每场景5-15镜，无总控  | 7000字→25-35镜       | 🟡 偏多    |
| **单镜时长**   | 硬编码3秒示例         | 2-10秒动态范围       | 🔴 无变化  |
| **节奏设计**   | 恒定3秒               | 快慢交替             | 🔴 单调    |
| **场景权重**   | 无差异化              | 开场/高潮/结尾差异化 | 🔴 缺失    |

---

## 二、行业最佳实践对标

### 2.1 国际产品

| 产品             | 时长控制策略               | 分镜策略          | 质量等级   |
| ---------------- | -------------------------- | ----------------- | ---------- |
| **Runway Gen-2** | Storyboard模式，总时长可控 | 支持分镜序列调整  | 专业级     |
| **Pika Labs**    | 片段时长3-4秒，支持拼接    | 文本→视频直接生成 | 创作者级   |
| **扣子(Coze)**   | 25宫格分镜，5秒/镜         | 快速出图，低成本  | 快速原型级 |

### 2.2 短剧行业标准

**字数→时长换算**:

- 快节奏（抖音）: 250-300字/分钟
- 中节奏（B站）: 180-250字/分钟
- 慢节奏（精品）: 120-180字/分钟

**7000字合理时长**:

- 快节奏: 23-28分钟（过长，不适合短视频）
- **中节奏: 28-39分钟（推荐，适合短剧）**
- 慢节奏: 39-58分钟（电影级别）

**注意**: 7000字对于"短视频"来说过长，更适合"短剧"形式（3-10分钟/集）。

### 2.3 分镜设计黄金法则

**视觉配比法则（1:3:6）**:

- 静态镜头: 10%（关键信息）
- 动态镜头: 30%（保持动感）
- 特写镜头: 60%（情绪峰值）

**时长动态分配**:

- 开场/结尾: 5-8秒（建立/收束）
- 对话戏: 3-5秒（标准叙事）
- 动作戏: 2-3秒（快节奏）
- 高潮/转折: 6-10秒（情感沉淀）

---

## 三、优化方案设计

### 3.1 方案原则

1. **不破坏现有功能** - 所有改动通过配置开关控制，默认关闭新功能
2. **三层控制体系** - 预算层→策略层→校验层
3. **向后兼容** - 旧数据、旧流程正常工作
4. **渐进式实施** - 每个阶段独立可验证

### 3.2 三层控制体系架构

```
┌─────────────────────────────────────────────────────────────┐
│ 第一层：预算规划层（Budget Planner）                         │
│ 输入: 小说字数、目标平台、节奏类型                            │
│ 输出: 总时长预算、目标分镜数、场景时长分配表                  │
│ 关键: 让创作者有"掌控感"，预算可调整                        │
├─────────────────────────────────────────────────────────────┤
│ 第二层：策略生成层（Duration Strategy）                      │
│ 输入: 场景类型、情感强度、在故事中的位置                      │
│ 输出: 单镜时长范围、分镜数建议、节奏曲线                      │
│ 关键: 根据内容动态调整，不是固定值                          │
├─────────────────────────────────────────────────────────────┤
│ 第三层：Prompt工程层（Context-Rich Prompt）                  │
│ 输入: 预算、策略、约束条件                                    │
│ 输出: 包含完整上下文的Prompt                                  │
│ 关键: 让LLM理解"为什么是这个时长"                           │
├─────────────────────────────────────────────────────────────┤
│ 第四层：后处理校验层（QC & Adjustment）                      │
│ 输入: 生成的分镜列表、预算参数                                │
│ 输出: 校验报告、调整建议或自动调整后的分镜                    │
│ 关键: 确保产出符合生产需要                                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 核心改造点

#### 改造点1: 预算规划器（Budget Planner）

**新增文件**: `services/parsing/BudgetPlanner.ts`

**功能**:

```typescript
interface DurationBudget {
  // 输入参数
  wordCount: number;
  targetPlatform: 'douyin' | 'kuaishou' | 'bilibili' | 'premium';
  paceType: 'fast' | 'normal' | 'slow';

  // 计算输出
  totalDuration: number; // 总时长预算（秒）
  targetShotCount: number; // 目标分镜数
  avgShotDuration: number; // 平均单镜时长

  // 场景分配
  sceneBudgets: SceneBudget[];
}

interface SceneBudget {
  sceneId: string;
  sceneName: string;
  importance: number; // 重要性权重 0-1
  allocatedDuration: number; // 分配时长
  targetShots: number; // 目标分镜数
  minDuration: number; // 单镜最小时长
  maxDuration: number; // 单镜最大时长
}
```

**预算计算逻辑**:

```typescript
// 7000字示例
const budget = calculateBudget({
  wordCount: 7000,
  targetPlatform: 'bilibili',  // 中节奏
  paceType: 'normal'
});

// 输出
{
  totalDuration: 210,          // 3分30秒（更合理）
  targetShotCount: 35,         // 减少分镜数
  avgShotDuration: 6,          // 平均6秒/镜
  sceneBudgets: [
    { scene: '开场', importance: 0.8, allocatedDuration: 25, targetShots: 4 },
    { scene: '发展', importance: 0.6, allocatedDuration: 90, targetShots: 15 },
    { scene: '高潮', importance: 1.0, allocatedDuration: 60, targetShots: 10 },
    { scene: '结尾', importance: 0.7, allocatedDuration: 35, targetShots: 6 }
  ]
}
```

**集成方式**:

```typescript
// scriptParser.ts
import { BudgetPlanner } from './parsing/BudgetPlanner';

class ScriptParser {
  private config = {
    useDurationBudget: true,  // 配置开关
    // ...其他配置
  };

  private budgetPlanner: BudgetPlanner | null = null;

  constructor() {
    if (this.config.useDurationBudget) {
      this.budgetPlanner = new BudgetPlanner();
    }
  }

  async parseScript(...) {
    // 在场景分析后，分镜生成前，计算预算
    if (this.budgetPlanner) {
      const budget = this.budgetPlanner.calculate({
        wordCount: content.length,
        targetPlatform: this.parserConfig.targetPlatform,
        paceType: this.parserConfig.paceType,
        scenes: this.currentScenes
      });
      this.currentBudget = budget;
    }

    // 生成分镜时传入预算
    for (const scene of scenes) {
      const sceneBudget = this.currentBudget?.sceneBudgets.find(s => s.sceneId === scene.id);
      const shots = await this.generateShots(content, scene, sceneBudget);
    }
  }
}
```

**回滚方式**: 设置 `useDurationBudget: false`

---

#### 改造点2: 动态时长策略（Dynamic Duration Strategy）

**新增文件**: `services/parsing/DurationStrategy.ts`

**场景类型识别**:

```typescript
type SceneType = 'opening' | 'dialogue' | 'action' | 'emotion' | 'climax' | 'ending';

interface DurationStrategy {
  sceneType: SceneType;
  baseDuration: number; // 基础时长
  minDuration: number; // 最小时长
  maxDuration: number; // 最大时长

  // 调整因子
  factors: {
    dialogueDensity: number; // 对话密度影响
    actionIntensity: number; // 动作强度影响
    emotionPeak: number; // 情感峰值影响
    visualComplexity: number; // 视觉复杂度影响
  };
}

// 策略库
const STRATEGIES: Record<SceneType, DurationStrategy> = {
  opening: {
    baseDuration: 6,
    minDuration: 4,
    maxDuration: 10,
    factors: {
      dialogueDensity: 1.2,
      actionIntensity: 0.8,
      emotionPeak: 1.3,
      visualComplexity: 1.1,
    },
  },
  climax: {
    baseDuration: 8,
    minDuration: 5,
    maxDuration: 12,
    factors: {
      dialogueDensity: 1.0,
      actionIntensity: 1.5,
      emotionPeak: 1.5,
      visualComplexity: 1.2,
    },
  },
  // ... 其他场景类型
};
```

**场景类型自动识别**:

```typescript
function detectSceneType(scene: ScriptScene, position: number, totalScenes: number): SceneType {
  // 根据场景在故事中的位置判断
  if (position === 0) return 'opening';
  if (position === totalScenes - 1) return 'ending';
  if (position > totalScenes * 0.6 && position < totalScenes * 0.8) return 'climax';

  // 根据场景内容判断
  if (scene.description?.includes('打') || scene.description?.includes('战')) return 'action';
  if (scene.description?.includes('哭') || scene.description?.includes('爱')) return 'emotion';

  return 'dialogue'; // 默认对话场景
}
```

---

#### 改造点3: 生产级Prompt模板

**修改文件**: `services/scriptParser.ts` - PROMPTS.shots

**新Prompt结构**:

```typescript
const PRODUCTION_PROMPT = `
【生产级分镜生成指令 - 时长预算版】

📊 项目预算信息
- 目标平台: {targetPlatform}
- 总时长预算: {totalDuration}秒
- 本场景分配时长: {sceneDuration}秒
- 建议分镜数: {targetShots}个
- 单镜时长范围: {minDuration}-{maxDuration}秒

🎬 场景信息
- 场景名称: {sceneName}
- 场景类型: {sceneType}
- 在故事中的位置: {position}/{totalScenes}
- 叙事重要性: {importance}/10
- 情感强度: {emotionIntensity}/10

⏱️ 时长分配策略（必须遵守）
- 开场/结尾镜头: 6-10秒（建立/收束情绪）
- 对话镜头: 4-6秒（标准叙事节奏）
- 动作镜头: 2-4秒（快节奏）
- 高潮/转折镜头: 6-12秒（情感沉淀）
- 转场镜头: 2-3秒（过渡）

⚠️ 硬性约束（必须满足）
1. 每个分镜时长必须在 {minDuration}-{maxDuration} 秒范围内
2. 连续3个分镜不能有相同时长（避免节奏单调）
3. 本场景所有分镜时长之和必须接近 {sceneDuration} 秒（±15%误差）
4. 高潮场景必须至少有一个超过8秒的长镜头
5. 如果场景包含对话，对话镜头占比不超过60%

📝 输出格式
[
  {
    "sequence": 1,
    "shotType": "景别（extreme_long/long/full/medium/close_up/extreme_close_up）",
    "cameraMovement": "运镜（static/push/pull/pan/tilt/track/crane）",
    "description": "画面描述，控制在30字以内",
    "dialogue": "台词（可选，如无则留空）",
    "sound": "音效（可选）",
    "duration": 动态计算值,  // 根据内容和策略确定，不是固定3秒！
    "rationale": "时长选择的理由（如：高潮场景，需要情感沉淀）"
  }
]

💡 示例（仅供参考，不要照搬）
场景: 主角发现真相（高潮场景，重要性10/10）
[
  {
    "sequence": 1,
    "shotType": "close_up",
    "cameraMovement": "push",
    "description": "主角瞳孔收缩，表情从困惑到震惊",
    "duration": 8,
    "rationale": "情感转折点，需要足够时长让观众感受情绪变化"
  },
  {
    "sequence": 2,
    "shotType": "medium",
    "cameraMovement": "static",
    "description": "主角后退一步，手中文件滑落",
    "duration": 4,
    "rationale": "动作反应，标准时长"
  }
]
`;
```

---

#### 改造点4: 后处理校验与调整（QC System）

**新增文件**: `services/parsing/ShotQC.ts`

**校验规则**:

```typescript
interface QCReport {
  passed: boolean;
  score: number; // 生产可用性评分 0-100
  totalDuration: number; // 实际总时长
  budgetVariance: number; // 预算偏差百分比
  issues: QCIssue[];
  adjustments: QCAdjustment[];
}

interface QCIssue {
  type: 'duration' | 'pacing' | 'budget' | 'distribution';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion: string;
}

// 校验规则库
const QC_RULES = [
  {
    name: '总时长校验',
    check: (shots, budget) => {
      const total = shots.reduce((sum, s) => sum + s.duration, 0);
      const variance = Math.abs(total - budget.allocatedDuration) / budget.allocatedDuration;
      return {
        passed: variance <= 0.15, // ±15%误差
        score: Math.max(0, 100 - variance * 200),
        message:
          variance > 0.15
            ? `总时长偏差 ${(variance * 100).toFixed(1)}%，超出15%阈值`
            : '总时长正常',
      };
    },
  },
  {
    name: '节奏变化校验',
    check: shots => {
      // 检查连续3镜是否有相同时长
      let monotonicCount = 0;
      for (let i = 0; i < shots.length - 2; i++) {
        if (
          shots[i].duration === shots[i + 1].duration &&
          shots[i + 1].duration === shots[i + 2].duration
        ) {
          monotonicCount++;
        }
      }
      return {
        passed: monotonicCount === 0,
        score: Math.max(0, 100 - monotonicCount * 20),
        message:
          monotonicCount > 0
            ? `发现 ${monotonicCount} 处连续3镜相同时长，节奏单调`
            : '节奏变化正常',
      };
    },
  },
  {
    name: '时长范围校验',
    check: (shots, budget) => {
      const outOfRange = shots.filter(
        s => s.duration < budget.minDuration || s.duration > budget.maxDuration
      );
      return {
        passed: outOfRange.length === 0,
        score: Math.max(0, 100 - outOfRange.length * 10),
        message:
          outOfRange.length > 0
            ? `${outOfRange.length} 个分镜时长超出范围 [${budget.minDuration}, ${budget.maxDuration}]`
            : '时长范围正常',
      };
    },
  },
];

// 自动调整策略
const ADJUSTMENT_STRATEGIES = {
  // 策略1: 压缩非关键场景时长
  compressNonCritical: (shots, budget) => {
    const total = shots.reduce((sum, s) => sum + s.duration, 0);
    const ratio = budget.allocatedDuration / total;
    return shots.map(s => ({
      ...s,
      duration: Math.round(s.duration * ratio),
    }));
  },

  // 策略2: 扩展关键场景时长
  expandCritical: (shots, budget) => {
    // 识别关键分镜（高潮、情感峰值）
    const criticalShots = shots.filter(s => s.importance > 0.8);
    // ... 调整逻辑
  },
};
```

---

### 3.4 配置系统设计

**扩展 ScriptParserConfig**:

```typescript
interface ScriptParserConfig {
  // 已有配置
  useSemanticChunking: boolean;
  useDramaRules: boolean;
  dramaRulesMinScore: number;
  useCache: boolean;
  cacheTTL: number;
  enableIterativeRefinement: boolean;
  iterativeRefinementConfig?: Partial<IterativeRefinementConfig>;

  // 新增：时长预算控制
  useDurationBudget: boolean; // 启用时长预算规划
  targetPlatform: 'douyin' | 'kuaishou' | 'bilibili' | 'premium';
  paceType: 'fast' | 'normal' | 'slow';

  // 新增：动态时长策略
  useDynamicDuration: boolean; // 启用动态时长
  durationStrategy?: DurationStrategyConfig;

  // 新增：后处理校验
  useShotQC: boolean; // 启用分镜质检
  qcAutoAdjust: boolean; // 自动调整不符合预算的分镜
  qcTolerance: number; // 预算偏差容忍度（默认15%）
}

// 默认配置
const DEFAULT_CONFIG: ScriptParserConfig = {
  // 已有配置默认值
  useSemanticChunking: true,
  useDramaRules: true,
  dramaRulesMinScore: 60,
  useCache: true,
  cacheTTL: 3600000,
  enableIterativeRefinement: true,

  // 新增配置默认值（默认关闭，需手动启用）
  useDurationBudget: false, // 默认关闭，验证后再开启
  targetPlatform: 'bilibili',
  paceType: 'normal',
  useDynamicDuration: false,
  useShotQC: false,
  qcAutoAdjust: false,
  qcTolerance: 0.15,
};
```

---

## 四、实施计划

### Phase 1: 预算规划器（P0 - 必须实现）

| 任务                            | 工时 | 风险 | 回滚难度 |
| ------------------------------- | ---- | ---- | -------- |
| Task 1.1: 创建BudgetPlanner模块 | 2h   | 低   | 容易     |
| Task 1.2: 集成到scriptParser.ts | 1h   | 低   | 容易     |
| Task 1.3: 添加配置项和默认值    | 0.5h | 低   | 容易     |
| Task 1.4: 编写单元测试          | 1h   | 低   | 容易     |

**验收标准**:

- [ ] BudgetPlanner能正确计算7000字小说的时长预算
- [ ] 预算包含总时长、分镜数、场景分配
- [ ] 可通过配置开关控制
- [ ] 单元测试通过

---

### Phase 2: 动态时长策略（P0 - 必须实现）

| 任务                               | 工时 | 风险 | 回滚难度 |
| ---------------------------------- | ---- | ---- | -------- |
| Task 2.1: 创建DurationStrategy模块 | 2h   | 低   | 容易     |
| Task 2.2: 实现场景类型自动识别     | 1h   | 中   | 容易     |
| Task 2.3: 集成到generateShots      | 1h   | 低   | 容易     |
| Task 2.4: 编写单元测试             | 1h   | 低   | 容易     |

**验收标准**:

- [ ] 能自动识别场景类型（开场/高潮/结尾等）
- [ ] 不同场景类型有不同的时长范围
- [ ] 可通过配置开关控制
- [ ] 单元测试通过

---

### Phase 3: Prompt工程优化（P0 - 必须实现）

| 任务                           | 工时 | 风险 | 回滚难度 |
| ------------------------------ | ---- | ---- | -------- |
| Task 3.1: 重写PROMPTS.shots    | 2h   | 中   | 容易     |
| Task 3.2: 添加预算和策略上下文 | 1h   | 低   | 容易     |
| Task 3.3: A/B测试对比效果      | 2h   | 中   | 容易     |
| Task 3.4: 根据测试结果调优     | 2h   | 中   | 容易     |

**验收标准**:

- [ ] 新Prompt生成的分镜时长分布合理（2-10秒范围）
- [ ] 同一场景的分镜时长有变化（非恒定3秒）
- [ ] 总时长接近预算（±15%）
- [ ] A/B测试显示质量提升

---

### Phase 4: 后处理校验（P1 - 建议实现）

| 任务                         | 工时 | 风险 | 回滚难度 |
| ---------------------------- | ---- | ---- | -------- |
| Task 4.1: 创建ShotQC模块     | 2h   | 低   | 容易     |
| Task 4.2: 实现校验规则       | 1h   | 低   | 容易     |
| Task 4.3: 实现自动调整策略   | 2h   | 中   | 中等     |
| Task 4.4: 集成到scriptParser | 1h   | 低   | 容易     |
| Task 4.5: 编写单元测试       | 1h   | 低   | 容易     |

**验收标准**:

- [ ] 能检测总时长偏差、节奏单调、时长超出范围等问题
- [ ] 能自动调整不符合预算的分镜
- [ ] 可通过配置开关控制
- [ ] 单元测试通过

---

### Phase 5: 配置系统与UI（P1 - 建议实现）

| 任务                             | 工时 | 风险 | 回滚难度 |
| -------------------------------- | ---- | ---- | -------- |
| Task 5.1: 扩展ScriptParserConfig | 0.5h | 低   | 容易     |
| Task 5.2: 前端添加配置界面       | 2h   | 中   | 容易     |
| Task 5.3: 配置持久化             | 0.5h | 低   | 容易     |

**验收标准**:

- [ ] 用户可在前端调整预算参数
- [ ] 配置可保存和读取
- [ ] 配置变更立即生效

---

## 五、回滚机制

### 5.1 独立回滚

| 功能         | 回滚方式                     | 验证方法                     |
| ------------ | ---------------------------- | ---------------------------- |
| 预算规划器   | `useDurationBudget: false`   | 不计算预算，使用原有逻辑     |
| 动态时长策略 | `useDynamicDuration: false`  | 不识别场景类型，使用默认策略 |
| 新Prompt     | `useProductionPrompt: false` | 使用原有PROMPTS.shots        |
| 后处理校验   | `useShotQC: false`           | 不执行校验和调整             |

### 5.2 全量回滚

设置所有开关为false:

```typescript
{
  useDurationBudget: false,
  useDynamicDuration: false,
  useProductionPrompt: false,
  useShotQC: false
}
```

系统恢复到优化前状态，使用原有固定时长逻辑。

---

## 六、验收标准

### 6.1 功能验收

- [ ] BudgetPlanner正确计算预算
- [ ] DurationStrategy正确识别场景类型
- [ ] 新Prompt生成的分镜时长分布合理
- [ ] ShotQC正确检测和报告问题
- [ ] 自动调整策略有效改善结果

### 6.2 质量验收

**7000字小说测试**:

- [ ] 总时长从2分28秒优化到3分30秒-5分钟范围
- [ ] 分镜数从43个优化到25-35个范围
- [ ] 单镜时长分布：2-10秒，非恒定3秒
- [ ] 节奏有快慢变化，非单调
- [ ] 高潮场景时长明显长于普通场景

### 6.3 回滚验收

- [ ] 每个功能可独立回滚
- [ ] 全量回滚后系统恢复正常
- [ ] 现有功能不受影响
- [ ] 无数据丢失

---

## 七、不改动的内容

以下功能已正常工作，不在本次优化范围内：

1. **JSON修复** - JSONRepair.ts 已集成
2. **语义分块** - SemanticChunker 已集成
3. **短剧规则** - ShortDramaRules 已集成
4. **迭代优化** - IterativeRefinementEngine 已集成
5. **资产关联** - Keyframe.references 已实现
6. **关键帧拆分** - KeyframeService 正常工作

---

## 八、风险评估

| 风险             | 概率 | 影响 | 缓解措施                          |
| ---------------- | ---- | ---- | --------------------------------- |
| 新Prompt效果不佳 | 中   | 高   | A/B测试，保留旧Prompt作为fallback |
| 预算计算不准确   | 低   | 中   | 可手动调整预算参数                |
| 场景类型识别错误 | 中   | 低   | 允许用户手动修正                  |
| 性能下降         | 低   | 低   | 预算计算在本地完成，不调用API     |

---

**文档版本**: v1.0  
**创建日期**: 2026-03-05  
**分析方法**: 后端日志分析 + 行业对标 + 代码现状核实  
**核心目标**: 解决"43分镜/2分28秒"生产不可用问题
