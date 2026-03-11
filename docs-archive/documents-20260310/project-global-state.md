# Kmeng AI Animata - 项目全局状态文档

> **文档目的**：作为项目优化的权威依据，记录真实实现状态，避免重复或冲突的建议  
> **更新原则**：每次优化/修复后必须同步更新  
> **最后更新**：2026-03-10（项目全面优化：TypeScript类型修复、ESLint配置、Prettier配置、测试体系、代码分割、Git Hooks、文档清理）  
> **文档状态**：✅ 已同步更新

---

## 一、项目架构概览

### 1.1 技术栈

| 技术          | 版本     | 用途                     |
| ------------- | -------- | ------------------------ |
| React         | 19.2.3   | UI框架                   |
| TypeScript    | 5.8.2    | 类型安全                 |
| Vite          | 6.2.0    | 构建工具                 |
| HeroUI        | 2.8.7    | 组件库（基于React Aria） |
| TailwindCSS   | 4.1.18   | 原子化CSS                |
| Framer Motion | 12.23.26 | 动画库                   |
| Lucide React  | 0.562.0  | 图标库                   |
| Vitest        | 4.0.18   | 测试框架                 |

### 1.2 核心目录结构

```
src/
├── components/
│   ├── ScriptParser/           # 剧本解析相关组件
│   │   ├── CharacterMapping.tsx    # 角色映射（已修复竞态条件）
│   │   ├── SceneMapping.tsx        # 场景映射（已修复竞态条件）
│   │   ├── ItemMapping.tsx         # 物品映射（已修复竞态条件）
│   │   ├── ShotList.tsx            # 分镜列表
│   │   └── ShotToFragment.tsx      # 分镜转片段
│   └── ProjectDetail/          # 项目详情页组件
│       ├── Character/            # 角色详情
│       │   └── CharacterDetail.tsx
│       ├── Scene/                # 场景详情
│       │   └── SceneDetail.tsx
│       ├── Item/                 # 物品详情
│       │   └── ItemDetail.tsx
│       ├── Fragment/             # 片段详情
│       │   └── FragmentDetail.tsx
│       ├── CharacterSidebar.tsx
│       ├── SceneSidebar.tsx
│       ├── ItemSidebar.tsx
│       ├── FragmentSidebar.tsx
│       ├── ResourceManager.tsx
│       ├── GenerationForm.tsx
│       ├── DetailView.tsx
│       ├── AssetPreview.tsx
│       └── Shared/
│           ├── StyleSelector.tsx
│           ├── ImageGenerationPanel.tsx
│           └── DynamicModelParameters.tsx
├── services/
│   ├── scriptParser.ts         # 剧本解析服务（核心，1759行）
│   ├── textCleaner.ts          # 文本清洗服务（v3.0，系统性重构）
│   ├── errorHandler.ts         # 错误处理服务
│   ├── storage.ts              # 存储服务（IndexedDB + OPFS）
│   ├── promptBuilder.ts        # Prompt构建器
│   ├── aiService.ts            # AI服务入口
│   ├── queue.ts                # 任务队列
│   ├── fileUtils.ts            # 文件工具
│   ├── metadata.ts             # 元数据提取
│   ├── modelUtils.ts           # 模型工具
│   ├── prompt.ts               # Prompt服务
│   ├── ai/                     # AI相关服务
│   │   ├── ModelRouter.ts      # 模型路由
│   │   ├── ModelRouter.test.ts # 模型路由测试
│   │   ├── providers/          # 各厂商Provider
│   │   │   ├── LLMProvider.ts
│   │   │   ├── VolcengineProvider.ts
│   │   │   ├── ViduProvider.ts
│   │   │   ├── ModelscopeProvider.ts
│   │   │   └── BaseProvider.ts
│   │   ├── adapters/
│   │   │   └── volcengine/
│   │   │       └── strategies.ts
│   │   ├── definitions.ts
│   │   └── interfaces.ts
│   ├── parsing/                # 解析子模块
│   │   ├── SemanticChunker.ts  # 语义分块
│   │   ├── JSONRepair.ts       # JSON修复
│   │   ├── ShortDramaRules.ts  # 短剧规则引擎
│   │   ├── MultiLevelCache.ts  # 多级缓存
│   │   ├── QualityAnalyzer.ts  # 质量分析器
│   │   ├── QualityAnalyzer.test.ts
│   │   ├── BudgetPlanner.ts    # 时长预算规划器
│   │   ├── BudgetPlanner.test.ts
│   │   └── professional/       # 专业分析模块（Phase 5）
│   │       ├── SoundDesigner.ts           # 声音设计分析
│   │       ├── ScreenplayStructureAnalyzer.ts  # 剧本结构分析
│   │       ├── VisualPrevisualizer.ts     # 视觉预演
│   │       └── index.ts                   # 统一导出
│   └── keyframe/               # 关键帧服务
│       ├── KeyframeService.ts
│       ├── KeyframeEngine.ts
│       ├── VolcengineKeyframeAdapter.ts
│       └── index.ts
├── views/
│   ├── ScriptManager.tsx       # 剧本管理主页面（含质量报告Tab）
│   ├── ShotManager.tsx         # 分镜管理页面（含关键帧工作流）
│   ├── ProjectDetail.tsx       # 项目详情页
│   ├── Dashboard.tsx           # 项目仪表盘
│   ├── Settings.tsx            # 设置页面
│   └── Tasks.tsx               # 任务页面
├── contexts/
│   ├── AppContext.tsx          # 应用状态管理
│   ├── ToastContext.tsx        # Toast消息
│   └── context.tsx             # Context导出
├── config/
│   ├── models.ts               # 模型配置（1700+行，40+模型）
│   └── settings.ts             # 默认设置
├── types.ts                    # 全局类型定义
├── locales.ts                  # 多语言配置
├── App.tsx                     # 应用入口
└── index.tsx                   # 渲染入口
```

---

## 二、核心功能状态

### 2.1 剧本解析流程 ✅ 已实现

**解析阶段**（`ParseStage`）：

```typescript
type ParseStage =
  | 'idle' // 初始状态
  | 'metadata' // 提取元数据（进度 0-20%）
  | 'characters' // 分析角色（进度 20-50%）
  | 'scenes' // 分析场景（进度 50-70%）
  | 'items' // 提取物品
  | 'shots' // 生成分镜（进度 70-100%）
  | 'completed' // 完成
  | 'error'; // 错误
```

