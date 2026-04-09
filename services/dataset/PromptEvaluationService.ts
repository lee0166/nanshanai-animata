/**
 * Prompt质量评估系统
 *
 * Prompt质量评分、A/B测试框架、优化建议
 *
 * @module services/dataset/PromptEvaluationService
 * @version 1.0.0
 */

/**
 * Prompt质量评分维度
 */
export enum PromptQualityDimension {
  CLARITY = 'clarity', // 清晰度
  SPECIFICITY = 'specificity', // 具体性
  STRUCTURE = 'structure', // 结构性
  CREATIVITY = 'creativity', // 创造性
  COMPLETENESS = 'completeness', // 完整性
}

/**
 * Prompt评分结果接口
 */
export interface PromptScore {
  overall: number; // 0-100
  dimensions: Record<PromptQualityDimension, number>;
  issues: PromptIssue[];
  suggestions: string[];
}

/**
 * Prompt问题接口
 */
export interface PromptIssue {
  type: 'error' | 'warning' | 'info';
  dimension: PromptQualityDimension;
  message: string;
  suggestion: string;
  position?: {
    start: number;
    end: number;
  };
}

/**
 * A/B测试变体
 */
export interface ABTestVariant {
  id: string;
  name: string;
  prompt: string;
  description?: string;
  isControl?: boolean; // 是否为对照组
}

/**
 * A/B测试结果
 */
export interface ABTestResult {
  variantId: string;
  variantName: string;
  isControl: boolean;
  score: PromptScore;
  generationCount: number;
  successRate: number;
  avgGenerationTime: number;
}

/**
 * A/B测试配置
 */
export interface ABTestConfig {
  id: string;
  name: string;
  description?: string;
  variants: ABTestVariant[];
  createdAt: Date;
  status: 'draft' | 'running' | 'completed' | 'paused';
  targetGenerations: number; // 目标生成次数
}

/**
 * Prompt优化建议接口
 */
export interface PromptOptimizationSuggestion {
  type: 'add' | 'remove' | 'modify' | 'reorder';
  category: 'style' | 'content' | 'structure' | 'quality';
  original?: string;
  replacement?: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}

/**
 * Prompt质量评估服务
 */
export class PromptEvaluationService {
  private abTests: Map<string, ABTestConfig> = new Map();
  private testResults: Map<string, ABTestResult[]> = new Map();

  /**
   * 评估Prompt质量
   */
  evaluatePrompt(prompt: string): PromptScore {
    const issues: PromptIssue[] = [];
    const suggestions: string[] = [];
    const dimensions: Record<PromptQualityDimension, number> = {
      [PromptQualityDimension.CLARITY]: 100,
      [PromptQualityDimension.SPECIFICITY]: 100,
      [PromptQualityDimension.STRUCTURE]: 100,
      [PromptQualityDimension.CREATIVITY]: 100,
      [PromptQualityDimension.COMPLETENESS]: 100,
    };

    // 1. 清晰度评估
    this.evaluateClarity(prompt, dimensions, issues, suggestions);

    // 2. 具体性评估
    this.evaluateSpecificity(prompt, dimensions, issues, suggestions);

    // 3. 结构性评估
    this.evaluateStructure(prompt, dimensions, issues, suggestions);

    // 4. 创造性评估
    this.evaluateCreativity(prompt, dimensions, issues, suggestions);

    // 5. 完整性评估
    this.evaluateCompleteness(prompt, dimensions, issues, suggestions);

    // 计算总分
    const overall = this.calculateOverallScore(dimensions);

    return {
      overall,
      dimensions,
      issues,
      suggestions,
    };
  }

