/**
 * ShotEventEmitter - 分镜生成事件发射器
 *
 * 职责：实现发布订阅模式，用于实时推送分镜生成事件
 *
 * 核心功能：
 * 1. 事件订阅和取消订阅
 * 2. 事件发布
 * 3. 支持多种事件类型
 * 4. 异步事件处理
 * 5. 错误处理和日志记录
 *
 * 支持的事件类型：
 * - shot:created - 新分镜创建
 * - shot:updated - 分镜更新
 * - shot:deleted - 分镜删除
 * - batch:complete - 批次完成
 * - parsing:progress - 解析进度更新
 * - parsing:complete - 解析完成
 * - error - 错误事件
 *
 * 使用场景：
 * - WebSocket 实时推送
 * - UI 实时更新
 * - 日志记录
 * - 数据分析
 *
 * @module services/events/ShotEventEmitter
 * @version 1.0.0
 */

/**
 * 事件类型定义
 */
export type ShotEventType =
  | 'shot:created'
  | 'shot:updated'
  | 'shot:deleted'
  | 'batch:complete'
  | 'parsing:progress'
  | 'parsing:complete'
  | 'error';

/**
 * 事件数据结构
 */
export interface ShotEventData {
  /** 事件类型 */
  type: ShotEventType;
  /** 事件发生时间戳 */
  timestamp: number;
  /** 事件负载数据 */
  payload?: any;
  /** 剧本 ID */
  scriptId?: string;
  /** 项目 ID */
  projectId?: string;
  /** 分镜 ID（如果适用） */
  shotId?: string;
  /** 批次号（如果适用） */
  batchNumber?: number;
  /** 进度百分比（如果适用） */
  progress?: number;
}

/**
 * 事件监听器类型
 */
export type EventListener = (data: ShotEventData) => void | Promise<void>;

/**
 * 分镜事件发射器类
 */
export class ShotEventEmitter {
  private listeners: Map<ShotEventType, Set<EventListener>> = new Map();
  private eventHistory: ShotEventData[] = [];
  private maxHistorySize: number = 100;
  private totalEventsEmitted: number = 0;

  /**
   * 构造函数
   * @param maxHistorySize - 最大历史记录数，默认 100
   */
  constructor(maxHistorySize: number = 100) {
    this.maxHistorySize = maxHistorySize;
    console.log('[ShotEventEmitter] Initialized with maxHistorySize:', maxHistorySize);
  }

  /**
   * 订阅事件
   * @param eventType - 事件类型
   * @param listener - 监听器函数
   * @returns 取消订阅函数
   */
  on(eventType: ShotEventType, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const listenerSet = this.listeners.get(eventType)!;
    listenerSet.add(listener);

    console.log(`[ShotEventEmitter] Subscribed to event: ${eventType}`);

    // 返回取消订阅函数
    return () => {
      this.off(eventType, listener);
    };
  }

  /**
   * 取消订阅事件
   * @param eventType - 事件类型
   * @param listener - 监听器函数
   */
  off(eventType: ShotEventType, listener: EventListener): void {
    const listenerSet = this.listeners.get(eventType);
    if (listenerSet) {
      listenerSet.delete(listener);
      console.log(`[ShotEventEmitter] Unsubscribed from event: ${eventType}`);
    }
  }

  /**
   * 发布事件
   * @param eventType - 事件类型
   * @param data - 事件数据
   */
  async emit(eventType: ShotEventType, data: Partial<ShotEventData> = {}): Promise<void> {
    const eventData: ShotEventData = {
      type: eventType,
      timestamp: Date.now(),
      ...data,
    };

    // 记录到历史
    this.addToHistory(eventData);
    this.totalEventsEmitted++;

    // 获取监听器
    const listenerSet = this.listeners.get(eventType);
    if (!listenerSet || listenerSet.size === 0) {
      return;
    }

    // 异步调用所有监听器
    const promises: Promise<void>[] = [];

    for (const listener of listenerSet) {
      try {
        const result = listener(eventData);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        console.error(`[ShotEventEmitter] Error in listener for ${eventType}:`, error);
      }
    }

    // 等待所有异步监听器完成
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  /**
   * 发布分镜创建事件
   */
  async emitShotCreated(
    shotId: string,
    shotData: any,
    scriptId?: string,
    projectId?: string
  ): Promise<void> {
    await this.emit('shot:created', {
      shotId,
      payload: shotData,
      scriptId,
      projectId,
    });
  }

  /**
   * 发布批次完成事件
   */
  async emitBatchComplete(
    batchNumber: number,
    shots: any[],
    scriptId?: string,
    projectId?: string
  ): Promise<void> {
    await this.emit('batch:complete', {
      batchNumber,
      payload: { shots },
      scriptId,
      projectId,
    });
  }

  /**
   * 发布解析进度事件
   */
  async emitProgress(
    progress: number,
    stage?: string,
    message?: string,
    scriptId?: string,
    projectId?: string
  ): Promise<void> {
    await this.emit('parsing:progress', {
      progress,
      payload: { stage, message },
      scriptId,
      projectId,
    });
  }

  /**
   * 发布解析完成事件
   */
  async emitParsingComplete(result: any, scriptId?: string, projectId?: string): Promise<void> {
    await this.emit('parsing:complete', {
      payload: result,
      scriptId,
      projectId,
    });
  }

  /**
   * 发布错误事件
   */
  async emitError(
    error: Error,
    context?: string,
    scriptId?: string,
    projectId?: string
  ): Promise<void> {
    await this.emit('error', {
      payload: {
        message: error.message,
        stack: error.stack,
        context,
      },
      scriptId,
      projectId,
    });
  }

  /**
   * 获取事件历史
   * @param eventType - 事件类型（可选，不传则返回所有类型）
   * @returns 事件历史数组
   */
  getHistory(eventType?: ShotEventType): ShotEventData[] {
    if (eventType) {
      return this.eventHistory.filter(event => event.type === eventType);
    }
    return [...this.eventHistory];
  }

  /**
   * 获取监听器数量
   * @param eventType - 事件类型
   * @returns 监听器数量
   */
  getListenerCount(eventType: ShotEventType): number {
    const listenerSet = this.listeners.get(eventType);
    return listenerSet ? listenerSet.size : 0;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalEventsEmitted: number;
    historySize: number;
    listenerCounts: Record<string, number>;
  } {
    const listenerCounts: Record<string, number> = {};
    this.listeners.forEach((listeners, eventType) => {
      listenerCounts[eventType] = listeners.size;
    });

    return {
      totalEventsEmitted: this.totalEventsEmitted,
      historySize: this.eventHistory.length,
      listenerCounts,
    };
  }

  /**
   * 清空事件历史
   */
  clearHistory(): void {
    this.eventHistory = [];
    console.log('[ShotEventEmitter] History cleared');
  }

  /**
   * 清空所有监听器
   */
  clearListeners(): void {
    this.listeners.clear();
    console.log('[ShotEventEmitter] All listeners cleared');
  }

  /**
   * 重置发射器
   */
  reset(): void {
    this.clearHistory();
    this.clearListeners();
    this.totalEventsEmitted = 0;
    console.log('[ShotEventEmitter] Reset to initial state');
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(event: ShotEventData): void {
    this.eventHistory.push(event);

    // 限制历史记录大小
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }
}

/**
 * 创建事件发射器实例
 * @param maxHistorySize - 最大历史记录数
 * @returns 事件发射器实例
 */
export function createShotEventEmitter(maxHistorySize: number = 100): ShotEventEmitter {
  return new ShotEventEmitter(maxHistorySize);
}