**进度追踪机制**：

- ✅ `ParseProgressCallback` 回调接口（`services/scriptParser.ts:391-393`）
- ✅ 分阶段进度计算（metadata: 0-20%, characters: 20-50%, scenes: 50-70%, shots: 70-100%）
- ✅ HeroUI Progress 组件显示（`views/ScriptManager.tsx:637-646`）
- ✅ 实时状态文字提示
- ✅ 断点续传支持（`resumeFromState`参数）
- ✅ 取消解析支持（`cancel()`方法）

**解析模式**：

1. **完整解析**：`parseScript()` - 自动执行全部阶段（`services/scriptParser.ts:1282-1500`）
2. **分步解析**：`parseStage()` - 用户手动触发单个阶段（`services/scriptParser.ts:1563-1650`）

**质量评估**：

- ✅ 短剧规则引擎（`ShortDramaRules.ts`）
- ✅ 质量报告生成（分数、违规项、建议）
- ✅ 黄金3秒规则、冲突密度规则等
- ✅ 质量报告Tab集成（`views/ScriptManager.tsx`）

### 2.2 剧本管理页面 ✅ 已实现

**实现文件**：`views/ScriptManager.tsx`

**功能特性**：

- ✅ 剧本上传与管理
- ✅ 独立模式与项目模式双支持
- ✅ 剧本内容编辑
- ✅ 解析进度显示（Progress组件）
- ✅ 分步解析按钮（元数据/角色/场景/分镜）
- ✅ 完整解析按钮
- ✅ 质量报告Tab集成
- ✅ 角色/场景/物品映射组件
- ✅ 分镜列表组件
- ✅ LLM模型选择（与图像/视频模型相同机制）
- ✅ 剧本删除级联确认（显示删除统计）
- ✅ 质量报告持久化到`script.parseState.qualityReport`

### 2.3 分镜管理页面 ✅ 已实现

**实现文件**：`views/ShotManager.tsx`

**功能特性**：

- ✅ 分镜列表展示
- ✅ 按场景分组
- ✅ 分镜类型标签（极远景/远景/全景/中景/近景/特写）
- ✅ 关键帧状态标签
- ✅ 关键帧拆分功能（支持2-4个关键帧）
- ✅ 关键帧图片生成（文生图 + 参考图生图）
- ✅ 历史图片横向滚动浏览
- ✅ 历史图片切换与删除
- ✅ 缩略图滚动组件（`ThumbnailScroller`）
- ✅ 关键帧服务集成

### 2.4 关键帧工作流 ✅ 已实现

**实现文件**：`services/keyframe/`

**核心服务**：

- `KeyframeService.ts` - 关键帧业务逻辑
- `KeyframeEngine.ts` - 关键帧拆分引擎
- `VolcengineKeyframeAdapter.ts` - 火山引擎适配器

**功能特性**：

- ✅ LLM自动拆分关键帧（2-4个）
- ✅ 关键帧描述生成
- ✅ 提示词构建
- ✅ 角色/场景资产自动关联为参考图
- ✅ 火山引擎API调用（支持多图参考）
- ✅ 生成图片历史记录数组
- ✅ 当前图片ID管理
- ✅ 关键帧状态管理（pending/generating/completed/failed）

**关键帧数据结构**：

```typescript
interface Keyframe {
  id: string;
  sequence: number; // 在分镜内的序号（1,2,3,4）
  description: string; // 静态画面描述
  prompt: string; // 图生图提示词
  duration: number; // 该关键帧时长（秒）
  references: {
    character?: { id: string; name: string };
    scene?: { id: string; name: string };
  };
  generatedImage?: GeneratedImage; // 兼容旧数据
  generatedImages?: GeneratedImage[]; // 历史记录
  currentImageId?: string; // 当前选中
  status: 'pending' | 'generating' | 'completed' | 'failed';
}
```

### 2.5 文本清洗 ✅ Phase 1系统性重构完成

**当前实现**（`services/textCleaner.ts` v3.0）：

**核心思想**：从"清除非法字符"转变为"保留合法字符"

- 无需穷举所有非法字符组合
- 系统性定义合法字符集，清除所有其他字符

**合法字符集**：

- 中文：`\u4E00-\u9FA5`
- 中文标点：`\u3000-\u303F`
- 常用全角标点：`\uFF01-\uFF0F`, `\uFF1A-\uFF20`, `\uFF3B-\uFF40`, `\uFF5B-\uFF5E`
- 英文：`a-zA-Z`
- 数字：`0-9`
- 空白和换行：`\s\n\r`
- 常用标点：`.,!?;:'"()【】《》（），。！？、；：""''—…·\-<> `

**系统性清洗规则**（7条）：

1. `normalize_whitespace` - 移除控制字符和特殊空白
2. `remove_garbage_chars` - **核心规则**：系统性清除非法字符
3. `normalize_line_endings` - 统一换行符为`\n`
4. `merge_multiple_spaces` - 合并多个空格
5. `clean_line_breaks` - 清理多余换行（超过2个合并为2个）
6. `trim_lines` - 去除行首尾空白
7. `remove_empty_lines_with_spaces` - 去除空行中的空格

**HTML实体解码**（`decodeHtmlEntities`）：

- ✅ `&nbsp;` → 空格
- ✅ `&lt;` → `<`, `&gt;` → `>`
- ✅ `&quot;` → `"`, `&apos;` → `'`
- ✅ `&ldquo;`/`&rdquo;` → 中文引号
- ✅ `&hellip;` → `...`
- ✅ 数字实体 `&#123;` / `&#x7B;`

**核心方法**：

- `clean(text)` - 系统性清洗
- `cleanWithStats(text)` - 带统计的清洗
- `process(text)` - 完整处理（清洗+分章+统计）
- `quickClean(text)` - 快速清洗（用于实时预览）
- `extractChapters(text)` - 章节提取
- `smartChunk(text, maxSize?)` - 智能分块
- `detectEncodingIssues(text)` - 编码问题检测

**版本信息**：

- 版本：`3.0`
- 更新时间：`2026-03-01`

**测试覆盖**：27个测试用例全部通过 ✅

### 2.6 语义分块 ✅ 已实现（含向量记忆集成）

**实现文件**：`services/parsing/SemanticChunker.ts`

**功能特性**：

