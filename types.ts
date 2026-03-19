// Domain Types

export enum AssetType {
  CHARACTER = 'character',
  SCENE = 'scene',
  ITEM = 'item',
  SHOT = 'shot',
  VIDEO_SEGMENT = 'video_segment',
  RESOURCES = 'resources',
  SCRIPT = 'script',
  IMAGE = 'image',
  VIDEO = 'video',
  VIDEO_AUDIO = 'video_audio',
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  // 审核相关状态
  NEEDS_REVIEW = 'needs_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  IN_REVIEW = 'in_review',
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface Asset {
  id: string;
  projectId: string;
  scriptId?: string; // 关联剧本ID，用于区分不同剧本的角色
  type: AssetType;
  name: string;
  prompt: string;
  negativePrompt?: string;
  filePath?: string;
  thumbnailPath?: string;
  metadata?: Record<string, any>;
  category?: 'generated' | 'imported';
  createdAt: number;
  updatedAt: number;
}

export interface GeneratedImage {
  id: string;
  path: string;
  prompt: string;
  userPrompt?: string; // Original user input prompt
  modelConfigId: string; // Internal configuration ID (e.g., 'volc-img-1')
  modelId: string; // API model identifier (e.g., 'doubao-seedream-4-5-251128')
  referenceImages: string[];
  metadata?: Record<string, any>;
  createdAt: number;
  // Resource Metadata
  width?: number;
  height?: number;
  size?: number; // in bytes
  duration?: number; // in seconds (for video)
}

// 角色视角类型（用于三视图）
export type CharacterViewAngle = 'front' | 'side' | 'back' | 'three-quarter';

// 角色三视图
export interface CharacterViews {
  front?: GeneratedImage; // 正面
  side?: GeneratedImage; // 侧面
  back?: GeneratedImage; // 背面
  threeQuarter?: GeneratedImage; // 四分之三侧面
}

export interface CharacterAsset extends Asset {
  gender?: 'male' | 'female' | 'unlimited';
  ageGroup?: 'childhood' | 'youth' | 'middle_aged' | 'elderly' | 'unknown';
  generatedImages?: GeneratedImage[];
  currentImageId?: string;
  // 三视图支持
  views?: CharacterViews;
  currentViewAngle?: CharacterViewAngle;
  // 一致性参考图（用于保持角色一致性）
  referenceImage?: GeneratedImage;
}

export enum ItemType {
  PROP = 'prop',
  CREATURE = 'creature',
  ANIMAL = 'animal',
  EFFECT = 'effect',
  REFERENCE = 'reference',
}

export interface GeneratedVideo {
  id: string;
  name?: string;
  path: string;
  prompt: string;
  userPrompt?: string;
  modelConfigId: string;
  modelId: string;
  referenceImages?: string[];
  metadata?: Record<string, any>;
  params?: any;
  createdAt: number;
  duration?: number;
  width?: number;
  height?: number;
}

export interface FragmentAsset extends Asset {
  videoName?: string;
  videos?: GeneratedVideo[];
  currentVideoId?: string;
  generatedImages?: GeneratedImage[];
}

export interface ItemAsset extends Asset {
  itemType: ItemType;
  scriptId?: string; // 关联剧本ID
  generatedImages?: GeneratedImage[];
  currentImageId?: string;
}

// 场景视角类型
export type SceneViewType = 'panorama' | 'wide' | 'detail' | 'aerial';

// 场景多视角
export interface SceneViews {
  panorama?: GeneratedImage; // 全景图
  wide?: GeneratedImage; // 广角图
  detail?: GeneratedImage[]; // 细节图数组
  aerial?: GeneratedImage; // 鸟瞰图
}

export interface SceneAsset extends Asset {
  scriptId?: string; // 关联剧本ID
  generatedImages?: GeneratedImage[];
  currentImageId?: string;
  // 多视角支持
  views?: SceneViews;
  currentViewType?: SceneViewType;
  // 场景关键元素（用于生成分镜时参考）
  keyElements?: string[];
}

export interface VideoSegment extends Asset {
  type: AssetType.VIDEO_SEGMENT;
  duration?: number;
  startImageId?: string;
  endImageId?: string;
  script?: string;
}

export interface Job {
  id: string;
  type: 'generate_image' | 'generate_video' | 'generate_keyframe_image';
  status: JobStatus;
  projectId: string;
  params: any;
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// --- New Settings Types ---

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'zh';
export type Environment = 'development' | 'testing' | 'production';
export type ModelType = 'image' | 'video' | 'llm' | 'audio';

export interface ModelCapabilities {
  supportsImageInput?: boolean;
  supportsVideoInput?: boolean;
  supportsAudioGeneration?: boolean;
  supportsTextToSpeech?: boolean;
  supportedLanguages?: string[];
  supportsReferenceImage?: boolean; // Generic reference image support
  supportsStartFrame?: boolean; // For video generation
  supportsEndFrame?: boolean; // For video generation
  supportedGenerationTypes?: ('text_to_video' | 'first_last_frame' | 'multi_ref')[]; // Supported generation modes
  maxReferenceImages?: number;
  maxBatchSize?: number; // Maximum number of images generated in one request
  appendCountToPrompt?: boolean; // Whether to append "，生成x张图" to the prompt
  requiresImageInput?: boolean; // For I2I or I2V specific models
  // Image generation specific capabilities
  supportedResolutions?: string[];
  defaultResolution?: string;
  minPixels?: number;
  maxPixels?: number;
  minAspectRatio?: number;
  maxAspectRatio?: number;
  supportedAspectRatios?: string[]; // Supported aspect ratios
  // LLM specific capabilities
  maxContextLength?: number;
  maxTokens?: number;
  supportsStreaming?: boolean;
  supportsFunctionCalling?: boolean;
  supportsJsonMode?: boolean;
  supportsVision?: boolean;
  supportsSystemPrompt?: boolean;
  // Generation type capabilities
  textToImage?: boolean;
  imageToImage?: boolean;
  textToVideo?: boolean;
  imageToVideo?: boolean;
  textToText?: boolean;
  // 模型能力标注
  strength?: string[]; // 模型擅长的场景
  bestFor?: string[]; // 模型的最佳使用场景
}

export interface ModelParameter {
  name: string; // API parameter name
  label: string; // UI display label
  type: 'string' | 'number' | 'boolean' | 'select';
  options?: { label: string; value: any }[]; // For select type
  defaultValue?: any;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  required?: boolean;
  visibilityCondition?: {
    // Defines when this parameter should be VISIBLE
    // All conditions must be met (AND logic)
    generationType?: ('text_to_video' | 'first_last_frame' | 'multi_ref')[]; // Visible only for these types
    hasStartImage?: boolean; // Visible if start image is present (true) or absent (false)
    hasEndImage?: boolean; // Visible if end image is present (true) or absent (false)
  };
  hiddenCondition?: {
    // Defines when this parameter should be HIDDEN
    // If ANY condition is met (OR logic within the object properties, but typically used for specific exclusion)
    // Actually, let's keep it simple: If this object matches context, HIDE the param.
    generationType?: ('text_to_video' | 'first_last_frame' | 'multi_ref')[];
    hasStartImage?: boolean;
    hasEndImage?: boolean;
  };
}

export interface ModelConfig {
  id: string; // For templates, this is the template ID; for instances, this is the instance ID
  name: string;
  provider: string;
  modelId: string;
  type: 'image' | 'video' | 'llm' | 'audio';
  capabilities: ModelCapabilities;
  parameters: ModelParameter[];
  templateId?: string; // Only instances have this, pointing back to the template
  apiKey?: string; // Instances must have this to work, templates don't
  isDefault?: boolean;
  apiUrl?: string;
  baseUrl?: string; // Base URL for API requests
  apiSecret?: string; // API secret for audio services
  enabled?: boolean; // Whether the model is enabled
  providerOptions?: any;
  // 新增：价格配置（可选，用于成本估算）
  costPer1KInput?: number; // 输入价格（美元/1K tokens）
  costPer1KOutput?: number; // 输出价格（美元/1K tokens）
}

/**
 * Persisted model instance data in settings.json
 */
export interface ModelInstance {
  id: string;
  templateId: string;
  name: string;
  apiKey: string;
  isDefault?: boolean;
}

export interface AppSettings {
  theme: ThemeMode;
  language: Language;
  models: ModelConfig[]; // Runtime settings use full config
  pollingInterval: number;
  useSandbox: boolean;
  maxConcurrentJobs?: number;
  // Duration Budget Configuration
  durationBudget?: {
    platform: 'douyin' | 'kuaishou' | 'bilibili' | 'premium';
    pace: 'fast' | 'normal' | 'slow';
    useDurationBudget: boolean;
    useDynamicDuration: boolean;
    useProductionPrompt: boolean;
    useShotQC: boolean;
    qcAutoAdjust: boolean;
  };
}

// --- Script Parsing Types ---

export interface Script {
  id: string;
  projectId: string;
  title: string;
  originalContent: string; // Original text content
  content: string; // Cleaned text content
  parseState: ScriptParseState;
  createdAt: number;
  updatedAt: number;
}

export type ParseStage =
  | 'idle'
  | 'metadata'
  | 'characters'
  | 'scenes'
  | 'refinement'
  | 'budget'
  | 'items'
  | 'shots'
  | 'completed'
  | 'error';

export interface ScriptItem {
  name: string;
  description: string;
  category: 'weapon' | 'tool' | 'jewelry' | 'document' | 'creature' | 'animal' | 'other';
  owner?: string;
  importance: 'major' | 'minor';
  visualPrompt: string;
  mappedAssetId?: string;
}

/**
 * Rule violation severity
 * @deprecated Use RuleViolation from './parsing/ShortDramaRules' instead
 */
export type RuleSeverity = 'critical' | 'error' | 'warning' | 'info';

/**
 * Rule violation interface (simplified version for types.ts)
 * For full version with ruleId and ruleName, use RuleViolation from './parsing/ShortDramaRules'
 */
export interface RuleViolation {
  rule?: string;
  message: string;
  severity: RuleSeverity;
  sceneName?: string;
}

/**
 * Quality report interface for script analysis
 */
export interface QualityReport {
  score: number;
  violations: RuleViolation[];
  suggestions: string[];
  /** 是否提取了情绪曲线 */
  emotionalArcExtracted?: boolean;
  /** 跳过的功能列表 */
  skippedFeatures?: string[];
}

export interface ScriptParseState {
  stage: ParseStage;
  progress: number; // 0-100
  metadata?: ScriptMetadata;
  characters?: ScriptCharacter[];
  scenes?: ScriptScene[];
  items?: ScriptItem[];
  shots?: Shot[];
  error?: string;
  currentChunkIndex?: number;
  totalChunks?: number;
  qualityReport?: QualityReport;
  performanceReport?: any; // Performance report from PerformanceMonitor
  refinementResult?: any; // Iterative refinement result
  durationBudget?: any; // Duration budget from BudgetPlanner
}

/**
 * Parse options for controlling parsing behavior
 */
export interface ParseOptions {
  skipGlobalContext?: boolean;
}

/**
 * 创作意图
 * Kmeng AI Animata 2.0 核心类型
 * 替代旧的平台模板配置，实现从"平台选择"到"创作意图"的转变
 */
export interface CreativeIntent {
  /** 影视风格：短剧/电影/纪录片/自定义 */
  filmStyle: 'short-drama' | 'film' | 'documentary' | 'custom';

