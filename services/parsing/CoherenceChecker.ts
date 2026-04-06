/**
 * CoherenceChecker - 连贯性检查器
 *
 * 检查剧情连贯性和镜头连贯性（专业增强版）
 *
 * @module services/parsing/CoherenceChecker
 * @version 3.0.0
 */

import {
  ScriptScene,
  Shot,
  EpisodePlan,
  CoherenceReport,
  CoherenceIssue,
  ShotCoherenceIssue,
  QualityScore,
  QualityStatistics,
  FixSuggestion,
} from '../../types';

/**
 * 连贯性检查配置接口
 */
export interface CoherenceCheckerConfig {
  plotCoherenceWeights?: { error: number; warning: number; info: number };
  shotCoherenceWeights?: { error: number; warning: number; info: number };
  visualQualityBaseScore?: number;
  visualQualityWeights?: { base: number; varietyWeight: number };
  narrativePacingBaseScore?: number;
  scenesPerEpisodeRange?: { min: number; max: number };
  overallScoreWeights?: { plot: number; shot: number; visual: number; pacing: number };
  minSceneCount?: number;
  maxScenesPerEpisode?: number;
  minTotalDurationMinutes?: number;
  maxTotalDurationMinutes?: number;
  shotVarietyMinShots?: number;
  shotVarietyWarningThreshold?: number;
}

/**
 * 连贯性检查器
 */
export class CoherenceChecker {
  /**
   * 生成连贯性报告（专业增强版）
   */
  static generateCoherenceReport(
    episodes: EpisodePlan | undefined,
    scenes: ScriptScene[],
    shots: Shot[],
    config?: CoherenceCheckerConfig
  ): CoherenceReport {
    const plotIssues: CoherenceIssue[] = [];
    const shotIssues: ShotCoherenceIssue[] = [];

    if (episodes) {
      // 检查剧情连贯性
      plotIssues.push(...this.checkPlotCoherence(episodes, scenes, config));
    }

    // 检查镜头连贯性（专业级）
    shotIssues.push(...this.checkShotCoherenceProfessional(shots, episodes, config));

    const hasPlotErrors = plotIssues.some(i => i.severity === 'error');
    const hasShotErrors = shotIssues.some(i => i.severity === 'error');

    // 生成质量评分
    const qualityScore = this.calculateQualityScore(
      plotIssues,
      shotIssues,
      shots,
      scenes,
      episodes,
      config
    );

    // 生成详细统计
    const statistics = this.calculateStatistics(shots, scenes, episodes, plotIssues, shotIssues);

    // 生成修复建议
    const fixSuggestions = this.generateFixSuggestions(
      plotIssues,
      shotIssues,
      shots,
      episodes,
      config
    );

    // 生成建议
    const suggestions: string[] = [];

    if (plotIssues.length > 0) {
      suggestions.push('建议检查剧情连贯性问题');
    }
    if (shotIssues.length > 0) {
      suggestions.push('建议检查镜头连贯性问题');
    }
    if (suggestions.length === 0) {
      suggestions.push('连贯性检查通过，建议进一步优化镜头语言');
    }

    return {
      valid: !hasPlotErrors && !hasShotErrors,
      plotCoherence: {
        valid: !hasPlotErrors,
        issues: plotIssues,
      },
      shotCoherence: {
        valid: !hasShotErrors,
        issues: shotIssues,
      },
      qualityScore,
      statistics,
      fixSuggestions,
      suggestions,
    };
  }