- ✅ 基于语义的分块策略
- ✅ 多层级边界识别（章节 > 段落 > 句子）
- ✅ 上下文继承（前500字作为上下文）
- ✅ 分块类型检测（对话/动作/描述/过渡）
- ✅ 元数据提取（角色、场景提示、重要性评分）
- ✅ 小分块合并功能
- ✅ **向量记忆集成**（storeChunksToVectorDB、recallRelevantContext、getSmartContext）

**分隔符优先级**：

1. 章节标记（权重100）- `【第X章】`、`第X章`、`Chapter X`
2. 段落边界（权重50）- 双换行
3. 句子边界（权重20）- 标点符号

**向量记忆集成**（`SemanticChunker.ts:258-375`）：

- `storeChunksToVectorDB()` - 将分块存入ChromaDB向量数据库
- `recallRelevantContext()` - 基于语义相似度召回相关上下文
- `getSmartContext()` - 智能上下文获取（替代固定窗口slice(-500)）
- 支持200万字级别小说解析

**ScriptParser 集成**（`scriptParser.ts`，2026-03-05完成）：

- ✅ 自动初始化VectorMemory和EmbeddingService
- ✅ 分块后自动存储到ChromaDB
- ✅ 解析时智能召回相关上下文
- ✅ 失败时自动回退到普通模式
- ✅ 支持手动清理和统计查询

### 2.7 JSON修复 ✅ 已实现

**实现文件**：`services/parsing/JSONRepair.ts`

**修复策略**（按优先级）：

1. 提取代码块中的JSON（`json...`）
2. 括号匹配找到完整JSON
3. 修复常见错误（尾随逗号、单引号、中文引号等）
4. 激进修复（移除非JSON内容、修复嵌套引号）
5. 提取部分有效JSON

### 2.8 批量创建竞态条件 ✅ 已修复

**问题描述**：批量创建角色/场景/物品时，只有最后一个显示"已关联"

**根本原因**：`Promise.all`并发执行 + 每个创建操作独立更新状态 → 后更新覆盖前更新

**修复方案**（`CharacterMapping.tsx/SceneMapping.tsx/ItemMapping.tsx`）：

```typescript
// 1. 提取纯创建函数 - 只创建资产，不更新状态
const createCharacterAsset = async (scriptChar: ScriptCharacter): Promise<string> => {
  await storageService.saveAsset(newCharacter);
  return newCharacter.id;
};

// 2. 批量创建 - 串行执行 + 统一状态更新
const handleBatchCreateCharacters = async () => {
  const unmapped = scriptCharacters.filter(c => !c.mappedAssetId);

  const assetIds: Map<string, string> = new Map();
  for (const char of unmapped) {
    const assetId = await createCharacterAsset(char);
    assetIds.set(char.name, assetId);
  }

  const updated = scriptCharacters.map(c => {
    const assetId = assetIds.get(c.name);
    return assetId ? { ...c, mappedAssetId: assetId } : c;
  });
  onCharactersUpdate(updated);
};
```

### 2.9 AI模型配置 ✅ 已实现（40+模型）

**实现文件**：`config/models.ts`（1700+行）

**模型分类**：

- **图像模型**（7个）：
  - 火山引擎：Seedream 4.5、Seedream 4.0、Seedream 3.0 T2I
  - Vidu：Vidu Q2、Vidu Q1
  - ModelScope：通义万相 Z-Image

- **视频模型**（9个）：
  - Vidu：Vidu 2.0、Vidu Q2、Vidu Q2 Pro、Vidu Q2 Turbo、Vidu Q2 Pro Fast、Vidu Q1 Classic、Vidu Q1
  - 火山引擎：Seedance 1.5 Pro、Seedance 1.0 Pro、Seedance 1.0 Pro Fast、Seedance 1.0 Lite I2V

- **LLM模型**（26个）：
  - OpenAI：GPT-4o、GPT-4o Mini
  - 阿里云：通义千问 Max/Plus/Turbo
  - ModelScope：魔搭通义千问
  - 火山引擎：豆包 Pro/Lite、豆包 Seed 1.8/1.6/1.6 Lite/1.6 Flash/1.6 Vision/Seed Code
  - DeepSeek：DeepSeek V3.2/V3.1/R1
  - Kimi：Kimi K2/K2 Thinking
  - 智谱：GLM-4
  - OpenAI兼容：自定义模型

**模型配置特性**：

- ✅ 能力定义（`ModelCapabilities`）
- ✅ 参数配置（`ModelParameter`）
- ✅ 可见性条件（`visibilityCondition`）
- ✅ 隐藏条件（`hiddenCondition`）
- ✅ 提供商配置（`providerOptions`）

### 2.10 AI模型路由 ✅ 已实现

**实现文件**：`services/ai/ModelRouter.ts`

**功能特性**：

- ✅ 基于能力标签的模型匹配
- ✅ 任务类型自动路由（全局摘要、实体提取、角色分析等）
- ✅ 成本估算和优化建议
- ✅ 备选方案推荐（前3个备选）
- ✅ 批量任务执行

**测试覆盖**：`ModelRouter.test.ts`

### 2.11 专业分析模块（Phase 5）✅ 已实现

**实现文件**：`services/parsing/professional/`

**核心服务**：

- `SoundDesigner.ts` - 声音设计分析（基于 emotionalArc + Shot.sound）
- `ScreenplayStructureAnalyzer.ts` - 剧本结构分析（基于 StoryStructure + emotionalArc）
- `VisualPrevisualizer.ts` - 视觉预演（基于 VisualStyle + EraContext）
- `index.ts` - 统一导出 + ProfessionalAnalyzer 入口

**功能特性**：

- ✅ 声音设计分析
  - 情绪音乐映射（根据情绪推荐音乐风格）
  - 声音调色板（环境音/音效/配乐主题分类）
  - 整体音景（主导情绪、背景音调、动态范围）
  - 统计分析（分镜数、音效数、类型统计）
- ✅ 剧本结构分析
  - 幕长度分布（字数、占比、预估时长）
  - 紧张度曲线可视化
  - 转折点识别
  - 结构评分（完整性、平衡性、情绪曲线）
- ✅ 视觉预演
  - 色彩板生成（主色调、情绪描述、光影建议）
  - 时代视觉参考（服装风格、建筑风格、视觉关键词）
  - 场景视觉建议（室内/室外/情感/动作场景）
  - 整体视觉描述生成

**UI组件**：

