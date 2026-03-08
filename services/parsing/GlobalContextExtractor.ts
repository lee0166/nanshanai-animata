/**
 * GlobalContextExtractor - 全局上下文提取服务
 * 
 * 职责：在metadata阶段提取全局上下文信息，为后续所有解析阶段提供统一的背景知识
 * 
 * 提取的上下文包括：
 * 1. 故事核心（梗概、冲突、主题）
 * 2. 故事结构（三幕式/英雄之旅）
 * 3. 视觉风格（美术指导、色彩方案）
 * 4. 时代背景（年代、地点）
 * 5. 情绪曲线（情绪起伏图谱）
 * 6. 一致性规则（跨阶段校验规则）
 * 
 * @version 1.0.0
 */

import { 
  llmProvider 
} from '../ai/providers/LLMProvider';
import { JSONRepair } from './JSONRepair';
import type { ModelConfig } from '../../types';
import type { 
  ScriptMetadata, 
  StoryStructure, 
  VisualStyle, 
  EraContext, 
  EmotionalPoint, 
  ConsistencyRules 
} from '../../types';

/**
 * 全局上下文数据结构
 */
export interface GlobalContext {
  /** 故事核心信息 */
  story: StoryContext;
  /** 视觉风格定义 */
  visual: VisualContext;
  /** 时代背景信息 */
  era: EraContext;
  /** 情绪曲线 */
  emotional: EmotionalContext;
  /** 一致性规则 */
  rules: ConsistencyRules;
}

/**
 * 故事上下文
 */
export interface StoryContext {
  /** 故事梗概 */
  synopsis: string;
  /** 一句话简介 */
  logline: string;
  /** 核心冲突 */
  coreConflict: string;
  /** 主题思想列表 */
  themes: string[];
  /** 故事结构 */
  structure: StoryStructure;
}

/**
 * 视觉上下文
 */
export interface VisualContext {
  /** 美术指导风格 */
  artDirection: string;
  /** 艺术风格标签 */
  artStyle: string;
  /** 主色调 */
  colorPalette: string[];
  /** 色彩情绪 */
  colorMood: string;
  /** 摄影风格 */
  cinematography: string;
  /** 光影风格 */
  lightingStyle: string;
  /** 参考影片/导演 */
  references: string[];
}

/**
 * 情绪上下文
 */
export interface EmotionalContext {
  /** 情绪曲线节点列表 */
  arc: EmotionalPoint[];
  /** 整体情绪基调 */
  overallMood: string;
}

/**
 * 全局上下文提取器配置
 */
export interface GlobalContextExtractorConfig {
  /** 是否提取情绪曲线，默认true */
  extractEmotionalArc?: boolean;
  /** 文本长度阈值，低于此值跳过情绪曲线提取，默认800 */
  textLengthThreshold?: number;
}

/**
 * 全局上下文提取器
 */
export class GlobalContextExtractor {
  private modelConfig: ModelConfig;
  private config: GlobalContextExtractorConfig;

  /**
   * 构造函数
   * @param config - 模型配置
   * @param extractorConfig - 提取器配置（可选）
   */
  constructor(config: ModelConfig, extractorConfig?: GlobalContextExtractorConfig) {
    this.modelConfig = config;
    this.config = {
      extractEmotionalArc: true,
      textLengthThreshold: 800,
      ...extractorConfig
    };
  }