  /** 叙事重点：用户希望表现的核心内容 */
  narrativeFocus: {
    protagonistArc: boolean; // 主角成长弧线
    emotionalCore: boolean; // 情感核心
    worldBuilding: boolean; // 世界观构建
    visualSpectacle: boolean; // 视觉奇观
    thematicDepth: boolean; // 主题深度
  };

  /** 情感基调 */
  emotionalTone: {
    primary: 'inspiring' | 'melancholic' | 'thrilling' | 'romantic' | 'mysterious';
    intensity: number; // 1-10
  };

  /** 视觉参考：参考影片、导演、视觉风格 */
  visualReferences?: string[];

  /** 创作备注：用户的特殊要求 */
  creativeNotes?: string;

  /** 目标平台（制作完成后适配，不是制作前限制） */
  targetPlatforms?: ('douyin' | 'kuaishou' | 'bilibili' | 'theatrical')[];
}

/**
 * Script Parser Configuration
 * 用于配置剧本解析器的行为
 *
 * 2.0版本重大变更：
 * - 移除所有基于字数的配置（durationBudgetConfig等）
 * - 新增creativeIntent创作意图配置
 * - 移除平台模板相关配置
 */
export interface ScriptParserConfig {
  // ... 原有配置
  /** 是否提取情绪曲线，默认true */
  extractEmotionalArc?: boolean;
  /** 文本长度阈值，低于此值跳过情绪曲线提取，默认800 */
  textLengthThreshold?: number;

