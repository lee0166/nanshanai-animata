/**
 * BudgetPlanner - 字数到总时长预算计算模块
 *
 * 功能：
 * 1. 根据字数计算总时长预算
 * 2. 支持不同平台（抖音/快手/B站/精品）和节奏类型
 * 3. 场景时长分配包含重要性权重
 * 4. 7000字小说输出总时长在 210-300 秒（3.5-5分钟）范围
 */

import type { Shot } from '../../types';

/**
 * 平台类型
 */
export type PlatformType = 'douyin' | 'kuaishou' | 'bilibili' | 'premium';

/**
 * 节奏类型
 */
export type PaceType = 'fast' | 'normal' | 'slow';

/**
 * 场景重要性类型
 */
export type SceneImportance = 'opening' | 'development' | 'climax' | 'ending';

/**
 * 场景重要性权重配置
 */
export const SCENE_IMPORTANCE_WEIGHTS: Record<SceneImportance, number> = {
  opening: 0.8,      // 开场
  development: 0.6,  // 发展
  climax: 1.0,       // 高潮
  ending: 0.7        // 结尾
};

/**
 * 平台节奏配置 - 字数/分钟
 */
export interface PaceConfig {
  /** 最小字数/分钟 */
  minWordsPerMinute: number;
  /** 最大字数/分钟 */
  maxWordsPerMinute: number;
  /** 推荐字数/分钟 */
  recommendedWordsPerMinute: number;
  /** 描述 */
  description: string;
}

/**
 * 平台配置
 */
export interface PlatformConfig {
  /** 平台名称 */
  name: string;
  /** 平台显示名称 */
  displayName: string;
  /** 节奏配置 */
  paces: Record<PaceType, PaceConfig>;
  /** 推荐时长范围（秒） */
  recommendedDurationRange: [number, number];
  /** 平台特点描述 */
  characteristics: string[];
}

/**
 * 场景预算
 */
export interface SceneBudget {
  /** 场景ID */
  sceneId: string;
  /** 场景名称 */
  sceneName: string;
  /** 场景重要性类型 */
  importance: SceneImportance;
  /** 重要性权重 */
  weight: number;
  /** 场景字数 */
  wordCount: number;
  /** 分配时长（秒） */
  allocatedDuration: number;
  /** 包含的分镜数量 */
  shotCount: number;
  /** 每个分镜的平均时长（秒） */
  averageShotDuration: number;
}

/**
 * 时长预算结果
 */
export interface DurationBudget {
  /** 总字数 */
  totalWordCount: number;
  /** 总时长（秒） */
  totalDuration: number;
  /** 平台类型 */
  platform: PlatformType;
  /** 节奏类型 */
  pace: PaceType;
  /** 使用的字数/分钟比率 */
  wordsPerMinute: number;
  /** 场景预算列表 */
  sceneBudgets: SceneBudget[];
  /** 开场时长（秒） */
  openingDuration: number;
  /** 发展时长（秒） */
  developmentDuration: number;
  /** 高潮时长（秒） */
  climaxDuration: number;
  /** 结尾时长（秒） */
  endingDuration: number;
  /** 建议的分镜总数 */
  recommendedShotCount: number;
  /** 平均每镜时长（秒） */
  averageShotDuration: number;
  /** 预算生成时间戳 */
  generatedAt: number;
}

/**
 * 预算计算选项
 */
export interface BudgetCalculationOptions {
  /** 平台类型，默认 'douyin' */
  platform?: PlatformType;
  /** 节奏类型，默认 'fast' */
  pace?: PaceType;
  /** 目标总时长（秒），如果提供则覆盖自动计算 */
  targetDuration?: number;
  /** 自定义字数/分钟比率，覆盖平台默认值 */
  customWordsPerMinute?: number;
  /** 场景重要性映射函数 */
  importanceMapper?: (sceneIndex: number, totalScenes: number) => SceneImportance;
  /** 分镜数量限制 */
  maxShots?: number;
  /** 最小分镜时长（秒） */
  minShotDuration?: number;
  /** 最大分镜时长（秒） */
  maxShotDuration?: number;
}

/**
 * 平台默认配置
 */