- `SoundDesignTab.tsx` - 声音设计展示（统计卡片、情绪映射表、声音调色板）
- `StructureDetailTab.tsx` - 结构分析展示（评分、幕长度、紧张度曲线）

**集成位置**：`views/ScriptManager.tsx`

- "声音" Tab（在"视觉"之后）
- "结构分析" Tab（在"声音"之后）

**测试覆盖**：

- `SoundDesigner.test.ts` - 6个测试用例
- `ScreenplayStructureAnalyzer.test.ts` - 12个测试用例
- `VisualPrevisualizer.test.ts` - 10个测试用例
- 总计：28个测试用例，全部通过

**核心原则**：

- 零LLM调用 - 所有分析基于已有数据
- 零重复开发 - 直接使用 emotionalArc、visualStyle、storyStructure
- 纯数据转换 - 只进行数据转换和可视化，不进行新推理

### 2.12 迭代优化引擎 ✅ 已实现

**实现文件**：`services/parsing/refinement/IterativeRefinementEngine.ts`

**功能特性**：

- ✅ 4步迭代优化工作流：检查 → 评估 → 修正 → 验证
- ✅ 自动循环优化直到满足条件
- ✅ 支持最大迭代次数限制
- ✅ 目标质量分数配置
- ✅ 最小改进阈值控制
- ✅ 自动应用安全修正
- ✅ 详细迭代报告生成

**配置接口**：

```typescript
interface IterativeRefinementConfig {
  maxIterations: number; // 最大迭代次数
  targetQualityScore: number; // 目标质量分数
  minImprovementThreshold: number; // 最小改进阈值
  autoApplySafeRefinements: boolean; // 自动应用安全修正
  confidenceThreshold: number; // 置信度阈值
  verboseLogging: boolean; // 详细日志
}
```

**集成位置**：`services/scriptParser.ts`

- 解析阶段 3.5：迭代优化（可选）
- 配置项：`enableIterativeRefinement`

**依赖模块**：

- `ConsistencyChecker` - 一致性检查
- `QualityEvaluator` - 质量评估
- `RefinementEngine` - 修正引擎

### 2.13 一致性检查系统 ✅ 已实现

**实现文件**：`services/parsing/consistency/`

**核心组件**：

- `ConsistencyChecker.ts` - 一致性检查主引擎
- `rules/SceneRules.ts` - 场景一致性规则
- `rules/VisualRules.ts` - 视觉一致性规则
- `rules/CharacterRules.ts` - 角色一致性规则

**功能特性**：

- ✅ 多维度一致性检查
- ✅ 可配置规则集
- ✅ 自动问题识别
- ✅ 修正建议生成
- ✅ 置信度评分

**测试覆盖**：

- `ConsistencyChecker.test.ts` - 全面测试
- `SceneRules.test.ts` - 场景规则测试
- `VisualRules.test.ts` - 视觉规则测试
- `CharacterRules.test.ts` - 角色规则测试

### 2.14 质量评估系统 ✅ 已实现

**实现文件**：`services/parsing/quality/QualityEvaluator.ts`

**评估维度**：

- ✅ 完整性 - 必要字段是否齐全
- ✅ 准确性 - 数据是否正确
- ✅ 一致性 - 内部逻辑是否一致
- ✅ 可用性 - 是否可直接使用
- ✅ 戏剧性 - 剧本张力评估

**功能特性**：

- ✅ 5维度综合评分
- ✅ 自动问题识别
- ✅ 改进建议生成
- ✅ 详细评估报告

**测试覆盖**：

- `QualityEvaluator.test.ts` - 全面测试

### 2.15 创作意图配置（v2.0）✅ 已实现

**版本**：Script Parser 2.0

**重大变更**：

- 🔄 移除基于字数的时长预算配置
- 🔄 新增 `creativeIntent` 创作意图配置
- 🔄 移除平台模板相关配置

**配置接口**：

```typescript
interface CreativeIntent {
  filmStyle: 'short-drama' | 'film' | 'documentary' | 'custom';
  narrativeFocus: {
    protagonistArc: boolean;
    emotionalCore: boolean;
    worldBuilding: boolean;
    visualSpectacle: boolean;
    thematicDepth: boolean;
  };
  emotionalTone: {
    primary: 'inspiring' | 'melancholic' | 'thrilling' | 'romantic' | 'mysterious';
    intensity: number;
  };
  visualReferences?: string[];
  creativeNotes?: string;
  targetPlatforms?: ('douyin' | 'kuaishou' | 'bilibili' | 'theatrical')[];
}
```

**已弃用配置**（保留用于兼容）：

- `useDurationBudget` - 请使用 `creativeIntent` 替代
- `targetPlatform` - 请使用 `creativeIntent.filmStyle` 替代
- `durationBudgetConfig` - 已移除

### 2.16 任务队列 ✅ 已实现

**实现文件**：`services/queue.ts`

**功能特性**：

- ✅ 任务添加与持久化
- ✅ 任务状态监听（`subscribe`）
- ✅ 并发控制（`processingCount`）
- ✅ 任务执行（图像/视频生成）
- ✅ 资产自动更新
- ✅ 元数据自动提取

**任务类型**：

- `generate_image` - 图像生成
- `generate_video` - 视频生成
- `generate_keyframe_image` - 关键帧图像生成

### 2.12 存储服务 ✅ 已实现

**实现文件**：`services/storage.ts`

**存储后端**：

1. **File System Access API** - 本地文件夹访问（首选）
2. **OPFS**（Origin Private File System）- 沙盒模式（fallback）

**核心功能**：

- ✅ 双存储后端自动切换
- ✅ IndexedDB句柄持久化（跨会话恢复）
- ✅ 文件锁机制（`lock()`方法，防止并发写入冲突）
- ✅ 熔断器模式（5秒超时保护）
- ✅ 资源聚合（自动合并导入和生成资源）
- ✅ 元数据提取（视频FPS、图片尺寸等）

**数据操作**：

- 项目：saveProject/deleteProject/getProjects
- 资产：saveAsset/deleteAsset/getAssets/updateAsset
- 剧本：saveScript/deleteScript/getScripts/updateScriptParseState/getAllScripts
- 任务：saveJob/saveJobs/claimJob/getJobs/deleteJob
- 资源：getAllResources/importResource/deleteFile

### 2.13 错误处理 ✅ 已集成

