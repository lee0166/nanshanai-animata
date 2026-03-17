/**
 * 质量评估规则配置类型定义
 *
 * 定义配置文件的TypeScript类型，确保类型安全
 */

/**
 * 阈值配置项
 */
export interface ThresholdConfig {
  value: number;
  description: string;
  rationale: string;
  adjustable: boolean;
  range: [number, number];
  impact?: string;
}

/**
 * 权重配置项
 */
export interface WeightConfig {
  value: number;
  description: string;
  rationale: string;
  adjustable: boolean;
  range: [number, number];
  priority?: '最高' | '高' | '中' | '低';
}

/**
 * 评级阈值配置
 */
export interface GradeThresholdConfig {
  min: number;
  description: string;
  color: string;
}

/**
 * 颜色阈值配置
 */
export interface ColorThresholdConfig {
  min: number;
  description: string;
}

/**
 * 评分配置
 */
export interface ScoringConfig {
  gradeThresholds: Record<string, GradeThresholdConfig>;
  colorThresholds: Record<string, ColorThresholdConfig>;
}

/**
 * 一致性规则配置
 */
export interface ConsistencyRulesConfig {
  narrativeLogicCollapseThreshold: number;
  completenessMaxWhenNarrativeCollapsed: number;
  consistencyMaxWhenNarrativeCollapsed: number;
  usabilityMaxWhenCompletenessLow: number;
}

/**
 * 建议配置
 */
export interface RecommendationsConfig {
  priorityOrder: string[];
  maxRecommendations: number;
}

/**
 * 变更日志项
 */
export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

/**
 * 完整的质量规则配置
 */
export interface QualityRulesConfig {
  version: string;
  description: string;
  lastUpdated: string;
  changelog?: ChangelogEntry[];
  thresholds: Record<string, ThresholdConfig>;
  weights: Record<string, WeightConfig>;
  scoring: ScoringConfig;
  consistencyRules: ConsistencyRulesConfig;
  recommendations: RecommendationsConfig;
}

/**
 * 默认配置
 * 当配置文件不存在或损坏时使用
 */
export const DEFAULT_QUALITY_RULES: QualityRulesConfig = {
  version: '2.0.0',
  description: '质量评估规则配置 - 艺术质量导向（默认配置）',
  lastUpdated: new Date().toISOString().split('T')[0],
  thresholds: {
    characterDescriptionLength: {
      value: 20,
      description: '角色描述最小字数',
      rationale: '基于角色生成所需的最少信息',
      adjustable: true,
      range: [10, 100],
    },
    sceneDescriptionLength: {
      value: 30,
      description: '场景描述最小字数',
      rationale: '场景描述需要包含环境、氛围、时间等要素',
      adjustable: true,
      range: [20, 200],
    },
    minShotsPerScene: {
      value: 3,
      description: '每场景最少分镜数',
      rationale: '确保场景有足够镜头覆盖基本叙事需求',
      adjustable: true,
      range: [1, 10],
    },
    maxShotsPerScene: {
      value: 20,
      description: '每场景最多分镜数',
      rationale: '防止分镜过多导致节奏拖沓',
      adjustable: true,
      range: [10, 50],
    },
    minShotsTotal: {
      value: 6,
      description: '总分镜数最小值',
      rationale: '短剧至少需要6个分镜完成基本叙事',
      adjustable: true,
      range: [3, 20],
    },
    shotDurationMin: {
      value: 1,
      description: '分镜最短时长（秒）',
      rationale: '低于1秒的画面无法被观众感知',
      adjustable: true,
      range: [1, 5],
    },
    shotDurationMax: {
      value: 60,
      description: '分镜最长时长（秒）',
      rationale: '超过60秒的镜头会显得拖沓',
      adjustable: true,
      range: [30, 120],
    },
    narrativeLogicCollapseThreshold: {
      value: 40,
      description: '叙事逻辑崩溃阈值',
      rationale: '低于此分数视为叙事结构严重问题',
      adjustable: true,
      range: [20, 50],
    },
    completenessMaxWhenNarrativeCollapsed: {
      value: 70,
      description: '叙事崩溃时完整性最高分',
      rationale: '叙事结构崩溃时，完整性不应过高',
      adjustable: true,
      range: [50, 80],
    },
  },
  weights: {
    narrativeLogic: {
      value: 0.25,
      description: '叙事逻辑权重',
      rationale: '叙事逻辑是剧本质量的核心',
      adjustable: true,
      range: [0.15, 0.35],
      priority: '最高',
    },
    dramatic: {
      value: 0.2,
      description: '戏剧性权重',
      rationale: '戏剧性决定故事的吸引力',
      adjustable: true,
      range: [0.1, 0.3],
      priority: '高',
    },
    completeness: {
      value: 0.15,
      description: '完整性权重',
      rationale: '完整性确保剧本信息齐全',
      adjustable: true,
      range: [0.1, 0.3],
      priority: '中',
    },
    accuracy: {
      value: 0.15,
      description: '准确性权重',
      rationale: '准确性确保数据格式正确',
      adjustable: true,
      range: [0.1, 0.25],
      priority: '中',
    },
    consistency: {
      value: 0.15,
      description: '一致性权重',
      rationale: '一致性确保剧本内部逻辑自洽',
      adjustable: true,
      range: [0.1, 0.25],
      priority: '中',
    },
    usability: {
      value: 0.05,
      description: '可用性权重',
      rationale: '可用性评估生成友好度',
      adjustable: true,
      range: [0.05, 0.2],
      priority: '低',
    },
    spatialTemporal: {
      value: 0.05,
      description: '时空逻辑权重',
      rationale: '时空逻辑确保视听语言正确',
      adjustable: true,
      range: [0.05, 0.2],
      priority: '低',
    },
  },
  scoring: {
    gradeThresholds: {
      A: { min: 90, description: '优秀', color: 'success' },
      B: { min: 80, description: '良好', color: 'primary' },
      C: { min: 70, description: '及格', color: 'warning' },
      D: { min: 60, description: '待改进', color: 'warning' },
      F: { min: 0, description: '不合格', color: 'danger' },
    },
    colorThresholds: {
      success: { min: 90, description: '绿色 - 优秀' },
      primary: { min: 75, description: '蓝色 - 良好' },
      warning: { min: 60, description: '黄色 - 及格' },
      danger: { min: 0, description: '红色 - 不及格' },
    },
  },
  consistencyRules: {
    narrativeLogicCollapseThreshold: 40,
    completenessMaxWhenNarrativeCollapsed: 70,
    consistencyMaxWhenNarrativeCollapsed: 60,
    usabilityMaxWhenCompletenessLow: 70,
  },
  recommendations: {
    priorityOrder: [
      'narrativeLogic',
      'dramatic',
      'consistency',
      'completeness',
      'accuracy',
      'spatialTemporal',
      'usability',
    ],
    maxRecommendations: 5,
  },
};
