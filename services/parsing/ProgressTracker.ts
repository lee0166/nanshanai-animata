/**
 * ProgressTracker - 进度追踪核心类
 *
 * 提供细粒度的进度追踪和计算，支持平滑动画和时间预估
 *
 * @module services/parsing/ProgressTracker
 * @version 1.0.0
 */

import type { ParseStage } from '../../types';
import type { ParseProgressCallback } from '../scriptParser';
import {
  type ProgressTrackerConfig,
  DEFAULT_PROGRESS_TRACKER_CONFIG,
  getAdaptiveStageWeights,
  validateStageWeights,
} from './ProgressTrackerConfig';
import { SmoothProgressAnimator } from './SmoothProgressAnimator';
import { TimeEstimator } from './TimeEstimator';

/**
 * 阶段状态
 */
export interface StageState {
  stage: ParseStage;
  progress: number; // 0-1
  status: 'pending' | 'processing' | 'completed' | 'error';
  startTime?: number;
  endTime?: number;
  subTasks?: SubTaskState[];
  currentSubTask?: string;
}

/**
 * 子任务状态
 */
export interface SubTaskState {
  name: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

/**
 * 进度详情
 */
export interface ProgressDetails {
  currentStage: ParseStage;
  currentStageProgress: number;
  completedStages: ParseStage[];
  pendingStages: ParseStage[];
  subTaskInfo?: {
    current: number;
    total: number;
    currentName?: string;
  };
  timeEstimate?: {
    elapsed: number;
    remaining: number;
    formatted: string;
  };
}

/**
 * 进度追踪器类
 */
export class ProgressTracker {
  private config: ProgressTrackerConfig;
  private stageWeights: Record<ParseStage, number>;
  private stageStates: Map<ParseStage, StageState> = new Map();
  private currentStage: ParseStage = 'idle';
  private overallProgress: number = 0;
  private startTime: number = 0;
  private lastEmitTime: number = 0;
  private lastEmittedProgress: number = 0;
  private lastEmittedMessage: string | undefined;
  private onProgressCallback: ParseProgressCallback | null = null;
  private animator: SmoothProgressAnimator;
  private timeEstimator: TimeEstimator;
  private isTracking: boolean = false;
  private contentLength: number = 0;

  constructor(contentLength: number = 0, config: Partial<ProgressTrackerConfig> = {}) {
    this.contentLength = contentLength;
    this.config = { ...DEFAULT_PROGRESS_TRACKER_CONFIG, ...config };

    // 根据文本长度获取自适应权重
    this.stageWeights = getAdaptiveStageWeights(contentLength);

    // 验证权重配置
    if (!validateStageWeights(this.stageWeights)) {
      console.warn('[ProgressTracker] Stage weights do not sum to 1, using defaults');
      this.stageWeights = getAdaptiveStageWeights(5000); // 使用默认权重
    }

    // 初始化动画器
    this.animator = new SmoothProgressAnimator({
      updateInterval: this.config.minUpdateInterval,
      easingType: 'easeOutCubic',
      minDelta: this.config.minProgressDelta,
      maxDelta: 5,
    });

    // 初始化时间预估器
    this.timeEstimator = new TimeEstimator({
      maxHistoryRecords: this.config.maxHistoryRecords,
      considerContentLength: true,
    });

    // 初始化阶段状态
    this.initializeStageStates();
  }

  /**
   * 初始化阶段状态
   */
  private initializeStageStates(): void {
    const stages: ParseStage[] = [
      'metadata',
      'characters',
      'scenes',
      'items',
      'shots',
      'refinement',
      'budget',
    ];

    for (const stage of stages) {
      this.stageStates.set(stage, {
        stage,
        progress: 0,
        status: 'pending',
      });
    }
  }