  // ==================== 2.0版本新增 ====================

  /**
   * 创作意图 - 替代旧的平台模板配置
   * 用户的创作方向和风格偏好
   */
  creativeIntent?: CreativeIntent;

  // ==================== 2.0版本移除 ====================
  // 以下配置基于字数计算，与情节分析架构冲突，已移除

  /** @deprecated 2.0移除：基于字数的时长预算规划 */
  useDurationBudget?: boolean;

  /** @deprecated 2.0移除：动态时长调整 */
  useDynamicDuration?: boolean;

  /** @deprecated 2.0移除：生产级Prompt开关（现在默认启用） */
  useProductionPrompt?: boolean;

  /** @deprecated 2.0移除：基于字数的分镜质检 */
  useShotQC?: boolean;

  /** @deprecated 2.0移除：质检自动调整 */
  qcAutoAdjust?: boolean;

  /** @deprecated 2.0移除：质检容错率 */
  qcTolerance?: number;
}

/**
 * 故事结构定义
 * 用于描述剧本的三幕式/英雄之旅等经典结构
 */
export interface StoryStructure {
  /** 结构类型 */
  structureType: 'three_act' | 'hero_journey' | 'five_act' | 'other';
  /** 第一幕：设定（占25%） */
  act1: string;
  /** 第二幕上：对抗（占25%） */
  act2a: string;
  /** 第二幕下：低谷（占25%） */
  act2b: string;
  /** 第三幕：结局（占25%） */
  act3: string;
  /** 中点转折 */
  midpoint: string;
  /** 高潮 */
  climax: string;
}

/**
 * 视觉风格定义
 * 用于统一整个剧本的视觉呈现风格
 */
export interface VisualStyle {
  /** 美术指导风格（如：写实电影感、动漫风格、水墨国风等） */
  artDirection: string;
  /** 艺术风格标签 */
  artStyle: string;
  /** 风格详细描述（100字以内） */
  artStyleDescription: string;
  /** 主色调（3-5个十六进制颜色或颜色名称） */
  colorPalette: string[];
  /** 色彩情绪（如：温暖明亮、冷峻压抑、复古怀旧） */
  colorMood: string;
  /** 摄影风格（如：手持纪实、稳定器流畅、电影感构图） */
  cinematography: string;
  /** 光影风格（如：自然光、戏剧光、noir风格） */
  lightingStyle: string;
}

/**
 * 时代背景定义
 * 用于确保剧本的时代一致性
 */
export interface EraContext {
  /** 具体年代（如：2024年、1980年代、唐代） */
  era: string;
  /** 时代特征描述（100字以内） */
  eraDescription: string;
  /** 地理背景（如：北京、纽约、虚构城市） */
  location: string;
  /** 季节（如：春季、贯穿全篇的夏季） */
  season?: string;
  /** 主要时间段（如：白天、夜晚、黄昏） */
  timeOfDay?: string;
}

/**
 * 情绪曲线节点
 * 用于描述故事的情绪起伏和对应的视觉色调
 */
export interface EmotionalPoint {
  /** 情节点名称 */
  plotPoint: string;
  /** 主导情绪（如：喜悦、悲伤、紧张、愤怒） */
  emotion: string;
  /** 情绪强度（0-10） */
  intensity: number;
  /** 对应的视觉色调 */
  colorTone: string;
  /** 在故事中的位置百分比（0-100） */
  percentage: number;
}

/**
 * 一致性规则定义
 * 用于后续阶段的一致性校验
 */
export interface ConsistencyRules {
  /** 角色必须保持的特征（角色名 -> 特征列表） */
  characterTraits: Record<string, string[]>;
  /** 时代限制（如：不能出现手机、汽车等） */
  eraConstraints: string[];
  /** 风格限制（如：必须保持写实风格） */
  styleConstraints: string[];
  /** 禁止出现的元素 */
  forbiddenElements: string[];
}

/**
 * 剧本元数据
 * 包含剧本的基本信息和全局上下文
 */
export interface ScriptMetadata {
  // ===== 基础信息 =====
  /** 剧本标题 */
  title: string;
  /** 字数 */
  wordCount: number;
  /** 预估时长 */
  estimatedDuration: string;
  /** 角色数量 */
  characterCount: number;
  /** 角色名称列表 */
  characterNames: string[];
  /** 场景数量 */
  sceneCount: number;
  /** 场景名称列表 */
  sceneNames: string[];
  /** 章节数量 */
  chapterCount: number;
  /** 类型/题材 */
  genre: string;
  /** 基调 */
  tone: string;