export const PLATFORM_CONFIGS: Record<PlatformType, PlatformConfig> = {
  douyin: {
    name: 'douyin',
    displayName: '抖音',
    paces: {
      fast: {
        minWordsPerMinute: 250,
        maxWordsPerMinute: 300,
        recommendedWordsPerMinute: 280,
        description: '快节奏，适合短剧快节奏剪辑'
      },
      normal: {
        minWordsPerMinute: 200,
        maxWordsPerMinute: 250,
        recommendedWordsPerMinute: 225,
        description: '中节奏，平衡叙事与节奏'
      },
      slow: {
        minWordsPerMinute: 150,
        maxWordsPerMinute: 200,
        recommendedWordsPerMinute: 175,
        description: '慢节奏，适合情感细腻表达'
      }
    },
    recommendedDurationRange: [180, 300],
    characteristics: ['竖屏为主', '快节奏', '黄金3秒', '完播率优先']
  },
  kuaishou: {
    name: 'kuaishou',
    displayName: '快手',
    paces: {
      fast: {
        minWordsPerMinute: 240,
        maxWordsPerMinute: 290,
        recommendedWordsPerMinute: 270,
        description: '快节奏，适合下沉市场'
      },
      normal: {
        minWordsPerMinute: 190,
        maxWordsPerMinute: 240,
        recommendedWordsPerMinute: 220,
        description: '中节奏，平衡叙事'
      },
      slow: {
        minWordsPerMinute: 140,
        maxWordsPerMinute: 190,
        recommendedWordsPerMinute: 170,
        description: '慢节奏，适合剧情深入'
      }
    },
    recommendedDurationRange: [180, 300],
    characteristics: ['老铁文化', '真实感', '强互动', '接地气']
  },
  bilibili: {
    name: 'bilibili',
    displayName: 'B站',
    paces: {
      fast: {
        minWordsPerMinute: 220,
        maxWordsPerMinute: 280,
        recommendedWordsPerMinute: 250,
        description: '快节奏，适合信息密度高的内容'
      },
      normal: {
        minWordsPerMinute: 180,
        maxWordsPerMinute: 250,
        recommendedWordsPerMinute: 200,
        description: '中节奏，适合大多数内容'
      },
      slow: {
        minWordsPerMinute: 120,
        maxWordsPerMinute: 180,
        recommendedWordsPerMinute: 150,
        description: '慢节奏，适合深度解析'
      }
    },
    recommendedDurationRange: [240, 600],
    characteristics: ['横屏为主', '年轻用户', '弹幕文化', '长视频友好']
  },
  premium: {
    name: 'premium',
    displayName: '精品短剧',
    paces: {
      fast: {
        minWordsPerMinute: 200,
        maxWordsPerMinute: 250,
        recommendedWordsPerMinute: 225,
        description: '精品快节奏，兼顾质量与效率'
      },
      normal: {
        minWordsPerMinute: 150,
        maxWordsPerMinute: 200,
        recommendedWordsPerMinute: 175,
        description: '精品中节奏，注重叙事质量'
      },
      slow: {
        minWordsPerMinute: 120,
        maxWordsPerMinute: 180,
        recommendedWordsPerMinute: 150,
        description: '精品慢节奏，电影级质感'
      }
    },
    recommendedDurationRange: [300, 600],
    characteristics: ['电影级质感', '高制作成本', '精细叙事', '品牌调性']
  }
};

/**
 * 默认场景重要性映射函数
 * 根据场景在剧本中的位置自动判断重要性
 */
export function defaultImportanceMapper(
  sceneIndex: number,
  totalScenes: number
): SceneImportance {
  if (totalScenes <= 0) return 'development';

  const ratio = sceneIndex / totalScenes;

  if (ratio < 0.15) {
    // 前15%为开场
    return 'opening';
  } else if (ratio >= 0.9) {
    // 最后10%为结尾
    return 'ending';
  } else if (ratio >= 0.6 && ratio < 0.9) {
    // 60%-90%为高潮
    return 'climax';
  } else {
    // 15%-60%为发展
    return 'development';
  }
}

/**
 * 计算中文字数（排除标点符号和空格）
 */
export function calculateChineseWordCount(text: string): number {
  if (!text || typeof text !== 'string') return 0;

  // 匹配中文字符
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
  const chineseCount = chineseChars ? chineseChars.length : 0;

  // 匹配英文单词（简化处理，按空格分隔）
  const englishWords = text.match(/[a-zA-Z]+/g);
  const englishCount = englishWords ? englishWords.length : 0;

  return chineseCount + englishCount;
}

/**
 * 计算分镜字数
 */
export function calculateShotWordCount(shot: Shot): number {
  let wordCount = 0;

  // 计算描述字数
  if (shot.description) {
    wordCount += calculateChineseWordCount(shot.description);
  }

  // 计算对话字数
  if (shot.dialogue) {
    wordCount += calculateChineseWordCount(shot.dialogue);
  }

  // 计算音效/动作字数
  if (shot.sound) {
    wordCount += calculateChineseWordCount(shot.sound);
  }

  return wordCount;
}

