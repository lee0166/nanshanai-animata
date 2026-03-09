/**
 * IterativeRefinementEngine - 迭代优化主引擎
 *
 * 整合一致性检查、质量评估和自动修正，实现完整的迭代优化工作流：
 * 1. 检查 → 2. 评估 → 3. 修正 → 4. 验证（循环直到满足条件）
 *
 * @module services/parsing/refinement/IterativeRefinementEngine
 * @version 1.0.0
 */

import { ScriptMetadata, ScriptCharacter, ScriptScene } from '../../../types';
import { ConsistencyChecker, ConsistencyCheckResult, ConsistencyRule } from '../consistency/ConsistencyChecker';
import { QualityEvaluator, QualityEvaluationResult, QualityDimension } from '../quality/QualityEvaluator';
import { RefinementEngine, RefinementAction, RefinementResult, RefinementContext } from './RefinementEngine';

/**
 * 迭代优化配置
 */
export interface IterativeRefinementConfig {
  /** 最大迭代次数 */
  maxIterations: number;
  /** 目标质量分数 */
  targetQualityScore: number;
  /** 最小改进阈值（低于此值停止迭代） */
  minImprovementThreshold: number;
  /** 启用自动应用安全修正 */
  autoApplySafeRefinements: boolean;
  /** 置信度阈值 */
  confidenceThreshold: number;
  /** 启用详细日志 */
  verboseLogging: boolean;
}

/**
 * 迭代优化结果
 */
export interface IterativeRefinementResult {
  /** 是否成功 */
  success: boolean;
  /** 执行的总迭代次数 */
  totalIterations: number;
  /** 初始质量分数 */
  initialQualityScore: number;
  /** 最终质量分数 */
  finalQualityScore: number;
  /** 总质量提升 */
  totalQualityImprovement: number;
  /** 所有迭代的结果 */
  iterationResults: IterationResult[];
  /** 最终元数据 */
  finalMetadata: ScriptMetadata;
  /** 执行统计 */
  stats: RefinementStats;
  /** 完整报告 */
  report: string;
}

/**
 * 单次迭代结果
 */
export interface IterationResult {
  /** 迭代编号 */
  iteration: number;
  /** 迭代前的质量分数 */
  qualityScoreBefore: number;
  /** 迭代后的质量分数 */
  qualityScoreAfter: number;
  /** 一致性检查结果 */
  consistencyResult: ConsistencyCheckResult;
  /** 质量评估结果 */
  qualityResult: QualityEvaluationResult;
  /** 修正结果 */
  refinementResult: RefinementResult;
  /** 本次迭代的改进 */
  improvement: number;
  /** 执行时间(ms) */
  executionTime: number;
}

/**
 * 优化统计
 */
export interface RefinementStats {
  /** 总检查次数 */
  totalChecks: number;
  /** 发现的违规数 */
  totalViolationsFound: number;
  /** 自动修复的违规数 */
  autoFixedViolations: number;
  /** 生成的修正动作数 */
  totalActionsGenerated: number;
  /** 应用的修正数 */
  totalActionsApplied: number;
  /** 跳过的修正数 */
  totalActionsSkipped: number;
  /** 失败的修正数 */
  totalActionsFailed: number;
}

/**
 * 迭代优化上下文
 */
interface IterationContext {
  metadata: ScriptMetadata;
  characters: ScriptCharacter[];
  scenes: ScriptScene[];
  iteration: number;
  previousQualityScore: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: IterativeRefinementConfig = {
  maxIterations: 5,
  targetQualityScore: 85,
  minImprovementThreshold: 2,
  autoApplySafeRefinements: true,
  confidenceThreshold: 0.7,
  verboseLogging: true
};

/**
 * 迭代优化主引擎
 */
export class IterativeRefinementEngine {
  private config: IterativeRefinementConfig;
  private consistencyChecker: ConsistencyChecker;
  private qualityEvaluator: QualityEvaluator;
  private refinementEngine: RefinementEngine;
  private stats: RefinementStats;

  constructor(config: Partial<IterativeRefinementConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.consistencyChecker = new ConsistencyChecker();
    this.qualityEvaluator = new QualityEvaluator();
    this.refinementEngine = new RefinementEngine();
    this.stats = this.initializeStats();
  }