  /**
   * 计算质量评分
   */
  private static calculateQualityScore(
    plotIssues: CoherenceIssue[],
    shotIssues: ShotCoherenceIssue[],
    shots: Shot[],
    scenes: ScriptScene[],
    episodes: EpisodePlan | undefined,
    config?: CoherenceCheckerConfig
  ): QualityScore {
    const totalIssues = plotIssues.length + shotIssues.length;
    const errorCount =
      plotIssues.filter(i => i.severity === 'error').length +
      shotIssues.filter(i => i.severity === 'error').length;
    const warningCount =
      plotIssues.filter(i => i.severity === 'warning').length +
      shotIssues.filter(i => i.severity === 'warning').length;

    // 从配置读取权重
    const plotWeights = config?.plotCoherenceWeights || { error: 15, warning: 8, info: 3 };
    const shotWeights = config?.shotCoherenceWeights || { error: 12, warning: 6, info: 2 };
    const visualQualityBaseScore = config?.visualQualityBaseScore || 80;
    const visualQualityWeights = config?.visualQualityWeights || { base: 60, varietyWeight: 40 };
    const narrativePacingBaseScore = config?.narrativePacingBaseScore || 75;
    const scenesPerEpisodeRange = config?.scenesPerEpisodeRange || { min: 3, max: 8 };
    const overallScoreWeights = config?.overallScoreWeights || {
      plot: 0.3,
      shot: 0.3,
      visual: 0.2,
      pacing: 0.2,
    };

    // 剧情连贯性评分
    let plotCoherenceScore = 100;
    if (plotIssues.length > 0) {
      plotCoherenceScore -=
        plotIssues.filter(i => i.severity === 'error').length * plotWeights.error;
      plotCoherenceScore -=
        plotIssues.filter(i => i.severity === 'warning').length * plotWeights.warning;
      plotCoherenceScore -= plotIssues.filter(i => i.severity === 'info').length * plotWeights.info;
    }
    plotCoherenceScore = Math.max(0, plotCoherenceScore);

    // 镜头连贯性评分
    let shotCoherenceScore = 100;
    if (shotIssues.length > 0) {
      shotCoherenceScore -=
        shotIssues.filter(i => i.severity === 'error').length * shotWeights.error;
      shotCoherenceScore -=
        shotIssues.filter(i => i.severity === 'warning').length * shotWeights.warning;
      shotCoherenceScore -= shotIssues.filter(i => i.severity === 'info').length * shotWeights.info;
    }
    shotCoherenceScore = Math.max(0, shotCoherenceScore);

    // 视觉质量评分
    let visualQualityScore = visualQualityBaseScore;
    if (shots.length > 0) {
      const shotSizeVariety = this.calculateShotSizeVariety(shots);
      visualQualityScore = Math.min(
        100,
        visualQualityWeights.base + shotSizeVariety * visualQualityWeights.varietyWeight
      );
    }

    // 叙事节奏评分
    let narrativePacingScore = narrativePacingBaseScore;
    if (episodes && episodes.episodes.length > 0) {
      const avgScenesPerEpisode = scenes.length / episodes.episodes.length;
      if (
        avgScenesPerEpisode >= scenesPerEpisodeRange.min &&
        avgScenesPerEpisode <= scenesPerEpisodeRange.max
      ) {
        narrativePacingScore = 90;
      } else if (avgScenesPerEpisode < scenesPerEpisodeRange.min) {
        narrativePacingScore = 70;
      } else {
        narrativePacingScore = 75;
      }
    }

    // 总体评分
    const overall = Math.round(
      plotCoherenceScore * overallScoreWeights.plot +
        shotCoherenceScore * overallScoreWeights.shot +
        visualQualityScore * overallScoreWeights.visual +
        narrativePacingScore * overallScoreWeights.pacing
    );

    return {
      overall,
      plotCoherence: plotCoherenceScore,
      shotCoherence: shotCoherenceScore,
      visualQuality: visualQualityScore,
      narrativePacing: narrativePacingScore,
    };
  }

  /**
   * 计算景别多样性 (0-1)
   */
  private static calculateShotSizeVariety(shots: Shot[]): number {
    const shotSizes = new Set<string>();
    const keywords = {
      wide: ['全景', '远景', 'wide', 'full', 'establishing'],
      medium: ['中景', 'medium', 'mid'],
      close: ['近景', '特写', 'close', 'close-up', 'ecu'],
    };

    shots.forEach(shot => {
      const desc = (shot.description || '').toLowerCase();
      if (keywords.wide.some(k => desc.includes(k))) shotSizes.add('wide');
      if (keywords.medium.some(k => desc.includes(k))) shotSizes.add('medium');
      if (keywords.close.some(k => desc.includes(k))) shotSizes.add('close');
    });

    return shotSizes.size / 3;
  }

