/**
 * TransactionManager - 事务管理器（简化版）
 *
 * 提供解析过程中的检查点保存和回滚功能
 * 确保数据一致性和断点续传能力
 *
 * @module services/parsing/TransactionManager
 * @version 1.0.0
 */

import { ScriptParseState, ParseStage } from '../../types';
import { storageService } from '../../services/storage';
import { DataIntegrityChecker, dataIntegrityChecker } from './DataIntegrityChecker';

/**
 * 事务检查点
 */
export interface TransactionCheckpoint {
  /** 检查点 ID */
  checkpointId: string;
  /** 脚本 ID */
  scriptId: string;
  /** 项目 ID */
  projectId: string;
  /** 检查点时间戳 */
  timestamp: number;
  /** 解析阶段 */
  stage: ParseStage;
  /** 进度百分比 */
  progress: number;
  /** 状态快照 */
  snapshot: ScriptParseState;
  /** 检查点校验和 */
  checksum: string;
}

/**
 * 事务管理器配置
 */
export interface TransactionManagerConfig {
  /** 是否启用检查点保存，默认 true */
  enableCheckpoint?: boolean;
  /** 检查点保存间隔（毫秒），默认 5000ms */
  checkpointInterval?: number;
  /** 最大检查点数量，默认 3 */
  maxCheckpoints?: number;
  /** 是否启用回滚，默认 true */
  enableRollback?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<TransactionManagerConfig> = {
  enableCheckpoint: true,
  checkpointInterval: 5000,
  maxCheckpoints: 3,
  enableRollback: true,
};

/**
 * 事务管理器类
 *
 * 使用场景：
 * 1. 长文本解析过程中定期保存检查点
 * 2. 解析失败时回滚到最近的检查点
 * 3. 支持断点续传
 *
 * @example
 * ```typescript
 * const txManager = new TransactionManager(scriptId, projectId);
 *
 * // 开始事务
 * await txManager.beginTransaction();
 *
 * // 保存检查点
 * await txManager.saveCheckpoint(state);
 *
 * // 发生错误时回滚
 * if (error) {
 *   await txManager.rollback();
 * }
 *
 * // 提交事务
 * await txManager.commit(finalState);
 * ```
 */
export class TransactionManager {
  private scriptId: string;
  private projectId: string;
  private config: Required<TransactionManagerConfig>;
  private checkpoints: TransactionCheckpoint[] = [];
  private transactionId: string;
  private transactionStartTime: number;
  private integrityChecker: DataIntegrityChecker;

  /**
   * 构造函数
   * @param scriptId - 脚本 ID
   * @param projectId - 项目 ID
   * @param config - 配置选项
   */
  constructor(scriptId: string, projectId: string, config: TransactionManagerConfig = {}) {
    this.scriptId = scriptId;
    this.projectId = projectId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.transactionId = `${scriptId}-${projectId}-${Date.now()}`;
    this.transactionStartTime = Date.now();
    this.integrityChecker = dataIntegrityChecker;

    console.log(`[TransactionManager] Initialized for script ${scriptId}, project ${projectId}`);
  }

  /**
   * 开始事务
   */
  async beginTransaction(): Promise<void> {
    console.log(`[TransactionManager] Beginning transaction ${this.transactionId}`);
    this.transactionStartTime = Date.now();
    this.checkpoints = [];
  }

  /**
   * 保存检查点
   *
   * @param state - 当前解析状态
   * @returns 检查点 ID
   */
  async saveCheckpoint(state: ScriptParseState): Promise<string> {
    if (!this.config.enableCheckpoint) {
      return '';
    }

    const checkpointId = `${this.transactionId}-checkpoint-${this.checkpoints.length + 1}`;

    // 创建状态快照（深拷贝）
    const snapshot = JSON.parse(JSON.stringify(state));

    // 计算快照校验和
    const checksumResult = this.integrityChecker.calculateChecksum(snapshot);

    const checkpoint: TransactionCheckpoint = {
      checkpointId,
      scriptId: this.scriptId,
      projectId: this.projectId,
      timestamp: Date.now(),
      stage: state.stage,
      progress: state.progress,
      snapshot,
      checksum: checksumResult.checksum,
    };

    // 添加到检查点列表
    this.checkpoints.push(checkpoint);

    // 限制检查点数量
    if (this.checkpoints.length > this.config.maxCheckpoints) {
      this.checkpoints.shift(); // 移除最旧的检查点
    }

    // 异步保存到存储（不阻塞主流程）
    this.saveCheckpointToStorage(checkpoint).catch(err => {
      console.warn('[TransactionManager] Failed to save checkpoint to storage:', err);
    });

    console.log(
      `[TransactionManager] Checkpoint saved: ${checkpointId} (stage: ${state.stage}, progress: ${state.progress}%)`
    );

    return checkpointId;
  }

