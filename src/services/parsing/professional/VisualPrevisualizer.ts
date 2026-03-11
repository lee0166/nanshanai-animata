/**
 * VisualPrevisualizer - 视觉预演服务
 *
 * 基于现有 visualStyle 和 eraContext 生成视觉预演
 * 零LLM调用，纯数据转换和增强
 * 输入: visualStyle, eraContext
 * 输出: VisualPreviz
 */

import type { VisualStyle, EraContext } from '../../../../types';

// ==========================================
// 类型定义
// ==========================================

/**
 * 色彩板
 */
export interface ColorBoard {
  /** 主色调列表 */
  primaryColors: string[];
  /** 情绪描述 */
  moodDescription: string;
  /** 摄影指导备注 */
  cinematographyNotes: string;
  /** 光影建议 */
  lightingSuggestions: string[];
}

/**
 * 时代视觉参考
 */
export interface EraVisualGuide {
  /** 时代 */
  era: string;
  /** 地点 */
  location: string;
  /** 视觉参考关键词 */
  visualReferences: string[];
  /** 时代特征 */
  eraCharacteristics: string[];
  /** 服装风格 */
  costumeStyle: string;
  /** 建筑风格 */
  architectureStyle: string;
}

/**
 * 视觉预演结果
 */
export interface VisualPreviz {
  /** 原始视觉风格 */
  visualStyle: VisualStyle;
  /** 色彩板 */
  colorBoard: ColorBoard;
  /** 时代视觉参考 */
  eraVisualGuide: EraVisualGuide;
  /** 整体视觉描述 */
  overallVisualDescription: string;
  /** 场景视觉建议 */
  sceneVisualSuggestions: SceneVisualSuggestion[];
}

/**
 * 场景视觉建议
 */
export interface SceneVisualSuggestion {
  /** 场景类型 */
  sceneType: string;
  /** 视觉风格 */
  visualStyle: string;
  /** 色彩建议 */
  colorSuggestion: string;
  /** 光影建议 */
  lightingSuggestion: string;
}

// ==========================================
// 色彩情绪映射
// ==========================================

/**
 * 色彩情绪到描述的映射
 */
const COLOR_MOOD_MAP: Record<
  string,
  {
    description: string;
    lighting: string[];
    keywords: string[];
  }
> = {
  温暖明亮: {
    description: '暖色调为主，金黄色和橙色的阳光感，给人温馨舒适的视觉体验',
    lighting: ['自然光', '暖色灯光', '黄金时段光线', '柔和的侧光'],
    keywords: ['阳光', '温暖', '舒适', '家庭', '日间'],
  },
  冷峻压抑: {
    description: '冷色调为主，蓝色和灰色的冷峻感，营造紧张压抑的氛围',
    lighting: ['冷色光', '高对比度', '阴影', '侧逆光'],
    keywords: ['冷峻', '压抑', '紧张', '严肃', '夜晚'],
  },
  复古怀旧: {
    description: '复古色调，降低饱和度，增加颗粒感，营造怀旧氛围',
    lighting: ['柔光', '暖调滤镜', '散射光', '复古色温'],
    keywords: ['复古', '怀旧', '旧时光', '胶片感', '暖调'],
  },
  明亮清新: {
    description: '明亮清新的色调，高饱和度，给人活力和希望的感觉',
    lighting: ['明亮的自然光', '高调照明', '均匀光', '柔光'],
    keywords: ['明亮', '清新', '活力', '希望', '日间'],
  },
  阴暗沉重: {
    description: '阴暗沉重的色调，低亮度，高对比，营造压抑沉重的氛围',
    lighting: ['低调照明', '强阴影', '局部光', '暗调'],
    keywords: ['阴暗', '沉重', '压抑', '神秘', '夜晚'],
  },
  鲜艳夺目: {
    description: '鲜艳夺目的色彩，高饱和度，视觉冲击力强',
    lighting: ['饱和光', '彩色光', '戏剧光', '强对比'],
    keywords: ['鲜艳', '夺目', '视觉冲击', '戏剧性', '彩色'],
  },
  柔和淡雅: {
    description: '柔和淡雅的色调，低饱和度，给人宁静优雅的感觉',
    lighting: ['柔光', '散射光', '均匀光', '自然光'],
    keywords: ['柔和', '淡雅', '宁静', '优雅', '简约'],
  },
  神秘莫测: {
    description: '神秘莫测的色调，紫蓝色调，营造神秘悬疑的氛围',
    lighting: ['冷色光', '雾光', '背光', '剪影'],
    keywords: ['神秘', '悬疑', '未知', '迷雾', '夜晚'],
  },
};