  /**
   * 清晰度评估
   */
  private evaluateClarity(
    prompt: string,
    dimensions: Record<PromptQualityDimension, number>,
    issues: PromptIssue[],
    suggestions: string[]
  ): void {
    let score = 100;
    const length = prompt.length;

    // 检查长度
    if (length < 50) {
      score -= 20;
      issues.push({
        type: 'warning',
        dimension: PromptQualityDimension.CLARITY,
        message: 'Prompt过短，可能不够详细',
        suggestion: '建议增加更多描述细节',
      });
    } else if (length > 1000) {
      score -= 10;
      issues.push({
        type: 'info',
        dimension: PromptQualityDimension.CLARITY,
        message: 'Prompt较长，可能需要精简',
        suggestion: '考虑将Prompt分拆为多个部分',
      });
    }

    // 检查模糊词汇
    const vagueWords = ['一些', '很多', '大概', '可能', '某种', '不错', '好的', '很好'];
    vagueWords.forEach(word => {
      if (prompt.includes(word)) {
        score -= 5;
        issues.push({
          type: 'warning',
          dimension: PromptQualityDimension.CLARITY,
          message: `使用了模糊词汇: "${word}"`,
          suggestion: '建议使用更具体的描述词',
        });
      }
    });

    // 检查标点符号
    const punctuationIssues = this.checkPunctuation(prompt);
    if (punctuationIssues.length > 0) {
      score -= punctuationIssues.length * 3;
      issues.push(...punctuationIssues);
    }

    dimensions[PromptQualityDimension.CLARITY] = Math.max(0, score);
  }

  /**
   * 检查标点符号
   */
  private checkPunctuation(prompt: string): PromptIssue[] {
    const issues: PromptIssue[] = [];

    // 检查连续标点
    const consecutivePunc = /([，。！？；：,.\!?;:\s])\1{2,}/g;
    let match;
    while ((match = consecutivePunc.exec(prompt)) !== null) {
      issues.push({
        type: 'info',
        dimension: PromptQualityDimension.CLARITY,
        message: '发现连续重复的标点符号',
        suggestion: '建议去除重复的标点符号',
        position: {
          start: match.index,
          end: match.index + match[0].length,
        },
      });
    }

    return issues;
  }

  /**
   * 具体性评估
   */
  private evaluateSpecificity(
    prompt: string,
    dimensions: Record<PromptQualityDimension, number>,
    issues: PromptIssue[],
    suggestions: string[]
  ): void {
    let score = 100;

    // 检查是否包含视觉细节
    const visualKeywords = ['颜色', '光照', '材质', '构图', '角度', '景别', '运动'];
    let visualCount = 0;
    visualKeywords.forEach(keyword => {
      if (prompt.includes(keyword)) visualCount++;
    });

    if (visualCount < 2) {
      score -= 25;
      issues.push({
        type: 'warning',
        dimension: PromptQualityDimension.SPECIFICITY,
        message: '缺少视觉细节描述',
        suggestion: '建议添加颜色、光照、材质、构图等视觉元素',
      });
    }

    // 检查是否包含质量标签
    const qualityTags = ['8k', '4k', 'masterpiece', 'best quality', 'ultra-detailed'];
    let hasQualityTags = false;
    qualityTags.forEach(tag => {
      if (prompt.toLowerCase().includes(tag)) hasQualityTags = true;
    });

    if (!hasQualityTags) {
      score -= 15;
      issues.push({
        type: 'info',
        dimension: PromptQualityDimension.SPECIFICITY,
        message: '缺少质量标签',
        suggestion: '建议添加质量标签如 8k, masterpiece, best quality',
      });
    }

    dimensions[PromptQualityDimension.SPECIFICITY] = Math.max(0, score);
  }

  /**
   * 结构性评估
   */
  private evaluateStructure(
    prompt: string,
    dimensions: Record<PromptQualityDimension, number>,
    issues: PromptIssue[],
    suggestions: string[]
  ): void {
    let score = 100;

    // 检查分段
    const lines = prompt.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 1 && prompt.length > 300) {
      score -= 20;
      issues.push({
        type: 'warning',
        dimension: PromptQualityDimension.STRUCTURE,
        message: 'Prompt过长且未分段',
        suggestion: '建议使用换行符将Prompt分成多个段落',
      });
    }

    // 检查是否有逗号分隔
    const commas = (prompt.match(/[，,]/g) || []).length;
    const words = prompt.split(/\s+/).length;
    if (words > 20 && commas < 3) {
      score -= 10;
      issues.push({
        type: 'info',
        dimension: PromptQualityDimension.STRUCTURE,
        message: '标点符号使用较少',
        suggestion: '建议使用逗号分隔不同的描述元素',
      });
    }