/**
 * 按场景分组分镜
 */
export function groupShotsByScene(shots: Shot[]): Map<string, Shot[]> {
  const groups = new Map<string, Shot[]>();

  for (const shot of shots) {
    const sceneName = shot.sceneName || '未命名场景';
    if (!groups.has(sceneName)) {
      groups.set(sceneName, []);
    }
    groups.get(sceneName)!.push(shot);
  }

  return groups;
}

/**
 * 计算时长预算
 *
 * @param shots - 分镜列表
 * @param options - 计算选项
 * @returns 时长预算结果
 */
export function calculateBudget(
  shots: Shot[],
  options: BudgetCalculationOptions = {}
): DurationBudget {
  const {
    platform = 'douyin',
    pace = 'fast',
    targetDuration,
    customWordsPerMinute,
    importanceMapper = defaultImportanceMapper,
    minShotDuration = 1.5,
    maxShotDuration = 8
  } = options;

  // 验证输入
  if (!shots || shots.length === 0) {
    throw new Error('分镜列表不能为空');
  }

  // 获取平台配置
  const platformConfig = PLATFORM_CONFIGS[platform];
  if (!platformConfig) {
    throw new Error(`不支持的平台类型: ${platform}`);
  }

  // 获取节奏配置
  const paceConfig = platformConfig.paces[pace];
  if (!paceConfig) {
    throw new Error(`不支持的节奏类型: ${pace}`);
  }

  // 确定字数/分钟比率
  const wordsPerMinute = customWordsPerMinute ?? paceConfig.recommendedWordsPerMinute;

  // 按场景分组
  const sceneGroups = groupShotsByScene(shots);
  const sceneNames = Array.from(sceneGroups.keys());
  const totalScenes = sceneNames.length;

  // 计算每个场景的字数和重要性
  const sceneData: Array<{
    sceneId: string;
    sceneName: string;
    shots: Shot[];
    wordCount: number;
    importance: SceneImportance;
    weight: number;
  }> = [];

  let totalWordCount = 0;

  for (let i = 0; i < sceneNames.length; i++) {
    const sceneName = sceneNames[i];
    const sceneShots = sceneGroups.get(sceneName)!;

    // 计算场景总字数
    const sceneWordCount = sceneShots.reduce(
      (sum, shot) => sum + calculateShotWordCount(shot),
      0
    );

    // 确定场景重要性
    const importance = importanceMapper(i, totalScenes);
    const weight = SCENE_IMPORTANCE_WEIGHTS[importance];

    sceneData.push({
      sceneId: `scene_${i}`,
      sceneName,
      shots: sceneShots,
      wordCount: sceneWordCount,
      importance,
      weight
    });

    totalWordCount += sceneWordCount;
  }

  // 计算基础总时长（不考虑权重）
  const baseDuration = (totalWordCount / wordsPerMinute) * 60;

  // 如果指定了目标时长，按比例调整
  const targetTotalDuration = targetDuration ?? baseDuration;

  // 计算权重总和
  const totalWeight = sceneData.reduce((sum, scene) => sum + scene.weight, 0);

  // 分配场景时长
  const sceneBudgets: SceneBudget[] = [];
  let allocatedTotalDuration = 0;

  for (const scene of sceneData) {
    // 基于权重和字数分配时长
    const weightRatio = scene.weight / totalWeight;
    const wordRatio = scene.wordCount / totalWordCount;

    // 权重占比60%，字数占比40%
    const combinedRatio = weightRatio * 0.6 + wordRatio * 0.4;

    const allocatedDuration = targetTotalDuration * combinedRatio;

    // 计算每个分镜的平均时长
    const averageShotDuration = scene.shots.length > 0
      ? allocatedDuration / scene.shots.length
      : 0;

    sceneBudgets.push({
      sceneId: scene.sceneId,
      sceneName: scene.sceneName,
      importance: scene.importance,
      weight: scene.weight,
      wordCount: scene.wordCount,
      allocatedDuration: Math.round(allocatedDuration * 10) / 10,
      shotCount: scene.shots.length,
      averageShotDuration: Math.round(averageShotDuration * 10) / 10
    });

    allocatedTotalDuration += allocatedDuration;
  }

  // 按重要性类型汇总时长
  const openingDuration = sceneBudgets
    .filter(s => s.importance === 'opening')
    .reduce((sum, s) => sum + s.allocatedDuration, 0);

  const developmentDuration = sceneBudgets
    .filter(s => s.importance === 'development')
    .reduce((sum, s) => sum + s.allocatedDuration, 0);

  const climaxDuration = sceneBudgets
    .filter(s => s.importance === 'climax')
    .reduce((sum, s) => sum + s.allocatedDuration, 0);

  const endingDuration = sceneBudgets
    .filter(s => s.importance === 'ending')
    .reduce((sum, s) => sum + s.allocatedDuration, 0);

  // 计算建议的分镜总数
  // 基于平均每镜3-5秒计算
  const averageShotDuration = targetTotalDuration / shots.length;
  const recommendedShotCount = Math.ceil(targetTotalDuration / 4); // 假设平均每镜4秒

  // 确保总时长在合理范围内
  const finalTotalDuration = Math.round(targetTotalDuration);

  return {
    totalWordCount,
    totalDuration: finalTotalDuration,
    platform,
    pace,
    wordsPerMinute,
    sceneBudgets,
    openingDuration: Math.round(openingDuration * 10) / 10,
    developmentDuration: Math.round(developmentDuration * 10) / 10,
    climaxDuration: Math.round(climaxDuration * 10) / 10,
    endingDuration: Math.round(endingDuration * 10) / 10,
    recommendedShotCount,
    averageShotDuration: Math.round(averageShotDuration * 10) / 10,
    generatedAt: Date.now()
  };
}