  /**
   * 回滚到最近的检查点
   *
   * @returns 回滚后的状态，如果无检查点则返回 null
   */
  async rollback(): Promise<ScriptParseState | null> {
    if (!this.config.enableRollback || this.checkpoints.length === 0) {
      return null;
    }

    // 获取最近的检查点
    const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];

    // 验证检查点完整性
    const isValid = this.integrityChecker.verifyDataIntegrity(lastCheckpoint.snapshot);
    if (!isValid) {
      console.error(
        `[TransactionManager] Checkpoint integrity check failed: ${lastCheckpoint.checkpointId}`
      );
      // 尝试前一个检查点
      if (this.checkpoints.length > 1) {
        return this.rollbackToPreviousCheckpoint();
      }
      return null;
    }

    console.log(
      `[TransactionManager] Rolling back to checkpoint: ${lastCheckpoint.checkpointId} (stage: ${lastCheckpoint.stage}, progress: ${lastCheckpoint.progress}%)`
    );

    // 返回检查点状态
    return lastCheckpoint.snapshot;
  }

  /**
   * 回滚到前一个检查点
   * @private
   */
  private rollbackToPreviousCheckpoint(): ScriptParseState | null {
    if (this.checkpoints.length < 2) {
      return null;
    }

    const previousCheckpoint = this.checkpoints[this.checkpoints.length - 2];
    const isValid = this.integrityChecker.verifyDataIntegrity(previousCheckpoint.snapshot);

    if (!isValid) {
      console.error(
        `[TransactionManager] Previous checkpoint integrity check failed: ${previousCheckpoint.checkpointId}`
      );
      return null;
    }

    console.log(
      `[TransactionManager] Rolling back to previous checkpoint: ${previousCheckpoint.checkpointId}`
    );

    return previousCheckpoint.snapshot;
  }

  /**
   * 提交事务
   *
   * @param finalState - 最终状态
   */
  async commit(finalState: ScriptParseState): Promise<void> {
    console.log(
      `[TransactionManager] Committing transaction ${this.transactionId} (duration: ${Date.now() - this.transactionStartTime}ms)`
    );

    // 保存最终检查点
    await this.saveCheckpoint(finalState);

    // 清理检查点（可选，保留一段时间用于恢复）
    // this.checkpoints = [];
  }

  /**
   * 获取检查点数量
   */
  getCheckpointCount(): number {
    return this.checkpoints.length;
  }

  /**
   * 获取最近的检查点
   */
  getLatestCheckpoint(): TransactionCheckpoint | null {
    return this.checkpoints.length > 0 ? this.checkpoints[this.checkpoints.length - 1] : null;
  }

  /**
   * 清除所有检查点
   */
  clearCheckpoints(): void {
    this.checkpoints = [];
    console.log('[TransactionManager] All checkpoints cleared');
  }

  /**
   * 保存检查点到存储（异步）
   * @private
   */
  private async saveCheckpointToStorage(checkpoint: TransactionCheckpoint): Promise<void> {
    try {
      const storageKey = `transaction-checkpoint:${this.scriptId}:${this.projectId}`;
      await storageService.save(storageKey, checkpoint);
      console.log(
        `[TransactionManager] Checkpoint persisted to storage: ${checkpoint.checkpointId}`
      );
    } catch (error) {
      console.warn('[TransactionManager] Failed to persist checkpoint:', error);
      // 不抛出异常，避免影响主流程
    }
  }

  /**
   * 从存储中恢复检查点
   * @static
   */
  static async restoreCheckpointFromStorage(
    scriptId: string,
    projectId: string
  ): Promise<TransactionCheckpoint | null> {
    try {
      const storageKey = `transaction-checkpoint:${scriptId}:${projectId}`;
      const checkpoint = await storageService.load<TransactionCheckpoint>(storageKey);

      if (checkpoint) {
        console.log(
          `[TransactionManager] Restored checkpoint from storage: ${checkpoint.checkpointId}`
        );
        return checkpoint;
      }
    } catch (error) {
      console.warn('[TransactionManager] Failed to restore checkpoint:', error);
    }

    return null;
  }
}