  /**
   * 计算详细统计
   */
  private static calculateStatistics(
    shots: Shot[],
    scenes: ScriptScene[],
    episodes: EpisodePlan | undefined,
    plotIssues: CoherenceIssue[],
    shotIssues: ShotCoherenceIssue[]
  ): QualityStatistics {
    const totalShots = shots.length;
    const totalScenes = scenes.length;
    const totalEpisodes = episodes?.episodes.length || 0;
    const totalDuration = episodes?.totalDuration || 0;

    const averageShotsPerEpisode = totalEpisodes > 0 ? totalShots / totalEpisodes : 0;
    const averageScenesPerEpisode = totalEpisodes > 0 ? totalScenes / totalEpisodes : 0;

    // 景别分布
    const shotSizeDistribution: Record<string, number> = {
      wide: 0,
      medium: 0,
      close: 0,
      unknown: 0,
    };

    const keywords = {
      wide: ['全景', '远景', 'wide', 'full', 'establishing'],
      medium: ['中景', 'medium', 'mid'],
      close: ['近景', '特写', 'close', 'close-up', 'ecu'],
    };

    shots.forEach(shot => {
      const desc = (shot.description || '').toLowerCase();
      let categorized = false;
      if (keywords.wide.some(k => desc.includes(k))) {
        shotSizeDistribution.wide++;
        categorized = true;
      } else if (keywords.medium.some(k => desc.includes(k))) {
        shotSizeDistribution.medium++;
        categorized = true;
      } else if (keywords.close.some(k => desc.includes(k))) {
        shotSizeDistribution.close++;
        categorized = true;
      }
      if (!categorized) {
        shotSizeDistribution.unknown++;
      }
    });

    // 问题统计
    const allIssues = [...plotIssues, ...shotIssues];
    const issueCount = {
      error: allIssues.filter(i => i.severity === 'error').length,
      warning: allIssues.filter(i => i.severity === 'warning').length,
      info: allIssues.filter(i => i.severity === 'info').length,
    };

    return {
      totalShots,
      totalScenes,
      totalEpisodes,
      totalDuration,
      averageShotsPerEpisode,
      averageScenesPerEpisode,
      shotSizeDistribution,
      issueCount,
    };
  }

