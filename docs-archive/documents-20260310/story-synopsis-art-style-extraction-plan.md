# 故事梗概与美术风格提取优化计划

**文档类型**: 执行计划  
**创建日期**: 2026-03-04  
**目标**: 结合主流AI剧本解析应用，添加故事梗概、美术风格等细节提取  
**预期收益**: 提升解析结果完整性，增强后续视频生成质量

---

## 一、主流同类型应用功能盘点

### 1.1 量子探险（行业标杆）

| 功能模块       | 提取内容                     | 应用场景           |
| -------------- | ---------------------------- | ------------------ |
| **世界观设定** | 时代背景、社会环境、权力结构 | 构建故事基础框架   |
| **故事梗概**   | 主线剧情、核心冲突、情节走向 | 快速了解故事全貌   |
| **角色弧光**   | 角色成长轨迹、转变节点       | 保持角色发展一致性 |
| **美术风格**   | 视觉风格、色彩基调、时代美学 | 指导画面生成       |
| **情绪曲线**   | 全篇情绪波动图谱             | 优化叙事节奏       |

### 1.2 白日梦AI

| 功能模块     | 提取内容              | 应用场景 |
| ------------ | --------------------- | -------- |
| **剧情摘要** | 3句话概括核心故事     | 快速预览 |
| **风格标签** | 写实/动漫/水墨/油画等 | 风格选择 |
| **色调方案** | 暖色/冷色/黑白/复古   | 色彩统一 |
| **场景氛围** | 紧张/温馨/神秘/欢快   | 情绪指导 |

### 1.3 有戏AI

| 功能模块     | 提取内容           | 应用场景     |
| ------------ | ------------------ | ------------ |
| **故事核**   | 核心创意一句话     | 定位故事类型 |
| **视觉风格** | 参考影片、美学风格 | 风格迁移     |
| **时代质感** | 年代特征、复古程度 | 道具场景设计 |

---

## 二、项目现状分析

### 2.1 当前解析能力

```
✅ 已实现：
├── 元数据
│   ├── 标题、字数、预估时长
│   ├── 角色数量和名称列表
│   ├── 场景数量和名称列表
│   ├── 章节数
│   ├── 故事类型（genre）
│   └── 整体基调（tone）
├── 角色详情
│   ├── 外貌特征（身高、体型、面容、发型、服装）
│   ├── 性格特点
│   ├── 标志性物品
│   ├── 情绪曲线
│   ├── 人物关系
│   └── visualPrompt
├── 场景详情
│   ├── 环境描述
│   ├── 时间、季节、天气
│   ├── 建筑风格、陈设
│   └── visualPrompt
└── 分镜详情
    ├── 景别、运镜
    ├── 画面描述
    └── 台词、音效

❌ 缺失：
├── 故事梗概/剧情摘要
├── 美术风格定义
├── 色彩方案
├── 时代背景详情
├── 核心冲突提炼
└── 视觉参考
```

### 2.2 与主流产品差距

| 维度         | 项目现状                  | 主流产品              | 差距             |
| ------------ | ------------------------- | --------------------- | ---------------- |
| **故事理解** | 仅提取类型和基调          | 完整梗概+核心冲突     | 缺少高层抽象     |
| **视觉指导** | 仅角色/场景有visualPrompt | 全局美术风格+色彩方案 | 缺少整体视觉规划 |
| **创作辅助** | 基础信息提取              | 创意提炼+参考推荐     | 缺少创意层       |

---

## 三、优化建议方案

### 方案A：最小改动（推荐⭐）

**思路**：在现有ScriptMetadata基础上扩展字段

**新增字段**：

```typescript
interface ScriptMetadata {
  // 现有字段...

  // 新增：故事层
  synopsis?: string; // 故事梗概（100字以内）
  coreConflict?: string; // 核心冲突
  theme?: string; // 主题思想

  // 新增：视觉层
  artStyle?: string; // 美术风格（写实/动漫/水墨等）
  colorPalette?: string[]; // 主色调（如：["#2E5C8A", "#D4A574"]）
  visualReferences?: string[]; // 视觉参考（如：["新海诚", "王家卫"]）

  // 新增：时代层
  era?: string; // 具体年代（如："1990年代"）
  eraDetails?: string; // 时代特征描述
}
```

**优点**：

- 改动小，兼容现有代码
- 快速实现，2-3天完成
- 满足80%需求

**缺点**：

- 信息粒度较粗
- 缺少深度分析

---

### 方案B：完整增强

