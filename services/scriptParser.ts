/**
 * Script Parser Service
 *
 * Provides intelligent script/novel parsing capabilities using LLM models.
 * Features:
 * - Multi-stage parsing pipeline (metadata → characters → scenes → shots)
 * - Concurrent processing with rate limiting
 * - Automatic error recovery and resume support
 * - LRU caching for performance optimization
 * - Progress tracking and cancellation support
 *
 * @module services/scriptParser
 * @author Nanshan AI Team
 * @version 1.0.0
 */

import { Script, ScriptParseState, ScriptMetadata, ScriptCharacter, ScriptScene, ScriptItem, Shot, ShotContentType, ShotLayer, ParseStage } from '../types';
import { storageService } from './storage';
import { JSONRepair } from './parsing/JSONRepair';
import { SemanticChunker, SemanticChunk } from './parsing/SemanticChunker';
import { ShortDramaRules, RuleContext, RuleViolation } from './parsing/ShortDramaRules';
import { MultiLevelCache } from './parsing/MultiLevelCache';
import { QualityAnalyzer, DetailedQualityReport } from './parsing/QualityAnalyzer';
import {
  ScriptMetadataSchema,
  ScriptCharacterArraySchema,
  ScriptSceneArraySchema,
  ShotArraySchema,
  ScriptItemArraySchema,
  getJsonSchemaDescription,
  getArraySchemaDescription,
} from './parsing/ParsingSchemas';
import { z } from 'zod';
import { GlobalContextExtractor, GlobalContext } from './parsing/GlobalContextExtractor';
import { ContextInjector, InjectionOptions } from './parsing/ContextInjector';
import { IterativeRefinementEngine, IterativeRefinementConfig, IterativeRefinementResult } from './parsing/refinement/IterativeRefinementEngine';
import { DurationBudget, SceneBudget, calculateBudget, validateBudget } from './parsing/BudgetPlanner';
import { ParseStrategySelector, StrategySelection, ParseStrategy, StrategySelectorConfig } from './parsing/ParseStrategySelector';
import { PerformanceMonitor, PerformanceReport } from './parsing/PerformanceMonitor';

/**
 * Script Parser Configuration Interface
 * 
 * 2.0版本重大变更：
 * - 移除所有基于字数的配置（durationBudgetConfig等）
 * - 新增creativeIntent创作意图配置
 * - 移除平台模板相关配置
 */
export interface ScriptParserConfig {
  useSemanticChunking: boolean;
  useDramaRules: boolean;
  dramaRulesMinScore: number;
  useCache: boolean;
  cacheTTL: number;
  // Note: VectorMemory/ChromaDB has been removed in v2
  // enableVectorMemory?: boolean;
  enableIterativeRefinement?: boolean; // 启用迭代优化
  iterativeRefinementConfig?: Partial<IterativeRefinementConfig>; // 迭代优化配置

  // ========== 2.0版本：创作意图配置 ==========
  
  /**
   * 创作意图
   * 用户的创作方向和风格偏好，替代旧的平台模板配置
   * @default undefined
   */
  creativeIntent?: {
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
  };

  // ========== 2.0版本：已移除的配置（保留字段用于兼容）==========

  /**
   * @deprecated 2.0移除：基于字数的时长预算规划
   * 请使用creativeIntent替代
   */
  useDurationBudget?: boolean;

  /**
   * @deprecated 2.0移除：目标平台选择
   * 请使用creativeIntent.filmStyle替代
   */
  targetPlatform?: 'douyin' | 'kuaishou' | 'bilibili' | 'premium';

  /**
   * @deprecated 2.0移除：节奏类型
   * 请使用creativeIntent.filmStyle替代
   */
  paceType?: 'fast' | 'normal' | 'slow';

  /**
   * @deprecated 2.0移除：动态时长
   */
  useDynamicDuration?: boolean;

  /**
   * @deprecated 2.0移除：基于字数的分镜质检
   */
  useShotQC?: boolean;

  /**
   * @deprecated 2.0移除：质检自动调整
   */
  qcAutoAdjust?: boolean;

  /**
   * @deprecated 2.0移除：质检容错率
   */
  qcTolerance?: number;

  /**
   * @deprecated 2.0移除：生产级Prompt开关
   * 现在默认启用专业Prompt
   */
  useProductionPrompt?: boolean;

  /**
   * @deprecated 2.0移除：生产级Prompt配置
   */
  productionPromptConfig?: {
    minShotDuration?: number;
    maxShotDuration?: number;
    sceneBudgetTolerance?: number;
    climaxMinLongShotDuration?: number;
  };

  // ========== 策略选择器配置 ==========

  /**
   * 强制使用特定解析策略
   * 设置后，解析器将忽略自动策略选择，使用指定策略
   * @default undefined (自动选择)
   */
  forcedStrategy?: ParseStrategy;

  /**
   * 策略选择器配置
   * 用于自定义策略选择的阈值和参数
   */
  strategySelectorConfig?: Partial<StrategySelectorConfig>;

  // ========== Fast Path 优化配置 ==========

  /**
   * Fast Path 跳过全局上下文提取
   * 开启后，Fast Path 模式将跳过全局上下文提取步骤以提高性能
   * @default true
   */
  skipGlobalContextForFastPath?: boolean;

  /**
   * 使用并行提取优化
   * 开启后，Fast Path 模式将并行提取元数据+全局上下文，以及角色+场景
   * 可显著缩短短剧本解析时间
   * @default true
   */
  useParallelExtraction?: boolean;

  // ========== 动态分镜数量配置 ==========

  /**
   * 启用动态分镜数量调整
   * 开启后，解析器将根据文本长度动态调整分镜数量要求
   * - 短文本(<500字): 减少分镜数，避免过度拆分
   * - 中等文本(500-1500字): 适中分镜数
   * - 长文本(>1500字): 标准分镜数
   * @default true
   */
  useDynamicShotCount?: boolean;

  /**
   * 分镜数量覆盖配置
   * 用于自定义不同文本长度对应的分镜数量要求
   */
  shotCountOverrides?: {
    /** 短文本(<500字)的分镜数量要求，如: '1-2个' */
    shortText?: string;
    /** 中等文本(500-1500字)的分镜数量要求，如: '2-3个' */
    mediumText?: string;
    /** 长文本(>1500字)的分镜数量要求，如: '3-5个' */
    longText?: string;
  };

  // ========== 全局上下文提取配置 ==========

  /**
   * 是否提取情绪曲线
   * 关闭后可减少一次LLM调用，适用于对情绪分析不敏感的场景
   * @default true
   */
  extractEmotionalArc?: boolean;

  /**
   * 文本长度阈值（字符数）
   * 低于此值的文本将跳过情绪曲线提取
   * @default 800
   */
  textLengthThreshold?: number;
}

/**
 * Quality Report Interface
 */
export interface QualityReport {
  score: number;
  violations: RuleViolation[];
  suggestions: string[];
}

/**
 * Default Script Parser Configuration
 */
const DEFAULT_PARSER_CONFIG: ScriptParserConfig = {
  useSemanticChunking: true,
  useDramaRules: true,
  dramaRulesMinScore: 60,
  useCache: true,
  cacheTTL: 3600000,

  // 时长预算与平台配置（默认关闭，保持向后兼容）
  useDurationBudget: false,
  targetPlatform: 'douyin',
  paceType: 'normal',
  useDynamicDuration: false,

  // 分镜质检配置（默认关闭，保持向后兼容）
  useShotQC: false,
  qcAutoAdjust: false,
  qcTolerance: 0.15,

  // 生产级Prompt配置（默认关闭，保持向后兼容）
  useProductionPrompt: false,
  productionPromptConfig: {
    minShotDuration: 1.5,
    maxShotDuration: 12,
    sceneBudgetTolerance: 0.15,
    climaxMinLongShotDuration: 8,
  },

  // Fast Path 优化配置（默认开启，提升性能）
  skipGlobalContextForFastPath: true,

  // 并行提取配置（默认开启，提升性能）
  useParallelExtraction: true,

  // 动态分镜数量配置（默认开启，根据文本长度调整）
  useDynamicShotCount: true,
  shotCountOverrides: {
    shortText: '1-2个',
    mediumText: '2-3个',
    longText: '3-5个'
  },

  // 全局上下文提取配置（默认开启情绪曲线提取）
  extractEmotionalArc: true,
  textLengthThreshold: 800,
};

/**
 * Script Parser Configuration
 * @constant {Object}
 */
const CONFIG = {
  /** Maximum characters per chunk for long texts */
  maxChunkSize: 6000,
  /** Default model for parsing */
  defaultModel: 'gpt-4o-mini',
  /** Maximum retry attempts for API calls */
  maxRetries: 3,
  /** Initial retry delay in ms (exponential backoff) */
  retryDelay: 2000,
  /** API call timeout in ms (60 seconds) */
  timeout: 60000,
  /** 
   * Maximum concurrent API calls
   * V2 优化：从 1 增加到 3，提升并行处理能力
   * 如果遇到限流问题，可以适当降低
   */
  concurrency: 3,
  /** 
   * Delay between API calls in ms
   * V2 优化：从 1000ms 降低到 100ms，减少不必要的等待
   * 如果遇到限流问题，可以适当增加
   */
  callDelay: 100,
};

/**
 * Task-specific configuration for different parsing stages
 * Dynamically adjusts maxTokens and timeout based on task type
 */
const TASK_CONFIG = {
  metadata: {
    maxTokens: 4000,
    timeout: 60000,
    description: '元数据提取'
  },
  globalContext: {
    maxTokens: 5000,
    timeout: 90000,
    description: '全局上下文提取'
  },
  character: {
    maxTokens: 6000,
    timeout: 90000,
    description: '角色解析'
  },
  scene: {
    maxTokens: 6000,
    timeout: 90000,
    description: '场景解析'
  },
  shots: {
    maxTokens: 12000,  // 分镜需要更多Token
    timeout: 120000,
    description: '分镜生成'
  },
  'plot-analysis': {
    maxTokens: 4000,
    timeout: 60000,
    description: '剧情分析'
  }
} as const;

type TaskType = keyof typeof TASK_CONFIG;

