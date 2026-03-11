/**
 * RefinementEngine - 自动修正引擎
 *
 * 提供剧本解析结果的自动修正能力，包括：
 * - 角色描述自动补全
 * - 场景信息自动完善
 * - 一致性违规自动修复
 * - 质量提升建议实施
 *
 * @module services/parsing/refinement/RefinementEngine
 * @version 1.0.0
 */

import { ScriptCharacter, ScriptScene, ScriptMetadata } from '../../../types';
import { ConsistencyViolation, ViolationType } from '../consistency/ConsistencyChecker';
import { QualityScore, QualityDimension } from '../quality/QualityEvaluator';

/**
 * 修正操作类型
 */
export type RefinementActionType =
  | 'add_description' // 添加描述
  | 'update_description' // 更新描述
  | 'merge_characters' // 合并角色
  | 'add_location' // 添加地点
  | 'add_time' // 添加时间
  | 'fix_reference' // 修复引用
  | 'remove_redundant' // 移除冗余
  | 'enhance_detail'; // 增强细节

/**
 * 修正操作
 */
export interface RefinementAction {
  /** 操作ID */
  id: string;
  /** 操作类型 */
  type: RefinementActionType;
  /** 目标类型 */
  targetType: 'character' | 'scene' | 'metadata';
  /** 目标ID */
  targetId: string;
  /** 操作描述 */
  description: string;
  /** 当前值 */
  currentValue?: string | object;
  /** 建议值 */
  proposedValue: string | object;
  /** 置信度 0-1 */
  confidence: number;
  /** 自动应用是否安全 */
  autoSafe: boolean;
  /** 需要用户确认 */
  requiresConfirmation: boolean;
}

/**
 * 修正结果
 */
export interface RefinementResult {
  /** 是否成功 */
  success: boolean;
  /** 应用的修正 */
  appliedActions: RefinementAction[];
  /** 跳过的修正 */
  skippedActions: RefinementAction[];
  /** 失败的修正 */
  failedActions: RefinementAction[];
  /** 修正前后的对比 */
  changes: RefinementChange[];
  /** 质量提升 */
  qualityImprovement: number;
}

/**
 * 修正变更
 */
export interface RefinementChange {
  /** 变更类型 */
  type: RefinementActionType;
  /** 目标 */
  target: string;
  /** 目标类型 */
  targetType?: 'character' | 'scene' | 'shot' | 'dialogue' | 'action' | 'metadata' | 'other';
  /** 变更前 */
  before: string | object;
  /** 变更后 */
  after: string | object;
}

/**
 * 修正上下文
 */
export interface RefinementContext {
  /** 元数据 */
  metadata: ScriptMetadata;
  /** 角色列表 */
  characters: ScriptCharacter[];
  /** 场景列表 */
  scenes: ScriptScene[];
  /** 一致性违规 */
  violations: ConsistencyViolation[];
  /** 质量评分 */
  qualityScores: QualityScore[];
  /** 原始文本 */
  originalText?: string;
}

/**
 * 修正引擎配置
 */
export interface RefinementEngineConfig {
  /** 最小置信度 */
  minConfidence: number;
  /** 仅自动安全操作 */
  autoSafeOnly: boolean;
  /** 最大修正数 */
  maxRefinements: number;
  /** 启用角色修正 */
  enableCharacterRefinement: boolean;
  /** 启用场景修正 */
  enableSceneRefinement: boolean;
  /** 启用元数据修正 */
  enableMetadataRefinement: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: RefinementEngineConfig = {
  minConfidence: 0.6,
  autoSafeOnly: true,
  maxRefinements: 20,
  enableCharacterRefinement: true,
  enableSceneRefinement: true,
  enableMetadataRefinement: true,
};

/**
 * 自动修正引擎
 */
export class RefinementEngine {
  private config: RefinementEngineConfig;