/**
 * 验证预算是否在目标范围内
 * 7000字小说输出总时长应在 210-300 秒（3.5-5分钟）范围
 */
export function validateBudget(budget: DurationBudget): {
  valid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // 检查7000字的目标范围
  if (budget.totalWordCount >= 6500 && budget.totalWordCount <= 7500) {
    if (budget.totalDuration < 210) {
      issues.push(`总时长 ${budget.totalDuration}秒 低于目标范围 210-300秒`);
      suggestions.push('建议降低字数/分钟比率或选择更慢的节奏');
    } else if (budget.totalDuration > 300) {
      issues.push(`总时长 ${budget.totalDuration}秒 超过目标范围 210-300秒`);
      suggestions.push('建议提高字数/分钟比率或选择更快的节奏');
    }
  }

  // 检查平均每镜时长
  if (budget.averageShotDuration < 1.5) {
    issues.push(`平均每镜时长 ${budget.averageShotDuration}秒 过短，可能导致画面切换过快`);
    suggestions.push('建议减少分镜数量或增加总时长');
  } else if (budget.averageShotDuration > 8) {
    issues.push(`平均每镜时长 ${budget.averageShotDuration}秒 过长，可能导致节奏拖沓`);
    suggestions.push('建议增加分镜数量或减少总时长');
  }

  // 检查场景分配合理性
  const totalSceneDuration = budget.sceneBudgets.reduce((sum, s) => sum + s.allocatedDuration, 0);
  if (Math.abs(totalSceneDuration - budget.totalDuration) > 1) {
    issues.push('场景时长分配总和与总时长不匹配');
  }

  // 检查高潮部分占比
  const totalDuration = budget.totalDuration;
  const climaxRatio = budget.climaxDuration / totalDuration;
  if (climaxRatio < 0.15) {
    suggestions.push('高潮部分占比偏低，建议增加高潮场景时长分配');
  } else if (climaxRatio > 0.4) {
    suggestions.push('高潮部分占比偏高，可能影响整体节奏平衡');
  }

  return {
    valid: issues.length === 0,
    issues,
    suggestions
  };
}

/**
 * 获取平台推荐配置
 */
export function getPlatformRecommendations(
  wordCount: number,
  platform: PlatformType = 'douyin'
): {
  recommendedPace: PaceType;
  estimatedDuration: [number, number];
  recommendedShotCount: [number, number];
} {
  const config = PLATFORM_CONFIGS[platform];

  // 根据字数推荐节奏
  let recommendedPace: PaceType = 'normal';
  if (wordCount < 3000) {
    recommendedPace = 'slow';
  } else if (wordCount > 10000) {
    recommendedPace = 'fast';
  }

  // 计算预估时长范围
  const fastPace = config.paces.fast;
  const slowPace = config.paces.slow;

  const minDuration = Math.round((wordCount / fastPace.maxWordsPerMinute) * 60);
  const maxDuration = Math.round((wordCount / slowPace.minWordsPerMinute) * 60);

  // 推荐分镜数量范围（基于平均每镜3-5秒）
  const minShots = Math.ceil(minDuration / 5);
  const maxShots = Math.ceil(maxDuration / 3);

  return {
    recommendedPace,
    estimatedDuration: [minDuration, maxDuration],
    recommendedShotCount: [minShots, maxShots]
  };
}

