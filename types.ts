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
  VIDEO = 'video'
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
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
  scriptId?: string;  // 关联剧本ID，用于区分不同剧本的角色
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

export interface CharacterAsset extends Asset {
  gender?: 'male' | 'female' | 'unlimited';
  ageGroup?: 'childhood' | 'youth' | 'middle_aged' | 'elderly' | 'unknown';
  generatedImages?: GeneratedImage[];
  currentImageId?: string;
}

export enum ItemType {
  PROP = 'prop',
  CREATURE = 'creature',
  ANIMAL = 'animal',
  EFFECT = 'effect',
  REFERENCE = 'reference'
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
  scriptId?: string;  // 关联剧本ID
  generatedImages?: GeneratedImage[];
  currentImageId?: string;
}

export interface SceneAsset extends Asset {
  scriptId?: string;  // 关联剧本ID
  generatedImages?: GeneratedImage[];
  currentImageId?: string;
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

export interface ModelCapabilities {
  supportsImageInput?: boolean;
  supportsVideoInput?: boolean;
  supportsAudioGeneration?: boolean;
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
  // LLM specific capabilities
  maxContextLength?: number;
  supportsStreaming?: boolean;
  supportsFunctionCalling?: boolean;
  supportsJsonMode?: boolean;
  supportsVision?: boolean;
  supportsSystemPrompt?: boolean;
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
  id: string;          // For templates, this is the template ID; for instances, this is the instance ID
  name: string;
  provider: string;
  modelId: string;
  type: 'image' | 'video' | 'llm';
  capabilities: ModelCapabilities;
  parameters: ModelParameter[];
  templateId?: string; // Only instances have this, pointing back to the template
  apiKey?: string;     // Instances must have this to work, templates don't
  isDefault?: boolean;
  apiUrl?: string;
  providerOptions?: any;
  // 新增：价格配置（可选，用于成本估算）
  costPer1KInput?: number;   // 输入价格（美元/1K tokens）
  costPer1KOutput?: number;  // 输出价格（美元/1K tokens）
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
  content: string; // Original text content
  parseState: ScriptParseState;
  createdAt: number;
  updatedAt: number;
}

export type ParseStage = 'idle' | 'metadata' | 'characters' | 'scenes' | 'refinement' | 'budget' | 'items' | 'shots' | 'completed' | 'error';

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
 */
export type RuleSeverity = 'critical' | 'warning' | 'info';

/**
 * Rule violation interface
 */
export interface RuleViolation {
  rule: string;
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
 * Script Parser Configuration
 * 用于配置剧本解析器的行为
 */
export interface ScriptParserConfig {
  // ... 原有配置
  /** 是否提取情绪曲线，默认true */
  extractEmotionalArc?: boolean;
  /** 文本长度阈值，低于此值跳过情绪曲线提取，默认800 */
  textLengthThreshold?: number;
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
}

export interface ScriptCharacter {
  id?: string;
  name: string;
  description?: string;
  gender?: 'male' | 'female' | 'unknown';
  age?: string;
  identity?: string;
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
}

export interface ScriptScene {
  id?: string;
  name: string;
  locationType: 'indoor' | 'outdoor' | 'unknown';
  description: string;
  timeOfDay?: string;
  season?: string;
  weather?: string;
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

export type ShotType = 'extreme_long' | 'long' | 'full' | 'medium' | 'close_up' | 'extreme_close_up';
export type CameraMovement = 'static' | 'push' | 'pull' | 'pan' | 'tilt' | 'track' | 'crane';

export interface Shot {
  id: string;
  sequence: number;
  sceneName: string;
  sceneId?: string;
  shotType: ShotType;
  cameraMovement: CameraMovement;
  description: string;
  type?: ShotType;
  dialogue?: string;
  sound?: string;
  duration: number;
  characters: string[];
  mappedFragmentId?: string; // Link to existing FragmentAsset
  keyframes?: Keyframe[]; // 关键帧列表
}

// 关键帧
export interface Keyframe {
  id: string;
  sequence: number; // 在分镜内的序号（1,2,3,4）
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
  status: 'pending' | 'generating' | 'completed' | 'failed';
}