  // ===== Phase 1 新增：故事核心层 =====
  /** 故事梗概（100-200字） */
  synopsis?: string;
  /** 一句话简介（30字以内） */
  logline?: string;
  /** 核心冲突 */
  coreConflict?: string;
  /** 主题思想列表 */
  theme?: string[];
  /** 主题思想列表（别名） */
  themes?: string[];

  // ===== Phase 1 新增：故事结构层 =====
  /** 故事结构（三幕式/英雄之旅等） */
  storyStructure?: StoryStructure;

  // ===== Phase 1 新增：视觉风格层 =====
  /** 视觉风格定义 */
  visualStyle?: VisualStyle;

  // ===== Phase 1 新增：时代背景层 =====
  /** 时代背景 */
  eraContext?: EraContext;

  // ===== Phase 1 新增：情绪曲线层 =====
  /** 情绪曲线 */
  emotionalArc?: EmotionalPoint[];

  // ===== Phase 1 新增：一致性规则层 =====
  /** 一致性规则（用于后续阶段校验） */
  consistencyRules?: ConsistencyRules;

  // ===== Phase 1 新增：参考层 =====
  /** 参考信息 */
  references?: {
    /** 参考影片 */
    films?: string[];
    /** 参考导演 */
    directors?: string[];
    /** 参考艺术风格 */
    artStyles?: string[];
  };

