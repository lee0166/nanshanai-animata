/**
 * Duration Strategy Module
 *
 * 提供场景类型识别和时长策略计算功能。
 * 根据场景内容、位置等因素自动识别场景类型并推荐合适的时长范围。
 *
 * @module services/parsing/DurationStrategy
 * @author AI Assistant
 * @version 1.0.0
 */

import { ScriptScene } from '../../types';

/**
 * 场景类型枚举
 */
export type SceneType =
  | 'opening'      // 开场
  | 'dialogue'     // 对话
  | 'action'       // 动作
  | 'emotion'      // 情感
  | 'climax'       // 高潮
  | 'ending';      // 结尾

/**
 * 时长影响因素
 */
export interface DurationFactors {
  /** 对话密度 (0-1) */
  dialogueDensity: number;
  /** 动作强度 (0-1) */
  actionIntensity: number;
  /** 情感峰值 (0-1) */
  emotionPeak: number;
  /** 视觉复杂度 (0-1) */
  visualComplexity: number;
}

/**
 * 时长策略接口
 */
export interface DurationStrategy {
  /** 场景类型 */
  sceneType: SceneType;
  /** 基础时长（秒） */
  baseDuration: number;
  /** 最小时长（秒） */
  minDuration: number;
  /** 最大时长（秒） */
  maxDuration: number;
  /** 影响因素权重配置 */
  factors: DurationFactors;
}

/**
 * 场景类型识别结果
 */
export interface SceneTypeDetectionResult {
  sceneType: SceneType;
  confidence: number;  // 置信度 (0-1)
  reasons: string[];   // 识别原因
}

/**
 * 计算后的时长结果
 */
export interface CalculatedDuration {
  recommended: number;  // 推荐时长
  min: number;          // 最小时长
  max: number;          // 最大时长
  sceneType: SceneType; // 场景类型
  factors: DurationFactors; // 实际影响因素值
}

/**
 * 场景类型关键词映射
 */
const SCENE_TYPE_KEYWORDS: Record<Exclude<SceneType, 'opening' | 'ending' | 'climax'>, string[]> = {
  dialogue: [
    '对话', '交谈', '讨论', '谈判', '争吵', '表白', '倾诉',
    'dialogue', 'conversation', 'talk', 'discuss', 'negotiate', 'argue', 'confess'
  ],
  action: [
    '追逐', '打斗', '逃跑', '跳跃', '爆炸', '撞击', '战斗', '奔跑',
    'chase', 'fight', 'escape', 'jump', 'explosion', 'crash', 'battle', 'run', 'attack'
  ],
  emotion: [
    '哭泣', '拥抱', '亲吻', '悲伤', '喜悦', '愤怒', '恐惧', '震惊',
    'cry', 'hug', 'kiss', 'sad', 'joy', 'angry', 'fear', 'shock', 'emotional', 'tears'
  ]
};

/**
 * 情感强度关键词
 */
const EMOTION_INTENSITY_KEYWORDS = [
  '极度', '非常', '强烈', '深深', 'extremely', 'very', 'intensely', 'deeply',
  '崩溃', '爆发', '绝望', '狂喜', 'collapse', 'burst', 'despair', 'ecstasy'
];

/**
 * 动作强度关键词
 */
const ACTION_INTENSITY_KEYWORDS = [
  '激烈', '猛烈', '快速', '惊险', '紧张',
  'intense', 'fierce', 'fast', 'thrilling', 'tense', 'rapid', 'violent'
];

/**
 * 时长策略库
 */
export const STRATEGIES: Record<SceneType, DurationStrategy> = {
  opening: {
    sceneType: 'opening',
    baseDuration: 6,
    minDuration: 4,
    maxDuration: 10,
    factors: {
      dialogueDensity: 0.3,
      actionIntensity: 0.2,
      emotionPeak: 0.2,
      visualComplexity: 0.3
    }
  },
  climax: {
    sceneType: 'climax',
    baseDuration: 8,
    minDuration: 5,
    maxDuration: 12,
    factors: {
      dialogueDensity: 0.2,
      actionIntensity: 0.4,
      emotionPeak: 0.3,
      visualComplexity: 0.1
    }
  },
  ending: {
    sceneType: 'ending',
    baseDuration: 6,
    minDuration: 4,
    maxDuration: 10,
    factors: {
      dialogueDensity: 0.2,
      actionIntensity: 0.1,
      emotionPeak: 0.4,
      visualComplexity: 0.3
    }
  },
  dialogue: {
    sceneType: 'dialogue',
    baseDuration: 4,
    minDuration: 3,
    maxDuration: 6,
    factors: {
      dialogueDensity: 0.6,
      actionIntensity: 0.1,
      emotionPeak: 0.2,
      visualComplexity: 0.1
    }
  },
  action: {
    sceneType: 'action',
    baseDuration: 3,
    minDuration: 2,
    maxDuration: 4,
    factors: {
      dialogueDensity: 0.1,
      actionIntensity: 0.6,
      emotionPeak: 0.1,
      visualComplexity: 0.2
    }
  },
  emotion: {
    sceneType: 'emotion',
    baseDuration: 5,
    minDuration: 4,
    maxDuration: 8,
    factors: {
      dialogueDensity: 0.2,
      actionIntensity: 0.1,
      emotionPeak: 0.5,
      visualComplexity: 0.2
    }
  }
};

