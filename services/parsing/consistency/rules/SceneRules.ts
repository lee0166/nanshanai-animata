/**
 * SceneRules - 场景一致性规则
 *
 * 检查剧本中场景信息的一致性，包括：
 * - 场景时间线连续性
 * - 场景地点合理性
 * - 场景转换逻辑
 * - 角色出场一致性
 *
 * @module services/parsing/consistency/rules/SceneRules
 * @version 1.0.0
 */

import {
  ConsistencyRule,
  CheckContext,
  ConsistencyViolation,
  ViolationType
} from '../ConsistencyChecker';
import { ScriptScene, ScriptCharacter } from '../../../../types';

/**
 * 场景一致性规则配置
 */
export interface SceneRulesConfig {
  /** 检查时间线连续性 */
  checkTimeline: boolean;
  /** 检查地点合理性 */
  checkLocation: boolean;
  /** 检查角色出场 */
  checkCharacterAppearance: boolean;
  /** 检查场景转换 */
  checkTransitions: boolean;
  /** 最大场景间隔（分钟） */
  maxTimeGapMinutes: number;
}

const DEFAULT_CONFIG: SceneRulesConfig = {
  checkTimeline: true,
  checkLocation: true,
  checkCharacterAppearance: true,
  checkTransitions: true,
  maxTimeGapMinutes: 1440 // 24小时
};

/**
 * 解析时间字符串
 * @private
 */
function parseTime(timeStr: string): { hour: number; minute: number } | null {
  if (!timeStr) return null;

  // 匹配 "14:30" 或 "下午2点" 等格式
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    return {
      hour: parseInt(timeMatch[1]),
      minute: parseInt(timeMatch[2])
    };
  }

  // 匹配 "早晨"、"上午"、"中午"、"下午"、"晚上"、"深夜"
  const timeKeywords: Record<string, number> = {
    '早晨': 7,
    '早上': 7,
    '上午': 10,
    '中午': 12,
    '下午': 15,
    '傍晚': 18,
    '晚上': 20,
    '深夜': 23,
    '凌晨': 3
  };

  for (const [keyword, hour] of Object.entries(timeKeywords)) {
    if (timeStr.includes(keyword)) {
      return { hour, minute: 0 };
    }
  }

  return null;
}

/**
 * 计算时间差（分钟）
 * @private
 */
function calculateTimeDiff(
  time1: { hour: number; minute: number },
  time2: { hour: number; minute: number }
): number {
  const minutes1 = time1.hour * 60 + time1.minute;
  const minutes2 = time2.hour * 60 + time2.minute;
  return Math.abs(minutes2 - minutes1);
}

/**
 * 检查地点是否合理转换
 * @private
 */
function isLocationTransitionValid(loc1: string, loc2: string): boolean {
  if (!loc1 || !loc2) return true;

  // 相同地点总是合理的
  if (loc1 === loc2) return true;

  // 检查是否是合理的地点转换
  // 例如：从"室内"到"室外"是合理的，但从"北京"直接到"上海"可能需要过渡
  const indoorLocations = ['房间', '室内', '屋子', '办公室', '家', '房子', 'building', 'room'];
  const outdoorLocations = ['室外', '户外', '街道', '公园', '广场', '野外', 'outdoor', 'street'];

  const isLoc1Indoor = indoorLocations.some(l => loc1.toLowerCase().includes(l.toLowerCase()));
  const isLoc2Outdoor = outdoorLocations.some(l => loc2.toLowerCase().includes(l.toLowerCase()));
  const isLoc1Outdoor = outdoorLocations.some(l => loc1.toLowerCase().includes(l.toLowerCase()));
  const isLoc2Indoor = indoorLocations.some(l => loc2.toLowerCase().includes(l.toLowerCase()));

  // 室内到室外或室外到室内通常是合理的
  if ((isLoc1Indoor && isLoc2Outdoor) || (isLoc1Outdoor && isLoc2Indoor)) {
    return true;
  }

  return true; // 默认允许所有转换
}

/**
 * 场景一致性规则类
 */
export class SceneRules implements ConsistencyRule {
  id = 'scene-rules';
  name = '场景一致性规则';
  description = '检查剧本中场景信息的一致性，包括时间线、地点和角色出场';
  priority = 85; // 高优先级
  enabled = true;

  private config: SceneRulesConfig;

