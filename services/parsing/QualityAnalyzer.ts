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
  targetId?: string;                // 问题对象ID（用于跳转）
  targetType?: 'character' | 'scene' | 'shot' | 'item' | 'metadata';  // 对象类型
  context?: string;                 // 上下文信息（如当前值、期望值等）
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
   * @param metadata - 剧本元数据
   * @param characters - 角色列表
   * @param scenes - 场景列表
   * @param items - 道具列表
   * @param shots - 分镜列表
   * @param stage - 当前解析阶段
   * @param emotionalArcExtracted - 是否提取了情绪曲线（可选）
   * @param skippedFeatures - 跳过的功能列表（可选）
   */
  analyze(
    metadata: ScriptMetadata | undefined,
    characters: ScriptCharacter[],
    scenes: ScriptScene[],
    items: ScriptItem[],
    shots: Shot[],
    stage: 'metadata' | 'characters' | 'scenes' | 'shots' | 'completed',
    emotionalArcExtracted?: boolean,
    skippedFeatures?: string[]
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
    const violations: RuleViolation[] = allIssues.map((issue, idx) => ({
      rule: `quality_${issue.type}_${idx}`,
      ruleId: `quality_${issue.type}`,
      ruleName: '质量检查',
      severity: issue.type === 'error' ? 'critical' : issue.type === 'warning' ? 'warning' : 'info',
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
      emotionalArcExtracted,
      skippedFeatures,
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
      // 为每个不完整的角色生成具体问题
      incompleteCharacters.slice(0, 5).forEach((char, idx) => {
        const descLength = char.description?.length || 0;
        issues.push({
          type: 'warning',
          message: '角色描述不完整',
          target: char.name,
          targetId: `character_${idx}`,
          targetType: 'character',
          context: `当前描述: ${descLength}字，建议至少${this.config.minCharacterDescriptionLength}字`,
          suggestion: '为角色补充外貌特征、性格描述等信息',
          autoFixable: false,
        });
      });
      // 如果超过5个，添加一个汇总问题
      if (incompleteCharacters.length > 5) {
        issues.push({
          type: 'warning',
          message: `还有 ${incompleteCharacters.length - 5} 个角色描述不完整`,
          context: `共 ${incompleteCharacters.length} 个角色需要补充描述`,
          suggestion: '为角色补充外貌特征、性格描述等信息',
          autoFixable: false,
        });
      }
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
      // 为每个不完整的场景生成具体问题
      incompleteScenes.slice(0, 5).forEach((scene, idx) => {
        const descLength = scene.description?.length || 0;
        issues.push({
          type: 'warning',
          message: '场景描述过短',
          target: scene.name,
          targetId: `scene_${idx}`,
          targetType: 'scene',
          context: `当前描述: ${descLength}字，建议至少${this.config.minSceneDescriptionLength}字`,
          suggestion: '补充场景的环境、氛围、动作等细节描述',
          autoFixable: false,
        });
      });
      // 如果超过5个，添加一个汇总问题
      if (incompleteScenes.length > 5) {
        issues.push({
          type: 'warning',
          message: `还有 ${incompleteScenes.length - 5} 个场景描述过短`,
          context: `共 ${incompleteScenes.length} 个场景需要补充描述`,
          suggestion: '补充场景的环境、氛围、动作等细节描述',
          autoFixable: false,
        });
      }
      score -= Math.min(10, incompleteScenes.length * 2);
    }

    // 检查分镜覆盖度
    if (stage === 'shots' || stage === 'completed') {
      const scenesWithoutShots = scenes.filter(s =>
        !shots.some(shot => shot.sceneId === s.id)
      );

      if (scenesWithoutShots.length > 0) {
        // 为每个缺少分镜的场景生成具体问题
        scenesWithoutShots.slice(0, 5).forEach((scene, idx) => {
          issues.push({
            type: 'error',
            message: '场景缺少分镜',
            target: scene.name,
            targetId: `scene_${idx}`,
            targetType: 'scene',
            context: '该场景尚未生成分镜',
            suggestion: '为该场景生成分镜',
            autoFixable: true,
          });
        });
        // 如果超过5个，添加一个汇总问题
        if (scenesWithoutShots.length > 5) {
          issues.push({
            type: 'error',
            message: `还有 ${scenesWithoutShots.length - 5} 个场景缺少分镜`,
            context: `共 ${scenesWithoutShots.length} 个场景需要生成分镜`,
            suggestion: '为这些场景生成分镜',
            autoFixable: true,
          });
        }
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
      // 为每个异常分镜生成具体问题
      invalidShots.slice(0, 5).forEach((shot, idx) => {
        let problemType = '';
        let context = '';
        if (!shot.type) {
          problemType = '缺少分镜类型';
          context = '分镜类型未设置';
        } else if (!shot.description) {
          problemType = '缺少分镜描述';
          context = '分镜描述为空';
        } else if (shot.duration && (shot.duration < 1 || shot.duration > 60)) {
          problemType = '分镜时长异常';
          context = `当前时长: ${shot.duration}秒，建议范围: 1-60秒`;
        }
        issues.push({
          type: 'warning',
          message: `分镜参数异常: ${problemType}`,
          target: `分镜#${shot.sequence}`,
          targetId: shot.id,
          targetType: 'shot',
          context: context,
          suggestion: '检查分镜类型、描述、时长等参数',
          autoFixable: false,
        });
      });
      // 如果超过5个，添加一个汇总问题
      if (invalidShots.length > 5) {
        issues.push({
          type: 'warning',
          message: `还有 ${invalidShots.length - 5} 个分镜参数异常`,
          context: `共 ${invalidShots.length} 个分镜需要检查`,
          suggestion: '检查分镜类型、描述、时长等参数',
          autoFixable: false,
        });
      }
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
      // 为每个未定义角色生成具体问题
      unknownCharacters.slice(0, 5).forEach((charName, idx) => {
        issues.push({
          type: 'warning',
          message: '场景中出现未定义角色',
          target: charName,
          targetId: `unknown_char_${idx}`,
          targetType: 'character',
          context: '该角色出现在场景中，但未在角色列表中定义',
          suggestion: '将该角色添加到角色列表或检查名称拼写',
          autoFixable: false,
        });
      });
      // 如果超过5个，添加一个汇总问题
      if (unknownCharacters.length > 5) {
        issues.push({
          type: 'warning',
          message: `还有 ${unknownCharacters.length - 5} 个未定义角色`,
          context: `共 ${unknownCharacters.length} 个角色需要添加到角色列表`,
          suggestion: '将这些角色添加到角色列表或检查名称拼写',
          autoFixable: false,
        });
      }
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
        duplicates.forEach(([name, count], idx) => {
          issues.push({
            type: 'error',
            message: '发现重复角色名',
            target: name,
            targetId: `duplicate_char_${idx}`,
            targetType: 'character',
            context: `该角色名出现了 ${count} 次`,
            suggestion: '合并重复角色或区分不同角色',
            autoFixable: false,
          });
        });
        score -= duplicates.length * 10;
      }
    }

    // 检查分镜与场景的一致性
    const shotsWithInvalidScene = shots.filter(s =>
      s.sceneId && !scenes.find(scene => scene.id === s.sceneId)
    );

    if (shotsWithInvalidScene.length > 0) {
      // 为每个无效分镜生成具体问题
      shotsWithInvalidScene.slice(0, 5).forEach((shot, idx) => {
        issues.push({
          type: 'error',
          message: '分镜关联了不存在的场景',
          target: `分镜#${shot.sequence}`,
          targetId: shot.id,
          targetType: 'shot',
          context: `关联的场景ID: ${shot.sceneId} 不存在`,
          suggestion: '删除无效分镜或重新关联场景',
          autoFixable: true,
        });
      });
      // 如果超过5个，添加一个汇总问题
      if (shotsWithInvalidScene.length > 5) {
        issues.push({
          type: 'error',
          message: `还有 ${shotsWithInvalidScene.length - 5} 个分镜关联了不存在的场景`,
          context: `共 ${shotsWithInvalidScene.length} 个分镜需要处理`,
          suggestion: '删除无效分镜或重新关联场景',
          autoFixable: true,
        });
      }
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
      const unusableCharacters = characters.filter(c => {
        const hasAppearance = c.appearance &&
          (c.appearance.face || c.appearance.hair || c.appearance.clothing);
        const hasDescription = c.description && c.description.length > 10;
        return !(hasAppearance || hasDescription);
      });
      const unusableCount = unusableCharacters.length;

      // 为每个信息不足的角色生成具体问题
      unusableCharacters.slice(0, 5).forEach((char, idx) => {
        issues.push({
          type: 'warning',
          message: '角色信息不足，可能无法生成高质量形象',
          target: char.name,
          targetId: `unusable_char_${idx}`,
          targetType: 'character',
          context: '缺少外貌特征描述',
          suggestion: '补充角色的外貌特征描述',
          autoFixable: false,
        });
      });
      // 如果超过5个，添加一个汇总问题
      if (unusableCharacters.length > 5) {
        issues.push({
          type: 'warning',
          message: `还有 ${unusableCharacters.length - 5} 个角色信息不足`,
          context: `共 ${unusableCharacters.length} 个角色需要补充信息`,
          suggestion: '补充角色的外貌特征描述',
          autoFixable: false,
        });
      }
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
      const shortDescriptionShots = shots.filter(s =>
        s.type && s.description && s.description.length <= 10
      );

      // 为每个描述较短的分镜生成具体问题（info级别）
      shortDescriptionShots.slice(0, 5).forEach((shot, idx) => {
        issues.push({
          type: 'info',
          message: '分镜描述较短',
          target: `分镜#${shot.sequence}`,
          targetId: shot.id,
          targetType: 'shot',
          context: `当前描述: ${shot.description?.length || 0}字，建议超过10字`,
          suggestion: '补充分镜描述以提升生成质量',
          autoFixable: false,
        });
      });
      // 如果超过5个，添加一个汇总问题
      if (shortDescriptionShots.length > 5) {
        issues.push({
          type: 'info',
          message: `还有 ${shortDescriptionShots.length - 5} 个分镜描述较短`,
          context: `共 ${shortDescriptionShots.length} 个分镜可以优化描述`,
          suggestion: '补充分镜描述以提升生成质量',
          autoFixable: false,
        });
      }
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

    // 收集问题涉及的实体名称
    const characterNames = new Set<string>();
    const sceneNames = new Set<string>();
    const shotNumbers = new Set<number>();

    sortedDimensions.forEach(dim => {
      if (dim.score < 80) {
        dim.issues.forEach(issue => {
          if (issue.type === 'error') {
            // 收集具体实体信息
            if (issue.target) {
              if (issue.targetType === 'character') characterNames.add(issue.target);
              else if (issue.targetType === 'scene') sceneNames.add(issue.target);
              else if (issue.targetType === 'shot') shotNumbers.add(issue.target.replace('分镜#', ''));
            }
            // 构建更具体的建议文字
            const targetInfo = issue.target ? `【${issue.target}】` : '';
            const contextInfo = issue.context ? `（${issue.context}）` : '';
            recommendations.push(`🔴 严重: ${targetInfo}${issue.suggestion}${contextInfo}`);
          } else if (issue.type === 'warning') {
            // 收集具体实体信息
            if (issue.target) {
              if (issue.targetType === 'character') characterNames.add(issue.target);
              else if (issue.targetType === 'scene') sceneNames.add(issue.target);
              else if (issue.targetType === 'shot') shotNumbers.add(issue.target.replace('分镜#', ''));
            }
            // 构建更具体的建议文字
            const targetInfo = issue.target ? `【${issue.target}】` : '';
            const contextInfo = issue.context ? `（${issue.context}）` : '';
            recommendations.push(`🟡 优化: ${targetInfo}${issue.suggestion}${contextInfo}`);
          } else if (issue.type === 'info') {
            const targetInfo = issue.target ? `【${issue.target}】` : '';
            const contextInfo = issue.context ? `（${issue.context}）` : '';
            recommendations.push(`💡 提示: ${targetInfo}${issue.suggestion}${contextInfo}`);
          }
        });
      }
    });

    // 基于统计信息的建议 - 使用收集到的具体名称
    if (statistics.scenesWithoutShots > 0) {
      const sceneList = Array.from(sceneNames).slice(0, 3).join('、');
      const moreText = sceneNames.size > 3 ? `等${sceneNames.size}个` : '';
      recommendations.push(`🔴 严重: 场景${sceneList || ''}${moreText}缺少分镜，请生成分镜后再试`);
    }

    if (statistics.charactersWithoutDescription > 0) {
      const charList = Array.from(characterNames).slice(0, 3).join('、');
      const moreText = characterNames.size > 3 ? `等${characterNames.size}个` : '';
      recommendations.push(`🟡 优化: 角色${charList || ''}${moreText}缺少详细描述，补充外貌特征后可生成更精准的形象`);
    }

    if (statistics.avgShotsPerScene < 3 && stage === 'completed') {
      recommendations.push(`💡 提示: 当前平均每场景${statistics.avgShotsPerScene}个分镜，建议增加到3-5个以丰富剧情`);
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
