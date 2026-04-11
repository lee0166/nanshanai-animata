/**
 * TimeEstimator - 时间预估器
 *
 * 基于历史数据预估各阶段耗时和总剩余时间
 *
 * @module services/parsing/TimeEstimator
 * @version 1.0.0
 */

import type { ParseStage } from '../../types';

export interface StageDurationRecord {
  stage: ParseStage;
  duration: number; // 毫秒
  timestamp: number;
  contentLength?: number; // 文本长度（用于更准确的预估）
}

export interface TimeEstimate {
  /** 预估剩余时间（毫秒） */
  remainingTime: number;
  /** 预估总时间（毫秒） */
  totalEstimatedTime: number;
  /** 已耗时（毫秒） */
  elapsedTime: number;
  /** 当前阶段预估剩余时间 */
  currentStageRemaining: number;
  /** 后续阶段预估时间 */
  pendingStagesTime: number;
  /** 置信度 (0-1) */
  confidence: number;
}

export interface TimeEstimatorConfig {
  /** 历史记录最大数量 */
  maxHistoryRecords: number;
  /** 历史记录有效期（毫秒） */
  historyExpiry: number;
  /** 最小记录数用于预估 */
  minRecordsForEstimate: number;
  /** 是否考虑文本长度 */
  considerContentLength: boolean;
}

export const DEFAULT_TIME_ESTIMATOR_CONFIG: TimeEstimatorConfig = {
  maxHistoryRecords: 20,
  historyExpiry: 7 * 24 * 60 * 60 * 1000, // 7天
  minRecordsForEstimate: 3,
  considerContentLength: true,
};

/**
 * 时间预估器类
 */
export class TimeEstimator {
  private config: TimeEstimatorConfig;
  private history: Map<ParseStage, StageDurationRecord[]> = new Map();
  private currentStageStartTime: number = 0;
  private currentStage: ParseStage | null = null;
  private parseStartTime: number = 0;

  constructor(config: Partial<TimeEstimatorConfig> = {}) {
    this.config = { ...DEFAULT_TIME_ESTIMATOR_CONFIG, ...config };
  }

  /**
   * 开始解析计时
   */
  startParse(): void {
    this.parseStartTime = Date.now();
  }

  /**
   * 开始阶段计时
   * @param stage 阶段
   */
  startStage(stage: ParseStage): void {
    this.currentStage = stage;
    this.currentStageStartTime = Date.now();
  }

  /**
   * 结束阶段计时并记录
   * @param stage 阶段
   * @param contentLength 文本长度（可选）
   */
  endStage(stage: ParseStage, contentLength?: number): void {
    const duration = Date.now() - this.currentStageStartTime;

    const record: StageDurationRecord = {
      stage,
      duration,
      timestamp: Date.now(),
      contentLength,
    };

    this.addRecord(stage, record);

    if (this.currentStage === stage) {
      this.currentStage = null;
    }
  }

  /**
   * 添加历史记录
   */
  private addRecord(stage: ParseStage, record: StageDurationRecord): void {
    if (!this.history.has(stage)) {
      this.history.set(stage, []);
    }

    const records = this.history.get(stage)!;
    records.push(record);

    // 清理过期记录和超出数量限制的记录
    this.cleanOldRecords(stage);
  }

  /**
   * 清理过期记录
   */
  private cleanOldRecords(stage: ParseStage): void {
    const records = this.history.get(stage);
    if (!records) return;

    const now = Date.now();
    const expiry = this.config.historyExpiry;

    // 过滤过期记录
    const validRecords = records.filter(r => now - r.timestamp < expiry);

    // 保留最近的记录
    if (validRecords.length > this.config.maxHistoryRecords) {
      validRecords.splice(0, validRecords.length - this.config.maxHistoryRecords);
    }

    this.history.set(stage, validRecords);
  }