// Prompts for each parsing stage
const PROMPTS = {
  metadata: `
请全面分析以下剧本/小说内容，提取完整的元数据：

【剧本内容】
{content}

请提取：
1. 作品标题
2. 总字数（估算）
3. 预估时长（如"10分钟"）
4. 角色总数量（包括主要角色和重要配角）
5. 所有角色名称列表（仅名称，尽可能完整提取，不要遗漏）
6. 场景总数量（包括主要场景和重要地点）
7. 所有场景名称列表（仅名称，尽可能完整提取，不要遗漏）
8. 章节/幕数
9. 故事类型（古装/现代/科幻/悬疑等）
10. 整体基调（喜剧/悲剧/正剧）

重要提示：
- 角色提取：请仔细阅读文本，提取所有有名字的角色，包括主角、配角、甚至只出现一次但有名字的角色
- 场景提取：提取所有故事发生的地点/场景，包括室内外各种环境
- 不要限制数量，尽可能完整提取
- 如果角色/场景很多，请全部列出，不要只提取"主要"的

请严格按以下JSON格式输出，不要添加任何其他内容：
{
  "title": "作品标题",
  "wordCount": 15000,
  "estimatedDuration": "10分钟",
  "characterCount": 8,
  "characterNames": ["角色1", "角色2", "角色3", "角色4", "角色5", "角色6", "角色7", "角色8"],
  "sceneCount": 12,
  "sceneNames": ["场景1", "场景2", "场景3", "场景4", "场景5", "场景6", "场景7", "场景8", "场景9", "场景10", "场景11", "场景12"],
  "chapterCount": 5,
  "genre": "古装宅斗",
  "tone": "爽剧"
}
`,

  character: `
请基于以下剧本内容，分析角色"{characterName}"的外貌特征。

【剧本内容】
{content}

请提取以下外貌信息，严格按JSON格式输出（确保所有字段都存在）：
{
  "name": "角色名",
  "gender": "male/female/unknown",
  "age": "18",
  "identity": "身份/职业",
  "appearance": {
    "height": "身高描述，如：约165cm、身材高挑",
    "build": "体型描述，如：体型匀称、身材苗条",
    "face": "面容特征，如：瓜子脸、柳叶眉、丹凤眼",
    "hair": "发型描述，如：乌黑长发及腰、短发齐耳",
    "clothing": "服饰描述，如：淡蓝色汉服长裙、白色衬衫配西裤"
  },
  "personality": ["性格1", "性格2"],
  "signatureItems": [
    "随身标志性物品，如：玉佩、长剑、折扇、眼镜",
    "重要提示：只提取始终跟随人物的标志性物品",
    "排除临时性物品：文件、笔记本、咖啡杯、手机、纸张等"
  ],
  "emotionalArc": [
    {"phase": "初始", "emotion": "情绪状态"}
  ],
  "relationships": [
    {"character": "相关角色名", "relation": "关系描述"}
  ],
  "visualPrompt": "【系统字段，将由程序自动生成，无需填写】"
}

重要提示：
1. age字段必须是纯数字（如"18"），不要带"岁"字
2. appearance字段必须详细：包含面容、发型、服装的具体描述
3. signatureItems只包含始终跟随人物的标志性物品（如玉佩、长剑），不包含临时物品（如文件、咖啡）
4. 如果小说未提及脚部/鞋子，appearance.clothing中应包含服装风格，系统会根据风格推断鞋子
5. 所有外貌描述将用于生成全身角色设定图（包含脚部）
6. 必须返回完整的JSON，不能省略任何字段
`,

  charactersBatch: `
请基于以下剧本内容，一次性分析所有角色的外貌特征。

【剧本内容】
{content}

【角色列表】
{characterNames}

请为每个角色提取以下外貌信息，严格按JSON数组格式输出（确保所有字段都存在）：
[
  {
    "name": "角色名",
    "gender": "male/female/unknown",
    "age": "18",
    "identity": "身份/职业",
    "appearance": {
      "height": "身高描述，如：约165cm、身材高挑",
      "build": "体型描述，如：体型匀称、身材苗条",
      "face": "面容特征，如：瓜子脸、柳叶眉、丹凤眼",
      "hair": "发型描述，如：乌黑长发及腰、短发齐耳",
      "clothing": "服饰描述，如：淡蓝色汉服长裙、白色衬衫配西裤"
    },
    "personality": ["性格1", "性格2"],
    "signatureItems": [
      "随身标志性物品，如：玉佩、长剑、折扇、眼镜",
      "重要提示：只提取始终跟随人物的标志性物品",
      "排除临时性物品：文件、笔记本、咖啡杯、手机、纸张等"
    ],
    "emotionalArc": [{"phase": "初始", "emotion": "情绪状态"}],
    "relationships": [{"character": "相关角色名", "relation": "关系描述"}],
    "visualPrompt": "【系统字段，将由程序自动生成，无需填写】"
  }
]

重要提示：
1. 必须返回JSON数组，包含所有角色
2. age字段必须是纯数字
3. appearance字段必须详细：包含面容、发型、服装的具体描述
4. signatureItems只包含始终跟随人物的标志性物品（如玉佩、长剑），不包含临时物品（如文件、咖啡）
5. 如果小说未提及脚部/鞋子，appearance.clothing中应包含服装风格，系统会根据风格推断鞋子
6. 所有外貌描述将用于生成全身角色设定图（包含脚部）
7. 如果信息不足，使用合理的默认值
`,

  scenesBatch: `
请基于以下剧本内容，一次性分析所有场景的环境特征。

【剧本内容】
{content}

【场景列表】
{sceneNames}

请为每个场景提取以下环境信息，严格按JSON数组格式输出（确保所有字段都存在）：
[
  {
    "name": "场景名",
    "locationType": "indoor/outdoor/unknown",
    "description": "场景环境描述，不包含人物动作",
    "timeOfDay": "时间段",
    "season": "季节",
    "weather": "天气",
    "environment": {
      "architecture": "建筑风格和环境类型",
      "furnishings": [
        "陈设物品列表，如：办公桌、椅子、书架",
        "重要提示：只描述环境中的物品，不包含人物"
      ],
      "lighting": "光线条件，如：自然光从窗户洒入、暖黄色灯光",
      "colorTone": "色调氛围，如：冷色调、暖色调、明亮清新"
    },
    "sceneFunction": "场景作用",
    "visualPrompt": "【系统字段，将由程序自动生成，无需填写】",
    "characters": ["场景中可能出现的角色名"]
  }
]

【场景描述要求 - 严格遵守】
description字段必须满足以下条件：
1. 只描述物理环境（建筑、陈设、光线、色调、空间布局）
2. 禁止包含任何人物名称
3. 禁止包含任何人物动作（坐、站、走、跑、拿、握等）
4. 禁止包含任何剧情描述（对峙、谈判、表白、冲突、博弈等）
5. 禁止包含任何情感或氛围形容词（紧张、浪漫、悲伤、激烈等）
6. 禁止包含时间状语从句（当...时、在...过程中等）
7. 禁止使用"在此"、"这里"、"此处"等指代词

【错误示例】
- "沈若涵坐在办公桌后处理文件"（包含人名和动作）
- "现代办公室，沈若涵与顾衍之在此进行最终对峙"（包含人名、剧情、指代词）
- "宽敞明亮的会议室，见证了职场博弈的最终落幕"（包含剧情描述）
- "当江哲走进房间时，阳光正好洒在书架上"（包含动作和时间从句）
- "紧张压抑的审讯室，充满对抗氛围"（包含情感形容词）

【正确示例】
- "现代商务办公室，配备实木办公桌、皮质转椅和落地书架"（纯环境描述）
- "中型会议室，长方形会议桌配12把黑色皮椅，墙面挂有企业标识"（纯环境描述）
- "宽敞明亮的客厅，米色沙发配玻璃茶几，落地窗外是城市景观"（纯环境描述）
- "复古风格书房，深色木质书架沿墙排列，中央摆放皮质阅读椅"（纯环境描述）

重要提示：
1. 必须返回JSON数组，包含所有场景
2. description必须是纯环境描述，不能包含人物动作、人名、剧情
3. 场景图用于生成背景环境，不应有具体人物出现
4. 如果信息不足，使用合理的默认值
5. 严格遵守上述要求，确保description只描述物理环境
`,

  itemsBatch: `
请基于以下剧本内容，提取所有重要道具/物品。

【剧本内容】
{content}

请提取以下类型的道具：
1. 武器（剑、枪、法器等）
2. 工具（特殊工具、设备等）
3. 珠宝饰品（项链、戒指等）
4. 文档（信件、地图、秘籍等）
5. 生物/灵兽（宠物、坐骑等）
6. 其他重要物品

请严格按JSON数组格式输出：
[
  {
    "name": "道具名称",
    "description": "道具描述，50字以内",
    "category": "weapon/tool/jewelry/document/creature/animal/other",
    "owner": "所属角色名（如有）",
    "importance": "major/minor",
    "visualPrompt": "用于AI生图的描述，50字以内"
  }
]

重要提示：
1. 只提取对剧情有重要作用的道具
2. 普通物品（如桌椅、衣服）不需要提取
3. 必须返回JSON数组
`,

  plotAnalysis: `
【角色】专业剧本分析师
【任务】深度分析小说情节结构，识别所有情节点

【剧本内容】
{content}

【分析要求】
1. 识别所有情节点（plot points），包括：
   - 开端：故事起点、背景介绍
   - 发展：情节推进、冲突升级
   - 转折：重大转折、意外事件
   - 高潮：情感高潮、动作高潮
   - 结局：问题解决、收尾

2. 每个情节点标注：
   - type: 类型（opening/development/twist/climax/ending）
   - importance: 重要性（major/minor）
   - description: 情节描述（30字以内）
   - characters: 涉及角色
   - emotionalTone: 情感基调（喜悦/悲伤/紧张/愤怒等）

3. 统计信息：
   - totalPlotPoints: 总情节点数
   - majorPoints: 重要情节点数
   - estimatedShots: 预估分镜数（major×2 + minor×1）

【输出格式】
{
  "plotPoints": [
    {
      "type": "opening|development|twist|climax|ending",
      "importance": "major|minor",
      "description": "情节描述",
      "characters": ["角色名"],
      "emotionalTone": "情感基调",
      "sceneContext": "所属场景"
    }
  ],
  "statistics": {
    "totalPlotPoints": 20,
    "majorPoints": 8,
    "minorPoints": 12,
    "estimatedShots": {
      "shortDrama": 28,  // major×1.2 + minor×1
      "film": 40         // major×2 + minor×1.5
    }
  }
}

【重要提示】
1. 不要遗漏任何情节点，即使是很小的转折
2. 情感变化也是情节点（如从悲伤到喜悦）
3. 环境变化也是情节点（如从白天到黑夜）
4. 7000字小说通常有15-25个情节点
`,

  shotsBatch: `
【角色】专业影视分镜师
【任务】根据小说文本和情节分析生成影视级分镜脚本

【剧本内容】
{content}

【场景信息】
{scenesInfo}

【影视风格】
{filmStyle}

【输出要求】
1. 基于情节分析，为每个情节点生成适当数量的分镜：
   - 重要情节点（major）：2-3个分镜
   - 次要情节点（minor）：1-2个分镜
   - 情感变化点：增加特写分镜
   - 动作场景：增加多角度分镜

2. 根据影视风格调整密度：
   - short-drama（短剧）：快节奏，每个情节点1-2个分镜
   - film（电影）：慢节奏，每个情节点2-4个分镜，重意境
   - custom（自定义）：按用户指定密度

3. 自动分层标记：
   - key: 关键分镜（情节点、转折点、高潮）
   - optional: 可选分镜（过渡、环境展示）

4. 自动标记分镜类型：
   - static: 静态（对话/环境）→ 生成图片
   - dynamic-simple: 简单动态（走路/转身）→ 生成视频（2关键帧）
   - dynamic-complex: 复杂动态（打斗/特效）→ 生成视频（3关键帧）

5. 每个分镜必须标注style字段（short-drama/film/custom）

【影视级分镜字段】
{
  "sceneName": "场景名称",
  "shotNumber": "镜号（如SC01-01A）",
  "sequence": 1,
  "shotType": "景别",
  "cameraMovement": "运镜",
  "cameraAngle": "机位角度",
  "description": "画面描述（50字以内）",
  "dialogue": "台词",
  "sound": "音效",
  "music": "配乐提示",
  "duration": 3,
  "characters": ["角色名"],
  "assets": {
    "characterIds": ["角色资产ID"],
    "sceneId": "场景资产ID",
    "propIds": ["道具资产ID"]
  },
  "contentType": "static|dynamic-simple|dynamic-complex",
  "layer": "key|optional",
  "visualDescription": {
    "composition": "构图",
    "lighting": "光影",
    "colorPalette": "色调",
    "characterPositions": [
      {
        "characterId": "角色ID",
        "position": "位置",
        "action": "动作",
        "expression": "表情"
      }
    ]
  }
}

【景别选项】
extreme_long(大远景), long(远景), full(全景), medium(中景), close_up(近景), extreme_close_up(特写)

【运镜选项】
static(静止), push(推), pull(拉), pan(摇), tilt(升降), track(跟), crane(crane), zoom_in(变焦推), zoom_out(变焦拉), dolly_in(移近), dolly_out(移远)

【机位角度】
eye_level(平视), high_angle(俯拍), low_angle(仰拍), dutch_angle(倾斜), overhead(顶拍), bird_eye(鸟瞰)

【质量标准】
1. 分镜必须可拍摄，避免"泛、乱、不可拍"
2. 角色形象与角色库保持一致
3. 场景风格与场景库保持一致
4. 情节连贯，无遗漏
5. 镜号格式：SC{场景序号}-{分镜序号}{子序号}

【输出格式】
严格按JSON数组格式输出，包含所有字段。
`,

  scene: `
请分析以下剧本中的场景"{sceneName}"。

【剧本内容】
{content}

请提取以下信息，严格按JSON格式输出（确保所有字段都存在）：
{
  "name": "场景名",
  "locationType": "indoor/outdoor/unknown",
  "description": "场景描述",
  "timeOfDay": "时间段",
  "season": "季节",
  "weather": "天气",
  "environment": {
    "architecture": "建筑风格",
    "furnishings": ["陈设1"],
    "lighting": "光线条件",
    "colorTone": "色调氛围"
  },
  "sceneFunction": "场景在故事中的作用",
  "visualPrompt": "用于AI生图的详细视觉描述，100字以内",
  "characters": ["场景中出现的角色名"]
}

重要提示：
1. 如果信息不足，使用合理的默认值填充所有字段
2. 必须返回完整的JSON，不能省略任何字段
`,

  shots: `
请为以下场景生成分镜脚本。

【场景信息】
场景名称: {sceneName}
场景描述: {sceneDescription}
涉及角色: {characters}

【剧本原文】
{content}

请生成详细分镜，要求：
1. 每个镜头包含：序号、景别、运镜方式、画面描述、台词、音效、预估时长、涉及角色
2. 景别选项：extreme_long(极远景), long(远景), full(全景), medium(中景), close_up(近景), extreme_close_up(极近景)
3. 运镜选项：static(固定), push(推), pull(拉), pan(摇), tilt(升降), track(移), crane(升降)
4. 每个场景生成5-15个镜头

请严格按以下JSON数组格式输出：
[
  {
    "sequence": 1,
    "shotType": "full",
    "cameraMovement": "static",
    "description": "画面描述",
    "dialogue": "台词（可选）",
    "sound": "音效（可选）",
    "duration": 3,
    "characters": ["角色名"]
  }
]
`,

  /**
   * 生产级分镜生成Prompt模板
   * 包含完整的预算约束、时长分配策略和硬性约束规则
   */
  productionShots: `
请为以下场景生成专业级分镜脚本。你是一个资深的影视导演，需要严格按照生产规范生成分镜。

【场景信息】
场景名称: {sceneName}
场景描述: {sceneDescription}
涉及角色: {characters}

【剧本原文】
{content}

📊 项目预算信息
- 目标平台: {targetPlatform}
- 总时长预算: {totalDuration}秒
- 本场景分配时长: {sceneAllocatedDuration}秒
- 建议分镜数: {recommendedShotCount}个
- 单镜时长范围: {minShotDuration}-{maxShotDuration}秒

🎬 场景信息
- 场景名称: {sceneName}
- 场景类型: {sceneImportance}
- 在故事中的位置: {scenePosition}
- 叙事重要性: {narrativeImportance}
- 情感强度: {emotionalIntensity}

⏱️ 时长分配策略（必须严格遵守）
- 开场/结尾镜头: 6-10秒（建立场景氛围、交代环境）
- 对话镜头: 4-6秒（根据台词长度调整）
- 动作镜头: 2-4秒（快节奏、保持张力）
- 高潮镜头: 6-12秒（情感爆发、关键转折）
- 转场镜头: 2-3秒（过渡流畅）

⚠️ 硬性约束（必须严格遵守，否则视为无效输出）
1. 【时长范围】每个分镜时长必须在 {minShotDuration}-{maxShotDuration} 秒范围内
2. 【时长变化】连续3个分镜不能有相同时长（避免单调节奏）
3. 【总时长约束】本场景所有分镜时长之和必须接近 {sceneAllocatedDuration}秒（±15%误差范围：{minTotalDuration}-{maxTotalDuration}秒）
4. 【高潮要求】{climaxRequirement}

📝 输出格式要求
请严格按以下JSON数组格式输出，每个分镜必须包含 rationale 字段说明时长选择理由：
[
  {
    "sequence": 1,
    "shotType": "full",
    "cameraMovement": "static",
    "description": "画面描述，包含景别、角度、主体动作",
    "dialogue": "台词（如有）",
    "sound": "音效/配乐提示",
    "duration": 5,
    "characters": ["角色名"],
    "rationale": "时长选择理由：如'开场建立镜头，需要6秒让观众适应场景'"
  }
]

💡 导演指导原则
1. 景别变化要有节奏感，避免连续相同景别
2. 运镜选择要服务于叙事，不要过度炫技
3. 时长分配要符合情感曲线，紧张场景短、情感场景长
4. 每个分镜都要有明确的叙事目的
`
};

export interface ParseProgressCallback {
  (stage: ParseStage, progress: number, message?: string): void;
}

/**
 * Concurrency limiter for controlling parallel API calls
 * Implements a simple semaphore pattern to limit concurrent executions
 *
 * @example
 * const limiter = new ConcurrencyLimiter(2);
 * const results = await Promise.all([
 *   limiter.run(() => fetchData1()),
 *   limiter.run(() => fetchData2()),
 *   limiter.run(() => fetchData3()), // Will wait until one slot is free
 * ]);
 */
class ConcurrencyLimiter {
  /** Maximum number of concurrent executions allowed */
  private concurrency: number;
  /** Current number of running executions */
  private running: number = 0;
  /** Queue of pending execution resolvers */
  private queue: Array<() => void> = [];

  /**
   * Creates a new concurrency limiter
   * @param concurrency - Maximum number of concurrent executions
   */
  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  /**
   * Execute a function with concurrency limiting
   * @param fn - Async function to execute
   * @returns Promise that resolves with the function's return value
   * @template T - Return type of the function
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }

    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next?.();
      }
    }
  }
}

/**
 * LRU (Least Recently Used) cache with TTL support
 * Used to cache parsed character and scene data to avoid redundant API calls
 *
 * Features:
 * - LRU eviction policy: removes least recently used items when capacity is reached
 * - TTL (Time To Live): automatically expires entries after specified duration
 * - Hash-based keys: converts content to hash for efficient storage
 *
 * @example
 * const cache = new ParseCache(50, 3600000); // 50 items, 1 hour TTL
 * cache.set(content, parsedData);
 * const data = cache.get(content); // Returns cached data or null
 */
class ParseCache {
  /** Internal cache storage using Map to maintain insertion order for LRU */
  private cache: Map<string, { result: any; timestamp: number }> = new Map();
  /** Maximum number of items to store */
  private maxSize: number;
  /** Time to live in milliseconds */
  private ttl: number;

  /**
   * Creates a new parse cache
   * @param maxSize - Maximum number of items to store (default: 100)
   * @param ttl - Time to live in milliseconds (default: 3600000 = 1 hour)
   */
  constructor(maxSize: number = 100, ttl: number = 3600000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Generates a hash for the given content
   * Uses DJB2 algorithm for fast hashing
   * @param content - Content to hash
   * @returns Hex string hash
   * @private
   */
  private hash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Retrieves a cached value
   * Updates access order for LRU tracking
   * Checks TTL and removes expired entries
   *
   * @param content - Original content used as cache key
   * @returns Cached result or null if not found or expired
   */
  get(content: string): any | null {
    const key = this.hash(content);
    const entry = this.cache.get(key);

    if (entry) {
      // Check TTL
      if (Date.now() - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        return null;
      }
      // Move to end (LRU) - mark as recently used
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.result;
    }
    return null;
  }

  /**
   * Stores a value in the cache
   * Evicts oldest item if capacity is reached
   *
   * @param content - Content to use as cache key
   * @param result - Result to cache
   */
  set(content: string, result: any): void {
    const key = this.hash(content);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, { result, timestamp: Date.now() });
  }

  /**
   * Clears all cached entries
   */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Main script parser class
 * Provides comprehensive script/novel parsing capabilities using LLM models
 *
 * Parsing Pipeline:
 * 1. Metadata extraction - Extract basic info (title, characters, scenes count)
 * 2. Character analysis - Detailed analysis of each character
 * 3. Scene analysis - Detailed analysis of each scene
 * 4. Shot generation - Generate shot list for each scene
 *
 * Features:
 * - Concurrent processing with rate limiting
 * - Automatic retry with exponential backoff
 * - Progress tracking and cancellation
 * - Error recovery and resume support
 * - LRU caching for performance
 *
 * @example
 * const parser = createScriptParser('your-api-key');
 * const state = await parser.parseScript(
 *   scriptId,
 *   projectId,
 *   content,
 *   (stage, progress, message) => console.log(`${stage}: ${progress}% - ${message}`)
 * );
 */
export class ScriptParser {
  /** API key for LLM service */
  private apiKey: string;
  /** Base URL for LLM API */
  private apiUrl: string;
  /** Model name to use for parsing */
  private model: string;
  /** Provider type for LLM service */
  private provider: string;
  /** AbortController for cancellation support */
  private abortController: AbortController | null = null;
  /** Concurrency limiter for API calls */
  private limiter: ConcurrencyLimiter;
  /** Cache for parsed results */
  private cache: ParseCache;
  /** Hash of current content for cache key generation */
  private contentHash: string = '';
  /** Parser configuration */
  private parserConfig: ScriptParserConfig;
  /** Semantic chunker instance */
  private semanticChunker: SemanticChunker | null = null;
  /** Short drama rules instance */
  private dramaRules: ShortDramaRules | null = null;
  /** Multi-level cache instance */
  private multiLevelCache: MultiLevelCache | null = null;
  /** Quality report from last analysis */
  private qualityReport: DetailedQualityReport | null = null;
  /** Current scenes for rules validation */
  private currentScenes: ScriptScene[] = [];
  /** Current characters for rules validation */
  private currentCharacters: ScriptCharacter[] = [];
  /** Current items for quality validation */
  private currentItems: ScriptItem[] = [];
  /** Quality analyzer instance */
  private qualityAnalyzer: QualityAnalyzer | null = null;
  /** Global context extractor instance */
  private globalContextExtractor: GlobalContextExtractor | null = null;
  /** Context injector instance */
  private contextInjector: ContextInjector | null = null;
  /** Extracted global context for all parsing stages */
  private globalContext: GlobalContext | null = null;
  /** Whether to use global context injection */
  private useGlobalContext: boolean = true;
  /** Iterative refinement engine for automatic optimization */
  private iterativeRefinementEngine: IterativeRefinementEngine | null = null;
  /** Iterative refinement result from last optimization */
  private iterativeRefinementResult: IterativeRefinementResult | null = null;
  /** Duration budget result from last calculation */
  private durationBudget: DurationBudget | null = null;
  /** Strategy selector for automatic strategy selection */
  private strategySelector: ParseStrategySelector | null = null;
  /** Last strategy selection result */
  private lastStrategySelection: StrategySelection | null = null;
  /** Performance monitor for tracking parsing metrics */
  private performanceMonitor: PerformanceMonitor | null = null;

  /**
   * Creates a new script parser instance
   * @param apiKey - API key for LLM service
   * @param apiUrl - Base URL for LLM API (default: OpenAI)
   * @param model - Model name to use (default: gpt-4o-mini)
   * @param provider - Provider type (default: volcengine)
   * @param config - Optional parser configuration
   */
  constructor(
    apiKey: string,
    apiUrl: string = 'https://api.openai.com/v1',
    model: string = CONFIG.defaultModel,
    provider: string = 'volcengine',
    config: Partial<ScriptParserConfig> = {}
  ) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.model = model;
    this.provider = provider;
    this.limiter = new ConcurrencyLimiter(CONFIG.concurrency);
    this.cache = new ParseCache(50, 3600000);

    this.parserConfig = { ...DEFAULT_PARSER_CONFIG, ...config };

    // Initialize strategy selector
    this.strategySelector = new ParseStrategySelector({
      ...this.parserConfig.strategySelectorConfig,
      forcedStrategy: this.parserConfig.forcedStrategy
    });

    console.log('[ScriptParser] Initialized with config:', {
      useSemanticChunking: this.parserConfig.useSemanticChunking,
      useDramaRules: this.parserConfig.useDramaRules,
      dramaRulesMinScore: this.parserConfig.dramaRulesMinScore,
      useCache: this.parserConfig.useCache,
      cacheTTL: this.parserConfig.cacheTTL,
      useGlobalContext: this.useGlobalContext,
      enableIterativeRefinement: this.parserConfig.enableIterativeRefinement,
      hasIterativeRefinementConfig: !!this.parserConfig.iterativeRefinementConfig
    });

    if (this.parserConfig.useSemanticChunking) {
      this.semanticChunker = new SemanticChunker({ extractMetadata: true });
      console.log('[ScriptParser] SemanticChunker initialized');
    }
    if (this.parserConfig.useDramaRules) {
      this.dramaRules = new ShortDramaRules();
      console.log('[ScriptParser] ShortDramaRules initialized');
    }
    if (this.parserConfig.useCache) {
      this.multiLevelCache = new MultiLevelCache({ l1TTL: this.parserConfig.cacheTTL });
      console.log('[ScriptParser] MultiLevelCache initialized');
    }

    // Initialize quality analyzer
    this.qualityAnalyzer = new QualityAnalyzer({
      dramaticRulesMinScore: this.parserConfig.dramaRulesMinScore,
    });
    console.log('[ScriptParser] QualityAnalyzer initialized');

    // Initialize performance monitor
    this.performanceMonitor = new PerformanceMonitor();
    console.log('[ScriptParser] PerformanceMonitor initialized');

    // Initialize global context extractor and context injector
    this.initializeGlobalContextSupport();

    // Note: VectorMemory has been removed in v2
    // this.initializeVectorMemory();

    // Initialize iterative refinement engine if enabled
    this.initializeIterativeRefinement();

    // Initialize budget planner if enabled
    this.initializeBudgetPlanner();

    // Note: VectorMemory has been removed in v2
  }

  /**
   * Initialize budget planner for duration budget calculation
   * @private
   */
  private initializeBudgetPlanner(): void {
    if (!this.parserConfig.useDurationBudget) {
      console.log('[ScriptParser] Budget planner disabled');
      return;
    }

    // Budget calculation functions are imported from BudgetPlanner module
    console.log('[ScriptParser] Budget calculation functions ready');
  }

  /**
   * Initialize iterative refinement engine for automatic optimization
   * @private
   */
  private initializeIterativeRefinement(): void {
    if (!this.parserConfig.enableIterativeRefinement) {
      console.log('[ScriptParser] Iterative refinement disabled');
      return;
    }

    try {
      this.iterativeRefinementEngine = new IterativeRefinementEngine(
        this.parserConfig.iterativeRefinementConfig
      );
      console.log('[ScriptParser] IterativeRefinementEngine initialized');
    } catch (error) {
      console.warn('[ScriptParser] Failed to initialize iterative refinement engine:', error);
      this.iterativeRefinementEngine = null;
    }
  }

