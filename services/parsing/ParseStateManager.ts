/**
 * Parse State Manager
 *
 * 细粒度状态管理 - 子任务级断点续传
 * 基于文档《融合方案_实施细节与代码示例》第2.5节
 *
 * @module services/parsing/ParseStateManager
 * @version 1.0.0
 */

import { ScriptParseState, ParseStage, ScriptCharacter, ScriptScene, Shot } from '../../types';
import { storageService } from '../storage';

// 子任务类型
export type SubTaskType = 'character' | 'scene' | 'shot' | 'prop';

// 子任务状态
export interface SubTaskState {
  id: string;                    // 如 "char_林黛玉", "scene_大观园"
  type: SubTaskType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  retryCount: number;
  startTime?: number;
  endTime?: number;
  modelUsed?: string;
  tokenUsed?: number;
}

// 扩展的解析状态
export interface ExtendedParseState extends ScriptParseState {
  scriptId: string;
  projectId: string;
  
  // 子任务状态映射
  subTasks: Map<string, SubTaskState>;
  
  // 进度统计
  progressDetail: {
    stage: number;      // 当前阶段进度 0-100
    overall: number;    // 总体进度 0-100
    completedTasks: number;
    totalTasks: number;
  };
  
  // 故事圣经(锁定后不可变)
  storyBible?: {
    locked: boolean;
    characters: ScriptCharacter[];
    scenes: ScriptScene[];
    visualStyle: string;
    lockedAt?: number;
  };
  
  // 成本统计
  costEstimate: {
    totalTokens: number;
    totalUSD: number;
    breakdown: Record<string, number>;
  };
  
  // 最后更新时间
  lastUpdated: number;
}

export class ParseStateManager {
  private state: ExtendedParseState | null = null;

  /**
   * 初始化新的解析状态
   */
  initialize(scriptId: string, projectId: string): ExtendedParseState {
    this.state = {
      scriptId,
      projectId,
      stage: 'idle',
      progress: 0,
      subTasks: new Map(),
      progressDetail: {
        stage: 0,
        overall: 0,
        completedTasks: 0,
        totalTasks: 0
      },
      costEstimate: {
        totalTokens: 0,
        totalUSD: 0,
        breakdown: {}
      },
      lastUpdated: Date.now()
    };
    return this.state;
  }

  /**
   * 从存储加载状态
   */
  async load(scriptId: string, projectId: string): Promise<ExtendedParseState | null> {
    try {
      const script = await storageService.getScript(scriptId, projectId);
      if (!script?.parseState) return null;

      // 转换旧格式到新格式
      this.state = this.migrateState(script.parseState as any, scriptId, projectId);
      return this.state;
    } catch (e) {
      console.error('[ParseStateManager] Failed to load state:', e);
      return null;
    }
  }

  /**
   * 保存状态到存储
   */
  async save(): Promise<void> {
    if (!this.state) return;

    this.state.lastUpdated = Date.now();
    
    try {
      await storageService.updateScriptParseState(
        this.state.scriptId,
        this.state.projectId,
        () => this.convertToScriptParseState(this.state!)
      );
    } catch (e) {
      console.error('[ParseStateManager] Failed to save state:', e);
    }
  }

  /**
   * 创建子任务
   */
  createSubTask(type: SubTaskType, entityId: string): SubTaskState {
    if (!this.state) throw new Error('State not initialized');

    const taskId = `${type}_${entityId}`;
    const task: SubTaskState = {
      id: taskId,
      type,
      status: 'pending',
      retryCount: 0
    };

    this.state.subTasks.set(taskId, task);
    this.updateProgress();
    
    return task;
  }

  /**
   * 开始执行子任务
   */
  startSubTask(taskId: string): SubTaskState {
    if (!this.state) throw new Error('State not initialized');

    const task = this.state.subTasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    task.status = 'processing';
    task.startTime = Date.now();
    
    return task;
  }

  /**
   * 完成子任务
   */
  completeSubTask(taskId: string, result: any, metadata?: { modelUsed?: string; tokenUsed?: number }): void {
    if (!this.state) throw new Error('State not initialized');

    const task = this.state.subTasks.get(taskId);
    if (!task) return;

    task.status = 'completed';
    task.result = result;
    task.endTime = Date.now();
    
    if (metadata) {
      task.modelUsed = metadata.modelUsed;
      task.tokenUsed = metadata.tokenUsed;
      
      // 更新成本统计
      if (metadata.tokenUsed) {
        this.state.costEstimate.totalTokens += metadata.tokenUsed;
      }
    }

    this.updateProgress();
  }

  /**
   * 标记子任务失败
   */
  failSubTask(taskId: string, error: string): boolean {
    if (!this.state) throw new Error('State not initialized');

    const task = this.state.subTasks.get(taskId);
    if (!task) return false;

    task.status = 'failed';
    task.error = error;
    task.retryCount++;
    task.endTime = Date.now();

    // 如果重试次数超过3次，标记为需要人工干预
    if (task.retryCount >= 3) {
      console.warn(`[ParseStateManager] Task ${taskId} failed ${task.retryCount} times, needs human intervention`);
      return true; // 需要人工干预
    }

    this.updateProgress();
    return false;
  }