  /**
   * 执行完整的迭代优化流程
   * @param metadata 初始剧本元数据
   * @param characters 角色列表
   * @param scenes 场景列表
   * @returns 优化结果
   */
  async refine(
    metadata: ScriptMetadata,
    characters: ScriptCharacter[],
    scenes: ScriptScene[]
  ): Promise<IterativeRefinementResult> {
    console.log('[IterativeRefinementEngine] Starting refinement process...');
    console.log(`[IterativeRefinementEngine] Config: maxIterations=${this.config.maxIterations}, targetScore=${this.config.targetQualityScore}`);

    const startTime = Date.now();
    const iterationResults: IterationResult[] = [];
    let currentMetadata = { ...metadata };
    let currentCharacters = [...characters];
    let currentScenes = [...scenes];

    // 获取初始质量分数
    const initialQualityResult = await this.qualityEvaluator.evaluate({
      metadata: currentMetadata,
      characters: currentCharacters,
      scenes: currentScenes
    });
    const initialQualityScore = initialQualityResult.overallScore;
    let previousQualityScore = initialQualityScore;

    console.log(`[IterativeRefinementEngine] Initial quality score: ${initialQualityScore}`);

    // 迭代优化循环
    for (let iteration = 1; iteration <= this.config.maxIterations; iteration++) {
      console.log(`\n[IterativeRefinementEngine] === Iteration ${iteration}/${this.config.maxIterations} ===`);

      const iterationStartTime = Date.now();

      // 执行单次迭代
      const iterationResult = await this.executeIteration({
        metadata: currentMetadata,
        characters: currentCharacters,
        scenes: currentScenes,
        iteration,
        previousQualityScore
      });

      iterationResults.push(iterationResult);

      // 更新统计数据
      this.updateStats(iterationResult);

      // 更新当前状态
      currentMetadata = iterationResult.refinementResult.success
        ? this.applyChangesToMetadata(currentMetadata, iterationResult.refinementResult)
        : currentMetadata;
      previousQualityScore = iterationResult.qualityScoreAfter;

      const iterationTime = Date.now() - iterationStartTime;
      console.log(`[IterativeRefinementEngine] Iteration ${iteration} completed in ${iterationTime}ms, improvement: ${iterationResult.improvement.toFixed(2)}`);

      // 检查终止条件
      if (this.shouldStopIteration(iterationResult, iteration)) {
        console.log(`[IterativeRefinementEngine] Stopping iteration: termination condition met`);
        break;
      }
    }

    const totalTime = Date.now() - startTime;
    const finalQualityScore = previousQualityScore;

    console.log(`\n[IterativeRefinementEngine] Refinement completed in ${totalTime}ms`);
    console.log(`[IterativeRefinementEngine] Final quality score: ${finalQualityScore} (improvement: ${(finalQualityScore - initialQualityScore).toFixed(2)})`);

    // 生成结果
    const result: IterativeRefinementResult = {
      success: finalQualityScore >= this.config.targetQualityScore || finalQualityScore > initialQualityScore,
      totalIterations: iterationResults.length,
      initialQualityScore,
      finalQualityScore,
      totalQualityImprovement: finalQualityScore - initialQualityScore,
      iterationResults,
      finalMetadata: currentMetadata,
      stats: { ...this.stats },
      report: this.generateReport(iterationResults, initialQualityScore, finalQualityScore, totalTime)
    };

    return result;
  }

