/**
 * EpisodePlanner - 智能分集规划器
 *
 * 根据平台标准、字数、场景列表，智能规划分集方案
 *
 * @module services/parsing/EpisodePlanner
 * @version 1.0.0
 */

import {
  ScriptScene,
  EpisodePlan,
  EpisodeInfo,
  PlatformEpisodeStandard,
  Shot,
  EpisodeEstimate,
} from '../../types';
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
   * 创建分集估算（Phase 1 - 事前估算）
   * 不依赖分镜数据，用于分镜生成前的约束
   * @param scenes - 场景列表
   * @param platform - 平台类型
   * @param wordCount - 字数
   * @param pacingPreference - 节奏偏好
   * @returns 分集估算结果
   */
  static createEpisodeEstimate(
    scenes: ScriptScene[],
    platform: string,
    wordCount: number,
    pacingPreference: 'fast' | 'normal' | 'slow' = 'normal'
  ): EpisodeEstimate {
    const standard = PlatformStandardService.getStandard(platform);
    if (!standard) {
      // 备用方案：基于经验公式估算
      const totalEpisodes = Math.max(3, Math.ceil(wordCount / 5000));
      const shotsPerEpisode = 30; // 默认每集 30 个分镜
      return {
        id: crypto.randomUUID(),
        platform: platform as any,
        totalEpisodesEstimate: totalEpisodes,
        totalShotsEstimate: totalEpisodes * shotsPerEpisode,
        totalDurationEstimate: totalEpisodes * 1, // 假设每集 1 分钟
        confidence: 0.6, // 备用方案置信度较低
        isPhase2: false,
      };
    }

    // 使用平台标准进行估算
    const totalEpisodes = PlatformStandardService.getRecommendedEpisodeCount(
      platform,
      wordCount,
      pacingPreference
    );

    const shotsPerEpisode = PlatformStandardService.getRecommendedShotCountPerEpisode(
      platform,
      pacingPreference
    );

    const totalDurationEstimate = (totalEpisodes * (standard.episodeDurationRange[0] || 60)) / 60;

    return {
      id: crypto.randomUUID(),
      platform: platform as any,
      totalEpisodesEstimate: totalEpisodes,
      totalShotsEstimate: totalEpisodes * shotsPerEpisode,
      totalDurationEstimate,
      confidence: 0.8, // Phase 1 估算，置信度较低
      isPhase2: false,
    };
  }

  /**
   * 计算最佳分集方案
   */
  static calculateEpisodePlan(
    scenes: ScriptScene[],
    platform: string,
    wordCount: number,
    pacingPreference: 'fast' | 'normal' | 'slow' = 'normal',
    shots: Shot[] = []
  ): EpisodePlan {
    // 1. 获取平台标准
    const standard = PlatformStandardService.getStandard(platform);
    if (!standard) {
      return this.createFallbackPlan(scenes, wordCount, shots);
    }

    // 2. 分析剧情结构
    const plotStructure = this.analyzePlotStructure(scenes);

    // 3. 计算最佳集数
    const totalEpisodes = PlatformStandardService.getRecommendedEpisodeCount(
      platform,
      wordCount,
      pacingPreference
    );

    // 4. 将场景分组到各集（基于分镜时长）
    const episodes = this.groupScenesIntoEpisodes(
      scenes,
      totalEpisodes,
      plotStructure,
      standard,
      pacingPreference,
      shots
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
   * 计算每个场景的总时长
   */
  private static calculateSceneDurations(
    scenes: ScriptScene[],
    shots: Shot[]
  ): { [sceneName: string]: number } {
    const sceneDurations: { [sceneName: string]: number } = {};
    scenes.forEach(scene => {
      const sceneShots = shots.filter(shot => shot.sceneName === scene.name);
      sceneDurations[scene.name] = sceneShots.reduce((sum, shot) => sum + (shot.duration || 3), 0);
    });
    return sceneDurations;
  }

  /**
   * 将场景分组到各集（基于分镜时长）
   */
  private static groupScenesIntoEpisodes(
    scenes: ScriptScene[],
    totalEpisodes: number,
    plotStructure: PlotStructure,
    standard: PlatformEpisodeStandard,
    pacingPreference: 'fast' | 'normal' | 'slow',
    shots: Shot[]
  ): EpisodeInfo[] {
    const episodes: EpisodeInfo[] = [];
    const recommendedEpisodeDuration = PlatformStandardService.getRecommendedEpisodeDuration(
      standard.platform,
      pacingPreference
    );
    const recommendedShotCount = PlatformStandardService.getRecommendedShotCountPerEpisode(
      standard.platform,
      pacingPreference
    );

    // 计算每个场景的总时长
    const sceneDurations = this.calculateSceneDurations(scenes, shots);

    // 先找到高潮场景的索引范围
    const climaxSceneNames = plotStructure.climaxScenes.map(s => s.name);
    const climaxStartIndex = scenes.findIndex(s => climaxSceneNames.includes(s.name));
    let climaxEndIndex = -1;
    if (climaxStartIndex >= 0) {
      for (let i = scenes.length - 1; i >= 0; i--) {
        if (climaxSceneNames.includes(scenes[i].name)) {
          climaxEndIndex = i;
          break;
        }
      }
    }

    let currentSceneIndex = 0;
    let episodeNumber = 1;

    // 分组到各集
    while (currentSceneIndex < scenes.length && episodeNumber <= totalEpisodes) {
      let isClimaxEpisode = false;
      let episodeScenes: ScriptScene[] = [];
      let episodeDuration = 0;

      // 检查是否需要单独安排高潮集
      if (
        climaxStartIndex >= 0 &&
        currentSceneIndex <= climaxStartIndex &&
        currentSceneIndex + Math.ceil(scenes.length / totalEpisodes) > climaxStartIndex
      ) {
        // 单独安排高潮集
        episodeScenes = scenes.slice(climaxStartIndex, climaxEndIndex + 1);
        episodeDuration = episodeScenes.reduce(
          (sum, s) =>
            sum + (sceneDurations[s.name] || recommendedEpisodeDuration / episodeScenes.length),
          0
        );
        currentSceneIndex = climaxEndIndex + 1;
        isClimaxEpisode = true;
      } else {
        // 正常分组，基于时长
        let targetDuration = recommendedEpisodeDuration;
        // 调整目标时长以确保能分配完所有场景
        const remainingEpisodes = totalEpisodes - episodeNumber + 1;
        const remainingScenes = scenes.slice(currentSceneIndex);
        const remainingDuration = remainingScenes.reduce(
          (sum, s) => sum + (sceneDurations[s.name] || recommendedEpisodeDuration / totalEpisodes),
          0
        );
        if (remainingEpisodes > 1) {
          targetDuration = remainingDuration / remainingEpisodes;
        }

        for (let i = currentSceneIndex; i < scenes.length; i++) {
          const scene = scenes[i];
          const sceneDuration =
            sceneDurations[scene.name] || recommendedEpisodeDuration / Math.max(totalEpisodes, 1);

          // 如果加入当前场景会超时太多，停止
          if (episodeDuration > 0 && episodeDuration + sceneDuration > targetDuration * 1.3) {
            break;
          }

          episodeScenes.push(scene);
          episodeDuration += sceneDuration;

          // 检查是否包含高潮场景
          if (climaxSceneNames.includes(scene.name)) {
            isClimaxEpisode = true;
          }
        }
        currentSceneIndex += episodeScenes.length;
      }

      // 确保每集至少有一个场景
      if (episodeScenes.length === 0 && currentSceneIndex < scenes.length) {
        episodeScenes = [scenes[currentSceneIndex]];
        episodeDuration = sceneDurations[episodeScenes[0].name] || recommendedEpisodeDuration;
        currentSceneIndex++;
      }

      // 计算本集的分镜数量
      const episodeShotCount = episodeScenes.reduce((sum, scene) => {
        return sum + shots.filter(shot => shot.sceneName === scene.name).length;
      }, 0);

      episodes.push({
        episodeNumber,
        title: `第${episodeNumber}集`,
        sceneNames: episodeScenes.map(s => s.name),
        estimatedDuration: Math.max(episodeDuration, 30),
        estimatedShotCount: Math.max(episodeShotCount, recommendedShotCount),
        summary: '',
        isClimax:
          isClimaxEpisode ||
          this.isClimaxEpisode(episodeNumber - 1, totalEpisodes, plotStructure, episodeScenes),
      });

      episodeNumber++;
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

      // 检查是否包含高潮场景
      const hasClimaxScene = plotStructure.climaxScenes.some(cs =>
        episode.sceneNames.includes(cs.name)
      );

      if (isTurningPoint) {
        episode.cliffhanger = '关键转折点即将揭晓，剧情迎来重大变化，敬请期待下一集！';
      } else if (hasClimaxScene || episode.isClimax) {
        episode.cliffhanger = '高潮迭起，精彩继续！下一集将迎来更为震撼的剧情发展！';
      } else if (index === episodes.length - 2) {
        // 倒数第二集的悬念
        episode.cliffhanger = '所有线索汇聚，终章即将开启！下一集将迎来故事的最终结局！';
      } else if (index === 0) {
        // 第一集的悬念
        episode.cliffhanger = '故事刚刚开始，更多精彩内容即将呈现，请继续观看下一集！';
      } else {
        // 普通集的悬念
        episode.cliffhanger = '精彩未完待续，下集更加精彩！';
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
  private static createFallbackPlan(
    scenes: ScriptScene[],
    wordCount: number,
    shots: Shot[] = []
  ): EpisodePlan {
    const totalEpisodes = Math.max(3, Math.ceil(wordCount / 5000));
    const episodes: EpisodeInfo[] = [];
    const scenesPerEpisode = Math.ceil(scenes.length / totalEpisodes);

    // 计算每个场景的总时长
    const sceneDurations = this.calculateSceneDurations(scenes, shots);

    for (let i = 0; i < totalEpisodes; i++) {
      const startIndex = i * scenesPerEpisode;
      const endIndex = Math.min((i + 1) * scenesPerEpisode, scenes.length);
      const episodeScenes = scenes.slice(startIndex, endIndex);

      // 计算本集的实际时长和分镜数
      const episodeDuration = episodeScenes.reduce(
        (sum, s) => sum + (sceneDurations[s.name] || 120 / totalEpisodes),
        0
      );
      const episodeShotCount = episodeScenes.reduce((sum, scene) => {
        return sum + shots.filter(shot => shot.sceneName === scene.name).length;
      }, 0);

      episodes.push({
        episodeNumber: i + 1,
        title: `第${i + 1}集`,
        sceneNames: episodeScenes.map(s => s.name),
        estimatedDuration: Math.max(episodeDuration, 60),
        estimatedShotCount: Math.max(episodeShotCount, 10),
        summary: '',
        isClimax: i >= Math.floor(totalEpisodes * 0.6) && i <= Math.floor(totalEpisodes * 0.85),
      });
    }

    const totalDuration = episodes.reduce((sum, e) => sum + e.estimatedDuration, 0);

    return {
      id: crypto.randomUUID(),
      totalEpisodes,
      episodes,
      description: `基于字数规划了${totalEpisodes}集，总时长约${Math.round(totalDuration / 60)}分钟`,
      totalDuration,
    };
  }
}

export default EpisodePlanner;
