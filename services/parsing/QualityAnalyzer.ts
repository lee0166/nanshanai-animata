/**
 * Quality Analyzer Service
 *
 * 解析结果质量分析服务 - 提供多维度质量评估
 * 包括：完整性、准确性、一致性、可用性等维度
 *
 * @module services/parsing/QualityAnalyzer
 * @version 1.0.0
 */

import { ScriptMetadata, ScriptCharacter, ScriptScene, ScriptItem, Shot, QualityReport, RuleViolation } from '../../types';
import { ShortDramaRules, RuleContext } from './ShortDramaRules';

/**
 * 质量维度枚举
 */
export enum QualityDimension {
  COMPLETENESS = 'completeness',    // 完整性
  ACCURACY = 'accuracy',            // 准确性
  CONSISTENCY = 'consistency',      // 一致性
  USABILITY = 'usability',          // 可用性
  DRAMATIC = 'dramatic',            // 戏剧性
}

/**
 * 质量维度评分接口
 */
export interface DimensionScore {
  dimension: QualityDimension;
  score: number;                    // 0-100
  weight: number;                   // 权重 0-1
  details: string[];                // 详细说明
  issues: QualityIssue[];           // 问题列表
}

/**
 * 质量问题接口
 */
export interface QualityIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  target?: string;                  // 问题对象（角色名、场景名等）
  suggestion: string;
  autoFixable?: boolean;            // 是否可自动修复
}

/**
 * 详细质量报告接口
 */
export interface DetailedQualityReport extends QualityReport {
  dimensionScores: DimensionScore[];  // 各维度评分
  overallGrade: string;               // 总评级 A/B/C/D/F
  confidence: number;                 // 置信度 0-1
  statistics: QualityStatistics;      // 统计信息
  recommendations: string[];          // 优化建议（按优先级排序）
  stage: 'metadata' | 'characters' | 'scenes' | 'shots' | 'completed';
}

/**
 * 质量统计信息
 */
export interface QualityStatistics {
  totalCharacters: number;
  totalScenes: number;
  totalItems: number;
  totalShots: number;
  avgCharactersPerScene: number;
  avgShotsPerScene: number;
  scenesWithShots: number;
  scenesWithoutShots: number;
  charactersWithDescription: number;
  charactersWithoutDescription: number;
}

/**
 * 质量分析配置
 */
export interface QualityAnalyzerConfig {
  minCharacterDescriptionLength: number;
  minSceneDescriptionLength: number;
  minShotsPerScene: number;
  maxShotsPerScene: number;
  checkNameConsistency: boolean;
  checkDuplicateNames: boolean;
  dramaticRulesMinScore: number;
}

const DEFAULT_CONFIG: QualityAnalyzerConfig = {
  minCharacterDescriptionLength: 20,
  minSceneDescriptionLength: 30,
  minShotsPerScene: 1,
  maxShotsPerScene: 20,
  checkNameConsistency: true,
  checkDuplicateNames: true,
  dramaticRulesMinScore: 60,
};

/**
 * 质量分析器类
 */
export class QualityAnalyzer {
  private config: QualityAnalyzerConfig;
  private dramaRules: ShortDramaRules;

  constructor(config: Partial<QualityAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dramaRules = new ShortDramaRules();
  }

  /**
   * 执行完整质量分析
   */
  analyze(
    metadata: ScriptMetadata | undefined,
    characters: ScriptCharacter[],
    scenes: ScriptScene[],
    items: ScriptItem[],
    shots: Shot[],
    stage: 'metadata' | 'characters' | 'scenes' | 'shots' | 'completed'
  ): DetailedQualityReport {
    const statistics = this.calculateStatistics(characters, scenes, items, shots);
    
    // 分析各维度
    const completenessScore = this.analyzeCompleteness(metadata, characters, scenes, items, shots, stage);
    const accuracyScore = this.analyzeAccuracy(characters, scenes, shots);
    const consistencyScore = this.analyzeConsistency(characters, scenes, shots);
    const usabilityScore = this.analyzeUsability(characters, scenes, shots);
    const dramaticScore = this.analyzeDramaticQuality(scenes, characters);

    const dimensionScores = [
      completenessScore,
      accuracyScore,
      consistencyScore,
      usabilityScore,
      dramaticScore,
    ];

    // 计算总分（加权平均）
    const totalWeight = dimensionScores.reduce((sum, d) => sum + d.weight, 0);
    const totalScore = Math.round(
      dimensionScores.reduce((sum, d) => sum + d.score * d.weight, 0) / totalWeight
    );

    // 生成评级
    const overallGrade = this.calculateGrade(totalScore);

    // 合并所有问题
    const allIssues: QualityIssue[] = [];
    dimensionScores.forEach(d => allIssues.push(...d.issues));

    // 转换为 RuleViolation 格式
    const violations: RuleViolation[] = allIssues.map(issue => ({
      ruleId: `quality_${issue.type}`,
      ruleName: '质量检查',
      severity: issue.type,
      message: issue.target ? `[${issue.target}] ${issue.message}` : issue.message,
      suggestion: issue.suggestion,
    }));

    // 生成建议（按优先级排序）
    const recommendations = this.generateRecommendations(dimensionScores, statistics, stage);

    // 计算置信度
    const confidence = this.calculateConfidence(dimensionScores, stage);

    return {
      score: totalScore,
      violations,
      suggestions: recommendations.slice(0, 5), // 前5条建议
      dimensionScores,
      overallGrade,
      confidence,
      statistics,
      recommendations,
      stage,
    };
  }