/**
 * 检测场景类型
 *
 * 根据场景位置和内容关键词识别场景类型：
 * - 根据场景位置识别 opening/ending/climax
 * - 根据内容关键词识别 action/emotion/dialogue
 * - climax 位置在 60%-80% 范围
 *
 * @param scene - 场景对象
 * @param position - 场景在剧本中的位置（从0开始）
 * @param totalScenes - 场景总数
 * @returns 场景类型识别结果
 */
export function detectSceneType(
  scene: ScriptScene,
  position: number,
  totalScenes: number
): SceneTypeDetectionResult {
  const reasons: string[] = [];

  // 1. 基于位置识别 opening/ending
  if (position === 0) {
    return {
      sceneType: 'opening',
      confidence: 0.95,
      reasons: ['场景位于剧本开头（位置0）']
    };
  }

  if (position === totalScenes - 1) {
    return {
      sceneType: 'ending',
      confidence: 0.95,
      reasons: ['场景位于剧本结尾']
    };
  }

  // 2. 基于位置识别 climax（60%-80%范围）
  const positionRatio = position / (totalScenes - 1);
  const isClimaxPosition = positionRatio >= 0.6 && positionRatio <= 0.8;

  // 3. 基于内容关键词识别
  const content = `${scene.name} ${scene.description} ${scene.sceneFunction}`.toLowerCase();

  // 检测动作场景
  const actionScore = calculateKeywordScore(content, SCENE_TYPE_KEYWORDS.action);
  const actionIntensityScore = calculateKeywordScore(content, ACTION_INTENSITY_KEYWORDS);

  // 检测情感场景
  const emotionScore = calculateKeywordScore(content, SCENE_TYPE_KEYWORDS.emotion);
  const emotionIntensityScore = calculateKeywordScore(content, EMOTION_INTENSITY_KEYWORDS);

  // 检测对话场景
  const dialogueScore = calculateKeywordScore(content, SCENE_TYPE_KEYWORDS.dialogue);

  // 4. 综合判断
  const scores: Array<{ type: SceneType; score: number; reasons: string[] }> = [
    {
      type: 'action',
      score: actionScore + actionIntensityScore * 0.5,
      reasons: actionScore > 0 ? ['包含动作关键词'] : []
    },
    {
      type: 'emotion',
      score: emotionScore + emotionIntensityScore * 0.5,
      reasons: emotionScore > 0 ? ['包含情感关键词'] : []
    },
    {
      type: 'dialogue',
      score: dialogueScore,
      reasons: dialogueScore > 0 ? ['包含对话关键词'] : []
    }
  ];

  // 如果是高潮位置，增加climax的可能性
  if (isClimaxPosition) {
    scores.push({
      type: 'climax',
      score: 0.5 + Math.max(actionScore, emotionScore) * 0.5,
      reasons: [`场景位于高潮位置（${Math.round(positionRatio * 100)}%）`]
    });
  }

  // 找出最高分的类型
  scores.sort((a, b) => b.score - a.score);
  const bestMatch = scores[0];

  // 如果没有明显特征，默认为 dialogue
  if (bestMatch.score === 0) {
    return {
      sceneType: 'dialogue',
      confidence: 0.5,
      reasons: ['无明显特征，默认对话场景']
    };
  }

  // 如果高潮位置且动作/情感强度足够高，优先判定为 climax
  if (isClimaxPosition && (actionScore > 0.3 || emotionScore > 0.3)) {
    const climaxReasons = [`场景位于高潮位置（${Math.round(positionRatio * 100)}%）`];
    if (actionScore > 0.3) climaxReasons.push('包含高强度动作');
    if (emotionScore > 0.3) climaxReasons.push('包含强烈情感');

    return {
      sceneType: 'climax',
      confidence: 0.85,
      reasons: climaxReasons
    };
  }

  return {
    sceneType: bestMatch.type,
    confidence: Math.min(0.9, 0.5 + bestMatch.score * 0.5),
    reasons: bestMatch.reasons
  };
}

/**
 * 计算关键词得分
 *
 * @param content - 内容文本
 * @param keywords - 关键词列表
 * @returns 得分 (0-1)
 */
function calculateKeywordScore(content: string, keywords: string[]): number {
  let matchCount = 0;
  for (const keyword of keywords) {
    const regex = new RegExp(keyword.toLowerCase(), 'g');
    const matches = content.match(regex);
    if (matches) {
      matchCount += matches.length;
    }
  }
  // 归一化得分，最多计5个匹配
  return Math.min(1, matchCount / 5);
}

/**
 * 分析场景内容计算实际影响因素值
 *
 * @param scene - 场景对象
 * @returns 影响因素值
 */
