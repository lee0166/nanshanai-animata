# Phase 5: 专业分析模块 - 基于现有功能规划

> **规划日期**: 2026-03-06  
> **规划原则**: 基于现有功能，不重复不臆测  
> **核心约束**: 必须依托现有数据（情绪曲线、分镜音效字段）

---

## 一、现有声音设计相关数据盘点

### 1.1 已存在的数据字段

| 数据位置                          | 字段                              | 说明              | 当前状态                        |
| --------------------------------- | --------------------------------- | ----------------- | ------------------------------- |
| `types.ts:529`                    | `Shot.sound?: string`             | 分镜音效/配乐提示 | ✅ 已定义，Prompt中要求LLM生成  |
| `types.ts:371-382`                | `EmotionalPoint`                  | 情绪曲线节点      | ✅ GlobalContextExtractor已提取 |
| `types.ts:448-450`                | `emotionalArc?: EmotionalPoint[]` | 情绪曲线数组      | ✅ 已集成到ScriptMetadata       |
| `types.ts:256`                    | `colorMood: string`               | 色彩情绪          | ✅ VisualStyle中已定义          |
| `GlobalContextExtractor.ts:86-91` | `EmotionalContext`                | 情绪上下文        | ✅ 包含arc和overallMood         |

### 1.2 现有数据示例（来自实际代码）

**EmotionalPoint结构**:

```typescript
{
  plotPoint: "情节点名称（如：开场、催化剂、中点、高潮、结局）",
  emotion: "主导情绪（如：平静、紧张、喜悦、悲伤、愤怒）",
  intensity: 5,  // 0-10
  colorTone: "对应色调（如：明亮、阴暗、暖色、冷色）",
  percentage: 10 // 0-100，故事位置
}
```

**Shot.sound字段**:

```typescript
// 生产级Prompt中要求LLM生成
"sound": "音效/配乐提示"  // 如：紧张弦乐、环境音、心跳声等
```

---

## 二、Phase 5 功能规划（基于现有数据）

### 2.1 SoundDesigner（声音设计分析）- 依托现有情绪曲线

**不重复**: 不重新提取情绪，直接使用`emotionalArc`  
**不臆测**: 基于已有`Shot.sound`字段进行汇总分析

**功能设计**:

```typescript
// 基于现有emotionalArc和Shot.sound生成声音设计方案
interface SoundDesignAnalysis {
  // 从emotionalArc推导
  emotionalMusicMap: Array<{
    plotPoint: string; // 来自emotionalArc.plotPoint
    emotion: string; // 来自emotionalArc.emotion
    intensity: number; // 来自emotionalArc.intensity
    suggestedMusic: string; // 基于emotion+intensity推导
    colorTone: string; // 来自emotionalArc.colorTone
  }>;

  // 从所有Shot.sound汇总
  soundPalette: {
    ambientSounds: string[]; // 环境音类型统计
    effectSounds: string[]; // 音效类型统计
    musicThemes: string[]; // 配乐主题统计
  };

  // 基于overallMood的整体音景
  overallSoundscape: {
    dominantMood: string; // 来自EmotionalContext.overallMood
    backgroundTone: string; // 基于colorMood推导
    dynamicRange: string; // 基于intensity范围计算
  };
}
```

**实现文件**: `services/parsing/professional/SoundDesigner.ts`

**输入**:

- `ScriptMetadata.emotionalArc` (已存在)
- `ScriptMetadata.visualStyle.colorMood` (已存在)
- `Shot[]` 中的 `sound` 字段 (已存在)

**输出**: SoundDesignAnalysis

---

### 2.2 ScreenplayStructureAnalyzer（剧本结构分析）- 依托现有故事结构

**不重复**: 直接使用`storyStructure`（三幕式已提取）  
**不臆测**: 基于已有结构数据进行可视化，不重新分析

**功能设计**:

```typescript
// 基于现有StoryStructure进行可视化分析
interface StructureAnalysis {
  // 直接使用现有StoryStructure
  structure: StoryStructure; // 已存在，直接使用

  // 基于现有数据计算
  actLengths: {
    act1: { percentage: number; wordCount: number };
    act2a: { percentage: number; wordCount: number };
    act2b: { percentage: number; wordCount: number };
    act3: { percentage: number; wordCount: number };
  };

  // 基于emotionalArc计算节奏
  pacingAnalysis: {
    tensionCurve: number[]; // 基于intensity数组
    turningPoints: string[]; // 基于plotPoint筛选
  };
}
```

**实现文件**: `services/parsing/professional/ScreenplayStructureAnalyzer.ts`

**输入**:

- `ScriptMetadata.storyStructure` (已存在)
- `ScriptMetadata.emotionalArc` (已存在)
- `wordCount` (已存在)

**输出**: StructureAnalysis

---

### 2.3 VisualPrevisualizer（视觉预演）- 依托现有视觉风格

**不重复**: 直接使用`visualStyle`（美术指导、色彩方案已提取）  
**不臆测**: 基于已有视觉数据进行展示，不重新生成

**功能设计**:

```typescript
// 基于现有VisualStyle进行可视化展示
interface VisualPreviz {
  // 直接使用现有VisualStyle
  visualStyle: VisualStyle; // 已存在，直接使用

  // 基于colorPalette生成色彩板
  colorBoard: {
    primaryColors: string[]; // 来自colorPalette
    moodDescription: string; // 来自colorMood
    cinematographyNotes: string; // 来自cinematography
  };

  // 基于eraContext生成时代参考
  eraVisualGuide: {
    era: string; // 来自EraContext.era
    location: string; // 来自EraContext.location
    visualReferences: string[]; // 基于references
  };
}
```

**实现文件**: `services/parsing/professional/VisualPrevisualizer.ts`

