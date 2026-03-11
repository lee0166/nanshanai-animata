# Phase 5: 专业分析模块 - 执行计划

> **计划状态**: 规划中  
> **创建日期**: 2026-03-06  
> **预计工期**: 4-5个工作日（36小时）  
> **核心原则**: 基于现有数据，零重复，零臆测

---

## 一、项目现状确认

### 1.1 已存在的关键数据（无需重新提取）

| 数据字段         | 位置               | 状态      | 用途              |
| ---------------- | ------------------ | --------- | ----------------- |
| `Shot.sound`     | `types.ts:529`     | ✅ 已定义 | 分镜音效/配乐提示 |
| `EmotionalPoint` | `types.ts:371-382` | ✅ 已提取 | 情绪曲线节点      |
| `emotionalArc`   | `types.ts:448-450` | ✅ 已集成 | 情绪曲线数组      |
| `colorMood`      | `types.ts:256`     | ✅ 已定义 | 色彩情绪          |
| `StoryStructure` | `types.ts:383-409` | ✅ 已提取 | 三幕式结构        |
| `VisualStyle`    | `types.ts:246-264` | ✅ 已提取 | 美术指导/色彩方案 |
| `EraContext`     | `types.ts:410-420` | ✅ 已提取 | 时代背景          |

### 1.2 现有Tab结构（ScriptManager）

```
source → overview → structure → visual → characters → scenes → items → shots → quality
```

---

## 二、执行步骤

### 步骤1: 创建专业分析服务目录结构

**目标**: 建立 `services/parsing/professional/` 目录

**操作**:

```
mkdir -p src/services/parsing/professional
```

**验证**: 目录创建成功

---

### 步骤2: 实现 SoundDesigner（声音设计分析）

**目标**: 基于 `emotionalArc` 和 `Shot.sound` 生成声音设计方案

**实现文件**: `src/services/parsing/professional/SoundDesigner.ts`

**核心功能**:

1. 从 `emotionalArc` 推导情绪音乐映射
2. 汇总所有 `Shot.sound` 生成声音调色板
3. 基于 `overallMood` 生成整体音景

**输入数据**:

- `ScriptMetadata.emotionalArc`
- `ScriptMetadata.visualStyle.colorMood`
- `Shot[]` 中的 `sound` 字段

**输出类型**:

```typescript
interface SoundDesignAnalysis {
  emotionalMusicMap: Array<{
    plotPoint: string;
    emotion: string;
    intensity: number;
    suggestedMusic: string;
    colorTone: string;
  }>;
  soundPalette: {
    ambientSounds: string[];
    effectSounds: string[];
    musicThemes: string[];
  };
  overallSoundscape: {
    dominantMood: string;
    backgroundTone: string;
    dynamicRange: string;
  };
}
```

**预计工期**: 6小时

---

### 步骤3: 实现 ScreenplayStructureAnalyzer（剧本结构分析）

**目标**: 基于 `storyStructure` 和 `emotionalArc` 进行结构可视化分析

**实现文件**: `src/services/parsing/professional/ScreenplayStructureAnalyzer.ts`

**核心功能**:

1. 基于现有 `StoryStructure` 计算幕长度占比
2. 基于 `emotionalArc.intensity` 计算节奏曲线
3. 识别转折点

**输入数据**:

- `ScriptMetadata.storyStructure`
- `ScriptMetadata.emotionalArc`
- `wordCount`

**输出类型**:

```typescript
interface StructureAnalysis {
  structure: StoryStructure;
  actLengths: {
    act1: { percentage: number; wordCount: number };
    act2a: { percentage: number; wordCount: number };
    act2b: { percentage: number; wordCount: number };
    act3: { percentage: number; wordCount: number };
  };
  pacingAnalysis: {
    tensionCurve: number[];
    turningPoints: string[];
  };
}
```

**预计工期**: 4小时

---

### 步骤4: 实现 VisualPrevisualizer（视觉预演）

**目标**: 基于 `visualStyle` 和 `eraContext` 生成视觉预演

**实现文件**: `src/services/parsing/professional/VisualPrevisualizer.ts`

**核心功能**:

1. 基于 `colorPalette` 生成色彩板
2. 基于 `eraContext` 生成时代视觉参考
3. 整合 `cinematography` 摄影指导

**输入数据**:

- `ScriptMetadata.visualStyle`
- `ScriptMetadata.eraContext`

**输出类型**:

```typescript
interface VisualPreviz {
  visualStyle: VisualStyle;
  colorBoard: {
    primaryColors: string[];
    moodDescription: string;
    cinematographyNotes: string;
  };
  eraVisualGuide: {
    era: string;
    location: string;
    visualReferences: string[];
  };
}
```

**预计工期**: 4小时

---

### 步骤5: 创建 SoundDesignTab UI组件

**目标**: 在 ScriptManager 中展示声音设计方案

**实现文件**: `src/components/ScriptParser/SoundDesignTab.tsx`

**UI元素**:

1. 情绪音乐映射表（基于 `emotionalMusicMap`）
2. 声音调色板展示（环境音/音效/配乐主题）
3. 整体音景描述
4. 与情绪曲线图表联动

**预计工期**: 8小时

---

### 步骤6: 创建 StructureDetailTab UI组件

**目标**: 在 ScriptManager 中展示详细剧本结构分析

**实现文件**: `src/components/ScriptParser/StructureDetailTab.tsx`

**UI元素**:

1. 幕长度占比可视化
2. 紧张度曲线图（基于 `tensionCurve`）
3. 转折点标注
4. 与现有 `StoryStructureDiagram` 互补

