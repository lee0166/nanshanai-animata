/**
 * 分镜质量校验系统 (Shot Quality Control System)
 * 用于校验分镜列表的时长、节奏、预算等质量指标
 */

import type { Shot } from '../../../types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 问题严重程度
 */
export type QCIssueSeverity = 'critical' | 'warning' | 'info';

/**
 * 问题类型
 */
export type QCIssueType = 'duration' | 'pacing' | 'budget' | 'distribution';

/**
 * 质量校验问题
 */
export interface QCIssue {
  /** 问题类型 */
  type: QCIssueType;
  /** 严重程度 */
  severity: QCIssueSeverity;
  /** 问题描述 */
  message: string;
  /** 改进建议 */
  suggestion: string;
}

/**
 * 自动调整项
 */
export interface QCAdjustment {
  /** 调整类型 */
  type: string;
  /** 调整描述 */
  description: string;
  /** 调整前数值 */
  before: number;
  /** 调整后数值 */
  after: number;
}

/**
 * 质量校验报告
 */
export interface QCReport {
  /** 是否通过校验 */
  passed: boolean;
  /** 质量评分 (0-100) */
  score: number;
  /** 总时长（秒） */
  totalDuration: number;
  /** 预算偏差百分比 */
  budgetVariance: number;
  /** 发现的问题列表 */
  issues: QCIssue[];
  /** 应用的调整列表 */
  adjustments: QCAdjustment[];
}

/**
 * 自动调整策略
 */
export type AdjustmentStrategy = 'compressNonCritical' | 'expandCritical';

/**
 * 校验配置选项
 */
export interface QCOptions {
  /** 预算时长（秒） */
  budgetDuration: number;
  /** 预算误差容忍度（默认15%） */
  budgetTolerance?: number;
  /** 最小分镜时长（秒） */
  minShotDuration?: number;
  /** 最大分镜时长（秒） */
  maxShotDuration?: number;
  /** 连续相同时长阈值（镜数） */
  sameDurationThreshold?: number;
  /** 关键场景标识函数 */
  isCriticalShot?: (shot: Shot, index: number) => boolean;
}

// ============================================================================
// 常量定义
// ============================================================================

/** 默认预算误差容忍度：15% */
const DEFAULT_BUDGET_TOLERANCE = 0.15;

/** 默认最小分镜时长：1秒 */
const DEFAULT_MIN_SHOT_DURATION = 1;

/** 默认最大分镜时长：30秒 */
const DEFAULT_MAX_SHOT_DURATION = 30;

/** 默认连续相同时长阈值：3镜 */
const DEFAULT_SAME_DURATION_THRESHOLD = 3;

/** 评分权重配置 */
const SCORE_WEIGHTS = {
  duration: 0.4, // 时长合规性权重
  pacing: 0.3, // 节奏变化权重
  budget: 0.3, // 预算偏差权重
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 计算总分镜时长
 */
function calculateTotalDuration(shots: Shot[]): number {
  return shots.reduce((sum, shot) => sum + (shot.duration || 0), 0);
}

/**
 * 计算预算偏差百分比
 */
function calculateBudgetVariance(totalDuration: number, budgetDuration: number): number {
  if (budgetDuration <= 0) return 0;
  return ((totalDuration - budgetDuration) / budgetDuration) * 100;
}

/**
 * 检测连续相同时长的分镜
 */
function detectSameDurationSequences(
  shots: Shot[],
  threshold: number
): Array<{ startIndex: number; endIndex: number; duration: number; count: number }> {
  const sequences: Array<{
    startIndex: number;
    endIndex: number;
    duration: number;
    count: number;
  }> = [];

  if (shots.length < threshold) return sequences;

  let currentDuration = shots[0].duration || 0;
  let currentStart = 0;
  let currentCount = 1;

  for (let i = 1; i < shots.length; i++) {
    const duration = shots[i].duration || 0;

    if (duration === currentDuration) {
      currentCount++;
    } else {
      if (currentCount >= threshold) {
        sequences.push({
          startIndex: currentStart,
          endIndex: i - 1,
          duration: currentDuration,
          count: currentCount,
        });
      }
      currentDuration = duration;
      currentStart = i;
      currentCount = 1;
    }
  }

  // 检查最后一个序列
  if (currentCount >= threshold) {
    sequences.push({
      startIndex: currentStart,
      endIndex: shots.length - 1,
      duration: currentDuration,
      count: currentCount,
    });
  }

  return sequences;
}

/**
 * 计算时长合规性评分
 */
function calculateDurationScore(
  shots: Shot[],
  minDuration: number,
  maxDuration: number
): { score: number; violations: QCIssue[] } {
  const violations: QCIssue[] = [];
  let compliantCount = 0;

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const duration = shot.duration || 0;

    if (duration < minDuration) {
      violations.push({
        type: 'duration',
        severity: 'warning',
        message: `分镜 #${shot.sequence} 时长过短 (${duration.toFixed(1)}秒)`,
        suggestion: `建议将分镜 #${shot.sequence} 时长延长至至少 ${minDuration} 秒`,
      });
    } else if (duration > maxDuration) {
      violations.push({
        type: 'duration',
        severity: 'warning',
        message: `分镜 #${shot.sequence} 时长过长 (${duration.toFixed(1)}秒)`,
        suggestion: `建议将分镜 #${shot.sequence} 拆分为多个分镜或缩短至 ${maxDuration} 秒以内`,
      });
    } else {
      compliantCount++;
    }
  }

  const score = shots.length > 0 ? (compliantCount / shots.length) * 100 : 100;
  return { score, violations };
}