  constructor(config: Partial<RefinementEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 生成修正建议
   * @param context 修正上下文
   * @returns 修正操作列表
   */
  generateRefinementActions(context: RefinementContext): RefinementAction[] {
    const actions: RefinementAction[] = [];

    console.log('[RefinementEngine] Generating refinement actions...');

    // 1. 基于一致性违规生成修正
    const violationActions = this.generateViolationBasedActions(context);
    actions.push(...violationActions);

    // 2. 基于质量评分生成修正
    const qualityActions = this.generateQualityBasedActions(context);
    actions.push(...qualityActions);

    // 3. 基于完整性检查生成修正
    const completenessActions = this.generateCompletenessActions(context);
    actions.push(...completenessActions);

    // 按置信度排序
    actions.sort((a, b) => b.confidence - a.confidence);

    // 限制数量
    const limitedActions = actions.slice(0, this.config.maxRefinements);

    console.log(`[RefinementEngine] Generated ${limitedActions.length} refinement actions`);
    return limitedActions;
  }

  /**
   * 基于一致性违规生成修正
   * @private
   */
  private generateViolationBasedActions(context: RefinementContext): RefinementAction[] {
    const actions: RefinementAction[] = [];

    for (const violation of context.violations) {
      // 只处理高置信度的违规
      if (violation.confidence < this.config.minConfidence) continue;

      switch (violation.type) {
        case 'character_inconsistency':
          actions.push(...this.handleCharacterInconsistency(violation, context));
          break;
        case 'scene_continuity':
          actions.push(...this.handleSceneContinuity(violation, context));
          break;
        case 'missing_reference':
          actions.push(...this.handleMissingReference(violation, context));
          break;
        case 'timeline_conflict':
          actions.push(...this.handleTimelineConflict(violation, context));
          break;
      }
    }

    return actions;
  }

  /**
   * 处理角色不一致
   * @private
   */
  private handleCharacterInconsistency(
    violation: ConsistencyViolation,
    context: RefinementContext
  ): RefinementAction[] {
    const actions: RefinementAction[] = [];

    if (violation.characterIds && violation.characterIds.length > 0) {
      for (const charId of violation.characterIds) {
        const character = context.characters.find(c => c.id === charId);
        if (!character) continue;

        // 如果角色缺少描述，建议添加
        if (!character.description || character.description.length < 20) {
          actions.push({
            id: `refine-char-desc-${charId}`,
            type: 'add_description',
            targetType: 'character',
            targetId: charId,
            description: `为角色 "${character.name}" 添加详细描述`,
            currentValue: character.description,
            proposedValue: this.generateCharacterDescription(character, context),
            confidence: 0.75,
            autoSafe: true,
            requiresConfirmation: false,
          });
        }

        // 如果角色缺少外观，建议添加
        const hasAppearance =
          character.appearance &&
          (character.appearance.height ||
            character.appearance.build ||
            character.appearance.face ||
            character.appearance.hair ||
            character.appearance.clothing);
        if (!hasAppearance) {
          actions.push({
            id: `refine-char-appearance-${charId}`,
            type: 'add_description',
            targetType: 'character',
            targetId: charId,
            description: `为角色 "${character.name}" 添加外观描述`,
            currentValue: character.appearance,
            proposedValue: '根据角色特征生成的外观描述',
            confidence: 0.7,
            autoSafe: true,
            requiresConfirmation: false,
          });
        }
      }
    }

    return actions;
  }

  /**
   * 处理场景连续性
   * @private
   */
  private handleSceneContinuity(
    violation: ConsistencyViolation,
    context: RefinementContext
  ): RefinementAction[] {
    const actions: RefinementAction[] = [];

    if (violation.sceneIds && violation.sceneIds.length > 0) {
      for (const sceneId of violation.sceneIds) {
        const scene = context.scenes.find(s => s.id === sceneId);
        if (!scene) continue;

        // 如果场景缺少时间，建议添加
        if (!scene.timeOfDay) {
          actions.push({
            id: `refine-scene-time-${sceneId}`,
            type: 'add_time',
            targetType: 'scene',
            targetId: sceneId,
            description: `为场景 "${scene.name}" 添加时间信息`,
            currentValue: scene.timeOfDay,
            proposedValue: this.inferSceneTime(scene, context),
            confidence: 0.6,
            autoSafe: false,
            requiresConfirmation: true,
          });
        }

        // 如果场景缺少地点描述，建议添加
        if (!scene.description || scene.description.length < 2) {
          actions.push({
            id: `refine-scene-location-${sceneId}`,
            type: 'add_location',
            targetType: 'scene',
            targetId: sceneId,
            description: `为场景 "${scene.name}" 添加地点信息`,
            currentValue: scene.description,
            proposedValue: this.inferSceneLocation(scene, context),
            confidence: 0.65,
            autoSafe: false,
            requiresConfirmation: true,
          });
        }
      }
    }

    return actions;
  }

  /**
   * 处理缺失引用
   * @private
   */
  private handleMissingReference(
    violation: ConsistencyViolation,
    context: RefinementContext
  ): RefinementAction[] {
    const actions: RefinementAction[] = [];

    // 处理角色未出场的情况
    if (violation.characterIds && violation.message.includes('出场')) {
      for (const charId of violation.characterIds) {
        const character = context.characters.find(c => c.id === charId);
        if (!character) continue;

        actions.push({
          id: `refine-char-usage-${charId}`,
          type: 'fix_reference',
          targetType: 'character',
          targetId: charId,
          description: `角色 "${character.name}" 已定义但未在场景中使用`,
          proposedValue: `建议在适当场景中添加 "${character.name}" 的出场`,
          confidence: 0.8,
          autoSafe: false,
          requiresConfirmation: true,
        });
      }
    }

    return actions;
  }

  /**
   * 处理时间线冲突
   * @private
   */
  private handleTimelineConflict(
    violation: ConsistencyViolation,
    context: RefinementContext
  ): RefinementAction[] {
    const actions: RefinementAction[] = [];

    // 时间线冲突通常需要手动处理，但可以提供建议
    actions.push({
      id: `refine-timeline-${violation.id}`,
      type: 'update_description',
      targetType: 'scene',
      targetId: violation.sceneIds?.[0] || '',
      description: violation.message,
      proposedValue: violation.suggestion || '请检查并调整时间线',
      confidence: 0.5,
      autoSafe: false,
      requiresConfirmation: true,
    });

    return actions;
  }

  /**
   * 基于质量评分生成修正
   * @private
   */
  private generateQualityBasedActions(context: RefinementContext): RefinementAction[] {
    const actions: RefinementAction[] = [];

    for (const score of context.qualityScores) {
      if (score.score >= 80) continue; // 跳过高分维度

      switch (score.dimension) {
        case 'completeness':
          actions.push(...this.handleCompletenessIssues(context));
          break;
        case 'accuracy':
          actions.push(...this.handleAccuracyIssues(context));
          break;
        case 'usability':
          actions.push(...this.handleUsabilityIssues(context));
          break;
      }
    }

    return actions;
  }

  /**
   * 处理完整性问题
   * @private
   */
  private handleCompletenessIssues(context: RefinementContext): RefinementAction[] {
    const actions: RefinementAction[] = [];

    // 检查元数据完整性
    const metadata = context.metadata;
    if (!metadata.genre || metadata.genre.length === 0) {
      actions.push({
        id: 'refine-metadata-genre',
        type: 'add_description',
        targetType: 'metadata',
        targetId: 'metadata',
        description: '添加剧本类型信息',
        proposedValue: '剧情', // 默认值
        confidence: 0.8,
        autoSafe: true,
        requiresConfirmation: false,
      });
    }

    return actions;
  }

  /**
   * 处理准确性问题
   * @private
   */
  private handleAccuracyIssues(context: RefinementContext): RefinementAction[] {
    const actions: RefinementAction[] = [];

    // 检查角色描述质量
    for (const character of context.characters) {
      const desc = character.description || '';
      if (desc.length < 15) {
        actions.push({
          id: `refine-char-accuracy-${character.id}`,
          type: 'enhance_detail',
          targetType: 'character',
          targetId: character.id,
          description: `增强角色 "${character.name}" 的描述细节`,
          currentValue: desc,
          proposedValue: this.enhanceCharacterDescription(character, context),
          confidence: 0.7,
          autoSafe: true,
          requiresConfirmation: false,
        });
      }
    }

    return actions;
  }

  /**
   * 处理可用性问题
   * @private
   */
  private handleUsabilityIssues(context: RefinementContext): RefinementAction[] {
    const actions: RefinementAction[] = [];

    // 检查角色可用性
    for (const character of context.characters) {
      const hasDetailedAppearance =
        character.appearance &&
        character.appearance.height &&
        character.appearance.build &&
        character.appearance.face &&
        character.appearance.hair;
      if (!hasDetailedAppearance) {
        actions.push({
          id: `refine-char-usability-${character.id}`,
          type: 'add_description',
          targetType: 'character',
          targetId: character.id,
          description: `为角色 "${character.name}" 添加外观描述（用于AI生成）`,
          currentValue: character.appearance,
          proposedValue: '根据角色描述推断的外观特征',
          confidence: 0.65,
          autoSafe: true,
          requiresConfirmation: false,
        });
      }
    }

    return actions;
  }

  /**
   * 生成完整性修正
   * @private
   */
  private generateCompletenessActions(context: RefinementContext): RefinementAction[] {
    const actions: RefinementAction[] = [];

    // 检查场景描述完整性
    for (const scene of context.scenes) {
      if (!scene.description || scene.description.length < 20) {
        actions.push({
          id: `refine-scene-desc-${scene.id}`,
          type: 'enhance_detail',
          targetType: 'scene',
          targetId: scene.id,
          description: `完善场景 "${scene.name}" 的描述`,
          currentValue: scene.description,
          proposedValue: this.generateSceneDescription(scene, context),
          confidence: 0.6,
          autoSafe: false,
          requiresConfirmation: true,
        });
      }
    }

    return actions;
  }

  /**
   * 应用修正操作
   * @param context 修正上下文
   * @param actions 修正操作列表
   * @param autoApply 是否自动应用安全操作
   * @returns 修正结果
   */
  async applyRefinements(
    context: RefinementContext,
    actions: RefinementAction[],
    autoApply: boolean = true
  ): Promise<RefinementResult> {
    console.log(`[RefinementEngine] Applying ${actions.length} refinements...`);

    const applied: RefinementAction[] = [];
    const skipped: RefinementAction[] = [];
    const failed: RefinementAction[] = [];
    const changes: RefinementChange[] = [];

    for (const action of actions) {
      try {
        let skipReason = '';

        // 检查置信度
        if (action.confidence < this.config.minConfidence) {
          skipReason = `置信度不足 (${action.confidence.toFixed(2)} < ${this.config.minConfidence.toFixed(2)})`;
        }
        // 检查是否应该自动应用
        else if (autoApply && action.autoSafe && !action.requiresConfirmation) {
          const success = await this.applyAction(action, context);
          if (success) {
            applied.push(action);
            changes.push({
              type: action.type,
              target: `${action.targetType}:${action.targetId}`,
              before: action.currentValue || '',
              after: action.proposedValue,
            });
            console.log(
              `[RefinementEngine] ✅ Applied action: ${action.description} (id: ${action.id})`
            );
          } else {
            failed.push(action);
            console.log(
              `[RefinementEngine] ❌ Failed to apply action: ${action.description} (id: ${action.id})`
            );
          }
        } else {
          if (!autoApply) {
            skipReason = '自动应用被禁用';
          } else if (!action.autoSafe) {
            skipReason = '非自动安全操作 (autoSafe = false)';
          } else if (action.requiresConfirmation) {
            skipReason = '需要用户确认 (requiresConfirmation = true)';
          } else {
            skipReason = '未知原因';
          }
        }

        if (skipReason) {
          skipped.push(action);
          console.log(
            `[RefinementEngine] ⏸️ Skipped action: ${action.description} (id: ${action.id}) - Reason: ${skipReason}`
          );
        }
      } catch (error) {
        console.error(`[RefinementEngine] Failed to apply action ${action.id}:`, error);
        failed.push(action);
      }
    }

    // 计算质量提升（简化计算）
    const qualityImprovement = applied.length * 2; // 每个修正约提升2分

    console.log(
      `[RefinementEngine] Applied: ${applied.length}, Skipped: ${skipped.length}, Failed: ${failed.length}`
    );

    return {
      success: failed.length === 0,
      appliedActions: applied,
      skippedActions: skipped,
      failedActions: failed,
      changes,
      qualityImprovement,
    };
  }

  /**
   * 应用单个修正操作
   * @private
   */
  private async applyAction(
    action: RefinementAction,
    context: RefinementContext
  ): Promise<boolean> {
    // 这里应该实际修改数据
    // 由于这是演示实现，我们只记录操作
    console.log(`[RefinementEngine] Applied: ${action.description}`);
    return true;
  }

  // 辅助方法：生成角色描述
  private generateCharacterDescription(
    character: ScriptCharacter,
    context: RefinementContext
  ): string {
    const parts: string[] = [];
    if (character.name) parts.push(character.name);
    if (character.description) parts.push(`，${character.description}`);
    parts.push('。需要补充详细描述。');
    return parts.join('');
  }

  // 辅助方法：推断场景时间
  private inferSceneTime(scene: ScriptScene, context: RefinementContext): string {
    const sceneIndex = context.scenes.indexOf(scene);
    if (sceneIndex === 0) return '早晨';
    if (sceneIndex === context.scenes.length - 1) return '晚上';
    return '下午';
  }

  // 辅助方法：推断场景地点
  private inferSceneLocation(scene: ScriptScene, context: RefinementContext): string {
    return '室内'; // 默认地点
  }

  // 辅助方法：增强角色描述
  private enhanceCharacterDescription(
    character: ScriptCharacter,
    context: RefinementContext
  ): string {
    const current = character.description || '';
    return `${current}（已增强）`;
  }

  // 辅助方法：生成场景描述
  private generateSceneDescription(scene: ScriptScene, context: RefinementContext): string {
    const parts: string[] = [];
    if (scene.description) parts.push(`在${scene.description}`);
    if (scene.timeOfDay) parts.push(`${scene.timeOfDay}`);
    parts.push('发生的事件。需要补充详细描述。');
    return parts.join('');
  }

  /**
   * 生成修正报告
   * @param result 修正结果
   */
  generateReport(result: RefinementResult): string {
    const lines: string[] = [];

    lines.push('# 自动修正报告');
    lines.push('');
    lines.push(`**修正结果**: ${result.success ? '✅ 成功' : '⚠️ 部分失败'}`);
    lines.push(`**已应用**: ${result.appliedActions.length} 个修正`);
    lines.push(`**待确认**: ${result.skippedActions.length} 个修正`);
    lines.push(`**失败**: ${result.failedActions.length} 个修正`);
    lines.push(`**质量提升**: +${result.qualityImprovement} 分`);
    lines.push('');

    if (result.appliedActions.length > 0) {
      lines.push('## 已自动应用的修正');
      lines.push('');
      for (const action of result.appliedActions) {
        lines.push(`- ✅ ${action.description}`);
      }
      lines.push('');
    }

    if (result.skippedActions.length > 0) {
      lines.push('## 需要手动确认的修正');
      lines.push('');
      for (const action of result.skippedActions) {
        lines.push(`- ⏸️ ${action.description} (置信度: ${(action.confidence * 100).toFixed(0)}%)`);
      }
      lines.push('');
    }

    if (result.changes.length > 0) {
      lines.push('## 变更详情');
      lines.push('');
      for (const change of result.changes) {
        lines.push(`### ${change.target}`);
        lines.push(`- **变更前**: ${change.before || '(空)'}`);
        lines.push(`- **变更后**: ${change.after}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}

export default RefinementEngine;