**实现文件**：`services/errorHandler.ts`

**错误映射表**（覆盖25+种错误类型）：

- API相关：Rate limit、Invalid API key、Unauthorized
- 内容相关：Content policy violation、Safety filter
- 网络相关：Timeout、Network error、Connection refused
- 资源相关：Insufficient quota、Storage full
- 服务器错误：Internal server error、Service unavailable
- 请求相关：Bad request、Payload too large
- 模型相关：Model not found、Model overloaded

**集成点**：

- ✅ `services/scriptParser.ts` - `parseScript()`方法错误处理增强
- ✅ `views/ScriptManager.tsx` - 显示友好错误信息和操作建议

### 2.14 向量记忆系统 ❌ 已移除

**移除时间**：2026-03-07

**移除原因**：

- ChromaDB 依赖 Python 后端，与纯前端架构不符
- 需要用户手动安装 Python 环境，增加使用门槛
- 存在跨域、端口等技术问题
- 后续将采用 DuckDB-Wasm 或其他纯前端方案替代

**已删除文件**：

- `services/parsing/VectorMemory.ts`
- `services/parsing/EmbeddingService.ts`
- `services/parsing/VectorMemoryConfig.ts`
- `components/VectorMemoryToggle.tsx`

**保留功能**：

- ✅ 语义分块（SemanticChunker）
- ✅ 上下文注入（ContextInjector）
- ✅ 全局上下文提取（GlobalContextExtractor）

**后续优化**：详见 `docs/chromadb-removal-impact.md`

### 2.15 时长预算规划器 ✅ 已实现

**实现文件**：`services/parsing/BudgetPlanner.ts`

**功能特性**：

- ✅ 字数到总时长预算计算
- ✅ 支持4种平台（抖音/快手/B站/精品）
- ✅ 支持3种节奏类型（快/中/慢）
- ✅ 场景时长分配包含重要性权重（开场0.8/发展0.6/高潮1.0/结尾0.7）
- ✅ 7000字小说输出总时长控制在 210-300 秒（3.5-5分钟）范围
- ✅ 预算验证和自动调整功能
- ✅ 平台推荐配置生成
- ✅ 格式化预算报告导出

**行业标准换算**：

- 快节奏（抖音）: 250-300字/分钟
- 中节奏（B站）: 180-250字/分钟
- 慢节奏（精品）: 120-180字/分钟

**测试覆盖**：31个测试用例全部通过

---

## 三、数据模型

### 3.1 核心类型定义（types.ts）

**资产类型系统**：

```typescript
enum AssetType {
  CHARACTER = 'character', // 角色资产
  SCENE = 'scene', // 场景资产
  ITEM = 'item', // 物品资产
  SHOT = 'shot', // 分镜
  VIDEO_SEGMENT = 'video_segment', // 视频片段
  RESOURCES = 'resources', // 资源
  SCRIPT = 'script', // 剧本
  IMAGE = 'image', // 图片
  VIDEO = 'video', // 视频
}
```

**剧本解析状态**：

```typescript
interface ScriptParseState {
  stage: ParseStage;
  progress: number;
  metadata?: ScriptMetadata;
  characters?: ScriptCharacter[];
  scenes?: ScriptScene[];
  items?: ScriptItem[];
  shots?: Shot[];
  qualityReport?: QualityReport;
  error?: string;
}
```

**分镜与关键帧**：

```typescript
interface Shot {
  id: string;
  sequence: number;
  sceneName: string;
  shotType: ShotType;
  cameraMovement: CameraMovement;
  description: string;
  dialogue?: string;
  sound?: string;
  duration: number;
  characters: string[];
  mappedFragmentId?: string;
  keyframes?: Keyframe[]; // 关键帧列表
}

interface Keyframe {
  id: string;
  sequence: number;
  description: string;
  prompt: string;
  duration: number;
  references: {
    character?: { id: string; name: string };
    scene?: { id: string; name: string };
  };
  generatedImage?: GeneratedImage;
  generatedImages?: GeneratedImage[];
  currentImageId?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}
```

---

## 四、已知问题清单

### 4.1 已确认待修复

| 优先级 | 问题             | 状态   | 备注                       | 相关文件       |
| ------ | ---------------- | ------ | -------------------------- | -------------- |
| 🟡 中  | 文件锁清理       | 待修复 | 清理逻辑被注释掉           | storage.ts     |
| 🟢 低  | 缺少失败回退机制 | 待优化 | 首选模型失败不自动尝试备选 | ModelRouter.ts |
| 🟢 低  | 批处理并发控制   | 待优化 | 顺序执行，无并发控制       | ModelRouter.ts |

### 4.2 已修复

| 问题             | 修复日期   | 修复文件                                                | 修复方案                          |
| ---------------- | ---------- | ------------------------------------------------------- | --------------------------------- |
| 批量创建竞态条件 | 2026-03-01 | CharacterMapping.tsx, SceneMapping.tsx, ItemMapping.tsx | 串行创建+统一状态更新             |
| 文本清洗不完整   | 2026-03-01 | textCleaner.ts                                          | 系统性重构v3.0，从清除到保留      |
| 错误处理未集成   | 2026-03-01 | scriptParser.ts, ScriptManager.tsx                      | 集成ErrorHandler，友好错误提示    |
| Token估算精度    | 2026-03-03 | ModelRouter.ts, ModelRouter.test.ts                     | 集成tiktoken，支持多模型tokenizer |

---

## 五、关键代码位置索引

### 5.1 解析流程

| 功能         | 文件                                | 行号范围  | 说明                        |
| ------------ | ----------------------------------- | --------- | --------------------------- |
| 解析入口     | `services/scriptParser.ts`          | 1282-1500 | `parseScript()`完整解析     |
| 分步解析     | `services/scriptParser.ts`          | 1563-1650 | `parseStage()`单阶段解析    |
| 进度回调定义 | `services/scriptParser.ts`          | 391-393   | `ParseProgressCallback`接口 |
| 时长预算规划 | `services/parsing/BudgetPlanner.ts` | 1-703     | 字数到时长预算计算          |

### 5.2 剧本管理

