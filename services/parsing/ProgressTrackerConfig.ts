/**
 * ProgressTrackerConfig - 进度追踪配置
 *
 * 定义进度追踪系统的配置选项和阶段权重
 *
 * @module services/parsing/ProgressTrackerConfig
 * @version 1.0.0
 */

import type { ParseStage } from '../../types';

/**
 * 进度追踪配置接口
 */
export interface ProgressTrackerConfig {
  /** 阶段权重配置 */
  stageWeights: Record<ParseStage, number>;
  /** 进度平滑系数 (0-1)，值越大越平滑 */
  smoothingFactor: number;
  /** 最小更新间隔 (毫秒) */
  minUpdateInterval: number;
  /** 最小进度变化阈值 (%) */
  minProgressDelta: number;
  /** 是否启用时间预估 */
  enableTimeEstimation: boolean;
  /** 是否启用平滑动画 */
  enableSmoothAnimation: boolean;
  /** API等待期预期耗时 (毫秒) */
  apiWaitEstimate: number;
  /** 历史记录最大数量 */
  maxHistoryRecords: number;
}

/**
 * 默认阶段权重配置
 */
export const DEFAULT_STAGE_WEIGHTS: Record<ParseStage, number> = {
  idle: 0,
  metadata: 0.15, // 15% - 元数据提取
  characters: 0.25, // 25% - 角色分析
  scenes: 0.25, // 25% - 场景分析
  items: 0.05, // 5% - 物品提取
  shots: 0.25, // 25% - 分镜生成
  refinement: 0.03, // 3% - 结果优化
  budget: 0.02, // 2% - 时长预算
  completed: 0,
  error: 0,
};

/**
 * 短文本优化权重 (< 500字符)
 */
export const SHORT_TEXT_STAGE_WEIGHTS: Record<ParseStage, number> = {
  idle: 0,
  metadata: 0.2, // 20% - 元数据提取
  characters: 0.3, // 30% - 角色分析
  scenes: 0.3, // 30% - 场景分析
  items: 0.0, // 0% - 跳过物品提取
  shots: 0.2, // 20% - 分镜生成
  refinement: 0.0, // 0% - 跳过优化
  budget: 0.0, // 0% - 跳过预算
  completed: 0,
  error: 0,
};

/**
 * 长文本优化权重 (> 10000字符)
 */
export const LONG_TEXT_STAGE_WEIGHTS: Record<ParseStage, number> = {
  idle: 0,
  metadata: 0.1, // 10% - 元数据提取
  characters: 0.2, // 20% - 角色分析
  scenes: 0.2, // 20% - 场景分析
  items: 0.05, // 5% - 物品提取
  shots: 0.4, // 40% - 分镜生成（占比更高）
  refinement: 0.03, // 3% - 结果优化
  budget: 0.02, // 2% - 时长预算
  completed: 0,
  error: 0,
};

/**
 * 默认配置
 */
export const DEFAULT_PROGRESS_TRACKER_CONFIG: ProgressTrackerConfig = {
  stageWeights: DEFAULT_STAGE_WEIGHTS,
  smoothingFactor: 0.3,
  minUpdateInterval: 50, // 50ms - 降低更新间隔
  minProgressDelta: 0.1, // 0.1% - 大幅降低最小变化阈值
  enableTimeEstimation: true,
  enableSmoothAnimation: true,
  apiWaitEstimate: 10000, // 10秒
  maxHistoryRecords: 20,
};

/**
 * 子任务权重配置（用于各阶段内部）
 */
export interface SubTaskWeights {
  [subTaskName: string]: number;
}

/**
 * Metadata 阶段子任务权重
 */
export const METADATA_SUBTASK_WEIGHTS: SubTaskWeights = {
  extractBasicInfo: 0.3, // 30% - 基础信息
  extractCharacterList: 0.3, // 30% - 角色列表
  extractSceneList: 0.3, // 30% - 场景列表
  validateMetadata: 0.1, // 10% - 验证
};

/**
 * 根据文本长度获取自适应权重配置
 * @param contentLength 文本长度（字符数）
 * @returns 阶段权重配置
 */
export function getAdaptiveStageWeights(contentLength: number): Record<ParseStage, number> {
  if (contentLength < 500) {
    return SHORT_TEXT_STAGE_WEIGHTS;
  } else if (contentLength > 10000) {
    return LONG_TEXT_STAGE_WEIGHTS;
  }
  return DEFAULT_STAGE_WEIGHTS;
}

/**
 * 验证权重配置是否有效
 * @param weights 权重配置
 * @returns 是否有效
 */
export function validateStageWeights(weights: Record<ParseStage, number>): boolean {
  const sum = Object.values(weights).reduce((acc, weight) => acc + weight, 0);
  // 允许0-1%的误差
  return sum >= 0.99 && sum <= 1.01;
}

/**
 * 归一化权重配置
 * @param weights 权重配置
 * @returns 归一化后的权重配置
 */
export function normalizeStageWeights(
  weights: Record<ParseStage, number>
): Record<ParseStage, number> {
  const sum = Object.values(weights).reduce((acc, weight) => acc + weight, 0);
  if (sum === 0) return weights;

  const normalized: Record<ParseStage, number> = { ...weights };
  for (const key of Object.keys(weights) as ParseStage[]) {
    normalized[key] = weights[key] / sum;
  }
  return normalized;
}