    dimensions[PromptQualityDimension.STRUCTURE] = Math.max(0, score);
  }

  /**
   * 创造性评估
   */
  private evaluateCreativity(
    prompt: string,
    dimensions: Record<PromptQualityDimension, number>,
    issues: PromptIssue[],
    suggestions: string[]
  ): void {
    let score = 100;

    // 检查是否有创意词汇
    const creativeWords = [
      '光影',
      '氛围',
      '情绪',
      '叙事',
      '构图',
      '电影质感',
      '戏剧',
      '诗意',
      '神秘',
      '梦幻',
    ];
    let creativeCount = 0;
    creativeWords.forEach(word => {
      if (prompt.includes(word)) creativeCount++;
    });

    if (creativeCount === 0) {
      score -= 15;
      issues.push({
        type: 'info',
        dimension: PromptQualityDimension.CREATIVITY,
        message: '可以增加更多创意描述',
        suggestion: '考虑添加氛围、情绪、光影等创意元素',
      });
    }

    dimensions[PromptQualityDimension.CREATIVITY] = Math.max(0, score);
  }

  /**
   * 完整性评估
   */
  private evaluateCompleteness(
    prompt: string,
    dimensions: Record<PromptQualityDimension, number>,
    issues: PromptIssue[],
    suggestions: string[]
  ): void {
    let score = 100;
    const missingElements: string[] = [];

    // 检查是否有主体描述
    if (
      !prompt.includes('人物') &&
      !prompt.includes('角色') &&
      !prompt.match(/[a-zA-Z\u4e00-\u9fa5]+的/)
    ) {
      missingElements.push('主体描述');
    }

    // 检查是否有环境描述
    if (!prompt.includes('背景') && !prompt.includes('环境') && !prompt.includes('场景')) {
      missingElements.push('环境描述');
    }

    // 检查是否有风格描述
    const styleKeywords = ['风格', '电影', '动画', '游戏', '写实', '卡通'];
    let hasStyle = false;
    styleKeywords.forEach(keyword => {
      if (prompt.includes(keyword)) hasStyle = true;
    });
    if (!hasStyle) {
      missingElements.push('风格描述');
    }

    if (missingElements.length > 0) {
      score -= missingElements.length * 10;
      issues.push({
        type: 'info',
        dimension: PromptQualityDimension.COMPLETENESS,
        message: `缺少以下元素: ${missingElements.join('、')}`,
        suggestion: '建议补充缺失的描述元素',
      });
    }

    dimensions[PromptQualityDimension.COMPLETENESS] = Math.max(0, score);
  }

  /**
   * 计算总分
   */
  private calculateOverallScore(dimensions: Record<PromptQualityDimension, number>): number {
    const weights: Record<PromptQualityDimension, number> = {
      [PromptQualityDimension.CLARITY]: 0.25,
      [PromptQualityDimension.SPECIFICITY]: 0.25,
      [PromptQualityDimension.STRUCTURE]: 0.2,
      [PromptQualityDimension.CREATIVITY]: 0.15,
      [PromptQualityDimension.COMPLETENESS]: 0.15,
    };

    let total = 0;
    Object.entries(dimensions).forEach(([dimension, score]) => {
      total += score * weights[dimension as PromptQualityDimension];
    });

    return Math.round(total);
  }

  /**
   * 生成优化建议
   */
  generateOptimizationSuggestions(
    prompt: string,
    score?: PromptScore
  ): PromptOptimizationSuggestion[] {
    const suggestions: PromptOptimizationSuggestion[] = [];
    const evalScore = score || this.evaluatePrompt(prompt);

    // 基于评分生成建议
    if (evalScore.dimensions[PromptQualityDimension.SPECIFICITY] < 80) {
      suggestions.push({
        type: 'add',
        category: 'quality',
        priority: 'high',
        reasoning: '缺少质量标签可以显著提升生成质量',
        replacement: '8k, masterpiece, best quality, ultra-detailed, highly detailed',
      });
    }

    if (evalScore.dimensions[PromptQualityDimension.CREATIVITY] < 80) {
      suggestions.push({
        type: 'add',
        category: 'content',
        priority: 'medium',
        reasoning: '添加氛围和情绪描述可以增强画面感染力',
        replacement: 'dramatic lighting, cinematic atmosphere, emotional',
      });
    }

    if (evalScore.dimensions[PromptQualityDimension.STRUCTURE] < 80 && prompt.length > 300) {
      suggestions.push({
        type: 'modify',
        category: 'structure',
        priority: 'medium',
        reasoning: '合理分段可以提升Prompt的可读性和效果',
        replacement: '使用换行符将不同类别的描述分开',
      });
    }

    return suggestions;
  }

  /**
   * 创建A/B测试
   */
  createABTest(
    name: string,
    variants: Omit<ABTestVariant, 'id'>[],
    description?: string
  ): ABTestConfig {
    const id = crypto.randomUUID();
    const config: ABTestConfig = {
      id,
      name,
      description,
      variants: variants.map((v, idx) => ({
        ...v,
        id: `${id}_variant_${idx}`,
        isControl: idx === 0 && !v.isControl ? true : v.isControl,
      })),
      createdAt: new Date(),
      status: 'draft',
      targetGenerations: variants.length * 10, // 每个变体至少10次
    };

    this.abTests.set(id, config);
    this.testResults.set(id, []);

    return config;
  }

  /**
   * 启动A/B测试
   */
  startABTest(testId: string): boolean {
    const test = this.abTests.get(testId);
    if (!test) return false;

    test.status = 'running';
    this.abTests.set(testId, test);
    return true;
  }

  /**
   * 记录A/B测试结果
   */
  recordABTestResult(
    testId: string,
    variantId: string,
    success: boolean,
    generationTime: number
  ): boolean {
    const test = this.abTests.get(testId);
    const results = this.testResults.get(testId);
    if (!test || !results) return false;

    const variant = test.variants.find(v => v.id === variantId);
    if (!variant) return false;

    // 评估Prompt
    const score = this.evaluatePrompt(variant.prompt);

    // 查找或创建结果
    let result = results.find(r => r.variantId === variantId);
    if (!result) {
      result = {
        variantId,
        variantName: variant.name,
        isControl: variant.isControl || false,
        score,
        generationCount: 0,
        successRate: 0,
        avgGenerationTime: 0,
      };
      results.push(result);
    }

    // 更新结果
    const totalGenerations = result.generationCount + 1;
    const totalSuccesses = result.successRate * result.generationCount + (success ? 1 : 0);
    result.generationCount = totalGenerations;
    result.successRate = totalSuccesses / totalGenerations;
    result.avgGenerationTime =
      (result.avgGenerationTime * (totalGenerations - 1) + generationTime) / totalGenerations;

    this.testResults.set(testId, results);

    // 检查是否完成
    const totalResults = results.reduce((sum, r) => sum + r.generationCount, 0);
    if (totalResults >= test.targetGenerations) {
      test.status = 'completed';
      this.abTests.set(testId, test);
    }

    return true;
  }

  /**
   * 获取A/B测试结果
   */
  getABTestResults(testId: string): ABTestResult[] | null {
    return this.testResults.get(testId) || null;
  }

  /**
   * 获取A/B测试获胜者
   */
  getABTestWinner(testId: string): ABTestResult | null {
    const results = this.getABTestResults(testId);
    if (!results || results.length < 2) return null;

    // 综合评分算法：成功率60% + 质量分40%
    const scoredResults = results.map(r => ({
      ...r,
      combinedScore: r.successRate * 0.6 + (r.score.overall / 100) * 0.4,
    }));

    scoredResults.sort((a, b) => b.combinedScore - a.combinedScore);
    return scoredResults[0];
  }

  /**
   * 获取所有A/B测试
   */
  getAllABTests(): ABTestConfig[] {
    return Array.from(this.abTests.values());
  }
}

export default PromptEvaluationService;