  /**
   * 更新提取器配置
   * @param config - 部分配置更新
   */
  updateConfig(config: Partial<GlobalContextExtractorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   * @returns 当前配置
   */
  getConfig(): GlobalContextExtractorConfig {
    return { ...this.config };
  }

  /**
   * 安全地获取字符串值
   * 处理LLM返回的各种类型（字符串、数组、对象）
   * 
   * @param value - 任意类型的值
   * @param defaultValue - 默认值
   * @returns 字符串值
   */
  private safeString(value: unknown, defaultValue: string = ''): string {
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value) && value.length > 0) {
      // 如果是数组，取第一个元素
      return this.safeString(value[0], defaultValue);
    }
    if (typeof value === 'object' && value !== null) {
      // 如果是对象，尝试获取常见的字符串字段
      const obj = value as Record<string, unknown>;
      if (typeof obj.name === 'string') return obj.name;
      if (typeof obj.value === 'string') return obj.value;
      if (typeof obj.label === 'string') return obj.label;
      if (typeof obj.text === 'string') return obj.text;
    }
    return defaultValue;
  }

  /**
   * 提取全局上下文
   * 
   * 这是主要入口方法，在metadata阶段调用，为后续所有阶段提供上下文
   * 
   * V2 优化：使用单次 LLM 调用替代原来的 3 次调用，减少 60-70% 的耗时
   * 如果单次调用失败，自动回退到原来的并行提取方式
   * 
   * @param content - 剧本/小说文本内容
   * @returns 全局上下文对象
   */
  async extract(content: string): Promise<GlobalContext> {
    console.log('[GlobalContextExtractor] Starting optimized extraction (single LLM call)...');
    const startTime = Date.now();

    try {
      // V2: 尝试使用单次调用提取所有上下文
      const unifiedContext = await this.extractUnifiedContext(content);
      
      const duration = Date.now() - startTime;
      console.log(`[GlobalContextExtractor] Unified extraction completed in ${duration}ms`);

      // 根据配置决定是否提取情绪曲线
      const shouldExtractEmotional = this.config.extractEmotionalArc !== false 
        && content.length >= (this.config.textLengthThreshold || 800);

      let emotionalContext: EmotionalContext;
      if (shouldExtractEmotional) {
        console.log(`[GlobalContextExtractor] Extracting emotional arc (content length: ${content.length} >= threshold: ${this.config.textLengthThreshold})`);
        emotionalContext = await this.extractEmotionalArc(content, unifiedContext.story);
      } else {
        console.log(`[GlobalContextExtractor] Skipping emotional arc extraction (content length: ${content.length}, threshold: ${this.config.textLengthThreshold}, enabled: ${this.config.extractEmotionalArc})`);
        emotionalContext = {
          overallMood: '',
          arc: []
        };
      }

      // 生成一致性规则
      const rules = this.generateConsistencyRules(
        unifiedContext.story, 
        unifiedContext.visual, 
        unifiedContext.era
      );

      return {
        story: unifiedContext.story,
        visual: unifiedContext.visual,
        era: unifiedContext.era,
        emotional: emotionalContext,
        rules,
      };
    } catch (error) {
      console.warn('[GlobalContextExtractor] Unified extraction failed, falling back to parallel extraction:', error);
      
      // 回退到原来的并行提取方式
      return this.extractParallel(content, startTime);
    }
  }

  /**
   * V2 优化：单次 LLM 调用提取所有上下文
   * 将 story + visual + era 合并为一次调用，减少网络往返
   */
  private async extractUnifiedContext(content: string): Promise<{
    story: StoryContext;
    visual: VisualContext;
    era: EraContext;
  }> {
    const prompt = `
请深入分析以下剧本/小说，一次性提取故事核心、视觉风格和时代背景信息。

【剧本内容】
${content.substring(0, 6000)}

请提取以下信息并以JSON格式返回：
{
  "story": {
    "synopsis": "故事梗概（100-150字）",
    "logline": "一句话简介（30字以内）",
    "coreConflict": "核心冲突",
    "themes": ["主题1", "主题2"],
    "structure": {
      "structureType": "three_act|hero_journey|other",
      "act1": "第一幕设定（30字以内）",
      "act2a": "第二幕上对抗（30字以内）",
      "act2b": "第二幕下低谷（30字以内）",
      "act3": "第三幕结局（30字以内）",
      "midpoint": "中点转折（30字以内）",
      "climax": "高潮（30字以内）"
    }
  },
  "visual": {
    "artDirection": "美术指导风格（如：写实电影感、动漫风格、水墨国风）",
    "artStyle": "艺术风格标签",
    "artStyleDescription": "风格描述（50字以内）",
    "colorPalette": ["#颜色1", "#颜色2", "#颜色3"],
    "colorMood": "色彩情绪",
    "cinematography": "摄影风格",
    "lightingStyle": "光影风格",
    "referenceFilms": ["参考影片1"],
    "referenceDirectors": ["参考导演1"]
  },
  "era": {
    "era": "具体年代（如：2024年、唐代）",
    "eraDescription": "时代特征（50字以内）",
    "location": "地理背景",
    "season": "季节",
    "timeOfDay": "主要时间段"
  }
}

注意：
1. 必须返回有效的JSON格式
2. 所有字段都必须有值
3. 字数限制严格遵守，保持简洁
`;

    const result = await llmProvider.generateText(
      prompt,
      this.modelConfig,
      '你是一个专业的剧本分析助手，擅长从小说/剧本中提取结构化信息。请严格按照要求的JSON格式输出。'
    );
    
    if (!result.success || !result.data) {
      throw new Error('Failed to extract unified context: ' + result.error);
    }

    // 解析JSON响应
    const repairResult = JSONRepair.repairAndParse<{
      story: {
        synopsis: string;
        logline: string;
        coreConflict: string;
        themes: string[];
        structure: StoryStructure;
      };
      visual: {
        artDirection: string;
        artStyle: string;
        artStyleDescription?: string;
        colorPalette: string[];
        colorMood: string;
        cinematography: string;
        lightingStyle: string;
        referenceFilms?: string[];
        referenceDirectors?: string[];
        references?: string[];
      };
      era: {
        era: string;
        eraDescription: string;
        location: string;
        season?: string;
        timeOfDay?: string;
      };
    }>(result.data);

    if (!repairResult.success || !repairResult.data) {
      throw new Error('Failed to parse unified context: ' + repairResult.error);
    }

    const parsed = repairResult.data;

    // 处理 visual references 兼容
    let referenceFilms: string[] = parsed.visual.referenceFilms || [];
    let referenceDirectors: string[] = parsed.visual.referenceDirectors || [];
    
    if (parsed.visual.references && parsed.visual.references.length > 0) {
      referenceFilms = parsed.visual.references.filter(r => !r.includes('导演'));
      referenceDirectors = parsed.visual.references.filter(r => r.includes('导演'));
    }

    return {
      story: {
        synopsis: this.safeString(parsed.story.synopsis),
        logline: this.safeString(parsed.story.logline),
        coreConflict: this.safeString(parsed.story.coreConflict),
        themes: Array.isArray(parsed.story.themes) ? parsed.story.themes.filter((t): t is string => typeof t === 'string') : [],
        structure: parsed.story.structure || this.getDefaultStoryStructure(),
      },
      visual: {
        artDirection: this.safeString(parsed.visual.artDirection),
        artStyle: this.safeString(parsed.visual.artStyle),
        colorPalette: Array.isArray(parsed.visual.colorPalette) 
          ? parsed.visual.colorPalette.filter((c): c is string => typeof c === 'string') 
          : [],
        colorMood: this.safeString(parsed.visual.colorMood),
        cinematography: this.safeString(parsed.visual.cinematography),
        lightingStyle: this.safeString(parsed.visual.lightingStyle),
        references: [...referenceFilms, ...referenceDirectors],
      },
      era: {
        era: this.safeString(parsed.era.era, '现代'),
        eraDescription: this.safeString(parsed.era.eraDescription),
        location: this.safeString(parsed.era.location),
        season: this.safeString(parsed.era.season),
        timeOfDay: this.safeString(parsed.era.timeOfDay),
      },
    };
  }

  /**
   * 回退方案：使用并行提取（原来的实现）
   */
  private async extractParallel(content: string, startTime: number): Promise<GlobalContext> {
    console.log('[GlobalContextExtractor] Falling back to parallel extraction...');

    // 1. 提取故事核心信息
    const storyContext = await this.extractStoryContext(content);

    // 2. 提取视觉风格信息
    const visualContext = await this.extractVisualContext(content, storyContext);

    // 3. 提取时代背景信息
    const eraContext = await this.extractEraContext(content);

    // 4. 根据配置决定是否构建情绪曲线
    const shouldExtractEmotional = this.config.extractEmotionalArc !== false 
      && content.length >= (this.config.textLengthThreshold || 800);
    
    let emotionalContext: EmotionalContext;
    if (shouldExtractEmotional) {
      console.log(`[GlobalContextExtractor] Parallel extraction: extracting emotional arc (content length: ${content.length})`);
      emotionalContext = await this.extractEmotionalArc(content, storyContext);
    } else {
      console.log(`[GlobalContextExtractor] Parallel extraction: skipping emotional arc (content length: ${content.length})`);
      emotionalContext = {
        overallMood: '',
        arc: []
      };
    }

    // 5. 生成一致性规则
    const rules = this.generateConsistencyRules(storyContext, visualContext, eraContext);

    const duration = Date.now() - startTime;
    console.log(`[GlobalContextExtractor] Parallel extraction completed in ${duration}ms`);

    return {
      story: storyContext,
      visual: visualContext,
      era: eraContext,
      emotional: emotionalContext,
      rules,
    };
  }

  /**
   * 提取故事上下文
   * 
   * 分析剧本的核心故事要素：梗概、冲突、主题、结构
   * 
   * @param content - 剧本内容
   * @returns 故事上下文
   */
  private async extractStoryContext(content: string): Promise<StoryContext> {
    const prompt = `
请深入分析以下剧本/小说的故事核心：

【剧本内容】
${content.substring(0, 8000)}

请提取以下信息并以JSON格式返回：
{
  "synopsis": "故事梗概（100-200字，包含开端-发展-高潮-结局）",
  "logline": "一句话简介（30字以内，概括核心卖点）",
  "coreConflict": "核心冲突（主角面临的主要矛盾）",
  "themes": ["主题1", "主题2", "主题3"],
  "structure": {
    "structureType": "three_act|hero_journey|five_act|other",
    "act1": "第一幕设定（50字以内）",
    "act2a": "第二幕上对抗（50字以内）",
    "act2b": "第二幕下低谷（50字以内）",
    "act3": "第三幕结局（50字以内）",
    "midpoint": "中点转折（50字以内）",
    "climax": "高潮（50字以内）"
  }
}

注意：
1. 必须返回有效的JSON格式
2. 所有字段都必须有值
3. 字数限制严格遵守
`;

    try {
      const result = await llmProvider.generateText(
        prompt,
        this.modelConfig,
        '你是一个专业的剧本分析助手，擅长从小说/剧本中提取结构化信息。请严格按照要求的JSON格式输出。'
      );
      
      if (!result.success || !result.data) {
        throw new Error('Failed to extract story context: ' + result.error);
      }

      // 使用 JSONRepair 解析JSON响应（处理 markdown 代码块）
      const repairResult = JSONRepair.repairAndParse<{
        synopsis: string;
        logline: string;
        coreConflict: string;
        themes: string[];
        structure: StoryStructure;
      }>(result.data);

      if (!repairResult.success || !repairResult.data) {
        console.error('[GlobalContextExtractor] Failed to parse story context:', repairResult.error);
        throw new Error('Failed to parse story context: ' + repairResult.error);
      }

      const parsed = repairResult.data;
      
      return {
        synopsis: this.safeString(parsed.synopsis),
        logline: this.safeString(parsed.logline),
        coreConflict: this.safeString(parsed.coreConflict),
        themes: Array.isArray(parsed.themes) 
          ? parsed.themes.filter((t): t is string => typeof t === 'string') 
          : [],
        structure: parsed.structure || this.getDefaultStoryStructure(),
      };
    } catch (error) {
      console.error('Error extracting story context:', error);
      // 返回默认值
      return {
        synopsis: '',
        logline: '',
        coreConflict: '',
        themes: [],
        structure: this.getDefaultStoryStructure(),
      };
    }
  }

  /**
   * 提取视觉上下文
   * 
   * 基于故事信息分析视觉风格
   * 
   * @param content - 剧本内容
   * @param storyContext - 故事上下文
   * @returns 视觉上下文
   */
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

