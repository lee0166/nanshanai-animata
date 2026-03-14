# 南山 AI Animata 项目落地式优化方案

# Nanshan AI Animata 项目落地式优化方案

本方案**100%兼容项目现有架构、代码结构与Local-First核心设计**，不做推翻式重构，仅通过「模块增强、逻辑补全、流程闭环」解决核心痛点，按「紧急修复→核心痛点根治→专业能力升级→体验优化」分4个梯度落地，每个优化点都明确对应项目现有文件、代码实现路径、验收标准，可直接分步执行。

## 一、方案前置：项目现状锚定与优化核心原则

### 1. 项目现有可复用基础

- 技术底座：React 19 + TypeScript + Vite，完整的前端工程化体系

- 核心流程：已实现「本地文件读取→文本预处理→4阶段线性解析→本地持久化」全链路

- 配套能力：多LLM厂商适配、任务队列、断点续传、本地资产存储、智能记忆（可选）

- 核心痛点：解析停留在「文本信息提取」，未实现「影视叙事逻辑理解」，导致分镜突兀、剧情不完整、画面衔接断裂

### 2. 优化核心原则

1. **兼容优先**：所有优化均为现有流程的扩展，不修改核心入口，支持「经典模式/增强模式」一键切换，无重构成本

2. **痛点先行**：先根治「分镜看不懂剧情、衔接突兀、设定前后矛盾」的核心问题，再做进阶能力升级

3. **可落地性**：每个优化点都对应项目现有文件，给出可直接复用的代码实现方向，无需额外引入重型依赖

4. **本地坚守**：所有逻辑、数据均在本地完成，不违背项目Local-First的核心架构

## 二、梯度1：紧急快速优化（1天内落地，立刻改善核心体验）

针对用户当前最痛的「分镜突兀、衔接不上、剧情不完整」，无需重构代码，仅修改现有核心配置与函数，即可实现80%的体验提升。

### 优化1：分镜生成Prompt紧急重构，根治衔接与叙事问题

**对应文件**：`config/promptTemplates.ts`（新建/修改）、`services/scriptParserService.ts`

**落地实现**：

1. 替换原有的分镜生成Prompt，强制约束叙事逻辑、衔接规则、设定一致性，核心Prompt模板如下：

```TypeScript

// config/promptTemplates.ts 新增/替换 SHOT_ENHANCED_PROMPT
export const SHOT_ENHANCED_PROMPT = `
# 角色：专业影视分镜师
# 核心规则：
1. 严格基于已提取的【小说元数据】【角色设定】【场景设定】【叙事核心节点】生成分镜，禁止出现与前置设定冲突的内容
2. 按小说剧情发展顺序生成，每个分镜必须绑定对应的核心剧情节点（序幕/冲突/发展/高潮/结局）
3. 每个分镜必须标注：与上一个分镜的画面衔接方式（淡入淡出/叠化/镜头摇移/跟拍/硬切）、镜头景别、运镜方式、建议时长
4. 跨场景切换必须补充过渡逻辑，禁止无理由跳切；同场景分镜必须遵循空间逻辑（从整体到局部、从环境到人物）
5. 核心剧情节点（高潮/关键冲突）必须提高分镜密度，支线剧情简化处理，确保用户通过分镜能完整理解小说主线
6. 输出严格为JSON数组，每个分镜对象必须包含以下字段，禁止额外内容：
- shotId: 唯一标识
- narrativeNode: 所属剧情节点（序幕/冲突/发展/高潮/结局）
- sceneId: 所属场景ID
- characterIds: 出场角色ID数组
- shotType: 景别（特写/近景/中景/全景/远景）
- cameraMovement: 运镜方式
- duration: 建议时长（秒）
- transition: 与上一分镜的衔接方式
- content: 画面内容描述，严格遵循角色/场景设定
- sourceText: 对应小说原文片段
- sourceChapter: 对应小说章节

# 输入内容：
【小说元数据】：{{novelMetadata}}
【角色设定】：{{characters}}
【场景设定】：{{scenes}}
【叙事核心节点】：{{narrativeNodes}}
【待解析剧情文本】：{{plotText}}
`;
```

1. 修改`services/scriptParserService.ts`中的`extractShots`函数，替换原Prompt为上述增强版，强制透传前3阶段的所有解析结果（元数据/角色/场景），禁止分镜阶段独立生成。