/**
 * 计算节奏变化评分
 */
function calculatePacingScore(
  shots: Shot[],
  sameDurationThreshold: number
): { score: number; violations: QCIssue[] } {
  const sequences = detectSameDurationSequences(shots, sameDurationThreshold);
  const violations: QCIssue[] = [];

  for (const seq of sequences) {
    violations.push({
      type: 'pacing',
      severity: seq.count >= 5 ? 'critical' : 'warning',
      message: `检测到 ${seq.count} 个连续相同时长的分镜 (第${seq.startIndex + 1}-${seq.endIndex + 1}镜)`,
      suggestion: `建议调整第${seq.startIndex + 1}-${seq.endIndex + 1}镜的时长，增加节奏变化`,
    });
  }

  // 计算节奏多样性得分
  const uniqueDurations = new Set(shots.map(s => s.duration)).size;
  const diversityRatio = shots.length > 0 ? uniqueDurations / shots.length : 1;
  const penaltyPerSequence = 0.1;
  const score = Math.max(0, diversityRatio * 100 - sequences.length * penaltyPerSequence * 100);

  return { score, violations };
}

/**
 * 计算预算偏差评分
 */
function calculateBudgetScore(
  totalDuration: number,
  budgetDuration: number,
  tolerance: number
): { score: number; variance: number; violations: QCIssue[] } {
  const variance = calculateBudgetVariance(totalDuration, budgetDuration);
  const absVariance = Math.abs(variance);
  const tolerancePercent = tolerance * 100;

  const violations: QCIssue[] = [];

  if (absVariance > tolerancePercent) {
    const isOverBudget = variance > 0;
    violations.push({
      type: 'budget',
      severity: absVariance > tolerancePercent * 2 ? 'critical' : 'warning',
      message: isOverBudget
        ? `总时长超出预算 ${absVariance.toFixed(1)}%`
        : `总时长低于预算 ${absVariance.toFixed(1)}%`,
      suggestion: isOverBudget
        ? `建议压缩非关键场景时长，或减少分镜数量`
        : `建议扩展关键场景时长，或增加分镜细节`,
    });
  }

  // 评分计算：在容忍范围内得满分，超出后线性递减
  const score =
    absVariance <= tolerancePercent ? 100 : Math.max(0, 100 - (absVariance - tolerancePercent) * 2);

  return { score, variance, violations };
}

// ============================================================================
// 主要函数
// ============================================================================

/**
 * 校验分镜列表质量
 * @param shots - 分镜列表
 * @param options - 校验配置选项
 * @returns 质量校验报告
 */