**思路**：新增专门的分析阶段和Schema

**新增模块**：

```
Stage 1.5: 故事分析（在metadata之后）
├── 提取故事梗概
├── 识别核心冲突
├── 分析主题思想
└── 生成情绪曲线图谱

Stage 2.5: 视觉分析（在scenes之后）
├── 定义整体美术风格
├── 提取色彩方案
├── 识别视觉参考
└── 生成风格指南
```

**新增Schema**：

```typescript
// StoryAnalysis.ts
interface StoryAnalysis {
  synopsis: string; // 故事梗概
  logline: string; // 一句话简介
  coreConflict: {
    type: string; // 冲突类型
    description: string; // 冲突描述
    stakes: string; // 冲突 stakes
  };
  themes: string[]; // 主题列表
  emotionalArc: Array<{
    point: string; // 情节点
    emotion: string; // 情绪
    intensity: number; // 强度 0-10
  }>;
}

// VisualStyle.ts
interface VisualStyle {
  artDirection: string; // 美术指导风格
  colorPalette: {
    primary: string[]; // 主色
    secondary: string[]; // 辅色
    mood: string; // 情绪色
  };
  cinematography: string; // 摄影风格
  references: string[]; // 参考影片/作品
  eraAesthetics: string; // 时代美学
}
```

**优点**：

- 信息完整，专业级
- 可指导高质量视频生成
- 符合行业标准

**缺点**：

- 改动大，需要1-2周
- 增加API调用成本
- 需要更多测试

---

## 四、推荐实施方案（方案A+）

结合项目现状和主流产品，推荐**方案A的增强版**：

### 4.1 新增字段（ScriptMetadata）

```typescript
export interface ScriptMetadata {
  // ===== 现有字段 =====
  title: string;
  wordCount: number;
  estimatedDuration: string;
  characterCount: number;
  characterNames: string[];
  sceneCount: number;
  sceneNames: string[];
  chapterCount: number;
  genre: string;
  tone: string;

  // ===== 新增字段 =====

  // 1. 故事梗概层
  synopsis?: string; // 故事梗概（100-200字）
  logline?: string; // 一句话简介（30字以内）
  coreConflict?: string; // 核心冲突描述

  // 2. 美术风格层
  artStyle?: string; // 美术风格标签
  artStyleDescription?: string; // 风格详细描述
  colorPalette?: string[]; // 主色调（3-5个）
  colorMood?: string; // 色彩情绪

  // 3. 时代背景层
  era?: string; // 具体年代
  eraDescription?: string; // 时代特征
  location?: string; // 地理背景

  // 4. 视觉参考层
  visualReferences?: string[]; // 参考影片/导演
  cinematographyStyle?: string; // 摄影风格
}
```

### 4.2 更新Prompt

```typescript
// 在PROMPTS.metadata中添加
const PROMPTS = {
  metadata: `
请快速分析以下剧本/小说内容，提取基础元数据：

【剧本内容】
{content}

请提取：
1. 作品标题
2. 总字数
3. 预估时长
4. 主要角色数量和名称列表
5. 主要场景数量和名称列表
6. 章节/幕数
7. 故事类型（古装/现代/科幻/悬疑等）
8. 整体基调（喜剧/悲剧/正剧）

===== 新增字段 =====
9. 故事梗概（100-200字，包含开端-发展-高潮-结局）
10. 一句话简介（30字以内，概括核心卖点）
11. 核心冲突（主角面临的主要矛盾）

12. 美术风格（选择最符合的1-2个）：
    - 写实/纪实
    - 动漫/二次元
    - 水墨/国风
    - 油画/古典
    - 赛博朋克/科幻
    - 复古/怀旧
    - 清新/治愈
    - 暗黑/悬疑

13. 主色调（3-5个，用颜色名称或十六进制）
14. 色彩情绪（如：温暖明亮、冷峻压抑、复古怀旧）

15. 具体年代（如：2020年代、1990年代、古代架空）
16. 时代特征（简要描述时代背景特点）

17. 参考影片/导演（1-3个，用于风格参考）
18. 摄影风格（如：手持纪实、稳定器流畅、电影感构图）

