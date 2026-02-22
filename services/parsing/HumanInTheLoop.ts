/**
 * Human-in-the-Loop (HITL) System
 *
 * 人工确认门系统 - 关键节点人工审核
 * 基于文档《融合方案_实施细节与代码示例》第3.2节
 *
 * @module services/parsing/HumanInTheLoop
 * @version 1.0.0
 */

import { ScriptCharacter, ScriptScene } from '../../types';

export type HITLStage = 'story_bible' | 'character_design' | 'scene_outline' | 'shot_list';

export interface HITLCheckpoint {
  id: string;
  stage: HITLStage;
  status: 'pending' | 'awaiting_review' | 'approved' | 'rejected' | 'modified';
  data: any;
  submittedAt: number;
  reviewedAt?: number;
  reviewerNotes?: string;
  modifications?: any;
}

export interface StoryBible {
  locked: boolean;
  characters: ScriptCharacter[];
  scenes: ScriptScene[];
  visualStyle: string;
  tone: string;
  targetAudience: string;
  lockedAt?: number;
}

export interface HITLConfig {
  enabled: boolean;
  autoLockAfterApproval: boolean;
  lockTimeout: number; // 锁定超时时间（毫秒）
  requiredStages: HITLStage[];
}

export class HumanInTheLoop {
  private checkpoints: Map<string, HITLCheckpoint> = new Map();
  private storyBible: StoryBible | null = null;
  private config: HITLConfig;

  constructor(config: Partial<HITLConfig> = {}) {
    this.config = {
      enabled: true,
      autoLockAfterApproval: true,
      lockTimeout: 24 * 60 * 60 * 1000, // 24小时
      requiredStages: ['story_bible', 'character_design'],
      ...config
    };
  }

  /**
   * 提交检查点等待审核
   */
  async submitForReview(
    stage: HITLStage,
    data: any,
    options: {
      priority?: 'high' | 'medium' | 'low';
      description?: string;
    } = {}
  ): Promise<HITLCheckpoint> {
    if (!this.config.enabled) {
      // 如果HITL被禁用，自动通过
      return this.autoApprove(stage, data);
    }

    const checkpoint: HITLCheckpoint = {
      id: `${stage}_${Date.now()}`,
      stage,
      status: 'awaiting_review',
      data,
      submittedAt: Date.now()
    };

    this.checkpoints.set(checkpoint.id, checkpoint);

    console.log(`[HITL] Submitted ${stage} for review: ${checkpoint.id}`);

    // 这里可以触发通知（如发送邮件、推送通知等）
    await this.notifyReviewers(checkpoint, options);

    return checkpoint;
  }

  /**
   * 审核检查点
   */
  async review(
    checkpointId: string,
    decision: 'approve' | 'reject' | 'modify',
    options: {
      notes?: string;
      modifications?: any;
    } = {}
  ): Promise<HITLCheckpoint> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    if (checkpoint.status !== 'awaiting_review') {
      throw new Error(`Checkpoint ${checkpointId} is not awaiting review`);
    }

    checkpoint.reviewedAt = Date.now();
    checkpoint.reviewerNotes = options.notes;

    switch (decision) {
      case 'approve':
        checkpoint.status = 'approved';
        
        // 如果是故事圣经，自动锁定
        if (checkpoint.stage === 'story_bible' && this.config.autoLockAfterApproval) {
          await this.lockStoryBible(checkpoint.data);
        }
        break;

      case 'reject':
        checkpoint.status = 'rejected';
        break;

      case 'modify':
        checkpoint.status = 'modified';
        checkpoint.modifications = options.modifications;
        checkpoint.data = { ...checkpoint.data, ...options.modifications };
        break;
    }

    console.log(`[HITL] Reviewed ${checkpointId}: ${decision}`);

