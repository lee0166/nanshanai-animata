/**
 * ContextInjector - 上下文注入服务
 *
 * 职责：将全局上下文注入到各解析阶段的Prompt中，确保角色、场景、分镜提取
 * 都能获得统一的故事背景、视觉风格和时代背景信息
 *
 * @version 1.0.0
 */

import type { GlobalContext } from './GlobalContextExtractor';
import type { ScriptScene } from '../../types';

/**
 * 注入配置选项
 */
export interface InjectionOptions {
  /** 是否注入故事背景 */
  includeStoryContext?: boolean;
  /** 是否注入视觉风格 */
  includeVisualContext?: boolean;
  /** 是否注入时代背景 */
  includeEraContext?: boolean;
  /** 是否注入情绪曲线 */
  includeEmotionalContext?: boolean;
  /** 是否注入一致性规则 */
  includeConsistencyRules?: boolean;
  /** 最大Prompt长度限制 */
  maxPromptLength?: number;
}

/**
 * 默认注入配置
 */
const DEFAULT_OPTIONS: InjectionOptions = {
  includeStoryContext: true,
  includeVisualContext: true,
  includeEraContext: true,
  includeEmotionalContext: true,
  includeConsistencyRules: true,
  maxPromptLength: 8000,
};

/**
 * 上下文注入器
 */
export class ContextInjector {
  private options: InjectionOptions;

