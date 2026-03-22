/**
 * SoundDesigner - 声音设计分析服务
 *
 * 基于现有数据进行声音设计分析，零LLM调用，纯数据转换
 * 输入: emotionalArc, Shot.sound, colorMood
 * 输出: SoundDesignAnalysis
 */

import type { EmotionalPoint, Shot, ScriptMetadata } from '../../../../types';

// ==========================================
// 类型定义
// ==========================================

/**
 * 情绪音乐映射项
 */
export interface EmotionalMusicMapItem {
  /** 情节点名称 */
  plotPoint: string;
  /** 主导情绪 */
  emotion: string;
  /** 情绪强度 (0-10) */
  intensity: number;
  /** 推荐音乐风格 */
  suggestedMusic: string;
  /** 对应色调 */
  colorTone: string;
  /** 故事位置百分比 */
  percentage: number;
}

/**
 * 声音调色板
 */
export interface SoundPalette {
  /** 环境音类型统计 */
  ambientSounds: string[];
  /** 音效类型统计 */
  effectSounds: string[];
  /** 配乐主题统计 */
  musicThemes: string[];
}

/**
 * 整体音景
 */
export interface OverallSoundscape {
  /** 主导情绪 */
  dominantMood: string;
  /** 背景音调 */
  backgroundTone: string;
  /** 动态范围描述 */
  dynamicRange: string;
}

/**
 * 声音设计分析结果
 */
export interface SoundDesignAnalysis {
  /** 情绪音乐映射表 */
  emotionalMusicMap: EmotionalMusicMapItem[];
  /** 声音调色板 */
  soundPalette: SoundPalette;
  /** 整体音景 */
  overallSoundscape: OverallSoundscape;
  /** 分析统计 */
  statistics: {
    totalShots: number;
    shotsWithSound: number;
    uniqueAmbientSounds: number;
    uniqueEffectSounds: number;
    uniqueMusicThemes: number;
  };
  /** 音频风格 */
  audioStyle: string;
  /** 音乐主题 */
  musicTheme: string;
}

// ==========================================
// 情绪到音乐映射表
// ==========================================

/**
 * 情绪到音乐风格的映射
 */
const EMOTION_TO_MUSIC_MAP: Record<string, string[]> = {
  // 积极情绪
  喜悦: ['轻快钢琴', '明亮弦乐', '欢快节奏', '民谣吉他'],
  开心: ['轻快钢琴', '明亮弦乐', '欢快节奏', '民谣吉他'],
  快乐: ['轻快钢琴', '明亮弦乐', '欢快节奏', '爵士乐'],
  兴奋: ['激昂管弦乐', '电子音乐', '摇滚节奏', '史诗配乐'],
  激动: ['激昂管弦乐', '电子音乐', '强烈节拍', '史诗配乐'],

  // 消极情绪
  悲伤: ['大提琴独奏', '忧郁钢琴', '弦乐慢板', '哀婉笛声'],
  难过: ['大提琴独奏', '忧郁钢琴', '弦乐慢板', '悲伤小提琴'],
  痛苦: ['沉重低音', '压抑弦乐', '悲怆钢琴', '哀鸣管乐'],
  绝望: ['极简氛围', '低沉 drone', '空旷回响', '压抑弦乐'],

  // 紧张情绪
  紧张: ['悬疑弦乐', '节奏渐强', '低音铺垫', '打击乐'],
  焦虑: ['不规则节奏', '高音弦乐', '电子氛围', '心跳音效'],
  恐惧: ['不和谐音程', '低沉 drone', '惊悚音效', '弦乐滑音'],
  惊悚: ['不和谐音程', '突强音效', '弦乐颤音', '电子噪音'],

  // 愤怒情绪
  愤怒: ['重金属', '强烈打击乐', '低音失真', '激进弦乐'],
  暴怒: ['工业噪音', '极端打击乐', '失真吉他', '压迫性低音'],

  // 平静情绪
  平静: [' ambient', '轻音乐', '自然音效', '钢琴独奏'],
  宁静: [' ambient', '轻音乐', '自然音效', '长笛'],
  安详: ['弦乐和声', '竖琴', '合唱', '管风琴'],

  // 浪漫情绪
  浪漫: ['弦乐四重奏', '萨克斯', '浪漫钢琴', '柔和吉他'],
  温馨: ['原声吉他', '轻弦乐', '温暖 pad', '民谣'],

  // 神秘情绪
  神秘: ['合成器氛围', '空灵女声', '电子音效', '异域乐器'],
  悬疑: ['低音弦乐', '不规则节奏', '电子氛围', '钢琴点缀'],

  // 默认
  default: ['中性配乐', '轻背景音乐', '氛围音乐'],
};