**验收标准**：生成分镜100%匹配前置角色/场景设定，所有分镜有明确衔接方式，跨场景无跳切，核心剧情节点分镜占比≥60%。

### 优化2：解析全链路上下文透传，解决设定前后矛盾

**对应文件**：`services/scriptParserService.ts`

**落地实现**：

1. 将原有的「线性独立4阶段解析」改为「前序结果全量透传」，修改后的解析流程为：

```Plain Text

文本预处理 → 元数据提取 → 角色提取（透传元数据） → 场景提取（透传元数据+角色） → 分镜提取（透传元数据+角色+场景）
```

1. 每个阶段的Prompt必须强制带上前序所有阶段的解析结果，例如角色提取Prompt必须带上小说元数据，场景提取必须带上完整角色列表，从根源避免设定冲突。

2. 新增极简字段校验函数，每个阶段完成后检查必填字段，缺失则自动触发fallback补全，示例：

```TypeScript

// services/scriptParserService.ts 新增
const validateCharacterFields = (characters: Character[]): Character[] => {
  return characters.map(char => ({
    id: char.id || uuidv4(),
    name: char.name || '未知角色',
    age: char.age || '青年',
    gender: char.gender || '未知',
    identity: char.identity || '未知身份',
    appearance: char.appearance || '普通外貌',
    personality: char.personality || '未知性格',
  }));
};
```

**验收标准**：解析完成后，角色/场景/分镜的设定无冲突，无字段缺失，分镜中出场的角色100%存在于前置提取的角色列表中。

### 优化3：分镜叙事节点强制绑定，解决剧情碎片化

**对应文件**：`types.ts`、`services/scriptParserService.ts`

**落地实现**：

1. 在`types.ts`中扩展`Shot`类型，新增必填字段`narrativeNode`（剧情节点）、`preShotId`（上一分镜ID）、`nextShotId`（下一分镜ID）。

2. 修改分镜生成逻辑，强制按「序幕→冲突→发展→高潮→结局」5个核心节点分组生成，禁止无差别均匀分镜，高潮节点分镜占比不低于60%。

**验收标准**：用户可通过分镜的剧情节点分组，完整看懂小说的主线剧情，无核心剧情丢失。

## 三、梯度2：核心痛点根治（1-2周落地，从根源解决问题）

基于快速优化的基础，重构解析核心逻辑，从「文本信息提取」升级为「影视叙事理解」，彻底解决分镜突兀、剧情不完整的核心问题。

### 优化1：新增「叙事结构预解析」环节，定好故事骨架再拆分解读

**核心价值**：解决原线性解析导致的「核心剧情丢失、分镜碎片化」，先抓故事主线，再拆细节分镜。

**对应文件**：

- 类型定义：`types.ts`

- 核心函数：`utils/textProcessing.ts`、`services/scriptParserService.ts`

- 提示词：`config/promptTemplates.ts`

- 状态管理：`contexts/ScriptParserContext.tsx`

**落地实现**：

1. **类型定义扩展**（`types.ts`）：

```TypeScript

// 新增叙事结构核心类型
export type NarrativeNode = {
  id: string;
  type: 'prologue' | 'conflict' | 'development' | 'climax' | 'ending';
  name: string;
  description: string;
  chapterRange: [number, number];
  coreCharacters: string[];
  emotion: 'calm' | 'tense' | 'excited' | 'suspense' | 'warm';
  shotDensity: number; // 分镜密度，1-10，高潮节点≥8
};

export type NarrativeStructure = {
  storyArc: 'three-act' | 'hero-journey' | 'serial'; // 叙事弧光
  corePlot: string; // 核心剧情一句话总结
  mainLine: string; // 主线剧情
  branchLines: { id: string; description: string }[]; // 支线剧情
  nodes: NarrativeNode[]; // 核心剧情节点
  emotionTimeline: { chapter: number; emotion: string }[]; // 情绪时间线
};
```

1. **新增叙事结构预解析函数**（`utils/textProcessing.ts`）：

