/**
 * SceneContextExtractor - 场景上下文提取服务
 *
 * 职责：基于 RAG（Retrieval-Augmented Generation）思想，从剧本全文中提取场景相关的上下文文本
 *
 * 核心功能：
 * 1. 根据场景名称和描述在全文中精确定位
 * 2. 智能前后扩展上下文（默认前后各 500 字符）
 * 3. 在段落边界处智能截断，保持句子完整性
 * 4. 提供错误处理和回退机制
 *
 * 使用场景：
 * - 场景解析时提供局部上下文
 * - 分镜生成时补充场景细节
 * - 角色 - 场景关联分析
 *
 * @module services/parsing/SceneContextExtractor
 * @version 1.0.0
 */

import type { ScriptScene } from '../../types';

/**
 * 提取结果接口
 */
export interface ExtractedSceneContext {
  /** 提取的文本片段 */
  text: string;
  /** 在原文中的起始位置 */
  startPosition: number;
  /** 在原文中的结束位置 */
  endPosition: number;
  /** 是否成功定位到场景 */
  found: boolean;
  /** 定位方法 */
  locationMethod: 'name_match' | 'description_match' | 'fuzzy_match' | 'none';
}

/**
 * 提取器配置选项
 */
export interface SceneContextExtractorConfig {
  /** 默认前后扩展字符数，默认 500 */
  defaultContextChars?: number;
  /** 最小扩展字符数，默认 100 */
  minContextChars?: number;
  /** 最大扩展字符数，默认 1000 */
  maxContextChars?: number;
  /** 是否优先匹配场景名称，默认 true */
  preferNameMatch?: boolean;
  /** 是否启用模糊匹配，默认 true */
  enableFuzzyMatch?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<SceneContextExtractorConfig> = {
  defaultContextChars: 500,
  minContextChars: 100,
  maxContextChars: 1000,
  preferNameMatch: true,
  enableFuzzyMatch: true,
};

/**
 * 场景上下文提取器
 *
 * 基于 RAG 思想，从剧本全文中提取场景相关的上下文文本片段
 * 支持多种定位策略和智能截断
 */
export class SceneContextExtractor {
  private config: Required<SceneContextExtractorConfig>;