    return checkpoint;
  }

  /**
   * 锁定故事圣经
   */
  async lockStoryBible(data: StoryBible): Promise<void> {
    this.storyBible = {
      ...data,
      locked: true,
      lockedAt: Date.now()
    };

    console.log('[HITL] Story Bible locked');
  }

  /**
   * 解锁故事圣经（需要特殊权限）
   */
  async unlockStoryBible(reason: string): Promise<void> {
    if (!this.storyBible?.locked) {
      return;
    }

    // 检查是否超过锁定超时时间
    if (this.storyBible.lockedAt) {
      const elapsed = Date.now() - this.storyBible.lockedAt;
      if (elapsed < this.config.lockTimeout) {
        console.warn(`[HITL] Attempting to unlock Story Bible before timeout: ${reason}`);
        // 可以在这里添加额外的权限检查
      }
    }

    this.storyBible.locked = false;
    console.log(`[HITL] Story Bible unlocked: ${reason}`);
  }

  /**
   * 检查故事圣经是否已锁定
   */
  isStoryBibleLocked(): boolean {
    return this.storyBible?.locked || false;
  }

  /**
   * 获取锁定的故事圣经
   */
  getLockedStoryBible(): StoryBible | null {
    return this.storyBible;
  }

  /**
   * 获取检查点状态
   */
  getCheckpoint(checkpointId: string): HITLCheckpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  /**
   * 获取所有检查点
   */
  getAllCheckpoints(): HITLCheckpoint[] {
    return Array.from(this.checkpoints.values());
  }

  /**
   * 获取待审核的检查点
   */
  getPendingCheckpoints(): HITLCheckpoint[] {
    return this.getAllCheckpoints().filter(cp => cp.status === 'awaiting_review');
  }

  /**
   * 检查阶段是否需要人工审核
   */
  isStageRequired(stage: HITLStage): boolean {
    return this.config.requiredStages.includes(stage);
  }

  /**
   * 等待审核完成
   */
  async waitForReview(checkpointId: string, timeout?: number): Promise<HITLCheckpoint> {
    const startTime = Date.now();
    const timeoutMs = timeout || 5 * 60 * 1000; // 默认5分钟超时

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const checkpoint = this.checkpoints.get(checkpointId);
        
        if (!checkpoint) {
          clearInterval(checkInterval);
          reject(new Error(`Checkpoint ${checkpointId} not found`));
          return;
        }

        if (checkpoint.status !== 'awaiting_review') {
          clearInterval(checkInterval);
          resolve(checkpoint);
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          reject(new Error(`Timeout waiting for review of ${checkpointId}`));
        }
      }, 1000);
    });
  }

  /**
   * 批量审核
   */
  async batchReview(
    checkpointIds: string[],
    decision: 'approve' | 'reject',
    options: { notes?: string } = {}
  ): Promise<HITLCheckpoint[]> {
    const results: HITLCheckpoint[] = [];
    
    for (const id of checkpointIds) {
      try {
        const result = await this.review(id, decision, options);
        results.push(result);
      } catch (e) {
        console.error(`[HITL] Failed to review ${id}:`, e);
      }
    }

    return results;
  }

  /**
   * 导出审核报告
   */
  generateReport(): {
    totalCheckpoints: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    modifiedCount: number;
    averageReviewTime: number;
  } {
    const checkpoints = this.getAllCheckpoints();
    
    const pendingCount = checkpoints.filter(cp => cp.status === 'awaiting_review').length;
    const approvedCount = checkpoints.filter(cp => cp.status === 'approved').length;
    const rejectedCount = checkpoints.filter(cp => cp.status === 'rejected').length;
    const modifiedCount = checkpoints.filter(cp => cp.status === 'modified').length;

    // 计算平均审核时间
    const reviewedCheckpoints = checkpoints.filter(cp => cp.reviewedAt && cp.submittedAt);
    const totalReviewTime = reviewedCheckpoints.reduce((sum, cp) => {
      return sum + ((cp.reviewedAt || 0) - cp.submittedAt);
    }, 0);
    const averageReviewTime = reviewedCheckpoints.length > 0 
      ? totalReviewTime / reviewedCheckpoints.length 
      : 0;

    return {
      totalCheckpoints: checkpoints.length,
      pendingCount,
      approvedCount,
      rejectedCount,
      modifiedCount,
      averageReviewTime
    };
  }

  /**
   * 自动批准（当HITL被禁用时使用）
   */
  private autoApprove(stage: HITLStage, data: any): HITLCheckpoint {
    const checkpoint: HITLCheckpoint = {
      id: `${stage}_${Date.now()}_auto`,
      stage,
      status: 'approved',
      data,
      submittedAt: Date.now(),
      reviewedAt: Date.now(),
      reviewerNotes: 'Auto-approved (HITL disabled)'
    };

    this.checkpoints.set(checkpoint.id, checkpoint);
    
    if (stage === 'story_bible') {
      this.lockStoryBible(data);
    }

    return checkpoint;
  }

  /**
   * 通知审核者
   */
  private async notifyReviewers(
    checkpoint: HITLCheckpoint,
    options: { priority?: 'high' | 'medium' | 'low'; description?: string }
  ): Promise<void> {
    // 这里可以实现实际的通知逻辑
    // 例如：发送邮件、推送通知、WebSocket广播等
    console.log(`[HITL] Notification sent for ${checkpoint.id} (${options.priority || 'normal'} priority)`);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<HITLConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): HITLConfig {
    return { ...this.config };
  }

  /**
   * 清除所有检查点
   */
  clear(): void {
    this.checkpoints.clear();
    this.storyBible = null;
  }
}

// 导出单例实例
export const humanInTheLoop = new HumanInTheLoop();