export function validateShots(shots: Shot[], options: QCOptions): QCReport {
  const {
    budgetDuration,
    budgetTolerance = DEFAULT_BUDGET_TOLERANCE,
    minShotDuration = DEFAULT_MIN_SHOT_DURATION,
    maxShotDuration = DEFAULT_MAX_SHOT_DURATION,
    sameDurationThreshold = DEFAULT_SAME_DURATION_THRESHOLD,
  } = options;

  // 计算总时长
  const totalDuration = calculateTotalDuration(shots);

  // 各项评分计算
  const durationResult = calculateDurationScore(shots, minShotDuration, maxShotDuration);
  const pacingResult = calculatePacingScore(shots, sameDurationThreshold);
  const budgetResult = calculateBudgetScore(totalDuration, budgetDuration, budgetTolerance);

  // 合并所有问题
  const issues: QCIssue[] = [
    ...durationResult.violations,
    ...pacingResult.violations,
    ...budgetResult.violations,
  ];

  // 计算综合评分
  const weightedScore =
    durationResult.score * SCORE_WEIGHTS.duration +
    pacingResult.score * SCORE_WEIGHTS.pacing +
    budgetResult.score * SCORE_WEIGHTS.budget;

  // 判断是否通过校验
  const hasCriticalIssue = issues.some(i => i.severity === 'critical');
  const isWithinBudget = Math.abs(budgetResult.variance) <= budgetTolerance * 100;
  const passed = !hasCriticalIssue && isWithinBudget && weightedScore >= 60;

  return {
    passed,
    score: Math.round(weightedScore),
    totalDuration,
    budgetVariance: budgetResult.variance,
    issues,
    adjustments: [], // 校验阶段不生成调整
  };
}

/**
 * 按比例压缩非关键场景时长
 * @param shots - 原始分镜列表
 * @param targetDuration - 目标总时长
 * @param isCriticalShot - 判断是否为关键场景的函数
 * @returns 调整后的分镜列表
 */
export function compressNonCritical(
  shots: Shot[],
  targetDuration: number,
  isCriticalShot?: (shot: Shot, index: number) => boolean
): { shots: Shot[]; adjustments: QCAdjustment[] } {
  const currentDuration = calculateTotalDuration(shots);
  const adjustments: QCAdjustment[] = [];

  if (currentDuration <= targetDuration) {
    return { shots: [...shots], adjustments };
  }

  // 识别关键和非关键分镜
  const shotCategories = shots.map((shot, index) => ({
    shot,
    index,
    isCritical: isCriticalShot ? isCriticalShot(shot, index) : false,
  }));

  const criticalShots = shotCategories.filter(c => c.isCritical);
  const nonCriticalShots = shotCategories.filter(c => !c.isCritical);

  const criticalDuration = criticalShots.reduce((sum, c) => sum + (c.shot.duration || 0), 0);
  const nonCriticalDuration = nonCriticalShots.reduce((sum, c) => sum + (c.shot.duration || 0), 0);

  // 计算需要压缩的时长
  const excessDuration = currentDuration - targetDuration;
  const availableNonCritical = nonCriticalDuration;

  if (availableNonCritical <= 0) {
    // 没有非关键场景可压缩，按比例压缩所有场景
    const ratio = targetDuration / currentDuration;
    const adjustedShots = shots.map((shot, index) => {
      const newDuration = (shot.duration || 0) * ratio;
      adjustments.push({
        type: 'compress',
        description: `分镜 #${shot.sequence} 时长压缩`,
        before: shot.duration || 0,
        after: newDuration,
      });
      return { ...shot, duration: newDuration };
    });
    return { shots: adjustedShots, adjustments };
  }

  // 压缩非关键场景
  const compressionRatio = Math.max(
    0.5,
    (availableNonCritical - excessDuration) / availableNonCritical
  );

  const adjustedShots = shots.map((shot, index) => {
    const category = shotCategories.find(c => c.index === index);
    if (category && !category.isCritical) {
      const newDuration = (shot.duration || 0) * compressionRatio;
      adjustments.push({
        type: 'compress',
        description: `非关键分镜 #${shot.sequence} 时长压缩`,
        before: shot.duration || 0,
        after: newDuration,
      });
      return { ...shot, duration: newDuration };
    }
    return shot;
  });

  return { shots: adjustedShots, adjustments };
}

/**
 * 扩展关键场景时长
 * @param shots - 原始分镜列表
 * @param targetDuration - 目标总时长
 * @param isCriticalShot - 判断是否为关键场景的函数
 * @returns 调整后的分镜列表
 */
