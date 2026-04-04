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
    episodeDurationRange: [60, 180], // 1-3分钟
    recommendedEpisodeDuration: 120, // 2分钟
    totalEpisodesRange: [10, 50],
    shotsPerEpisodeRange: [15, 45],
    hookRequirements: {
      hookWithinSeconds: 3, // 0-3秒必须有钩子
      hookTypes: ['question', 'shock', 'mystery', 'conflict'],
    },
    twistRequirements: {
      twistEverySeconds: 30, // 每30秒一个反转
    },
    characterIntroductionRequirements: {
      characterWithinSeconds: 15, // 15秒内人物必须出场
    },
  },
  kuaishou: {
    platform: 'kuaishou',
    episodeDurationRange: [90, 300], // 1.5-5分钟
    recommendedEpisodeDuration: 180, // 3分钟
    totalEpisodesRange: [10, 30],
    shotsPerEpisodeRange: [20, 50],
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
    episodeDurationRange: [300, 900], // 5-15分钟
    recommendedEpisodeDuration: 600, // 10分钟
    totalEpisodesRange: [8, 24],
    shotsPerEpisodeRange: [50, 150],
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
    episodeDurationRange: [600, 1800], // 10-30分钟
    recommendedEpisodeDuration: 900, // 15分钟
    totalEpisodesRange: [6, 16],
    shotsPerEpisodeRange: [80, 200],
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

    // 确保在合理范围内
    return Math.max(
      standard.totalEpisodesRange[0],
      Math.min(standard.totalEpisodesRange[1], rawCount)
    );
  }

  /**
   * 根据平台和节奏获取每集推荐字数
   */
  private static getWordsPerEpisode(
    platform: string,
    pacingPreference: 'fast' | 'normal' | 'slow' = 'normal'
  ): number {
    // 基础字数/分钟比率
    let wordsPerMinute = 225;

    switch (platform) {
      case 'douyin':
        wordsPerMinute = 280;
        break;
      case 'kuaishou':
        wordsPerMinute = 250;
        break;
      case 'bilibili':
        wordsPerMinute = 200;
        break;
      case 'premium':
        wordsPerMinute = 175;
        break;
    }

    // 节奏调整
    switch (pacingPreference) {
      case 'fast':
        wordsPerMinute *= 1.2;
        break;
      case 'slow':
        wordsPerMinute *= 0.8;
        break;
    }

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