  /**
   * 分析完整性维度
   */
  private analyzeCompleteness(
    metadata: ScriptMetadata | undefined,
    characters: ScriptCharacter[],
    scenes: ScriptScene[],
    items: ScriptItem[],
    shots: Shot[],
    stage: string
  ): DimensionScore {
    const issues: QualityIssue[] = [];
    const details: string[] = [];
    let score = 100;

    // 检查元数据完整性
    if (metadata) {
      if (!metadata.title || metadata.title === '未命名剧本') {
        issues.push({
          type: 'warning',
          message: '剧本标题未提取或为空',
          suggestion: '手动补充剧本标题',
          autoFixable: false,
        });
        score -= 5;
      }
      details.push(`元数据完整: 标题"${metadata.title}"`);
    }

    // 检查角色信息完整性
    const incompleteCharacters = characters.filter(c => 
      !c.appearance || 
      Object.values(c.appearance).every(v => !v) ||
      (c.description && c.description.length < this.config.minCharacterDescriptionLength)
    );

    if (incompleteCharacters.length > 0) {
      issues.push({
        type: 'warning',
        message: `${incompleteCharacters.length}个角色缺少详细描述`,
        suggestion: '为角色补充外貌特征、性格描述等信息',
        autoFixable: false,
      });
      score -= Math.min(15, incompleteCharacters.length * 3);
      details.push(`角色描述完整度: ${characters.length - incompleteCharacters.length}/${characters.length}`);
    } else if (characters.length > 0) {
      details.push(`所有${characters.length}个角色都有完整描述`);
    }

    // 检查场景信息完整性
    const incompleteScenes = scenes.filter(s => 
      !s.description || s.description.length < this.config.minSceneDescriptionLength
    );

    if (incompleteScenes.length > 0) {
      issues.push({
        type: 'warning',
        message: `${incompleteScenes.length}个场景描述过短`,
        suggestion: '补充场景的环境、氛围、动作等细节描述',
        autoFixable: false,
      });
      score -= Math.min(10, incompleteScenes.length * 2);
    }

    // 检查分镜覆盖度
    if (stage === 'shots' || stage === 'completed') {
      const scenesWithoutShots = scenes.filter(s => 
        !shots.some(shot => shot.sceneId === s.id)
      );

      if (scenesWithoutShots.length > 0) {
        issues.push({
          type: 'error',
          message: `${scenesWithoutShots.length}个场景缺少分镜`,
          suggestion: '为这些场景生成分镜',
          autoFixable: true,
        });
        score -= Math.min(20, scenesWithoutShots.length * 5);
        details.push(`分镜覆盖度: ${scenes.length - scenesWithoutShots.length}/${scenes.length}`);
      } else if (scenes.length > 0 && shots.length > 0) {
        details.push(`所有场景都有分镜覆盖`);
      }
    }

    return {
      dimension: QualityDimension.COMPLETENESS,
      score: Math.max(0, score),
      weight: 0.25,
      details,
      issues,
    };
  }

  /**
   * 分析准确性维度
   */
  private analyzeAccuracy(
    characters: ScriptCharacter[],
    scenes: ScriptScene[],
    shots: Shot[]
  ): DimensionScore {
    const issues: QualityIssue[] = [];
    const details: string[] = [];
    let score = 100;

    // 检查角色名准确性（是否有乱码、异常字符）
    const suspiciousCharacters = characters.filter(c => {
      const hasGarbled = /[\ufffd\u0000-\u001f]/.test(c.name);
      const tooLong = c.name.length > 20;
      const tooShort = c.name.length < 1;
      return hasGarbled || tooLong || tooShort;
    });

    if (suspiciousCharacters.length > 0) {
      issues.push({
        type: 'error',
        message: `发现${suspiciousCharacters.length}个异常角色名`,
        suggestion: '检查并修正角色名称',
        autoFixable: false,
      });
      score -= Math.min(15, suspiciousCharacters.length * 5);
    }

    // 检查分镜参数准确性
    const invalidShots = shots.filter(s => 
      !s.type || 
      !s.description ||
      (s.duration && (s.duration < 1 || s.duration > 60))
    );

    if (invalidShots.length > 0) {
      issues.push({
        type: 'warning',
        message: `${invalidShots.length}个分镜参数异常`,
        suggestion: '检查分镜类型、描述、时长等参数',
        autoFixable: false,
      });
      score -= Math.min(10, invalidShots.length * 2);
    }

    details.push(`分镜参数检查: ${shots.length - invalidShots.length}/${shots.length}正常`);

    return {
      dimension: QualityDimension.ACCURACY,
      score: Math.max(0, score),
      weight: 0.20,
      details,
      issues,
    };
  }