```TypeScript

import { callLLM } from '../services/llmService';
import { NARRATIVE_STRUCTURE_PROMPT } from '../config/promptTemplates';
import { LLMConfig, NarrativeStructure } from '../types';

// 新增：叙事结构预解析，仅提取小说核心骨架，不做细节拆分
export const extractNarrativeStructure = async (
  cleanedText: string,
  chapters: Chapter[],
  llmConfig: LLMConfig
): Promise<NarrativeStructure> => {
  // 仅取小说前3章+后2章+每章核心摘要，降低token消耗
  const textSummary = chapters
    .map((chapter, index) => `第${index+1}章：${chapter.content.slice(0, 200)}...`)
    .join('\n');

  const prompt = NARRATIVE_STRUCTURE_PROMPT
    .replace('{{TEXT_SUMMARY}}', textSummary)
    .replace('{{CHAPTER_COUNT}}', String(chapters.length));

  // 自动选择长文本能力最优的模型（如Kimi），适配长篇小说
  return await callLLM<NarrativeStructure>(llmConfig, prompt, { timeout: 60000 });
};
```

1. **解析流程重构**（`services/scriptParserService.ts`）：

将原有的4阶段解析，升级为「5阶段闭环解析」，预解析结果全量透传到后续所有阶段：

```Plain Text

1. 文本预处理（清洗、章节拆分）
2. 叙事结构预解析（提取核心剧情节点、主线支线、情绪时间线）
3. 元数据+角色提取（基于叙事结构，优先提取核心节点的主要角色）
4. 场景提取（基于叙事节点，优先提取核心场景）
5. 分镜提取（按叙事节点的分镜密度，优先生成主线分镜，支线可配置）
```

1. **前端状态适配**（`contexts/ScriptParserContext.tsx`）：

新增叙事结构相关状态，实时展示解析进度，支持用户手动调整核心剧情节点后再生成细节分镜。

**验收标准**：

- 10万字以内小说预解析1分钟内完成，核心剧情无丢失

- 解析完成后，用户可通过核心剧情节点完整理解小说主线

- 高潮节点分镜占比≥60%，支线分镜可折叠/按需生成，无剧情稀释问题

### 优化2：新增「分镜连贯性校验与补全系统」，根治画面衔接突兀

**核心价值**：解决原分镜无过渡、跳切、空间逻辑混乱的问题，实现影视级画面衔接。

**对应文件**：

- 新建服务：`services/shotCoherenceService.ts`

- 集成调用：`services/scriptParserService.ts`

- 前端展示：`components/ShotManager/`

**落地实现**：

1. **新建连贯性校验核心服务**，封装3层校验逻辑：

```TypeScript

// services/shotCoherenceService.ts
import { Shot, Scene, Character } from '../types';

// 1. 空间逻辑校验：同场景分镜的空间顺序是否合理
export const validateSpatialCoherence = (shots: Shot[], scenes: Scene[]) => {
  const invalidShots: { shotId: string; issue: string; suggestion: string }[] = [];
  // 按场景分组校验
  const shotsByScene = shots.reduce((acc, shot) => {
    acc[shot.sceneId] = [...(acc[shot.sceneId] || []), shot];
    return acc;
  }, {} as Record<string, Shot[]>);

  Object.entries(shotsByScene).forEach(([sceneId, sceneShots]) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    // 校验同场景分镜是否有空间跳脱，比如从“门口”直接跳到“卧室里”无过渡
    // 异常分镜推入invalidShots，给出补充过渡分镜的建议
  });
  return invalidShots;
};

// 2. 跨场景过渡校验：是否有明确的衔接方式
export const validateTransitionCoherence = (shots: Shot[]) => {
  const invalidShots: { shotId: string; issue: string; suggestion: string }[] = [];
  shots.forEach((shot, index) => {
    if (index === 0) return;
    const preShot = shots[index-1];
    // 跨场景分镜无过渡方式，标记异常
    if (preShot.sceneId !== shot.sceneId && !shot.transition) {
      invalidShots.push({
        shotId: shot.shotId,
        issue: '跨场景切换无过渡方式',
        suggestion: '补充淡入淡出/镜头摇移/叠化等过渡方式',
      });
    }
  });
  return invalidShots;
};

// 3. 叙事逻辑校验：分镜顺序是否符合剧情发展
export const validateNarrativeCoherence = (shots: Shot[]) => {
  // 校验分镜的叙事节点顺序是否正确，是否有剧情跳脱
  // 异常分镜标记并给出修正建议
};

// 全量校验入口
export const validateShotCoherence = (shots: Shot[], scenes: Scene[], characters: Character[]) => {
  return {
    spatialIssues: validateSpatialCoherence(shots, scenes),
    transitionIssues: validateTransitionCoherence(shots),
    narrativeIssues: validateNarrativeCoherence(shots),
  };
};
```

1. **集成到解析全流程**：