// ==========================================
// 时代风格映射
// ==========================================

/**
 * 时代关键词映射
 */
const ERA_KEYWORDS: Record<
  string,
  {
    characteristics: string[];
    costume: string;
    architecture: string;
  }
> = {
  古代: {
    characteristics: ['传统服饰', '古典建筑', '手工艺', '自然材料'],
    costume: '汉服、唐装、古装',
    architecture: '宫殿、庙宇、园林',
  },
  现代: {
    characteristics: ['现代服饰', '城市建筑', '科技元素', '快节奏'],
    costume: '现代时装、商务装',
    architecture: '摩天大楼、现代住宅',
  },
  民国: {
    characteristics: ['中西合璧', '旗袍长衫', '洋楼', '复古风情'],
    costume: '旗袍、长衫、西装',
    architecture: '洋楼、石库门、老街',
  },
  未来: {
    characteristics: ['科幻元素', '高科技', '简约设计', '金属质感'],
    costume: '科幻服装、功能性服装',
    architecture: '未来建筑、太空站',
  },
  '80年代': {
    characteristics: ['复古风格', '怀旧元素', '鲜艳色彩', '流行音乐'],
    costume: '喇叭裤、花衬衫',
    architecture: '老式居民楼、工厂',
  },
  '90年代': {
    characteristics: ['港风', '街头文化', '牛仔裤', '流行音乐'],
    costume: '牛仔裤、T恤、运动服',
    architecture: '城市街道、商场',
  },
};

/**
 * 地点关键词映射
 */
const LOCATION_KEYWORDS: Record<string, string[]> = {
  北京: ['胡同', '四合院', '故宫', '长城', '现代CBD'],
  上海: ['外滩', '弄堂', '摩天大楼', '石库门', '黄浦江'],
  纽约: ['曼哈顿', '自由女神', '中央公园', '摩天大楼', '街头'],
  东京: ['霓虹灯', '涩谷', '传统神社', '现代建筑', '樱花'],
  巴黎: ['埃菲尔铁塔', '塞纳河', '咖啡馆', '香榭丽舍', '艺术'],
  伦敦: ['大本钟', '泰晤士河', '雾都', '古典建筑', '现代塔'],
};

// ==========================================
// 摄影风格映射
// ==========================================

/**
 * 摄影风格建议
 */
const CINEMATOGRAPHY_SUGGESTIONS: Record<string, string[]> = {
  手持纪实: ['晃动镜头', '跟拍', '长镜头', '自然光'],
  稳定器流畅: ['平滑移动', '轨道感', '精准构图', '稳定画面'],
  电影感构图: ['宽银幕', '黄金分割', '层次丰富', '景深控制'],
  纪录片风格: ['真实感', '自然光', '长镜头', '采访式'],
};

// ==========================================
// 核心类
// ==========================================

export class VisualPrevisualizer {
  /**
   * 生成视觉预演
   * @param visualStyle 视觉风格
   * @param eraContext 时代背景
   * @returns 视觉预演结果
   */
  analyze(visualStyle: VisualStyle, eraContext?: EraContext): VisualPreviz {
    console.log('[VisualPrevisualizer] Starting visual previsualization...');

    // 1. 生成色彩板
    const colorBoard = this.generateColorBoard(visualStyle);

    // 2. 生成时代视觉参考
    const eraVisualGuide = this.generateEraVisualGuide(visualStyle, eraContext);

    // 3. 生成整体视觉描述
    const overallVisualDescription = this.generateOverallVisualDescription(visualStyle, eraContext);

    // 4. 生成场景视觉建议
    const sceneVisualSuggestions = this.generateSceneVisualSuggestions(visualStyle);

    console.log('[VisualPrevisualizer] Analysis complete:', {
      colorPalette: colorBoard.primaryColors.length,
      era: eraContext?.era || '未指定',
    });

    return {
      visualStyle,
      colorBoard,
      eraVisualGuide,
      overallVisualDescription,
      sceneVisualSuggestions,
    };
  }