  /**
   * 构造函数
   * @param config - 提取器配置选项
   */
  constructor(config: SceneContextExtractorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 更新提取器配置
   * @param config - 部分配置更新
   */
  updateConfig(config: Partial<SceneContextExtractorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   * @returns 当前配置
   */
  getConfig(): SceneContextExtractorConfig {
    return { ...this.config };
  }

  /**
   * 提取场景相关文本片段
   *
   * 核心方法：根据场景名称和描述在全文中定位，并前后扩展指定字符数
   * 支持多种定位策略和智能截断
   *
   * @param scene - 场景对象
   * @param content - 完整剧本文本
   * @param contextChars - 前后扩展字符数（默认 500）
   * @returns 提取的文本片段
   */
  extract(scene: ScriptScene, content: string, contextChars?: number): string {
    const result = this.extractWithContext(scene, content, contextChars);
    return result.text;
  }

  /**
   * 提取场景相关文本片段（带详细信息）
   *
   * 与 extract 方法类似，但返回更详细的信息
   *
   * @param scene - 场景对象
   * @param content - 完整剧本文本
   * @param contextChars - 前后扩展字符数（默认 500）
   * @returns 提取结果对象
   */
  extractWithContext(
    scene: ScriptScene,
    content: string,
    contextChars?: number
  ): ExtractedSceneContext {
    const chars = this.normalizeContextChars(contextChars);

    try {
      // 步骤 1: 尝试定位场景
      const location = this.locateScene(scene, content);

      if (!location.found) {
        return this.createEmptyResult();
      }

      // 步骤 2: 计算扩展范围
      const range = this.calculateRange(location.position, chars, content.length);

      // 步骤 3: 智能截断
      const truncatedRange = this.smartTruncate(content, range);

      // 步骤 4: 提取文本
      const text = content.substring(truncatedRange.start, truncatedRange.end);

      return {
        text: text.trim(),
        startPosition: truncatedRange.start,
        endPosition: truncatedRange.end,
        found: true,
        locationMethod: location.method,
      };
    } catch (error) {
      console.warn('[SceneContextExtractor] Extraction failed:', error);
      return this.createEmptyResult();
    }
  }

  /**
   * 定位场景在全文中的位置
   *
   * 使用多级定位策略：
   * 1. 场景名称精确匹配（优先级最高）
   * 2. 场景描述关键词匹配
   * 3. 模糊匹配（如果启用）
   *
   * @param scene - 场景对象
   * @param content - 完整剧本文本
   * @returns 定位结果
   */
  private locateScene(
    scene: ScriptScene,
    content: string
  ): { found: boolean; position: number; method: ExtractedSceneContext['locationMethod'] } {
    // 策略 1: 场景名称精确匹配
    if (this.config.preferNameMatch && scene.name) {
      const namePosition = this.findExactMatch(scene.name, content);
      if (namePosition >= 0) {
        return { found: true, position: namePosition, method: 'name_match' };
      }
    }

    // 策略 2: 场景描述关键词匹配
    if (scene.description) {
      const descriptionPosition = this.findDescriptionMatch(scene.description, content);
      if (descriptionPosition >= 0) {
        return { found: true, position: descriptionPosition, method: 'description_match' };
      }
    }

    // 策略 3: 模糊匹配（如果启用）
    if (this.config.enableFuzzyMatch) {
      const fuzzyPosition = this.findFuzzyMatch(scene, content);
      if (fuzzyPosition >= 0) {
        return { found: true, position: fuzzyPosition, method: 'fuzzy_match' };
      }
    }

    // 未找到匹配
    return { found: false, position: -1, method: 'none' };
  }

  /**
   * 查找场景名称的精确匹配
   *
   * @param name - 场景名称
   * @param content - 完整剧本文本
   * @returns 匹配位置，未找到返回 -1
   */
  private findExactMatch(name: string, content: string): number {
    // 尝试多种常见场景名称格式
    const patterns = [
      name, // 原始名称
      `【${name}】`, // 【场景名】
      `【${name}场】`, // 【场景名场】
      `${name}场`, // 场景名场
      `场景：${name}`, // 场景：场景名
      `Scene: ${name}`, // Scene: 场景名（英文格式）
    ];

    for (const pattern of patterns) {
      const index = content.indexOf(pattern);
      if (index >= 0) {
        return index;
      }
    }

    return -1;
  }

  /**
   * 查找场景描述的关键词匹配
   *
   * @param description - 场景描述
   * @param content - 完整剧本文本
   * @returns 匹配位置，未找到返回 -1
   */
  private findDescriptionMatch(description: string, content: string): number {
    // 提取描述中的关键词
    const keywords = this.extractKeywords(description);

    if (keywords.length === 0) {
      return -1;
    }

    // 查找包含最多关键词的位置
    let bestPosition = -1;
    let maxKeywordsFound = 0;

    for (const keyword of keywords) {
      const index = content.indexOf(keyword);
      if (index >= 0) {
        // 统计该位置附近包含的关键词数量
        const windowStart = Math.max(0, index - 100);
        const windowEnd = Math.min(content.length, index + keyword.length + 100);
        const window = content.substring(windowStart, windowEnd);

        const keywordsInWindow = keywords.filter(k => window.includes(k)).length;

        if (keywordsInWindow > maxKeywordsFound) {
          maxKeywordsFound = keywordsInWindow;
          bestPosition = index;
        }
      }
    }

    // 只有找到至少 2 个关键词才认为是有效匹配
    return maxKeywordsFound >= 2 ? bestPosition : -1;
  }

  /**
   * 模糊匹配场景
   *
   * 使用更宽松的策略匹配场景内容
   *
   * @param scene - 场景对象
   * @param content - 完整剧本文本
   * @returns 匹配位置，未找到返回 -1
   */
  private findFuzzyMatch(scene: ScriptScene, content: string): number {
    // 尝试使用场景的环境信息
    const env = scene.environment;
    const searchTerms: string[] = [];

    if (env?.architecture) {
      searchTerms.push(env.architecture);
    }
    if (env?.furnishings && env.furnishings.length > 0) {
      searchTerms.push(...env.furnishings.slice(0, 3));
    }
    if (scene.timeOfDay) {
      searchTerms.push(scene.timeOfDay);
    }
    if (scene.weather) {
      searchTerms.push(scene.weather);
    }

    for (const term of searchTerms) {
      const index = content.indexOf(term);
      if (index >= 0) {
        return index;
      }
    }

    return -1;
  }

  /**
   * 从文本中提取关键词
   *
   * @param text - 输入文本
   * @returns 关键词列表
   */
  private extractKeywords(text: string): string[] {
    // 中文停用词
    const stopwords = new Set([
      '的',
      '了',
      '在',
      '是',
      '我',
      '有',
      '和',
      '就',
      '不',
      '人',
      '都',
      '一',
      '一个',
      '上',
      '也',
      '很',
      '到',
      '说',
      '要',
      '去',
      '你',
      '会',
      '着',
      '没有',
      '看',
      '好',
      '自己',
      '这',
      '那',
      '他',
      '她',
      '它',
      '们',
      '这个',
      '那个',
      '什么',
      '怎么',
      '可以',
    ]);

    // 简单的中文分词（按字符和常用词组）
    const words = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];

    // 过滤停用词和长度小于 2 的词
    return words.filter(
      word => word.length >= 2 && !stopwords.has(word) && !this.isCommonWord(word)
    );
  }

  /**
   * 判断是否为常见词
   *
   * @param word - 词语
   * @returns 是否为常见词
   */
  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      '场景',
      '地点',
      '时间',
      '天气',
      '人物',
      '描述',
      '环境',
      '室内',
      '室外',
      '白天',
      '夜晚',
      '房间',
      '办公室',
    ]);
    return commonWords.has(word);
  }

  /**
   * 规范化上下文字符数
   *
   * @param chars - 用户指定的字符数
   * @returns 规范化后的字符数
   */
  private normalizeContextChars(chars?: number): number {
    if (chars === undefined || chars === null) {
      return this.config.defaultContextChars;
    }

    return Math.max(this.config.minContextChars, Math.min(chars, this.config.maxContextChars));
  }

  /**
   * 计算扩展范围
   *
   * @param position - 场景位置
   * @param contextChars - 上下文字符数
   * @param contentLength - 全文长度
   * @returns 扩展范围
   */
  private calculateRange(
    position: number,
    contextChars: number,
    contentLength: number
  ): { start: number; end: number } {
    const start = Math.max(0, position - contextChars);
    const end = Math.min(contentLength, position + contextChars);

    return { start, end };
  }

  /**
   * 智能截断
   *
   * 在段落边界处截断，保持句子完整性
   *
   * @param content - 完整文本
   * @param range - 原始范围
   * @returns 截断后的范围
   */
  private smartTruncate(
    content: string,
    range: { start: number; end: number }
  ): { start: number; end: number } {
    // 向前查找段落边界
    let start = this.findParagraphBoundary(content, range.start, 'backward');

    // 向后查找段落边界
    let end = this.findParagraphBoundary(content, range.end, 'forward');

    // 确保不会超出原文范围
    start = Math.max(0, start);
    end = Math.min(content.length, end);

    return { start, end };
  }

  /**
   * 查找段落边界
   *
   * @param content - 完整文本
   * @param position - 起始位置
   * @param direction - 查找方向
   * @returns 边界位置
   */
  private findParagraphBoundary(
    content: string,
    position: number,
    direction: 'forward' | 'backward'
  ): number {
    // 边界查找范围（最多向前/后查找 100 字符）
    const searchRange = 100;

    // 段落分隔符模式
    const paragraphSeparators = [
      '\n\n', // 双换行（最常见）
      '\n', // 单换行
      '。', // 中文句号
      '！', // 中文感叹号
      '？', // 中文问号
      '；', // 中文分号
      '.', // 英文句号
      '!', // 英文感叹号
      '?', // 英文问号
    ];

    if (direction === 'backward') {
      // 向后查找（找起始位置之前的边界）
      const searchStart = Math.max(0, position - searchRange);
      const searchEnd = position;
      const searchText = content.substring(searchStart, searchEnd);

      // 从后向前查找最后一个分隔符
      for (let i = searchText.length - 1; i >= 0; i--) {
        for (const separator of paragraphSeparators) {
          if (searchText.substring(i, i + separator.length) === separator) {
            return searchStart + i + separator.length;
          }
        }
      }

      // 未找到分隔符，返回搜索起始位置
      return searchStart;
    } else {
      // 向前查找（找结束位置之后的边界）
      const searchStart = position;
      const searchEnd = Math.min(content.length, position + searchRange);
      const searchText = content.substring(searchStart, searchEnd);

      // 从前向后查找第一个分隔符
      for (let i = 0; i < searchText.length; i++) {
        for (const separator of paragraphSeparators) {
          if (searchText.substring(i, i + separator.length) === separator) {
            return searchStart + i + separator.length;
          }
        }
      }

      // 未找到分隔符，返回搜索结束位置
      return searchEnd;
    }
  }

  /**
   * 创建空结果
   *
   * @returns 空提取结果
   */
  private createEmptyResult(): ExtractedSceneContext {
    return {
      text: '',
      startPosition: -1,
      endPosition: -1,
      found: false,
      locationMethod: 'none',
    };
  }

  /**
   * 批量提取多个场景的上下文
   *
   * @param scenes - 场景列表
   * @param content - 完整剧本文本
   * @param contextChars - 前后扩展字符数（可选）
   * @returns 提取结果数组
   */
  extractBatch(
    scenes: ScriptScene[],
    content: string,
    contextChars?: number
  ): ExtractedSceneContext[] {
    return scenes.map(scene => this.extractWithContext(scene, content, contextChars));
  }

  /**
   * 提取场景上下文并验证质量
   *
   * @param scene - 场景对象
   * @param content - 完整剧本文本
   * @param contextChars - 前后扩展字符数（可选）
   * @returns 提取结果和质量评分
   */
  extractWithQuality(
    scene: ScriptScene,
    content: string,
    contextChars?: number
  ): { result: ExtractedSceneContext; quality: number } {
    const result = this.extractWithContext(scene, content, contextChars);
    const quality = this.assessQuality(result, scene);

    return { result, quality };
  }

  /**
   * 评估提取质量
   *
   * @param result - 提取结果
   * @param scene - 场景对象
   * @returns 质量评分（0-1）
   */
  private assessQuality(result: ExtractedSceneContext, scene: ScriptScene): number {
    if (!result.found || !result.text) {
      return 0;
    }

    let score = 0.5; // 基础分

    // 根据定位方法加分
    switch (result.locationMethod) {
      case 'name_match':
        score += 0.3;
        break;
      case 'description_match':
        score += 0.2;
        break;
      case 'fuzzy_match':
        score += 0.1;
        break;
    }

    // 根据文本长度加分（适中长度得分更高）
    const textLength = result.text.length;
    if (textLength >= 200 && textLength <= 1500) {
      score += 0.2;
    } else if (textLength >= 100 && textLength <= 2000) {
      score += 0.1;
    }

    // 根据场景名称在文本中的出现次数加分
    if (scene.name && result.text.includes(scene.name)) {
      score += 0.1;
    }

    return Math.min(1, score);
  }
}

/**
 * 创建场景上下文提取器实例
 *
 * @param config - 提取器配置
 * @returns 提取器实例
 */
export function createSceneContextExtractor(
  config: SceneContextExtractorConfig = {}
): SceneContextExtractor {
  return new SceneContextExtractor(config);
}