  /**
   * Initialize global context extraction and injection support
   * @private
   */
  private initializeGlobalContextSupport(): void {
    if (!this.useGlobalContext) {
      console.log('[ScriptParser] Global context support disabled');
      return;
    }

    // Initialize context injector with default options
    this.contextInjector = new ContextInjector({
      includeStoryContext: true,
      includeVisualContext: true,
      includeEraContext: true,
      includeEmotionalContext: true,
      includeConsistencyRules: true,
      maxPromptLength: 8000
    });
    console.log('[ScriptParser] ContextInjector initialized');

    // GlobalContextExtractor will be initialized when needed with LLM provider
    console.log('[ScriptParser] Global context support initialized');
  }

  /**
   * Get current parser configuration
   */
  getConfig(): ScriptParserConfig {
    return { ...this.parserConfig };
  }

  /**
   * Update parser configuration
   */
  updateConfig(config: Partial<ScriptParserConfig>): void {
    this.parserConfig = { ...this.parserConfig, ...config };
    
    if (config.useSemanticChunking !== undefined) {
      if (config.useSemanticChunking && !this.semanticChunker) {
        this.semanticChunker = new SemanticChunker({ extractMetadata: true });
      } else if (!config.useSemanticChunking) {
        this.semanticChunker = null;
      }
    }
    
    if (config.useDramaRules !== undefined) {
      if (config.useDramaRules && !this.dramaRules) {
        this.dramaRules = new ShortDramaRules();
      } else if (!config.useDramaRules) {
        this.dramaRules = null;
      }
    }
    
    if (config.useCache !== undefined) {
      if (config.useCache && !this.multiLevelCache) {
        this.multiLevelCache = new MultiLevelCache({ l1TTL: this.parserConfig.cacheTTL });
      } else if (!config.useCache) {
        this.multiLevelCache = null;
      }
    }
  }

  /**
   * Get quality report from last analysis
   */
  getQualityReport(): DetailedQualityReport | null {
    return this.qualityReport;
  }

  /**
   * Generate quality report for current parsing state
   * Can be called at any stage to get real-time quality feedback
   */
  generateQualityReport(
    metadata: ScriptMetadata | undefined,
    characters: ScriptCharacter[],
    scenes: ScriptScene[],
    items: ScriptItem[],
    shots: Shot[],
    stage: 'metadata' | 'characters' | 'scenes' | 'shots' | 'completed'
  ): DetailedQualityReport | null {
    if (!this.qualityAnalyzer) {
      console.warn('[ScriptParser] QualityAnalyzer not initialized');
      return null;
    }

    // 确定是否提取了情绪曲线
    const emotionalArcExtracted = metadata?.emotionalArc !== undefined && metadata.emotionalArc.length > 0;
    
    // 确定跳过的功能列表
    const skippedFeatures: string[] = [];
    if (!emotionalArcExtracted) {
      skippedFeatures.push('emotionalArc');
    }

    const report = this.qualityAnalyzer.analyze(
      metadata, 
      characters, 
      scenes, 
      items, 
      shots, 
      stage,
      emotionalArcExtracted,
      skippedFeatures.length > 0 ? skippedFeatures : undefined
    );
    this.qualityReport = report;
    
    console.log(`[ScriptParser] Quality report generated for stage: ${stage}`, {
      score: report.score,
      grade: report.overallGrade,
      confidence: report.confidence,
      issues: report.violations.length,
      emotionalArcExtracted: report.emotionalArcExtracted,
      skippedFeatures: report.skippedFeatures,
    });

    return report;
  }

  /**
   * Get the last strategy selection result
   * Useful for UI display and debugging
   */
  getLastStrategySelection(): StrategySelection | null {
    return this.lastStrategySelection;
  }

  /**
   * Force a specific parsing strategy (user override)
   * @param strategy - Strategy to force, or undefined to reset to auto
   */
  forceStrategy(strategy: ParseStrategy | undefined): void {
    if (this.strategySelector) {
      this.strategySelector.forceStrategy(strategy);
      console.log(`[ScriptParser] Strategy ${strategy ? 'forced to: ' + strategy : 'reset to auto'}`);
    }
  }

  /**
   * Get current strategy configuration
   */
  getStrategyConfig(): StrategySelectorConfig | null {
    return this.strategySelector?.getConfig() || null;
  }

  /**
   * Update strategy selector configuration
   * @param config - Partial configuration update
   */
  updateStrategyConfig(config: Partial<StrategySelectorConfig>): void {
    if (this.strategySelector) {
      this.strategySelector.updateConfig(config);
      console.log('[ScriptParser] Strategy config updated:', config);
    }
  }

  /**
   * Get performance report from last parsing session
   */
  getPerformanceReport(): PerformanceReport | null {
    return this.performanceMonitor?.generateReport() || null;
  }

  /**
   * Get current performance statistics
   */
  getCurrentPerformanceStats(): {
    elapsedTime: number;
    currentStage: string | null;
    apiCalls: number;
    progress: number;
  } | null {
    return this.performanceMonitor?.getCurrentStats() || null;
  }

  /**
   * Cancels any ongoing parsing operation
   * Aborts the current API request if one is in progress
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Generates a hash for content caching
   * Uses DJB2 algorithm for consistent hashing
   * @param content - Content to hash
   * @returns Hex string hash
   * @private
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * 根据文本长度估算叙事时长和分镜数量
   * 行业标准：200字/分钟，8-12个分镜/分钟（短剧标准）
   * @param textLength - 文本长度（字符数）
   * @returns 分镜生成配置
   * @private
   */
  private calculateShotGeneration(textLength: number): {
    estimatedMinutes: number;
    targetShots: number;
    keyShots: number;
    optionalShots: number;
    density: number;
  } {
    // 叙事语速：200字/分钟（行业标准）
    const estimatedMinutes = Math.ceil(textLength / 200);
    
    // 分镜密度：3-5个/分钟（修正为更合理的值）
    // 短剧标准8-12个/分钟，但AI生成成本考虑，取保守值3-5个
    let density = 3;
    if (textLength < 3000) density = 5;      // 短篇：更密集
    else if (textLength < 10000) density = 4; // 中篇：适中
    else density = 3;                         // 长篇：稀疏
    
    // 目标分镜数（设置上限避免过多）
    let targetShots = Math.ceil(estimatedMinutes * density);
    const maxShots = textLength < 10000 ? 150 : 500; // 中短篇上限150，长篇上限500
    targetShots = Math.min(targetShots, maxShots);
    
    // 分层：关键分镜70%，可选分镜30%
    const keyShots = Math.ceil(targetShots * 0.7);
    const optionalShots = targetShots - keyShots;
    
    console.log(`[ScriptParser] Shot calculation: ${textLength} chars → ${estimatedMinutes}min → ${targetShots} shots (key: ${keyShots}, optional: ${optionalShots}, density: ${density})`);
    
    return {
      estimatedMinutes,
      targetShots,
      keyShots,
      optionalShots,
      density,
    };
  }

  /**
   * V3: Count words in content (Chinese characters + English words)
   * @param content - Text content
   * @returns Word count
   * @private
   */
  private countWords(content: string): number {
    // Remove extra whitespace
    const trimmed = content.trim();
    if (!trimmed) return 0;

    // Count Chinese characters
    const chineseChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length;

    // Count English words (sequences of letters)
    const englishWords = (trimmed.match(/[a-zA-Z]+/g) || []).length;

    // Count numbers as words
    const numbers = (trimmed.match(/\d+/g) || []).length;

    return chineseChars + englishWords + numbers;
  }

  /**
   * Splits long text into chunks while preserving paragraph integrity
   * Ensures paragraphs are not split across chunks
   *
   * @param text - Text to split
   * @param maxChunkSize - Maximum size of each chunk (default: 8000)
   * @returns Array of text chunks
   * @private
   */
  private async chunkText(text: string, maxChunkSize: number = CONFIG.maxChunkSize): Promise<string[]> {
    if (this.parserConfig.useSemanticChunking && this.semanticChunker) {
      return await this.semanticChunkText(text);
    }
    return this.legacyChunkText(text, maxChunkSize);
  }

  /**
   * Semantic chunking using SemanticChunker
   * Preserves chapter boundaries and adds context
   * @param text - Text to split
   * @returns Array of text chunks
   * @private
   */
  private async semanticChunkText(text: string): Promise<string[]> {
    console.log('[ScriptParser] Using semantic chunking');

    // Use async chunk method to support vector storage
    const chunks = await this.semanticChunker!.chunk(text);
    console.log(`[ScriptParser] Semantic chunking produced ${chunks.length} chunks`);

    // Note: VectorMemory has been removed in v2

    return chunks.map(chunk => chunk.content);
  }