  // ===== 其他属性 =====
  /** 角色列表（详细） */
  characters?: ScriptCharacter[];
  /** 目标受众 */
  targetAudience?: string;
  /** 关键道具 */
  keyProps?: string[];
}

export interface ScriptCharacter {
  id?: string;
  name: string;
  description?: string;
  gender?: 'male' | 'female' | 'unknown';
  age?: string;
  identity?: string;
  background?: string;
  appearance: {
    height?: string;
    build?: string;
    face?: string;
    hair?: string;
    clothing?: string;
  };
  personality: string[];
  signatureItems: string[];
  emotionalArc: Array<{
    phase: string;
    emotion: string;
  }>;
  relationships: Array<{
    character: string;
    relation: string;
  }>;
  visualPrompt: string;
  mappedAssetId?: string; // Link to existing CharacterAsset
  role?: '主角' | '配角' | '反派';
}

export interface ScriptScene {
  id?: string;
  name: string;
  location?: string;
  locationType: 'indoor' | 'outdoor' | 'unknown';
  description: string;
  timeOfDay?: string;
  time?: string;
  season?: string;
  weather?: string;
  mood?: string;
  environment: {
    architecture?: string;
    furnishings?: string[];
    lighting?: string;
    colorTone?: string;
  };
  sceneFunction: string;
  visualPrompt: string;
  characters: string[];
  mappedAssetId?: string; // Link to existing SceneAsset
}

// 影视级景别标准
export type ShotType =
  | 'extreme_long' // 大远景
  | 'long' // 远景
  | 'full' // 全景
  | 'medium' // 中景
  | 'close_up' // 近景
  | 'extreme_close_up'; // 特写

// 影视级运镜技巧
export type CameraMovement =
  | 'static' // 静止
  | 'push' // 推
  | 'pull' // 拉
  | 'pan' // 摇
  | 'tilt' // 升降
  | 'track' // 跟
  | 'crane' //  crane
  | 'zoom_in' // 变焦推
  | 'zoom_out' // 变焦拉
  | 'dolly_in' // 移近
  | 'dolly_out'; // 移远

// 机位角度
export type CameraAngle =
  | 'eye_level' // 平视
  | 'high_angle' // 俯拍
  | 'low_angle' // 仰拍
  | 'dutch_angle' // 倾斜
  | 'overhead' // 顶拍
  | 'bird_eye'; // 鸟瞰

// 分镜类型（用于区分静态/动态）
export type ShotContentType =
  | 'static' // 静态（对话/环境）→ 生成图片
  | 'dynamic-simple' // 简单动态（走路/转身）→ 生成视频（2关键帧）
  | 'dynamic-complex'; // 复杂动态（打斗/特效）→ 生成视频（3关键帧）

// 分镜层级
export type ShotLayer =
  | 'key' // 关键分镜（必须生成）
  | 'optional'; // 可选分镜（按需生成）

// 影视风格（影响分镜密度和表现方式）
export type FilmStyle =
  | 'short-drama' // 短剧风格：快节奏、高密度
  | 'film' // 电影风格：慢节奏、重意境
  | 'custom'; // 自定义：用户指定密度

// 影视级分镜定义
export interface GeneratedAudio {
  id: string;
  name?: string;
  path: string;
  prompt: string;
  userPrompt?: string;
  modelConfigId: string;
  modelId: string;
  metadata?: Record<string, any>;
  createdAt: number;
  duration?: number;
  type: 'dialogue' | 'sound' | 'music';
}

export interface Shot {
  // 基础信息
  id: string;
  sequence: number;
  sceneName: string;
  sceneId?: string;