  /**
   * 构造函数
   * @param options - 注入配置选项
   */
  constructor(options: InjectionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 为角色解析注入上下文
   *
   * 在角色提取阶段调用，为角色分析提供全局背景
   *
   * @param basePrompt - 基础Prompt
   * @param context - 全局上下文
   * @param characterName - 角色名称
   * @returns 注入上下文后的完整Prompt
   */
  injectForCharacter(basePrompt: string, context: GlobalContext, characterName: string): string {
    const sections: string[] = [];

    if (this.options.includeStoryContext && context.story) {
      sections.push(this.buildStoryContextSection(context));
    }

    if (this.options.includeVisualContext && context.visual) {
      sections.push(this.buildVisualContextSection(context));
    }

    if (this.options.includeEraContext && context.era) {
      sections.push(this.buildEraContextSection(context));
    }

    if (this.options.includeConsistencyRules && context.rules) {
      sections.push(this.buildConsistencyRulesSection(context, characterName));
    }

    const contextPrompt = sections.join('\n\n');
    const fullPrompt = `${contextPrompt}\n\n${basePrompt}\n\n${this.buildCharacterInjectionHint(characterName)}`;

    return this.truncateIfNeeded(fullPrompt);
  }

  /**
   * 为场景解析注入上下文
   *
   * 在场景提取阶段调用，为场景分析提供全局背景
   *
   * @param basePrompt - 基础Prompt
   * @param context - 全局上下文
   * @param sceneName - 场景名称
   * @returns 注入上下文后的完整Prompt
   */
  injectForScene(basePrompt: string, context: GlobalContext, sceneName: string): string {
    const sections: string[] = [];

    if (this.options.includeStoryContext && context.story) {
      sections.push(this.buildStoryContextSection(context));
    }

    if (this.options.includeVisualContext && context.visual) {
      sections.push(this.buildVisualContextSection(context));
    }

    if (this.options.includeEraContext && context.era) {
      sections.push(this.buildEraContextSection(context));
    }

    if (this.options.includeEmotionalContext && context.emotional) {
      sections.push(this.buildEmotionalContextSection(context, sceneName));
    }

    const contextPrompt = sections.join('\n\n');
    const fullPrompt = `${contextPrompt}\n\n${basePrompt}\n\n${this.buildSceneInjectionHint(context, sceneName)}`;

    return this.truncateIfNeeded(fullPrompt);
  }

  /**
   * 为分镜生成注入上下文
   *
   * 在分镜生成阶段调用，为分镜设计提供视觉指导
   *
   * @param basePrompt - 基础Prompt
   * @param context - 全局上下文
   * @param sceneInfo - 场景信息
   * @returns 注入上下文后的完整Prompt
   */
  injectForShots(basePrompt: string, context: GlobalContext, sceneInfo: ScriptScene): string {
    const sections: string[] = [];

    if (this.options.includeVisualContext && context.visual) {
      sections.push(this.buildVisualGuidanceSection(context));
    }

    if (this.options.includeEmotionalContext && context.emotional) {
      sections.push(this.buildEmotionalContextSection(context, sceneInfo.name));
    }

    if (this.options.includeEraContext && context.era) {
      sections.push(this.buildEraConstraintsSection(context));
    }

    const contextPrompt = sections.join('\n\n');
    const fullPrompt = `${contextPrompt}\n\n${basePrompt}\n\n${this.buildShotInjectionHint(context, sceneInfo)}`;

    return this.truncateIfNeeded(fullPrompt);
  }

  /**
   * 为道具解析注入上下文
   *
   * 在道具提取阶段调用，确保道具符合时代背景和视觉风格
   *
   * @param basePrompt - 基础Prompt
   * @param context - 全局上下文
   * @returns 注入上下文后的完整Prompt
   */
  injectForItems(basePrompt: string, context: GlobalContext): string {
    const sections: string[] = [];

    if (this.options.includeEraContext && context.era) {
      sections.push(this.buildEraContextSection(context));
    }

    if (this.options.includeVisualContext && context.visual) {
      sections.push(this.buildVisualStyleHint(context));
    }

    if (this.options.includeConsistencyRules && context.rules) {
      sections.push(this.buildEraConstraintsSection(context));
    }

    const contextPrompt = sections.join('\n\n');
    const fullPrompt = `${contextPrompt}\n\n${basePrompt}\n\n【重要提示】\n请确保道具描述符合以上时代背景和视觉风格。`;

    return this.truncateIfNeeded(fullPrompt);
  }

  /**
   * 构建故事背景区块
   */
  private buildStoryContextSection(context: GlobalContext): string {
    const { story } = context;

    if (!story.synopsis && !story.logline && !story.coreConflict) {
      return '';
    }

    let section = '【故事背景】\n';

    if (story.logline) {
      section += `- 一句话简介：${story.logline}\n`;
    }

    if (story.synopsis) {
      section += `- 故事梗概：${story.synopsis}\n`;
    }

    if (story.coreConflict) {
      section += `- 核心冲突：${story.coreConflict}\n`;
    }

    if (story.themes && story.themes.length > 0) {
      section += `- 主题思想：${story.themes.join('、')}\n`;
    }

    return section;
  }

  /**
   * 构建视觉风格区块
   */
  private buildVisualContextSection(context: GlobalContext): string {
    const { visual } = context;

    if (!visual.artStyle && !visual.artDirection) {
      return '';
    }

    let section = '【视觉风格】\n';

    if (visual.artDirection) {
      section += `- 美术指导：${visual.artDirection}\n`;
    }

    if (visual.artStyle) {
      section += `- 艺术风格：${visual.artStyle}\n`;
    }

    if (visual.colorPalette && visual.colorPalette.length > 0) {
      section += `- 主色调：${visual.colorPalette.join('、')}\n`;
    }

    if (visual.colorMood) {
      section += `- 色彩情绪：${visual.colorMood}\n`;
    }

    return section;
  }

  /**
   * 构建时代背景区块
   */
  private buildEraContextSection(context: GlobalContext): string {
    const { era } = context;

    if (!era.era && !era.location) {
      return '';
    }

    let section = '【时代背景】\n';

    if (era.era) {
      section += `- 年代：${era.era}\n`;
    }

    if (era.eraDescription) {
      section += `- 时代特征：${era.eraDescription}\n`;
    }

    if (era.location) {
      section += `- 地点：${era.location}\n`;
    }

    if (era.season) {
      section += `- 季节：${era.season}\n`;
    }

    return section;
  }

  /**
   * 构建情绪指导区块
   */
  private buildEmotionalContextSection(context: GlobalContext, sceneName: string): string {
    const { emotional } = context;

    if (!emotional.arc || emotional.arc.length === 0) {
      return '';
    }

    // 找到与场景相关的情绪点
    const relevantPoints = emotional.arc.filter(
      point =>
        sceneName.includes(point.plotPoint) ||
        point.plotPoint.includes(sceneName) ||
        this.isSceneNearPlotPoint(sceneName, point.percentage)
    );

    if (relevantPoints.length === 0) {
      return '';
    }

    let section = '【情绪指导】\n';

    relevantPoints.forEach(point => {
      section += `- ${point.plotPoint}：${point.emotion}（强度${point.intensity}/10，色调${point.colorTone}）\n`;
    });

    return section;
  }

  /**
   * 构建视觉指导区块（用于分镜）
   */
  private buildVisualGuidanceSection(context: GlobalContext): string {
    const { visual } = context;

    if (!visual.cinematography && !visual.lightingStyle) {
      return '';
    }

    let section = '【视觉指导】\n';

    if (visual.artStyle) {
      section += `- 美术风格：${visual.artStyle}\n`;
    }

    if (visual.colorPalette && visual.colorPalette.length > 0) {
      section += `- 色彩方案：${visual.colorPalette.join('、')}\n`;
    }

    if (visual.cinematography) {
      section += `- 摄影风格：${visual.cinematography}\n`;
    }

    if (visual.lightingStyle) {
      section += `- 光影风格：${visual.lightingStyle}\n`;
    }

    if (visual.references && visual.references.length > 0) {
      section += `- 参考风格：${visual.references.join('、')}\n`;
    }

    return section;
  }

  /**
   * 构建一致性规则区块
   */
  private buildConsistencyRulesSection(context: GlobalContext, entityName: string): string {
    const { rules } = context;

    if (!rules) {
      return '';
    }

    let section = '【一致性规则】\n';
    let hasContent = false;

    // 角色特征规则
    const traits = rules.characterTraits?.[entityName];
    if (traits && traits.length > 0) {
      section += `- 必须保持的特征：${traits.join('、')}\n`;
      hasContent = true;
    }

    // 时代限制
    if (rules.eraConstraints && rules.eraConstraints.length > 0) {
      section += `- 时代限制：${rules.eraConstraints.join('、')}\n`;
      hasContent = true;
    }

    // 风格限制
    if (rules.styleConstraints && rules.styleConstraints.length > 0) {
      section += `- 风格限制：${rules.styleConstraints.join('、')}\n`;
      hasContent = true;
    }

    // 禁止元素
    if (rules.forbiddenElements && rules.forbiddenElements.length > 0) {
      section += `- 禁止元素：${rules.forbiddenElements.join('、')}\n`;
      hasContent = true;
    }

    return hasContent ? section : '';
  }

  /**
   * 构建时代限制区块
   */
  private buildEraConstraintsSection(context: GlobalContext): string {
    const { rules } = context;

    if (!rules?.eraConstraints?.length && !rules?.forbiddenElements?.length) {
      return '';
    }

    let section = '【时代限制】\n';

    if (rules.eraConstraints && rules.eraConstraints.length > 0) {
      rules.eraConstraints.forEach(constraint => {
        section += `- ${constraint}\n`;
      });
    }

    if (rules.forbiddenElements && rules.forbiddenElements.length > 0) {
      section += `- 禁止出现：${rules.forbiddenElements.join('、')}\n`;
    }

    return section;
  }

  /**
   * 构建视觉风格提示（简化版）
   */
  private buildVisualStyleHint(context: GlobalContext): string {
    const { visual } = context;

    if (!visual.artStyle) {
      return '';
    }

    return `【视觉风格】${visual.artStyle}`;
  }

  /**
   * 构建角色注入提示
   */
  private buildCharacterInjectionHint(characterName: string): string {
    return `【重要提示】\n请确保角色"${characterName}"的描述符合以上全局背景和一致性规则。角色外貌、服装、性格应与故事时代背景和视觉风格保持一致。`;
  }

  /**
   * 构建场景注入提示
   */
  private buildSceneInjectionHint(context: GlobalContext, sceneName: string): string {
    const hints: string[] = [];

    if (context.visual?.artStyle) {
      hints.push(`符合${context.visual.artStyle}风格`);
    }

    if (context.era?.era) {
      hints.push(`符合${context.era.era}时代特征`);
    }

    const hintText = hints.length > 0 ? `场景描述应${hints.join('，')}。` : '';

    return `【重要提示】\n${hintText}请确保场景的视觉描述与整体美术风格和色调保持一致。`;
  }

  /**
   * 构建分镜注入提示
   */
  private buildShotInjectionHint(context: GlobalContext, sceneInfo: ScriptScene): string {
    const hints: string[] = [];

    if (context.visual?.cinematography) {
      hints.push(`摄影风格：${context.visual.cinematography}`);
    }

    if (context.visual?.lightingStyle) {
      hints.push(`光影风格：${context.visual.lightingStyle}`);
    }

    let hintText = '';
    if (hints.length > 0) {
      hintText = `分镜设计应遵循：${hints.join('，')}。`;
    }

    return `【视觉指导】\n${hintText}\n场景信息：${sceneInfo.name}\n请确保分镜设计符合以上视觉指导和场景氛围。`;
  }

  /**
   * 判断场景是否接近情节点
   *
   * 这是一个简单的启发式判断，实际使用时可以根据场景顺序更精确判断
   */
  private isSceneNearPlotPoint(sceneName: string, plotPointPercentage: number): boolean {
    // 这里可以实现更复杂的逻辑，比如根据场景名称中的数字判断
    // 简单实现：返回false，依赖精确匹配
    return false;
  }

  /**
   * 如果Prompt过长则截断
   */
  private truncateIfNeeded(prompt: string): string {
    const maxLength = this.options.maxPromptLength || 8000;

    if (prompt.length <= maxLength) {
      return prompt;
    }

    // 截断策略：保留上下文部分和基础Prompt，中间截断
    const contextEnd = prompt.indexOf('\n\n【原始Prompt】');
    if (contextEnd === -1) {
      // 如果没有标记，直接截断
      return prompt.substring(0, maxLength) + '\n\n[Prompt已截断...]';
    }

    // 有标记时，保留上下文，截断原始Prompt
    const contextPart = prompt.substring(0, contextEnd);
    const restPart = prompt.substring(contextEnd);

    const availableLength = maxLength - contextPart.length - 100;
    if (availableLength > 0) {
      return contextPart + restPart.substring(0, availableLength) + '\n\n[Prompt已截断...]';
    }

    return contextPart + '\n\n[原始Prompt已截断...]';
  }
}

/**
 * 创建上下文注入器实例
 *
 * 工厂函数，用于快速创建ContextInjector实例
 *
 * @param options - 注入配置选项
 * @returns ContextInjector实例
 */
export function createContextInjector(options?: InjectionOptions): ContextInjector {
  return new ContextInjector(options);
}