/**
 * 情绪强度到动态描述的映射
 */
const INTENSITY_TO_DYNAMIC_MAP: Record<number, string> = {
  0: '极弱 (ppp)',
  1: '很弱 (pp)',
  2: '弱 (p)',
  3: '中弱 (mp)',
  4: '中等 (mf)',
  5: '中强 (f)',
  6: '强 (ff)',
  7: '很强 (fff)',
  8: '极强 (ffff)',
  9: '极限 (fffff)',
  10: '爆发 (sffffz)',
};

// ==========================================
// 声音分类规则
// ==========================================

/**
 * 环境音关键词
 */
const AMBIENT_KEYWORDS = [
  '雨声',
  '雨',
  '下雨',
  '雨景',
  '风声',
  '风',
  '刮风',
  '雷声',
  '雷',
  '打雷',
  '城市',
  '街道',
  '交通',
  '自然',
  '森林',
  '鸟鸣',
  '室内',
  '房间',
  '空调',
  '海浪',
  '海边',
  '水声',
  '火声',
  '篝火',
  '燃烧',
  '人群',
  '嘈杂',
  '喧闹',
  '安静',
  '寂静',
  '静默',
  'ambient',
  '环境音',
  '背景音',
];

/**
 * 音效关键词
 */
const EFFECT_KEYWORDS = [
  '门',
  '开门',
  '关门',
  '敲门',
  '脚步声',
  '走路',
  '奔跑',
  '电话',
  '手机',
  '铃声',
  '枪声',
  '射击',
  '爆炸',
  '碰撞',
  '破碎',
  '玻璃',
  '心跳',
  '呼吸',
  '喘息',
  '车辆',
  '汽车',
  '引擎',
  'effect',
  '音效',
  '声音效果',
  '打击',
  '撞击',
  '掉落',
];

/**
 * 音乐主题关键词
 */
const MUSIC_KEYWORDS = [
  '配乐',
  '音乐',
  'BGM',
  'bgm',
  '主题曲',
  '插曲',
  '片尾曲',
  '钢琴',
  '小提琴',
  '吉他',
  '管弦乐',
  '弦乐',
  '管乐',
  '电子音乐',
  '合成器',
  '氛围音乐',
  '紧张',
  '悬疑',
  '惊悚',
  '悲伤',
  '忧郁',
  '哀婉',
  '欢快',
  '轻快',
  '明亮',
  '浪漫',
  '温馨',
  '柔和',
  '史诗',
  '宏大',
  '壮丽',
];

// ==========================================
// 核心类
// ==========================================

export class SoundDesigner {
  /**
   * 分析声音设计
   * @param metadata 剧本元数据（包含 emotionalArc, visualStyle）
   * @param shots 分镜列表（包含 sound 字段）
   * @param audioStyle 音频风格
   * @param musicTheme 音乐主题
   * @returns 声音设计分析结果
   */
  analyze(
    metadata: ScriptMetadata,
    shots: Shot[] = [],
    audioStyle: string = '默认',
    musicTheme: string = '默认'
  ): SoundDesignAnalysis {
    console.log('[SoundDesigner] Starting sound design analysis...');

    const emotionalArc = metadata.emotionalArc || [];
    const colorMood = metadata.visualStyle?.colorMood || '中性';

    // 1. 生成情绪音乐映射
    const emotionalMusicMap = this.generateEmotionalMusicMap(emotionalArc, audioStyle, musicTheme);

    // 2. 分析声音调色板
    const soundPalette = this.analyzeSoundPalette(shots);

    // 3. 生成整体音景
    const overallSoundscape = this.generateOverallSoundscape(
      emotionalArc,
      colorMood,
      audioStyle,
      musicTheme
    );

    // 4. 计算统计信息
    const statistics = this.calculateStatistics(shots, soundPalette);

    console.log('[SoundDesigner] Analysis complete:', {
      emotionalPoints: emotionalMusicMap.length,
      ambientSounds: soundPalette.ambientSounds.length,
      effectSounds: soundPalette.effectSounds.length,
      musicThemes: soundPalette.musicThemes.length,
      audioStyle,
      musicTheme,
    });

    return {
      emotionalMusicMap,
      soundPalette,
      overallSoundscape,
      statistics,
      audioStyle,
      musicTheme,
    };
  }