  /**
   * 重置子任务状态（用于重试）
   */
  resetSubTask(taskId: string): void {
    if (!this.state) throw new Error('State not initialized');

    const task = this.state.subTasks.get(taskId);
    if (!task) return;

    task.status = 'pending';
    task.error = undefined;
    task.startTime = undefined;
    task.endTime = undefined;
  }

  /**
   * 获取所有未完成的子任务
   */
  getUncompletedTasks(): SubTaskState[] {
    if (!this.state) return [];

    return Array.from(this.state.subTasks.values())
      .filter(t => t.status !== 'completed');
  }

  /**
   * 获取特定类型的子任务
   */
  getTasksByType(type: SubTaskType): SubTaskState[] {
    if (!this.state) return [];

    return Array.from(this.state.subTasks.values())
      .filter(t => t.type === type);
  }

  /**
   * 锁定故事圣经
   */
  lockStoryBible(visualStyle: string): void {
    if (!this.state) throw new Error('State not initialized');

    this.state.storyBible = {
      locked: true,
      characters: this.state.characters || [],
      scenes: this.state.scenes || [],
      visualStyle,
      lockedAt: Date.now()
    };
  }

  /**
   * 检查故事圣经是否已锁定
   */
  isStoryBibleLocked(): boolean {
    return this.state?.storyBible?.locked || false;
  }

  /**
   * 更新阶段
   */
  updateStage(stage: ParseStage): void {
    if (!this.state) return;
    this.state.stage = stage;
    this.state.progressDetail.stage = 0;
    this.state.progress = this.calculateOverallProgress();
  }

  /**
   * 更新阶段进度
   */
  updateStageProgress(progress: number, message?: string): void {
    if (!this.state) return;
    
    this.state.progressDetail.stage = progress;
    this.state.progress = this.calculateOverallProgress();
    
    if (message) {
      console.log(`[ParseStateManager] ${this.state.stage}: ${progress}% - ${message}`);
    }
  }

  /**
   * 获取当前状态
   */
  getState(): ExtendedParseState | null {
    return this.state;
  }

  /**
   * 获取成本统计
   */
  getCostEstimate(): { totalTokens: number; totalUSD: number; breakdown: Record<string, number> } {
    if (!this.state) return { totalTokens: 0, totalUSD: 0, breakdown: {} };
    return { ...this.state.costEstimate };
  }

  /**
   * 更新进度统计
   */
  private updateProgress(): void {
    if (!this.state) return;

    const tasks = Array.from(this.state.subTasks.values());
    const completed = tasks.filter(t => t.status === 'completed').length;
    const total = tasks.length;

    this.state.progressDetail.completedTasks = completed;
    this.state.progressDetail.totalTasks = total;
    this.state.progressDetail.overall = total > 0 ? Math.round((completed / total) * 100) : 0;
    this.state.progress = this.calculateOverallProgress();
  }

  /**
   * 计算总体进度
   */
  private calculateOverallProgress(): number {
    if (!this.state) return 0;

    const stageWeights: Record<ParseStage, number> = {
      'idle': 0,
      'metadata': 10,
      'characters': 30,
      'scenes': 30,
      'items': 5,
      'shots': 25,
      'completed': 100,
      'error': 0
    };

    const baseProgress = stageWeights[this.state.stage] || 0;
    const stageProgress = this.state.progressDetail.stage * 0.01 * (
      stageWeights['shots'] - stageWeights['metadata']
    ) / 100;

    return Math.min(100, Math.round(baseProgress + stageProgress));
  }

  /**
   * 转换回标准ScriptParseState格式（用于存储）
   */
  private convertToScriptParseState(extendedState: ExtendedParseState): ScriptParseState {
    return {
      stage: extendedState.stage,
      progress: extendedState.progress,
      metadata: extendedState.metadata,
      characters: extendedState.characters,
      scenes: extendedState.scenes,
      items: extendedState.items,
      shots: extendedState.shots,
      error: extendedState.error,
      currentChunkIndex: extendedState.currentChunkIndex,
      totalChunks: extendedState.totalChunks
    };
  }

  /**
   * 从旧格式迁移到新格式
   */
  private migrateState(oldState: any, scriptId: string, projectId: string): ExtendedParseState {
    return {
      ...oldState,
      scriptId,
      projectId,
      subTasks: new Map(),
      progressDetail: {
        stage: oldState.progress || 0,
        overall: oldState.progress || 0,
        completedTasks: 0,
        totalTasks: 0
      },
      costEstimate: {
        totalTokens: 0,
        totalUSD: 0,
        breakdown: {}
      },
      lastUpdated: Date.now()
    };
  }
}

// 导出单例实例
export const parseStateManager = new ParseStateManager();