  constructor(config: Partial<SceneRulesConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行场景一致性检查
   */
  async check(context: CheckContext): Promise<ConsistencyViolation[]> {
    const violations: ConsistencyViolation[] = [];
    const { scenes, characters } = context;

    console.log(`[SceneRules] Checking ${scenes.length} scenes`);

    // 按场景顺序排序
    const sortedScenes = [...scenes].sort((a, b) => {
      const indexA = scenes.indexOf(a);
      const indexB = scenes.indexOf(b);
      return indexA - indexB;
    });

    // 1. 检查时间线连续性
    if (this.config.checkTimeline) {
      const timelineViolations = this.checkTimelineContinuity(sortedScenes);
      violations.push(...timelineViolations);
    }

    // 2. 检查地点合理性
    if (this.config.checkLocation) {
      const locationViolations = this.checkLocationValidity(sortedScenes);
      violations.push(...locationViolations);
    }

    // 3. 检查角色出场一致性
    if (this.config.checkCharacterAppearance) {
      const characterViolations = this.checkCharacterConsistency(sortedScenes, characters);
      violations.push(...characterViolations);
    }

    // 4. 检查场景转换
    if (this.config.checkTransitions) {
      const transitionViolations = this.checkSceneTransitions(sortedScenes);
      violations.push(...transitionViolations);
    }

    console.log(`[SceneRules] Found ${violations.length} violations`);
    return violations;
  }

  /**
   * 检查时间线连续性
   * @private
   */
  private checkTimelineContinuity(scenes: ScriptScene[]): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];

    for (let i = 1; i < scenes.length; i++) {
      const prevScene = scenes[i - 1];
      const currScene = scenes[i];

      const prevTime = parseTime(prevScene.time || '');
      const currTime = parseTime(currScene.time || '');

      if (prevTime && currTime) {
        const timeDiff = calculateTimeDiff(prevTime, currTime);

        // 如果场景时间倒退，可能是错误
        const prevMinutes = prevTime.hour * 60 + prevTime.minute;
        const currMinutes = currTime.hour * 60 + currTime.minute;

        if (currMinutes < prevMinutes && timeDiff > 60) {
          violations.push({
            id: `scene-time-backward-${currScene.id}`,
            type: 'timeline_conflict' as ViolationType,
            severity: 'warning',
            message: `场景 "${currScene.name}" 的时间 (${currScene.time}) 早于前一个场景 (${prevScene.time})`,
            sceneIds: [prevScene.id, currScene.id],
            suggestion: `请检查场景时间线是否正确，或添加日期变化说明`,
            autoFixable: false,
            confidence: 0.7
          });
        }

        // 如果场景间隔过长
        if (timeDiff > this.config.maxTimeGapMinutes) {
          violations.push({
            id: `scene-time-gap-${currScene.id}`,
            type: 'scene_continuity' as ViolationType,
            severity: 'info',
            message: `场景 "${currScene.name}" 与前一个场景间隔 ${Math.round(timeDiff / 60)} 小时`,
            sceneIds: [prevScene.id, currScene.id],
            suggestion: `长时间间隔可能需要添加过渡场景或说明`,
            autoFixable: false,
            confidence: 0.5
          });
        }
      }
    }