  /**
   * 生成修复建议
   */
  private static generateFixSuggestions(
    plotIssues: CoherenceIssue[],
    shotIssues: ShotCoherenceIssue[],
    shots: Shot[],
    episodes: EpisodePlan | undefined,
    config?: CoherenceCheckerConfig
  ): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];
    let suggestionId = 0;
    const shotVarietyMinShots = config?.shotVarietyMinShots || 10;
    const shotVarietyWarningThreshold = config?.shotVarietyWarningThreshold || 0.5;

    // 景别跳脱问题的修复建议
    const shotSizeIssues = shotIssues.filter(i => i.type === 'shot_size');
    if (shotSizeIssues.length > 0) {
      suggestions.push({
        id: `fix-${suggestionId++}`,
        issueType: 'shot_size',
        severity: shotSizeIssues.some(i => i.severity === 'warning') ? 'warning' : 'info',
        issueDescription: `发现${shotSizeIssues.length}处景别跳脱问题`,
        fixDescription: '建议在景别变化较大的分镜之间插入过渡景别',
        steps: [
          '在全景和特写之间插入中景作为过渡',
          '避免连续使用相同景别超过3个',
          '考虑使用推拉镜头平滑景别变化',
        ],
        affectedItems: shotSizeIssues.map(i => ({
          episodeNumber: i.episodeNumber,
          shotIndex: i.shotIndex,
        })),
        priority: 2,
      });
    }

    // 180度规则问题的修复建议
    const oneEightyIssues = shotIssues.filter(i => i.type === '180_degree');
    if (oneEightyIssues.length > 0) {
      suggestions.push({
        id: `fix-${suggestionId++}`,
        issueType: '180_degree',
        severity: oneEightyIssues.some(i => i.severity === 'error') ? 'error' : 'warning',
        issueDescription: `发现${oneEightyIssues.length}处可能违反180度规则的问题`,
        fixDescription: '建议检查镜头轴线，确保角色对话时视线方向一致',
        steps: [
          '确定场景的动作轴线',
          '确保所有镜头都在轴线的同一侧',
          '如果需要越轴，插入中性镜头作为过渡',
        ],
        affectedItems: oneEightyIssues.map(i => ({
          episodeNumber: i.episodeNumber,
          shotIndex: i.shotIndex,
        })),
        priority: 1,
      });
    }

    // 动作匹配问题的修复建议
    const actionMatchIssues = shotIssues.filter(i => i.type === 'action_match');
    if (actionMatchIssues.length > 0) {
      suggestions.push({
        id: `fix-${suggestionId++}`,
        issueType: 'action_match',
        severity: actionMatchIssues.some(i => i.severity === 'warning') ? 'warning' : 'info',
        issueDescription: `发现${actionMatchIssues.length}处动作不匹配问题`,
        fixDescription: '建议确保前后分镜的动作连续性',
        steps: [
          '在前一个分镜的动作中点处切换',
          '保持动作的方向和速度一致',
          '考虑使用动作匹配剪辑技巧',
        ],
        affectedItems: actionMatchIssues.map(i => ({
          episodeNumber: i.episodeNumber,
          shotIndex: i.shotIndex,
        })),
        priority: 3,
      });
    }

    // 剧情连贯性问题的修复建议
    if (plotIssues.length > 0) {
      suggestions.push({
        id: `fix-${suggestionId++}`,
        issueType: 'plot_coherence',
        severity: plotIssues.some(i => i.severity === 'error') ? 'error' : 'warning',
        issueDescription: `发现${plotIssues.length}处剧情连贯性问题`,
        fixDescription: '建议检查剧情逻辑，确保叙事连贯',
        steps: ['检查场景之间的因果关系', '确保角色行为一致', '验证时间线的连续性'],
        affectedItems: plotIssues.map(i => ({
          episodeNumber: i.episodeNumber,
          sceneName: i.sceneName,
        })),
        priority: 1,
      });
    }

    // 景别多样性建议
    if (shots.length > shotVarietyMinShots) {
      const variety = this.calculateShotSizeVariety(shots);
      if (variety < shotVarietyWarningThreshold) {
        suggestions.push({
          id: `fix-${suggestionId++}`,
          issueType: 'shot_variety',
          severity: 'info',
          issueDescription: '景别多样性不足',
          fixDescription: '建议增加景别变化，提升视觉节奏',
          steps: [
            '混合使用全景、中景、特写',
            '在对话场景中使用正反打',
            '考虑使用移动镜头增加动态感',
          ],
          affectedItems: [],
          priority: 4,
        });
      }
    }

    return suggestions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 检查剧情连贯性
   */
  private static checkPlotCoherence(
    episodePlan: EpisodePlan,
    scenes: ScriptScene[],
    config?: CoherenceCheckerConfig
  ): CoherenceIssue[] {
    const issues: CoherenceIssue[] = [];
    const minSceneCount = config?.minSceneCount || 3;
    const maxScenesPerEpisode = config?.maxScenesPerEpisode || 10;
    const minTotalDurationMinutes = config?.minTotalDurationMinutes || 5;
    const maxTotalDurationMinutes = config?.maxTotalDurationMinutes || 30;
    const scenesPerEpisodeRange = config?.scenesPerEpisodeRange || { min: 3, max: 8 };

    // 1. 检查场景数量是否足够
    if (scenes.length < minSceneCount) {
      issues.push({
        type: 'plot_logic',
        severity: 'warning',
        message: '场景数量较少，建议增加场景丰富剧情',
      });
    }

    // 2. 检查每集场景数量是否合理
    episodePlan.episodes.forEach((episode, index) => {
      if (episode.sceneNames.length === 0) {
        issues.push({
          type: 'plot_logic',
          severity: 'warning',
          message: `第${episode.episodeNumber}集没有包含任何场景`,
          episodeNumber: episode.episodeNumber,
        });
      } else if (episode.sceneNames.length > maxScenesPerEpisode) {
        issues.push({
          type: 'plot_logic',
          severity: 'info',
          message: `第${episode.episodeNumber}集包含${episode.sceneNames.length}个场景，建议控制在${scenesPerEpisodeRange.min}-${scenesPerEpisodeRange.max}个场景`,
          episodeNumber: episode.episodeNumber,
        });
      }
    });

    // 3. 检查总时长是否合理
    const totalDurationMinutes = episodePlan.totalDuration / 60;
    if (totalDurationMinutes < minTotalDurationMinutes) {
      issues.push({
        type: 'timeline',
        severity: 'warning',
        message: `总时长较短（${Math.round(totalDurationMinutes)}分钟），建议增加内容`,
      });
    } else if (totalDurationMinutes > maxTotalDurationMinutes) {
      issues.push({
        type: 'timeline',
        severity: 'info',
        message: `总时长较长（${Math.round(totalDurationMinutes)}分钟），建议考虑拆分成更多集`,
      });
    }

    return issues;
  }

  /**
   * 检查镜头连贯性（专业级）
   */
  private static checkShotCoherenceProfessional(
    shots: Shot[],
    episodes: EpisodePlan | undefined,
    config?: CoherenceCheckerConfig
  ): ShotCoherenceIssue[] {
    const issues: ShotCoherenceIssue[] = [];

    if (shots.length < 2) {
      return issues;
    }

    for (let i = 1; i < shots.length; i++) {
      const prevShot = shots[i - 1];
      const currentShot = shots[i];

      // 1. 检查景别跳脱
      const shotSizeIssue = this.checkShotSizeProgression(prevShot, currentShot);
      if (shotSizeIssue) {
        issues.push({
          ...shotSizeIssue,
          shotIndex: i,
        });
      }

      // 2. 检查180度规则（增强版）
      const oneEightyIssue = this.check180DegreeRuleEnhanced(prevShot, currentShot);
      if (oneEightyIssue) {
        issues.push({
          ...oneEightyIssue,
          shotIndex: i,
        });
      }

      // 3. 检查动作匹配
      const actionMatchIssue = this.checkActionMatch(prevShot, currentShot);
      if (actionMatchIssue) {
        issues.push({
          ...actionMatchIssue,
          shotIndex: i,
        });
      }

      // 4. 检查视线匹配
      const eyeLineIssue = this.checkEyeLineMatch(prevShot, currentShot);
      if (eyeLineIssue) {
        issues.push({
          ...eyeLineIssue,
          shotIndex: i,
        });
      }

      // 5. 检查光线匹配
      const lightingIssue = this.checkLightingMatch(prevShot, currentShot);
      if (lightingIssue) {
        issues.push({
          ...lightingIssue,
          shotIndex: i,
        });
      }
    }

    return issues;
  }

  /**
   * 检查景别递进
   */
  private static checkShotSizeProgression(
    prevShot: Shot,
    currentShot: Shot
  ): Omit<ShotCoherenceIssue, 'shotIndex'> | null {
    // 简单的景别检查逻辑
    const prevDesc = (prevShot.description || '').toLowerCase();
    const currDesc = (currentShot.description || '').toLowerCase();

    // 检查是否连续使用相同景别
    const prevHasWide =
      prevDesc.includes('全景') ||
      prevDesc.includes('远景') ||
      prevDesc.includes('wide') ||
      prevDesc.includes('full');
    const currHasWide =
      currDesc.includes('全景') ||
      currDesc.includes('远景') ||
      currDesc.includes('wide') ||
      currDesc.includes('full');

    const prevHasClose =
      prevDesc.includes('特写') ||
      prevDesc.includes('近景') ||
      prevDesc.includes('close') ||
      prevDesc.includes('close-up');
    const currHasClose =
      currDesc.includes('特写') ||
      currDesc.includes('近景') ||
      currDesc.includes('close') ||
      currDesc.includes('close-up');

    if (prevHasWide && currHasWide) {
      return {
        type: 'shot_size',
        severity: 'info',
        message: '连续使用全景/远景，建议考虑景别变化',
      };
    }

    if (prevHasClose && currHasClose) {
      return {
        type: 'shot_size',
        severity: 'info',
        message: '连续使用近景/特写，建议考虑景别变化',
      };
    }

    // 检查景别跳脱过大
    if (prevHasWide && currHasClose) {
      return {
        type: 'shot_size',
        severity: 'warning',
        message: '景别从全景直接跳到特写，跳脱较大',
      };
    }

    return null;
  }

  /**
   * 检查180度规则（增强版）
   */
  private static check180DegreeRuleEnhanced(
    prevShot: Shot,
    currentShot: Shot
  ): Omit<ShotCoherenceIssue, 'shotIndex'> | null {
    const prevDesc = (prevShot.description || '').toLowerCase();
    const currDesc = (currentShot.description || '').toLowerCase();

    const leftKeywords = ['左', 'left', '左侧'];
    const rightKeywords = ['右', 'right', '右侧'];

    const prevHasLeft = leftKeywords.some(k => prevDesc.includes(k));
    const prevHasRight = rightKeywords.some(k => prevDesc.includes(k));
    const currHasLeft = leftKeywords.some(k => currDesc.includes(k));
    const currHasRight = rightKeywords.some(k => currDesc.includes(k));

    if ((prevHasLeft && currHasRight) || (prevHasRight && currHasLeft)) {
      return {
        type: '180_degree',
        severity: 'warning',
        message: '可能存在180度规则问题，建议检查镜头轴线',
      };
    }

    return null;
  }

  /**
   * 检查动作匹配
   */
  private static checkActionMatch(
    prevShot: Shot,
    currentShot: Shot
  ): Omit<ShotCoherenceIssue, 'shotIndex'> | null {
    const prevDesc = (prevShot.description || '').toLowerCase();
    const currDesc = (currentShot.description || '').toLowerCase();

    const actionKeywords = [
      '站',
      '起',
      '坐',
      '走',
      '跑',
      '跳',
      '转',
      '伸手',
      '拿',
      '放',
      'stand',
      'sit',
      'walk',
      'run',
      'jump',
      'turn',
      'reach',
      'grab',
      'place',
    ];

    const prevHasAction = actionKeywords.some(k => prevDesc.includes(k));
    const currHasAction = actionKeywords.some(k => currDesc.includes(k));

    if (prevHasAction && !currHasAction) {
      return {
        type: 'action_match',
        severity: 'info',
        message: '前一个分镜有动作，后一个分镜未延续动作',
      };
    }

    return null;
  }

  /**
   * 检查视线匹配
   */
  private static checkEyeLineMatch(
    prevShot: Shot,
    currentShot: Shot
  ): Omit<ShotCoherenceIssue, 'shotIndex'> | null {
    const prevDesc = (prevShot.description || '').toLowerCase();
    const currDesc = (currentShot.description || '').toLowerCase();

    const eyeKeywords = ['看', '视', '望', '注视', 'look', 'watch', 'gaze', 'stare'];
    const prevHasEye = eyeKeywords.some(k => prevDesc.includes(k));
    const currHasEye = eyeKeywords.some(k => currDesc.includes(k));

    if (prevHasEye && !currHasEye) {
      return {
        type: 'eye_line',
        severity: 'info',
        message: '前一个分镜有视线动作，建议后一个分镜给出视线目标',
      };
    }

    return null;
  }

  /**
   * 检查光线匹配
   */
  private static checkLightingMatch(
    prevShot: Shot,
    currentShot: Shot
  ): Omit<ShotCoherenceIssue, 'shotIndex'> | null {
    const prevDesc = (prevShot.description || '').toLowerCase();
    const currDesc = (currentShot.description || '').toLowerCase();

    const darkKeywords = ['暗', '黑', '夜', 'dark', 'night', 'dim'];
    const lightKeywords = ['亮', '明', '日', '昼', 'light', 'bright', 'day'];

    const prevIsDark = darkKeywords.some(k => prevDesc.includes(k));
    const prevIsLight = lightKeywords.some(k => prevDesc.includes(k));
    const currIsDark = darkKeywords.some(k => currDesc.includes(k));
    const currIsLight = lightKeywords.some(k => currDesc.includes(k));

    if ((prevIsDark && currIsLight) || (prevIsLight && currIsDark)) {
      return {
        type: 'lighting',
        severity: 'info',
        message: '光线变化较大，建议添加过渡镜头',
      };
    }

    return null;
  }
}

export default CoherenceChecker;