| 功能           | 文件                                           | 说明                       |
| -------------- | ---------------------------------------------- | -------------------------- |
| 剧本管理主页面 | `views/ScriptManager.tsx`                      | 上传、解析、映射、质量报告 |
| 角色映射       | `components/ScriptParser/CharacterMapping.tsx` | 批量创建已修复竞态         |
| 场景映射       | `components/ScriptParser/SceneMapping.tsx`     | 批量创建已修复竞态         |
| 物品映射       | `components/ScriptParser/ItemMapping.tsx`      | 批量创建已修复竞态         |
| 分镜列表       | `components/ScriptParser/ShotList.tsx`         | 分镜展示                   |

### 5.3 分镜管理

| 功能           | 文件                                   | 说明                       |
| -------------- | -------------------------------------- | -------------------------- |
| 分镜管理主页面 | `views/ShotManager.tsx`                | 分镜列表、关键帧拆分、生图 |
| 缩略图滚动     | `views/ShotManager.tsx`                | `ThumbnailScroller`组件    |
| 关键帧服务     | `services/keyframe/KeyframeService.ts` | 拆分、生图                 |
| 关键帧引擎     | `services/keyframe/KeyframeEngine.ts`  | LLM拆分逻辑                |

### 5.4 模型配置

| 功能         | 文件                         | 说明             |
| ------------ | ---------------------------- | ---------------- |
| 默认模型配置 | `config/models.ts`           | 1700+行，40+模型 |
| 模型路由     | `services/ai/ModelRouter.ts` | 智能路由与测试   |

### 5.5 任务队列

| 功能     | 文件                        | 说明       |
| -------- | --------------------------- | ---------- |
| 任务队列 | `services/queue.ts`         | JobQueue类 |
| 任务监控 | `components/JobMonitor.tsx` | 三态视图   |

---

## 六、更新日志

### 2026-03-09（React StrictMode 修复与类型优化）

- ✅ 修复 `views/ScriptManager.tsx` React StrictMode 兼容性问题
  - 移除 `isMountedRef` 检查，解决 StrictMode 双重挂载问题
  - 修复解析进度在 StrictMode 下不更新的问题
  - 更新 CharacterMapping 组件调用（新增 `scriptId`, `scriptCharacters`, `onCharactersUpdate`, `onCharacterCreated` 属性）
  - 更新 SceneMapping 组件调用（新增 `scriptId`, `scriptScenes`, `onScenesUpdate`, `onSceneCreated` 属性）
  - 更新 ItemMapping 组件调用（新增 `scriptId`, `scriptItems`, `onItemsUpdate`, `onItemCreated` 属性）
  - 更新 ShotList 组件调用（新增 `scenes`, `onShotsUpdate`, `viewMode` 属性）
- ✅ 修复 `services/scriptParser.ts` 类型问题
  - `estimatedDuration` 字段类型从 `number` 改为 `string`，确保类型一致性
- ✅ 更新全局状态文档
  - 记录 React StrictMode 兼容性修复
  - 记录组件接口变更

### 2026-03-09（新增迭代优化与质量保障系统）

- ✅ 新增迭代优化引擎 `IterativeRefinementEngine`
  - 实现4步迭代优化工作流：检查 → 评估 → 修正 → 验证
  - 支持自动循环优化直到满足条件
  - 集成到 `services/scriptParser.ts` 解析阶段 3.5
  - 配置项：`enableIterativeRefinement`
- ✅ 新增一致性检查系统 `ConsistencyChecker`
  - 场景一致性规则（SceneRules）
  - 视觉一致性规则（VisualRules）
  - 角色一致性规则（CharacterRules）
  - 自动问题识别与修正建议
- ✅ 新增质量评估系统 `QualityEvaluator`
  - 5维度综合评分（完整性、准确性、一致性、可用性、戏剧性）
  - 自动问题识别
  - 改进建议生成
  - 详细评估报告
- ✅ Script Parser 2.0 配置升级
  - 新增 `creativeIntent` 创作意图配置
  - 移除基于字数的时长预算配置
  - 移除平台模板相关配置
  - 向后兼容：保留已弃用配置字段
- ✅ 更新全局状态文档
  - 新增 2.12 迭代优化引擎
  - 新增 2.13 一致性检查系统
  - 新增 2.14 质量评估系统
  - 新增 2.15 创作意图配置（v2.0）

### 2026-03-07（ChromaDB 完全移除）

- ✅ 删除 ChromaDB 相关文件（5个）
  - `services/parsing/VectorMemory.ts`
  - `services/parsing/VectorMemory.test.ts`
  - `services/parsing/VectorMemoryConfig.ts`
  - `components/VectorMemoryToggle.tsx`
  - `services/scriptParser.vector.test.ts`
- ✅ 修改 `services/scriptParser.ts`
  - 移除 VectorMemory、EmbeddingService 导入
  - 移除 `enableVectorMemory` 和 `vectorMemoryConfig` 配置选项
  - 移除 `vectorMemory` 和 `embeddingService` 类成员
  - 移除 `initializeVectorMemory()`、`storeChunksToVectorDB()`、`getSmartContext()`、`clearVectorMemory()`、`getVectorMemoryStats()` 方法
- ✅ 修改 `views/ScriptManager.tsx`
  - 移除 VectorMemoryToggle、VectorMemoryConfig 导入
  - 移除 `useVectorMemory` 状态和相关逻辑
  - 移除 VectorMemoryToggle UI 组件
  - 移除 ModelDownloadProgress 相关代码
  - 简化 ParseConfigConfirmModal 调用
- ✅ 修改 `vite.config.ts`
  - 移除 ChromaDB 代理中间件
  - 移除 chromadb 依赖优化配置
- ✅ 修改 `package.json`
  - 移除 `chromadb` 依赖
  - 移除 `@chroma-core/default-embed` 依赖
  - 移除 `chroma` npm 脚本
- ✅ 影响评估
  - 基础解析功能不受影响（Metadata、角色、场景提取）
  - 上下文注入功能正常工作（通过 ContextInjector）
  - 智能上下文召回功能已移除（原本未启用）
  - 长文本处理仍可用（语义分块仍然工作）

### 2026-03-07（模型排序功能实现）

- ✅ 更新类型定义 `types.ts`
  - 在 `ModelConfig` 接口中添加 `sortOrder?: number` 字段
  - 数字越小排序越靠前，默认值为 999
- ✅ 更新模型加载逻辑
  - `views/ScriptManager.tsx` - LLM 模型按 sortOrder 排序
  - `components/ScriptParser/ShotList.tsx` - LLM 和图像模型排序
  - `components/ScriptParser/ShotToFragment.tsx` - 视频模型排序
  - `components/ProjectDetail/Shared/ImageGenerationPanel.tsx` - 图像模型排序