export function expandCritical(
  shots: Shot[],
  targetDuration: number,
  isCriticalShot?: (shot: Shot, index: number) => boolean
): { shots: Shot[]; adjustments: QCAdjustment[] } {
  const currentDuration = calculateTotalDuration(shots);
  const adjustments: QCAdjustment[] = [];

  if (currentDuration >= targetDuration) {
    return { shots: [...shots], adjustments };
  }

  // 识别关键分镜
  const criticalIndices: number[] = [];
  shots.forEach((shot, index) => {
    if (isCriticalShot ? isCriticalShot(shot, index) : false) {
      criticalIndices.push(index);
    }
  });

  const deficitDuration = targetDuration - currentDuration;

  if (criticalIndices.length === 0) {
    // 没有关键场景，按比例扩展所有场景
    const ratio = targetDuration / currentDuration;
    const adjustedShots = shots.map((shot, index) => {
      const newDuration = (shot.duration || 0) * ratio;
      adjustments.push({
        type: 'expand',
        description: `分镜 #${shot.sequence} 时长扩展`,
        before: shot.duration || 0,
        after: newDuration,
      });
      return { ...shot, duration: newDuration };
    });
    return { shots: adjustedShots, adjustments };
  }

  // 将额外时长分配给关键场景
  const extraPerCritical = deficitDuration / criticalIndices.length;

  const adjustedShots = shots.map((shot, index) => {
    if (criticalIndices.includes(index)) {
      const newDuration = (shot.duration || 0) + extraPerCritical;
      adjustments.push({
        type: 'expand',
        description: `关键分镜 #${shot.sequence} 时长扩展`,
        before: shot.duration || 0,
        after: newDuration,
      });
      return { ...shot, duration: newDuration };
    }
    return shot;
  });

  return { shots: adjustedShots, adjustments };
}

/**
 * 自动调整分镜时长
 * @param shots - 原始分镜列表
 * @param budget - 预算时长（秒）
 * @param strategy - 调整策略
 * @param options - 额外配置选项
 * @returns 调整后的分镜列表
 */
export function autoAdjustShots(
  shots: Shot[],
  budget: number,
  strategy: AdjustmentStrategy,
  options?: Partial<QCOptions>
): Shot[] {
  const isCriticalShot = options?.isCriticalShot;

  let result: { shots: Shot[]; adjustments: QCAdjustment[] };

  switch (strategy) {
    case 'compressNonCritical':
      result = compressNonCritical(shots, budget, isCriticalShot);
      break;
    case 'expandCritical':
      result = expandCritical(shots, budget, isCriticalShot);
      break;
    default:
      result = { shots: [...shots], adjustments: [] };
  }

  return result.shots;
}

/**
 * 生成完整的校验报告（包含自动调整建议）
 * @param shots - 分镜列表
 * @param options - 校验配置选项
 * @returns 包含调整建议的质量校验报告
 */
export function generateQCReportWithAdjustments(shots: Shot[], options: QCOptions): QCReport {
  // 先进行基础校验
  const baseReport = validateShots(shots, options);

  // 如果已经通过校验，直接返回
  if (baseReport.passed) {
    return baseReport;
  }

  // 根据预算偏差决定调整策略
  const { budgetDuration } = options;
  const currentDuration = calculateTotalDuration(shots);
  let adjustedShots: Shot[] = [...shots];
  let adjustments: QCAdjustment[] = [];

  if (currentDuration > budgetDuration) {
    // 需要压缩
    const result = compressNonCritical(shots, budgetDuration, options.isCriticalShot);
    adjustedShots = result.shots;
    adjustments = result.adjustments;
  } else if (currentDuration < budgetDuration) {
    // 需要扩展
    const result = expandCritical(shots, budgetDuration, options.isCriticalShot);
    adjustedShots = result.shots;
    adjustments = result.adjustments;
  }

  // 对调整后的分镜重新校验
  const finalReport = validateShots(adjustedShots, options);

  return {
    ...finalReport,
    adjustments,
  };
}

// ============================================================================
// 导出
// ============================================================================

export default {
  validateShots,
  autoAdjustShots,
  compressNonCritical,
  expandCritical,
  generateQCReportWithAdjustments,
};