  /**
   * 开始追踪
   * @param onProgress 进度回调
   */
  start(onProgress: ParseProgressCallback): void {
    console.log(`[ProgressTracker] start() called, onProgress callback: ${!!onProgress}`);
    this.isTracking = true;
    this.startTime = Date.now();
    this.onProgressCallback = onProgress;
    this.currentStage = 'idle';
    this.overallProgress = 0;
    this.lastEmittedProgress = 0;

    // 开始时间预估
    this.timeEstimator.startParse();

    // 初始化所有阶段为pending
    this.initializeStageStates();

    // 立即触发一次回调
    console.log(`[ProgressTracker] Calling emitProgress('正在初始化...')`);
    this.emitProgress('正在初始化...');
  }

  /**
   * 停止追踪
   */
  stop(): void {
    this.isTracking = false;
    this.animator.stop();
    this.onProgressCallback = null;
  }

  /**
   * 开始一个新阶段
   * @param stage 阶段
   * @param totalSubTasks 子任务总数（可选）
   */
  startStage(stage: ParseStage, totalSubTasks?: number): void {
    if (!this.isTracking) return;

    // 结束当前阶段
    if (this.currentStage !== 'idle' && this.currentStage !== stage) {
      this.endStage(this.currentStage);
    }

    this.currentStage = stage;
    const stageState = this.stageStates.get(stage);

    if (stageState) {
      stageState.status = 'processing';
      stageState.startTime = Date.now();
      stageState.progress = 0;

      // 初始化子任务
      if (totalSubTasks && totalSubTasks > 0) {
        stageState.subTasks = Array.from({ length: totalSubTasks }, (_, i) => ({
          name: `task-${i + 1}`,
          progress: 0,
          status: 'pending',
        }));
      }
    }

    // 开始时间预估的阶段计时
    this.timeEstimator.startStage(stage);

    // 计算并发送进度
    this.calculateAndEmitProgress();
  }

  /**
   * 结束一个阶段
   * @param stage 阶段
   */
  endStage(stage: ParseStage): void {
    const stageState = this.stageStates.get(stage);

    if (stageState) {
      stageState.status = 'completed';
      stageState.progress = 1;
      stageState.endTime = Date.now();
    }

    // 记录阶段耗时
    this.timeEstimator.endStage(stage, this.contentLength);
  }

  /**
   * 更新阶段进度
   * @param stage 阶段
   * @param progress 进度 (0-1)
   * @param message 消息
   */
  updateStageProgress(stage: ParseStage, progress: number, message?: string): void {
    if (!this.isTracking) return;

    const stageState = this.stageStates.get(stage);
    if (stageState) {
      stageState.progress = Math.max(0, Math.min(1, progress));
    }

    this.calculateAndEmitProgress(message);
  }

  /**
   * 基于工作单元更新进度
   * @param stage 阶段
   * @param completed 已完成数量
   * @param total 总数
   * @param currentItemName 当前项名称
   */
  updateByWorkUnit(
    stage: ParseStage,
    completed: number,
    total: number,
    currentItemName?: string
  ): void {
    if (!this.isTracking || total <= 0) return;

    const progress = completed / total;
    const stageState = this.stageStates.get(stage);

    if (stageState) {
      stageState.progress = progress;
      stageState.currentSubTask = currentItemName;
    }

    const message = currentItemName
      ? `正在处理 ${currentItemName} (${completed}/${total})`
      : `正在处理 (${completed}/${total})`;

    this.calculateAndEmitProgress(message);
  }

  /**
   * 更新子任务进度
   * @param stage 阶段
   * @param subTaskIndex 子任务索引
   * @param progress 进度 (0-1)
   * @param status 状态
   */
  updateSubTask(
    stage: ParseStage,
    subTaskIndex: number,
    progress: number,
    status: SubTaskState['status'] = 'processing'
  ): void {
    const stageState = this.stageStates.get(stage);
    if (!stageState || !stageState.subTasks) return;

    const subTask = stageState.subTasks[subTaskIndex];
    if (subTask) {
      subTask.progress = Math.max(0, Math.min(1, progress));
      subTask.status = status;
    }

    // 重新计算阶段进度
    const completedSubTasks = stageState.subTasks.filter(st => st.status === 'completed').length;
    const totalSubTasks = stageState.subTasks.length;

    stageState.progress = completedSubTasks / totalSubTasks;

    this.calculateAndEmitProgress();
  }