分镜生成完成后，自动执行连贯性校验，对异常分镜自动触发单条重解析，补全过渡逻辑；同时将校验结果同步到前端，用户可直观看到问题并一键修正。

1. **自动补全过渡分镜**：

针对跨场景、大剧情跨度的节点，自动生成过渡分镜，比如从“古代战场”切换到“现代都市”，自动补充“淡入淡出+字幕提示时间跨度”的过渡分镜。

**验收标准**：

- 所有跨场景分镜100%有明确过渡方式

- 同场景分镜无空间逻辑跳脱

- 解析完成后自动输出连贯性校验报告，异常分镜可一键修正

### 优化3：全链路一致性校验闭环，彻底解决设定前后矛盾

**核心价值**：解决原线性解析导致的「角色/场景设定前后不一致」问题，实现全流程设定闭环。

**对应文件**：

- 新建服务：`services/consistencyCheckService.ts`

- 集成调用：`services/scriptParserService.ts`

- 状态管理：`contexts/ScriptParserContext.tsx`

**落地实现**：

1. 新建4层级一致性校验服务，覆盖解析全流程：
   - 层级1：字段完整性校验（角色/场景/分镜必填字段是否缺失）

   - 层级2：设定一致性校验（分镜内容是否匹配前置角色/场景设定）

   - 层级3：时空逻辑校验（场景的时间/地点是否前后连贯，无穿越问题）

   - 层级4：角色行为校验（分镜中角色动作是否符合其性格/身份设定）

2. 每个解析阶段完成后，自动执行对应层级的校验，校验不通过的内容自动触发重解析（仅当前条目，不影响全量进度），并将校验结果持久化到本地。

3. 前端新增「一致性校验面板」，用户可直观看到所有设定冲突，一键重生成修正。

**验收标准**：解析完成后，角色/场景/分镜的设定冲突率为0，无时空逻辑、角色行为的不合理内容。

## 四、梯度3：专业能力升级（2-3周落地，对标主流工具）

在核心痛点根治的基础上，补齐影视工业化能力，让解析结果可直接落地为视频，对标剪映AI、万兴播爆等主流工具。

### 优化1：分镜影视工业化升级，补齐全量镜头语言参数

**对应文件**：`types.ts`、`config/promptTemplates.ts`、`services/scriptParserService.ts`

**落地实现**：

1. 扩展`Shot`类型，补齐影视行业标准全字段：

```TypeScript

// types.ts 扩展Shot类型
export type Shot = {
  // 原有基础字段
  shotId: string;
  narrativeNode: string;
  sceneId: string;
  characterIds: string[];
  content: string;
  sourceText: string;
  sourceChapter: number;
  // 新增影视专业字段
  shotType: 'close-up' | 'medium-close' | 'medium' | 'full' | 'long'; // 景别
  cameraMovement: 'push' | 'pull' | 'pan' | 'tilt' | 'follow' | 'fixed'; // 运镜
  cameraAngle: 'eye-level' | 'low' | 'high' | 'dutch'; // 拍摄角度
  lighting: string; // 光影风格
  duration: number; // 建议时长（秒）
  transition: string; // 衔接方式
  aspectRatio: string; // 画幅比（继承项目设置）
};
```

1. 重构分镜生成Prompt，强制要求LLM按影视剧本标准生成上述字段，适配短剧/电影的行业规范。

2. 新增时长自动计算逻辑：基于叙事节点的情绪自动分配时长，比如高潮节点分镜1-2s（快切），舒缓节点3-5s，对话节点2-3s。

**验收标准**：生成的分镜可直接导入剪映/PR等剪辑软件，无需用户手动补充任何拍摄参数，可直接用于视频生成。

### 优化2：多模型智能适配系统，从「可配置」到「自动选最优」

**对应文件**：`config/modelConfig.ts`、`services/llmService.ts`

**落地实现**：

1. 扩展模型配置，给每个模型标注「擅长场景」，示例：

```TypeScript

// config/modelConfig.ts 扩展
export const MODEL_CAPABILITY_MAP = {
  'kimi': {
    name: 'Kimi',
    provider: 'moonshot',
    strength: ['long-text', 'narrative-analysis', 'chapter-parsing'],
    bestFor: ['叙事结构预解析', '长篇小说文本处理'],
  },
  'doubao': {
    name: '豆包',
    provider: 'volcengine',
    strength: ['visual-prompt', 'shot-description', 'character-design'],
    bestFor: ['分镜生成', '角色/场景提示词生成'],
  },
  'deepseek': {
    name: 'DeepSeek',
    provider: 'deepseek',
    strength: ['logic-reasoning', 'consistency-check', 'plot-splitting'],
    bestFor: ['一致性校验', '剧情节点拆分'],
  },
  'qwen': {
    name: '通义千问',
    provider: 'alibaba',
    strength: ['general-text', 'short-text-parsing'],
    bestFor: ['短篇小说解析', '元数据提取'],
  }
};
```

