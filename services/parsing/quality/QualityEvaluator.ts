/**
 * QualityEvaluator - 质量评估系统
 *
 * 提供多维度质量评估能力，包括：
 * - 完整性评估
 * - 准确性评估
 * - 一致性评估
 * - 可用性评估
 *
 * @module services/parsing/quality/QualityEvaluator
 * @version 1.0.0
 */

import { ScriptCharacter, ScriptScene, Shot as ScriptShot, ScriptMetadata } from '../../../types';
import { ConsistencyCheckResult } from '../consistency/ConsistencyChecker';

/**
 * 质量维度
 */
export type QualityDimension =
  | 'completeness' // 完整性
  | 'accuracy' // 准确性
  | 'consistency' // 一致性
  | 'usability'; // 可用性

/**
 * 质量评分
 */
export interface QualityScore {
  /** 维度名称 */
  dimension: QualityDimension;
  /** 得分 0-100 */
  score: number;
  /** 权重 */
  weight: number;
  /** 评分说明 */
  description: string;
  /** 改进建议 */
  suggestions: string[];
  /** 详细指标 */
  metrics: Record<string, number>;
}

/**
 * 质量评估结果
 */
export interface QualityEvaluationResult {
  /** 总体得分 0-100 */
  overallScore: number;
  /** 各维度评分 */
  scores: QualityScore[];
  /** 质量等级 */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** 通过状态 */
  passed: boolean;
  /** 关键问题 */
  criticalIssues: string[];
  /** 改进建议 */
  improvementSuggestions: string[];
  /** 评估时间戳 */
  timestamp: string;
  /** 评估耗时(ms) */
  duration: number;
}

/**
 * 质量评估配置
 */
export interface QualityEvaluatorConfig {
  /** 通过阈值 */
  passThreshold: number;
  /** 各维度权重 */
  dimensionWeights: Record<QualityDimension, number>;
  /** 最小角色数 */
  minCharacters: number;
  /** 最小场景数 */
  minScenes: number;
  /** 最小分镜数 */
  minShots: number;
}

/**
 * 评估上下文
 */
export interface EvaluationContext {
  /** 剧本元数据 */
  metadata: ScriptMetadata;
  /** 角色列表 */
  characters: ScriptCharacter[];
  /** 场景列表 */
  scenes: ScriptScene[];
  /** 分镜列表 */
  shots?: ScriptShot[];
  /** 一致性检查结果 */
  consistencyResult?: ConsistencyCheckResult;
  /** 原始文本 */
  originalText?: string;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: QualityEvaluatorConfig = {
  passThreshold: 70,
  dimensionWeights: {
    completeness: 0.25,
    accuracy: 0.25,
    consistency: 0.3,
    usability: 0.2,
  },
  minCharacters: 1,
  minScenes: 1,
  minShots: 0,
};

/**
 * 质量评估器
 */
export class QualityEvaluator {
  private config: QualityEvaluatorConfig;