  /**
   * 分析一致性维度
   */
  private analyzeConsistency(
    characters: ScriptCharacter[],
    scenes: ScriptScene[],
    shots: Shot[]
  ): DimensionScore {
    const issues: QualityIssue[] = [];
    const details: string[] = [];
    let score = 100;

    // 检查角色名一致性（场景中的角色是否在角色列表中）
    const allSceneCharacters = new Set<string>();
    scenes.forEach(s => {
      s.characters?.forEach(c => allSceneCharacters.add(c));
    });

    const characterNames = new Set(characters.map(c => c.name));
    const unknownCharacters = Array.from(allSceneCharacters).filter(c => !characterNames.has(c));

    if (unknownCharacters.length > 0) {
      issues.push({
        type: 'warning',
        message: `场景中出现未定义角色: ${unknownCharacters.slice(0, 3).join(', ')}${unknownCharacters.length > 3 ? '等' : ''}`,
        suggestion: '将这些角色添加到角色列表或检查名称拼写',
        autoFixable: false,
      });
      score -= Math.min(15, unknownCharacters.length * 3);
    }

    // 检查重复角色名
    if (this.config.checkDuplicateNames) {
      const nameCounts = new Map<string, number>();
      characters.forEach(c => {
        nameCounts.set(c.name, (nameCounts.get(c.name) || 0) + 1);
      });

      const duplicates = Array.from(nameCounts.entries()).filter(([_, count]) => count > 1);
      if (duplicates.length > 0) {
        issues.push({
          type: 'error',
          message: `发现重复角色名: ${duplicates.map(([name]) => name).join(', ')}`,
          suggestion: '合并重复角色或区分不同角色',
          autoFixable: false,
        });
        score -= duplicates.length * 10;
      }
    }

    // 检查分镜与场景的一致性
    const shotsWithInvalidScene = shots.filter(s => 
      s.sceneId && !scenes.find(scene => scene.id === s.sceneId)
    );

    if (shotsWithInvalidScene.length > 0) {
      issues.push({
        type: 'error',
        message: `${shotsWithInvalidScene.length}个分镜关联了不存在的场景`,
        suggestion: '删除无效分镜或重新关联场景',
        autoFixable: true,
      });
      score -= Math.min(20, shotsWithInvalidScene.length * 5);
    }

    details.push(`角色一致性检查通过`);

    return {
      dimension: QualityDimension.CONSISTENCY,
      score: Math.max(0, score),
      weight: 0.20,
      details,
      issues,
    };
  }

  /**
   * 分析可用性维度
   */
  private analyzeUsability(
    characters: ScriptCharacter[],
    scenes: ScriptScene[],
    shots: Shot[]
  ): DimensionScore {
    const issues: QualityIssue[] = [];
    const details: string[] = [];
    let score = 100;

    // 检查角色可用性（是否有足够信息用于生成）
    const usableCharacters = characters.filter(c => {
      const hasAppearance = c.appearance && 
        (c.appearance.face || c.appearance.hair || c.appearance.clothing);
      const hasDescription = c.description && c.description.length > 10;
      return hasAppearance || hasDescription;
    });

    if (usableCharacters.length < characters.length) {
      const unusableCount = characters.length - usableCharacters.length;
      issues.push({
        type: 'warning',
        message: `${unusableCount}个角色信息不足，可能无法生成高质量形象`,
        suggestion: '补充角色的外貌特征描述',
        autoFixable: false,
      });
      score -= Math.min(15, unusableCount * 5);
    }

    details.push(`可用角色: ${usableCharacters.length}/${characters.length}`);

    // 检查场景可用性
    const usableScenes = scenes.filter(s => 
      s.description && s.description.length > 20
    );

    details.push(`可用场景: ${usableScenes.length}/${scenes.length}`);

    // 检查分镜可用性
    const usableShots = shots.filter(s => 
      s.type && s.description && s.description.length > 10
    );

    if (usableShots.length < shots.length) {
      const unusableCount = shots.length - usableShots.length;
      issues.push({
        type: 'info',
        message: `${unusableCount}个分镜描述较短`,
        suggestion: '补充分镜描述以提升生成质量',
        autoFixable: false,
      });
    }

    details.push(`可用分镜: ${usableShots.length}/${shots.length}`);

    return {
      dimension: QualityDimension.USABILITY,
      score: Math.max(0, score),
      weight: 0.20,
      details,
      issues,
    };
  }

