/**
 * EpisodePlanner - 智能分集规划器
 *
 * 根据平台标准、字数、场景列表，智能规划分集方案
 *
 * @module services/parsing/EpisodePlanner
 * @version 1.0.0
 */

import { ScriptScene, EpisodePlan, EpisodeInfo, PlatformEpisodeStandard } from '../../types';
import PlatformStandardService from './PlatformStandardService';

/**
 * 剧情结构分析结果
 */
interface PlotStructure {
  act1Scenes: ScriptScene[];
  act2aScenes: ScriptScene[];
  act2bScenes: ScriptScene[];
  act3Scenes: ScriptScene[];
  climaxScenes: ScriptScene[];
  turningPoints: ScriptScene[];
}

/**
 * 智能分集规划器
 */
export class EpisodePlanner {
  /**
   * 计算最佳分集方案
   */
  static calculateEpisodePlan(
    scenes: ScriptScene[],
    platform: string,
    wordCount: number,
    pacingPreference: 'fast' | 'normal' | 'slow' = 'normal'
  ): EpisodePlan {
    // 1. 获取平台标准
    const standard = PlatformStandardService.getStandard(platform);
    if (!standard) {
      return this.createFallbackPlan(scenes, wordCount);
    }

    // 2. 分析剧情结构
    const plotStructure = this.analyzePlotStructure(scenes);

    // 3. 计算最佳集数
    const totalEpisodes = PlatformStandardService.getRecommendedEpisodeCount(
      platform,
      wordCount,
      pacingPreference
    );

    // 4. 将场景分组到各集
    const episodes = this.groupScenesIntoEpisodes(
      scenes,
      totalEpisodes,
      plotStructure,
      standard,
      pacingPreference
    );

    // 5. 生成每集标题和概要
    this.generateEpisodeTitlesAndSummaries(episodes, scenes);

    // 6. 确保每集结尾有悬念
    this.ensureCliffhangers(episodes, plotStructure);

    // 7. 计算总时长
    const totalDuration = episodes.reduce((sum, e) => sum + e.estimatedDuration, 0);

    return {
      id: crypto.randomUUID(),
      totalEpisodes,
      episodes,
      description: this.generatePlanDescription(episodes, platform, standard),
      totalDuration,
    };
  }

  /**
   * 分析剧情结构
   */
  private static analyzePlotStructure(scenes: ScriptScene[]): PlotStructure {
    const totalScenes = scenes.length;

    return {
      act1Scenes: scenes.slice(0, Math.floor(totalScenes * 0.25)),
      act2aScenes: scenes.slice(Math.floor(totalScenes * 0.25), Math.floor(totalScenes * 0.5)),
      act2bScenes: scenes.slice(Math.floor(totalScenes * 0.5), Math.floor(totalScenes * 0.75)),
      act3Scenes: scenes.slice(Math.floor(totalScenes * 0.75)),
      climaxScenes: this.findClimaxScenes(scenes),
      turningPoints: this.findTurningPoints(scenes),
    };
  }

  /**
   * 找到高潮场景
   */
  private static findClimaxScenes(scenes: ScriptScene[]): ScriptScene[] {
    if (scenes.length === 0) return [];

    const totalScenes = scenes.length;
    const climaxStart = Math.floor(totalScenes * 0.6);
    const climaxEnd = Math.floor(totalScenes * 0.85);

    return scenes.slice(climaxStart, climaxEnd);
  }

  /**
   * 找到剧情转折点
   */
  private static findTurningPoints(scenes: ScriptScene[]): ScriptScene[] {
    if (scenes.length < 4) return [];

    const totalScenes = scenes.length;
    const turningPoints: ScriptScene[] = [];

    // 第一幕结尾
    if (totalScenes > 3) {
      turningPoints.push(scenes[Math.floor(totalScenes * 0.25)]);
    }

    // 第二幕中点
    if (totalScenes > 6) {
      turningPoints.push(scenes[Math.floor(totalScenes * 0.5)]);
    }

    // 第二幕结尾
    if (totalScenes > 9) {
      turningPoints.push(scenes[Math.floor(totalScenes * 0.75)]);
    }

    return turningPoints;
  }

  /**
   * 将场景分组到各集
   */
  private static groupScenesIntoEpisodes(
    scenes: ScriptScene[],
    totalEpisodes: number,
    plotStructure: PlotStructure,
    standard: PlatformEpisodeStandard,
    pacingPreference: 'fast' | 'normal' | 'slow'
  ): EpisodeInfo[] {
    const episodes: EpisodeInfo[] = [];
    const scenesPerEpisode = Math.ceil(scenes.length / totalEpisodes);
    const recommendedEpisodeDuration = PlatformStandardService.getRecommendedEpisodeDuration(
      standard.platform,
      pacingPreference
    );
    const recommendedShotCount = PlatformStandardService.getRecommendedShotCountPerEpisode(
      standard.platform,
      pacingPreference
    );

    // 简单分组：按顺序分配场景
    for (let i = 0; i < totalEpisodes; i++) {
      const startIndex = i * scenesPerEpisode;
      const endIndex = Math.min((i + 1) * scenesPerEpisode, scenes.length);
      const episodeScenes = scenes.slice(startIndex, endIndex);

      const isClimax = this.isClimaxEpisode(i, totalEpisodes, plotStructure, episodeScenes);

      episodes.push({
        episodeNumber: i + 1,
        title: `第${i + 1}集`,
        sceneNames: episodeScenes.map(s => s.name),
        estimatedDuration: recommendedEpisodeDuration,
        estimatedShotCount: recommendedShotCount,
        summary: '',
        isClimax,
      });
    }

    return episodes;
  }