  constructor(config: Partial<QualityEvaluatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行质量评估
   * @param context 评估上下文
   * @returns 评估结果
   */
  async evaluate(context: EvaluationContext): Promise<QualityEvaluationResult> {
    const startTime = Date.now();
    console.log('[QualityEvaluator] Starting quality evaluation...');

    // 评估各维度
    const completenessScore = this.evaluateCompleteness(context);
    const accuracyScore = this.evaluateAccuracy(context);
    const consistencyScore = this.evaluateConsistency(context);
    const usabilityScore = this.evaluateUsability(context);

    const scores: QualityScore[] = [
      completenessScore,
      accuracyScore,
      consistencyScore,
      usabilityScore,
    ];

    // 计算总体得分
    const overallScore = this.calculateOverallScore(scores);

    // 确定质量等级
    const grade = this.determineGrade(overallScore);

    // 收集关键问题
    const criticalIssues = this.collectCriticalIssues(scores);

    // 收集改进建议
    const improvementSuggestions = this.collectSuggestions(scores);

    const duration = Date.now() - startTime;
    console.log(`[QualityEvaluator] Evaluation completed in ${duration}ms, score: ${overallScore}`);

    return {
      overallScore,
      scores,
      grade,
      passed: overallScore >= this.config.passThreshold,
      criticalIssues,
      improvementSuggestions,
      timestamp: new Date().toISOString(),
      duration,
    };
  }

  /**
   * 评估完整性
   * @private
   */
  private evaluateCompleteness(context: EvaluationContext): QualityScore {
    const { metadata, characters, scenes, shots } = context;
    const metrics: Record<string, number> = {};
    const suggestions: string[] = [];

    // 检查元数据完整性
    const metadataFields = ['title', 'genre', 'tone'];
    const metadataComplete = metadataFields.filter(f => {
      const value = metadata[f as keyof ScriptMetadata];
      return value && (Array.isArray(value) ? value.length > 0 : String(value).length > 0);
    }).length;
    metrics.metadataCompleteness = (metadataComplete / metadataFields.length) * 100;

    if (metrics.metadataCompleteness < 100) {
      suggestions.push('完善剧本元数据信息（标题、类型、基调等）');
    }

    // 检查角色完整性
    metrics.characterCount = characters.length;
    metrics.characterCompleteness = characters.length >= this.config.minCharacters ? 100 : 0;

    if (characters.length < this.config.minCharacters) {
      suggestions.push(`剧本需要至少 ${this.config.minCharacters} 个角色`);
    }

    // 检查角色信息完整性
    const characterInfoComplete = characters.filter(
      c => c.description && c.description.length > 10
    ).length;
    metrics.characterInfoCompleteness =
      characters.length > 0 ? (characterInfoComplete / characters.length) * 100 : 0;

    if (metrics.characterInfoCompleteness < 80) {
      suggestions.push('为角色添加更详细的描述信息');
    }

    // 检查场景完整性
    metrics.sceneCount = scenes.length;
    metrics.sceneCompleteness = scenes.length >= this.config.minScenes ? 100 : 0;

    if (scenes.length < this.config.minScenes) {
      suggestions.push(`剧本需要至少 ${this.config.minScenes} 个场景`);
    }

    // 检查场景信息完整性
    const sceneInfoComplete = scenes.filter(
      s => s.description && s.description.length > 10 && s.location
    ).length;
    metrics.sceneInfoCompleteness =
      scenes.length > 0 ? (sceneInfoComplete / scenes.length) * 100 : 0;

    if (metrics.sceneInfoCompleteness < 80) {
      suggestions.push('为场景添加更详细的描述和地点信息');
    }

    // 计算完整性得分
    const score = Math.round(
      metrics.metadataCompleteness * 0.2 +
        metrics.characterCompleteness * 0.2 +
        metrics.characterInfoCompleteness * 0.2 +
        metrics.sceneCompleteness * 0.2 +
        metrics.sceneInfoCompleteness * 0.2
    );

    return {
      dimension: 'completeness',
      score,
      weight: this.config.dimensionWeights.completeness,
      description: '评估剧本信息的完整程度',
      suggestions,
      metrics,
    };
  }

  /**
   * 评估准确性
   * @private
   */
  private evaluateAccuracy(context: EvaluationContext): QualityScore {
    const { characters, scenes } = context;
    const metrics: Record<string, number> = {};
    const suggestions: string[] = [];

    // 检查角色描述质量
    const characterDescriptionQuality = characters.map(c => {
      const desc = c.description || '';
      // 简单的质量评估：描述长度和关键词丰富度
      const length = desc.length;
      const hasKeywords = /(岁|年|身高|外貌|性格|职业)/.test(desc);
      return length > 20 && hasKeywords ? 100 : length > 10 ? 70 : 40;
    });

    metrics.characterDescriptionQuality =
      characterDescriptionQuality.length > 0
        ? characterDescriptionQuality.reduce((a, b) => a + b, 0) /
          characterDescriptionQuality.length
        : 0;

    if (metrics.characterDescriptionQuality < 70) {
      suggestions.push('提升角色描述质量，包含年龄、外貌、性格等关键信息');
    }

    // 检查场景描述质量
    const sceneDescriptionQuality = scenes.map(s => {
      const desc = s.description || '';
      const length = desc.length;
      // 好的场景描述应该包含地点、时间、氛围等信息
      const hasLocation = s.location && s.location.length > 0;
      const hasTime = s.time && s.time.length > 0;
      let score = length > 30 ? 100 : length > 15 ? 80 : 50;
      if (!hasLocation) score -= 20;
      if (!hasTime) score -= 10;
      return Math.max(0, score);
    });

    metrics.sceneDescriptionQuality =
      sceneDescriptionQuality.length > 0
        ? sceneDescriptionQuality.reduce((a, b) => a + b, 0) / sceneDescriptionQuality.length
        : 0;

    if (metrics.sceneDescriptionQuality < 70) {
      suggestions.push('提升场景描述质量，包含地点、时间、氛围等信息');
    }

    // 检查角色-场景关联准确性
    const validCharacterReferences = scenes.map(s => {
      const sceneChars = s.characters || [];
      const validChars = sceneChars.filter(charId => characters.some(c => c.id === charId)).length;
      return sceneChars.length > 0 ? (validChars / sceneChars.length) * 100 : 100;
    });

    metrics.characterReferenceAccuracy =
      validCharacterReferences.length > 0
        ? validCharacterReferences.reduce((a, b) => a + b, 0) / validCharacterReferences.length
        : 100;

    if (metrics.characterReferenceAccuracy < 100) {
      suggestions.push('修复场景中无效的角色引用');
    }

    // 计算准确性得分
    const score = Math.round(
      metrics.characterDescriptionQuality * 0.4 +
        metrics.sceneDescriptionQuality * 0.4 +
        metrics.characterReferenceAccuracy * 0.2
    );

    return {
      dimension: 'accuracy',
      score,
      weight: this.config.dimensionWeights.accuracy,
      description: '评估剧本信息的准确程度',
      suggestions,
      metrics,
    };
  }

  /**
   * 评估一致性
   * @private
   */
  private evaluateConsistency(context: EvaluationContext): QualityScore {
    const { consistencyResult } = context;
    const metrics: Record<string, number> = {};
    const suggestions: string[] = [];

    if (consistencyResult) {
      // 使用一致性检查结果
      metrics.consistencyScore = consistencyResult.score;
      metrics.violationCount = consistencyResult.violations.length;
      metrics.errorCount = consistencyResult.violations.filter(v => v.severity === 'error').length;
      metrics.warningCount = consistencyResult.violations.filter(
        v => v.severity === 'warning'
      ).length;

      if (metrics.errorCount > 0) {
        suggestions.push(`修复 ${metrics.errorCount} 个严重的一致性问题`);
      }
      if (metrics.warningCount > 0) {
        suggestions.push(`处理 ${metrics.warningCount} 个警告级别的一致性问题`);
      }
    } else {
      // 如果没有一致性检查结果，给予基础分
      metrics.consistencyScore = 80;
      suggestions.push('建议运行一致性检查以获得更准确的评估');
    }

    // 计算一致性得分
    const score = Math.round(metrics.consistencyScore);

    return {
      dimension: 'consistency',
      score,
      weight: this.config.dimensionWeights.consistency,
      description: '评估剧本内容的一致程度',
      suggestions,
      metrics,
    };
  }

  /**
   * 评估可用性
   * @private
   */
  private evaluateUsability(context: EvaluationContext): QualityScore {
    const { characters, scenes, shots } = context;
    const metrics: Record<string, number> = {};
    const suggestions: string[] = [];

    // 评估角色可用性
    const characterUsability = characters.map(c => {
      let score = 100;
      // 检查是否有生成可用的信息
      const appearanceStr =
        typeof c.appearance === 'string' ? c.appearance : JSON.stringify(c.appearance);
      const personalityStr = Array.isArray(c.personality)
        ? c.personality.join(' ')
        : c.personality || '';
      if (!appearanceStr || appearanceStr.length < 5) score -= 20;
      if (!personalityStr || personalityStr.length < 5) score -= 15;
      if (!c.description || c.description.length < 10) score -= 15;
      return Math.max(0, score);
    });

    metrics.characterUsability =
      characterUsability.length > 0
        ? characterUsability.reduce((a, b) => a + b, 0) / characterUsability.length
        : 0;

    if (metrics.characterUsability < 80) {
      suggestions.push('为角色添加外观、性格等可用于AI生成的信息');
    }

    // 评估场景可用性
    const sceneUsability = scenes.map(s => {
      let score = 100;
      // 检查是否有生成可用的信息
      if (!s.location || s.location.length < 2) score -= 25;
      if (!s.time || s.time.length < 2) score -= 15;
      if (!s.mood || s.mood.length < 2) score -= 10;
      if (!s.description || s.description.length < 15) score -= 20;
      return Math.max(0, score);
    });

    metrics.sceneUsability =
      sceneUsability.length > 0
        ? sceneUsability.reduce((a, b) => a + b, 0) / sceneUsability.length
        : 0;

    if (metrics.sceneUsability < 80) {
      suggestions.push('为场景添加地点、时间、氛围等可用于AI生成的信息');
    }

    // 评估分镜可用性（如果有分镜数据）
    if (shots && shots.length > 0) {
      const shotUsability = shots.map(sh => {
        let score = 100;
        if (!sh.description || sh.description.length < 10) score -= 30;
        if (!sh.cameraAngle || sh.cameraAngle.length < 2) score -= 20;
        if (!sh.cameraMovement || sh.cameraMovement.length < 2) score -= 15;
        return Math.max(0, score);
      });

      metrics.shotUsability = shotUsability.reduce((a, b) => a + b, 0) / shotUsability.length;

      if (metrics.shotUsability < 80) {
        suggestions.push('为分镜添加描述、机位、运镜等详细信息');
      }
    } else {
      metrics.shotUsability = 0;
    }

    // 计算可用性得分
    const shotWeight = shots && shots.length > 0 ? 0.2 : 0;
    const charSceneWeight = (1 - shotWeight) / 2;

    const score = Math.round(
      metrics.characterUsability * charSceneWeight +
        metrics.sceneUsability * charSceneWeight +
        (metrics.shotUsability || 100) * shotWeight
    );

    return {
      dimension: 'usability',
      score,
      weight: this.config.dimensionWeights.usability,
      description: '评估剧本信息的可用程度（用于AI生成）',
      suggestions,
      metrics,
    };
  }

  /**
   * 计算总体得分
   * @private
   */
  private calculateOverallScore(scores: QualityScore[]): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const score of scores) {
      weightedSum += score.score * score.weight;
      totalWeight += score.weight;
    }

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  /**
   * 确定质量等级
   * @private
   */
  private determineGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * 收集关键问题
   * @private
   */
  private collectCriticalIssues(scores: QualityScore[]): string[] {
    const issues: string[] = [];

    for (const score of scores) {
      if (score.score < 50) {
        issues.push(`${score.dimension}: 严重问题（${score.score}分）`);
      }
    }

    return issues;
  }