请定义视觉风格并以JSON格式返回：
{
  "artDirection": "美术指导风格（如：写实电影感、动漫风格、水墨国风等）",
  "artStyle": "艺术风格标签",
  "artStyleDescription": "风格详细描述（100字以内）",
  "colorPalette": ["#颜色1", "#颜色2", "#颜色3", "#颜色4", "#颜色5"],
  "colorMood": "色彩情绪（如：温暖明亮、冷峻压抑、复古怀旧）",
  "cinematography": "摄影风格（如：手持纪实、稳定器流畅、电影感构图）",
  "lightingStyle": "光影风格（如：自然光、戏剧光、noir风格）",
  "referenceFilms": ["参考影片1", "参考影片2"],
  "referenceDirectors": ["参考导演1", "参考导演2"]
}

注意：
1. 必须返回有效的JSON格式
2. colorPalette提供3-5个十六进制颜色代码
3. referenceFilms提供1-3个参考影片名称
4. referenceDirectors提供1-3个参考导演名称
`;

    try {
      const result = await llmProvider.generateText(
        prompt,
        this.modelConfig,
        '你是一个专业的视觉风格分析助手，擅长从剧本中提取视觉和美术风格信息。请严格按照要求的JSON格式输出。'
      );
      
      if (!result.success || !result.data) {
        throw new Error('Failed to extract visual context: ' + result.error);
      }

      // 使用 JSONRepair 解析JSON响应（处理 markdown 代码块）
      const repairResult = JSONRepair.repairAndParse<{
        artDirection: string;
        artStyle: string;
        artStyleDescription?: string;
        colorPalette: string[];
        colorMood: string;
        cinematography: string;
        lightingStyle: string;
        references?: string[];
        referenceFilms?: string[];
        referenceDirectors?: string[];
      }>(result.data);

      if (!repairResult.success || !repairResult.data) {
        console.error('[GlobalContextExtractor] Failed to parse visual context:', repairResult.error);
        throw new Error('Failed to parse visual context: ' + repairResult.error);
      }

      const parsed = repairResult.data;
      
      // 兼容旧格式：如果存在 references 字段，从中提取影片和导演
      let referenceFilms: string[] = parsed.referenceFilms || [];
      let referenceDirectors: string[] = parsed.referenceDirectors || [];
      
      if (parsed.references && parsed.references.length > 0) {
        referenceFilms = parsed.references.filter(r => !r.includes('导演'));
        referenceDirectors = parsed.references.filter(r => r.includes('导演'));
      }
      
      return {
        artDirection: this.safeString(parsed.artDirection),
        artStyle: this.safeString(parsed.artStyle),
        colorPalette: Array.isArray(parsed.colorPalette) 
          ? parsed.colorPalette.filter((c): c is string => typeof c === 'string') 
          : [],
        colorMood: this.safeString(parsed.colorMood),
        cinematography: this.safeString(parsed.cinematography),
        lightingStyle: this.safeString(parsed.lightingStyle),
        references: [...referenceFilms, ...referenceDirectors],
      };
    } catch (error) {
      console.error('Error extracting visual context:', error);
      return {
        artDirection: '',
        artStyle: '',
        colorPalette: [],
        colorMood: '',
        cinematography: '',
        lightingStyle: '',
        references: [],
      };
    }
  }

  /**
   * 提取时代背景
   * 
   * 分析剧本的时代和地理背景
   * 
   * @param content - 剧本内容
   * @returns 时代背景
   */
  private async extractEraContext(content: string): Promise<EraContext> {
    const prompt = `