export function analyzeSceneFactors(scene: ScriptScene): DurationFactors {
  const content = `${scene.name} ${scene.description} ${scene.sceneFunction}`.toLowerCase();

  // 对话密度：基于对话关键词和场景功能
  const dialogueKeywords = SCENE_TYPE_KEYWORDS.dialogue;
  const dialogueDensity = Math.min(1, calculateKeywordScore(content, dialogueKeywords) * 1.5);

  // 动作强度：基于动作关键词和强度词
  const actionKeywords = SCENE_TYPE_KEYWORDS.action;
  const actionIntensity = Math.min(1,
    calculateKeywordScore(content, actionKeywords) * 1.2 +
    calculateKeywordScore(content, ACTION_INTENSITY_KEYWORDS) * 0.8
  );

  // 情感峰值：基于情感关键词和强度词
  const emotionKeywords = SCENE_TYPE_KEYWORDS.emotion;
  const emotionPeak = Math.min(1,
    calculateKeywordScore(content, emotionKeywords) * 1.2 +
    calculateKeywordScore(content, EMOTION_INTENSITY_KEYWORDS) * 0.8
  );

  // 视觉复杂度：基于环境描述和场景功能
  let visualComplexity = 0.3; // 基础值
  if (scene.environment) {
    const envComplexity = [
      scene.environment.architecture,
      ...(scene.environment.furnishings || []),
      scene.environment.lighting,
      scene.environment.colorTone
    ].filter(Boolean).length;
    visualComplexity = Math.min(1, 0.3 + envComplexity * 0.15);
  }

  return {
    dialogueDensity,
    actionIntensity,
    emotionPeak,
    visualComplexity
  };
}

/**
 * 计算场景推荐时长
 *
 * @param scene - 场景对象
 * @param position - 场景位置
 * @param totalScenes - 场景总数
 * @returns 计算后的时长结果
 */
export function calculateSceneDuration(
  scene: ScriptScene,
  position: number,
  totalScenes: number
): CalculatedDuration {
  // 1. 检测场景类型
  const detectionResult = detectSceneType(scene, position, totalScenes);
  const strategy = STRATEGIES[detectionResult.sceneType];

  // 2. 分析实际影响因素
  const actualFactors = analyzeSceneFactors(scene);

  // 3. 计算调整后的时长
  let adjustment = 0;
  adjustment += (actualFactors.dialogueDensity - strategy.factors.dialogueDensity) * 2;
  adjustment += (actualFactors.actionIntensity - strategy.factors.actionIntensity) * 3;
  adjustment += (actualFactors.emotionPeak - strategy.factors.emotionPeak) * 2.5;
  adjustment += (actualFactors.visualComplexity - strategy.factors.visualComplexity) * 1.5;

  // 限制调整范围
  adjustment = Math.max(-2, Math.min(2, adjustment));

  // 4. 计算最终推荐时长
  const recommended = Math.round(
    Math.max(
      strategy.minDuration,
      Math.min(strategy.maxDuration, strategy.baseDuration + adjustment)
    ) * 10
  ) / 10;

  return {
    recommended,
    min: strategy.minDuration,
    max: strategy.maxDuration,
    sceneType: detectionResult.sceneType,
    factors: actualFactors
  };
}

/**
 * 批量计算多个场景的时长
 *
 * @param scenes - 场景列表
 * @returns 时长计算结果列表
 */
export function calculateDurationsForScenes(
  scenes: ScriptScene[]
): Array<CalculatedDuration & { sceneIndex: number; sceneName: string }> {
  return scenes.map((scene, index) => ({
    sceneIndex: index,
    sceneName: scene.name,
    ...calculateSceneDuration(scene, index, scenes.length)
  }));
}

/**
 * 获取场景类型的显示名称
 *
 * @param sceneType - 场景类型
 * @param language - 语言 ('zh' | 'en')
 * @returns 显示名称
 */
export function getSceneTypeDisplayName(
  sceneType: SceneType,
  language: 'zh' | 'en' = 'zh'
): string {
  const names: Record<SceneType, { zh: string; en: string }> = {
    opening: { zh: '开场', en: 'Opening' },
    dialogue: { zh: '对话', en: 'Dialogue' },
    action: { zh: '动作', en: 'Action' },
    emotion: { zh: '情感', en: 'Emotion' },
    climax: { zh: '高潮', en: 'Climax' },
    ending: { zh: '结尾', en: 'Ending' }
  };

  return names[sceneType][language];
}

/**
 * 验证时长是否在有效范围内
 *
 * @param duration - 时长（秒）
 * @param sceneType - 场景类型
 * @returns 是否有效
 */
export function isValidDuration(duration: number, sceneType: SceneType): boolean {
  const strategy = STRATEGIES[sceneType];
  return duration >= strategy.minDuration && duration <= strategy.maxDuration;
}

/**
 * 调整时长到有效范围
 *
 * @param duration - 原始时长
 * @param sceneType - 场景类型
 * @returns 调整后的时长
 */
export function clampDuration(duration: number, sceneType: SceneType): number {
  const strategy = STRATEGIES[sceneType];
  return Math.max(strategy.minDuration, Math.min(strategy.maxDuration, duration));
}