**输入**:

- `ScriptMetadata.visualStyle` (已存在)
- `ScriptMetadata.eraContext` (已存在)

**输出**: VisualPreviz

---

## 三、UI组件规划（基于现有ScriptManager Tab）

### 3.1 现有Tab结构

ScriptManager已有Tab:

- `source` - 原文
- `overview` - 概览（StoryOverviewCard, VisualStyleCard, EmotionalArcChart）
- `structure` - 结构（StoryStructureDiagram）
- `visual` - 视觉（VisualStyleCard）
- `characters` - 角色
- `scenes` - 场景
- `items` - 道具
- `shots` - 分镜
- `quality` - 质量

### 3.2 新增Tab（基于现有数据展示）

| Tab名称            | 基于的数据                    | 组件                     | 说明             |
| ------------------ | ----------------------------- | ------------------------ | ---------------- |
| `sound`            | emotionalArc + Shot.sound     | `SoundDesignTab.tsx`     | 声音设计方案展示 |
| `structure-detail` | storyStructure + emotionalArc | `StructureDetailTab.tsx` | 剧本结构详细分析 |

**不重复**: 不创建新的解析流程，只展示已有数据  
**不臆测**: 所有展示内容必须来自已有字段

---

## 四、实现优先级（基于依赖关系）

### 阶段1: SoundDesigner（声音设计）- 最高优先级

**原因**:

- 直接利用`emotionalArc`和`Shot.sound`
- 填补现有声音设计数据的展示空白
- 与已有时长预算优化形成完整工作流

**实现步骤**:

1. 创建`SoundDesigner.ts` - 分析emotionalArc生成音乐映射
2. 汇总所有Shot.sound生成声音调色板
3. 创建`SoundDesignTab.tsx` - 展示声音设计方案
4. 集成到ScriptManager（新增sound Tab）

### 阶段2: ScreenplayStructureAnalyzer（结构分析）- 中优先级

**原因**:

- 直接使用已有的`storyStructure`
- 与现有的StoryStructureDiagram形成互补

**实现步骤**:

1. 创建`ScreenplayStructureAnalyzer.ts` - 基于现有结构计算节奏
2. 创建`StructureDetailTab.tsx` - 详细结构分析
3. 集成到ScriptManager（新增structure-detail Tab）

### 阶段3: VisualPrevisualizer（视觉预演）- 低优先级

**原因**:

- 已有VisualStyleCard展示基础视觉风格
- 此功能为增强展示，非必需

**实现步骤**:

1. 创建`VisualPrevisualizer.ts` - 基于VisualStyle生成预演
2. 增强现有的VisualStyleCard或创建新Tab

---

## 五、关键约束检查清单

### 约束1: 不重复现有功能

- [ ] 不重新提取情绪曲线（直接使用emotionalArc）
- [ ] 不重新提取视觉风格（直接使用visualStyle）
- [ ] 不重新提取故事结构（直接使用storyStructure）
- [ ] 不重新生成分镜（直接使用现有Shot[]）

### 约束2: 不臆测不存在的数据

- [ ] 所有分析必须基于已有字段
- [ ] 不添加新的LLM调用提取新数据
- [ ] 只进行数据转换和可视化，不进行新推理

### 约束3: 依托现有架构

- [ ] 使用现有的GlobalContextExtractor输出
- [ ] 使用现有的ScriptManager Tab架构
- [ ] 使用现有的类型定义
- [ ] 遵循现有的服务层模式

---

## 六、预计工期（基于实际复杂度）

| 功能                        | 文件                             | 工期  | 说明                         |
| --------------------------- | -------------------------------- | ----- | ---------------------------- |
| SoundDesigner               | `SoundDesigner.ts`               | 6小时 | 基于emotionalArc推导音乐映射 |
| SoundDesignTab              | `SoundDesignTab.tsx`             | 8小时 | 声音设计展示UI               |
| ScreenplayStructureAnalyzer | `ScreenplayStructureAnalyzer.ts` | 4小时 | 基于storyStructure计算       |
| StructureDetailTab          | `StructureDetailTab.tsx`         | 6小时 | 结构分析展示UI               |
| VisualPrevisualizer         | `VisualPrevisualizer.ts`         | 4小时 | 基于visualStyle生成          |
| 集成到ScriptManager         | `ScriptManager.tsx`              | 4小时 | 新增Tab和集成                |
| 测试                        | 测试文件                         | 4小时 | 基于现有数据测试             |

**总计**: 36小时（约4-5个工作日）

---

## 七、与现有功能的集成点

### 7.1 数据流

```
GlobalContextExtractor (已有)
  ↓ 输出 emotionalArc, visualStyle, storyStructure
ScriptParser.parseScript() (已有)
  ↓ 输出 Shot[] (含sound字段)
Phase 5 专业分析模块 (新增)
  ↓ 基于上述数据生成分析结果
ScriptManager Tab (新增)
  ↓ 展示分析结果
```

### 7.2 不破坏现有功能

- 所有新增功能为**只读分析**，不修改现有数据
- 新增Tab为**展示层**，不影响解析流程
- 可独立开关，不影响核心功能

---

## 八、总结

**Phase 5核心目标**: 基于现有解析数据（情绪曲线、视觉风格、故事结构、分镜音效）进行专业级分析和可视化展示。

**关键原则**:

1. **零重复**: 不重新提取任何数据
2. **零臆测**: 所有分析基于已有字段
3. **增量增强**: 在现有架构上增加展示层

**预期成果**:

- 声音设计方案（基于情绪曲线+分镜音效）
- 剧本结构详细分析（基于故事结构+情绪节奏）
- 视觉预演（基于视觉风格+时代背景）