  // 影视级镜号（如：SC01-01A）
  shotNumber?: string;

  // 景别与运镜（影视标准）
  shotType: ShotType;
  cameraMovement: CameraMovement;
  cameraAngle?: CameraAngle;

  // 视觉描述（影视级）
  description: string;
  visualDescription?: {
    composition?: string; // 构图
    lighting?: string; // 光影
    colorPalette?: string; // 色调
    characterPositions?: {
      // 角色位置
      characterId: string;
      position: string;
      action: string;
      expression: string;
    }[];
  };

  // 音频
  dialogue?: string;
  sound?: string;
  music?: string;

  // 时长（参考值，后期可调）
  duration: number;

  // 角色列表（名称）
  characters: string[];

  // 资产关联（关键！）
  assets: {
    characterIds: string[]; // 关联角色资产ID
    sceneId: string; // 关联场景资产ID
    propIds?: string[]; // 关联道具资产ID
  };

  // 分镜类型与层级
  contentType: ShotContentType;
  type?: ShotContentType; // 别名，兼容旧代码
  layer: ShotLayer;

  // 影视风格（该分镜采用的风格）
  style?: FilmStyle;

  // 情绪氛围
  mood?: string;

  // 叙事节点与连贯性
  narrativeNode?: string;
  preShotId?: string;
  nextShotId?: string;