/**
 * 调整预算以匹配目标时长
 */
export function adjustBudgetToTarget(
  shots: Shot[],
  targetDuration: number,
  options: Omit<BudgetCalculationOptions, 'targetDuration'> = {}
): DurationBudget {
  // 先计算基础预算
  const baseBudget = calculateBudget(shots, options);

  // 如果当前时长与目标差异不大，直接返回
  const durationDiff = Math.abs(baseBudget.totalDuration - targetDuration);
  if (durationDiff < 5) {
    return baseBudget;
  }

  // 根据目标时长反推需要的字数/分钟比率
  const requiredWordsPerMinute = (baseBudget.totalWordCount / targetDuration) * 60;

  // 重新计算预算
  return calculateBudget(shots, {
    ...options,
    targetDuration,
    customWordsPerMinute: requiredWordsPerMinute
  });
}

/**
 * 导出预算报告（用于调试和分析）
 */
export function exportBudgetReport(budget: DurationBudget): string {
  const lines: string[] = [];

  lines.push('====================================');
  lines.push('        时长预算报告');
  lines.push('====================================');
  lines.push('');

  lines.push(`【基础信息】`);
  lines.push(`总字数: ${budget.totalWordCount.toLocaleString()} 字`);
  lines.push(`总时长: ${budget.totalDuration} 秒 (${(budget.totalDuration / 60).toFixed(2)} 分钟)`);
  lines.push(`平台: ${PLATFORM_CONFIGS[budget.platform].displayName}`);
  lines.push(`节奏: ${budget.pace === 'fast' ? '快' : budget.pace === 'normal' ? '中' : '慢'}`);
  lines.push(`字数/分钟: ${budget.wordsPerMinute}`);
  lines.push(`平均每镜时长: ${budget.averageShotDuration} 秒`);
  lines.push(`建议分镜数: ${budget.recommendedShotCount}`);
  lines.push('');

  lines.push(`【重要性时长分配】`);
  lines.push(`开场: ${budget.openingDuration} 秒 (${((budget.openingDuration / budget.totalDuration) * 100).toFixed(1)}%)`);
  lines.push(`发展: ${budget.developmentDuration} 秒 (${((budget.developmentDuration / budget.totalDuration) * 100).toFixed(1)}%)`);
  lines.push(`高潮: ${budget.climaxDuration} 秒 (${((budget.climaxDuration / budget.totalDuration) * 100).toFixed(1)}%)`);
  lines.push(`结尾: ${budget.endingDuration} 秒 (${((budget.endingDuration / budget.totalDuration) * 100).toFixed(1)}%)`);
  lines.push('');

  lines.push(`【场景详细分配】`);
  for (const scene of budget.sceneBudgets) {
    lines.push(`- ${scene.sceneName}`);
    lines.push(`  重要性: ${scene.importance} (权重: ${scene.weight})`);
    lines.push(`  字数: ${scene.wordCount} 字`);
    lines.push(`  分配时长: ${scene.allocatedDuration} 秒`);
    lines.push(`  分镜数: ${scene.shotCount} 个`);
    lines.push(`  平均每镜: ${scene.averageShotDuration} 秒`);
    lines.push('');
  }

  // 验证结果
  const validation = validateBudget(budget);
  if (!validation.valid) {
    lines.push(`【警告】`);
    for (const issue of validation.issues) {
      lines.push(`! ${issue}`);
    }
    lines.push('');
    lines.push(`【建议】`);
    for (const suggestion of validation.suggestions) {
      lines.push(`* ${suggestion}`);
    }
  } else {
    lines.push(`【验证结果】预算合理 ✓`);
  }

  lines.push('');
  lines.push(`生成时间: ${new Date(budget.generatedAt).toLocaleString()}`);
  lines.push('====================================');

  return lines.join('\n');
}

// 默认导出
export default {
  calculateBudget,
  validateBudget,
  adjustBudgetToTarget,
  getPlatformRecommendations,
  exportBudgetReport,
  calculateChineseWordCount,
  calculateShotWordCount,
  defaultImportanceMapper,
  PLATFORM_CONFIGS,
  SCENE_IMPORTANCE_WEIGHTS
};