请分析以下剧本的时代背景：

【剧本内容】
${content.substring(0, 5000)}

请提取时代背景信息并以JSON格式返回：
{
  "era": "具体年代（如：2024年、1980年代、唐代、未来）",
  "eraDescription": "时代特征描述（100字以内，包括社会背景、科技水平、文化氛围等）",
  "location": "地理背景（如：北京、纽约、虚构城市、外太空）",
  "season": "季节（如：春季、夏季、贯穿全篇的秋季）",
  "timeOfDay": "主要时间段（如：白天、夜晚、黄昏、混合）"
}

注意：
1. 必须返回有效的JSON格式
2. era和location为必填字段
3. season和timeOfDay可选
`;

    try {
      const result = await llmProvider.generateText(
        prompt,
        this.modelConfig,
        '你是一个专业的时代背景分析助手，擅长从剧本中提取时代和地理背景信息。请严格按照要求的JSON格式输出。'
      );
      
      if (!result.success || !result.data) {
        throw new Error('Failed to extract era context: ' + result.error);
      }

      // 使用 JSONRepair 解析JSON响应（处理 markdown 代码块）
      const repairResult = JSONRepair.repairAndParse<{
        era: string;
        eraDescription: string;
        location: string;
        season?: string;
        timeOfDay?: string;
      }>(result.data);

      if (!repairResult.success || !repairResult.data) {
        console.error('[GlobalContextExtractor] Failed to parse era context:', repairResult.error);
        throw new Error('Failed to parse era context: ' + repairResult.error);
      }

      const parsed = repairResult.data;
      
      return {
        era: this.safeString(parsed.era, '现代'),
        eraDescription: this.safeString(parsed.eraDescription),
        location: this.safeString(parsed.location),
        season: this.safeString(parsed.season),
        timeOfDay: this.safeString(parsed.timeOfDay),
      };
    } catch (error) {
      console.error('Error extracting era context:', error);
      return {
        era: '现代',
        eraDescription: '',
        location: '',
      };
    }
  }

  /**
   * 提取情绪曲线
   * 
   * 分析剧本的情绪起伏，构建情绪曲线图谱
   * 
   * @param content - 剧本内容
   * @param storyContext - 故事上下文
   * @returns 情绪上下文
   */
  private async extractEmotionalArc(
    content: string,
    storyContext: StoryContext
  ): Promise<EmotionalContext> {
    const prompt = `
