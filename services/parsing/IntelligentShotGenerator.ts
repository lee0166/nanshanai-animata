/**
 * IntelligentShotGenerator - 智能分镜生成器
 *
 * 职责：基于场景复杂度分析，智能计算分镜生成策略
 *
 * 核心功能：
 * 1. 分析场景复杂度（0-10 分）
 * 2. 动态计算最优分镜数量（8-30 个）
 * 3. 按需分配 token（3000-9000）
 * 4. 动态计算批次大小（1-3）
 *
 * 复杂度评分维度：
 * - 场景长度（权重 30%）
 * - 角色数量（权重 25%）
 * - 动作元素（权重 25%）
 * - 环境复杂度（权重 20%）
 *
 * 使用场景：
 * - 分镜生成前的策略计算
 * - Token 预算分配
 * - 批次大小优化
 *
 * @module services/parsing/IntelligentShotGenerator
 * @version 1.0.0
 */

import { ScriptScene, ScriptCharacter, Shot } from '../../types';

/**
 * 复杂度因子
 */
interface ComplexityFactor {
  /** 因子名称 */
  name: string;
  /** 权重（0-1） */
  weight: number;
  /** 评分（0-10） */
  score: number;
}

/**
 * 场景复杂度评分结果
 */
export interface SceneComplexity {
  /** 综合评分（0-10） */
  score: number;
  /** 复杂度因子详情 */
  factors: ComplexityFactor[];
  /** 复杂度等级 */
  level: ComplexityLevel;
}

/**
 * 复杂度等级
 */
export type ComplexityLevel = 'very-low' | 'low' | 'medium' | 'high' | 'very-high';

/**
 * 智能分镜生成配置
 */
export interface IntelligentShotConfig {
  /** 最优分镜数量 */
  optimalShots: number;
  /** 所需 token 数量 */
  requiredTokens: number;
  /** 批次大小 */
  batchSize: number;
  /** 每批次分镜数 */
  shotsPerBatch: number;
}

/**
 * 智能分镜生成器
 */
export class IntelligentShotGenerator {
  /**
   * 分析场景复杂度（0-10 分）
   *
   * @param scene - 场景信息
   * @param characters - 场景角色列表
   * @returns 场景复杂度评分
   */
  analyzeComplexity(scene: ScriptScene, characters: ScriptCharacter[]): SceneComplexity {
    const factors: ComplexityFactor[] = [
      {
        name: '场景长度',
        weight: 0.3,
        score: this.scoreByLength(scene.description?.length || 0),
      },
      {
        name: '角色数量',
        weight: 0.25,
        score: this.scoreByCharacters(characters.length),
      },
      {
        name: '动作元素',
        weight: 0.25,
        score: this.scoreByAction(scene.description || ''),
      },
      {
        name: '环境复杂度',
        weight: 0.2,
        score: this.scoreByEnvironment(scene.description || ''),
      },
    ];

    // 计算加权总分
    const totalScore = factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0);

    // 限制范围 0-10，并四舍五入
    const roundedScore = Math.round(Math.min(10, Math.max(0, totalScore)));

    // 确定复杂度等级
    const level = this.getComplexityLevel(roundedScore);

    console.log(`[IntelligentShotGenerator] Scene complexity analysis:`);
    console.log(`  - Scene: ${scene.name}`);
    console.log(`  - Overall score: ${roundedScore}/10 (${level})`);
    factors.forEach(factor => {
      console.log(`  - ${factor.name}: ${factor.score}/10 (weight: ${factor.weight})`);
    });