  // 生成状态
  mappedFragmentId?: string; // 关联视频片段
  keyframes?: Keyframe[]; // 关键帧列表
  generatedImages?: string[]; // 已生成图片ID
  generatedVideo?: string; // 已生成视频ID
  generatedAudio?: {
    dialogue?: string; // 对话音频路径
    sound?: string; // 音效路径
    music?: string; // 音乐路径
  };
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

// 时间轴轨道类型
export type TrackType = 'video' | 'audio' | 'subtitle';

// 时间轴轨道
export interface TimelineTrack {
  id: string;
  type: TrackType;
  name: string;
  clips: TimelineClip[];
  isLocked?: boolean;
  isMuted?: boolean;
  isHidden?: boolean;
}

// 时间轴片段
export interface TimelineClip {
  id: string;
  shotId: string;
  name: string;
  startTime: number; // 在时间轴上的开始时间（秒）
  endTime: number; // 在时间轴上的结束时间（秒）
  duration: number; // 片段时长（秒）
  sourcePath: string; // 源文件路径
  thumbnailPath?: string; // 缩略图路径
  transition?: {
    type: 'cut' | 'dissolve' | 'fade' | 'wipe';
    duration: number;
  };
  // 音频属性
  audioProperties?: {
    volume: number; // 音量 0-1
    fadeIn: number; // 淡入时长（秒）
    fadeOut: number; // 淡出时长（秒）
  };
  // 轨道类型
  trackType: 'video' | 'audio';
}

// 时间轴项目
export interface Timeline {
  id: string;
  projectId: string;
  scriptId: string;
  name: string;
  tracks: TimelineTrack[];
  totalDuration: number;
  resolution: string;
  frameRate: number;
  createdAt: number;
  updatedAt: number;
}

// 导出配置
export interface ExportConfig {
  format: 'mp4' | 'mov' | 'prores' | 'xml' | 'fcpxml';
  resolution: '720p' | '1080p' | '2k' | '4k';
  frameRate: 24 | 25 | 30 | 60;
  codec?: string;
  quality?: 'low' | 'medium' | 'high' | 'lossless';
  includeAudio: boolean;
  includeSubtitles?: boolean;
}

// 关键帧类型（用于视频生成）
export type FrameType = 'start' | 'middle' | 'end';

// 关键帧
export interface Keyframe {
  id: string;
  sequence: number; // 在分镜内的序号（1,2,3,4）
  frameType: FrameType; // 关键帧类型：首帧/中间帧/尾帧
  description: string; // 静态画面描述
  prompt: string; // 图生图提示词
  duration: number; // 该关键帧时长（秒）
  references: {
    character?: {
      id: string; // 角色资产ID
      name: string; // 角色名
    };
    scene?: {
      id: string; // 场景资产ID
      name: string; // 场景名
    };
  };
  generatedImage?: GeneratedImage; // 生成的关键帧图片（兼容旧数据）
  generatedImages?: GeneratedImage[]; // 生成的关键帧图片历史记录
  currentImageId?: string; // 当前选中的图片ID
  videoUrl?: string; // 生成的视频URL
  videoStatus?: 'pending' | 'generating' | 'completed' | 'failed'; // 视频生成状态
  status: 'pending' | 'generating' | 'completed' | 'failed';
}
