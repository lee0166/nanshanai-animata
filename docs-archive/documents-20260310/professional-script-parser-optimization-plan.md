# 专业级剧本解析系统深度优化计划

**文档版本**: 1.0  
**创建日期**: 2026-03-04  
**预计总工期**: 10-12周  
**目标**: 构建影视工业级的智能剧本解析系统

---

## 目录

1. [现状分析与问题诊断](#一现状分析与问题诊断)
2. [优化目标与成功标准](#二优化目标与成功标准)
3. [Phase 1: 全局上下文感知解析](#三phase-1-全局上下文感知解析)
4. [Phase 2: 迭代优化引擎](#四phase-2-迭代优化引擎)
5. [Phase 3: 专业分析模块](#五phase-3-专业分析模块)
6. [UI/UX 全面升级](#六uiux-全面升级)
7. [测试验证策略](#七测试验证策略)
8. [实施路线图与里程碑](#八实施路线图与里程碑)
9. [风险评估与应对](#九风险评估与应对)

---

## 一、现状分析与问题诊断

### 1.1 当前架构评估

```
┌─────────────────────────────────────────────────────────────────┐
│                      当前系统架构                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│   │  Metadata   │───→│ Characters  │───→│   Scenes    │         │
│   │  (一次性)   │    │ (批量/单个)  │    │ (批量/单个)  │         │
│   └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                   │                  │                │
│         ▼                   ▼                  ▼                │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│   │    Items    │───→│   Shots     │───→│   Output    │         │
│   │   (批量)    │    │   (批量)    │    │             │         │
│   └─────────────┘    └─────────────┘    └─────────────┘         │
│                                                                  │
│   问题：                                                          │
│   ❌ 各阶段信息孤岛，metadata的genre/tone未被后续利用              │
│   ❌ 缺乏全局一致性校验                                          │
│   ❌ 一次性解析，无法迭代优化                                     │
│   ❌ 缺少专业级分析维度                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 核心问题清单

| 问题类别       | 具体问题                                                    | 影响程度 | 优先级 |
| -------------- | ----------------------------------------------------------- | -------- | ------ |
| **信息孤岛**   | metadata提取的类型、基调、风格未被characters/scenes阶段使用 | 高       | P0     |
| **一致性缺失** | 角色在场景A和场景B的描述可能矛盾                            | 高       | P0     |
| **无迭代机制** | 解析结果无法根据质量反馈自动优化                            | 高       | P0     |
| **专业度不足** | 缺少故事结构、视觉风格、情绪曲线等专业分析                  | 中       | P1     |
| **扩展性受限** | 新增分析维度需要修改核心解析器                              | 中       | P1     |
| **UI展示单一** | 解析结果仅展示基础信息，缺乏专业可视化                      | 中       | P1     |

### 1.3 技术债务

```typescript
// 当前技术债务
1. Prompt模板硬编码，难以动态注入上下文
2. 各阶段解析结果无统一校验机制
3. 缺乏质量评估标准体系
4. 缓存策略简单，未考虑语义相似性
5. 错误处理粒度粗，无法精准定位问题
```

---

## 二、优化目标与成功标准

### 2.1 核心目标

构建**三层架构**的专业级剧本解析系统：

```
┌─────────────────────────────────────────────────────────────────┐
│                    目标架构：三层模型                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Layer 3: 专业分析层 (Professional Analysis)              │    │
│  │  ├── 剧本结构分析（三幕式/英雄之旅）                       │    │
│  │  ├── 视觉预演（氛围板/色彩脚本）                          │    │
│  │  └── 声音设计（音景/音乐情绪曲线）                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Layer 2: 迭代优化层 (Iterative Refinement)              │    │
│  │  ├── 一致性检查引擎                                      │    │
│  │  ├── 质量评估系统                                        │    │
│  │  └── 自动修正机制                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Layer 1: 上下文感知层 (Context-Aware Parsing)           │    │
│  │  ├── 全局上下文提取                                      │    │
│  │  ├── 上下文注入机制                                      │    │
│  │  └── 跨阶段一致性维护                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 成功标准（KPI）

| 指标           | 当前值 | 目标值 | 测量方式           |
| -------------- | ------ | ------ | ------------------ |
| **解析准确率** | ~75%   | >90%   | 人工抽检100个样本  |
| **角色一致性** | ~60%   | >95%   | 跨场景角色描述对比 |
| **风格统一性** | ~50%   | >90%   | 视觉风格一致性评分 |
| **用户满意度** | -      | >4.5/5 | 用户调研           |
| **解析耗时**   | 基准   | <150%  | 同文本对比         |
| **API成本**    | 基准   | <200%  | Token消耗统计      |

### 2.3 质量评估维度

```typescript
interface QualityMetrics {
  // 完整性
  completeness: {
    characterDetail: number; // 角色信息完整度 0-100
    sceneDescription: number; // 场景描述完整度 0-100
    shotCoverage: number; // 分镜覆盖度 0-100
  };

  // 一致性
  consistency: {
    characterAcrossScenes: number; // 角色跨场景一致性 0-100
    timelineLogic: number; // 时间线逻辑性 0-100
    visualStyle: number; // 视觉风格统一性 0-100
  };

  // 专业性
  professionalism: {
    storyStructure: number; // 故事结构识别准确度 0-100
    visualGuidance: number; // 视觉指导质量 0-100
    cinematicLanguage: number; // 电影语言运用 0-100
  };

  // 可用性
  usability: {
    promptQuality: number; // 生成Prompt质量 0-100
    generationSuccess: number; // 生成成功率 0-100
    userEditNeed: number; // 用户需编辑率 0-100（越低越好）
  };
}
```

---

## 三、Phase 1: 全局上下文感知解析

### 3.1 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│              Phase 1: 上下文感知解析架构                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Global Context Extractor                    │    │
│  │  职责：在metadata阶段提取全局上下文信息                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│                    ┌─────────────────┐                          │
│                    │  Global Context │                          │
│                    │     Store       │                          │
│                    └────────┬────────┘                          │
│                             ↓                                    │
│        ┌────────────────────┼────────────────────┐              │
│        ↓                    ↓                    ↓              │
│  ┌──────────┐        ┌──────────┐        ┌──────────┐          │
│  │Character │        │  Scene   │        │  Shot    │          │
│  │ Parser   │        │ Parser   │        │ Generator│          │
│  │+context  │        │+context  │        │+context  │          │
│  └──────────┘        └──────────┘        └──────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 核心组件设计

#### 3.2.1 GlobalContext 类型定义

```typescript
// types.ts - 扩展ScriptMetadata

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

  // ===== Phase 1 新增字段 =====

  // 1. 故事核心层
  synopsis: string; // 故事梗概（100-200字）
  logline: string; // 一句话简介（30字以内）
  coreConflict: string; // 核心冲突
  theme: string[]; // 主题思想列表

  // 2. 故事结构层
  storyStructure: {
    structureType: 'three_act' | 'hero_journey' | 'five_act' | 'other';
    act1: string; // 第一幕：设定（占25%）
    act2a: string; // 第二幕上：对抗（占25%）
    act2b: string; // 第二幕下：低谷（占25%）
    act3: string; // 第三幕：结局（占25%）
    midpoint: string; // 中点转折
    climax: string; // 高潮
  };

  // 3. 视觉风格层
  visualStyle: {
    artDirection: string; // 美术指导风格
    artStyle: string; // 艺术风格标签
    artStyleDescription: string; // 风格详细描述
    colorPalette: string[]; // 主色调（3-5个）
    colorMood: string; // 色彩情绪
    cinematography: string; // 摄影风格
    lightingStyle: string; // 光影风格
  };

  // 4. 时代背景层
  eraContext: {
    era: string; // 具体年代
    eraDescription: string; // 时代特征
    location: string; // 地理背景
    season: string; // 季节（如贯穿全篇）
    timeOfDay: string; // 主要时间段
  };

  // 5. 参考层
  references: {
    films: string[]; // 参考影片
    directors: string[]; // 参考导演
    artStyles: string[]; // 参考艺术风格
  };

  // 6. 情绪曲线层
  emotionalArc: Array<{
    plotPoint: string; // 情节点
    emotion: string; // 主导情绪
    intensity: number; // 强度 0-10
    colorTone: string; // 对应色调
    percentage: number; // 在故事中的位置 0-100
  }>;

  // 7. 一致性规则层（用于后续阶段校验）
  consistencyRules: {
    characterTraits: Record<string, string[]>; // 角色必须保持的特征
    eraConstraints: string[]; // 时代限制
    styleConstraints: string[]; // 风格限制
    forbiddenElements: string[]; // 禁止出现的元素
  };
}
```

#### 3.2.2 GlobalContextExtractor 服务

```typescript
// services/parsing/GlobalContextExtractor.ts

export interface GlobalContext {
  story: StoryContext;
  visual: VisualContext;
  era: EraContext;
  emotional: EmotionalContext;
  rules: ConsistencyRules;
}

export interface StoryContext {
  synopsis: string;
  logline: string;
  coreConflict: string;
  themes: string[];
  structure: StoryStructure;
}

export interface VisualContext {
  artDirection: string;
  artStyle: string;
  colorPalette: string[];
  colorMood: string;
  cinematography: string;
  lightingStyle: string;
  references: string[];
}

export class GlobalContextExtractor {
  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
  }

  /**
   * 提取全局上下文
   * 在metadata阶段调用，为后续所有阶段提供上下文
   */
  async extract(content: string): Promise<GlobalContext> {
    // 1. 提取故事核心信息
    const storyContext = await this.extractStoryContext(content);

    // 2. 提取视觉风格信息
    const visualContext = await this.extractVisualContext(content, storyContext);

    // 3. 提取时代背景信息
    const eraContext = await this.extractEraContext(content);

    // 4. 构建情绪曲线
    const emotionalContext = await this.extractEmotionalArc(content, storyContext);

    // 5. 生成一致性规则
    const rules = this.generateConsistencyRules(storyContext, visualContext, eraContext);

    return {
      story: storyContext,
      visual: visualContext,
      era: eraContext,
      emotional: emotionalContext,
      rules,
    };
  }

  private async extractStoryContext(content: string): Promise<StoryContext> {
    const prompt = `
请深入分析以下剧本/小说的故事核心：

【剧本内容】
${content.substring(0, 8000)}

请提取：
1. 故事梗概（100-200字，包含开端-发展-高潮-结局）
2. 一句话简介（30字以内，概括核心卖点）
3. 核心冲突（主角面临的主要矛盾）
4. 主题思想（2-3个核心主题）
5. 故事结构类型（三幕式/英雄之旅/五幕式/其他）
6. 各幕内容概要（每幕50字以内）
7. 中点转折和高潮描述

请严格按JSON格式输出。
`;

    const result = await this.llmProvider.generateStructured(prompt, StoryContextSchema);

    return result.data;
  }

  private async extractVisualContext(
    content: string,
    storyContext: StoryContext
  ): Promise<VisualContext> {
    const prompt = `
基于以下故事信息，分析视觉风格：

【故事梗概】
${storyContext.synopsis}

【核心冲突】
${storyContext.coreConflict}

【剧本片段】
${content.substring(0, 5000)}

请定义：
1. 美术指导风格（如：写实电影感、动漫风格、水墨国风等）
2. 艺术风格详细描述（100字以内）
3. 主色调（3-5个十六进制颜色或颜色名称）
4. 色彩情绪（如：温暖明亮、冷峻压抑、复古怀旧）
5. 摄影风格（如：手持纪实、稳定器流畅、电影感构图）
6. 光影风格（如：自然光、戏剧光、 noir风格）
7. 参考影片/导演（1-3个）

请严格按JSON格式输出。
`;

    const result = await this.llmProvider.generateStructured(prompt, VisualContextSchema);

    return result.data;
  }

  // ... 其他提取方法
}
```

#### 3.2.3 上下文注入机制

```typescript
// services/parsing/ContextInjector.ts

export class ContextInjector {
  /**
   * 为角色解析注入上下文
   */
  injectForCharacter(basePrompt: string, context: GlobalContext, characterName: string): string {
    return `
${this.buildStoryContextSection(context.story)}
${this.buildVisualContextSection(context.visual)}
${this.buildEraContextSection(context.era)}
${this.buildConsistencyRulesSection(context.rules, characterName)}

${basePrompt}

【重要提示】
请确保角色描述符合以上全局背景和一致性规则。
`;
  }

  /**
   * 为场景解析注入上下文
   */
  injectForScene(basePrompt: string, context: GlobalContext, sceneName: string): string {
    return `
${this.buildStoryContextSection(context.story)}
${this.buildVisualContextSection(context.visual)}
${this.buildEraContextSection(context.era)}
${this.buildEmotionalContextSection(context.emotional, sceneName)}

${basePrompt}

【重要提示】
1. 场景描述必须符合整体视觉风格：${context.visual.artStyle}
2. 场景色调应与情绪曲线匹配
3. 场景元素必须符合时代背景：${context.era.era}
`;
  }

  /**
   * 为分镜生成注入上下文
   */
  injectForShots(basePrompt: string, context: GlobalContext, sceneInfo: ScriptScene): string {
    return `
${this.buildVisualContextSection(context.visual)}
${this.buildEmotionalContextSection(context.emotional, sceneInfo.name)}

【场景信息】
场景名称：${sceneInfo.name}
场景描述：${sceneInfo.description}
场景功能：${sceneInfo.sceneFunction}

${basePrompt}

【视觉指导】
- 摄影风格：${context.visual.cinematography}
- 光影风格：${context.visual.lightingStyle}
- 参考风格：${context.visual.references.join(', ')}

请确保分镜设计符合以上视觉指导。
`;
  }

  private buildStoryContextSection(story: StoryContext): string {
    return `
【故事背景】
- 梗概：${story.synopsis}
- 核心冲突：${story.coreConflict}
- 主题：${story.themes.join('、')}
- 结构：${story.structure.structureType}
`;
  }

  private buildVisualContextSection(visual: VisualContext): string {
    return `
【视觉风格】
- 美术指导：${visual.artDirection}
- 艺术风格：${visual.artStyle}
- 主色调：${visual.colorPalette.join(', ')}
- 色彩情绪：${visual.colorMood}
- 摄影风格：${visual.cinematography}
- 光影风格：${visual.lightingStyle}
- 参考：${visual.references.join(', ')}
`;
  }

  private buildEraContextSection(era: EraContext): string {
    return `
【时代背景】
- 年代：${era.era}
- 特征：${era.eraDescription}
- 地点：${era.location}
`;
  }

  private buildEmotionalContextSection(emotional: EmotionalContext, sceneName: string): string {
    // 找到与场景相关的情绪点
    const relevantPoints = emotional.arc.filter(
      point => sceneName.includes(point.plotPoint) || point.plotPoint.includes(sceneName)
    );

    if (relevantPoints.length === 0) {
      return '';
    }

    return `
【情绪指导】
${relevantPoints.map(p => `- ${p.plotPoint}：${p.emotion}（强度${p.intensity}/10，色调${p.colorTone}）`).join('\n')}
`;
  }

  private buildConsistencyRulesSection(rules: ConsistencyRules, entityName: string): string {
    const traits = rules.characterTraits[entityName] || [];

    return `
【一致性规则】
${traits.length > 0 ? `- 必须保持的特征：${traits.join('、')}` : ''}
- 时代限制：${rules.eraConstraints.join('、')}
- 风格限制：${rules.styleConstraints.join('、')}
${rules.forbiddenElements.length > 0 ? `- 禁止元素：${rules.forbiddenElements.join('、')}` : ''}
`;
  }
}
```

### 3.3 改造现有解析流程

```typescript
// services/scriptParser.ts - 改造后的parseStage方法

export class ScriptParser {
  private globalContext: GlobalContext | null = null;
  private contextExtractor: GlobalContextExtractor;
  private contextInjector: ContextInjector;

  async parseStage(
    stage: 'metadata' | 'characters' | 'scenes' | 'shots',
    content: string,
    currentState: ScriptParseState,
    onProgress?: ParseProgressCallback
  ): Promise<ScriptParseState> {
    const state: ScriptParseState = { ...currentState };

    try {
      switch (stage) {
        case 'metadata': {
          state.stage = 'metadata';
          state.progress = 10;
          onProgress?.('metadata', 10, '正在提取元数据...');

          // 1. 提取基础metadata
          state.metadata = await this.extractMetadata(content);
          state.progress = 15;

          // 2. 【新增】提取全局上下文
          onProgress?.('metadata', 15, '正在分析故事结构和视觉风格...');
          this.globalContext = await this.contextExtractor.extract(content);

          // 3. 【新增】将全局上下文合并到metadata
          state.metadata = this.mergeGlobalContext(state.metadata, this.globalContext);
          state.progress = 20;
          break;
        }

        case 'characters': {
          if (!state.metadata || !this.globalContext) {
            throw new Error('Metadata and global context must be extracted first');
          }

          state.stage = 'characters';
          state.progress = 25;
          onProgress?.('characters', 25, '正在分析所有角色...');

          // 【改造】使用上下文注入的角色提取
          const characters = await this.extractAllCharactersWithContext(
            content,
            state.metadata.characterNames || [],
            this.globalContext
          );
          state.characters = characters;
          state.progress = 50;
          break;
        }

        case 'scenes': {
          if (!state.metadata || !this.globalContext) {
            throw new Error('Metadata and global context must be extracted first');
          }

          state.stage = 'scenes';
          state.progress = 50;
          onProgress?.('scenes', 50, '正在分析所有场景...');

          // 【改造】使用上下文注入的场景提取
          const scenes = await this.extractAllScenesWithContext(
            content,
            state.metadata.sceneNames || [],
            this.globalContext
          );
          state.scenes = scenes;
          state.progress = 70;
          break;
        }

        case 'shots': {
          if (!state.scenes || !this.globalContext) {
            throw new Error('Scenes and global context must be extracted first');
          }

          state.stage = 'shots';
          state.progress = 70;
          onProgress?.('shots', 70, '正在生成所有分镜...');

          // 【改造】使用上下文注入的分镜生成
          const allShots = await this.generateAllShotsWithContext(
            content,
            state.scenes,
            this.globalContext
          );
          state.shots = allShots;
          state.progress = 95;

          // ... 后续处理
          break;
        }
      }

      return state;
    } catch (error) {
      // 错误处理
      throw error;
    }
  }

  // 【新增】带上下文的角色提取
  private async extractAllCharactersWithContext(
    content: string,
    characterNames: string[],
    context: GlobalContext
  ): Promise<ScriptCharacter[]> {
    const basePrompt = PROMPTS.charactersBatch;
    const injectedPrompt = this.contextInjector.injectForCharacters(
      basePrompt,
      context,
      characterNames
    );

    // 调用LLM并解析结果
    const result = await this.llmProvider.generateStructured(
      injectedPrompt,
      ScriptCharacterArraySchema
    );

    return result.data;
  }

  // 【新增】带上下文的场景提取
  private async extractAllScenesWithContext(
    content: string,
    sceneNames: string[],
    context: GlobalContext
  ): Promise<ScriptScene[]> {
    const basePrompt = PROMPTS.scenesBatch;

    // 为每个场景注入上下文
    const scenes: ScriptScene[] = [];

    for (const sceneName of sceneNames) {
      const injectedPrompt = this.contextInjector.injectForScene(basePrompt, context, sceneName);

      // 批量或单独处理
      // ...
    }

    return scenes;
  }

  // 【新增】带上下文的分镜生成
  private async generateAllShotsWithContext(
    content: string,
    scenes: ScriptScene[],
    context: GlobalContext
  ): Promise<Shot[]> {
    const basePrompt = PROMPTS.shotsBatch;
    const injectedPrompt = this.contextInjector.injectForShots(
      basePrompt,
      context,
      scenes[0] // 示例
    );

    // 调用LLM生成
    // ...
  }
}
```

### 3.4 Schema 更新

```typescript
// services/parsing/ParsingSchemas.ts

// ===== Phase 1 新增 Schemas =====

export const StoryStructureSchema = z.object({
  structureType: z.enum(['three_act', 'hero_journey', 'five_act', 'other']),
  act1: z.string().max(100),
  act2a: z.string().max(100),
  act2b: z.string().max(100),
  act3: z.string().max(100),
  midpoint: z.string().max(100),
  climax: z.string().max(100),
});

export const VisualStyleSchema = z.object({
  artDirection: z.string(),
  artStyle: z.string(),
  artStyleDescription: z.string().max(200),
  colorPalette: z.array(z.string()).min(3).max(5),
  colorMood: z.string(),
  cinematography: z.string(),
  lightingStyle: z.string(),
});

export const EraContextSchema = z.object({
  era: z.string(),
  eraDescription: z.string().max(200),
  location: z.string(),
  season: z.string().optional(),
  timeOfDay: z.string().optional(),
});

export const EmotionalPointSchema = z.object({
  plotPoint: z.string(),
  emotion: z.string(),
  intensity: z.number().min(0).max(10),
  colorTone: z.string(),
  percentage: z.number().min(0).max(100),
});

export const ConsistencyRulesSchema = z.object({
  characterTraits: z.record(z.array(z.string())),
  eraConstraints: z.array(z.string()),
  styleConstraints: z.array(z.string()),
  forbiddenElements: z.array(z.string()),
});

// 扩展 ScriptMetadataSchema
export const ScriptMetadataSchema = z.object({
  // 现有字段...
  title: z.string(),
  wordCount: z.number(),
  // ...

  // Phase 1 新增
  synopsis: z.string().max(300),
  logline: z.string().max(50),
  coreConflict: z.string().max(200),
  theme: z.array(z.string()).max(3),
  storyStructure: StoryStructureSchema,
  visualStyle: VisualStyleSchema,
  eraContext: EraContextSchema,
  emotionalArc: z.array(EmotionalPointSchema).max(10),
  consistencyRules: ConsistencyRulesSchema,
});
```

### 3.5 Phase 1 UI 变更

#### 3.5.1 新增组件

```typescript
// components/ScriptAnalysis/StoryOverviewCard.tsx
// 展示故事梗概、核心冲突、主题

// components/ScriptAnalysis/VisualStyleCard.tsx
// 展示美术风格、色彩方案、参考影片

// components/ScriptAnalysis/EmotionalArcChart.tsx
// 情绪曲线可视化图表

// components/ScriptAnalysis/StoryStructureDiagram.tsx
// 三幕式结构可视化
```

#### 3.5.2 UI 布局更新

```
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 1 UI 布局                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  📊 解析概览                                              │    │
│  │  标题：《暗流》  字数：15,000  预估时长：10分钟             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────┐  ┌────────────────────────────────┐  │
│  │  📖 故事梗概          │  │  🎨 视觉风格                    │  │
│  │                      │  │                                │  │
│  │ 职场新人林薇在鼎盛   │  │  美术风格：写实电影感            │  │
│  │ 集团遭遇空降精英...  │  │  主色调：#2C3E50, #95A5A6      │  │
│  │                      │  │  参考：王家卫、未生              │  │
│  │ 核心冲突：职场权力   │  │                                │  │
│  │ 斗争与个人成长       │  │  [色彩板展示]                   │  │
│  │                      │  │                                │  │
│  │ 主题：权力、成长、   │  │                                │  │
│  │ 自我认同             │  │                                │  │
│  └──────────────────────┘  └────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  📈 情绪曲线                                              │    │
│  │  [折线图展示情绪起伏]                                      │    │
│  │  开端(平静)→冲突(紧张)→高潮(激烈)→结局(释然)              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🏗️ 故事结构                                              │    │
│  │  [三幕式可视化]                                            │    │
│  │  第一幕(设定) ════ 第二幕(对抗) ════ 第三幕(结局)          │    │
│  │  25%           50%           25%                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.6 Phase 1 实施步骤

| 步骤     | 任务                       | 文件                                | 预计时间   | 验证方式           |
| -------- | -------------------------- | ----------------------------------- | ---------- | ------------------ |
| 1.1      | 更新类型定义               | `types.ts`                          | 4小时      | TypeScript编译通过 |
| 1.2      | 创建GlobalContextExtractor | `parsing/GlobalContextExtractor.ts` | 8小时      | 单元测试通过       |
| 1.3      | 创建ContextInjector        | `parsing/ContextInjector.ts`        | 6小时      | 单元测试通过       |
| 1.4      | 更新ParsingSchemas         | `parsing/ParsingSchemas.ts`         | 4小时      | 17项测试通过       |
| 1.5      | 改造ScriptParser           | `scriptParser.ts`                   | 8小时      | 集成测试通过       |
| 1.6      | 创建UI组件                 | `components/ScriptAnalysis/*.tsx`   | 12小时     | 视觉审查通过       |
| 1.7      | 更新ScriptManager          | `views/ScriptManager.tsx`           | 6小时      | 端到端测试         |
| 1.8      | 集成测试                   | -                                   | 8小时      | 全流程测试通过     |
| 1.9      | 性能测试                   | -                                   | 4小时      | 耗时<150%          |
| **总计** |                            |                                     | **60小时** |                    |

### 3.7 Phase 1 成功标准

- [ ] 全局上下文成功提取并注入各阶段
- [ ] 角色描述符合整体视觉风格
- [ ] 场景描述符合时代背景
- [ ] 分镜设计符合摄影风格
- [ ] UI正确展示故事梗概、视觉风格、情绪曲线
- [ ] 解析耗时增加不超过50%
- [ ] API成本增加不超过100%

---

## 四、Phase 2: 迭代优化引擎

### 4.1 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│              Phase 2: 迭代优化引擎架构                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              IterativeRefinementEngine                   │    │
│  │  职责：多轮迭代优化解析结果                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│        ┌─────────────────────┬─────────────────────┐            │
│        ↓                     ↓                     ↓            │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐        │
│  │Consistency│         │ Quality  │         │ Refinement│        │
│  │ Checker   │         │Evaluator │         │ Engine    │        │
│  └──────────┘         └──────────┘         └──────────┘        │
│        │                     │                     │            │
│        ↓                     ↓                     ↓            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Parse State                          │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │    │
│  │  │Metadata │ │Characters│ │ Scenes  │ │  Shots  │       │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  流程：                                                          │
│  1. 快速草稿 → 2. 一致性检查 → 3. 质量评估                      │
│       ↓              ↓              ↓                           │
│  4. 问题识别 → 5. 针对性修正 → 6. 再评估                        │
│       ↓（未达标）                                                │
│  7. 重复2-6（最多3轮）→ 8. 输出最终结果                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 核心组件设计

#### 4.2.1 一致性检查引擎

```typescript
// services/parsing/consistency/ConsistencyChecker.ts

export interface ConsistencyIssue {
  id: string;
  type: ConsistencyIssueType;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  location: {
    stage: ParseStage;
    entity: string;
    field?: string;
  };
  suggestion: string;
  autoFixable: boolean;
}

export enum ConsistencyIssueType {
  // 角色一致性
  CHARACTER_APPEARANCE_MISMATCH = 'character_appearance_mismatch',
  CHARACTER_PERSONALITY_DRIFT = 'character_personality_drift',
  CHARACTER_AGE_INCONSISTENCY = 'character_age_inconsistency',

  // 场景一致性
  SCENE_TIMELINE_CONFLICT = 'scene_timeline_conflict',
  SCENE_LOCATION_MISMATCH = 'scene_location_mismatch',
  SCENE_WEATHER_INCONSISTENCY = 'scene_weather_inconsistency',

  // 视觉一致性
  VISUAL_STYLE_DRIFT = 'visual_style_drift',
  COLOR_PALETTE_MISMATCH = 'color_palette_mismatch',
  ERA_ANACHRONISM = 'era_anachronism',

  // 逻辑一致性
  PLOT_LOGIC_ERROR = 'plot_logic_error',
  CAUSALITY_BREAK = 'causality_break',
  CONTINUITY_ERROR = 'continuity_error',
}

export class ConsistencyChecker {
  private rules: ConsistencyRule[];

  constructor() {
    this.rules = [
      new CharacterAppearanceRule(),
      new CharacterPersonalityRule(),
      new SceneTimelineRule(),
      new VisualStyleRule(),
      new EraConsistencyRule(),
      new PlotLogicRule(),
    ];
  }

  /**
   * 全面一致性检查
   */
  check(state: ScriptParseState): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    for (const rule of this.rules) {
      const ruleIssues = rule.check(state);
      issues.push(...ruleIssues);
    }

    return this.prioritizeIssues(issues);
  }

  /**
   * 快速检查（仅关键问题）
   */
  checkCritical(state: ScriptParseState): ConsistencyIssue[] {
    const allIssues = this.check(state);
    return allIssues.filter(i => i.severity === 'critical');
  }

  private prioritizeIssues(issues: ConsistencyIssue[]): ConsistencyIssue[] {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }
}

// 具体规则实现示例
class CharacterAppearanceRule implements ConsistencyRule {
  check(state: ScriptParseState): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    const { characters, scenes } = state;

    if (!characters || !scenes) return issues;

    for (const character of characters) {
      // 检查角色外貌描述是否一致
      const appearances = this.extractAppearancesFromScenes(character.name, scenes);

      if (appearances.length > 1) {
        const consistency = this.compareAppearances(character.appearance, appearances);

        if (consistency < 0.7) {
          issues.push({
            id: `char_appearance_${character.name}`,
            type: ConsistencyIssueType.CHARACTER_APPEARANCE_MISMATCH,
            severity: 'warning',
            description: `角色"${character.name}"在不同场景中的外貌描述不一致`,
            location: { stage: 'characters', entity: character.name },
            suggestion: '统一角色外貌描述，确保服装、发型等关键特征一致',
            autoFixable: true,
          });
        }
      }
    }

    return issues;
  }

  private extractAppearancesFromScenes(characterName: string, scenes: ScriptScene[]): string[] {
    // 从场景描述中提取角色外貌信息
    // ...
    return [];
  }

  private compareAppearances(base: ScriptCharacter['appearance'], fromScenes: string[]): number {
    // 使用LLM或规则比较外貌描述的一致性
    // 返回0-1的一致性分数
    // ...
    return 1.0;
  }
}

class VisualStyleRule implements ConsistencyRule {
  check(state: ScriptParseState): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    const { metadata, scenes } = state;

    if (!metadata?.visualStyle || !scenes) return issues;

    const globalStyle = metadata.visualStyle.artStyle;

    for (const scene of scenes) {
      // 检查场景visualPrompt是否符合全局风格
      const sceneStyle = this.detectStyle(scene.visualPrompt);

      if (!this.isStyleCompatible(globalStyle, sceneStyle)) {
        issues.push({
          id: `scene_style_${scene.name}`,
          type: ConsistencyIssueType.VISUAL_STYLE_DRIFT,
          severity: 'warning',
          description: `场景"${scene.name}"的视觉风格（${sceneStyle}）与全局风格（${globalStyle}）不一致`,
          location: { stage: 'scenes', entity: scene.name, field: 'visualPrompt' },
          suggestion: `调整场景描述以符合${globalStyle}风格`,
          autoFixable: true,
        });
      }
    }

    return issues;
  }

  private detectStyle(visualPrompt: string): string {
    // 使用关键词匹配或LLM检测风格
    // ...
    return 'unknown';
  }

  private isStyleCompatible(global: string, scene: string): boolean {
    // 判断两种风格是否兼容
    // ...
    return global === scene || this.areStylesSimilar(global, scene);
  }
}
```

#### 4.2.2 质量评估系统

```typescript
// services/parsing/quality/QualityEvaluator.ts

export interface QualityScore {
  overall: number; // 总分 0-100
  dimensions: {
    completeness: number; // 完整性
    consistency: number; // 一致性
    professionalism: number; // 专业性
    usability: number; // 可用性
  };
  details: QualityDetail[];
}

export interface QualityDetail {
  category: string;
  metric: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export class QualityEvaluator {
  private metrics: QualityMetric[];
  private weights = {
    completeness: 0.25,
    consistency: 0.3,
    professionalism: 0.25,
    usability: 0.2,
  };

  constructor() {
    this.metrics = [
      // 完整性指标
      new CharacterCompletenessMetric(),
      new SceneCompletenessMetric(),
      new ShotCoverageMetric(),

      // 一致性指标
      new CharacterConsistencyMetric(),
      new TimelineConsistencyMetric(),
      new VisualConsistencyMetric(),

      // 专业性指标
      new StoryStructureMetric(),
      new VisualGuidanceMetric(),
      new CinematicLanguageMetric(),

      // 可用性指标
      new PromptQualityMetric(),
      new GenerationReadinessMetric(),
    ];
  }

  /**
   * 全面质量评估
   */
  evaluate(state: ScriptParseState): QualityScore {
    const details: QualityDetail[] = [];

    for (const metric of this.metrics) {
      const result = metric.evaluate(state);
      details.push(result);
    }

    // 按维度聚合
    const dimensions = this.aggregateByDimension(details);

    // 计算总分
    const overall =
      dimensions.completeness * this.weights.completeness +
      dimensions.consistency * this.weights.consistency +
      dimensions.professionalism * this.weights.professionalism +
      dimensions.usability * this.weights.usability;

    return {
      overall: Math.round(overall),
      dimensions,
      details,
    };
  }

  /**
   * 判断是否达到质量标准
   */
  meetsThreshold(score: QualityScore, threshold: number = 85): boolean {
    return score.overall >= threshold;
  }

  /**
   * 生成改进建议
   */
  generateImprovementPlan(score: QualityScore): string[] {
    const suggestions: string[] = [];

    // 找出最低分项
    const sortedDetails = [...score.details].sort(
      (a, b) => a.score / a.maxScore - b.score / b.maxScore
    );

    // 优先改进最低分的3项
    for (let i = 0; i < Math.min(3, sortedDetails.length); i++) {
      const detail = sortedDetails[i];
      if (detail.score < detail.maxScore * 0.8) {
        suggestions.push(`${detail.category} - ${detail.metric}: ${detail.feedback}`);
      }
    }

    return suggestions;
  }

  private aggregateByDimension(details: QualityDetail[]): QualityScore['dimensions'] {
    const dimensionScores: Record<string, number[]> = {
      completeness: [],
      consistency: [],
      professionalism: [],
      usability: [],
    };

    for (const detail of details) {
      const dimension = this.getDimensionForCategory(detail.category);
      dimensionScores[dimension].push((detail.score / detail.maxScore) * 100);
    }

    return {
      completeness: this.average(dimensionScores.completeness),
      consistency: this.average(dimensionScores.consistency),
      professionalism: this.average(dimensionScores.professionalism),
      usability: this.average(dimensionScores.usability),
    };
  }

  private getDimensionForCategory(category: string): keyof QualityScore['dimensions'] {
    const mapping: Record<string, keyof QualityScore['dimensions']> = {
      character: 'completeness',
      scene: 'completeness',
      shot: 'completeness',
      consistency: 'consistency',
      structure: 'professionalism',
      visual: 'professionalism',
      cinematic: 'professionalism',
      prompt: 'usability',
      generation: 'usability',
    };
    return mapping[category] || 'usability';
  }

  private average(scores: number[]): number {
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
}

// 具体指标实现示例
class CharacterCompletenessMetric implements QualityMetric {
  evaluate(state: ScriptParseState): QualityDetail {
    const { characters } = state;

    if (!characters || characters.length === 0) {
      return {
        category: 'character',
        metric: 'completeness',
        score: 0,
        maxScore: 100,
        feedback: '未提取到任何角色信息',
      };
    }

    let totalScore = 0;

    for (const char of characters) {
      let charScore = 0;

      // 检查关键字段
      if (char.name) charScore += 20;
      if (char.gender) charScore += 10;
      if (char.age) charScore += 10;
      if (char.appearance?.face) charScore += 15;
      if (char.appearance?.hair) charScore += 15;
      if (char.appearance?.clothing) charScore += 15;
      if (char.personality?.length > 0) charScore += 10;
      if (char.visualPrompt && char.visualPrompt !== char.name) charScore += 5;

      totalScore += charScore;
    }

    const averageScore = totalScore / characters.length;

    return {
      category: 'character',
      metric: 'completeness',
      score: Math.round(averageScore),
      maxScore: 100,
      feedback:
        averageScore >= 80
          ? '角色信息完整度良好'
          : `角色信息完整度较低，建议补充缺失的外貌和性格描述`,
    };
  }
}

class VisualConsistencyMetric implements QualityMetric {
  evaluate(state: ScriptParseState): QualityDetail {
    const { metadata, scenes, characters } = state;

    if (!metadata?.visualStyle) {
      return {
        category: 'consistency',
        metric: 'visual',
        score: 0,
        maxScore: 100,
        feedback: '未定义全局视觉风格',
      };
    }

    // 检查场景和角色的视觉风格一致性
    let consistentCount = 0;
    let totalCount = 0;

    if (scenes) {
      totalCount += scenes.length;
      for (const scene of scenes) {
        if (this.isStyleConsistent(scene.visualPrompt, metadata.visualStyle)) {
          consistentCount++;
        }
      }
    }

    if (characters) {
      totalCount += characters.length;
      for (const char of characters) {
        if (this.isStyleConsistent(char.visualPrompt, metadata.visualStyle)) {
          consistentCount++;
        }
      }
    }

    const score = totalCount > 0 ? (consistentCount / totalCount) * 100 : 0;

    return {
      category: 'consistency',
      metric: 'visual',
      score: Math.round(score),
      maxScore: 100,
      feedback:
        score >= 80
          ? '视觉风格一致性良好'
          : `发现${totalCount - consistentCount}处视觉风格不一致，建议统一调整`,
    };
  }

  private isStyleConsistent(
    visualPrompt: string,
    globalStyle: ScriptMetadata['visualStyle']
  ): boolean {
    // 检查visualPrompt是否包含全局风格的关键词
    const styleKeywords = [
      globalStyle.artStyle,
      ...globalStyle.colorPalette,
      globalStyle.colorMood,
    ];

    return styleKeywords.some(keyword =>
      visualPrompt.toLowerCase().includes(keyword.toLowerCase())
    );
  }
}
```

#### 4.2.3 自动修正引擎

```typescript
// services/parsing/refinement/RefinementEngine.ts

export interface RefinementResult {
  success: boolean;
  state: ScriptParseState;
  changes: ChangeLog[];
  issues: ConsistencyIssue[];
}

export interface ChangeLog {
  type: 'update' | 'add' | 'remove';
  stage: ParseStage;
  entity: string;
  field: string;
  oldValue?: any;
  newValue: any;
  reason: string;
}

export class RefinementEngine {
  private llmProvider: LLMProvider;
  private consistencyChecker: ConsistencyChecker;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
    this.consistencyChecker = new ConsistencyChecker();
  }

  /**
   * 执行一轮优化
   */
  async refine(
    state: ScriptParseState,
    issues: ConsistencyIssue[],
    onProgress?: (message: string) => void
  ): Promise<RefinementResult> {
    const changes: ChangeLog[] = [];
    let refinedState = { ...state };

    // 按优先级处理issues
    const sortedIssues = this.prioritizeIssues(issues);

    for (const issue of sortedIssues) {
      onProgress?.(`正在修正：${issue.description}`);

      if (issue.autoFixable) {
        const result = await this.autoFix(refinedState, issue);
        refinedState = result.state;
        changes.push(...result.changes);
      } else {
        // 记录需要手动修正的问题
        onProgress?.(`[需手动修正] ${issue.description}`);
      }
    }

    // 重新检查一致性
    const remainingIssues = this.consistencyChecker.check(refinedState);

    return {
      success: remainingIssues.filter(i => i.severity === 'critical').length === 0,
      state: refinedState,
      changes,
      issues: remainingIssues,
    };
  }

  /**
   * 自动修正具体问题
   */
  private async autoFix(
    state: ScriptParseState,
    issue: ConsistencyIssue
  ): Promise<{ state: ScriptParseState; changes: ChangeLog[] }> {
    const changes: ChangeLog[] = [];

    switch (issue.type) {
      case ConsistencyIssueType.VISUAL_STYLE_DRIFT:
        return this.fixVisualStyleDrift(state, issue);

      case ConsistencyIssueType.CHARACTER_APPEARANCE_MISMATCH:
        return this.fixCharacterAppearance(state, issue);

      case ConsistencyIssueType.ERA_ANACHRONISM:
        return this.fixEraAnachronism(state, issue);

      default:
        return { state, changes };
    }
  }

  /**
   * 修正视觉风格漂移
   */
  private async fixVisualStyleDrift(
    state: ScriptParseState,
    issue: ConsistencyIssue
  ): Promise<{ state: ScriptParseState; changes: ChangeLog[] }> {
    const changes: ChangeLog[] = [];
    const { scenes, metadata } = state;

    if (!scenes || !metadata?.visualStyle) return { state, changes };

    const sceneIndex = scenes.findIndex(s => s.name === issue.location.entity);
    if (sceneIndex === -1) return { state, changes };

    const scene = scenes[sceneIndex];
    const globalStyle = metadata.visualStyle;

    // 使用LLM修正visualPrompt
    const prompt = `
请调整以下场景描述，使其符合指定的视觉风格。

【场景信息】
名称：${scene.name}
描述：${scene.description}
当前visualPrompt：${scene.visualPrompt}

【目标视觉风格】
美术风格：${globalStyle.artStyle}
主色调：${globalStyle.colorPalette.join(', ')}
色彩情绪：${globalStyle.colorMood}

请重新生成visualPrompt，确保：
1. 包含美术风格关键词
2. 体现主色调
3. 符合色彩情绪
4. 保持场景核心内容不变

只输出新的visualPrompt，不要其他内容。
`;

    const result = await this.llmProvider.generate(prompt);

    if (result.success && result.data) {
      const oldValue = scene.visualPrompt;
      const newValue = result.data.trim();

      // 更新场景
      const updatedScenes = [...scenes];
      updatedScenes[sceneIndex] = {
        ...scene,
        visualPrompt: newValue,
      };

      changes.push({
        type: 'update',
        stage: 'scenes',
        entity: scene.name,
        field: 'visualPrompt',
        oldValue,
        newValue,
        reason: `修正视觉风格漂移：${issue.description}`,
      });

      return {
        state: { ...state, scenes: updatedScenes },
        changes,
      };
    }

    return { state, changes };
  }

  /**
   * 修正角色外貌不一致
   */
  private async fixCharacterAppearance(
    state: ScriptParseState,
    issue: ConsistencyIssue
  ): Promise<{ state: ScriptParseState; changes: ChangeLog[] }> {
    // 实现角色外貌统一逻辑
    // ...
    return { state, changes: [] };
  }

  /**
   * 修正时代错误
   */
  private async fixEraAnachronism(
    state: ScriptParseState,
    issue: ConsistencyIssue
  ): Promise<{ state: ScriptParseState; changes: ChangeLog[] }> {
    // 实现时代一致性修正逻辑
    // ...
    return { state, changes: [] };
  }

  private prioritizeIssues(issues: ConsistencyIssue[]): ConsistencyIssue[] {
    // 按严重程度和可自动修复性排序
    const severityOrder = { critical: 0, warning: 1, info: 2 };

    return issues.sort((a, b) => {
      // 优先处理可自动修复的
      if (a.autoFixable !== b.autoFixable) {
        return a.autoFixable ? -1 : 1;
      }
      // 再按严重程度
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }
}
```

#### 4.2.4 迭代优化主引擎

```typescript
// services/parsing/IterativeRefinementEngine.ts

export interface IterativeParseOptions {
  maxIterations: number; // 最大迭代次数（默认3）
  qualityThreshold: number; // 质量阈值（默认85）
  enableAutoFix: boolean; // 启用自动修正（默认true）
  stopOnCriticalIssue: boolean; // 遇到关键问题停止（默认false）
}

const DEFAULT_OPTIONS: IterativeParseOptions = {
  maxIterations: 3,
  qualityThreshold: 85,
  enableAutoFix: true,
  stopOnCriticalIssue: false,
};

export class IterativeRefinementEngine {
  private parser: ScriptParser;
  private consistencyChecker: ConsistencyChecker;
  private qualityEvaluator: QualityEvaluator;
  private refinementEngine: RefinementEngine;
  private options: IterativeParseOptions;

  constructor(
    parser: ScriptParser,
    llmProvider: LLMProvider,
    options: Partial<IterativeParseOptions> = {}
  ) {
    this.parser = parser;
    this.consistencyChecker = new ConsistencyChecker();
    this.qualityEvaluator = new QualityEvaluator();
    this.refinementEngine = new RefinementEngine(llmProvider);
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 执行迭代优化解析
   */
  async parseWithRefinement(
    content: string,
    onProgress?: ParseProgressCallback
  ): Promise<{
    state: ScriptParseState;
    iterations: number;
    qualityScore: QualityScore;
    issues: ConsistencyIssue[];
    changes: ChangeLog[];
  }> {
    const allChanges: ChangeLog[] = [];

    // 第一轮：快速草稿
    onProgress?.('idle', 0, '开始第一轮解析（快速草稿）...');
    let state = await this.runInitialParse(content, onProgress);

    // 迭代优化
    for (let iteration = 1; iteration <= this.options.maxIterations; iteration++) {
      onProgress?.(state.stage, state.progress, `开始第${iteration}轮优化...`);

      // 1. 一致性检查
      onProgress?.(state.stage, state.progress, '正在检查一致性...');
      const issues = this.consistencyChecker.check(state);

      const criticalIssues = issues.filter(i => i.severity === 'critical');
      if (criticalIssues.length > 0 && this.options.stopOnCriticalIssue) {
        onProgress?.(
          state.stage,
          state.progress,
          `发现${criticalIssues.length}个关键问题，停止迭代`
        );
        break;
      }

      // 2. 质量评估
      onProgress?.(state.stage, state.progress, '正在评估质量...');
      const qualityScore = this.qualityEvaluator.evaluate(state);

      // 3. 检查是否达标
      if (this.qualityEvaluator.meetsThreshold(qualityScore, this.options.qualityThreshold)) {
        onProgress?.(
          state.stage,
          state.progress,
          `质量评分${qualityScore.overall}，达到标准，优化完成`
        );
        break;
      }

      // 4. 执行优化
      if (this.options.enableAutoFix && issues.length > 0) {
        onProgress?.(state.stage, state.progress, `发现${issues.length}个问题，正在优化...`);
        const refinementResult = await this.refinementEngine.refine(state, issues, msg =>
          onProgress?.(state.stage, state.progress, msg)
        );

        state = refinementResult.state;
        allChanges.push(...refinementResult.changes);

        onProgress?.(
          state.stage,
          state.progress,
          `第${iteration}轮优化完成，修正了${refinementResult.changes.length}个问题`
        );
      } else {
        // 无法自动修复，结束迭代
        break;
      }
    }

    // 最终评估
    const finalScore = this.qualityEvaluator.evaluate(state);
    const finalIssues = this.consistencyChecker.check(state);

    return {
      state,
      iterations: 1 + Math.ceil(allChanges.length / 10), // 估算迭代次数
      qualityScore: finalScore,
      issues: finalIssues,
      changes: allChanges,
    };
  }

  /**
   * 初始解析（快速草稿）
   */
  private async runInitialParse(
    content: string,
    onProgress?: ParseProgressCallback
  ): Promise<ScriptParseState> {
    // 使用现有的parse方法
    return this.parser.parse(content, onProgress);
  }
}
```

### 4.3 Phase 2 UI 变更

#### 4.3.1 新增组件

```typescript
// components/ScriptAnalysis/QualityDashboard.tsx
// 质量评估仪表盘

// components/ScriptAnalysis/ConsistencyReport.tsx
// 一致性检查报告

// components/ScriptAnalysis/RefinementLog.tsx
// 优化日志展示

// components/ScriptAnalysis/QualityScoreCard.tsx
// 质量分数卡片
```

#### 4.3.2 UI 布局

```
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 2 UI 布局                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  📊 质量评估总览                                          │    │
│  │  总分：87/100  等级：A                                    │    │
│  │  [雷达图展示各维度分数]                                    │    │
│  │  完整性:85  一致性:92  专业性:80  可用性:88               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🔍 一致性检查报告                                        │    │
│  │                                                          │    │
│  │  ⚠️ 警告 (2)                                             │    │
│  │  ├─ 角色"林薇"在第3场景和第5场景的服装描述不一致          │    │
│  │  │   [查看详情] [一键修正]                                │    │
│  │  └─ 场景"办公室"的视觉风格与全局风格不完全匹配           │    │
│  │       [查看详情] [一键修正]                                │    │
│  │                                                          │    │
│  │  ✅ 已通过 (15)                                          │    │
│  │  ├─ 角色外貌一致性                                        │    │
│  │  ├─ 场景时间线逻辑                                        │    │
│  │  └─ ...                                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  📝 优化日志                                              │    │
│  │  共执行3轮优化，修正8个问题                               │    │
│  │                                                          │    │
│  │  第3轮优化 (2分钟前)                                      │    │
│  │  ├─ 修正场景"会议室"的visualPrompt                        │    │
│  │  │   原因：视觉风格漂移                                   │    │
│  │  │   [查看变更]                                           │    │
│  │  └─ 统一角色"江哲"的服装描述                              │    │
│  │       原因：跨场景不一致                                   │    │
│  │       [查看变更]                                           │    │
│  │                                                          │    │
│  │  [展开查看更多日志...]                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🎯 改进建议                                              │    │
│  │  基于质量评估，建议优先改进以下方面：                      │    │
│  │  1. 补充场景"走廊"的环境描述细节                          │    │
│  │  2. 优化角色"顾衍之"的visualPrompt质量                   │    │
│  │  3. 检查分镜12-15的连续性                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 Phase 2 实施步骤

| 步骤     | 任务                          | 文件                                          | 预计时间   | 验证方式   |
| -------- | ----------------------------- | --------------------------------------------- | ---------- | ---------- |
| 2.1      | 创建ConsistencyChecker框架    | `parsing/consistency/ConsistencyChecker.ts`   | 4小时      | 单元测试   |
| 2.2      | 实现角色一致性规则            | `parsing/consistency/rules/CharacterRules.ts` | 6小时      | 单元测试   |
| 2.3      | 实现场景一致性规则            | `parsing/consistency/rules/SceneRules.ts`     | 6小时      | 单元测试   |
| 2.4      | 实现视觉一致性规则            | `parsing/consistency/rules/VisualRules.ts`    | 4小时      | 单元测试   |
| 2.5      | 创建QualityEvaluator          | `parsing/quality/QualityEvaluator.ts`         | 6小时      | 单元测试   |
| 2.6      | 实现质量指标                  | `parsing/quality/metrics/*.ts`                | 8小时      | 单元测试   |
| 2.7      | 创建RefinementEngine          | `parsing/refinement/RefinementEngine.ts`      | 8小时      | 单元测试   |
| 2.8      | 创建IterativeRefinementEngine | `parsing/IterativeRefinementEngine.ts`        | 6小时      | 集成测试   |
| 2.9      | 集成到ScriptParser            | `scriptParser.ts`                             | 6小时      | 集成测试   |
| 2.10     | 创建UI组件                    | `components/ScriptAnalysis/*.tsx`             | 12小时     | 视觉审查   |
| 2.11     | 集成测试                      | -                                             | 12小时     | 全流程测试 |
| 2.12     | 性能优化                      | -                                             | 8小时      | 性能测试   |
| **总计** |                               |                                               | **96小时** |            |

### 4.5 Phase 2 成功标准

- [ ] 一致性检查覆盖所有关键维度
- [ ] 质量评估体系完整运行
- [ ] 自动修正引擎成功修正>70%的问题
- [ ] 迭代优化后质量分数提升>15分
- [ ] UI正确展示质量报告和优化日志
- [ ] 平均迭代次数<3轮
- [ ] 解析耗时增加不超过100%

---

## 五、Phase 3: 专业分析模块

### 5.1 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│              Phase 3: 专业分析模块架构                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Professional Analysis Layer                 │    │
│  │  职责：提供影视工业级的专业分析                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│        ┌─────────────────────┼─────────────────────┐            │
│        ↓                     ↓                     ↓            │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐        │
│  │ Screenplay│         │  Visual  │         │  Sound   │        │
│  │ Structure │         │    Previz│         │  Design  │        │
│  │  Analyzer │         │          │         │          │        │
│  └──────────┘         └──────────┘         └──────────┘        │
│        │                     │                     │            │
│        ↓                     ↓                     ↓            │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐        │
│  │ Beat Sheet│         │ Mood Board│         │ Soundscape│        │
│  │ Plot Points│        │ Color Script│       │ Music Arc │        │
│  │ Character Arc│      │ Shot Language│      │ SFX Markers│       │
│  └──────────┘         └──────────┘         └──────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 剧本结构分析模块

```typescript
// services/parsing/professional/ScreenplayStructureAnalyzer.ts

export interface ScreenplayStructure {
  structureType: 'three_act' | 'hero_journey' | 'five_act' | 'save_the_cat' | 'custom';
  confidence: number; // 结构识别置信度 0-100

  // 节拍表
  beatSheet: Beat[];

  // 情节点
  plotPoints: PlotPoint[];

  // 角色弧光
  characterArcs: CharacterArc[];

  // 幕结构
  acts: Act[];
}

export interface Beat {
  name: string; // 节拍名称（如：开场画面、主题呈现）
  description: string; // 节拍描述
  percentage: number; // 在故事中的位置 0-100
  sceneRef?: string; // 关联场景
}

export interface PlotPoint {
  type:
    | 'inciting_incident'
    | 'first_plot_point'
    | 'midpoint'
    | 'second_plot_point'
    | 'climax'
    | 'resolution';
  description: string;
  percentage: number;
  sceneRef?: string;
  impact: string; // 对故事的影响
}

export interface CharacterArc {
  characterName: string;
  arcType: 'positive_change' | 'negative_change' | 'flat' | 'transformation';
  startingState: string;
  endingState: string;
  keyMoments: Array<{
    description: string;
    percentage: number;
    change: string;
  }>;
}

export interface Act {
  number: number;
  name: string;
  description: string;
  percentage: { start: number; end: number };
  keyEvents: string[];
}

export class ScreenplayStructureAnalyzer {
  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
  }

  /**
   * 分析剧本结构
   */
  async analyze(content: string, metadata: ScriptMetadata): Promise<ScreenplayStructure> {
    // 1. 识别故事结构类型
    const structureType = await this.detectStructureType(content);

    // 2. 生成节拍表
    const beatSheet = await this.generateBeatSheet(content, structureType);

    // 3. 识别情节点
    const plotPoints = await this.identifyPlotPoints(content, structureType);

    // 4. 分析角色弧光
    const characterArcs = await this.analyzeCharacterArcs(content, metadata.characterNames);

    // 5. 构建幕结构
    const acts = this.buildActs(structureType, beatSheet, plotPoints);

    return {
      structureType: structureType.type,
      confidence: structureType.confidence,
      beatSheet,
      plotPoints,
      characterArcs,
      acts,
    };
  }

  private async detectStructureType(content: string): Promise<{
    type: ScreenplayStructure['structureType'];
    confidence: number;
  }> {
    const prompt = `
分析以下剧本的故事结构类型：

【剧本内容】
${content.substring(0, 10000)}

请判断最符合以下哪种经典结构：
1. Three-Act Structure（三幕式结构）
2. Hero's Journey（英雄之旅）
3. Five-Act Structure（五幕式结构）
4. Save the Cat（救猫咪节拍表）
5. Custom（自定义结构）

请输出结构类型和置信度（0-100）。
`;

    const result = await this.llmProvider.generateStructured(prompt, StructureTypeSchema);

    return result.data;
  }

  private async generateBeatSheet(
    content: string,
    structureType: { type: string }
  ): Promise<Beat[]> {
    // 根据结构类型生成对应的节拍表
    const prompt = `
基于${structureType.type}结构，为以下剧本生成节拍表：

【剧本内容】
${content.substring(0, 15000)}

请识别关键节拍，包括：
- 开场画面
- 主题呈现
- 铺垫
- 催化剂
- 争论
- 第二幕衔接点
- B故事
- 游戏
- 中点
- 坏蛋逼近
- 一无所有
- 灵魂黑夜
- 第三幕衔接点
- 结局
- 终场画面

每个节拍包含：名称、描述、在故事中的位置（0-100%）。
`;

    const result = await this.llmProvider.generateStructured(prompt, BeatSheetSchema);

    return result.data.beats;
  }

  // ... 其他分析方法
}
```

### 5.3 视觉预演模块

```typescript
// services/parsing/professional/VisualPrevisualizer.ts

export interface VisualPreviz {
  // 氛围板
  moodBoard: MoodBoard;

  // 色彩脚本
  colorScript: ColorScript;

  // 镜头语言设计
  shotLanguage: ShotLanguage;

  // 光影方案
  lightingDesign: LightingDesign;
}

export interface MoodBoard {
  overallMood: string;
  keyScenes: Array<{
    sceneName: string;
    mood: string;
    visualKeywords: string[];
    referenceImages?: string[];
  }>;
}

export interface ColorScript {
  palette: {
    primary: string[];
    secondary: string[];
    accent: string[];
  };
  sceneColors: Array<{
    sceneName: string;
    dominantColor: string;
    colorEmotion: string;
  }>;
  emotionalColorMap: Array<{
    emotion: string;
    color: string;
    intensity: number;
  }>;
}

export interface ShotLanguage {
  dominantShotTypes: Array<{
    type: string;
    percentage: number;
    purpose: string;
  }>;
  cameraMovementStyle: string;
  framingStyle: string;
  keyShots: Array<{
    description: string;
    shotType: string;
    purpose: string;
  }>;
}

export interface LightingDesign {
  dominantStyle: string;
  keyLightingSetups: Array<{
    sceneType: string;
    lighting: string;
    mood: string;
  }>;
  timeOfDayLighting: Record<string, string>;
}

export class VisualPrevisualizer {
  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
  }

  /**
   * 生成视觉预演
   */
  async generate(
    content: string,
    metadata: ScriptMetadata,
    scenes: ScriptScene[]
  ): Promise<VisualPreviz> {
    // 1. 生成氛围板
    const moodBoard = await this.generateMoodBoard(content, metadata, scenes);

    // 2. 生成色彩脚本
    const colorScript = await this.generateColorScript(metadata, scenes);

    // 3. 设计镜头语言
    const shotLanguage = await this.designShotLanguage(content, scenes);

    // 4. 设计光影方案
    const lightingDesign = await this.designLighting(scenes);

    return {
      moodBoard,
      colorScript,
      shotLanguage,
      lightingDesign,
    };
  }

  private async generateMoodBoard(
    content: string,
    metadata: ScriptMetadata,
    scenes: ScriptScene[]
  ): Promise<MoodBoard> {
    const prompt = `
为以下剧本生成氛围板（Mood Board）：

【故事信息】
标题：${metadata.title}
梗概：${metadata.synopsis}
美术风格：${metadata.visualStyle?.artStyle}
色彩情绪：${metadata.visualStyle?.colorMood}

【关键场景】
${scenes
  .slice(0, 5)
  .map(s => `- ${s.name}: ${s.description}`)
  .join('\n')}

请生成氛围板，包括：
1. 整体氛围描述
2. 每个关键场景的氛围、视觉关键词
3. 参考图像描述（用于后续生成参考图）
`;

    const result = await this.llmProvider.generateStructured(prompt, MoodBoardSchema);

    return result.data;
  }

  // ... 其他生成方法
}
```

### 5.4 声音设计模块

```typescript
// services/parsing/professional/SoundDesigner.ts

export interface SoundDesign {
  // 音景规划
  soundscape: Soundscape;

  // 音乐情绪曲线
  musicArc: MusicArc;

  // 关键音效标记
  keySFX: KeySFX[];
}

export interface Soundscape {
  overallStyle: string;
  ambientSounds: Array<{
    sceneType: string;
    ambient: string;
    volume: 'low' | 'medium' | 'high';
  }>;
  environmentalSounds: string[];
}

export interface MusicArc {
  overallStyle: string;
  emotionalCurve: Array<{
    plotPoint: string;
    emotion: string;
    musicStyle: string;
    intensity: number;
  }>;
  keyMusicalMoments: Array<{
    description: string;
    musicType: string;
    purpose: string;
  }>;
}

export interface KeySFX {
  sceneName: string;
  shotSequence?: number;
  sound: string;
  type: 'ambient' | 'foley' | 'sfx' | 'music';
  importance: 'critical' | 'important' | 'optional';
  description: string;
}

export class SoundDesigner {
  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
  }

  /**
   * 设计声音方案
   */
  async design(
    content: string,
    metadata: ScriptMetadata,
    scenes: ScriptScene[],
    shots: Shot[]
  ): Promise<SoundDesign> {
    // 1. 规划音景
    const soundscape = await this.planSoundscape(content, scenes);

    // 2. 设计音乐情绪曲线
    const musicArc = await this.designMusicArc(metadata, scenes);

    // 3. 标记关键音效
    const keySFX = await this.markKeySFX(scenes, shots);

    return {
      soundscape,
      musicArc,
      keySFX,
    };
  }

  // ... 实现方法
}
```

### 5.5 Phase 3 UI 变更

```
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 3 UI 布局                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Tab导航] 概览 | 剧本结构 | 视觉预演 | 声音设计 | 分镜列表      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  📖 剧本结构分析                                          │    │
│  │                                                          │    │
│  │  结构类型：三幕式（置信度92%）                            │    │
│  │                                                          │    │
│  │  [时间轴可视化]                                            │    │
│  │  0%────25%────50%────75%────100%                         │    │
│  │   │第一幕│  第二幕  │  第三幕  │                          │    │
│  │   ▼     ▼         ▼         ▼                           │    │
│  │  [开场] [催化剂]  [中点]   [高潮]                        │    │
│  │                                                          │    │
│  │  角色弧光：                                               │    │
│  │  ├─ 林薇：正向变化弧（天真→成熟）                         │    │
│  │  │   [变化曲线图]                                         │    │
│  │  └─ 江哲：扁平弧（始终冷静理性）                          │    │
│  │       [变化曲线图]                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🎨 视觉预演                                              │    │
│  │                                                          │    │
│  │  氛围板：                                                 │    │
│  │  [图片网格展示各场景氛围参考]                              │    │
│  │                                                          │    │
│  │  色彩脚本：                                               │    │
│  │  [色彩条展示全片色彩变化]                                  │    │
│  │  开端:#2C3E50 → 发展:#95A5A6 → 高潮:#E74C3C → 结局:#F39C12│    │
│  │                                                          │    │
│  │  镜头语言：                                               │    │
│  │  主导景别：中景(40%) 近景(30%) 全景(20%) 其他(10%)        │    │
│  │  运镜风格：稳定器流畅，商务精英感                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🔊 声音设计                                              │    │
│  │                                                          │    │
│  │  音乐情绪曲线：                                           │    │
│  │  [波形图展示音乐强度变化]                                  │    │
│  │                                                          │    │
│  │  关键音效标记：                                           │    │
│  │  ├─ 场景1-镜头1：办公室环境音 [重要]                      │    │
│  │  ├─ 场景3-镜头2：文件掉落声 [关键]                        │    │
│  │  └─ 场景5-镜头1：紧张背景音乐 [关键]                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.6 Phase 3 实施步骤

| 步骤     | 任务                            | 文件                                                  | 预计时间   | 验证方式   |
| -------- | ------------------------------- | ----------------------------------------------------- | ---------- | ---------- |
| 3.1      | 创建ScreenplayStructureAnalyzer | `parsing/professional/ScreenplayStructureAnalyzer.ts` | 10小时     | 单元测试   |
| 3.2      | 创建VisualPrevisualizer         | `parsing/professional/VisualPrevisualizer.ts`         | 10小时     | 单元测试   |
| 3.3      | 创建SoundDesigner               | `parsing/professional/SoundDesigner.ts`               | 8小时      | 单元测试   |
| 3.4      | 集成专业分析模块                | `scriptParser.ts`                                     | 6小时      | 集成测试   |
| 3.5      | 创建剧本结构UI                  | `components/ScriptAnalysis/StructureTab.tsx`          | 10小时     | 视觉审查   |
| 3.6      | 创建视觉预演UI                  | `components/ScriptAnalysis/VisualPrevizTab.tsx`       | 10小时     | 视觉审查   |
| 3.7      | 创建声音设计UI                  | `components/ScriptAnalysis/SoundDesignTab.tsx`        | 8小时      | 视觉审查   |
| 3.8      | 更新ScriptManager               | `views/ScriptManager.tsx`                             | 6小时      | 端到端测试 |
| 3.9      | 集成测试                        | -                                                     | 16小时     | 全流程测试 |
| **总计** |                                 |                                                       | **94小时** |            |

### 5.7 Phase 3 成功标准

- [ ] 剧本结构分析准确率>85%
- [ ] 节拍表完整度>90%
- [ ] 角色弧光识别准确率>80%
- [ ] 视觉预演方案可用性>75%
- [ ] 声音设计方案完整性>80%
- [ ] UI正确展示专业分析结果
- [ ] 用户满意度>4.5/5

---

## 六、UI/UX 全面升级

### 6.1 整体布局重构

```
┌─────────────────────────────────────────────────────────────────┐
│  🎬 Kmeng AI Animata                                    [设置] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌─────────────────────────────────────────┐  │
│  │              │  │  剧本管理 / 《暗流》                     │  │
│  │   侧边导航    │  │                                         │  │
│  │              │  │  [Tab: 概览 | 结构 | 视觉 | 声音 | 分镜] │  │
│  │  📊 概览      │  │                                         │  │
│  │  📖 结构      │  │  ┌─────────────────────────────────┐   │  │
│  │  🎨 视觉      │  │  │                                 │   │  │
│  │  🔊 声音      │  │  │      [当前Tab内容区域]           │   │  │
│  │  🎬 分镜      │  │  │                                 │   │  │
│  │  👤 角色      │  │  │                                 │   │  │
│  │  🏢 场景      │  │  │                                 │   │  │
│  │  📦 物品      │  │  │                                 │   │  │
│  │              │  │  └─────────────────────────────────┘   │  │
│  └──────────────┘  └─────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 新增页面/组件清单

| 类别       | 组件名               | 功能描述                 | 优先级 |
| ---------- | -------------------- | ------------------------ | ------ |
| **概览页** | StoryOverviewCard    | 故事梗概、核心冲突、主题 | P0     |
|            | QualityDashboard     | 质量评估仪表盘           | P0     |
|            | ConsistencySummary   | 一致性检查摘要           | P0     |
| **结构页** | StructureTimeline    | 剧本结构时间轴           | P1     |
|            | BeatSheetView        | 节拍表展示               | P1     |
|            | CharacterArcChart    | 角色弧光图表             | P1     |
|            | PlotPointsMarker     | 情节点标记               | P1     |
| **视觉页** | MoodBoardGallery     | 氛围板画廊               | P1     |
|            | ColorScriptBar       | 色彩脚本条               | P1     |
|            | ShotLanguageStats    | 镜头语言统计             | P2     |
|            | LightingDesignPanel  | 光影方案面板             | P2     |
| **声音页** | MusicArcChart        | 音乐情绪曲线             | P2     |
|            | SoundscapePanel      | 音景规划面板             | P2     |
|            | SFXMarkerList        | 音效标记列表             | P2     |
| **通用**   | RefinementLogPanel   | 优化日志面板             | P0     |
|            | QualityScoreRing     | 质量分数环形图           | P0     |
|            | ConsistencyIssueCard | 一致性问题卡片           | P0     |

### 6.3 交互设计规范

```typescript
// 交互状态定义
interface UIInteractionStates {
  // 解析状态
  parsing: {
    idle: '准备就绪';
    extracting: '正在提取...';
    analyzing: '正在分析...';
    refining: '正在优化...';
    completed: '解析完成';
    error: '解析出错';
  };

  // 优化状态
  refinement: {
    checking: '检查一致性...';
    evaluating: '评估质量...';
    fixing: '自动修正...';
    improved: '已优化';
    manual: '需手动修正';
  };

  // 质量等级
  quality: {
    excellent: { min: 90; color: 'success'; label: '优秀' };
    good: { min: 80; color: 'primary'; label: '良好' };
    acceptable: { min: 70; color: 'warning'; label: '可接受' };
    poor: { min: 0; color: 'danger'; label: '需改进' };
  };
}

// 动画规范
const animations = {
  // 进度条动画
  progressBar: {
    duration: 300,
    easing: 'ease-out',
  },
  // 卡片入场
  cardEnter: {
    duration: 400,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    stagger: 50,
  },
  // 数据更新
  dataUpdate: {
    duration: 200,
    easing: 'ease-in-out',
  },
};
```

---

## 七、测试验证策略

### 7.1 测试金字塔

```
                    ┌─────────┐
                    │  E2E   │  ← 端到端测试 (10%)
                    │  测试   │     验证完整用户流程
                    └────┬────┘
                   ┌─────┴─────┐
                   │ Integration│  ← 集成测试 (20%)
                   │   测试     │     验证模块间协作
                   └─────┬─────┘
              ┌─────────┴─────────┐
              │     Unit Tests     │  ← 单元测试 (70%)
              │      单元测试       │     验证单个函数/组件
              └───────────────────┘
```

### 7.2 各阶段测试计划

#### Phase 1 测试

| 测试类型 | 测试内容               | 覆盖率目标 | 自动化 |
| -------- | ---------------------- | ---------- | ------ |
| 单元测试 | GlobalContextExtractor | >90%       | ✅     |
| 单元测试 | ContextInjector        | >90%       | ✅     |
| 集成测试 | 上下文注入流程         | >80%       | ✅     |
| E2E测试  | 完整解析流程           | 核心路径   | ✅     |
| 性能测试 | 解析耗时               | 基准对比   | ✅     |

#### Phase 2 测试

| 测试类型 | 测试内容           | 覆盖率目标 | 自动化 |
| -------- | ------------------ | ---------- | ------ |
| 单元测试 | ConsistencyChecker | >90%       | ✅     |
| 单元测试 | QualityEvaluator   | >90%       | ✅     |
| 单元测试 | RefinementEngine   | >85%       | ✅     |
| 集成测试 | 迭代优化流程       | >80%       | ✅     |
| E2E测试  | 质量报告展示       | 核心路径   | ✅     |

#### Phase 3 测试

| 测试类型 | 测试内容                    | 覆盖率目标 | 自动化 |
| -------- | --------------------------- | ---------- | ------ |
| 单元测试 | ScreenplayStructureAnalyzer | >85%       | ✅     |
| 单元测试 | VisualPrevisualizer         | >85%       | ✅     |
| 单元测试 | SoundDesigner               | >85%       | ✅     |
| 集成测试 | 专业分析模块                | >75%       | ✅     |
| E2E测试  | 专业分析UI                  | 核心路径   | ✅     |

### 7.3 质量门禁

```yaml
# 合并前必须通过的检查
quality_gates:
  - name: 单元测试覆盖率
    threshold: 80%
    required: true

  - name: 集成测试通过率
    threshold: 100%
    required: true

  - name: TypeScript编译
    command: tsc --noEmit
    required: true

  - name: Lint检查
    command: npm run lint
    required: true

  - name: 性能回归
    threshold: 150% # 不超过基准的150%
    required: true
```

---

## 八、实施路线图与里程碑

### 8.1 总体时间线

```
2026年3月          2026年4月          2026年5月          2026年6月
   │                  │                  │                  │
   ▼                  ▼                  ▼                  ▼
┌──────┐        ┌──────────┐        ┌──────────┐        ┌──────┐
│Phase1│        │  Phase2  │        │  Phase3  │        │ 优化 │
│3周   │        │   4周    │        │   4周    │        │ 1周  │
│      │        │          │        │          │        │      │
│上下文│        │ 迭代优化 │        │ 专业分析 │        │ 性能 │
│感知  │        │  引擎    │        │  模块    │        │ 调优 │
└──────┘        └──────────┘        └──────────┘        └──────┘
   │                  │                  │                  │
   ▼                  ▼                  ▼                  ▼
里程碑1            里程碑2            里程碑3            里程碑4
MVP完成            质量提升           专业级功能         生产就绪
```

### 8.2 详细里程碑

#### 里程碑1：Phase 1 完成（第3周末）

**目标**：上下文感知解析系统上线

**交付物**：

- [ ] GlobalContextExtractor 服务
- [ ] ContextInjector 机制
- [ ] 扩展的 ScriptMetadata 类型
- [ ] 更新的 UI 组件
- [ ] 单元测试覆盖率>90%

**验收标准**：

- 全局上下文成功提取并注入
- 角色/场景描述符合整体风格
- UI正确展示故事梗概、视觉风格

#### 里程碑2：Phase 2 完成（第7周末）

**目标**：迭代优化引擎上线

**交付物**：

- [ ] ConsistencyChecker 服务
- [ ] QualityEvaluator 系统
- [ ] RefinementEngine 引擎
- [ ] 质量报告UI
- [ ] 优化日志UI

**验收标准**：

- 自动检测并修正一致性问题
- 质量分数提升>15分
- 平均迭代次数<3轮

#### 里程碑3：Phase 3 完成（第11周末）

**目标**：专业分析模块上线

**交付物**：

- [ ] 剧本结构分析器
- [ ] 视觉预演生成器
- [ ] 声音设计器
- [ ] 专业分析UI（结构/视觉/声音Tab）

**验收标准**：

- 剧本结构识别准确率>85%
- 视觉预演方案可用
- 用户满意度>4.5/5

#### 里程碑4：生产就绪（第12周末）

**目标**：系统生产环境就绪

**交付物**：

- [ ] 性能优化完成
- [ ] 完整文档
- [ ] 运维监控
- [ ] 用户手册

**验收标准**：

- 解析耗时<基准150%
- API成本<基准200%
- 系统稳定性>99.5%

### 8.3 资源需求

| 资源类型     | 需求         | 说明                |
| ------------ | ------------ | ------------------- |
| **开发人力** | 1-2人        | 全职开发            |
| **LLM API**  | 增加100-200% | 上下文提取+迭代优化 |
| **测试样本** | 50+剧本      | 覆盖不同 genre/长度 |
| **用户测试** | 10+用户      | 真实使用场景反馈    |

---

## 九、风险评估与应对

### 9.1 风险矩阵

| 风险              | 概率 | 影响 | 风险等级 | 应对策略                    |
| ----------------- | ---- | ---- | -------- | --------------------------- |
| LLM提取质量不稳定 | 中   | 高   | 🔴 高    | 多模型fallback+人工校验机制 |
| API成本超预算     | 中   | 中   | 🟡 中    | 配置开关+分级服务           |
| 解析耗时过长      | 低   | 中   | 🟡 中    | 异步处理+缓存优化           |
| 向后兼容问题      | 低   | 高   | 🟡 中    | 字段全部optional+版本控制   |
| 用户不接受新UI    | 低   | 中   | 🟢 低    | A/B测试+渐进式发布          |

### 9.2 应急预案

```typescript
// 降级策略配置
interface FallbackConfig {
  // 当LLM质量不稳定时
  llmQuality: {
    threshold: 0.7;
    action: 'retry' | 'fallback_model' | 'manual_review';
    maxRetries: 3;
  };

  // 当API成本超预算时
  costControl: {
    dailyLimit: 100; // 美元
    action: 'throttle' | 'disable_enhancement' | 'notify_admin';
  };

  // 当解析超时时
  timeout: {
    threshold: 300000; // 5分钟
    action: 'return_partial' | 'async_continue' | 'notify_user';
  };
}
```

### 9.3 监控告警

```yaml
# 关键指标监控
monitoring:
  metrics:
    - name: parse_success_rate
      threshold: 95%
      alert: critical

    - name: parse_duration_p99
      threshold: 300s
      alert: warning

    - name: quality_score_average
      threshold: 80
      alert: warning

    - name: api_cost_daily
      threshold: $100
      alert: warning

    - name: consistency_issue_count
      threshold: 5
      alert: info
```

---

## 十、附录

### 10.1 术语表

| 术语                 | 定义                                 |
| -------------------- | ------------------------------------ |
| Global Context       | 全局上下文，从剧本中提取的整体性信息 |
| Consistency Check    | 一致性检查，验证各阶段结果是否矛盾   |
| Iterative Refinement | 迭代优化，多轮修正提升质量           |
| Beat Sheet           | 节拍表，剧本的关键情节点列表         |
| Mood Board           | 氛围板，视觉风格参考集合             |
| Color Script         | 色彩脚本，全片色彩变化规划           |

### 10.2 参考资源

- [Save the Cat! Beat Sheet](https://savethecat.com/beat-sheet/)
- [Hero's Journey Structure](https://www.writersedit.com/heros-journey/)
- [Color in Storytelling](https://www.studiobinder.com/blog/color-in-film/)
- [Sound Design Basics](https://www.filmsound.org/)

### 10.3 变更日志

| 版本 | 日期       | 变更内容 |
| ---- | ---------- | -------- |
| 1.0  | 2026-03-04 | 初始版本 |

---

**文档结束**

_本文档为专业级剧本解析系统深度优化的完整实施计划，涵盖架构设计、实施步骤、测试策略和风险管理。_
