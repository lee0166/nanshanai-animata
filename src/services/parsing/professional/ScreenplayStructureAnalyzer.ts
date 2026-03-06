/**
 * ScreenplayStructureAnalyzer - 剧本结构分析服务
 * 
 * 基于现有 StoryStructure 和 emotionalArc 进行结构可视化分析
 * 零LLM调用，纯数据转换和计算
 * 输入: storyStructure, emotionalArc, wordCount
 * 输出: StructureAnalysis
 */

import type {
  StoryStructure,
  EmotionalPoint,
} from '../../../../types';

// ==========================================
// 类型定义
// ==========================================

/**
 * 幕长度信息
 */
export interface ActLength {
  /** 占比百分比 */
  percentage: number;
  /** 字数 */
  wordCount: number;
  /** 预估时长（分钟） */
  estimatedMinutes: number;
}

/**
 * 幕长度统计
 */
export interface ActLengths {
  act1: ActLength;
  act2a: ActLength;
  act2b: ActLength;
  act3: ActLength;
}

/**
 * 节奏分析
 */
export interface PacingAnalysis {
  /** 紧张度曲线（每个情节点的强度） */
  tensionCurve: number[];
  /** 转折点标签 */
  turningPoints: string[];
  /** 节奏描述 */
  pacingDescription: string;
  /** 高潮位置 */
  climaxPosition: number;
}

/**
 * 结构分析结果
 */
export interface StructureAnalysis {
  /** 原始故事结构 */
  structure: StoryStructure;
  /** 幕长度统计 */
  actLengths: ActLengths;
  /** 节奏分析 */
  pacingAnalysis: PacingAnalysis;
  /** 结构评分 */
  structureScore: StructureScore;
}

/**
 * 结构评分
 */
export interface StructureScore {
  /** 总分（0-100） */
  overall: number;
  /** 结构完整性 */
  completeness: number;
  /** 节奏平衡性 */
  balance: number;
  /** 情绪曲线 */
  emotionalArc: number;
}

// ==========================================
// 结构类型配置
// ==========================================

/**
 * 标准三幕式占比
 */
const THREE_ACT_RATIOS = {
  act1: 0.25,
  act2a: 0.25,
  act2b: 0.25,
  act3: 0.25,
};

/**
 * 五幕式占比
 */
const FIVE_ACT_RATIOS = {
  act1: 0.15,
  act2a: 0.20,
  act2b: 0.30,
  act2c: 0.20,
  act3: 0.15,
};

/**
 * 英雄之旅占比
 */
const HERO_JOURNEY_RATIOS = {
  act1: 0.20,
  act2a: 0.30,
  act2b: 0.30,
  act3: 0.20,
};

// ==========================================
// 核心类
// ==========================================

export class ScreenplayStructureAnalyzer {
  /**
   * 分析剧本结构
   * @param structure 故事结构
   * @param emotionalArc 情绪曲线
   * @param totalWordCount 总字数
   * @returns 结构分析结果
   */
  analyze(
    structure: StoryStructure,
    emotionalArc: EmotionalPoint[] = [],
    totalWordCount: number = 0
  ): StructureAnalysis {
    console.log('[ScreenplayStructureAnalyzer] Starting structure analysis...');

    // 1. 计算幕长度
    const actLengths = this.calculateActLengths(
      structure,
      totalWordCount
    );

    // 2. 分析节奏
    const pacingAnalysis = this.analyzePacing(emotionalArc);

    // 3. 计算结构评分
    const structureScore = this.calculateStructureScore(
      structure,
      emotionalArc,
      actLengths
    );

    console.log('[ScreenplayStructureAnalyzer] Analysis complete:', {
      structureType: structure.structureType,
      emotionalPoints: emotionalArc.length,
      overallScore: structureScore.overall,
    });

    return {
      structure,
      actLengths,
      pacingAnalysis,
      structureScore,
    };
  }

  /**
   * 计算幕长度
   */
  private calculateActLengths(
    structure: StoryStructure,
    totalWordCount: number
  ): ActLengths {
    // 获取结构类型对应的占比
    const ratios = this.getStructureRatios(structure.structureType);

    // 计算每个幕的字数和时长
    // 假设平均阅读速度：200字/分钟
    const wordsPerMinute = 200;

    return {
      act1: {
        percentage: ratios.act1 * 100,
        wordCount: Math.round(totalWordCount * ratios.act1),
        estimatedMinutes: Math.round((totalWordCount * ratios.act1) / wordsPerMinute),
      },
      act2a: {
        percentage: ratios.act2a * 100,
        wordCount: Math.round(totalWordCount * ratios.act2a),
        estimatedMinutes: Math.round((totalWordCount * ratios.act2a) / wordsPerMinute),
      },
      act2b: {
        percentage: ratios.act2b * 100,
        wordCount: Math.round(totalWordCount * ratios.act2b),
        estimatedMinutes: Math.round((totalWordCount * ratios.act2b) / wordsPerMinute),
      },
      act3: {
        percentage: ratios.act3 * 100,
        wordCount: Math.round(totalWordCount * ratios.act3),
        estimatedMinutes: Math.round((totalWordCount * ratios.act3) / wordsPerMinute),
      },
    };
  }