- ✅ 更新模型配置界面 `views/Settings.tsx`
  - 在模型编辑表单中添加"排序权重"输入框
  - 支持设置 0-9999 的排序值
  - 添加提示说明：常用模型建议 10-100，不常用模型 500+
  - 保存时持久化 sortOrder 字段
- ✅ 更新默认模型配置 `config/models.ts`
  - 豆包 Lite 设置 sortOrder: 10（常用）
  - DeepSeek V3.2 设置 sortOrder: 20（次常用）
- ✅ 向后兼容
  - 无 sortOrder 的模型默认排最后（999）
  - 可选字段，不破坏现有代码

### 2026-03-07（Token 限制管理系统实现）

- ✅ 完善 `services/ai/core/ModelCapabilityManager.ts`
  - 添加 `getModelLimits()` 函数 - 支持精确匹配、模糊匹配
  - 添加 `calculateEffectiveMaxTokens()` 函数 - 自动计算有效 token 限制
  - 添加 `validateTokenConfig()` 函数 - 验证配置有效性
  - 扩展 `MODEL_LIMITS` 表 - 支持豆包、DeepSeek、Claude、GPT-4 等 20+ 模型
- ✅ 在 `services/ai/providers/LLMProvider.ts` 中集成 Token 限制
  - `generateText()` 自动应用 token 限制
  - `generateStructured()` 自动应用 token 限制
  - 超出限制时自动调整并记录日志
- ✅ 移除 `services/scriptParser.ts` 中的硬编码限制
  - 删除 `if (this.model.includes('doubao-lite'))` 判断
  - 简化代码，由 LLMProvider 统一处理
- ✅ 测试验证
  - 豆包-lite-32k 模型成功限制到 4096 tokens
  - 剧本解析质量评分 93 分
  - 支持未来 256K+ tokens 模型扩展
- ✅ 创建魔搭社区模型问题追踪文档 `docs/modelscope-issues-tracker.md`
  - 记录 Qwen 模型 Zod Schema 验证失败问题
  - 记录 Token 限制配置缺失问题
- ✅ 更新全局状态文档

### 2026-03-07（Phase 1.3 完成：UI组件清理）

- ✅ 删除 `components/VectorMemoryToggle.tsx`
  - 该组件依赖已移除的 ChromaDB 功能
- ✅ 清理 `components/ParseConfigConfirmModal.tsx`
  - 移除 `useVectorMemory` 和 `onVectorMemoryToggle` 属性
  - 移除智能记忆开关UI
  - 简化 Token 估算逻辑
- ✅ 清理 `views/ScriptManager.tsx`
  - 移除 VectorMemoryToggle、VectorMemoryConfig、EmbeddingService 导入
  - 移除 `useVectorMemory` 状态
  - 移除 `showModelDownloadModal` 和 `modelDownloadState` 状态
  - 移除 `embeddingService` 实例
  - 移除智能记忆自动检测逻辑
  - 移除 ModelDownloadProgress 组件
  - 简化 ParseConfigConfirmModal 调用
- ✅ 删除 `services/parsing/VectorMemoryConfig.ts`
- ✅ 删除 `services/parsing/EmbeddingService.ts`
- ✅ 清理 `services/scriptParser.ts`
  - 移除 EmbeddingService 导入
  - 移除 `embeddingService` 类成员
  - 移除 `getSmartContext()` 方法
- ✅ 更新全局状态文档

### 2026-03-07（Phase 2.1.2 完成：智能分批逻辑）

- ✅ 实现角色智能分批提取
  - 当角色数量 > 5 时，自动拆分为多个批次
  - 每批最多 5 个角色
  - 批次失败时自动降级到逐个提取
  - 添加 `extractCharacterBatchWithContext()` 私有方法
  - 添加 `createPlaceholderCharacter()` 私有方法
- ✅ 实现场景智能分批提取
  - 当场景数量 > 5 时，自动拆分为多个批次
  - 每批最多 5 个场景
  - 批次失败时自动降级到逐个提取
  - 添加 `extractSceneBatchWithContext()` 私有方法
  - 添加 `createPlaceholderScene()` 私有方法
- ✅ 更新 `services/scriptParser.ts`
  - 修改 `extractAllCharactersWithContext()` 方法
  - 修改 `extractAllScenesWithContext()` 方法
- ✅ 更新全局状态文档

### 2026-03-07（Phase 3.1 完成：策略选择器实现）

- ✅ 创建 `services/parsing/ParseStrategySelector.ts`
  - 实现三种解析策略：fast、standard、chunked
  - 基于字数自动选择最优策略
  - 支持用户强制覆盖策略选择
  - 提供预估时间和推荐批次大小
- ✅ 实现策略选择配置
  - 可配置阈值（fast: <800字, chunked: >5000字）
  - 可配置批次大小
  - 支持运行时配置更新
- ✅ 集成到 `ScriptParser` 类
  - 添加 `strategySelector` 实例
  - 修改 `parseScript()` 使用策略选择器
  - 添加 `forceStrategy()` 方法供用户覆盖
  - 添加 `getLastStrategySelection()` 获取选择结果
- ✅ 添加文本复杂度计算
  - 基于长度、对话密度、场景指示器等计算复杂度
  - 用于未来策略微调
- ✅ 更新全局状态文档

### 2026-03-07（Phase 2.2 完成：场景与角色提取并行执行）

- ✅ 实现角色和场景并行提取
  - 使用 `Promise.all()` 同时执行角色和场景提取
  - 减少串行等待时间
  - 保持错误处理和降级逻辑
- ✅ 优化 `parseScript()` 方法
  - 合并角色和场景提取阶段
  - 更新进度回调
  - 保持断点续传支持
- ✅ 更新全局状态文档

### 2026-03-07（Phase 2.3 完成：分镜生成批量优化）

- ✅ 实现智能分镜批量生成
  - 场景数量 <= 3：单次 API 调用生成所有分镜
  - 场景数量 > 3：每批 3 个场景，分批生成
  - 批次失败时自动降级到逐个场景生成
- ✅ 优化 `parseScript()` 中的分镜生成逻辑
  - 使用 `generateAllShotsWithContext()` 进行批量生成
  - 每批完成后保存进度
  - 保持断点续传支持
- ✅ 更新全局状态文档