    return {
      score: roundedScore,
      factors,
      level,
    };
  }

  /**
   * 计算最优分镜数量（基于情节分析）
   *
   * @param complexity - 场景复杂度评分
   * @param scene - 场景信息（用于情节分析）
   * @returns 最优分镜数量（6-30 个）
   */
  calculateOptimalShots(complexity: SceneComplexity, scene?: ScriptScene): number {
    // 基础分镜数：6 个（保证基本叙事）
    const baseShots = 6;

    // 情节要素分析
    let majorPlotPoints = 0;
    let minorPlotPoints = 0;
    let emotionalTurningPoints = 0;
    let isClimaxScene = false;
    let isEmotionalScene = false;

    if (scene?.description) {
      const desc = scene.description.toLowerCase();

      // 检测重要情节点
      const majorKeywords = [
        '突然',
        '发现',
        '揭露',
        '转折',
        '爆发',
        '决战',
        '高潮',
        '真相',
        '牺牲',
        '告白',
      ];
      majorPlotPoints = majorKeywords.filter(k => desc.includes(k)).length;

      // 检测次要情节点
      const minorKeywords = ['然后', '接着', '于是', '随后', '同时', '不久', '之后', '继续'];
      minorPlotPoints = minorKeywords.filter(k => desc.includes(k)).length;

      // 检测情绪转折点
      const emotionalKeywords = [
        '愤怒',
        '悲伤',
        '喜悦',
        '震惊',
        '绝望',
        '感动',
        '紧张',
        '激动',
        '痛苦',
        '释怀',
      ];
      emotionalTurningPoints = emotionalKeywords.filter(k => desc.includes(k)).length;

      // 检测高潮场景
      const climaxKeywords = ['高潮', '决战', '最终', '最后', '爆发', '真相大白', '生死'];
      isClimaxScene = climaxKeywords.some(k => desc.includes(k));

      // 检测情感场景
      isEmotionalScene = emotionalTurningPoints > 0;
    }

    // 基于情节计算分镜数
    const plotBasedShots =
      majorPlotPoints * 2.5 + // 重要情节点 × 2.5个分镜
      minorPlotPoints * 1.0 + // 次要情节点 × 1个分镜
      emotionalTurningPoints * 1.5; // 情绪转折点 × 1.5个分镜

    let calculatedShots = baseShots + plotBasedShots;

    // 情绪曲线驱动
    if (isClimaxScene) {
      calculatedShots *= 1.5; // 高潮场景 +50%
    }
    if (isEmotionalScene) {
      calculatedShots *= 1.2; // 情感场景 +20%
    }

    // 结合复杂度加成
    calculatedShots += complexity.score * 0.8;

    // 限制范围：6-30 个
    const optimal = Math.floor(Math.max(6, Math.min(30, calculatedShots)));

    console.log(`[IntelligentShotGenerator] Optimal shots calculation (Plot-based):`);
    console.log(`  - Base shots: ${baseShots}`);
    console.log(`  - Major plot points: ${majorPlotPoints} (×2.5 = ${majorPlotPoints * 2.5})`);
    console.log(`  - Minor plot points: ${minorPlotPoints} (×1.0 = ${minorPlotPoints * 1.0})`);
    console.log(
      `  - Emotional turning points: ${emotionalTurningPoints} (×1.5 = ${emotionalTurningPoints * 1.5})`
    );
    console.log(`  - Is climax scene: ${isClimaxScene}`);
    console.log(`  - Is emotional scene: ${isEmotionalScene}`);
    console.log(`  - Complexity bonus: ${complexity.score * 0.8}`);
    console.log(`  - Calculated: ${calculatedShots.toFixed(1)}`);
    console.log(`  - Optimal (clamped): ${optimal}`);

    return optimal;
  }

  /**
   * 计算所需 token 数量
   *
   * @param shots - 分镜数量
   * @returns 所需 token 数量（3000-9000）
   */
  calculateRequiredTokens(shots: number): number {
    // 基础开销（prompt + 上下文）
    const baseTokens = 2000;

    // 每个分镜平均需要 180 tokens
    const tokensPerShot = 180;

    // 安全余量 20%
    const safetyMargin = 1.2;

    // 计算总 token
    const totalTokens = Math.ceil((baseTokens + shots * tokensPerShot) * safetyMargin);

    // 限制范围：3000-9000
    const clampedTokens = Math.max(3000, Math.min(9000, totalTokens));

    console.log(`[IntelligentShotGenerator] Token calculation:`);
    console.log(`  - Base tokens: ${baseTokens}`);
    console.log(`  - Tokens per shot: ${tokensPerShot}`);
    console.log(`  - Shots: ${shots}`);
    console.log(`  - Raw total: ${Math.ceil((baseTokens + shots * tokensPerShot) * safetyMargin)}`);
    console.log(`  - Clamped: ${clampedTokens}`);

    return clampedTokens;
  }

  /**
   * 计算批次大小
   *
   * @param shots - 分镜数量
   * @returns 批次大小（1-3）
   */
  calculateBatchSize(shots: number): number {
    // 每批次最多处理 25 个分镜
    const maxShotsPerBatch = 25;

    // 计算批次数量
    const batches = Math.ceil(shots / maxShotsPerBatch);

    // 限制批次大小：1-3
    const clampedBatches = Math.max(1, Math.min(3, batches));

    // 计算每批次分镜数
    const shotsPerBatch = Math.ceil(shots / clampedBatches);

    console.log(`[IntelligentShotGenerator] Batch calculation:`);
    console.log(`  - Total shots: ${shots}`);
    console.log(`  - Max shots per batch: ${maxShotsPerBatch}`);
    console.log(`  - Raw batches: ${batches}`);
    console.log(`  - Clamped batches: ${clampedBatches}`);
    console.log(`  - Shots per batch: ${shotsPerBatch}`);

    return clampedBatches;
  }

  /**
   * 获取智能分镜生成配置
   *
   * @param scene - 场景信息
   * @param characters - 场景角色列表
   * @returns 智能分镜生成配置
   */
  getShotConfig(scene: ScriptScene, characters: ScriptCharacter[]): IntelligentShotConfig {
    // 1. 分析场景复杂度
    const complexity = this.analyzeComplexity(scene, characters);

    // 2. 计算最优分镜数量（基于情节分析）
    const optimalShots = this.calculateOptimalShots(complexity, scene);

    // 3. 计算所需 token
    const requiredTokens = this.calculateRequiredTokens(optimalShots);

    // 4. 计算批次大小
    const batchSize = this.calculateBatchSize(optimalShots);

    // 5. 计算每批次分镜数
    const shotsPerBatch = Math.ceil(optimalShots / batchSize);

    console.log(`[IntelligentShotGenerator] ========== Final Config ==========`);
    console.log(`  - Complexity: ${complexity.score}/10 (${complexity.level})`);
    console.log(`  - Optimal shots: ${optimalShots}`);
    console.log(`  - Required tokens: ${requiredTokens}`);
    console.log(`  - Batch size: ${batchSize}`);
    console.log(`  - Shots per batch: ${shotsPerBatch}`);
    console.log(`============================================================`);

    return {
      optimalShots,
      requiredTokens,
      batchSize,
      shotsPerBatch,
    };
  }

  /**
   * 根据场景长度评分（0-10）
   */
  private scoreByLength(length: number): number {
    if (length > 500) return 10; // 超长场景
    if (length > 300) return 8; // 长场景
    if (length > 200) return 6; // 中等场景
    if (length > 100) return 4; // 短场景
    return 2; // 超短场景
  }

  /**
   * 根据角色数量评分（0-10）
   */
  private scoreByCharacters(count: number): number {
    if (count > 5) return 10; // 大量角色
    if (count > 3) return 7; // 多个角色
    if (count > 1) return 4; // 2-3 个角色
    return 2; // 单个角色
  }

  /**
   * 根据动作元素评分（0-10）
   */
  private scoreByAction(description: string): number {
    const actionKeywords = [
      '打',
      '跑',
      '追',
      '飞',
      '战斗',
      '爆炸',
      '决战',
      '冲',
      '跳',
      '闪',
      '攻击',
      '防御',
      '对决',
      '碰撞',
    ];

    const hasAction = actionKeywords.some(keyword =>
      description.toLowerCase().includes(keyword.toLowerCase())
    );

    // 统计动作关键词出现次数
    const actionCount = actionKeywords.filter(keyword =>
      description.toLowerCase().includes(keyword.toLowerCase())
    ).length;

    if (actionCount > 5) return 10; // 大量动作
    if (actionCount > 2) return 8; // 多个动作
    if (hasAction) return 6; // 有动作元素
    return 2; // 静态场景
  }

  /**
   * 根据环境复杂度评分（0-10）
   */
  private scoreByEnvironment(description: string): number {
    const complexEnvKeywords = [
      '广场',
      '战场',
      '集市',
      '宫殿',
      '森林',
      '山脉',
      '海洋',
      '城市',
      '废墟',
      '城堡',
      '大厅',
      '街道',
      '人群',
      '热闹',
      '复杂',
      '宏大',
    ];

    const simpleEnvKeywords = ['房间', '室内', '卧室', '书房', '密室', '小'];

    // 统计复杂环境关键词
    const complexCount = complexEnvKeywords.filter(keyword =>
      description.toLowerCase().includes(keyword.toLowerCase())
    ).length;

    // 统计简单环境关键词
    const simpleCount = simpleEnvKeywords.filter(keyword =>
      description.toLowerCase().includes(keyword.toLowerCase())
    ).length;

    if (complexCount > 5) return 10; // 超复杂环境
    if (complexCount > 2) return 8; // 复杂环境
    if (complexCount > 0) return 6; // 有一定复杂度
    if (simpleCount > 0) return 3; // 简单环境
    return 4; // 默认中等复杂度
  }

  /**
   * 获取复杂度等级
   */
  private getComplexityLevel(score: number): ComplexityLevel {
    if (score >= 9) return 'very-high';
    if (score >= 7) return 'high';
    if (score >= 5) return 'medium';
    if (score >= 3) return 'low';
    return 'very-low';
  }
}

/**
 * 创建智能分镜生成器实例
 *
 * @returns 智能分镜生成器实例
 */
export function createIntelligentShotGenerator(): IntelligentShotGenerator {
  return new IntelligentShotGenerator();
}