  /**
   * 在API等待期间启动平滑动画
   * @param expectedDuration 预期持续时间（毫秒）
   */
  startSmoothAnimation(expectedDuration: number): void {
    if (!this.isTracking) return;

    const currentStageProgress = this.getStageProgress(this.currentStage);
    const targetProgress = Math.min(0.95, currentStageProgress + 0.1); // 最多增加到95%

    this.animator.start(
      currentStageProgress * 100,
      targetProgress * 100,
      expectedDuration,
      progress => {
        this.updateStageProgress(this.currentStage, progress / 100, '正在等待响应...');
      }
    );
  }

  /**
   * 停止平滑动画
   */
  stopSmoothAnimation(): void {
    this.animator.stop();
  }

  /**
   * 完成追踪
   */
  complete(): void {
    if (!this.isTracking) return;

    // 结束当前阶段
    if (this.currentStage !== 'idle') {
      this.endStage(this.currentStage);
    }

    // 设置总进度为100%
    this.overallProgress = 100;

    // 停止动画
    this.animator.stop();

    // 发送最终进度
    this.emitProgress('解析完成！', {
      elapsedTime: Date.now() - this.startTime,
    });

    this.isTracking = false;
  }

  /**
   * 报告错误
   * @param error 错误信息
   */
  reportError(error: string): void {
    if (!this.isTracking) return;

    const stageState = this.stageStates.get(this.currentStage);
    if (stageState) {
      stageState.status = 'error';
    }

    this.emitProgress(`错误: ${error}`);
  }

  /**
   * 计算并发送进度 - 完全无节流！
   */
  private calculateAndEmitProgress(message?: string): void {
    const newProgress = this.calculateOverallProgress();
    console.log(`[ProgressTracker] calculateAndEmitProgress: newProgress=${newProgress}%`);

    // 完全禁用节流！每次都发送更新！
    this.overallProgress = newProgress;
    this.lastEmittedProgress = newProgress;
    this.lastEmittedMessage = message;

    console.log(`[ProgressTracker] Calling emitProgress(${message})`);
    this.emitProgress(message);
  }

  /**
   * 计算总进度
   */
  private calculateOverallProgress(): number {
    let totalProgress = 0;

    for (const [stage, weight] of Object.entries(this.stageWeights)) {
      const stageState = this.stageStates.get(stage as ParseStage);
      const stageProgress = stageState?.progress || 0;
      totalProgress += weight * stageProgress;
    }

    // 转换为百分比并限制在0-99之间（100%只在完成时设置）
    return Math.min(99, Math.round(totalProgress * 100));
  }

  /**
   * 发送进度回调 - 完全无节流！
   */
  private emitProgress(message?: string, extraDetails?: Record<string, any>): void {
    console.log(`[ProgressTracker] emitProgress() called: currentStage=${this.currentStage}, overallProgress=${this.overallProgress}%`);
    console.log(`[ProgressTracker] onProgressCallback exists: ${!!this.onProgressCallback}`);
    
    if (!this.onProgressCallback) {
      console.log(`[ProgressTracker] No callback registered, skipping emit`);
      return;
    }

    const details = this.buildProgressDetails();
    console.log(`[ProgressTracker] Built details:`, details);
    
    const timeEstimate = this.config.enableTimeEstimation
      ? this.calculateTimeEstimate()
      : undefined;

    const finalMessage = message || this.getDefaultMessage();
    
    console.log(`[ProgressTracker] Calling onProgressCallback with: stage=${this.currentStage}, progress=${this.overallProgress}%, message=${finalMessage}`);

    this.onProgressCallback(this.currentStage, this.overallProgress, finalMessage, {
      ...details,
      ...timeEstimate,
      ...extraDetails,
    });
    
    console.log(`[ProgressTracker] onProgressCallback called successfully`);
  }