  /**
   * 预估阶段耗时
   * @param stage 阶段
   * @param contentLength 当前文本长度（用于调整预估）
   * @returns 预估耗时（毫秒）
   */
  estimateStageDuration(stage: ParseStage, contentLength?: number): number {
    const records = this.history.get(stage);

    if (!records || records.length < this.config.minRecordsForEstimate) {
      // 没有足够历史数据，返回默认值
      return this.getDefaultStageDuration(stage);
    }

    // 使用中位数计算，避免异常值影响
    const durations = records.map(r => r.duration).sort((a, b) => a - b);
    const median = durations[Math.floor(durations.length / 2)];

    // 如果提供了文本长度，进行长度调整
    if (this.config.considerContentLength && contentLength !== undefined) {
      const avgLength =
        records.reduce((sum, r) => sum + (r.contentLength || contentLength), 0) / records.length;
      if (avgLength > 0) {
        const lengthRatio = contentLength / avgLength;
        // 使用平方根调整，因为处理时间不会线性增长
        const adjustedRatio = Math.sqrt(lengthRatio);
        return median * adjustedRatio;
      }
    }

    return median;
  }

  /**
   * 获取默认阶段耗时（无历史数据时使用）
   */
  private getDefaultStageDuration(stage: ParseStage): number {
    const defaults: Record<ParseStage, number> = {
      idle: 0,
      metadata: 5000, // 5 秒
      characters: 15000, // 15 秒
      scenes: 15000, // 15 秒
      items: 5000, // 5 秒
      shots: 30000, // 30 秒
      refinement: 5000, // 5 秒
      budget: 2000, // 2 秒
      episode_planning: 5000, // 5 秒
      episode_planning_phase2: 3000, // 3 秒
      coherence_check: 5000, // 5 秒
      completed: 0,
      error: 0,
    };
    return defaults[stage] || 10000;
  }

  /**
   * 预估总剩余时间
   * @param currentStage 当前阶段
   * @param currentStageProgress 当前阶段进度 (0-1)
   * @param pendingStages 待处理阶段列表
   * @param contentLength 文本长度
   * @returns 时间预估结果
   */
  estimateRemainingTime(
    currentStage: ParseStage,
    currentStageProgress: number,
    pendingStages: ParseStage[],
    contentLength?: number
  ): TimeEstimate {
    const now = Date.now();
    const elapsedTime = now - this.parseStartTime;

    // 当前阶段预估总耗时
    const currentStageEstimated = this.estimateStageDuration(currentStage, contentLength);

    // 当前阶段剩余时间
    const currentStageRemaining =
      currentStageEstimated * (1 - Math.min(1, Math.max(0, currentStageProgress)));

    // 后续阶段预估时间
    let pendingStagesTime = 0;
    for (const stage of pendingStages) {
      pendingStagesTime += this.estimateStageDuration(stage, contentLength);
    }

    // 总剩余时间
    const remainingTime = currentStageRemaining + pendingStagesTime;

    // 预估总时间
    const totalEstimatedTime = elapsedTime + remainingTime;

    // 计算置信度（基于历史数据量）
    const currentStageRecords = this.history.get(currentStage)?.length || 0;
    const confidence = Math.min(1, currentStageRecords / (this.config.minRecordsForEstimate * 2));

    return {
      remainingTime,
      totalEstimatedTime,
      elapsedTime,
      currentStageRemaining,
      pendingStagesTime,
      confidence,
    };
  }

  /**
   * 格式化时间显示
   * @param ms 毫秒
   * @returns 格式化字符串
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) {
      return '少于1秒';
    }

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}分${minutes % 60}秒`;
    } else if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }

  /**
   * 格式化时间显示（简短版本）
   */
  static formatDurationShort(ms: number): string {
    if (ms < 1000) {
      return '<1s';
    }

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}m${minutes % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * 获取历史记录统计
   */
  getHistoryStats(): Record<
    ParseStage,
    { count: number; avgDuration: number; lastRecord: number }
  > {
    const stats: Record<ParseStage, { count: number; avgDuration: number; lastRecord: number }> =
      {} as any;

    for (const [stage, records] of this.history.entries()) {
      if (records.length === 0) continue;

      const totalDuration = records.reduce((sum, r) => sum + r.duration, 0);
      const avgDuration = totalDuration / records.length;
      const lastRecord = records[records.length - 1].timestamp;

      stats[stage] = {
        count: records.length,
        avgDuration,
        lastRecord,
      };
    }

    return stats;
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.history.clear();
  }
}

/**
 * 创建时间预估器实例的工厂函数
 */
export function createTimeEstimator(config?: Partial<TimeEstimatorConfig>): TimeEstimator {
  return new TimeEstimator(config);
}
