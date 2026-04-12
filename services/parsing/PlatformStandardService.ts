/**
 * PlatformStandardService - 平台标准配置服务
 *
 * 定义每个平台的详细标准，用于智能分集规划
 *
 * @module services/parsing/PlatformStandardService
 * @version 1.0.0
 */

import { PlatformEpisodeStandard } from '../../types';

/**
 * 平台分集标准配置
 */
export const PLATFORM_EPISODE_STANDARDS: Record<string, PlatformEpisodeStandard> = {
  douyin: {
    platform: 'douyin',
    episodeDurationRange: [60, 180], // 1-3 分钟
    recommendedEpisodeDuration: 120, // 2 分钟
    totalEpisodesRange: [10, 50],
    shotsPerEpisodeRange: [8, 20],  // 从 [15,45] 降低到 [8,20]，符合行业标准
    hookRequirements: {
      hookWithinSeconds: 3, // 0-3 秒必须有钩子
      hookTypes: ['question', 'shock', 'mystery', 'conflict'],
    },
    twistRequirements: {
      twistEverySeconds: 30, // 每 30 秒一个反转
    },
    characterIntroductionRequirements: {
      characterWithinSeconds: 15, // 15 秒内人物必须出场
    },
  },
  kuaishou: {
    platform: 'kuaishou',
    episodeDurationRange: [90, 300], // 1.5-5 分钟
    recommendedEpisodeDuration: 180, // 3 分钟
    totalEpisodesRange: [10, 30],
    shotsPerEpisodeRange: [10, 25],  // 从 [20,50] 降低到 [10,25]
    hookRequirements: {
      hookWithinSeconds: 5,
      hookTypes: ['authenticity', 'emotion', 'relatable'],
    },
    twistRequirements: {
      twistEverySeconds: 45,
    },
    characterIntroductionRequirements: {
      characterWithinSeconds: 20,
    },
  },
  bilibili: {
    platform: 'bilibili',
    episodeDurationRange: [300, 900], // 5-15 分钟
    recommendedEpisodeDuration: 600, // 10 分钟
    totalEpisodesRange: [8, 24],
    shotsPerEpisodeRange: [25, 60],  // 从 [50,150] 降低到 [25,60]
    hookRequirements: {
      hookWithinSeconds: 15,
      hookTypes: ['world_building', 'character', 'mystery'],
    },
    twistRequirements: {
      twistEverySeconds: 120,
    },
    characterIntroductionRequirements: {
      characterWithinSeconds: 30,
    },
  },
  premium: {
    platform: 'premium',
    episodeDurationRange: [180, 600], // 3-10 分钟
    recommendedEpisodeDuration: 480, // 8 分钟
    totalEpisodesRange: [1, 8], // 1-8 集（短篇≤3 集）
    shotsPerEpisodeRange: [15, 40],  // 从 [20,60] 降低到 [15,40]
    hookRequirements: {
      hookWithinSeconds: 30,
      hookTypes: ['cinematic', 'artistic', 'theme'],
    },
    twistRequirements: {
      twistEverySeconds: 180,
    },
    characterIntroductionRequirements: {
      characterWithinSeconds: 60,
    },
  },
};

/**
 * 平台标准服务类
 */
export class PlatformStandardService {
  /**
   * 获取指定平台的标准配置
   */
  static getStandard(platform: string): PlatformEpisodeStandard | undefined {
    return PLATFORM_EPISODE_STANDARDS[platform];
  }

  /**
   * 获取所有可用平台
   */
  static getAvailablePlatforms(): string[] {
    return Object.keys(PLATFORM_EPISODE_STANDARDS);
  }

  /**
   * 根据平台和节奏获取推荐的单集时长
   */
  static getRecommendedEpisodeDuration(
    platform: string,
    pacingPreference: 'fast' | 'normal' | 'slow' = 'normal'
  ): number {
    const standard = this.getStandard(platform);
    if (!standard) return 120;

    let multiplier = 1.0;
    switch (pacingPreference) {
      case 'fast':
        multiplier = 0.8;
        break;
      case 'slow':
        multiplier = 1.3;
        break;
      default:
        multiplier = 1.0;
    }

    return Math.round(standard.recommendedEpisodeDuration * multiplier);
  }

  /**
   * 根据平台和字数获取推荐的总集数
   */
  static getRecommendedEpisodeCount(
    platform: string,
    wordCount: number,
    pacingPreference: 'fast' | 'normal' | 'slow' = 'normal'
  ): number {
    const standard = this.getStandard(platform);
    if (!standard) return 20;

    // 根据字数和平台标准计算推荐集数
    const wordsPerEpisode = this.getWordsPerEpisode(platform, pacingPreference);
    const rawCount = Math.ceil(wordCount / wordsPerEpisode);

    // 新增：根据字数智能判断合理集数范围
    let minEpisodes = standard.totalEpisodesRange[0];
    let maxEpisodes = standard.totalEpisodesRange[1];

    // 短篇文本（≤5000字）：最多3集（行业常识：短篇核心单元≤3）
    if (wordCount <= 5000) {
      maxEpisodes = Math.min(maxEpisodes, 3);
      minEpisodes = 1; // 短篇至少1集
    }

    // 确保在合理范围内
    return Math.max(minEpisodes, Math.min(maxEpisodes, rawCount));
  }

  /**
   * 根据平台和节奏获取每集推荐字数
   */
  private static getWordsPerEpisode(
    platform: string,
    pacingPreference: 'fast' | 'normal' | 'slow' = 'normal'
  ): number {
    // 统一基础值：小说类180字/分钟（简洁实用，不搞复杂）
    const baseWordsPerMinute = 180;

    // 不同平台用乘数调整（而不是完全不同的数值）
    let platformMultiplier = 1.0;
    switch (platform) {
      case 'douyin':
        platformMultiplier = 1.3; // 抖音节奏快 +30%
        break;
      case 'kuaishou':
        platformMultiplier = 1.2; // 快手节奏较快 +20%
        break;
      case 'bilibili':
        platformMultiplier = 1.0; // B站适中
        break;
      case 'premium':
        platformMultiplier = 0.9; // 精品节奏稍慢 -10%
        break;
    }

    // 节奏调整
    let pacingMultiplier = 1.0;
    switch (pacingPreference) {
      case 'fast':
        pacingMultiplier = 1.2;
        break;
      case 'slow':
        pacingMultiplier = 0.8;
        break;
    }

    const wordsPerMinute = baseWordsPerMinute * platformMultiplier * pacingMultiplier;

    const standard = this.getStandard(platform);
    const episodeDurationMinutes = (standard?.recommendedEpisodeDuration || 120) / 60;

    return Math.round(wordsPerMinute * episodeDurationMinutes);
  }

  /**
   * 根据平台获取推荐的每集分镜数
   */
  static getRecommendedShotCountPerEpisode(
    platform: string,
    pacingPreference: 'fast' | 'normal' | 'slow' = 'normal'
  ): number {
    const standard = this.getStandard(platform);
    if (!standard) return 30;

    const [minShots, maxShots] = standard.shotsPerEpisodeRange;

    let multiplier = 1.0;
    switch (pacingPreference) {
      case 'fast':
        multiplier = 1.2; // 快节奏需要更多分镜
        break;
      case 'slow':
        multiplier = 0.8; // 慢节奏需要更少分镜
        break;
      default:
        multiplier = 1.0;
    }

    const avgShots = (minShots + maxShots) / 2;
    return Math.round(avgShots * multiplier);
  }
}

export default PlatformStandardService;