  /**
   * 生成情绪音乐映射表
   */
  private generateEmotionalMusicMap(
    emotionalArc: EmotionalPoint[],
    audioStyle: string,
    musicTheme: string
  ): EmotionalMusicMapItem[] {
    if (!emotionalArc || emotionalArc.length === 0) {
      return [];
    }

    return emotionalArc.map(point => {
      const suggestedMusic = this.getSuggestedMusicForEmotion(
        point.emotion,
        audioStyle,
        musicTheme
      );

      return {
        plotPoint: point.plotPoint,
        emotion: point.emotion,
        intensity: point.intensity,
        suggestedMusic: suggestedMusic,
        colorTone: point.colorTone,
        percentage: point.percentage,
      };
    });
  }

  /**
   * 根据情绪获取推荐音乐
   */
  private getSuggestedMusicForEmotion(
    emotion: string,
    audioStyle: string,
    musicTheme: string
  ): string {
    // 标准化情绪名称
    const normalizedEmotion = emotion.toLowerCase().trim();

    // 查找映射
    for (const [key, values] of Object.entries(EMOTION_TO_MUSIC_MAP)) {
      if (normalizedEmotion.includes(key.toLowerCase())) {
        // 随机选择一个音乐风格
        let music = values[Math.floor(Math.random() * values.length)];

        // 根据音频风格和音乐主题调整推荐
        if (audioStyle !== '默认') {
          music += ` (${audioStyle}风格)`;
        }
        if (musicTheme !== '默认') {
          music += ` - ${musicTheme}主题`;
        }

        return music;
      }
    }

    // 默认音乐
    const defaultMusic = EMOTION_TO_MUSIC_MAP['default'];
    let music = defaultMusic[Math.floor(Math.random() * defaultMusic.length)];

    // 根据音频风格和音乐主题调整推荐
    if (audioStyle !== '默认') {
      music += ` (${audioStyle}风格)`;
    }
    if (musicTheme !== '默认') {
      music += ` - ${musicTheme}主题`;
    }

    return music;
  }

  /**
   * 分析声音调色板
   */
  private analyzeSoundPalette(shots: Shot[]): SoundPalette {
    const ambientSounds = new Set<string>();
    const effectSounds = new Set<string>();
    const musicThemes = new Set<string>();

    for (const shot of shots) {
      if (!shot.sound) continue;

      const sound = shot.sound.toLowerCase();

      // 分类声音
      if (this.isAmbientSound(sound)) {
        ambientSounds.add(shot.sound);
      } else if (this.isEffectSound(sound)) {
        effectSounds.add(shot.sound);
      } else if (this.isMusicTheme(sound)) {
        musicThemes.add(shot.sound);
      } else {
        // 无法分类的，根据内容猜测
        if (sound.includes('乐') || sound.includes('曲')) {
          musicThemes.add(shot.sound);
        } else if (sound.includes('声') || sound.includes('音')) {
          effectSounds.add(shot.sound);
        } else {
          ambientSounds.add(shot.sound);
        }
      }
    }

    return {
      ambientSounds: Array.from(ambientSounds),
      effectSounds: Array.from(effectSounds),
      musicThemes: Array.from(musicThemes),
    };
  }