  /**
   * 获取结构类型对应的占比
   */
  private getStructureRatios(structureType: string): {
    act1: number;
    act2a: number;
    act2b: number;
    act3: number;
  } {
    switch (structureType) {
      case 'three_act':
        return THREE_ACT_RATIOS;
      case 'hero_journey':
        return HERO_JOURNEY_RATIOS;
      case 'five_act':
        // 五幕式合并为四幕展示
        return {
          act1: FIVE_ACT_RATIOS.act1,
          act2a: FIVE_ACT_RATIOS.act2a,
          act2b: FIVE_ACT_RATIOS.act2b + FIVE_ACT_RATIOS.act2c,
          act3: FIVE_ACT_RATIOS.act3,
        };
      default:
        return THREE_ACT_RATIOS;
    }
  }

  /**
   * 分析节奏
   */
  private analyzePacing(emotionalArc: EmotionalPoint[]): PacingAnalysis {
    if (!emotionalArc || emotionalArc.length === 0) {
      return {
        tensionCurve: [],
        turningPoints: [],
        pacingDescription: '无情绪曲线数据',
        climaxPosition: 0,
      };
    }

    // 1. 生成紧张度曲线
    const tensionCurve = emotionalArc.map((point) => point.intensity);

    // 2. 识别转折点
    const turningPoints = this.identifyTurningPoints(emotionalArc);

    // 3. 生成节奏描述
    const pacingDescription = this.generatePacingDescription(
      emotionalArc,
      tensionCurve
    );

    // 4. 找到高潮位置
    const climaxPosition = this.findClimaxPosition(emotionalArc);

    return {
      tensionCurve,
      turningPoints,
      pacingDescription,
      climaxPosition,
    };
  }

  /**
   * 识别转折点
   */
  private identifyTurningPoints(emotionalArc: EmotionalPoint[]): string[] {
    const turningPoints: string[] = [];

    // 定义转折点的关键词
    const turningPointKeywords = [
      ' catalyst',
      '催化剂',
      '转折',
      '中点',
      'midpoint',
      '高潮',
      'climax',
      '结局',
      'resolution',
      '危机',
      'crisis',
      '抉择',
      'decision',
    ];

    for (const point of emotionalArc) {
      const plotPoint = point.plotPoint.toLowerCase();
      
      for (const keyword of turningPointKeywords) {
        if (plotPoint.includes(keyword.toLowerCase())) {
          turningPoints.push(point.plotPoint);
          break;
        }
      }
    }

    return turningPoints;
  }

  /**
   * 生成节奏描述
   */
  private generatePacingDescription(
    emotionalArc: EmotionalPoint[],
    tensionCurve: number[]
  ): string {
    if (tensionCurve.length === 0) {
      return '无节奏数据';
    }

    // 计算平均强度
    const avgIntensity =
      tensionCurve.reduce((sum, val) => sum + val, 0) / tensionCurve.length;

    // 计算强度变化范围
    const maxIntensity = Math.max(...tensionCurve);
    const minIntensity = Math.min(...tensionCurve);
    const range = maxIntensity - minIntensity;

    // 计算强度变化频率（通过计算相邻点的差异）
    let changeCount = 0;
    for (let i = 1; i < tensionCurve.length; i++) {
      const diff = Math.abs(tensionCurve[i] - tensionCurve[i - 1]);
      if (diff >= 2) {
        changeCount++;
      }
    }
    const changeFrequency = changeCount / (tensionCurve.length - 1);

    // 生成描述
    let description = '';

    // 整体基调
    if (avgIntensity <= 3) {
      description += '整体节奏平缓，以铺垫和叙事为主';
    } else if (avgIntensity <= 6) {
      description += '整体节奏适中，情绪起伏平衡';
    } else {
      description += '整体节奏紧张，情绪张力较强';
    }

    // 变化范围
    if (range <= 3) {
      description += '；情绪变化较为平稳';
    } else if (range <= 6) {
      description += '；情绪有明显的起伏变化';
    } else {
      description += '；情绪对比强烈，戏剧张力十足';
    }

    // 变化频率
    if (changeFrequency <= 0.3) {
      description += '，节奏变化较慢';
    } else if (changeFrequency <= 0.6) {
      description += '，节奏变化适中';
    } else {
      description += '，节奏变化频繁';
    }

    return description;
  }

