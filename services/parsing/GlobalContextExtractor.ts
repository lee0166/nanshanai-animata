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

import type { 
  LLMProvider 
} from '../ai/providers/LLMProvider';
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
 * 全局上下文提取器
 */
export class GlobalContextExtractor {
  private llmProvider: LLMProvider;

  /**
   * 构造函数
   * @param llmProvider - LLM提供者实例
   */
  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
  }

  /**
   * 提取全局上下文
   * 
   * 这是主要入口方法，在metadata阶段调用，为后续所有阶段提供上下文
   * 
   * @param content - 剧本/小说文本内容
   * @returns 全局上下文对象
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
      const result = await this.llmProvider.generate(prompt);
      
      if (!result.success || !result.data) {
        throw new Error('Failed to extract story context: ' + result.error);
      }

      // 解析JSON响应
      const parsed = JSON.parse(result.data);
      
      return {
        synopsis: parsed.synopsis || '',
        logline: parsed.logline || '',
        coreConflict: parsed.coreConflict || '',
        themes: parsed.themes || [],
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
  "references": ["参考影片1", "参考导演1", "参考影片2"]
}

注意：
1. 必须返回有效的JSON格式
2. colorPalette提供3-5个十六进制颜色代码
3. references提供1-3个参考影片或导演
`;

    try {
      const result = await this.llmProvider.generate(prompt);
      
      if (!result.success || !result.data) {
        throw new Error('Failed to extract visual context: ' + result.error);
      }

      const parsed = JSON.parse(result.data);
      
      return {
        artDirection: parsed.artDirection || '',
        artStyle: parsed.artStyle || '',
        colorPalette: parsed.colorPalette || [],
        colorMood: parsed.colorMood || '',
        cinematography: parsed.cinematography || '',
        lightingStyle: parsed.lightingStyle || '',
        references: parsed.references || [],
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
      const result = await this.llmProvider.generate(prompt);
      
      if (!result.success || !result.data) {
        throw new Error('Failed to extract era context: ' + result.error);
      }

      const parsed = JSON.parse(result.data);
      
      return {
        era: parsed.era || '现代',
        eraDescription: parsed.eraDescription || '',
        location: parsed.location || '',
        season: parsed.season,
        timeOfDay: parsed.timeOfDay,
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
      const result = await this.llmProvider.generate(prompt);
      
      if (!result.success || !result.data) {
        throw new Error('Failed to extract emotional arc: ' + result.error);
      }

      const parsed = JSON.parse(result.data);
      
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
    if (eraContext.era) {
      const era = eraContext.era.toLowerCase();
      
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
    if (visualContext.artStyle) {
      const style = visualContext.artStyle.toLowerCase();
      
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
        films: context.visual.references.filter(r => !r.includes('导演')),
        directors: context.visual.references.filter(r => r.includes('导演')),
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
export function createGlobalContextExtractor(llmProvider: LLMProvider): GlobalContextExtractor {
  return new GlobalContextExtractor(llmProvider);
}