1. 重构`llmService.ts`，新增`autoSelectModel`函数，基于解析环节自动选择最优模型，无需用户手动切换。

2. 扩展降级策略：某个模型调用失败时，自动切换到同擅长场景的备用模型，保留解析进度，无需用户干预。

**验收标准**：用户无需手动选择模型，系统自动按环节匹配最优模型，解析成功率≥99%，长文本token消耗降低60%以上。

### 优化3：解析结果与后续工作流无缝衔接

**对应文件**：`services/assetService.ts`、`components/ShotManager/`、`views/ProjectDetail.tsx`

**落地实现**：

1. 解析完成的角色/场景/分镜，自动生成对应的AI生图提示词，存入本地资产库，用户点击即可直接生成，无需手动输入。

2. 分镜的镜头参数（景别、运镜、时长）自动同步到视频生成模块，生成视频时直接复用，无需手动调整。

3. 新增「分镜→关键帧一键批量生成」功能，用户可选中多个分镜，批量生成关键帧，自动关联对应的角色/场景参考图。

**验收标准**：解析完成后，用户可一键完成角色/场景/关键帧生成，全流程无重复操作，无缝衔接视频生成环节。

## 五、梯度4：体验与效率优化（3-4周落地，完善长文本与编辑能力）

### 优化1：分层解析模式，适配百万字长篇小说

针对5万字以上长篇小说，新增「粗解析→中解析→细解析」三层模式，避免全量解析的高成本与碎片化：

1. **粗解析**：仅提取叙事结构、核心剧情节点、主要角色，1分钟内完成，用户确认核心框架后再往下走

2. **中解析**：基于用户确认的核心节点，解析主线分镜、主要场景/角色，生成完整主线剧本

3. **细解析**：用户按需选择支线节点，单独解析支线分镜、次要角色/场景，避免核心剧情被稀释

### 优化2：解析结果可编辑性与版本管理升级

1. 新增版本管理系统：每次解析/修改自动生成版本，支持对比、回滚，所有版本存在本地

2. 新增「精准重解析」功能：用户选中单个分镜/角色/场景，或某段小说原文，可单独触发重解析，无需全量重新解析

3. 新增分镜批量编辑功能：支持批量修改分镜的景别、运镜、风格、时长，提升编辑效率

### 优化3：智能记忆功能与解析流程深度融合

优化原有的可选智能记忆功能，和叙事结构预解析结合：

1. 向量数据库仅存储核心剧情节点的语义信息，降低内存占用，提升检索效率

2. 长篇小说解析时，自动通过向量数据库检索跨章节的角色/场景设定，确保全本一致性

3. 系列作品解析时，自动复用前作的角色/场景设定，保持系列作品的连贯性

## 六、落地保障与灰度策略

1. **兼容保障**：所有优化均为扩展式开发，保留原有的经典解析模式，用户可一键切换「经典模式/增强模式」，无升级风险

2. **灰度落地**：按梯度逐步落地，先完成紧急快速优化，验证效果后再推进核心痛点根治，最后做进阶升级

3. **类型安全**：所有新增字段、函数均有完整的TypeScript类型定义，全程类型校验，无运行时错误

4. **测试覆盖**：每个优化模块新增单元测试，服务层函数覆盖率≥80%，确保稳定性

5. **本地坚守**：所有功能均在本地完成，数据仅存储在用户本地，不违背项目Local-First的核心设计

## 七、最终效果预期

1. **核心痛点解决**：用户通过解析后的分镜，可100%理解小说完整剧情，分镜无突兀跳切、无设定冲突、无衔接断裂

2. **专业度对标主流**：生成的分镜符合影视行业标准，可直接用于视频生成，无需用户手动补充专业参数

3. **效率大幅提升**：长篇小说解析时间降低60%，token消耗降低80%，用户编辑修改效率提升80%

4. **核心优势保留**：全程本地优先，数据隐私安全，无云端依赖，保持项目的开源核心竞争力
   > （注：文档部分内容可能由 AI 生成）