  /**
   * Legacy chunking method - splits by paragraph boundaries
   * Preserved as fallback when semantic chunking is disabled
   * @param text - Text to split
   * @param maxChunkSize - Maximum size of each chunk
   * @returns Array of text chunks
   * @private
   */
  private legacyChunkText(text: string, maxChunkSize: number = CONFIG.maxChunkSize): string[] {
    console.log('[ScriptParser] Using legacy chunking');
    const chunks: string[] = [];
    const paragraphs = text.split('\n\n');
    let currentChunk = '';

    for (const para of paragraphs) {
      if (currentChunk.length + para.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  // Note: VectorMemory has been removed in v2
  // getSmartContext() method removed

  /**
   * Makes API request to LLM with timeout and automatic retry
   * Implements exponential backoff for rate limiting and server errors
   *
   * Features:
   * - 60 second timeout
   * - Up to 3 retry attempts
   * - Exponential backoff (1s, 2s, 4s)
   * - Automatic retry on 429 (rate limit) and 5xx errors
   * - Cancellation support via AbortController
   *
   * @param prompt - Prompt to send to LLM
   * @param retryCount - Current retry attempt (used internally)
   * @returns LLM response text
   * @throws Error if API call fails after all retries
   * @private
   */
  private async callLLM(
    prompt: string,
    taskType: TaskType = 'metadata',
    retryCount: number = 0
  ): Promise<string> {
    const taskConfig = TASK_CONFIG[taskType];

    console.log(`[ScriptParser] callLLM called for ${taskType}, retryCount: ${retryCount}`);
    console.log(`[ScriptParser] API URL: ${this.apiUrl}`);
    console.log(`[ScriptParser] Model: ${this.model}`);
    console.log(`[ScriptParser] Max Tokens: ${taskConfig.maxTokens}`);

    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), taskConfig.timeout);

    try {
      // Use LLMProvider instead of direct fetch to properly handle proxy
      const { llmProvider } = await import('./ai/providers/LLMProvider');

      const config = {
        id: 'temp',
        name: 'Temp',
        provider: this.provider,
        modelId: this.model,
        apiUrl: this.apiUrl,
        apiKey: this.apiKey,
        type: 'llm' as const,
        parameters: [],
        capabilities: {
          supportsImageInput: false,
          supportsVideoInput: false,
          supportsTextOutput: true,
          supportsImageOutput: false,
          supportsVideoOutput: false,
          maxTokens: taskConfig.maxTokens,
          maxInputTokens: 8000
        }
      };

      console.log('[ScriptParser] Calling LLMProvider.generateText...');
      const result = await llmProvider.generateText(
        prompt,
        config,
        '你是一个专业的剧本分析助手，擅长从小说/剧本中提取结构化信息。请严格按照要求的JSON格式输出。'
      );

      clearTimeout(timeoutId);

      if (!result.success) {
        const errorMsg = result.error || 'Unknown error';
        console.error(`[ScriptParser] LLMProvider error: ${errorMsg}`);

        // Retry on rate limit or server errors
        if (retryCount < CONFIG.maxRetries) {
          const delay = CONFIG.retryDelay * Math.pow(2, retryCount);
          console.warn(`API error, retrying in ${delay}ms... (attempt ${retryCount + 1}/${CONFIG.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.callLLM(prompt, taskType, retryCount + 1);
        }

        throw new Error(`LLM API Error: ${errorMsg}`);
      }

      console.log(`[ScriptParser] LLM response received, length: ${result.data?.length || 0}`);
      return result.data || '';
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error(`[ScriptParser] callLLM error: ${error.message}`, error);

      // Retry on network errors
      if (error.name === 'TypeError' || error.name === 'AbortError') {
        if (retryCount < CONFIG.maxRetries) {
          const delay = CONFIG.retryDelay * Math.pow(2, retryCount);
          console.warn(`Network error, retrying in ${delay}ms... (attempt ${retryCount + 1}/${CONFIG.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.callLLM(prompt, taskType, retryCount + 1);
        }
      }

      throw error;
    }
  }

  /**
   * Extracts and parses JSON from LLM response
   * Uses JSONRepair utility for robust parsing with multiple fallback strategies
   * 
   * @param response - Raw LLM response text
   * @returns Parsed JSON object
   * @throws Error if JSON cannot be parsed after all repair attempts
   * @template T - Expected return type
   * @private
   */
  private extractJSON<T>(response: string): T {
    const result = JSONRepair.repairAndParse<T>(response);

    if (result.success && result.data) {
      if (result.repairAttempts.length > 0) {
        console.log(`[ScriptParser] JSON repaired using: ${result.repairAttempts.join(' -> ')}`);
      }
      return result.data;
    }

    console.error('[ScriptParser] Failed to parse JSON:', result.error);
    console.error('[ScriptParser] Original response:', response);
    throw new Error(result.error || 'Invalid JSON response from LLM');
  }

  /**
   * 使用结构化输出调用LLM（新方案）
   * @param prompt 用户提示词
   * @param schema Zod Schema用于类型校验
   * @param schemaDescription Schema描述（给LLM看的）
   * @param systemPrompt 系统提示词
   * @param taskType 任务类型，用于动态配置maxTokens
   */
  private async callStructuredLLM<T>(
    prompt: string,
    schema: z.ZodType<T>,
    schemaDescription: string,
    systemPrompt?: string,
    taskType: TaskType = 'metadata'
  ): Promise<T> {
    const taskConfig = TASK_CONFIG[taskType];

    console.log(`[ScriptParser] callStructuredLLM called for ${taskType}`);
    console.log(`[ScriptParser] API URL: ${this.apiUrl}`);
    console.log(`[ScriptParser] Model: ${this.model}`);
    console.log(`[ScriptParser] Max Tokens: ${taskConfig.maxTokens}`);

    // Use LLMProvider for structured output
    const { llmProvider } = await import('./ai/providers/LLMProvider');

    const config = {
      id: 'temp',
      name: 'Temp',
      provider: this.provider,
      modelId: this.model,
      apiUrl: this.apiUrl,
      apiKey: this.apiKey,
      type: 'llm' as const,
      parameters: [],
      capabilities: {
        supportsJsonMode: true, // 启用JSON Mode
        supportsImageInput: false,
        supportsVideoInput: false,
        supportsTextOutput: true,
        supportsImageOutput: false,
        supportsVideoOutput: false,
        maxTokens: taskConfig.maxTokens,
        maxInputTokens: 8000
      }
    };

    console.log('[ScriptParser] Calling LLMProvider.generateStructured...');
    const result = await llmProvider.generateStructured(
      prompt,
      config,
      schema,
      schemaDescription,
      systemPrompt || '你是一个专业的剧本分析助手，擅长从小说/剧本中提取结构化信息。'
    );

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get structured output from LLM');
    }

    console.log(`[ScriptParser] Structured output received successfully`);
    return result.data;
  }

  /**
   * Validate and fill missing fields for character data
   */
  private validateCharacter(character: Partial<ScriptCharacter>, name: string): ScriptCharacter {
    return {
      name: character.name || name,
      gender: character.gender || 'unknown',
      age: character.age || '25',
      identity: character.identity || '未知身份',
      appearance: {
        height: character.appearance?.height || '中等身高',
        build: character.appearance?.build || '标准体型',
        face: character.appearance?.face || '面容端正',
        hair: character.appearance?.hair || '普通发型',
        clothing: character.appearance?.clothing || '日常服饰',
      },
      personality: character.personality?.length ? character.personality : ['性格温和'],
      signatureItems: character.signatureItems?.length ? character.signatureItems : [],
      emotionalArc: character.emotionalArc?.length ? character.emotionalArc : [{ phase: '初始', emotion: '平静' }],
      relationships: character.relationships?.length ? character.relationships : [],
      visualPrompt: character.visualPrompt || `${name}的角色形象`,
    };
  }

  /**
   * Validate and fill missing fields for scene data
   */
  private validateScene(scene: Partial<ScriptScene>, name: string): ScriptScene {
    return {
      name: scene.name || name,
      locationType: scene.locationType || 'unknown',
      description: scene.description || name,
      timeOfDay: scene.timeOfDay || '白天',
      season: scene.season || '春季',
      weather: scene.weather || '晴朗',
      environment: {
        architecture: scene.environment?.architecture || '普通建筑',
        furnishings: scene.environment?.furnishings?.length ? scene.environment.furnishings : ['基本陈设'],
        lighting: scene.environment?.lighting || '自然光',
        colorTone: scene.environment?.colorTone || '明亮',
      },
      sceneFunction: scene.sceneFunction || '推进剧情',
      visualPrompt: scene.visualPrompt || `${name}的场景画面`,
      characters: scene.characters?.length ? scene.characters : [],
    };
  }

  /**
   * Initialize GlobalContextExtractor with model config
   * @private
   */
  private initializeContextExtractor(): void {
    if (this.globalContextExtractor) return;

    // Use TASK_CONFIG for consistent token limits
    const taskConfig = TASK_CONFIG.globalContext;

    // Create a temporary model config for context extraction
    const config = {
      id: 'temp-context',
      name: 'Temp Context Extractor',
      provider: this.provider,
      modelId: this.model,
      apiUrl: this.apiUrl,
      apiKey: this.apiKey,
      type: 'llm' as const,
      parameters: [
        {
          name: 'maxTokens',
          label: 'Max Tokens',
          type: 'number' as const,
          defaultValue: taskConfig.maxTokens,  // Use 5000 from TASK_CONFIG
          description: 'Maximum tokens for context extraction',
        }
      ],
      capabilities: {
        supportsJsonMode: true,
        supportsSystemPrompt: true
      }
    };

    // Create extractor config from parser config
    const extractorConfig = {
      extractEmotionalArc: this.parserConfig.extractEmotionalArc ?? true,
      textLengthThreshold: this.parserConfig.textLengthThreshold ?? 800
    };

    console.log(`[ScriptParser] GlobalContextExtractor initialized with maxTokens: ${taskConfig.maxTokens}`);
    console.log(`[ScriptParser] GlobalContextExtractor config:`, extractorConfig);

    this.globalContextExtractor = new GlobalContextExtractor(config, extractorConfig);
    console.log('[ScriptParser] GlobalContextExtractor initialized with model config');
  }

  /**
   * Extract global context from script content
   * This should be called after metadata extraction to enrich the parsing context
   * @param content - Script content
   * @returns Global context object
   */
  async extractGlobalContext(content: string): Promise<GlobalContext | null> {
    if (!this.useGlobalContext) {
      console.log('[ScriptParser] Global context extraction skipped (disabled)');
      return null;
    }

    console.log('[ScriptParser] ========== Extracting Global Context ==========');

    try {
      // Initialize extractor if needed
      this.initializeContextExtractor();

      if (!this.globalContextExtractor) {
        throw new Error('GlobalContextExtractor not initialized');
      }

      // Extract global context
      this.globalContext = await this.globalContextExtractor.extract(content);

      console.log('[ScriptParser] Global context extracted successfully:');
      console.log(`  - Story synopsis: ${this.globalContext.story.synopsis?.substring(0, 50)}...`);
      console.log(`  - Visual style: ${this.globalContext.visual.artStyle}`);
      console.log(`  - Era: ${this.globalContext.era.era}`);
      console.log(`  - Emotional arc points: ${this.globalContext.emotional.arc?.length || 0}`);
      console.log(`  - Consistency rules: ${this.globalContext.rules.eraConstraints?.length || 0} era constraints`);

      return this.globalContext;
    } catch (error) {
      console.error('[ScriptParser] Failed to extract global context:', error);
      // Don't throw - global context is optional
      return null;
    }
  }

  /**
   * Get the current global context
   * @returns Current global context or null if not extracted
   */
  getGlobalContext(): GlobalContext | null {
    return this.globalContext;
  }

  /**
   * Stage 1: Extract metadata (使用结构化输出)
   * Also extracts global context if enabled and not skipped
   * 
   * @param content - Script content to parse
   * @param options - Optional parsing options to control behavior
   * @returns Script metadata
   */
  async extractMetadata(content: string, options?: { skipGlobalContext?: boolean }): Promise<ScriptMetadata> {
    console.log('[ScriptParser] ========== Stage 1: Extract Metadata (Structured Output) ==========');
    console.log(`[ScriptParser] Content length: ${content.length} characters`);
    console.log(`[ScriptParser] Skip global context: ${options?.skipGlobalContext ?? false}`);

    const prompt = PROMPTS.metadata.replace('{content}', content.substring(0, 3000));
    console.log(`[ScriptParser] Prompt length: ${prompt.length} characters`);
    console.log('[ScriptParser] Sending structured output request to LLM...');

    // 使用新的结构化输出方法
    const metadata = await this.callStructuredLLM(
      prompt,
      ScriptMetadataSchema,
      getJsonSchemaDescription(ScriptMetadataSchema),
      '你是一个专业的剧本分析助手，擅长从小说/剧本中提取结构化元数据信息。',
      'metadata'
    );

    console.log('[ScriptParser] Metadata extracted successfully (Structured Output):');
    console.log(`  - Title: ${metadata.title}`);
    console.log(`  - Word Count: ${metadata.wordCount}`);
    console.log(`  - Characters: ${metadata.characterCount} (${metadata.characterNames?.join(', ')})`);
    console.log(`  - Scenes: ${metadata.sceneCount} (${metadata.sceneNames?.join(', ')})`);
    console.log(`  - Genre: ${metadata.genre}`);
    console.log(`  - Tone: ${metadata.tone}`);

    // Extract global context and merge with metadata (unless skipped)
    if (!options?.skipGlobalContext) {
      const globalContext = await this.extractGlobalContext(content);
      if (globalContext && this.globalContextExtractor) {
        const contextMetadata = this.globalContextExtractor.convertToMetadata(globalContext);
        // Merge context metadata with basic metadata (contextMetadata fields are optional)
        Object.assign(metadata, contextMetadata);
        console.log('[ScriptParser] Global context merged into metadata');
      }
    } else {
      console.log('[ScriptParser] Global context extraction skipped (options.skipGlobalContext=true)');
    }

    // Ensure required fields are present
    const result: ScriptMetadata = {
      ...metadata,
      title: metadata.title || '未命名剧本',
      wordCount: metadata.wordCount ?? 0,
      estimatedDuration: metadata.estimatedDuration ?? '',
      characterCount: metadata.characterCount ?? 0,
      characterNames: metadata.characterNames ?? [],
      sceneCount: metadata.sceneCount ?? 0,
      sceneNames: metadata.sceneNames ?? [],
      chapterCount: metadata.chapterCount ?? 0,
      genre: metadata.genre ?? '',
      tone: metadata.tone ?? '',
      // Ensure storyStructure has all required fields if present
      storyStructure: metadata.storyStructure ? {
        structureType: metadata.storyStructure.structureType ?? 'other',
        act1: metadata.storyStructure.act1 ?? '',
        act2a: metadata.storyStructure.act2a ?? '',
        act2b: metadata.storyStructure.act2b ?? '',
        act3: metadata.storyStructure.act3 ?? '',
        midpoint: metadata.storyStructure.midpoint ?? '',
        climax: metadata.storyStructure.climax ?? '',
      } : undefined,
      // Ensure visualStyle has all required fields if present
      visualStyle: metadata.visualStyle ? {
        artDirection: metadata.visualStyle.artDirection ?? '',
        artStyle: metadata.visualStyle.artStyle ?? '',
        artStyleDescription: metadata.visualStyle.artStyleDescription ?? '',
        colorPalette: metadata.visualStyle.colorPalette ?? [],
        colorMood: metadata.visualStyle.colorMood ?? '',
        cinematography: metadata.visualStyle.cinematography ?? '',
        lightingStyle: metadata.visualStyle.lightingStyle ?? '',
      } : undefined,
      // Ensure eraContext has all required fields if present
      eraContext: metadata.eraContext ? {
        era: metadata.eraContext.era ?? '',
        eraDescription: metadata.eraContext.eraDescription ?? '',
        location: metadata.eraContext.location ?? '',
        season: metadata.eraContext.season,
        timeOfDay: metadata.eraContext.timeOfDay,
      } : undefined,
      // Ensure emotionalArc has all required fields if present
      emotionalArc: metadata.emotionalArc?.map(point => ({
        plotPoint: point.plotPoint ?? '',
        emotion: point.emotion ?? '',
        intensity: point.intensity ?? 0,
        colorTone: point.colorTone ?? '',
        percentage: point.percentage ?? 0,
      })),
      // Ensure consistencyRules has all required fields if present
      consistencyRules: metadata.consistencyRules ? {
        characterTraits: metadata.consistencyRules.characterTraits ?? {},
        eraConstraints: metadata.consistencyRules.eraConstraints ?? [],
        styleConstraints: metadata.consistencyRules.styleConstraints ?? [],
        forbiddenElements: metadata.consistencyRules.forbiddenElements ?? [],
      } : undefined,
    };

    return result;
  }

  // Note: extractCharacter method has been removed in v2
  // Use extractAllCharactersWithContext for batch extraction

  // Note: extractScene method has been removed in v2
  // Use extractAllScenesWithContext for batch extraction

  /**
   * Discover character names in a specific chunk of text
   * This method scans the chunk and returns all character names mentioned
   * 
   * @param chunkContent - The chunk content to analyze
   * @returns Array of character names found in the chunk
   */
  async discoverCharactersInChunk(chunkContent: string): Promise<string[]> {
    console.log(`[ScriptParser] Discovering characters in chunk (${chunkContent.length} chars)...`);

    const prompt = `
请分析以下文本片段，提取其中出现的所有角色/人物名称。

【文本片段】
${chunkContent.substring(0, 4000)}

请提取：
1. 所有在文本片段中出现的角色名称（人名）
2. 包括主要角色和次要角色
3. 只返回实际出现的角色，不要推测

请严格按以下JSON格式输出，只返回名称列表：
{
  "characterNames": ["角色名1", "角色名2", "角色名3"]
}

如果文本片段中没有出现任何角色名称，返回空数组：
{
  "characterNames": []
}
`;

    try {
      const response = await this.callLLM(prompt, 'metadata');
      const result = this.extractJSON<{ characterNames: string[] }>(response);
      
      // Filter out empty names and duplicates
      const uniqueNames = Array.from(new Set(result.characterNames?.filter(name => name && name.trim()) || []));
      console.log(`[ScriptParser] Discovered ${uniqueNames.length} characters: ${uniqueNames.join(', ')}`);
      
      return uniqueNames;
    } catch (error) {
      console.error('[ScriptParser] Failed to discover characters in chunk:', error);
      return [];
    }
  }

  /**
   * Discover scene names in a specific chunk of text
   * This method scans the chunk and returns all scene/location names mentioned
   * 
   * @param chunkContent - The chunk content to analyze
   * @returns Array of scene names found in the chunk
   */
  async discoverScenesInChunk(chunkContent: string): Promise<string[]> {
    console.log(`[ScriptParser] Discovering scenes in chunk (${chunkContent.length} chars)...`);

    const prompt = `
请分析以下文本片段，提取其中出现的所有场景/地点名称。

【文本片段】
${chunkContent.substring(0, 4000)}

请提取：
1. 所有在文本片段中出现的场景或地点名称
2. 包括室内场景（如：客厅、办公室、宫殿等）
3. 包括室外场景（如：街道、公园、山谷等）
4. 场景名称应该简洁明了，2-6个字为宜

请严格按以下JSON格式输出，只返回名称列表：
{
  "sceneNames": ["场景名1", "场景名2", "场景名3"]
}

如果文本片段中没有出现任何场景名称，返回空数组：
{
  "sceneNames": []
}
`;

    try {
      const response = await this.callLLM(prompt, 'metadata');
      const result = this.extractJSON<{ sceneNames: string[] }>(response);
      
      // Filter out empty names and duplicates
      const uniqueNames = Array.from(new Set(result.sceneNames?.filter(name => name && name.trim()) || []));
      console.log(`[ScriptParser] Discovered ${uniqueNames.length} scenes: ${uniqueNames.join(', ')}`);
      
      return uniqueNames;
    } catch (error) {
      console.error('[ScriptParser] Failed to discover scenes in chunk:', error);
      return [];
    }
  }

  /**
   * Stage 4: Generate shots for a scene
   * @param content - Full script content
   * @param sceneName - Name of the scene
   * @param sceneDescription - Description of the scene
   * @param characters - Characters in the scene
   * @param sceneBudget - Optional scene budget for duration guidance
   * @param sceneIndex - Optional scene index for determining scene importance
   * @param totalScenes - Optional total number of scenes
   * @returns Array of generated shots
   */
  async generateShots(
    content: string,
    sceneName: string,
    sceneDescription: string,
    characters: string[],
    sceneBudget?: SceneBudget,
    sceneIndex?: number,
    totalScenes?: number
  ): Promise<Shot[]> {
    console.log(`[ScriptParser] ---------- Generating Shots for Scene: ${sceneName} ----------`);
    console.log(`[ScriptParser] useProductionPrompt: ${this.parserConfig.useProductionPrompt}`);

    const paragraphs = content.split('\n\n');
    const sceneStartIndex = paragraphs.findIndex(p =>
      p.includes(sceneName) || p.toLowerCase().includes(sceneName.toLowerCase())
    );

    let sceneContent = content;
    if (sceneStartIndex >= 0) {
      const nextSceneIndex = paragraphs.slice(sceneStartIndex + 1).findIndex(p =>
        p.includes('场景') || p.includes('地点') || p.includes('第') && p.includes('章')
      );
      const endIndex = nextSceneIndex >= 0 ? sceneStartIndex + 1 + nextSceneIndex : paragraphs.length;
      sceneContent = paragraphs.slice(sceneStartIndex, endIndex).join('\n\n');
    }
    console.log(`[ScriptParser] Scene content length: ${sceneContent.length} characters`);

    // 选择使用生产级Prompt或标准Prompt
    const useProductionPrompt = this.parserConfig.useProductionPrompt && sceneBudget;
    let prompt: string;

    if (useProductionPrompt) {
      // 使用生产级Prompt
      prompt = this.buildProductionPrompt(
        sceneContent,
        sceneName,
        sceneDescription,
        characters,
        sceneBudget,
        sceneIndex,
        totalScenes
      );
      console.log(`[ScriptParser] Using production prompt`);
    } else {
      // 使用标准Prompt
      prompt = PROMPTS.shots
        .replace('{content}', sceneContent.substring(0, 6000))
        .replace('{sceneName}', sceneName)
        .replace('{sceneDescription}', sceneDescription)
        .replace('{characters}', characters.join(', '));
      console.log(`[ScriptParser] Using standard prompt`);
    }

    console.log(`[ScriptParser] Prompt length: ${prompt.length} characters`);
    console.log(`[ScriptParser] Characters in scene: ${characters.join(', ')}`);

    const response = await this.callLLM(prompt, 'shots');
    console.log(`[ScriptParser] LLM response received, length: ${response.length} characters`);

    const shots = this.extractJSON<Shot[]>(response);
    console.log(`[ScriptParser] Generated ${shots.length} shots`);

    shots.slice(0, 3).forEach((shot, i) => {
      console.log(`[ScriptParser] Shot ${i + 1}:`);
      console.log(`  - Sequence: ${shot.sequence}`);
      console.log(`  - Type: ${shot.shotType}`);
      console.log(`  - Movement: ${shot.cameraMovement}`);
      console.log(`  - Duration: ${shot.duration}s`);
      console.log(`  - Description: ${shot.description?.substring(0, 40)}...`);
    });

    const result = shots.map((shot, index) => ({
      ...shot,
      id: shot.id || crypto.randomUUID(),
      sceneName,
      sequence: shot.sequence || index + 1,
      duration: shot.duration ?? 3, // 确保每个分镜都有默认时长3秒
    }));

    // 计算并输出总时长
    const totalDuration = result.reduce((sum, shot) => sum + (shot.duration ?? 3), 0);
    console.log(`[ScriptParser] Total duration for ${result.length} shots: ${totalDuration}s`);

    // Note: Quality validation is now done once at the end of all shots generation
    // to avoid duplicate reports. See generateFinalQualityReport().

    return result;
  }

  /**
   * 构建生产级Prompt
   * 包含完整的预算约束、时长分配策略和硬性约束规则
   * @private
   */
  private buildProductionPrompt(
    sceneContent: string,
    sceneName: string,
    sceneDescription: string,
    characters: string[],
    sceneBudget: SceneBudget,
    sceneIndex?: number,
    totalScenes?: number
  ): string {
    const config = this.parserConfig.productionPromptConfig || {};
    const minShotDuration = config.minShotDuration ?? 1.5;
    const maxShotDuration = config.maxShotDuration ?? 12;
    const tolerance = config.sceneBudgetTolerance ?? 0.15;
    const climaxMinDuration = config.climaxMinLongShotDuration ?? 8;

    // 计算场景在故事中的位置
    let scenePosition = '中间';
    let narrativeImportance = '一般';
    let emotionalIntensity = '中等';

    if (sceneIndex !== undefined && totalScenes !== undefined && totalScenes > 0) {
      const ratio = sceneIndex / totalScenes;
      if (ratio < 0.15) {
        scenePosition = '开场';
        narrativeImportance = '高（吸引观众）';
        emotionalIntensity = '中高';
      } else if (ratio >= 0.9) {
        scenePosition = '结尾';
        narrativeImportance = '高（收尾总结）';
        emotionalIntensity = '高';
      } else if (ratio >= 0.6 && ratio < 0.9) {
        scenePosition = '高潮';
        narrativeImportance = '极高（核心冲突）';
        emotionalIntensity = '极高';
      } else {
        scenePosition = '发展';
        narrativeImportance = '中等（推进剧情）';
        emotionalIntensity = '中等';
      }
    }

    // 映射场景重要性为中文
    const importanceMap: Record<string, string> = {
      'opening': '开场',
      'development': '发展',
      'climax': '高潮',
      'ending': '结尾'
    };
    const sceneImportance = importanceMap[sceneBudget.importance] || '发展';

    // 计算总时长约束范围
    const allocatedDuration = sceneBudget.allocatedDuration;
    const minTotalDuration = Math.round(allocatedDuration * (1 - tolerance));
    const maxTotalDuration = Math.round(allocatedDuration * (1 + tolerance));

    // 判断是否为高潮场景
    const isClimax = sceneBudget.importance === 'climax';
    const climaxRequirement = isClimax
      ? `高潮场景必须至少有一个超过${climaxMinDuration}秒的长镜头，用于情感爆发或关键转折`
      : '本场景非高潮场景，无特殊长镜头要求';

    // 获取平台显示名称
    const platformMap: Record<string, string> = {
      'douyin': '抖音（竖屏，快节奏）',
      'kuaishou': '快手（竖屏，生活化）',
      'bilibili': 'B站（横屏，多样化）',
      'premium': '精品短剧（横屏，高质量）'
    };
    const targetPlatform = platformMap[this.parserConfig.targetPlatform || 'douyin'];

    // 获取总时长预算
    const totalDuration = this.durationBudget?.totalDuration ||
      (sceneBudget.shotCount * sceneBudget.averageShotDuration);

    // 构建Prompt
    let prompt = PROMPTS.productionShots
      .replace('{content}', sceneContent.substring(0, 6000))
      .replace(/{sceneName}/g, sceneName)
      .replace('{sceneDescription}', sceneDescription)
      .replace('{characters}', characters.join(', '))
      .replace('{targetPlatform}', targetPlatform)
      .replace('{totalDuration}', String(totalDuration))
      .replace('{sceneAllocatedDuration}', String(allocatedDuration))
      .replace('{recommendedShotCount}', String(sceneBudget.shotCount))
      .replace('{minShotDuration}', String(minShotDuration))
      .replace('{maxShotDuration}', String(maxShotDuration))
      .replace('{sceneImportance}', sceneImportance)
      .replace('{scenePosition}', scenePosition)
      .replace('{narrativeImportance}', narrativeImportance)
      .replace('{emotionalIntensity}', emotionalIntensity)
      .replace('{minTotalDuration}', String(minTotalDuration))
      .replace('{maxTotalDuration}', String(maxTotalDuration))
      .replace('{climaxRequirement}', climaxRequirement);

    return prompt;
  }

  /**
   * Validate shots quality using QualityAnalyzer
   * @param shots - Generated shots to validate
   * @param sceneName - Scene name for logging
   * @private
   */
  private validateShotsQuality(shots: Shot[], sceneName: string): void {
    if (!this.qualityAnalyzer) return;

    console.log(`[ScriptParser] Validating shots quality for scene: ${sceneName}`);

    // Use the new comprehensive quality analyzer
    const report = this.qualityAnalyzer.analyze(
      undefined, // metadata not needed for shot validation
      this.currentCharacters,
      this.currentScenes,
      this.currentItems,
      shots,
      'shots'
    );
    
    this.qualityReport = report;

    if (report.score < this.parserConfig.dramaRulesMinScore) {
      console.warn(`[ScriptParser] Shots quality below threshold: ${report.score}/${this.parserConfig.dramaRulesMinScore}`);
      console.warn(`[ScriptParser] Violations:`, report.violations.map(v => v.message).join('; '));
    } else {
      console.log(`[ScriptParser] Shots quality passed: ${report.score}/${this.parserConfig.dramaRulesMinScore}`);
    }

    if (report.recommendations.length > 0) {
      console.log(`[ScriptParser] Recommendations:`, report.recommendations.slice(0, 3).join('; '));
    }
  }

  /**
   * Batch extract all characters in one API call
   */
  async extractAllCharacters(content: string, characterNames: string[]): Promise<ScriptCharacter[]> {
    if (characterNames.length === 0) return [];
    if (characterNames.length === 1) {
      return [await this.extractCharacterWithContext(content, characterNames[0])];
    }

    console.log(`[ScriptParser] ---------- Batch Extracting ${characterNames.length} Characters ----------`);

    const prompt = PROMPTS.charactersBatch
      .replace('{content}', content.substring(0, 4000))
      .replace('{characterNames}', characterNames.join('\n'));

    console.log(`[ScriptParser] Batch prompt length: ${prompt.length} characters`);

    const response = await this.callLLM(prompt, 'character');
    console.log(`[ScriptParser] Batch response received, length: ${response.length} characters`);

    const characters = this.extractJSON<ScriptCharacter[]>(response);
    console.log(`[ScriptParser] Parsed ${characters.length} characters from batch response`);

    // Validate and ensure all characters have required fields
    return characters.map((char, index) => this.validateCharacter(char, characterNames[index] || char.name || `角色${index + 1}`));
  }

  /**
   * Batch extract all characters with global context injection
   * This method injects story context, visual style, and era constraints into the prompt
   * 
   * Phase 2.1.2: Smart batching - split into batches of 5 when character count > 5
   */
  async extractAllCharactersWithContext(content: string, characterNames: string[]): Promise<ScriptCharacter[]> {
    if (characterNames.length === 0) return [];
    if (characterNames.length === 1) {
      return [await this.extractCharacterWithContext(content, characterNames[0])];
    }

    // Phase 2.1.2: Smart batching - if > 5 characters, split into batches
    const BATCH_SIZE = 5;
    if (characterNames.length > BATCH_SIZE) {
      console.log(`[ScriptParser] ---------- Smart Batching ${characterNames.length} Characters (${Math.ceil(characterNames.length / BATCH_SIZE)} batches) ----------`);
      const allCharacters: ScriptCharacter[] = [];
      
      for (let i = 0; i < characterNames.length; i += BATCH_SIZE) {
        const batch = characterNames.slice(i, i + BATCH_SIZE);
        console.log(`[ScriptParser] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(characterNames.length / BATCH_SIZE)}: ${batch.length} characters`);
        
        try {
          const batchCharacters = await this.extractCharacterBatchWithContext(content, batch);
          allCharacters.push(...batchCharacters);
        } catch (error) {
          console.error(`[ScriptParser] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error);
          // Fallback: extract individually
          for (const name of batch) {
            try {
              const char = await this.extractCharacterWithContext(content, name);
              allCharacters.push(char);
            } catch (e) {
              console.error(`[ScriptParser] Individual extraction failed for ${name}:`, e);
              allCharacters.push(this.createPlaceholderCharacter(name));
            }
          }
        }
      }
      
      console.log(`[ScriptParser] Smart batching complete: ${allCharacters.length} characters extracted`);
      return allCharacters;
    }

    // Original logic for <= 5 characters
    console.log(`[ScriptParser] ---------- Batch Extracting ${characterNames.length} Characters with Context ----------`);
    return this.extractCharacterBatchWithContext(content, characterNames);
  }

  /**
   * Extract a single batch of characters (max 5) with context
   * @private
   */
  private async extractCharacterBatchWithContext(content: string, characterNames: string[]): Promise<ScriptCharacter[]> {
    // Build base prompt
    let prompt = PROMPTS.charactersBatch
      .replace('{content}', content.substring(0, 4000))
      .replace('{characterNames}', characterNames.join('\n'));

    // Inject global context if available
    if (this.globalContext && this.contextInjector) {
      console.log('[ScriptParser] Injecting global context into character extraction');
      prompt = this.contextInjector.injectForCharacter(prompt, this.globalContext, characterNames[0]);
    }

    console.log(`[ScriptParser] Context-enhanced prompt length: ${prompt.length} characters`);

    const response = await this.callLLM(prompt, 'character');
    console.log(`[ScriptParser] Batch response received, length: ${response.length} characters`);

    const characters = this.extractJSON<ScriptCharacter[]>(response);
    console.log(`[ScriptParser] Parsed ${characters.length} characters from batch response`);

    // Validate and ensure all characters have required fields
    return characters.map((char, index) => this.validateCharacter(char, characterNames[index] || char.name || `角色${index + 1}`));
  }

  /**
   * Create a placeholder character when extraction fails
   * @private
   */
  private createPlaceholderCharacter(name: string): ScriptCharacter {
    return {
      name,
      appearance: {},
      personality: [],
      signatureItems: [],
      emotionalArc: [],
      relationships: [],
      visualPrompt: name
    };
  }

  /**
   * Extract single character with global context injection
   */
  async extractCharacterWithContext(content: string, characterName: string): Promise<ScriptCharacter> {
    console.log(`[ScriptParser] ---------- Extracting Character with Context: ${characterName} ----------`);

    // Check cache first
    const cacheKey = `char:${characterName}:${this.hashContent(content.substring(0, 1000))}:context`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[ScriptParser] Cache hit for character: ${characterName}`);
      return cached as ScriptCharacter;
    }

    // Extract relevant paragraphs containing the character
    const paragraphs = content.split('\n\n');
    const relevantParagraphs = paragraphs.filter(p =>
      p.includes(characterName) ||
      p.includes(characterName.split('').join('.*?')) // Fuzzy match for Chinese names
    );
    console.log(`[ScriptParser] Found ${relevantParagraphs.length} paragraphs mentioning ${characterName}`);

    // If not enough content, use the whole text
    const characterContent = relevantParagraphs.length > 3
      ? relevantParagraphs.join('\n\n')
      : content;
    console.log(`[ScriptParser] Character content length: ${characterContent.length} characters`);

    // Build base prompt
    let prompt = PROMPTS.character
      .replace('{content}', characterContent.substring(0, 5000))
      .replace('{characterName}', characterName);

    // Inject global context if available
    if (this.globalContext && this.contextInjector) {
      console.log('[ScriptParser] Injecting global context into character extraction');
      prompt = this.contextInjector.injectForCharacter(prompt, this.globalContext, characterName);
    }

    console.log(`[ScriptParser] Context-enhanced prompt length: ${prompt.length} characters`);

    const response = await this.callLLM(prompt, 'character');
    console.log(`[ScriptParser] LLM response received, length: ${response.length} characters`);

    const rawCharacter = this.extractJSON<Partial<ScriptCharacter>>(response);
    console.log(`[ScriptParser] Raw character data parsed`);

    // Validate and fill missing fields
    const character = this.validateCharacter(rawCharacter, characterName);
    console.log(`[ScriptParser] Character validated and completed:`);
    console.log(`  - Name: ${character.name}`);
    console.log(`  - Gender: ${character.gender}`);
    console.log(`  - Age: ${character.age}`);
    console.log(`  - Identity: ${character.identity}`);
    console.log(`  - Personality: ${character.personality?.join(', ')}`);
    console.log(`  - Visual Prompt: ${character.visualPrompt?.substring(0, 50)}...`);

    // Cache the result
    this.cache.set(cacheKey, character);

    return character;
  }

  /**
   * Batch extract all scenes in one API call
   */
  async extractAllScenes(content: string, sceneNames: string[]): Promise<ScriptScene[]> {
    if (sceneNames.length === 0) return [];
    if (sceneNames.length === 1) {
      return [await this.extractSceneWithContext(content, sceneNames[0])];
    }

    console.log(`[ScriptParser] ---------- Batch Extracting ${sceneNames.length} Scenes ----------`);

    const prompt = PROMPTS.scenesBatch
      .replace('{content}', content.substring(0, 4000))
      .replace('{sceneNames}', sceneNames.join('\n'));

    console.log(`[ScriptParser] Batch prompt length: ${prompt.length} characters`);

    const response = await this.callLLM(prompt, 'scene');
    console.log(`[ScriptParser] Batch response received, length: ${response.length} characters`);

    const scenes = this.extractJSON<ScriptScene[]>(response);
    console.log(`[ScriptParser] Parsed ${scenes.length} scenes from batch response`);

    // Validate and ensure all scenes have required fields
    return scenes.map((scene, index) => this.validateScene(scene, sceneNames[index] || scene.name || `场景${index + 1}`));
  }

  /**
   * Batch extract all scenes with global context injection
   * This method injects story context, visual style, era constraints, and emotional context into the prompt
   * 
   * Phase 2.1.2: Smart batching - split into batches of 5 when scene count > 5
   */
  async extractAllScenesWithContext(content: string, sceneNames: string[]): Promise<ScriptScene[]> {
    if (sceneNames.length === 0) return [];
    if (sceneNames.length === 1) {
      return [await this.extractSceneWithContext(content, sceneNames[0])];
    }

    // Phase 2.1.2: Smart batching - if > 5 scenes, split into batches
    const BATCH_SIZE = 5;
    if (sceneNames.length > BATCH_SIZE) {
      console.log(`[ScriptParser] ---------- Smart Batching ${sceneNames.length} Scenes (${Math.ceil(sceneNames.length / BATCH_SIZE)} batches) ----------`);
      const allScenes: ScriptScene[] = [];
      
      for (let i = 0; i < sceneNames.length; i += BATCH_SIZE) {
        const batch = sceneNames.slice(i, i + BATCH_SIZE);
        console.log(`[ScriptParser] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sceneNames.length / BATCH_SIZE)}: ${batch.length} scenes`);
        
        try {
          const batchScenes = await this.extractSceneBatchWithContext(content, batch);
          allScenes.push(...batchScenes);
        } catch (error) {
          console.error(`[ScriptParser] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error);
          // Fallback: extract individually
          for (const name of batch) {
            try {
              const scene = await this.extractSceneWithContext(content, name);
              allScenes.push(scene);
            } catch (e) {
              console.error(`[ScriptParser] Individual extraction failed for ${name}:`, e);
              allScenes.push(this.createPlaceholderScene(name));
            }
          }
        }
      }
      
      console.log(`[ScriptParser] Smart batching complete: ${allScenes.length} scenes extracted`);
      return allScenes;
    }

    // Original logic for <= 5 scenes
    console.log(`[ScriptParser] ---------- Batch Extracting ${sceneNames.length} Scenes with Context ----------`);
    return this.extractSceneBatchWithContext(content, sceneNames);
  }

  /**
   * Extract a single batch of scenes (max 5) with context
   * @private
   */
  private async extractSceneBatchWithContext(content: string, sceneNames: string[]): Promise<ScriptScene[]> {
    // Build base prompt
    let prompt = PROMPTS.scenesBatch
      .replace('{content}', content.substring(0, 4000))
      .replace('{sceneNames}', sceneNames.join('\n'));

    // Inject global context if available
    if (this.globalContext && this.contextInjector) {
      console.log('[ScriptParser] Injecting global context into scene extraction');
      prompt = this.contextInjector.injectForScene(prompt, this.globalContext, sceneNames[0]);
    }

    console.log(`[ScriptParser] Context-enhanced prompt length: ${prompt.length} characters`);

    const response = await this.callLLM(prompt, 'scene');
    console.log(`[ScriptParser] Batch response received, length: ${response.length} characters`);

    const scenes = this.extractJSON<ScriptScene[]>(response);
    console.log(`[ScriptParser] Parsed ${scenes.length} scenes from batch response`);

    // Validate and ensure all scenes have required fields
    return scenes.map((scene, index) => this.validateScene(scene, sceneNames[index] || scene.name || `场景${index + 1}`));
  }

  /**
   * Create a placeholder scene when extraction fails
   * @private
   */
  private createPlaceholderScene(name: string): ScriptScene {
    return {
      name,
      locationType: 'unknown',
      description: name,
      environment: {},
      sceneFunction: '',
      visualPrompt: name,
      characters: []
    };
  }

  /**
   * Extract single scene with global context injection
   */
  async extractSceneWithContext(content: string, sceneName: string): Promise<ScriptScene> {
    console.log(`[ScriptParser] ---------- Extracting Scene with Context: ${sceneName} ----------`);

    // Check cache first
    const cacheKey = `scene:${sceneName}:${this.hashContent(content.substring(0, 1000))}:context`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[ScriptParser] Cache hit for scene: ${sceneName}`);
      return cached as ScriptScene;
    }

    // Extract relevant paragraphs containing the scene
    const paragraphs = content.split('\n\n');
    const relevantParagraphs = paragraphs.filter(p =>
      p.includes(sceneName) ||
      p.toLowerCase().includes(sceneName.toLowerCase())
    );
    console.log(`[ScriptParser] Found ${relevantParagraphs.length} paragraphs mentioning ${sceneName}`);

    const sceneContent = relevantParagraphs.length > 2
      ? relevantParagraphs.join('\n\n')
      : content;
    console.log(`[ScriptParser] Scene content length: ${sceneContent.length} characters`);

    // Build base prompt
    let prompt = PROMPTS.scene
      .replace('{content}', sceneContent.substring(0, 5000))
      .replace('{sceneName}', sceneName);

    // Inject global context if available
    if (this.globalContext && this.contextInjector) {
      console.log('[ScriptParser] Injecting global context into scene extraction');
      prompt = this.contextInjector.injectForScene(prompt, this.globalContext, sceneName);
    }

    console.log(`[ScriptParser] Context-enhanced prompt length: ${prompt.length} characters`);

    const response = await this.callLLM(prompt, 'scene');
    console.log(`[ScriptParser] LLM response received, length: ${response.length} characters`);

    const rawScene = this.extractJSON<Partial<ScriptScene>>(response);
    console.log(`[ScriptParser] Raw scene data parsed`);

    // Validate and fill missing fields
    const scene = this.validateScene(rawScene, sceneName);
    console.log(`[ScriptParser] Scene validated and completed:`);
    console.log(`  - Name: ${scene.name}`);
    console.log(`  - Location Type: ${scene.locationType}`);
    console.log(`  - Time of Day: ${scene.timeOfDay}`);
    console.log(`  - Weather: ${scene.weather}`);
    console.log(`  - Characters: ${scene.characters?.join(', ')}`);
    console.log(`  - Visual Prompt: ${scene.visualPrompt?.substring(0, 50)}...`);

    // Cache the result
    this.cache.set(cacheKey, scene);
    return scene;
  }

  /**
   * Batch generate all shots in one API call
   */
  async generateAllShots(content: string, scenes: ScriptScene[]): Promise<Shot[]> {
    if (scenes.length === 0) return [];
    if (scenes.length === 1) {
      const shots = await this.generateShots(content, scenes[0].name, scenes[0].description, scenes[0].characters);
      const result = shots.map((shot, index) => ({
        ...shot,
        id: shot.id || crypto.randomUUID(),
        sceneName: scenes[0].name,
        sequence: shot.sequence || index + 1,
        duration: shot.duration ?? 3, // 确保每个分镜都有默认时长3秒
      }));
      // 计算并输出总时长
      const totalDuration = result.reduce((sum, shot) => sum + (shot.duration ?? 3), 0);
      console.log(`[ScriptParser] Total duration for ${result.length} shots: ${totalDuration}s`);
      return result;
    }

    console.log(`[ScriptParser] ---------- Batch Generating Shots for ${scenes.length} Scenes ----------`);

    const scenesInfo = scenes.map(s => `- ${s.name}: ${s.description?.substring(0, 50) || '无描述'}... (角色: ${s.characters?.join(', ') || '无'})`).join('\n');

    const prompt = PROMPTS.shotsBatch
      .replace('{content}', content.substring(0, 3000))
      .replace('{scenesInfo}', scenesInfo);

    console.log(`[ScriptParser] Batch prompt length: ${prompt.length} characters`);

    const response = await this.callLLM(prompt, 'shots');
    console.log(`[ScriptParser] Batch response received, length: ${response.length} characters`);

    const shots = this.extractJSON<Shot[]>(response);
    console.log(`[ScriptParser] Parsed ${shots.length} shots from batch response`);

    const result = shots.map((shot, index) => ({
      ...shot,
      id: shot.id || crypto.randomUUID(),
      sequence: shot.sequence || index + 1,
      duration: shot.duration ?? 3, // 确保每个分镜都有默认时长3秒
    }));

    // 计算并输出总时长
    const totalDuration = result.reduce((sum, shot) => sum + (shot.duration ?? 3), 0);
    console.log(`[ScriptParser] Total duration for ${result.length} shots: ${totalDuration}s`);

    // Note: Quality validation is now done once at the end of all shots generation
    // to avoid duplicate reports. See generateFinalQualityReport().

    return result;
  }

  /**
   * 基于情节分析生成分镜（新方案）
   * 1. 先进行情节分析，识别所有情节点
   * 2. 根据影视风格生成对应密度的分镜
   * 3. 不限制数量，由LLM根据情节决定
   */
  async generateShotsByPlotAnalysis(
    content: string,
    scenes: ScriptScene[],
    filmStyle: 'short-drama' | 'film' | 'custom' = 'short-drama',
    customDensity?: number
  ): Promise<Shot[]> {
    console.log(`[ScriptParser] ---------- Generating Shots by Plot Analysis ----------`);
    console.log(`[ScriptParser] Film Style: ${filmStyle}`);

    if (scenes.length === 0) return [];

    // Step 1: 情节分析
    console.log(`[ScriptParser] Step 1: Analyzing plot structure...`);
    const plotAnalysis = await this.analyzePlot(content);
    console.log(`[ScriptParser] Plot analysis complete: ${plotAnalysis.statistics.totalPlotPoints} plot points`);
    console.log(`[ScriptParser] Estimated shots: ${plotAnalysis.statistics.estimatedShots.shortDrama} (short-drama) / ${plotAnalysis.statistics.estimatedShots.film} (film)`);

    // Step 2: 根据风格确定密度系数
    const densityMap = {
      'short-drama': 1.2,  // 短剧：快节奏
      'film': 2.0,         // 电影：慢节奏
      'custom': customDensity || 1.5
    };
    const density = densityMap[filmStyle];

    // Step 3: 生成分镜
    console.log(`[ScriptParser] Step 2: Generating shots with density: ${density}`);
    const scenesInfo = scenes.map(s => 
      `- ${s.name}: ${s.description?.substring(0, 50) || '无描述'}... (角色: ${s.characters?.join(', ') || '无'})`
    ).join('\n');

    const styleDescription = {
      'short-drama': '短剧风格：快节奏，每个情节点1-2个分镜，注重情节推进',
      'film': '电影风格：慢节奏，每个情节点2-4个分镜，注重意境和情感表达',
      'custom': `自定义风格：密度系数${density}，按需生成`
    }[filmStyle];

    const prompt = PROMPTS.shotsBatch
      .replace('{content}', content.substring(0, 8000))  // 增加内容长度
      .replace('{scenesInfo}', scenesInfo)
      .replace('{filmStyle}', `${filmStyle}\n${styleDescription}`);

    console.log(`[ScriptParser] Prompt length: ${prompt.length} characters`);

    const response = await this.callLLM(prompt, 'shots');
    console.log(`[ScriptParser] Response received, length: ${response.length} characters`);

    const shots = this.extractJSON<Shot[]>(response);
    console.log(`[ScriptParser] Parsed ${shots.length} shots`);

    // Step 4: 后处理，确保字段完整
    const result = shots.map((shot, index) => ({
      ...shot,
      id: shot.id || crypto.randomUUID(),
      sequence: shot.sequence || index + 1,
      duration: shot.duration ?? 3,
      shotNumber: shot.shotNumber || `SC${index + 1}`,
      cameraAngle: shot.cameraAngle || 'eye_level',
      assets: shot.assets || { characterIds: [], sceneId: '' },
      contentType: shot.contentType || 'static',
      layer: shot.layer || 'key',
      style: shot.style || filmStyle,
      status: shot.status || 'pending',
    }));

    // 统计信息
    const keyShots = result.filter(s => s.layer === 'key').length;
    const optionalShots = result.filter(s => s.layer === 'optional').length;
    const staticShots = result.filter(s => s.contentType === 'static').length;
    const dynamicShots = result.filter(s => s.contentType !== 'static').length;

    console.log(`[ScriptParser] Generation complete:`);
    console.log(`  - Total shots: ${result.length}`);
    console.log(`  - Key shots: ${keyShots}`);
    console.log(`  - Optional shots: ${optionalShots}`);
    console.log(`  - Static shots: ${staticShots}`);
    console.log(`  - Dynamic shots: ${dynamicShots}`);

    return result;
  }

  /**
   * 情节分析：识别所有情节点
   */
  private async analyzePlot(content: string): Promise<{
    plotPoints: Array<{
      type: 'opening' | 'development' | 'twist' | 'climax' | 'ending';
      importance: 'major' | 'minor';
      description: string;
      characters: string[];
      emotionalTone: string;
      sceneContext: string;
    }>;
    statistics: {
      totalPlotPoints: number;
      majorPoints: number;
      minorPoints: number;
      estimatedShots: {
        shortDrama: number;
        film: number;
      };
    };
  }> {
    const prompt = PROMPTS.plotAnalysis.replace('{content}', content.substring(0, 8000));

    console.log(`[ScriptParser] Analyzing plot structure...`);
    const response = await this.callLLM(prompt, 'plot-analysis');

    try {
      const analysis = this.extractJSON<{
        plotPoints: Array<{
          type: 'opening' | 'development' | 'twist' | 'climax' | 'ending';
          importance: 'major' | 'minor';
          description: string;
          characters: string[];
          emotionalTone: string;
          sceneContext: string;
        }>;
        statistics: {
          totalPlotPoints: number;
          majorPoints: number;
          minorPoints: number;
          estimatedShots: {
            shortDrama: number;
            film: number;
          };
        };
      }>(response);

      return analysis;
    } catch (error) {
      console.error(`[ScriptParser] Plot analysis failed: ${error}`);
      // 返回默认分析结果
      return {
        plotPoints: [{
          type: 'opening',
          importance: 'major',
          description: '故事开端',
          characters: [],
          emotionalTone: 'neutral',
          sceneContext: 'default'
        }],
        statistics: {
          totalPlotPoints: 1,
          majorPoints: 1,
          minorPoints: 0,
          estimatedShots: {
            shortDrama: 10,
            film: 20
          }
        }
      };
    }
  }

  /**
   * Batch generate all shots with global context injection
   * This method injects visual guidance, emotional context, and era constraints into the prompt
   */
  async generateAllShotsWithContext(content: string, scenes: ScriptScene[]): Promise<Shot[]> {
    if (scenes.length === 0) return [];
    if (scenes.length === 1) {
      const shots = await this.generateShotsWithContext(content, scenes[0]);
      const result = shots.map((shot, index) => ({
        ...shot,
        id: shot.id || crypto.randomUUID(),
        sceneName: scenes[0].name,
        sequence: shot.sequence || index + 1,
        duration: shot.duration ?? 3, // 确保每个分镜都有默认时长3秒
      }));
      // 计算并输出总时长
      const totalDuration = result.reduce((sum, shot) => sum + (shot.duration ?? 3), 0);
      console.log(`[ScriptParser] Total duration for ${result.length} shots: ${totalDuration}s`);
      return result;
    }

    console.log(`[ScriptParser] ---------- Batch Generating Shots with Context for ${scenes.length} Scenes ----------`);

    const scenesInfo = scenes.map(s => `- ${s.name}: ${s.description?.substring(0, 50) || '无描述'}... (角色: ${s.characters?.join(', ') || '无'})`).join('\n');

    // 计算分镜生成参数（基于行业标准）
    const shotGen = this.calculateShotGeneration(content.length);
    console.log(`[ScriptParser] Target: ${shotGen.targetShots} shots (${shotGen.keyShots} key + ${shotGen.optionalShots} optional)`);

    // Build base prompt
    let prompt = PROMPTS.shotsBatch
      .replace('{content}', content.substring(0, 5000))  // 增加内容长度，确保覆盖全部情节
      .replace('{scenesInfo}', scenesInfo);

    // Inject global context if available
    if (this.globalContext && this.contextInjector) {
      console.log('[ScriptParser] Injecting global context into shots generation');
      // For batch generation, we inject context for the first scene as a representative
      prompt = this.contextInjector.injectForShots(prompt, this.globalContext, scenes[0]);
    }

    console.log(`[ScriptParser] Context-enhanced prompt length: ${prompt.length} characters`);

    const response = await this.callLLM(prompt, 'shots');
    console.log(`[ScriptParser] Batch response received, length: ${response.length} characters`);

    const shots = this.extractJSON<Shot[]>(response);
    console.log(`[ScriptParser] Parsed ${shots.length} shots from batch response`);

    const result = shots.map((shot, index) => ({
      ...shot,
      id: shot.id || crypto.randomUUID(),
      sequence: shot.sequence || index + 1,
      duration: shot.duration ?? 3, // 确保每个分镜都有默认时长3秒
      // 确保新字段有默认值
      shotNumber: shot.shotNumber || `SC${index + 1}`,
      cameraAngle: shot.cameraAngle || 'eye_level',
      assets: shot.assets || { characterIds: [], sceneId: '' },
      contentType: shot.contentType || 'static',
      layer: shot.layer || 'key',
      status: shot.status || 'pending',
    }));

    // 统计关键分镜和可选分镜数量
    const keyShots = result.filter(s => s.layer === 'key').length;
    const optionalShots = result.filter(s => s.layer === 'optional').length;
    console.log(`[ScriptParser] Generated ${result.length} shots: ${keyShots} key + ${optionalShots} optional`);

    return result;
  }

  /**
   * Generate shots for a single scene with global context injection
   * @param content - Full script content
   * @param scene - Scene object
   * @param sceneIndex - Optional scene index for determining scene importance
   * @param totalScenes - Optional total number of scenes
   */
  async generateShotsWithContext(
    content: string,
    scene: ScriptScene,
    sceneIndex?: number,
    totalScenes?: number
  ): Promise<Shot[]> {
    console.log(`[ScriptParser] ---------- Generating Shots with Context for Scene: ${scene.name} ----------`);
    console.log(`[ScriptParser] useProductionPrompt: ${this.parserConfig.useProductionPrompt}`);

    const paragraphs = content.split('\n\n');
    const sceneStartIndex = paragraphs.findIndex(p =>
      p.includes(scene.name) || p.toLowerCase().includes(scene.name.toLowerCase())
    );

    let sceneContent = content;
    if (sceneStartIndex >= 0) {
      const nextSceneIndex = paragraphs.slice(sceneStartIndex + 1).findIndex(p =>
        p.includes('场景') || p.includes('地点') || p.includes('第') && p.includes('章')
      );
      const endIndex = nextSceneIndex >= 0 ? sceneStartIndex + 1 + nextSceneIndex : paragraphs.length;
      sceneContent = paragraphs.slice(sceneStartIndex, endIndex).join('\n\n');
    }
    console.log(`[ScriptParser] Scene content length: ${sceneContent.length} characters`);

    // Get scene budget if available
    const sceneBudget = this.durationBudget?.sceneBudgets.find(
      sb => sb.sceneName === scene.name
    );

    // 选择使用生产级Prompt或标准Prompt
    const useProductionPrompt = this.parserConfig.useProductionPrompt && sceneBudget;
    let prompt: string;

    if (useProductionPrompt) {
      // 使用生产级Prompt（已包含全局上下文注入逻辑）
      prompt = this.buildProductionPrompt(
        sceneContent,
        scene.name,
        scene.description,
        scene.characters,
        sceneBudget,
        sceneIndex,
        totalScenes
      );
      console.log(`[ScriptParser] Using production prompt with context`);
    } else {
      // 使用标准Prompt
      prompt = PROMPTS.shots
        .replace('{content}', sceneContent.substring(0, 6000))
        .replace('{sceneName}', scene.name)
        .replace('{sceneDescription}', scene.description)
        .replace('{characters}', scene.characters.join(', '));

      // Inject global context if available
      if (this.globalContext && this.contextInjector) {
        console.log('[ScriptParser] Injecting global context into shots generation');
        prompt = this.contextInjector.injectForShots(prompt, this.globalContext, scene);
      }
      console.log(`[ScriptParser] Using standard prompt with context`);
    }

    console.log(`[ScriptParser] Context-enhanced prompt length: ${prompt.length} characters`);
    console.log(`[ScriptParser] Characters in scene: ${scene.characters.join(', ')}`);

    const response = await this.callLLM(prompt, 'shots');
    console.log(`[ScriptParser] LLM response received, length: ${response.length} characters`);

    const shots = this.extractJSON<Shot[]>(response);
    console.log(`[ScriptParser] Generated ${shots.length} shots`);

    shots.slice(0, 3).forEach((shot, i) => {
      console.log(`[ScriptParser] Shot ${i + 1}:`);
      console.log(`  - Sequence: ${shot.sequence}`);
      console.log(`  - Type: ${shot.shotType}`);
      console.log(`  - Movement: ${shot.cameraMovement}`);
      console.log(`  - Duration: ${shot.duration}s`);
      console.log(`  - Description: ${shot.description?.substring(0, 40)}...`);
    });

    const result = shots.map((shot, index) => ({
      ...shot,
      id: shot.id || crypto.randomUUID(),
      sceneName: scene.name,
      sequence: shot.sequence || index + 1,
      duration: shot.duration ?? 3, // 确保每个分镜都有默认时长3秒
    }));

    // 计算并输出总时长
    const totalDuration = result.reduce((sum, shot) => sum + (shot.duration ?? 3), 0);
    console.log(`[ScriptParser] Total duration for ${result.length} shots: ${totalDuration}s`);

    return result;
  }

  /**
   * V3: Short text fast path - parse everything in 1-2 API calls
   * For texts < 800 words, extract metadata, characters, scenes, and shots in batch
   */
  async parseShortScript(
    content: string,
    onProgress?: ParseProgressCallback
  ): Promise<ScriptParseState> {
    console.log(`[ScriptParser] ========== Short Text Fast Path ==========`);
    console.log(`[ScriptParser] Content length: ${content.length} characters`);
    console.log(`[ScriptParser] skipGlobalContextForFastPath: ${this.parserConfig.skipGlobalContextForFastPath}`);

    const state: ScriptParseState = {
      stage: 'metadata',
      progress: 10
    };

    try {
      // Step 1: Extract metadata with structured output
      // Fast Path optimization: skip global context extraction if configured
      onProgress?.('metadata', 10, '正在提取元数据...');
      const skipGlobalContext = this.parserConfig.skipGlobalContextForFastPath ?? true;
      state.metadata = await this.extractMetadata(content, { skipGlobalContext });
      state.progress = 25;

      // Step 2: Batch extract all characters
      if (state.metadata.characterNames && state.metadata.characterNames.length > 0) {
        onProgress?.('characters', 25, `正在批量分析 ${state.metadata.characterNames.length} 个角色...`);
        state.characters = await this.extractAllCharactersWithContext(content, state.metadata.characterNames);
        console.log(`[ScriptParser] Fast path: Extracted ${state.characters.length} characters`);
      } else {
        state.characters = [];
      }
      state.progress = 50;

      // Step 3: Batch extract all scenes
      if (state.metadata.sceneNames && state.metadata.sceneNames.length > 0) {
        onProgress?.('scenes', 50, `正在批量分析 ${state.metadata.sceneNames.length} 个场景...`);
        state.scenes = await this.extractAllScenesWithContext(content, state.metadata.sceneNames);
        console.log(`[ScriptParser] Fast path: Extracted ${state.scenes.length} scenes`);
      } else {
        state.scenes = [];
      }
      state.progress = 75;

      // Step 4: Generate shots for all scenes in ONE API call (fast path optimization)
      if (state.scenes.length > 0) {
        onProgress?.('shots', 75, '正在批量生成分镜...');
        try {
          // V3 Optimization: Use generateAllShotsWithContext for single API call
          const allShots = await this.generateAllShotsWithContext(content, state.scenes);
          state.shots = allShots;
          console.log(`[ScriptParser] Fast path: Generated ${allShots.length} shots in 1 API call`);
        } catch (e) {
          console.error('[ScriptParser] Batch shots generation failed:', e);
          // Fallback: generate placeholder shots
          const fallbackShots: Shot[] = [];
          state.scenes.forEach((scene, sceneIndex) => {
            fallbackShots.push({
              id: crypto.randomUUID(),
              sceneName: scene.name,
              sequence: sceneIndex + 1,
              shotType: 'medium',
              cameraMovement: 'static',
              duration: 3,
              description: `${scene.name} - ${scene.description?.substring(0, 30) || '场景描述'}...`,
              characters: scene.characters || [],
              assets: { characterIds: scene.characters || [], sceneId: scene.id || '' },
              contentType: 'static',
              layer: 'key',
              status: 'pending'
            });
          });
          state.shots = fallbackShots;
        }
      } else {
        state.shots = [];
      }
      state.progress = 95;

      // Step 5: Generate quality report
      if (this.parserConfig.useDramaRules && this.qualityAnalyzer) {
        const report = this.qualityAnalyzer.analyze(
          state.metadata,
          state.characters,
          state.scenes,
          [],
          state.shots || [],
          'completed'
        );
        this.qualityReport = report;
        state.qualityReport = report;
      }

      state.stage = 'completed';
      state.progress = 100;
      onProgress?.('completed', 100, '解析完成！');

      console.log(`[ScriptParser] ========== Short Text Parse Completed ==========`);
      console.log(`[ScriptParser] Characters: ${state.characters?.length}, Scenes: ${state.scenes?.length}, Shots: ${state.shots?.length}`);

    } catch (error: any) {
      state.stage = 'error';
      state.error = error.message;
      throw error;
    }

    return state;
  }

  /**
   * V4 Ultra-Fast: Ultra-short text single-pass parsing (<500 characters)
   * 
   * 优化点：
   * 1. 单次API调用提取所有信息（元数据、角色、场景、分镜）
   * 2. 简化Prompt，减少token消耗
   * 3. 跳过中间状态，直接生成最终结果
   * 
   * 相比parseShortScriptOptimized，可减少约70-80%的解析时间和token消耗
   * 
   * @param content - 剧本内容（<500字符）
   * @param onProgress - 进度回调
   * @returns 完整的解析状态
   */
  async parseUltraShortScript(
    content: string,
    onProgress?: ParseProgressCallback
  ): Promise<ScriptParseState> {
    console.log(`[ScriptParser] ========== Ultra-Short Text Single-Pass Parsing ==========`);
    console.log(`[ScriptParser] Content length: ${content.length} characters (threshold: <500)`);

    const state: ScriptParseState = {
      stage: 'metadata',
      progress: 10
    };

    try {
      onProgress?.('metadata', 10, '正在分析剧本内容...');

      // 构建简化版Prompt
      const prompt = `分析以下短剧本，提取所有必要信息：

剧本内容：
${content}

请以JSON格式返回以下信息：
{
  "title": "剧本标题（如果没有合适的，请根据内容生成）",
  "synopsis": "剧情简介（50字以内）",
  "characters": [
    {
      "name": "角色姓名",
      "description": "角色描述（外貌、性格等）",
      "role": "主角/配角/反派"
    }
  ],
  "scenes": [
    {
      "name": "场景名称",
      "description": "场景描述",
      "timeOfDay": "时间（早晨/中午/傍晚/夜晚）",
      "characters": ["场景中出现的角色姓名"]
    }
  ],
  "shots": [
    {
      "sceneName": "所属场景名称",
      "description": "分镜描述（镜头内容、动作等）",
      "shotType": "景别（close-up/medium/long等）",
      "characters": ["分镜中出现的角色"]
    }
  ]
}

注意：
1. 如果剧本内容很短，角色和场景可能很少，这是正常的
2. 分镜应该覆盖剧本中的所有关键动作和对话
3. 确保所有JSON字段都正确填写`;

      // 单次API调用获取所有信息
      const startTime = Date.now();
      
      // 启动进度更新定时器，让用户知道API调用正在进行
      let progress = 10;
      const progressInterval = setInterval(() => {
        progress += 2;
        if (progress < 35) {
          onProgress?.('metadata', progress, '正在等待AI分析结果...');
        }
      }, 2000); // 每2秒更新一次进度
      
      // 使用'metadata'任务类型，它配置了合适的maxTokens和timeout
      const response = await this.callLLM(prompt, 'metadata');
      
      clearInterval(progressInterval);
      const duration = Date.now() - startTime;

      console.log(`[ScriptParser] Single-pass LLM call completed in ${duration}ms`);

      // 解析JSON响应
      let parsedData: any;
      try {
        // 尝试直接解析
        parsedData = JSON.parse(response);
      } catch (e) {
        // 尝试从markdown代码块中提取JSON
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error('无法解析LLM响应为JSON格式');
        }
      }

      onProgress?.('metadata', 40, '正在处理解析结果...');

      // 构建metadata
      state.metadata = {
        title: parsedData.title || '未命名剧本',
        synopsis: parsedData.synopsis || '',
        genre: parsedData.genre || '剧情',
        tone: parsedData.tone || 'neutral',
        targetAudience: parsedData.targetAudience || 'general',
        characterCount: parsedData.characters?.length || 0,
        sceneCount: parsedData.scenes?.length || 0,
        estimatedDuration: parsedData.shots?.length * 3 || 0, // 每个分镜约3秒
        characterNames: parsedData.characters?.map((c: any) => c.name) || [],
        sceneNames: parsedData.scenes?.map((s: any) => s.name) || [],
        keyProps: parsedData.keyProps || [],
        themes: parsedData.themes || []
      };

      // 构建characters
      state.characters = (parsedData.characters || []).map((char: any, index: number) => ({
        id: crypto.randomUUID(),
        name: char.name || `角色${index + 1}`,
        description: char.description || '',
        role: char.role || '配角',
        appearance: {
          height: '',
          build: '',
          face: '',
          hair: '',
          clothing: ''
        },
        tags: []
      }));

      // 构建scenes
      state.scenes = (parsedData.scenes || []).map((scene: any, index: number) => ({
        id: crypto.randomUUID(),
        name: scene.name || `场景${index + 1}`,
        description: scene.description || '',
        timeOfDay: scene.timeOfDay || 'day',
        locationType: 'interior',
        characters: scene.characters || [],
        duration: 0,
        emotionalTone: 'neutral'
      }));

      onProgress?.('shots', 70, '正在生成分镜...');

      // 构建shots
      state.shots = (parsedData.shots || []).map((shot: any, index: number) => ({
        id: crypto.randomUUID(),
        sceneName: shot.sceneName || '',
        sequence: index + 1,
        shotType: shot.shotType || 'medium',
        cameraMovement: 'static',
        duration: 3,
        description: shot.description || '',
        characters: shot.characters || [],
        assets: {
          characterIds: shot.characters || [],
          sceneId: state.scenes.find(s => s.name === shot.sceneName)?.id || ''
        },
        contentType: 'static',
        layer: 'key',
        status: 'pending'
      }));

      state.progress = 90;

      // 生成质量报告
      if (this.parserConfig.useDramaRules && this.qualityAnalyzer) {
        const report = this.qualityAnalyzer.analyze(
          state.metadata,
          state.characters,
          state.scenes,
          [],
          state.shots,
          'completed',
          false, // emotionalArc not extracted in ultra-short mode
          undefined
        );
        this.qualityReport = report;
        state.qualityReport = report;
      }

      state.stage = 'completed';
      state.progress = 100;
      onProgress?.('completed', 100, '解析完成！');

      console.log(`[ScriptParser] ========== Ultra-Short Text Parse Completed ==========`);
      console.log(`[ScriptParser] Characters: ${state.characters?.length}, Scenes: ${state.scenes?.length}, Shots: ${state.shots?.length}`);
      console.log(`[ScriptParser] Total API calls: 1 (vs 5+ in standard mode)`);
      console.log(`[ScriptParser] Estimated token savings: ~80%`);

    } catch (error: any) {
      state.stage = 'error';
      state.error = error.message;
      console.error('[ScriptParser] Ultra-short parsing failed:', error);
      throw error;
    }

    return state;
  }

  /**
   * V3 Optimized: Short text fast path with parallel extraction
   * 
   * 优化点：
   * 1. 元数据和全局上下文并行提取
   * 2. 角色和场景并行提取
   * 3. 分镜生成仍然串行（依赖角色和场景结果）
   * 
   * 相比原 parseShortScript，可减少约30-40%的解析时间
   */
  async parseShortScriptOptimized(
    content: string,
    onProgress?: ParseProgressCallback
  ): Promise<ScriptParseState> {
    console.log(`[ScriptParser] ========== Short Text Fast Path (Optimized) ==========`);
    console.log(`[ScriptParser] Content length: ${content.length} characters`);

    const state: ScriptParseState = {
      stage: 'metadata',
      progress: 10
    };

    try {
      // Step 1: 并行提取元数据和全局上下文
      onProgress?.('metadata', 10, '正在并行提取元数据和全局上下文...');
      
      const [metadata, globalContext] = await Promise.all([
        this.extractMetadata(content, { skipGlobalContext: true }),
        this.extractGlobalContext(content)
      ]);
      
      state.metadata = metadata;
      this.globalContext = globalContext;
      
      console.log(`[ScriptParser] Parallel extraction complete:`);
      console.log(`  - Metadata: ${metadata.title}, ${metadata.characterCount} characters, ${metadata.sceneCount} scenes`);
      console.log(`  - Global Context: ${globalContext ? 'extracted' : 'skipped'}`);
      
      state.progress = 30;

      // Step 2: 并行提取角色和场景
      const characterNames = state.metadata.characterNames || [];
      const sceneNames = state.metadata.sceneNames || [];
      
      if (characterNames.length > 0 || sceneNames.length > 0) {
        onProgress?.('characters', 30, `正在并行分析 ${characterNames.length} 个角色和 ${sceneNames.length} 个场景...`);
        
        const [characters, scenes] = await Promise.all([
          characterNames.length > 0 
            ? this.extractAllCharactersWithContext(content, characterNames)
            : Promise.resolve([]),
          sceneNames.length > 0
            ? this.extractAllScenesWithContext(content, sceneNames)
            : Promise.resolve([])
        ]);
        
        state.characters = characters;
        state.scenes = scenes;
        
        console.log(`[ScriptParser] Parallel character/scene extraction complete:`);
        console.log(`  - Characters: ${characters.length}`);
        console.log(`  - Scenes: ${scenes.length}`);
      } else {
        state.characters = [];
        state.scenes = [];
      }
      
      state.progress = 70;

      // Step 3: 分镜生成（串行，依赖角色和场景结果）
      if (state.scenes.length > 0) {
        onProgress?.('shots', 70, '正在批量生成分镜...');
        try {
          const allShots = await this.generateAllShotsWithContext(content, state.scenes);
          state.shots = allShots;
          console.log(`[ScriptParser] Fast path optimized: Generated ${allShots.length} shots in 1 API call`);
        } catch (e) {
          console.error('[ScriptParser] Batch shots generation failed:', e);
          // Fallback: generate placeholder shots
          const fallbackShots: Shot[] = [];
          state.scenes.forEach((scene, sceneIndex) => {
            fallbackShots.push({
              id: crypto.randomUUID(),
              sceneName: scene.name,
              sequence: sceneIndex + 1,
              shotType: 'medium',
              cameraMovement: 'static',
              duration: 3,
              description: `${scene.name} - ${scene.description?.substring(0, 30) || '场景描述'}...`,
              characters: scene.characters || [],
              assets: { characterIds: scene.characters || [], sceneId: scene.id || '' },
              contentType: 'static',
              layer: 'key',
              status: 'pending'
            });
          });
          state.shots = fallbackShots;
        }
      } else {
        state.shots = [];
      }

      state.progress = 95;

      // Step 4: 生成质量报告
      if (this.parserConfig.useDramaRules && this.qualityAnalyzer) {
        // 确定是否提取了情绪曲线
        const emotionalArcExtracted = state.metadata?.emotionalArc !== undefined && state.metadata.emotionalArc.length > 0;
        
        // 确定跳过的功能列表
        const skippedFeatures: string[] = [];
        if (!emotionalArcExtracted) {
          skippedFeatures.push('emotionalArc');
        }
        
        const report = this.qualityAnalyzer.analyze(
          state.metadata,
          state.characters,
          state.scenes,
          [],
          state.shots || [],
          'completed',
          emotionalArcExtracted,
          skippedFeatures.length > 0 ? skippedFeatures : undefined
        );
        this.qualityReport = report;
        state.qualityReport = report;
      }

      state.stage = 'completed';
      state.progress = 100;
      onProgress?.('completed', 100, '解析完成！');

      console.log(`[ScriptParser] ========== Short Text Parse (Optimized) Completed ==========`);
      console.log(`[ScriptParser] Characters: ${state.characters?.length}, Scenes: ${state.scenes?.length}, Shots: ${state.shots?.length}`);

    } catch (error: any) {
      state.stage = 'error';
      state.error = error.message;
      throw error;
    }

    return state;
  }

  /**
   * Phase 3.3: Chunked parsing for long texts (>5000 words)
   * Splits text into semantic chunks and parses each chunk separately
   * Then merges results with deduplication
   */
  async parseChunkedScript(
    content: string,
    onProgress?: ParseProgressCallback
  ): Promise<ScriptParseState> {
    console.log(`[ScriptParser] ========== Chunked Text Parse Path ==========`);
    console.log(`[ScriptParser] Content length: ${content.length} characters`);

    const state: ScriptParseState = {
      stage: 'metadata',
      progress: 0
    };

    try {
      // Step 1: Semantic chunking
      onProgress?.('metadata', 5, '正在分块...');
      
      if (!this.semanticChunker) {
        this.semanticChunker = new SemanticChunker({ 
          maxTokens: 3000, // Smaller chunks for long texts
          preserveParagraphs: true,
          extractMetadata: false
        });
      }

      const chunks = await this.semanticChunker.chunk(content);
      console.log(`[ScriptParser] Text split into ${chunks.length} chunks`);
      state.progress = 10;

      // Step 2: Extract metadata from FULL content (not just first chunk) for complete character/scene list
      onProgress?.('metadata', 10, '正在提取元数据...');
      // Use beginning portion of content for metadata extraction but with instruction to find all
      const metadataContent = content.substring(0, Math.min(content.length, 8000)); // Use more content for better metadata
      state.metadata = await this.extractMetadata(metadataContent);
      console.log(`[ScriptParser] Metadata extracted from full content: ${state.metadata.characterCount} characters, ${state.metadata.sceneCount} scenes`);
      console.log(`[ScriptParser] Character names from metadata: ${state.metadata.characterNames?.join(', ') || 'none'}`);
      console.log(`[ScriptParser] Scene names from metadata: ${state.metadata.sceneNames?.join(', ') || 'none'}`);
      state.progress = 20;

      // Step 3: Parse each chunk for characters and scenes (Phase 2.2: Parallel extraction)
      // FIXED: Each chunk independently discovers and extracts characters/scenes from its content
      const allCharacters: ScriptCharacter[] = [];
      const allScenes: ScriptScene[] = [];
      const characterNames = new Set<string>();
      const sceneNames = new Set<string>();

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const progress = 20 + (i / chunks.length) * 40;
        onProgress?.('characters', progress, `正在并行解析第 ${i + 1}/${chunks.length} 块...`);

        console.log(`[ScriptParser] Processing chunk ${i + 1}/${chunks.length} (${chunk.content.length} chars)...`);

        // Prepare extraction tasks for parallel execution
        const extractionTasks: Promise<void>[] = [];

        // Character extraction task - FIXED: Extract characters that appear in this chunk
        const characterTask = (async () => {
          try {
            // First, discover characters in this chunk
            const discoveredCharacters = await this.discoverCharactersInChunk(chunk.content);
            console.log(`[ScriptParser] Chunk ${i + 1}: Discovered ${discoveredCharacters.length} characters: ${discoveredCharacters.join(', ') || 'none'}`);
            
            if (discoveredCharacters.length === 0) return;

            // Filter out already extracted characters
            const newCharacterNames = discoveredCharacters.filter(name => !characterNames.has(name));
            if (newCharacterNames.length === 0) {
              console.log(`[ScriptParser] Chunk ${i + 1}: All discovered characters already extracted`);
              return;
            }

            console.log(`[ScriptParser] Chunk ${i + 1}: Extracting ${newCharacterNames.length} new characters: ${newCharacterNames.join(', ')}`);

            const chunkCharacters = await this.extractAllCharactersWithContext(
              chunk.content,
              newCharacterNames
            );
            
            for (const char of chunkCharacters) {
              if (!characterNames.has(char.name)) {
                characterNames.add(char.name);
                allCharacters.push(char);
                console.log(`[ScriptParser] Added character: ${char.name}`);
              }
            }
          } catch (error) {
            console.error(`[ScriptParser] Character extraction failed for chunk ${i + 1}:`, error);
          }
        })();
        extractionTasks.push(characterTask);

        // Scene extraction task - FIXED: Extract scenes that appear in this chunk
        const sceneTask = (async () => {
          try {
            // First, discover scenes in this chunk
            const discoveredScenes = await this.discoverScenesInChunk(chunk.content);
            console.log(`[ScriptParser] Chunk ${i + 1}: Discovered ${discoveredScenes.length} scenes: ${discoveredScenes.join(', ') || 'none'}`);
            
            if (discoveredScenes.length === 0) return;

            // Filter out already extracted scenes
            const newSceneNames = discoveredScenes.filter(name => !sceneNames.has(name));
            if (newSceneNames.length === 0) {
              console.log(`[ScriptParser] Chunk ${i + 1}: All discovered scenes already extracted`);
              return;
            }

            console.log(`[ScriptParser] Chunk ${i + 1}: Extracting ${newSceneNames.length} new scenes: ${newSceneNames.join(', ')}`);

            const chunkScenes = await this.extractAllScenesWithContext(
              chunk.content,
              newSceneNames
            );
            
            for (const scene of chunkScenes) {
              if (!sceneNames.has(scene.name)) {
                sceneNames.add(scene.name);
                allScenes.push(scene);
                console.log(`[ScriptParser] Added scene: ${scene.name}`);
              }
            }
          } catch (error) {
            console.error(`[ScriptParser] Scene extraction failed for chunk ${i + 1}:`, error);
          }
        })();
        extractionTasks.push(sceneTask);

        // Execute extractions in parallel
        if (extractionTasks.length > 0) {
          console.log(`[ScriptParser] Executing ${extractionTasks.length} extraction tasks in parallel for chunk ${i + 1}...`);
          await Promise.all(extractionTasks);
        }

        console.log(`[ScriptParser] Chunk ${i + 1} complete. Total so far: ${allCharacters.length} characters, ${allScenes.length} scenes`);

        // Small delay between chunks to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      state.characters = allCharacters;
      state.scenes = allScenes;
      state.progress = 60;
      console.log(`[ScriptParser] Chunked extraction complete: ${allCharacters.length} characters, ${allScenes.length} scenes`);
      console.log(`[ScriptParser] Final character list: ${allCharacters.map(c => c.name).join(', ')}`);
      console.log(`[ScriptParser] Final scene list: ${allScenes.map(s => s.name).join(', ')}`);

      // Step 4: Generate shots in batches
      onProgress?.('shots', 60, '正在生成分镜...');
      
      if (state.scenes.length > 0) {
        const BATCH_SIZE = 3;
        const allShots: Shot[] = [];
        
        for (let i = 0; i < state.scenes.length; i += BATCH_SIZE) {
          const batch = state.scenes.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(state.scenes.length / BATCH_SIZE);
          
          onProgress?.('shots', 60 + (i / state.scenes.length) * 30, `正在生成分镜 (批次 ${batchNum}/${totalBatches})...`);
          
          try {
            const batchShots = await this.generateAllShotsWithContext(content, batch);
            allShots.push(...batchShots);
          } catch (e) {
            console.error(`[ScriptParser] Batch ${batchNum} failed:`, e);
            // Fallback: generate placeholder shots
            for (const scene of batch) {
              allShots.push({
                id: crypto.randomUUID(),
                sceneName: scene.name,
                sequence: allShots.length + 1,
                shotType: 'medium',
                cameraMovement: 'static',
                duration: 3,
                description: `${scene.name} - ${scene.description?.substring(0, 30) || '场景描述'}...`,
                characters: scene.characters || [],
                assets: { characterIds: scene.characters || [], sceneId: scene.id || '' },
                contentType: 'static',
                layer: 'key',
                status: 'pending'
              });
            }
          }

          // Small delay between batches
          if (i + BATCH_SIZE < state.scenes.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
        
        state.shots = allShots;
        console.log(`[ScriptParser] Generated ${allShots.length} shots`);
      } else {
        state.shots = [];
      }
      
      state.progress = 90;

      // Step 5: Generate quality report
      if (this.parserConfig.useDramaRules && this.qualityAnalyzer) {
        const report = this.qualityAnalyzer.analyze(
          state.metadata,
          state.characters,
          state.scenes,
          [],
          state.shots || [],
          'completed'
        );
        this.qualityReport = report;
        state.qualityReport = report;
      }

      state.stage = 'completed';
      state.progress = 100;
      onProgress?.('completed', 100, '解析完成！');

      console.log(`[ScriptParser] ========== Chunked Parse Completed ==========`);
      console.log(`[ScriptParser] Characters: ${state.characters?.length}, Scenes: ${state.scenes?.length}, Shots: ${state.shots?.length}`);

    } catch (error: any) {
      state.stage = 'error';
      state.error = error.message;
      throw error;
    }

    return state;
  }

  /**
   * Full parsing pipeline with progress tracking and error recovery
   * 
   * V2 优化：添加详细的性能监控日志
   * V3 优化：添加短文本快速路径
   */
  async parseScript(
    scriptId: string,
    projectId: string,
    content: string,
    onProgress?: ParseProgressCallback,
    resumeFromState?: ScriptParseState
  ): Promise<ScriptParseState> {
    // Phase 3.1: Use strategy selector for automatic strategy selection
    console.log(`[ScriptParser] ========== Starting Parse Script ==========`);
    
    let strategySelection: StrategySelection;
    if (this.strategySelector && !resumeFromState) {
      strategySelection = this.strategySelector.selectStrategy(content);
      this.lastStrategySelection = strategySelection;
      console.log(`[ScriptParser] Strategy selected: ${strategySelection.strategy}`);
      console.log(`[ScriptParser] Reason: ${strategySelection.reason}`);
      console.log(`[ScriptParser] Word count: ${strategySelection.wordCount}`);
      console.log(`[ScriptParser] Estimated time: ${strategySelection.estimatedTime}s`);
      console.log(`[ScriptParser] Recommended batch size: ${strategySelection.recommendedBatchSize}`);
    } else {
      // Fallback to legacy logic
      const wordCount = this.countWords(content);
      strategySelection = {
        strategy: wordCount < 800 ? 'fast' : 'standard',
        reason: 'Legacy fallback selection',
        wordCount,
        estimatedTime: wordCount < 800 ? 60 : Math.ceil(wordCount / 200) * 15,
        recommendedBatchSize: wordCount < 800 ? 10 : 5
      };
    }

    // Phase 3.1: Route to appropriate parsing strategy
    
    // V4: Ultra-short path for very short texts (<500 chars) - single API call
    if (content.length < 500 && !resumeFromState) {
      console.log(`[ScriptParser] Using ULTRA-SHORT PATH (content length: ${content.length} < 500)`);
      console.log(`[ScriptParser] This path uses only 1 API call vs 5+ in standard mode`);
      
      const ultraShortStartTime = Date.now();
      
      try {
        const result = await this.parseUltraShortScript(content, onProgress);
        
        const ultraShortDuration = Date.now() - ultraShortStartTime;
        console.log(`[ScriptParser] ========== Ultra-Short Path Completed ==========`);
        console.log(`[ScriptParser] Total duration: ${ultraShortDuration}ms (${(ultraShortDuration/1000).toFixed(1)}s)`);
        console.log(`[ScriptParser] Estimated token savings: ~80%`);
        console.log(`[ScriptParser] ==========================================`);
        
        await this.saveState(scriptId, projectId, result);
        return result;
      } catch (error) {
        console.warn('[ScriptParser] Ultra-short path failed, falling back to fast path:', error);
        // Fall through to fast path
      }
    }
    
    if (strategySelection.strategy === 'fast' && !resumeFromState) {
      const useParallel = this.parserConfig.useParallelExtraction ?? true;
      console.log(`[ScriptParser] Using FAST PATH (${strategySelection.reason})`);
      console.log(`[ScriptParser] useParallelExtraction: ${useParallel}`);
      
      const fastStartTime = Date.now();
      
      // 根据配置选择使用优化版本或原版本
      const result = useParallel
        ? await this.parseShortScriptOptimized(content, onProgress)
        : await this.parseShortScript(content, onProgress);
        
      const fastDuration = Date.now() - fastStartTime;
      console.log(`[ScriptParser] ========== Fast Path Completed ==========`);
      console.log(`[ScriptParser] Total duration: ${fastDuration}ms (${(fastDuration/1000).toFixed(1)}s)`);
      console.log(`[ScriptParser] Mode: ${useParallel ? 'Parallel (Optimized)' : 'Sequential (Legacy)'}`);
      console.log(`[ScriptParser] ==========================================`);
      await this.saveState(scriptId, projectId, result);
      return result;
    }

    // Phase 3.3: Chunked path for long texts
    if (strategySelection.strategy === 'chunked' && !resumeFromState) {
      console.log(`[ScriptParser] Using CHUNKED PATH (${strategySelection.reason})`);
      const chunkedStartTime = Date.now();
      const result = await this.parseChunkedScript(content, onProgress);
      const chunkedDuration = Date.now() - chunkedStartTime;
      console.log(`[ScriptParser] ========== Chunked Path Completed ==========`);
      console.log(`[ScriptParser] Total duration: ${chunkedDuration}ms (${(chunkedDuration/1000).toFixed(1)}s)`);
      console.log(`[ScriptParser] ==========================================`);
      await this.saveState(scriptId, projectId, result);
      return result;
    }

    console.log(`[ScriptParser] Using ${strategySelection.strategy.toUpperCase()} PATH (${strategySelection.reason})`);

    // V2: 性能监控 - 记录总耗时
    const totalStartTime = Date.now();
    const stageTimings: Record<string, number> = {};

    // Try to resume from provided state or load from storage
    let state: ScriptParseState = resumeFromState || {
      stage: 'idle',
      progress: 0
    };

    // If no resume state provided, try to load from storage
    if (!resumeFromState) {
      try {
        const savedState = await this.loadState(scriptId, projectId);
        if (savedState && savedState.stage !== 'completed' && savedState.stage !== 'error') {
          console.log(`[ScriptParser] Resuming from saved state: ${savedState.stage}`);
          state = savedState;
          onProgress?.(state.stage, state.progress, `从 ${state.stage} 阶段恢复...`);
        }
      } catch (e) {
        console.warn('[ScriptParser] Failed to load saved state:', e);
      }
    }

    try {
      // Stage 1: Metadata (skip if already completed)
      const metadataStartTime = Date.now();
      if (!state.metadata) {
        state.stage = 'metadata';
        state.progress = 10;
        onProgress?.('metadata', 10, '正在提取元数据...');
        
        state.metadata = await this.extractMetadata(content);
        state.progress = 20;
        await this.saveState(scriptId, projectId, state);
      } else {
        console.log('[ScriptParser] Skipping metadata extraction (already exists)');
        onProgress?.('metadata', 20, '元数据已存在，跳过...');
      }
      stageTimings['metadata'] = Date.now() - metadataStartTime;

      // Phase 2.2: Parallel extraction of characters and scenes
      const extractionStartTime = Date.now();
      state.stage = 'characters';
      state.progress = 25;
      onProgress?.('characters', 25, '正在并行分析角色和场景...');

      // Resume from existing data if available
      const existingCharacters = state.characters || [];
      const existingScenes = state.scenes || [];
      const existingCharacterNames = new Set(existingCharacters.map(c => c.name));
      const existingSceneNames = new Set(existingScenes.map(s => s.name));
      const characters: ScriptCharacter[] = [...existingCharacters];
      const scenes: ScriptScene[] = [...existingScenes];
      const characterNames = state.metadata.characterNames || [];
      const sceneNames = state.metadata.sceneNames || [];

      // Filter out already processed items
      const remainingCharacterNames = characterNames.filter(name => !existingCharacterNames.has(name));
      const remainingSceneNames = sceneNames.filter(name => !existingSceneNames.has(name));

      // Prepare extraction tasks
      const extractionTasks: Promise<void>[] = [];

      // Character extraction task
      if (remainingCharacterNames.length > 0) {
        console.log(`[ScriptParser] Processing ${remainingCharacterNames.length} remaining characters using batch extraction`);
        const characterTask = (async () => {
          try {
            onProgress?.('characters', 30, `正在批量分析 ${remainingCharacterNames.length} 个角色...`);
            const newCharacters = await this.extractAllCharactersWithContext(content, remainingCharacterNames);
            characters.push(...newCharacters);
            state.characters = characters;
            console.log(`[ScriptParser] Batch extracted ${newCharacters.length} characters`);
          } catch (e) {
            console.error('[ScriptParser] Batch character extraction failed:', e);
            // Fallback: add placeholder characters
            remainingCharacterNames.forEach(name => {
              characters.push(this.createPlaceholderCharacter(name));
            });
            state.characters = characters;
          }
        })();
        extractionTasks.push(characterTask);
      } else {
        console.log('[ScriptParser] All characters already processed, skipping...');
      }

      // Scene extraction task
      if (remainingSceneNames.length > 0) {
        console.log(`[ScriptParser] Processing ${remainingSceneNames.length} remaining scenes using batch extraction`);
        const sceneTask = (async () => {
          try {
            onProgress?.('scenes', 40, `正在批量分析 ${remainingSceneNames.length} 个场景...`);
            const newScenes = await this.extractAllScenesWithContext(content, remainingSceneNames);
            scenes.push(...newScenes);
            state.scenes = scenes;
            console.log(`[ScriptParser] Batch extracted ${newScenes.length} scenes`);
          } catch (e) {
            console.error('[ScriptParser] Batch scene extraction failed:', e);
            // Fallback: add placeholder scenes
            remainingSceneNames.forEach(name => {
              scenes.push(this.createPlaceholderScene(name));
            });
            state.scenes = scenes;
          }
        })();
        extractionTasks.push(sceneTask);
      } else {
        console.log('[ScriptParser] All scenes already processed, skipping...');
      }

      // Execute extractions in parallel
      if (extractionTasks.length > 0) {
        console.log(`[ScriptParser] Executing ${extractionTasks.length} extraction tasks in parallel...`);
        await Promise.all(extractionTasks);
        state.progress = 70;
        await this.saveState(scriptId, projectId, state);
        console.log(`[ScriptParser] Parallel extraction complete: ${characters.length} characters, ${scenes.length} scenes`);
      } else {
        state.progress = 70;
        onProgress?.('scenes', 70, '角色和场景已存在，跳过...');
      }

      stageTimings['extraction'] = Date.now() - extractionStartTime;

      this.currentScenes = scenes;
      this.currentCharacters = characters;

      // Stage 3.5: Iterative Refinement (optional optimization)
      if (this.parserConfig.enableIterativeRefinement && this.iterativeRefinementEngine) {
        state.stage = 'refinement';
        state.progress = 68;
        onProgress?.('refinement', 68, '正在优化解析结果...');

        try {
          console.log('[ScriptParser] Starting iterative refinement...');
          const refinementResult = await this.iterativeRefinementEngine.refine(
            state.metadata,
            characters,
            scenes
          );

          this.iterativeRefinementResult = refinementResult;

          // Apply optimized metadata if improvement was made
          if (refinementResult.success && refinementResult.totalQualityImprovement > 0) {
            console.log(`[ScriptParser] Refinement successful: ${refinementResult.initialQualityScore.toFixed(2)} -> ${refinementResult.finalQualityScore.toFixed(2)} (+${refinementResult.totalQualityImprovement.toFixed(2)})`);
            state.metadata = refinementResult.finalMetadata;
            // Note: characters and scenes are stored separately in parse state, not in metadata
            // They are passed separately to the refinement engine
          } else {
            console.log('[ScriptParser] Refinement completed with no significant improvement');
          }

          // Save refinement result to state
          state.refinementResult = refinementResult;
          await this.saveState(scriptId, projectId, state);
        } catch (error) {
          console.warn('[ScriptParser] Iterative refinement failed:', error);
          // Continue with original data if refinement fails
        }
      }

      // Stage 3.6: Duration Budget Calculation (optional)
      if (this.parserConfig.useDurationBudget) {
        state.stage = 'budget';
        state.progress = 69;
        onProgress?.('budget', 69, '正在计算时长预算...');

        try {
          console.log('[ScriptParser] Starting duration budget calculation...');

          // Calculate budget using existing shots or estimate from scenes
          const existingShotsForBudget = state.shots || [];

          if (existingShotsForBudget.length > 0) {
            // Calculate budget based on existing shots
            this.durationBudget = calculateBudget(existingShotsForBudget, {
              platform: this.parserConfig.targetPlatform || 'douyin',
              pace: this.parserConfig.paceType || 'normal',
            });
          } else {
            // Create placeholder shots from scenes for budget estimation
            const estimatedShots: Shot[] = [];
            scenes.forEach((scene, sceneIndex) => {
              // Estimate 3-5 shots per scene based on content length
              const sceneContent = content.includes(scene.name)
                ? content.split(scene.name)[1]?.split('\n\n')[0] || ''
                : '';
              const estimatedShotCount = Math.max(3, Math.min(5, Math.ceil(sceneContent.length / 200)));

              for (let i = 0; i < estimatedShotCount; i++) {
                estimatedShots.push({
                  id: crypto.randomUUID(),
                  sceneName: scene.name,
                  sequence: i + 1,
                  shotType: 'medium',
                  cameraMovement: 'static',
                  description: scene.description?.substring(0, 50) || '',
                  dialogue: '',
                  sound: '',
                  duration: 3,
                  characters: scene.characters || [],
                  assets: { characterIds: scene.characters || [], sceneId: scene.id || '' },
                  contentType: 'static',
                  layer: 'key',
                  status: 'pending'
                });
              }
            });

            this.durationBudget = calculateBudget(estimatedShots, {
              platform: this.parserConfig.targetPlatform || 'douyin',
              pace: this.parserConfig.paceType || 'normal',
            });
          }

          // Validate budget
          const validation = validateBudget(this.durationBudget);
          if (!validation.valid) {
            console.warn('[ScriptParser] Budget validation warnings:', validation.issues);
          }

          // Save budget to state
          state.durationBudget = this.durationBudget;
          await this.saveState(scriptId, projectId, state);

          console.log(`[ScriptParser] Budget calculated: ${this.durationBudget.totalDuration}s total, ${this.durationBudget.sceneBudgets.length} scenes`);
        } catch (error) {
          console.warn('[ScriptParser] Budget calculation failed:', error);
          // Continue without budget if calculation fails
          this.durationBudget = null;
        }
      }

      // Stage 4: Shots (Phase 2.3: Optimized batch generation)
      const shotsStartTime = Date.now();
      state.stage = 'shots';
      state.progress = 70;
      onProgress?.('shots', 70, '正在生成分镜...');

      // Resume from existing shots if available
      const existingShots = state.shots || [];
      const existingSceneShots = new Map<string, Shot[]>();
      existingShots.forEach(shot => {
        if (!existingSceneShots.has(shot.sceneName)) {
          existingSceneShots.set(shot.sceneName, []);
        }
        existingSceneShots.get(shot.sceneName)!.push(shot);
      });

      const allShots: Shot[] = [...existingShots];

      // Filter out scenes that already have shots
      const remainingScenes = scenes.filter(scene => !existingSceneShots.has(scene.name));

      if (remainingScenes.length > 0) {
        console.log(`[ScriptParser] Processing shots for ${remainingScenes.length} remaining scenes`);

        // Phase 2.3: Use batch generation for better performance
        // If <= 3 scenes remaining, use single API call; otherwise process in batches
        const BATCH_SIZE = 3;
        
        if (remainingScenes.length <= BATCH_SIZE) {
          // Small batch: use single API call
          console.log(`[ScriptParser] Using single API call for ${remainingScenes.length} scenes`);
          onProgress?.('shots', 75, `正在批量生成分镜 (${remainingScenes.length} 场景)...`);
          
          try {
            const newShots = await this.generateAllShotsWithContext(content, remainingScenes);
            allShots.push(...newShots);
            console.log(`[ScriptParser] Batch generated ${newShots.length} shots in 1 API call`);
          } catch (e) {
            console.error('[ScriptParser] Batch shots generation failed, falling back to individual:', e);
            // Fallback: generate individually
            for (const scene of remainingScenes) {
              try {
                const sceneIndex = scenes.findIndex(s => s.name === scene.name);
                const shots = await this.generateShotsWithContext(content, scene, sceneIndex, scenes.length);
                allShots.push(...shots.map((shot, idx) => ({
                  ...shot,
                  id: shot.id || crypto.randomUUID(),
                  sceneName: scene.name,
                  sequence: shot.sequence || idx + 1
                })));
              } catch (err) {
                console.error(`[ScriptParser] Failed to generate shots for ${scene.name}:`, err);
              }
            }
          }
        } else {
          // Large batch: process in batches of 3 scenes
          console.log(`[ScriptParser] Using batched generation for ${remainingScenes.length} scenes (${Math.ceil(remainingScenes.length / BATCH_SIZE)} batches)`);
          
          for (let i = 0; i < remainingScenes.length; i += BATCH_SIZE) {
            const batch = remainingScenes.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(remainingScenes.length / BATCH_SIZE);
            
            console.log(`[ScriptParser] Processing batch ${batchNum}/${totalBatches}: ${batch.length} scenes`);
            onProgress?.('shots', 70 + (i / remainingScenes.length) * 25, `正在生成分镜 (批次 ${batchNum}/${totalBatches})...`);
            
            try {
              const newShots = await this.generateAllShotsWithContext(content, batch);
              allShots.push(...newShots);
              console.log(`[ScriptParser] Batch ${batchNum} complete: ${newShots.length} shots`);
            } catch (e) {
              console.error(`[ScriptParser] Batch ${batchNum} failed, falling back to individual:`, e);
              // Fallback: generate individually
              for (const scene of batch) {
                try {
                  const sceneIndex = scenes.findIndex(s => s.name === scene.name);
                  const shots = await this.generateShotsWithContext(content, scene, sceneIndex, scenes.length);
                  allShots.push(...shots.map((shot, idx) => ({
                    ...shot,
                    id: shot.id || crypto.randomUUID(),
                    sceneName: scene.name,
                    sequence: shot.sequence || idx + 1
                  })));
                } catch (err) {
                  console.error(`[ScriptParser] Failed to generate shots for ${scene.name}:`, err);
                }
              }
            }
            
            // Save progress after each batch
            state.shots = allShots;
            state.progress = 70 + ((i + batch.length) / remainingScenes.length) * 25;
            await this.saveState(scriptId, projectId, state);
          }
        }
        
        state.shots = allShots;
        await this.saveState(scriptId, projectId, state);
      } else {
        console.log('[ScriptParser] All shots already generated, skipping...');
        onProgress?.('shots', 95, '分镜已存在，跳过...');
      }
      stageTimings['shots'] = Date.now() - shotsStartTime;

      // Complete
      state.stage = 'completed';
      state.progress = 100;

      // Generate final quality report after all shots are generated
      if (this.parserConfig.useDramaRules && this.qualityAnalyzer) {
        console.log('[ScriptParser] ========== Generating Quality Report (Full Parse) ==========');
        console.log('[ScriptParser] Input data:', {
          hasMetadata: !!state.metadata,
          charactersCount: this.currentCharacters.length,
          scenesCount: this.currentScenes.length,
          itemsCount: this.currentItems.length,
          shotsCount: (state.shots || []).length
        });

        const finalReport = this.qualityAnalyzer.analyze(
          state.metadata,
          this.currentCharacters,
          this.currentScenes,
          this.currentItems,
          state.shots || [],
          'completed'
        );
        this.qualityReport = finalReport;

        console.log('[ScriptParser] ========== Quality Report Generated ==========');
        console.log('[ScriptParser] Score:', finalReport.score);
        console.log('[ScriptParser] Grade:', finalReport.overallGrade);
        console.log('[ScriptParser] Confidence:', finalReport.confidence);
        console.log('[ScriptParser] Violations:', finalReport.violations.length);
        console.log('[ScriptParser] Suggestions:', finalReport.suggestions.length);
      }

      // Save quality report to state for persistence
      if (this.qualityReport) {
        state.qualityReport = this.qualityReport;
        console.log('[ScriptParser] ========== Saving to State ==========');
        console.log('[ScriptParser] state.qualityReport set:', !!state.qualityReport);
        console.log('[ScriptParser] state.qualityReport.score:', state.qualityReport?.score);
      } else {
        console.warn('[ScriptParser] No quality report to save!');
      }

      onProgress?.('completed', 100, '解析完成！');
      await this.saveState(scriptId, projectId, state);

      // V2: 性能监控 - 输出总耗时报告
      const totalDuration = Date.now() - totalStartTime;
      console.log(`[ScriptParser] ========== Parse Completed ==========`);
      console.log(`[ScriptParser] Total duration: ${totalDuration}ms (${(totalDuration/1000).toFixed(1)}s)`);
      console.log(`[ScriptParser] Stage timings:`);
      Object.entries(stageTimings).forEach(([stage, duration]) => {
        const percentage = ((duration / totalDuration) * 100).toFixed(1);
        console.log(`[ScriptParser]   - ${stage}: ${duration}ms (${percentage}%)`);
      });
      console.log(`[ScriptParser] Content length: ${content.length} chars`);
      console.log(`[ScriptParser] Characters: ${state.metadata?.characterCount}, Scenes: ${state.metadata?.sceneCount}`);
      console.log(`[ScriptParser] ==========================================`);

    } catch (error: any) {
      state.stage = 'error';
      state.error = error.message;
      onProgress?.('error', state.progress, `解析失败: ${error.message}`);
      await this.saveState(scriptId, projectId, state);
      
      // V2: 性能监控 - 即使失败也输出耗时
      const totalDuration = Date.now() - totalStartTime;
      console.error(`[ScriptParser] Parse failed after ${totalDuration}ms:`, error.message);
      
      throw error;
    }

    return state;
  }

  /**
   * Save parsing state to storage
   */
  private async saveState(scriptId: string, projectId: string, state: ScriptParseState): Promise<void> {
    await storageService.updateScriptParseState(scriptId, projectId, () => state);
  }

  /**
   * Load parsing state from storage
   */
  private async loadState(scriptId: string, projectId: string): Promise<ScriptParseState | null> {
    try {
      const script = await storageService.getScript(scriptId, projectId);
      if (script && script.parseState) {
        return script.parseState;
      }
    } catch (e) {
      console.warn('[ScriptParser] Failed to load state:', e);
    }
    return null;
  }

  // Note: parseMetadataOnly method has been removed in v2
  // Use parseScript with appropriate strategy instead
  // Note: parseStage method has been removed in v2
  // All parsing now goes through parseScript with automatic strategy selection
}

// Export singleton instance creator
export function createScriptParser(
  apiKey: string,
  apiUrl?: string,
  model?: string,
  provider?: string,
  config?: Partial<ScriptParserConfig>
): ScriptParser {
  return new ScriptParser(apiKey, apiUrl, model, provider, config);
}

// Export helper classes for testing
export { ConcurrencyLimiter, ParseCache };