基于以下故事信息，分析情绪曲线：

【故事梗概】
${storyContext.synopsis}

【故事结构】
第一幕：${storyContext.structure.act1}
第二幕上：${storyContext.structure.act2a}
第二幕下：${storyContext.structure.act2b}
第三幕：${storyContext.structure.act3}
中点：${storyContext.structure.midpoint}
高潮：${storyContext.structure.climax}

【剧本片段】
${content.substring(0, 5000)}

请分析情绪曲线并以JSON格式返回：
{
  "overallMood": "整体情绪基调（如：励志向上、悬疑紧张、温馨治愈）",
  "arc": [
    {
      "plotPoint": "情节点名称（如：开场、催化剂、中点、高潮、结局）",
      "emotion": "主导情绪（如：平静、紧张、喜悦、悲伤、愤怒）",
      "intensity": 5,
      "colorTone": "对应色调（如：明亮、阴暗、暖色、冷色）",
      "percentage": 10
    }
  ]
}

注意：
1. 必须返回有效的JSON格式
2. arc数组包含5-10个情节点
3. intensity为0-10的数字
4. percentage为0-100的数字，表示在故事中的位置
`;

    try {
      const result = await llmProvider.generateText(
        prompt,
        this.modelConfig,
        '你是一个专业的情绪分析助手，擅长从剧本中提取情绪曲线和情感变化信息。请严格按照要求的JSON格式输出。'
      );
      
      if (!result.success || !result.data) {
        throw new Error('Failed to extract emotional arc: ' + result.error);
      }

      // 使用 JSONRepair 解析JSON响应（处理 markdown 代码块）
      const repairResult = JSONRepair.repairAndParse<{
        overallMood: string;
        arc: Array<{
          plotPoint: string;
          emotion: string;
          intensity: number;
          colorTone: string;
          percentage: number;
        }>;
      }>(result.data);

      if (!repairResult.success || !repairResult.data) {
        console.error('[GlobalContextExtractor] Failed to parse emotional arc:', repairResult.error);
        throw new Error('Failed to parse emotional arc: ' + repairResult.error);
      }

      const parsed = repairResult.data;
      
      return {
        overallMood: parsed.overallMood || '',
        arc: parsed.arc || [],
      };
    } catch (error) {
      console.error('Error extracting emotional arc:', error);
      return {
        overallMood: '',
        arc: [],
      };
    }
  }

  /**
   * 生成一致性规则
   * 
   * 基于提取的上下文生成跨阶段一致性校验规则
   * 
   * @param storyContext - 故事上下文
   * @param visualContext - 视觉上下文
   * @param eraContext - 时代上下文
   * @returns 一致性规则
   */
  private generateConsistencyRules(
    storyContext: StoryContext,
    visualContext: VisualContext,
    eraContext: EraContext
  ): ConsistencyRules {
    const rules: ConsistencyRules = {
      characterTraits: {},
      eraConstraints: [],
      styleConstraints: [],
      forbiddenElements: [],
    };

    // 根据时代背景生成时代限制
    const era = this.safeString(eraContext.era).toLowerCase();
    if (era) {
      // 古代背景限制
      if (era.includes('古代') || era.includes('朝') || era.includes('唐') || era.includes('宋') || era.includes('明') || era.includes('清')) {
        rules.eraConstraints.push('禁止出现现代科技产品（手机、电脑、汽车等）');
        rules.eraConstraints.push('禁止出现现代服装（西装、牛仔裤等）');
        rules.eraConstraints.push('禁止出现现代建筑（摩天大楼、玻璃幕墙等）');
        rules.forbiddenElements.push('手机', '电脑', '汽车', '飞机', '电梯');
      }
      
      // 民国时期限制
      if (era.includes('民国') || era.includes('1920') || era.includes('1930') || era.includes('1940')) {
        rules.eraConstraints.push('禁止出现现代电子产品（智能手机、笔记本电脑等）');
        rules.forbiddenElements.push('智能手机', '笔记本电脑', '互联网');
      }
      
      // 未来背景限制
      if (era.includes('未来') || era.includes('科幻')) {
        rules.styleConstraints.push('允许使用科幻元素，但需保持整体风格统一');
      }
    }

    // 根据视觉风格生成风格限制
    const style = this.safeString(visualContext.artStyle).toLowerCase();
    if (style) {
      if (style.includes('写实') || style.includes('电影感')) {
        rules.styleConstraints.push('保持写实风格，避免过于夸张的表现手法');
      }
      
      if (style.includes('动漫') || style.includes('动画')) {
        rules.styleConstraints.push('保持动漫风格，人物比例和场景设计需符合动漫美学');
      }
    }

    return rules;
  }

  /**
   * 将GlobalContext转换为ScriptMetadata的扩展字段
   * 
   * 用于将提取的上下文合并到metadata中
   * 
   * @param context - 全局上下文
   * @returns 用于扩展ScriptMetadata的部分字段
   */
  convertToMetadata(context: GlobalContext): Partial<ScriptMetadata> {
    return {
      // 故事核心层
      synopsis: context.story.synopsis,
      logline: context.story.logline,
      coreConflict: context.story.coreConflict,
      theme: context.story.themes,
      
      // 故事结构层
      storyStructure: context.story.structure,
      
      // 视觉风格层
      visualStyle: {
        artDirection: context.visual.artDirection,
        artStyle: context.visual.artStyle,
        artStyleDescription: '', // 可在后续补充
        colorPalette: context.visual.colorPalette,
        colorMood: context.visual.colorMood,
        cinematography: context.visual.cinematography,
        lightingStyle: context.visual.lightingStyle,
      },
      
      // 时代背景层
      eraContext: context.era,
      
      // 情绪曲线层
      emotionalArc: context.emotional.arc,
      
      // 一致性规则层
      consistencyRules: context.rules,
      
      // 参考层
      references: {
        films: context.visual.references?.filter(r => !r.includes('导演')) || [],
        directors: context.visual.references?.filter(r => r.includes('导演')) || [],
        artStyles: [],
      },
    };
  }

  /**
   * 获取默认故事结构
   * 
   * 当提取失败时返回默认结构
   */
  private getDefaultStoryStructure(): StoryStructure {
    return {
      structureType: 'other',
      act1: '',
      act2a: '',
      act2b: '',
      act3: '',
      midpoint: '',
      climax: '',
    };
  }
}

// 导出默认实例创建函数
export function createGlobalContextExtractor(config: ModelConfig): GlobalContextExtractor {
  return new GlobalContextExtractor(config);
}