**预计工期**: 6小时

---

### 步骤7: 集成到 ScriptManager

**目标**: 在 ScriptManager 中新增 `sound` 和 `structure-detail` Tab

**修改文件**: `src/views/ScriptManager.tsx`

**修改内容**:

1. 导入新组件
2. 在 tabs 数组中添加新 Tab
3. 添加对应的状态管理

**预计工期**: 4小时

---

### 步骤8: 编写测试

**目标**: 为新增服务编写单元测试

**测试文件**:

- `src/services/parsing/professional/SoundDesigner.test.ts`
- `src/services/parsing/professional/ScreenplayStructureAnalyzer.test.ts`
- `src/services/parsing/professional/VisualPrevisualizer.test.ts`

**测试覆盖**:

- 基于模拟数据的功能测试
- 边界条件测试
- 数据转换正确性验证

**预计工期**: 4小时

---

## 三、工期汇总

| 步骤     | 任务                             | 工期         | 依赖      |
| -------- | -------------------------------- | ------------ | --------- |
| 1        | 创建目录结构                     | 0.5小时      | 无        |
| 2        | SoundDesigner 服务               | 6小时        | 无        |
| 3        | ScreenplayStructureAnalyzer 服务 | 4小时        | 无        |
| 4        | VisualPrevisualizer 服务         | 4小时        | 无        |
| 5        | SoundDesignTab UI                | 8小时        | 步骤2     |
| 6        | StructureDetailTab UI            | 6小时        | 步骤3     |
| 7        | ScriptManager 集成               | 4小时        | 步骤5,6   |
| 8        | 单元测试                         | 4小时        | 步骤2,3,4 |
| **总计** |                                  | **36.5小时** |           |

**预计工作日**: 4-5天（每天8小时）

---

## 四、约束检查清单

### 4.1 不重复现有功能

- [ ] 不重新提取情绪曲线（直接使用 `emotionalArc`）
- [ ] 不重新提取视觉风格（直接使用 `visualStyle`）
- [ ] 不重新提取故事结构（直接使用 `storyStructure`）
- [ ] 不重新生成分镜（直接使用现有 `Shot[]`）

### 4.2 不臆测不存在的数据

- [ ] 所有分析必须基于已有字段
- [ ] 不添加新的LLM调用提取新数据
- [ ] 只进行数据转换和可视化，不进行新推理

### 4.3 依托现有架构

- [ ] 使用现有的 `GlobalContextExtractor` 输出
- [ ] 使用现有的 `ScriptManager` Tab架构
- [ ] 使用现有的类型定义
- [ ] 遵循现有的服务层模式

---

## 五、数据流图

```
┌─────────────────────────────────────────────────────────────────┐
│                     现有数据（已提取）                            │
├─────────────────────────────────────────────────────────────────┤
│  emotionalArc  │  visualStyle  │  storyStructure  │  Shot[]    │
│  (情绪曲线)     │  (视觉风格)    │  (故事结构)       │  (分镜)     │
└────────┬───────┴───────┬───────┴────────┬─────────┴─────┬──────┘
         │               │                │               │
         ▼               ▼                ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Phase 5 专业分析模块（新增）                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ SoundDesigner│  │StructureAnalyzer │  │VisualPrevisualizer│  │
│  │  声音设计     │  │   结构分析        │  │    视觉预演       │  │
│  └──────┬───────┘  └────────┬─────────┘  └────────┬─────────┘  │
│         │                   │                     │             │
│         ▼                   ▼                     ▼             │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │SoundDesign   │  │StructureDetail   │  │ VisualStyleCard  │  │
│  │    Tab       │  │      Tab         │  │   (增强)          │  │
│  └──────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  ScriptManager   │
                    │   (新增Tab)       │
                    └──────────────────┘
```

---

## 六、风险评估

| 风险                   | 可能性 | 影响 | 缓解措施                 |
| ---------------------- | ------ | ---- | ------------------------ |
| 现有数据字段不完整     | 低     | 中   | 添加空值检查，提供默认值 |
| UI组件与现有风格不一致 | 中     | 低   | 严格遵循HeroUI设计规范   |
| 性能问题（大数据量）   | 低     | 中   | 使用useMemo缓存计算结果  |
| 与现有Tab切换冲突      | 低     | 高   | 充分测试Tab切换逻辑      |

---

## 七、验证清单

### 7.1 功能验证

- [ ] SoundDesigner 能正确分析 emotionalArc
- [ ] SoundDesigner 能正确汇总 Shot.sound
- [ ] ScreenplayStructureAnalyzer 能正确计算幕占比
- [ ] VisualPrevisualizer 能正确生成色彩板

### 7.2 UI验证

- [ ] SoundDesignTab 正确展示声音设计方案
- [ ] StructureDetailTab 正确展示结构分析
- [ ] 新Tab与现有Tab切换正常
- [ ] 响应式布局正常

### 7.3 测试验证

- [ ] 所有单元测试通过
- [ ] 类型检查通过
- [ ] 无控制台错误

---

## 八、回滚方案

如果遇到问题，可以快速回滚：

```bash
# 1. 恢复 ScriptManager.tsx
git checkout HEAD -- src/views/ScriptManager.tsx

# 2. 删除新增文件
rm -rf src/services/parsing/professional/
rm -f src/components/ScriptParser/SoundDesignTab.tsx
rm -f src/components/ScriptParser/StructureDetailTab.tsx

# 3. 重启开发服务器
npm run dev
```

---

_本计划基于项目全局状态文档和Phase 5规划文档制定_
_维护者: AI Assistant_