### 2026-03-07（Phase 3.3 完成：长文本分块策略）

- ✅ 实现 `parseChunkedScript()` 方法
  - 使用 `SemanticChunker` 将长文本分块
  - 每块最大 3000 tokens，保持段落完整性
  - 支持跨块上下文传递
- ✅ 实现分块解析流程
  - 从第一块提取元数据
  - 逐块提取角色和场景（带去重）
  - 分批生成分镜（每批3个场景）
  - 块间延迟 500ms，避免限流
- ✅ 集成到策略选择器
  - 字数 > 5000 自动使用分块策略
  - 与 fast、standard 策略统一入口
- ✅ 更新 `parseScript()` 支持 chunked 路由
- ✅ 更新全局状态文档

### 2026-03-07（Phase 4.1 & 4.2 完成：质量监控与性能监控）

- ✅ 完善质量评估系统（基于现有 QualityAnalyzer）
  - 5维度评分：完整性、准确性、一致性、可用性、戏剧性
  - 自动识别问题并生成修复建议
  - 支持质量报告持久化到解析状态
- ✅ 创建 `services/parsing/PerformanceMonitor.ts`
  - 记录各阶段耗时和 API 调用次数
  - 计算吞吐量（words/second）
  - 识别性能瓶颈（>30% 时间的阶段）
  - 生成优化建议
- ✅ 集成到 `ScriptParser` 类
  - 添加 `performanceMonitor` 实例
  - 添加 `getPerformanceReport()` 方法
  - 添加 `getCurrentPerformanceStats()` 方法
- ✅ 更新全局状态文档

### 2026-03-07（Phase 5 完成：全面测试验证）

- ✅ 创建 `services/parsing/ParseStrategySelector.test.ts`
  - 27 个测试用例，全部通过
  - 测试策略选择（fast/standard/chunked）
  - 测试字数统计（中文、英文、数字、混合）
  - 测试强制策略覆盖
  - 测试配置动态更新
  - 测试文本复杂度计算
  - 测试边界条件
- ✅ 运行测试验证
  - `npm test -- services/parsing/ParseStrategySelector.test.ts`
  - 27 tests passed
- ✅ 更新全局状态文档

### 2026-03-07（修复：chunked路径并行提取优化）

- ✅ 修复 `parseChunkedScript` 方法中的串行提取问题
  - 角色提取和场景提取改为并行执行（Promise.all）
  - 每个分块内的提取任务并行化
  - 添加错误处理，单个任务失败不影响其他任务
  - 预期性能提升：55-59秒（约20%）
- ✅ 更新日志输出
  - 添加并行执行日志：`Executing X extraction tasks in parallel`
  - 更新进度提示：`正在并行解析第 X/Y 块...`
- ✅ 更新全局状态文档

### 2026-03-05（时长预算规划器实现）

- ✅ 创建 `services/parsing/BudgetPlanner.ts` 模块
- ✅ 实现 `DurationBudget` 和 `SceneBudget` 接口
- ✅ 实现 `calculateBudget()` 方法，支持4种平台和3种节奏类型
- ✅ 实现场景重要性权重分配（开场0.8/发展0.6/高潮1.0/结尾0.7）
- ✅ 7000字小说输出总时长控制在 210-300 秒（3.5-5分钟）范围
- ✅ 实现预算验证、平台推荐、目标时长调整功能
- ✅ 添加31个单元测试用例，全部通过
- ✅ 更新全局状态文档

### 2026-03-03（技术流程详解页面 v2.0）

- ✅ 重新编写 liucheng.html 为细颗粒度技术展示
- ✅ 包含每个步骤的：输入数据、输出数据、处理规则、代码示例
- ✅ 展示7条文本清洗规则及正则表达式
- ✅ 展示语义分块的5级分隔符优先级及权重
- ✅ 展示角色分析的8个字段和5个外貌维度
- ✅ 展示场景分析的6个提取维度
- ✅ 展示6种镜头类型及用途
- ✅ 展示关键帧拆分的完整Prompt模板
- ✅ 展示质量评估的5维度评分体系
- ✅ 展示短剧规则引擎的4条核心规则

### 2026-03-03（工作流程可视化页面 v1.0）

- ✅ 重新编写 liucheng.html 工作流程展示页面
- ✅ 基于项目实际状态更新所有内容
- ✅ 添加6个解析阶段的详细说明
- ✅ 包含数据流转图和质量评估系统

### 2026-03-03（Token估算精度优化）

- ✅ 优化Token估算精度
- ✅ 集成tiktoken库进行准确的Token计数
- ✅ 支持不同模型的tokenizer差异
- ✅ 更新全局状态文档

### 2026-03-03（深度复盘）

- ✅ 全面深度分析代码库
- ✅ 更新全局状态文档
- ✅ 补充剧本管理页面功能状态
- ✅ 补充分镜管理页面功能状态
- ✅ 补充关键帧工作流功能状态
- ✅ 更新模型配置清单（40+模型）
- ✅ 更新关键代码位置索引

### 2026-03-01（Phase 1系统性重构）

- ✅ 重构TextCleaner为系统性方案v3.0
- ✅ 核心思想转变：从"清除非法字符"到"保留合法字符"
- ✅ 简化规则：从14条减少到7条系统性规则
- ✅ 合法字符集定义：中文、英文、数字、常用标点、换行
- ✅ 测试用例重构：27个测试用例全部通过

### 2026-03-01（Phase 1优化完成）

- ✅ 文本清洗增强完成
- ✅ 错误处理集成完成
- ✅ 更新全局状态文档，标记Phase 1完成

---

## 七、使用指南

### 7.1 添加新优化建议前

1. **查阅本文档第2章** - 确认功能是否已存在
2. **查阅本文档第4章** - 确认是否已在问题清单中
3. **查阅本文档第5章** - 确认是否已评估过
4. **检查相关代码文件** - 验证实际实现状态
5. **更新本文档** - 记录新的优化项

### 7.2 修复问题后

1. **更新第4章"已知问题清单"** - 将问题移到"已修复"
2. **更新第6章"更新日志"** - 记录修复日期和内容
3. **同步代码注释** - 确保代码与文档一致
4. **如有必要，更新第5章"代码位置索引"**

---

_本文档是项目优化的权威依据，每次修改前请先查阅_
_文档维护者：AI Assistant_
_维护频率：每次优化/修复后实时更新_