    return violations;
  }

  /**
   * 检查地点合理性
   * @private
   */
  private checkLocationValidity(scenes: ScriptScene[]): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];

    for (let i = 1; i < scenes.length; i++) {
      const prevScene = scenes[i - 1];
      const currScene = scenes[i];

      if (prevScene.location && currScene.location) {
        // 检查地点转换是否合理
        if (!isLocationTransitionValid(prevScene.location, currScene.location)) {
          violations.push({
            id: `scene-location-jump-${currScene.id}`,
            type: 'scene_continuity' as ViolationType,
            severity: 'warning',
            message: `场景 "${currScene.name}" 的地点 (${currScene.location}) 与前一个场景 (${prevScene.location}) 转换突兀`,
            sceneIds: [prevScene.id, currScene.id],
            suggestion: `请添加场景转换说明或过渡场景`,
            autoFixable: false,
            confidence: 0.6
          });
        }
      }
    }

    // 检查是否有场景缺少地点信息
    for (const scene of scenes) {
      if (!scene.location || scene.location.trim().length < 2) {
        violations.push({
          id: `scene-missing-location-${scene.id}`,
          type: 'missing_reference' as ViolationType,
          severity: 'info',
          message: `场景 "${scene.name}" 缺少地点信息`,
          sceneIds: [scene.id],
          suggestion: `建议为场景添加具体的地点描述`,
          autoFixable: false,
          confidence: 0.8
        });
      }
    }

    return violations;
  }

  /**
   * 检查角色出场一致性
   * @private
   */
  private checkCharacterConsistency(
    scenes: ScriptScene[],
    characters: ScriptCharacter[]
  ): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];
    const characterLastScene = new Map<string, { sceneId: string; sceneIndex: number }>();

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      for (const charId of scene.characters || []) {
        const lastAppearance = characterLastScene.get(charId);

        if (lastAppearance) {
          const gap = i - lastAppearance.sceneIndex;

          // 如果角色长时间未出场后突然出现
          if (gap > 5) {
            const character = characters.find(c => c.id === charId);
            if (character) {
              violations.push({
                id: `char-reappear-${charId}-${scene.id}`,
                type: 'scene_continuity' as ViolationType,
                severity: 'info',
                message: `角色 "${character.name}" 在间隔 ${gap} 个场景后再次出现`,
                characterIds: [charId],
                sceneIds: [lastAppearance.sceneId, scene.id],
                suggestion: `长时间未出场的角色再次出现，建议添加说明或回忆`,
                autoFixable: false,
                confidence: 0.5
              });
            }
          }
        }

        characterLastScene.set(charId, { sceneId: scene.id, sceneIndex: i });
      }
    }

    // 检查场景描述中提到的角色是否在场
    for (const scene of scenes) {
      if (scene.description) {
        // 简单的角色名称匹配
        for (const char of characters) {
          if (scene.description.includes(char.name)) {
            const isPresent = scene.characters?.includes(char.id);

            if (!isPresent) {
              violations.push({
                id: `scene-char-mention-${scene.id}-${char.id}`,
                type: 'logic_error' as ViolationType,
                severity: 'info',
                message: `场景 "${scene.name}" 的描述中提到了 "${char.name}"，但该角色不在场`,
                characterIds: [char.id],
                sceneIds: [scene.id],
                suggestion: `请检查角色是否应该在场景中，或修改场景描述`,
                autoFixable: false,
                confidence: 0.6
              });
            }
          }
        }
      }
    }

    return violations;
  }

  /**
   * 检查场景转换
   * @private
   */
  private checkSceneTransitions(scenes: ScriptScene[]): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];

    for (let i = 1; i < scenes.length; i++) {
      const prevScene = scenes[i - 1];
      const currScene = scenes[i];

      // 检查场景转换是否过于频繁
      if (prevScene.location !== currScene.location && prevScene.time === currScene.time) {
        // 同一时间切换地点，可能是快速剪辑
        violations.push({
          id: `scene-quick-cut-${currScene.id}`,
          type: 'scene_continuity' as ViolationType,
          severity: 'info',
          message: `场景 "${currScene.name}" 与前一个场景在同一时间 (${currScene.time}) 切换地点`,
          sceneIds: [prevScene.id, currScene.id],
          suggestion: `快速场景切换可能需要添加过渡说明`,
          autoFixable: false,
          confidence: 0.4
        });
      }

      // 检查场景情绪转换是否过于突兀
      if (prevScene.mood && currScene.mood) {
        const moodTransitions: Record<string, string[]> = {
          '紧张': ['平静', '轻松', '愉快'],
          '悲伤': ['愉快', '兴奋', '轻松'],
          '愤怒': ['平静', '愉快', '轻松'],
          '恐惧': ['平静', '愉快', '轻松']
        };

        const incompatibleMoods = moodTransitions[prevScene.mood];
        if (incompatibleMoods?.includes(currScene.mood)) {
          violations.push({
            id: `scene-mood-jump-${currScene.id}`,
            type: 'scene_continuity' as ViolationType,
            severity: 'info',
            message: `场景 "${currScene.name}" 的情绪 (${currScene.mood}) 与前一个场景 (${prevScene.mood}) 转换突兀`,
            sceneIds: [prevScene.id, currScene.id],
            suggestion: `情绪大幅转变可能需要添加过渡场景或说明`,
            autoFixable: false,
            confidence: 0.5
          });
        }
      }
    }

    return violations;
  }
}

export default SceneRules;