  /**
   * 构建进度详情
   */
  private buildProgressDetails(): Record<string, any> {
    const currentStageState = this.stageStates.get(this.currentStage);
    const completedStages: ParseStage[] = [];
    const pendingStages: ParseStage[] = [];

    for (const [stage, state] of this.stageStates.entries()) {
      if (state.status === 'completed') {
        completedStages.push(stage);
      } else if (state.status === 'pending') {
        pendingStages.push(stage);
      }
    }

    const details: Record<string, any> = {
      currentStage: this.currentStage,
      currentStageProgress: Math.round((currentStageState?.progress || 0) * 100),
      completedStages,
      pendingStages,
    };

    // 添加子任务信息
    if (currentStageState?.subTasks) {
      const currentSubTaskIndex = currentStageState.subTasks.findIndex(
        st => st.status === 'processing'
      );
      const completedCount = currentStageState.subTasks.filter(
        st => st.status === 'completed'
      ).length;

      details.subTaskInfo = {
        current: currentSubTaskIndex >= 0 ? currentSubTaskIndex : completedCount,
        total: currentStageState.subTasks.length,
        currentName: currentStageState.currentSubTask,
      };
    }

    return details;
  }

  /**
   * 计算时间预估
   */
  private calculateTimeEstimate(): Record<string, any> | undefined {
    const currentStageState = this.stageStates.get(this.currentStage);
    if (!currentStageState) return undefined;

    const pendingStages: ParseStage[] = [];
    for (const [stage, state] of this.stageStates.entries()) {
      if (state.status === 'pending') {
        pendingStages.push(stage);
      }
    }

    const estimate = this.timeEstimator.estimateRemainingTime(
      this.currentStage,
      currentStageState.progress,
      pendingStages,
      this.contentLength
    );

    return {
      elapsedTime: estimate.elapsedTime,
      estimatedRemainingTime: Math.round(estimate.remainingTime / 1000), // 转换为秒
      timeEstimateFormatted: TimeEstimator.formatDuration(estimate.remainingTime),
      confidence: estimate.confidence,
    };
  }

  /**
   * 获取默认消息
   */
  private getDefaultMessage(): string {
    const stageMessages: Record<ParseStage, string> = {
      idle: '准备中...',
      metadata: '正在提取元数据...',
      characters: '正在分析角色...',
      scenes: '正在分析场景...',
      items: '正在提取物品...',
      shots: '正在生成分镜...',
      refinement: '正在优化结果...',
      budget: '正在计算时长预算...',
      completed: '解析完成！',
      error: '发生错误',
    };

    return stageMessages[this.currentStage] || '处理中...';
  }

  /**
   * 获取阶段进度
   */
  getStageProgress(stage: ParseStage): number {
    return this.stageStates.get(stage)?.progress || 0;
  }

  /**
   * 获取总进度
   */
  getOverallProgress(): number {
    return this.overallProgress;
  }

  /**
   * 获取当前阶段
   */
  getCurrentStage(): ParseStage {
    return this.currentStage;
  }

  /**
   * 是否正在追踪
   */
  isActive(): boolean {
    return this.isTracking;
  }

  /**
   * 获取追踪统计
   */
  getStats(): {
    duration: number;
    stagesCompleted: number;
    currentStage: ParseStage;
    overallProgress: number;
  } {
    const completedStages = Array.from(this.stageStates.values()).filter(
      s => s.status === 'completed'
    ).length;

    return {
      duration: Date.now() - this.startTime,
      stagesCompleted: completedStages,
      currentStage: this.currentStage,
      overallProgress: this.overallProgress,
    };
  }
}

/**
 * 创建进度追踪器实例的工厂函数
 */
export function createProgressTracker(
  contentLength: number = 0,
  config?: Partial<ProgressTrackerConfig>
): ProgressTracker {
  return new ProgressTracker(contentLength, config);
}