  /**
   * 分析戏剧性质量
   */
  private analyzeDramaticQuality(
    scenes: ScriptScene[],
    characters: ScriptCharacter[]
  ): DimensionScore {
    const context: RuleContext = {
      scenes,
      characters,
    };

    const result = this.dramaRules.analyzeQuality(context);
    const issues: QualityIssue[] = result.violations.map(v => ({
      type: v.severity,
      message: v.message,
      suggestion: v.suggestion,
      autoFixable: false,
    }));

    return {
      dimension: QualityDimension.DRAMATIC,
      score: result.score,
      weight: 0.15,
      details: result.suggestions,
      issues,
    };
  }

  /**
   * 计算统计信息
   */
  private calculateStatistics(
    characters: ScriptCharacter[],
    scenes: ScriptScene[],
    items: ScriptItem[],
    shots: Shot[]
  ): QualityStatistics {
    const scenesWithShots = new Set(shots.map(s => s.sceneId)).size;
    const charactersWithDescription = characters.filter(c => 
      c.description && c.description.length > 10
    ).length;

    return {
      totalCharacters: characters.length,
      totalScenes: scenes.length,
      totalItems: items.length,
      totalShots: shots.length,
      avgCharactersPerScene: scenes.length > 0 
        ? Math.round((scenes.reduce((sum, s) => sum + (s.characters?.length || 0), 0) / scenes.length) * 10) / 10
        : 0,
      avgShotsPerScene: scenes.length > 0
        ? Math.round((shots.length / scenes.length) * 10) / 10
        : 0,
      scenesWithShots,
      scenesWithoutShots: scenes.length - scenesWithShots,
      charactersWithDescription,
      charactersWithoutDescription: characters.length - charactersWithDescription,
    };
  }

  /**
   * 计算评级
   */
  private calculateGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(
    dimensionScores: DimensionScore[],
    statistics: QualityStatistics,
    stage: string
  ): string[] {
    const recommendations: string[] = [];

    // 按分数排序，优先处理低分维度
    const sortedDimensions = [...dimensionScores].sort((a, b) => a.score - b.score);

    sortedDimensions.forEach(dim => {
      if (dim.score < 80) {
        dim.issues.forEach(issue => {
          if (issue.type === 'error') {
            recommendations.push(`[重要] ${issue.suggestion}`);
          } else if (issue.type === 'warning') {
            recommendations.push(`[建议] ${issue.suggestion}`);
          }
        });
      }
    });

    // 基于统计信息的建议
    if (statistics.scenesWithoutShots > 0) {
      recommendations.push(`[重要] 还有${statistics.scenesWithoutShots}个场景未生成分镜，建议完成全部分镜生成`);
    }

    if (statistics.charactersWithoutDescription > 0) {
      recommendations.push(`[建议] ${statistics.charactersWithoutDescription}个角色缺少详细描述，补充后可提升生成质量`);
    }

    if (statistics.avgShotsPerScene < 3 && stage === 'completed') {
      recommendations.push(`[建议] 平均每场景分镜数较少(${statistics.avgShotsPerScene}个)，可考虑增加分镜丰富度`);
    }

    return recommendations;
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    dimensionScores: DimensionScore[],
    stage: string
  ): number {
    // 基于完成阶段和维度分数计算
    const stageConfidence: Record<string, number> = {
      'metadata': 0.3,
      'characters': 0.5,
      'scenes': 0.7,
      'shots': 0.9,
      'completed': 1.0,
    };

    const baseConfidence = stageConfidence[stage] || 0.5;
    const avgScore = dimensionScores.reduce((sum, d) => sum + d.score, 0) / dimensionScores.length;
    
    // 置信度 = 基础置信度 * (平均分/100)
    return Math.round(baseConfidence * (avgScore / 100) * 100) / 100;
  }

  /**
   * 获取指定阶段的质量报告
   * 用于实时验证
   */
  analyzeForStage(
    stage: 'metadata' | 'characters' | 'scenes' | 'shots',
    metadata: ScriptMetadata | undefined,
    characters: ScriptCharacter[],
    scenes: ScriptScene[],
    items: ScriptItem[],
    shots: Shot[]
  ): DetailedQualityReport {
    return this.analyze(metadata, characters, scenes, items, shots, stage);
  }
}

// 导出单例
export const qualityAnalyzer = new QualityAnalyzer();