请严格按以下JSON格式输出：
{
  "title": "作品标题",
  "wordCount": 15000,
  "estimatedDuration": "10分钟",
  "characterCount": 8,
  "characterNames": ["角色1", "角色2"],
  "sceneCount": 12,
  "sceneNames": ["场景1", "场景2"],
  "chapterCount": 5,
  "genre": "古装宅斗",
  "tone": "爽剧",
  
  // 新增
  "synopsis": "故事梗概...",
  "logline": "一句话简介",
  "coreConflict": "核心冲突描述",
  "artStyle": "写实",
  "artStyleDescription": "详细描述...",
  "colorPalette": ["#2E5C8A", "#D4A574", "#8B4513"],
  "colorMood": "复古怀旧",
  "era": "1990年代",
  "eraDescription": "改革开放初期...",
  "visualReferences": ["王家卫", "重庆森林"],
  "cinemographyStyle": "电影感构图"
}
`,
};
```

### 4.3 更新Schema

```typescript
// ParsingSchemas.ts
export const ScriptMetadataSchema = z.object({
  // 现有字段...

  // 新增：故事层
  synopsis: z.string().max(300).optional(),
  logline: z.string().max(50).optional(),
  coreConflict: z.string().max(200).optional(),

  // 新增：美术层
  artStyle: z.string().optional(),
  artStyleDescription: z.string().max(200).optional(),
  colorPalette: z.array(z.string()).max(5).optional(),
  colorMood: z.string().optional(),

  // 新增：时代层
  era: z.string().optional(),
  eraDescription: z.string().max(200).optional(),
  location: z.string().optional(),

  // 新增：参考层
  visualReferences: z.array(z.string()).max(3).optional(),
  cinematographyStyle: z.string().optional(),
});
```

### 4.4 UI展示建议

```
┌─────────────────────────────────────┐
│  📊 解析结果                         │
├─────────────────────────────────────┤
│  📖 故事梗概                         │
│  这是一个关于...的故事              │
│                                     │
│  🎨 美术风格：写实                   │
│  🎨 主色调：#2E5C8A, #D4A574       │
│  🎨 色彩情绪：复古怀旧               │
│                                     │
│  🎬 参考风格：王家卫、重庆森林       │
│                                     │
│  📅 时代背景：1990年代               │
│  📍 地点：香港                       │
└─────────────────────────────────────┘
```

---

## 五、实施步骤

### 步骤1：更新Schema（30分钟）

- 修改 `ParsingSchemas.ts`
- 添加新字段的Zod定义

### 步骤2：更新Prompt（30分钟）

- 修改 `scriptParser.ts` 中的 PROMPTS.metadata
- 添加新字段的提取要求

### 步骤3：更新类型定义（15分钟）

- 修改 `types.ts` 中的 ScriptMetadata 接口

### 步骤4：更新UI展示（1小时）

- 在解析结果页面展示新字段
- 添加美术风格可视化

### 步骤5：测试验证（30分钟）

- 测试新字段提取
- 验证Schema校验

**总计：约2.5-3小时**

---

## 六、预期效果

### 解析结果示例

```json
{
  "title": "暗流",
  "wordCount": 1200,
  "genre": "现代职场",
  "tone": "正剧",

  // 新增
  "synopsis": "职场新人林薇在鼎盛集团遭遇空降精英江哲的打压，两人在权力斗争中逐渐发现彼此的秘密，最终从对手变成合作伙伴的故事。",
  "logline": "职场新人对抗空降精英，从敌对到合作的权力游戏",
  "coreConflict": "林薇需要在保住工作和对抗不公之间做出选择",

  "artStyle": "写实",
  "artStyleDescription": "现代都市写实风格，强调职场冷峻氛围",
  "colorPalette": ["#2C3E50", "#95A5A6", "#E74C3C"],
  "colorMood": "冷峻专业",

  "era": "2020年代",
  "eraDescription": "现代都市，互联网+时代",
  "location": "一线城市CBD",

  "visualReferences": ["未生", "半泽直树"],
  "cinemographyStyle": "稳定器流畅，商务精英感"
}
```

### 应用场景

1. **快速预览**：通过logline和synopsis快速了解故事
2. **风格统一**：通过artStyle和colorPalette指导画面生成
3. **参考学习**：通过visualReferences找到类似作品学习
4. **时代还原**：通过era和eraDescription确保时代细节准确

---

## 七、风险评估

| 风险                  | 概率 | 影响 | 应对                        |
| --------------------- | ---- | ---- | --------------------------- |
| LLM提取质量不稳定     | 中   | 中   | 添加默认值，降级 gracefully |
| 新增字段增加Token消耗 | 低   | 低   | 新字段简短，影响<5%         |
| 向后兼容问题          | 低   | 高   | 所有字段设为optional        |

---

**建议**：采用方案A+，快速实现核心功能，后续根据用户反馈迭代优化。