  /**
   * 判断是否为高潮集
   */
  private static isClimaxEpisode(
    episodeIndex: number,
    totalEpisodes: number,
    plotStructure: PlotStructure,
    episodeScenes: ScriptScene[]
  ): boolean {
    // 检查是否在第三幕（高潮部分）
    const episodePosition = (episodeIndex + 1) / totalEpisodes;
    if (episodePosition >= 0.6 && episodePosition <= 0.85) {
      return true;
    }

    // 检查是否包含高潮场景
    const hasClimaxScene = episodeScenes.some(scene => plotStructure.climaxScenes.includes(scene));

    return hasClimaxScene;
  }

  /**
   * 生成每集标题和概要
   */
  private static generateEpisodeTitlesAndSummaries(
    episodes: EpisodeInfo[],
    allScenes: ScriptScene[]
  ): void {
    episodes.forEach((episode, index) => {
      // 简单标题生成
      if (episode.isClimax) {
        episode.title = `第${index + 1}集 - 高潮`;
      } else if (index === 0) {
        episode.title = `第${index + 1}集 - 开篇`;
      } else if (index === episodes.length - 1) {
        episode.title = `第${index + 1}集 - 结局`;
      }

      // 简单概要生成
      const sceneCount = episode.sceneNames.length;
      if (sceneCount > 0) {
        episode.summary = `本集包含${sceneCount}个场景：${episode.sceneNames.join('、')}`;
      }
    });
  }

  /**
   * 确保每集结尾有悬念
   */
  private static ensureCliffhangers(episodes: EpisodeInfo[], plotStructure: PlotStructure): void {
    episodes.forEach((episode, index) => {
      // 最后一集不需要悬念
      if (index === episodes.length - 1) return;

      // 检查是否为转折点
      const isTurningPoint = plotStructure.turningPoints.some(tp =>
        episode.sceneNames.includes(tp.name)
      );

      if (isTurningPoint || episode.isClimax) {
        episode.cliffhanger = '本集结尾有重要转折，请继续观看下一集';
      }
    });
  }

  /**
   * 生成方案描述
   */
  private static generatePlanDescription(
    episodes: EpisodeInfo[],
    platform: string,
    standard: PlatformEpisodeStandard
  ): string {
    const totalDurationMinutes = Math.round(
      episodes.reduce((sum, e) => sum + e.estimatedDuration, 0) / 60
    );
    const climaxCount = episodes.filter(e => e.isClimax).length;

    const platformNames: Record<string, string> = {
      douyin: '抖音',
      kuaishou: '快手',
      bilibili: 'B站',
      premium: '精品',
    };

    return `
基于${platformNames[platform] || platform}平台标准，为您规划了${episodes.length}集。
- 总时长：约${totalDurationMinutes}分钟
- 单集时长：${Math.round(standard.recommendedEpisodeDuration / 60)}分钟
- 高潮集数：${climaxCount}集
- 每集分镜数：约${episodes[0]?.estimatedShotCount || 30}个
`.trim();
  }

  /**
   * 创建备用方案（当平台标准不存在时）
   */
  private static createFallbackPlan(scenes: ScriptScene[], wordCount: number): EpisodePlan {
    const totalEpisodes = Math.max(3, Math.ceil(wordCount / 5000));
    const episodes: EpisodeInfo[] = [];
    const scenesPerEpisode = Math.ceil(scenes.length / totalEpisodes);

    for (let i = 0; i < totalEpisodes; i++) {
      const startIndex = i * scenesPerEpisode;
      const endIndex = Math.min((i + 1) * scenesPerEpisode, scenes.length);
      const episodeScenes = scenes.slice(startIndex, endIndex);

      episodes.push({
        episodeNumber: i + 1,
        title: `第${i + 1}集`,
        sceneNames: episodeScenes.map(s => s.name),
        estimatedDuration: 120, // 默认2分钟
        estimatedShotCount: 30, // 默认30个分镜
        summary: '',
        isClimax: i >= Math.floor(totalEpisodes * 0.6) && i <= Math.floor(totalEpisodes * 0.85),
      });
    }

    return {
      id: crypto.randomUUID(),
      totalEpisodes,
      episodes,
      description: `基于字数规划了${totalEpisodes}集，总时长约${totalEpisodes * 2}分钟`,
      totalDuration: totalEpisodes * 120,
    };
  }
}

export default EpisodePlanner;