  /**
   * 执行单次迭代
   * @private
   */
  private async executeIteration(context: IterationContext): Promise<IterationResult> {
    const iterationStartTime = Date.now();

    // 1. 一致性检查
    console.log(`[IterativeRefinementEngine] Running consistency check...`);
    const consistencyResult = await this.consistencyChecker.check({
      metadata: context.metadata,
      characters: context.characters,
      scenes: context.scenes
    });

    if (this.config.verboseLogging) {
      console.log(`[IterativeRefinementEngine] Found ${consistencyResult.violations.length} violations`);
      consistencyResult.violations.forEach((v, i) => {
        console.log(`  [Violation ${i + 1}] ${v.type}: ${v.message}`);
      });
    }

    // 2. 质量评估
    console.log(`[IterativeRefinementEngine] Running quality evaluation...`);
    const qualityResult = await this.qualityEvaluator.evaluate({
      metadata: context.metadata,
      characters: context.characters,
      scenes: context.scenes
    });

    if (this.config.verboseLogging) {
      console.log(`[IterativeRefinementEngine] Quality score: ${qualityResult.overallScore}`);
      qualityResult.scores?.forEach((score) => {
        console.log(`  [${score.dimension}] ${score.score}/${score.weight * 100}`);
      });
    }

    // 3. 生成修正上下文
    const refinementContext: RefinementContext = {
      metadata: context.metadata,
      characters: context.characters,
      scenes: context.scenes,
      violations: consistencyResult.violations,
      qualityScores: qualityResult.scores || []
    };

    // 4. 生成修正动作
    console.log(`[IterativeRefinementEngine] Generating refinement actions...`);
    const actions = await this.refinementEngine.generateRefinementActions(refinementContext);
    console.log(`[IterativeRefinementEngine] Generated ${actions.length} actions`);

    // 5. 应用修正
    console.log(`[IterativeRefinementEngine] Applying refinements...`);
    const refinementResult = await this.refinementEngine.applyRefinements(
      refinementContext,
      actions,
      this.config.autoApplySafeRefinements
    );

    if (this.config.verboseLogging) {
      console.log(`[IterativeRefinementEngine] Applied: ${refinementResult.appliedActions.length}, Skipped: ${refinementResult.skippedActions.length}, Failed: ${refinementResult.failedActions.length}`);
    }

    const executionTime = Date.now() - iterationStartTime;
    const improvement = qualityResult.overallScore - context.previousQualityScore;

    return {
      iteration: context.iteration,
      qualityScoreBefore: context.previousQualityScore,
      qualityScoreAfter: qualityResult.overallScore,
      consistencyResult,
      qualityResult,
      refinementResult,
      improvement,
      executionTime
    };
  }

  /**
   * 检查是否应该停止迭代
   * @private
   */
  private shouldStopIteration(iterationResult: IterationResult, currentIteration: number): boolean {
    // 达到最大迭代次数
    if (currentIteration >= this.config.maxIterations) {
      console.log('[IterativeRefinementEngine] Max iterations reached');
      return true;
    }

    // 达到目标质量分数
    if (iterationResult.qualityScoreAfter >= this.config.targetQualityScore) {
      console.log('[IterativeRefinementEngine] Target quality score achieved');
      return true;
    }

    // 改进幅度太小
    if (iterationResult.improvement < this.config.minImprovementThreshold) {
      console.log(`[IterativeRefinementEngine] Improvement (${iterationResult.improvement.toFixed(2)}) below threshold (${this.config.minImprovementThreshold})`);
      return true;
    }

    // 没有生成任何修正动作
    if (iterationResult.refinementResult.appliedActions.length === 0 &&
        iterationResult.refinementResult.skippedActions.length === 0) {
      console.log('[IterativeRefinementEngine] No refinement actions generated');
      return true;
    }

    return false;
  }

  /**
   * 将修正应用到元数据
   * @private
   */
  private applyChangesToMetadata(
    metadata: ScriptMetadata,
    refinementResult: RefinementResult
  ): ScriptMetadata {
    // 创建元数据的深拷贝
    const updatedMetadata = JSON.parse(JSON.stringify(metadata));

    // 应用所有变更
    for (const change of refinementResult.changes) {
      switch (change.targetType) {
        case 'character':
          this.applyCharacterChange(updatedMetadata, change);
          break;
        case 'scene':
          this.applySceneChange(updatedMetadata, change);
          break;
        case 'metadata':
          this.applyMetadataChange(updatedMetadata, change);
          break;
      }
    }

    return updatedMetadata;
  }

  /**
   * 应用角色变更
   * @private
   */
  private applyCharacterChange(metadata: ScriptMetadata, change: any): void {
    if (!metadata.characters) return;

    const character = metadata.characters.find((c: any) => c.id === change.targetId);
    if (character) {
      if (change.type === 'add_description' || change.type === 'update_description') {
        character.description = change.after;
      }
    }
  }

  /**
   * 应用场景变更
   * @private
   */
  private applySceneChange(metadata: ScriptMetadata, change: any): void {
    // Note: ScriptMetadata does not have scenes property
    // This method is kept for future extension
    console.log(`[IterativeRefinementEngine] Scene change not applied: ${change.type}`);
  }

  /**
   * 应用元数据变更
   * @private
   */
  private applyMetadataChange(metadata: ScriptMetadata, change: any): void {
    switch (change.field) {
      case 'title':
        metadata.title = change.after;
        break;
      case 'genre':
        // genre is a string, not an array
        metadata.genre = change.after;
        break;
      case 'synopsis':
        metadata.synopsis = change.after;
        break;
    }
  }