  /**
   * 生成色彩板
   */
  private generateColorBoard(visualStyle: VisualStyle): ColorBoard {
    const colorMood = visualStyle.colorMood;
    const moodData = this.getColorMoodData(colorMood);

    return {
      primaryColors: visualStyle.colorPalette,
      moodDescription: moodData.description,
      cinematographyNotes: this.generateCinematographyNotes(visualStyle),
      lightingSuggestions: moodData.lighting,
    };
  }

  /**
   * 获取色彩情绪数据
   */
  private getColorMoodData(colorMood: string): {
    description: string;
    lighting: string[];
    keywords: string[];
  } {
    for (const [key, value] of Object.entries(COLOR_MOOD_MAP)) {
      if (colorMood.includes(key)) {
        return value;
      }
    }

    // 默认返回
    return {
      description: `以${colorMood}为主的视觉风格`,
      lighting: ['自然光', '柔光'],
      keywords: ['平衡', '中性'],
    };
  }

  /**
   * 生成摄影指导备注
   */
  private generateCinematographyNotes(visualStyle: VisualStyle): string {
    const cinematography = visualStyle.cinematography;
    const artDirection = visualStyle.artDirection;

    let notes = `整体采用${cinematography}的摄影风格，`;
    notes += `配合${artDirection}的美术指导。`;

    // 根据光影风格添加建议
    if (visualStyle.lightingStyle) {
      notes += `光影方面以${visualStyle.lightingStyle}为主，`;
    }

    // 根据色彩情绪添加建议
    const moodData = this.getColorMoodData(visualStyle.colorMood);
    notes += `营造${moodData.keywords.join('、')}的视觉氛围。`;

    return notes;
  }

  /**
   * 生成时代视觉参考
   */
  private generateEraVisualGuide(
    visualStyle: VisualStyle,
    eraContext?: EraContext
  ): EraVisualGuide {
    const era = eraContext?.era || '现代';
    const location = eraContext?.location || '城市';

    return {
      era,
      location,
      visualReferences: this.generateVisualReferences(era, location),
      eraCharacteristics: this.getEraCharacteristics(era),
      costumeStyle: this.getCostumeStyle(era),
      architectureStyle: this.getArchitectureStyle(era),
    };
  }

  /**
   * 生成视觉参考关键词
   */
  private generateVisualReferences(era: string, location: string): string[] {
    const references: string[] = [];

    // 添加时代特征
    const eraChars = this.getEraCharacteristics(era);
    references.push(...eraChars);

    // 添加地点特征
    for (const [key, values] of Object.entries(LOCATION_KEYWORDS)) {
      if (location.includes(key)) {
        references.push(...values);
        break;
      }
    }

    // 如果没有匹配到具体地点，添加通用地点关键词
    if (references.length === eraChars.length) {
      references.push('城市景观', '街道', '建筑');
    }

    return [...new Set(references)]; // 去重
  }

  /**
   * 获取时代特征
   */
  private getEraCharacteristics(era: string): string[] {
    for (const [key, value] of Object.entries(ERA_KEYWORDS)) {
      if (era.includes(key)) {
        return value.characteristics;
      }
    }

    return ['现代元素', '城市风格', '当代审美'];
  }

  /**
   * 获取服装风格
   */
  private getCostumeStyle(era: string): string {
    for (const [key, value] of Object.entries(ERA_KEYWORDS)) {
      if (era.includes(key)) {
        return value.costume;
      }
    }

    return '现代服装';
  }

  /**
   * 获取建筑风格
   */
  private getArchitectureStyle(era: string): string {
    for (const [key, value] of Object.entries(ERA_KEYWORDS)) {
      if (era.includes(key)) {
        return value.architecture;
      }
    }

    return '现代建筑';
  }

