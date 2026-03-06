/**
 * Professional Analysis Module - 专业分析模块
 * 
 * 基于现有解析数据进行专业级分析和可视化展示
 * 零LLM调用，纯数据转换
 */

// ==========================================
// 导出 SoundDesigner
// ==========================================
export {
  SoundDesigner,
  soundDesigner,
  type SoundDesignAnalysis,
  type EmotionalMusicMapItem,
  type SoundPalette,
  type OverallSoundscape,
} from './SoundDesigner';

// ==========================================
// 导出 ScreenplayStructureAnalyzer
// ==========================================
export {
  ScreenplayStructureAnalyzer,
  screenplayStructureAnalyzer,
  type StructureAnalysis,
  type ActLength,
  type ActLengths,
  type PacingAnalysis,
  type StructureScore,
} from './ScreenplayStructureAnalyzer';

// ==========================================
// 导出 VisualPrevisualizer
// ==========================================
export {
  VisualPrevisualizer,
  visualPrevisualizer,
  type VisualPreviz,
  type ColorBoard,
  type EraVisualGuide,
  type SceneVisualSuggestion,
} from './VisualPrevisualizer';

// ==========================================
// 统一分析入口
// ==========================================

import type { ScriptMetadata, Shot } from '../../../../types';
import { soundDesigner, type SoundDesignAnalysis } from './SoundDesigner';
import { screenplayStructureAnalyzer, type StructureAnalysis } from './ScreenplayStructureAnalyzer';
import { visualPrevisualizer, type VisualPreviz } from './VisualPrevisualizer';

/**
 * 完整的专业分析结果
 */
export interface ProfessionalAnalysis {
  /** 声音设计分析 */
  soundDesign: SoundDesignAnalysis;
  /** 剧本结构分析 */
  structure: StructureAnalysis;
  /** 视觉预演 */
  visualPreviz: VisualPreviz;
}

/**
 * 专业分析器
 * 统一入口，执行所有专业分析
 */
export class ProfessionalAnalyzer {
  /**
   * 执行完整的专业分析
   * @param metadata 剧本元数据
   * @param shots 分镜列表
   * @returns 完整分析结果
   */
  analyze(
    metadata: ScriptMetadata,
    shots: Shot[] = []
  ): ProfessionalAnalysis {
    console.log('[ProfessionalAnalyzer] Starting comprehensive analysis...');

    // 1. 声音设计分析
    const soundDesign = soundDesigner.analyze(metadata, shots);

    // 2. 剧本结构分析
    const structure = screenplayStructureAnalyzer.analyze(
      metadata.storyStructure || {
        structureType: 'three_act',
        act1: '',
        act2a: '',
        act2b: '',
        act3: '',
        midpoint: '',
        climax: '',
      },
      metadata.emotionalArc,
      metadata.wordCount
    );

    // 3. 视觉预演
    const visualPreviz = visualPrevisualizer.analyze(
      metadata.visualStyle || {
        artDirection: '写实电影感',
        artStyle: '现代',
        artStyleDescription: '',
        colorPalette: [],
        colorMood: '中性',
        cinematography: '电影感构图',
        lightingStyle: '自然光',
      },
      metadata.eraContext
    );

    console.log('[ProfessionalAnalyzer] Comprehensive analysis complete');

    return {
      soundDesign,
      structure,
      visualPreviz,
    };
  }
}

/**
 * 专业分析器单例
 */
export const professionalAnalyzer = new ProfessionalAnalyzer();

export default ProfessionalAnalyzer;