  /**
   * 初始化统计
   * @private
   */
  private initializeStats(): RefinementStats {
    return {
      totalChecks: 0,
      totalViolationsFound: 0,
      autoFixedViolations: 0,
      totalActionsGenerated: 0,
      totalActionsApplied: 0,
      totalActionsSkipped: 0,
      totalActionsFailed: 0
    };
  }

  /**
   * 更新统计数据
   * @private
   */
  private updateStats(iterationResult: IterationResult): void {
    this.stats.totalChecks++;
    this.stats.totalViolationsFound += iterationResult.consistencyResult.violations.length;
    this.stats.totalActionsGenerated += iterationResult.refinementResult.appliedActions.length +
                                        iterationResult.refinementResult.skippedActions.length +
                                        iterationResult.refinementResult.failedActions.length;
    this.stats.totalActionsApplied += iterationResult.refinementResult.appliedActions.length;
    this.stats.totalActionsSkipped += iterationResult.refinementResult.skippedActions.length;
    this.stats.totalActionsFailed += iterationResult.refinementResult.failedActions.length;
  }

  /**
   * 生成优化报告
   * @private
   */
  private generateReport(
    iterationResults: IterationResult[],
    initialScore: number,
    finalScore: number,
    totalTime: number
  ): string {
    const lines: string[] = [];

    lines.push('# 迭代优化报告');
    lines.push('');
    lines.push(`## 执行摘要`);
    lines.push(`- **总迭代次数**: ${iterationResults.length}`);
    lines.push(`- **执行时间**: ${totalTime}ms`);
    lines.push(`- **初始质量分数**: ${initialScore.toFixed(2)}`);
    lines.push(`- **最终质量分数**: ${finalScore.toFixed(2)}`);
    lines.push(`- **总改进**: ${(finalScore - initialScore).toFixed(2)}`);
    lines.push('');

    lines.push(`## 统计信息`);
    lines.push(`- **一致性检查次数**: ${this.stats.totalChecks}`);
    lines.push(`- **发现的违规**: ${this.stats.totalViolationsFound}`);
    lines.push(`- **生成的修正动作**: ${this.stats.totalActionsGenerated}`);
    lines.push(`- **应用的修正**: ${this.stats.totalActionsApplied}`);
    lines.push(`- **跳过的修正**: ${this.stats.totalActionsSkipped}`);
    lines.push(`- **失败的修正**: ${this.stats.totalActionsFailed}`);
    lines.push('');

    lines.push(`## 迭代详情`);
    for (const result of iterationResults) {
      lines.push(`\n### 迭代 ${result.iteration}`);
      lines.push(`- **质量分数**: ${result.qualityScoreBefore.toFixed(2)} → ${result.qualityScoreAfter.toFixed(2)}`);
      lines.push(`- **改进**: ${result.improvement.toFixed(2)}`);
      lines.push(`- **违规数**: ${result.consistencyResult.violations.length}`);
      lines.push(`- **应用/跳过/失败**: ${result.refinementResult.appliedActions.length}/${result.refinementResult.skippedActions.length}/${result.refinementResult.failedActions.length}`);
      lines.push(`- **执行时间**: ${result.executionTime}ms`);
    }

    lines.push('');
    lines.push(`## 结论`);
    if (finalScore >= this.config.targetQualityScore) {
      lines.push(`✅ 达到目标质量分数 (${this.config.targetQualityScore})`);
    } else if (finalScore > initialScore) {
      lines.push(`⚠️ 质量有所提升但未达到目标`);
    } else {
      lines.push(`❌ 优化未能改善质量`);
    }

    return lines.join('\n');
  }

  /**
   * 更新配置
   * @param config 部分配置
   */
  updateConfig(config: Partial<IterativeRefinementConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[IterativeRefinementEngine] Config updated:', this.config);
  }

  /**
   * 获取当前配置
   */
  getConfig(): IterativeRefinementConfig {
    return { ...this.config };
  }

  /**
   * 获取统计信息
   */
  getStats(): RefinementStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = this.initializeStats();
    console.log('[IterativeRefinementEngine] Stats reset');
  }

  /**
   * 注册自定义一致性规则
   * @param rule 一致性规则
   */
  registerConsistencyRule(rule: ConsistencyRule): void {
    this.consistencyChecker.registerRule(rule);
    console.log(`[IterativeRefinementEngine] Registered consistency rule: ${rule.name}`);
  }
}

// 导出单例实例
export const iterativeRefinementEngine = new IterativeRefinementEngine();