  /**
   * 生成整体视觉描述
   */
  private generateOverallVisualDescription(
    visualStyle: VisualStyle,
    eraContext?: EraContext
  ): string {
    const moodData = this.getColorMoodData(visualStyle.colorMood);

    let description = `本片采用${visualStyle.artDirection}的美术风格，`;
    description += `以${visualStyle.colorMood}为基调，`;
    description += `${moodData.description}。`;

    if (eraContext) {
      description += `故事发生在${eraContext.era}的${eraContext.location}，`;
      description += `呈现${this.getEraCharacteristics(eraContext.era).join('、')}的时代特征。`;
    }

    description += `摄影上运用${visualStyle.cinematography}的手法，`;
    description += `配合${visualStyle.lightingStyle}，`;
    description += `营造独特的视觉语言。`;

    return description;
  }

  /**
   * 生成场景视觉建议
   */
  private generateSceneVisualSuggestions(visualStyle: VisualStyle): SceneVisualSuggestion[] {
    const suggestions: SceneVisualSuggestion[] = [];
    const moodData = this.getColorMoodData(visualStyle.colorMood);

    // 室内场景
    suggestions.push({
      sceneType: '室内场景',
      visualStyle:
        `${visualStyle.artDirection}风格，` + `利用${moodData.lighting[0] || '自然光'}营造氛围`,
      colorSuggestion:
        `以${visualStyle.colorPalette[0] || '主色调'}为主，` +
        `配合${visualStyle.colorPalette[1] || '辅助色'}`,
      lightingSuggestion: visualStyle.lightingStyle || moodData.lighting[0] || '自然光',
    });

    // 室外场景
    suggestions.push({
      sceneType: '室外场景',
      visualStyle: `${visualStyle.cinematography}，` + `展现${moodData.keywords[0] || '环境'}氛围`,
      colorSuggestion: `根据天气和时间调整${visualStyle.colorMood}的饱和度`,
      lightingSuggestion: moodData.lighting[1] || '自然光',
    });

    // 情感场景
    suggestions.push({
      sceneType: '情感场景',
      visualStyle: '特写与中景结合，强调人物表情和互动',
      colorSuggestion: `根据情绪强度调整${visualStyle.colorPalette[0] || '主色调'}的明暗`,
      lightingSuggestion: '柔光或戏剧光，根据情感基调调整',
    });

    // 动作场景
    suggestions.push({
      sceneType: '动作场景',
      visualStyle: '动态镜头，快速剪辑，强调节奏感',
      colorSuggestion: `保持${visualStyle.colorMood}基调，增强对比度`,
      lightingSuggestion: '高对比度光，突出动作张力',
    });

    return suggestions;
  }

  /**
   * 获取色彩十六进制值（用于UI展示）
   */
  getColorHex(colorName: string): string {
    const colorMap: Record<string, string> = {
      红色: '#E53935',
      深红: '#B71C1C',
      粉红: '#F48FB1',
      橙色: '#FB8C00',
      黄色: '#FDD835',
      金色: '#FFD700',
      绿色: '#43A047',
      深绿: '#1B5E20',
      青色: '#00897B',
      蓝色: '#1E88E5',
      深蓝: '#0D47A1',
      紫色: '#8E24AA',
      深紫: '#4A148C',
      棕色: '#6D4C41',
      灰色: '#757575',
      深灰: '#424242',
      黑色: '#212121',
      白色: '#FAFAFA',
      米色: '#F5F5DC',
      咖啡色: '#795548',
    };

    // 尝试直接匹配
    if (colorMap[colorName]) {
      return colorMap[colorName];
    }

    // 尝试包含匹配
    for (const [key, value] of Object.entries(colorMap)) {
      if (colorName.includes(key)) {
        return value;
      }
    }

    // 默认返回灰色
    return '#9E9E9E';
  }
}

// ==========================================
// 导出单例
// ==========================================

export const visualPrevisualizer = new VisualPrevisualizer();

// 默认导出
export default VisualPrevisualizer;