  /**
   * 判断是否为环境音
   */
  private isAmbientSound(sound: string): boolean {
    return AMBIENT_KEYWORDS.some(keyword => sound.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * 判断是否为音效
   */
  private isEffectSound(sound: string): boolean {
    return EFFECT_KEYWORDS.some(keyword => sound.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * 判断是否为音乐主题
   */
  private isMusicTheme(sound: string): boolean {
    return MUSIC_KEYWORDS.some(keyword => sound.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * 生成整体音景
   */
  private generateOverallSoundscape(
    emotionalArc: EmotionalPoint[],
    colorMood: string,
    audioStyle: string,
    musicTheme: string
  ): OverallSoundscape {
    // 计算主导情绪
    const dominantMood = this.calculateDominantMood(emotionalArc);

    // 根据色彩情绪推导背景音调
    let backgroundTone = this.getBackgroundToneFromColorMood(colorMood);

    // 根据音频风格和音乐主题调整背景音调
    if (audioStyle !== '默认') {
      backgroundTone += `，${audioStyle}风格`;
    }
    if (musicTheme !== '默认') {
      backgroundTone += `，${musicTheme}主题`;
    }

    // 计算动态范围
    const dynamicRange = this.calculateDynamicRange(emotionalArc);

    return {
      dominantMood,
      backgroundTone,
      dynamicRange,
    };
  }

  /**
   * 计算主导情绪
   */
  private calculateDominantMood(emotionalArc: EmotionalPoint[]): string {
    if (!emotionalArc || emotionalArc.length === 0) {
      return '中性';
    }

    // 统计情绪出现频率
    const emotionCount: Record<string, number> = {};
    for (const point of emotionalArc) {
      const emotion = point.emotion;
      emotionCount[emotion] = (emotionCount[emotion] || 0) + 1;
    }

    // 找出出现最多的情绪
    let dominantEmotion = '中性';
    let maxCount = 0;
    for (const [emotion, count] of Object.entries(emotionCount)) {
      if (count > maxCount) {
        maxCount = count;
        dominantEmotion = emotion;
      }
    }

    return dominantEmotion;
  }

  /**
   * 根据色彩情绪获取背景音调
   */
  private getBackgroundToneFromColorMood(colorMood: string): string {
    const moodMap: Record<string, string> = {
      温暖明亮: '暖色调音乐，以弦乐和木管为主',
      冷峻压抑: '冷色调音乐，以合成器和低音为主',
      复古怀旧: '复古音色，模拟老式录音质感',
      明亮清新: '明亮音色，轻快的高音乐器',
      阴暗沉重: '阴暗音色，深沉的低音乐器',
      鲜艳夺目: '鲜艳音色，丰富的配器层次',
      柔和淡雅: '柔和音色，简约的配器',
      神秘莫测: '神秘音色，不和谐的音程',
    };

    for (const [key, value] of Object.entries(moodMap)) {
      if (colorMood.includes(key)) {
        return value;
      }
    }

    return '中性音调，平衡的配器';
  }

  /**
   * 计算动态范围
   */
  private calculateDynamicRange(emotionalArc: EmotionalPoint[]): string {
    if (!emotionalArc || emotionalArc.length === 0) {
      return '中等动态 (mf)';
    }

    const intensities = emotionalArc.map(p => p.intensity);
    const minIntensity = Math.min(...intensities);
    const maxIntensity = Math.max(...intensities);
    const range = maxIntensity - minIntensity;

    if (range <= 2) {
      return '窄动态范围，情绪平稳';
    } else if (range <= 5) {
      return '中等动态范围，情绪有起伏';
    } else if (range <= 8) {
      return '宽动态范围，情绪变化丰富';
    } else {
      return '极宽动态范围，情绪对比强烈';
    }
  }

  /**
   * 计算统计信息
   */
  private calculateStatistics(
    shots: Shot[],
    soundPalette: SoundPalette
  ): SoundDesignAnalysis['statistics'] {
    const shotsWithSound = shots.filter(s => s.sound && s.sound.trim() !== '').length;

    return {
      totalShots: shots.length,
      shotsWithSound,
      uniqueAmbientSounds: soundPalette.ambientSounds.length,
      uniqueEffectSounds: soundPalette.effectSounds.length,
      uniqueMusicThemes: soundPalette.musicThemes.length,
    };
  }
}

// ==========================================
// 导出单例
// ==========================================

export const soundDesigner = new SoundDesigner();

// 默认导出
export default SoundDesigner;