  /**
   * 找到高潮位置
   */
  private findClimaxPosition(emotionalArc: EmotionalPoint[]): number {
    if (!emotionalArc || emotionalArc.length === 0) {
      return 0;
    }

    // 找到强度最高的点
    let maxIntensity = -1;
    let climaxIndex = 0;

    for (let i = 0; i < emotionalArc.length; i++) {
      if (emotionalArc[i].intensity > maxIntensity) {
        maxIntensity = emotionalArc[i].intensity;
        climaxIndex = i;
      }
    }

    // 返回百分比位置
    return Math.round((climaxIndex / emotionalArc.length) * 100);
  }

  /**
   * 计算结构评分
   */
  private calculateStructureScore(
    structure: StoryStructure,
    emotionalArc: EmotionalPoint[],
    actLengths: ActLengths
  ): StructureScore {
    // 1. 结构完整性评分
    const completeness = this.calculateCompleteness(structure);

    // 2. 节奏平衡性评分
    const balance = this.calculateBalance(actLengths);

    // 3. 情绪曲线评分
    const emotionalArcScore = this.calculateEmotionalArcScore(emotionalArc);

    // 4. 计算总分
    const overall = Math.round(
      completeness * 0.3 + balance * 0.3 + emotionalArcScore * 0.4
    );

    return {
      overall,
      completeness,
      balance,
      emotionalArc: emotionalArcScore,
    };
  }

  /**
   * 计算结构完整性
   */
  private calculateCompleteness(structure: StoryStructure): number {
    let score = 0;
    let totalFields = 0;

    // 检查各个字段是否有值
    const fields = [
      structure.act1,
      structure.act2a,
      structure.act2b,
      structure.act3,
      structure.midpoint,
      structure.climax,
    ];

    for (const field of fields) {
      totalFields++;
      if (field && field.trim().length > 0) {
        score++;
      }
    }

    return Math.round((score / totalFields) * 100);
  }

  /**
   * 计算节奏平衡性
   */
  private calculateBalance(actLengths: ActLengths): number {
    const lengths = [
      actLengths.act1.percentage,
      actLengths.act2a.percentage,
      actLengths.act2b.percentage,
      actLengths.act3.percentage,
    ];

    // 计算标准差
    const avg = lengths.reduce((sum, val) => sum + val, 0) / lengths.length;
    const variance =
      lengths.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
      lengths.length;
    const stdDev = Math.sqrt(variance);

    // 标准差越小，平衡性越好
    // 理想情况下，三幕式各占25%，标准差为0
    // 如果标准差大于15，认为平衡性较差
    if (stdDev <= 5) {
      return 100;
    } else if (stdDev <= 10) {
      return 80;
    } else if (stdDev <= 15) {
      return 60;
    } else {
      return 40;
    }
  }

  /**
   * 计算情绪曲线评分
   */
  private calculateEmotionalArcScore(emotionalArc: EmotionalPoint[]): number {
    if (!emotionalArc || emotionalArc.length === 0) {
      return 0;
    }

    let score = 0;

    // 1. 检查是否有足够的情绪点（至少3个）
    if (emotionalArc.length >= 3) {
      score += 30;
    } else if (emotionalArc.length >= 2) {
      score += 20;
    } else {
      score += 10;
    }

    // 2. 检查情绪强度范围
    const intensities = emotionalArc.map((p) => p.intensity);
    const range = Math.max(...intensities) - Math.min(...intensities);
    if (range >= 7) {
      score += 35;
    } else if (range >= 4) {
      score += 25;
    } else {
      score += 15;
    }

    // 3. 检查是否有高潮（强度>=8）
    const hasClimax = intensities.some((i) => i >= 8);
    if (hasClimax) {
      score += 35;
    } else if (intensities.some((i) => i >= 6)) {
      score += 25;
    } else {
      score += 15;
    }

    return score;
  }

  /**
   * 获取结构类型显示名称
   */
  getStructureTypeDisplayName(structureType: string): string {
    const nameMap: Record<string, string> = {
      'three_act': '三幕式结构',
      'hero_journey': '英雄之旅',
      'five_act': '五幕式结构',
      'other': '其他结构',
    };

    return nameMap[structureType] || '未知结构';
  }

  /**
   * 获取结构类型描述
   */
  getStructureTypeDescription(structureType: string): string {
    const descriptionMap: Record<string, string> = {
      'three_act': '经典的三幕式结构：设定(25%)、对抗(50%)、结局(25%)',
      'hero_journey': '英雄之旅：启程(20%)、启蒙(60%)、归来(20%)',
      'five_act': '五幕式结构： exposition、rising action、climax、falling action、dénouement',
      'other': '自定义结构',
    };

    return descriptionMap[structureType] || '';
  }
}

// ==========================================
// 导出单例
// ==========================================

export const screenplayStructureAnalyzer = new ScreenplayStructureAnalyzer();

// 默认导出
export default ScreenplayStructureAnalyzer;
