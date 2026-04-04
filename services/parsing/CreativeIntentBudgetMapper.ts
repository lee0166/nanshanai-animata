/**
 * CreativeIntentBudgetMapper - 创作意图到时长预算配置映射器
 *
 * 功能：
 * 1. 将创作意图中的durationControl字段映射到BudgetPlanner的配置
 * 2. 提供向后兼容性支持
 * 3. 提供配置验证和默认值
 */

import type { CreativeIntent } from '../../types';
import type { PlatformType, PaceType, BudgetCalculationOptions } from './BudgetPlanner';

/**
 * 映射结果
 */
export interface BudgetMappingResult {
  /** 平台类型 */
  platform: PlatformType;
  /** 节奏类型 */
  pace: PaceType;
  /** 完整的预算计算选项 */
  options: BudgetCalculationOptions;
  /** 是否使用了创作意图配置 */
  usedCreativeIntent: boolean;
}

/**
 * 从创作意图映射到预算配置
 *
 * @param creativeIntent - 创作意图对象
 * @param fallbackOptions - 回退选项（用于向后兼容）
 * @returns 映射结果
 */
export function mapCreativeIntentToBudget(
  creativeIntent?: CreativeIntent,
  fallbackOptions: BudgetCalculationOptions = {}
): BudgetMappingResult {
  // 检查是否有创作意图配置
  const hasCreativeIntentConfig =
    creativeIntent?.durationControl?.targetPlatform ||
    creativeIntent?.durationControl?.pacingPreference;

  if (hasCreativeIntentConfig) {
    // 使用创作意图配置
    const targetPlatform = creativeIntent?.durationControl?.targetPlatform;
    const pacingPreference = creativeIntent?.durationControl?.pacingPreference;

    // 验证并转换平台类型
    const platform: PlatformType = isValidPlatform(targetPlatform)
      ? (targetPlatform as PlatformType)
      : fallbackOptions.platform || 'douyin';

    // 验证并转换节奏类型
    const pace: PaceType = isValidPace(pacingPreference)
      ? (pacingPreference as PaceType)
      : fallbackOptions.pace || 'normal';

    return {
      platform,
      pace,
      options: {
        ...fallbackOptions,
        platform,
        pace,
      },
      usedCreativeIntent: true,
    };
  }

  // 使用回退配置（向后兼容）
  const platform = fallbackOptions.platform || 'douyin';
  const pace = fallbackOptions.pace || 'normal';

  return {
    platform,
    pace,
    options: {
      ...fallbackOptions,
      platform,
      pace,
    },
    usedCreativeIntent: false,
  };
}

/**
 * 验证平台类型是否有效
 */
function isValidPlatform(platform?: string): platform is PlatformType {
  return (
    platform === 'douyin' ||
    platform === 'kuaishou' ||
    platform === 'bilibili' ||
    platform === 'premium'
  );
}

/**
 * 验证节奏类型是否有效
 */
function isValidPace(pace?: string): pace is PaceType {
  return pace === 'fast' || pace === 'normal' || pace === 'slow';
}

/**
 * 获取预算配置的描述文本（用于调试和日志）
 */
export function getBudgetConfigDescription(result: BudgetMappingResult): string {
  const platformNames: Record<PlatformType, string> = {
    douyin: '抖音',
    kuaishou: '快手',
    bilibili: 'B站',
    premium: '精品',
  };

  const paceNames: Record<PaceType, string> = {
    fast: '快',
    normal: '中',
    slow: '慢',
  };

  const source = result.usedCreativeIntent ? '创作意图' : '旧配置';

  return `[BudgetConfig] 平台: ${platformNames[result.platform]}, 节奏: ${paceNames[result.pace]}, 来源: ${source}`;
}

// 默认导出
export default {
  mapCreativeIntentToBudget,
  getBudgetConfigDescription,
  isValidPlatform,
  isValidPace,
};