  /**
   * 收集改进建议
   * @private
   */
  private collectSuggestions(scores: QualityScore[]): string[] {
    const allSuggestions: string[] = [];

    for (const score of scores) {
      allSuggestions.push(...score.suggestions);
    }

    // 去重并限制数量
    return [...new Set(allSuggestions)].slice(0, 10);
  }

  /**
   * 生成评估报告
   * @param result 评估结果
   */
  generateReport(result: QualityEvaluationResult): string {
    const lines: string[] = [];

    lines.push('# 质量评估报告');
    lines.push('');
    lines.push(`**评估时间**: ${result.timestamp}`);
    lines.push(`**评估耗时**: ${result.duration}ms`);
    lines.push(`**总体得分**: ${result.overallScore}/100`);
    lines.push(`**质量等级**: ${result.grade}`);
    lines.push(`**通过状态**: ${result.passed ? '✅ 通过' : '❌ 未通过'}`);
    lines.push('');

    // 各维度评分
    lines.push('## 各维度评分');
    lines.push('');

    const dimensionNames: Record<QualityDimension, string> = {
      completeness: '完整性',
      accuracy: '准确性',
      consistency: '一致性',
      usability: '可用性',
    };

    for (const score of result.scores) {
      const emoji = score.score >= 80 ? '✅' : score.score >= 60 ? '⚠️' : '❌';
      lines.push(`### ${emoji} ${dimensionNames[score.dimension]}: ${score.score}/100`);
      lines.push(`*${score.description}*`);
      lines.push('');

      // 指标详情
      if (Object.keys(score.metrics).length > 0) {
        lines.push('**指标详情**: ');
        for (const [key, value] of Object.entries(score.metrics)) {
          lines.push(`- ${key}: ${typeof value === 'number' ? value.toFixed(1) : value}`);
        }
        lines.push('');
      }

      // 建议
      if (score.suggestions.length > 0) {
        lines.push('**改进建议**: ');
        for (const suggestion of score.suggestions) {
          lines.push(`- ${suggestion}`);
        }
        lines.push('');
      }
    }

    // 关键问题
    if (result.criticalIssues.length > 0) {
      lines.push('## 关键问题');
      lines.push('');
      for (const issue of result.criticalIssues) {
        lines.push(`- 🔴 ${issue}`);
      }
      lines.push('');
    }

    // 改进建议汇总
    if (result.improvementSuggestions.length > 0) {
      lines.push('## 改进建议汇总');
      lines.push('');
      for (let i = 0; i < result.improvementSuggestions.length; i++) {
        lines.push(`${i + 1}. ${result.improvementSuggestions[i]}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

export default QualityEvaluator;
