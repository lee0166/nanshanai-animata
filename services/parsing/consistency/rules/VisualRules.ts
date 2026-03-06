/**
 * VisualRules - 视觉一致性规则
 *
 * 检查剧本中视觉风格和描述的一致性，包括：
 * - 视觉风格统一性
 * - 色彩描述一致性
 * - 光影描述合理性
 * - 时代背景匹配
 *
 * @module services/parsing/consistency/rules/VisualRules
 * @version 1.0.0
 */

import {
  ConsistencyRule,
  CheckContext,
  ConsistencyViolation,
  ViolationType
} from '../ConsistencyChecker';
import { ScriptScene, ScriptCharacter, ScriptMetadata } from '../../../../types';

/**
 * 视觉一致性规则配置
 */
export interface VisualRulesConfig {
  /** 检查视觉风格统一性 */
  checkVisualStyle: boolean;
  /** 检查色彩一致性 */
  checkColorConsistency: boolean;
  /** 检查光影合理性 */
  checkLighting: boolean;
  /** 检查时代背景 */
  checkEraConsistency: boolean;
  /** 最小色彩样本数 */
  minColorSamples: number;
}

const DEFAULT_CONFIG: VisualRulesConfig = {
  checkVisualStyle: true,
  checkColorConsistency: true,
  checkLighting: true,
  checkEraConsistency: true,
  minColorSamples: 3
};

/**
 * 预定义的视觉风格
 */
const VISUAL_STYLES = [
  '写实', '写实主义', 'realistic',
  '暗黑', '黑暗', 'dark',
  '明亮', '明亮风格', 'bright',
  '赛博朋克', 'cyberpunk',
  '复古', 'vintage', 'retro',
  '未来', '科幻', 'futuristic', 'sci-fi',
  '梦幻', 'dreamy',
  '哥特', 'gothic',
  '极简', '简约', 'minimalist',
  '华丽', '华丽风格', '华丽装饰', 'ornate'
];

/**
 * 预定义的色彩关键词
 */
const COLOR_KEYWORDS: Record<string, string[]> = {
  '红色': ['红', '赤', '绯', '朱', 'red', 'crimson', 'scarlet'],
  '蓝色': ['蓝', '青', '碧', 'blue', 'azure', 'cyan'],
  '绿色': ['绿', '翠', '碧', 'green', 'emerald', 'lime'],
  '黄色': ['黄', '金', '橙', 'yellow', 'gold', 'orange', 'amber'],
  '紫色': ['紫', '紫罗兰', 'purple', 'violet', 'magenta'],
  '黑色': ['黑', '墨', '玄', 'black', 'dark', 'shadow'],
  '白色': ['白', '雪', '银', 'white', 'snow', 'silver'],
  '灰色': ['灰', '灰白', 'grey', 'gray', 'silver']
};

/**
 * 时代特征关键词
 */
const ERA_KEYWORDS: Record<string, string[]> = {
  '古代': ['古代', '古代中国', '古代风格', 'ancient', 'historical', 'medieval'],
  '近代': ['近代', '民国', '清末', 'early modern', 'republican era'],
  '现代': ['现代', '当代', 'modern', 'contemporary', 'present day'],
  '未来': ['未来', '科幻', 'futuristic', 'sci-fi', 'future']
};

/**
 * 光影关键词
 */
const LIGHTING_KEYWORDS = {
  '自然光': ['自然光', '日光', '阳光', 'natural light', 'sunlight', 'daylight'],
  '人造光': ['人造光', '灯光', 'lamp', 'artificial light', 'electric light'],
  '暗光': ['暗光', '昏暗', '阴影', 'dark', 'dim', 'shadow', 'low light'],
  '强光': ['强光', '明亮', 'bright', 'harsh light', 'intense light'],
  '柔光': ['柔光', '柔和', 'soft light', 'diffused light']
};

/**
 * 提取文本中的视觉风格
 * @private
 */
function extractVisualStyle(text: string): string[] {
  if (!text) return [];
  const styles: string[] = [];
  const lowerText = text.toLowerCase();

  for (const style of VISUAL_STYLES) {
    if (lowerText.includes(style.toLowerCase())) {
      styles.push(style);
    }
  }

  return [...new Set(styles)];
}

/**
 * 提取文本中的色彩
 * @private
 */
function extractColors(text: string): string[] {
  if (!text) return [];
  const colors: string[] = [];
  const lowerText = text.toLowerCase();

  for (const [colorName, keywords] of Object.entries(COLOR_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        colors.push(colorName);
        break;
      }
    }
  }

  return [...new Set(colors)];
}

/**
 * 提取文本中的时代特征
 * @private
 */
function extractEra(text: string): string[] {
  if (!text) return [];
  const eras: string[] = [];
  const lowerText = text.toLowerCase();

  for (const [eraName, keywords] of Object.entries(ERA_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        eras.push(eraName);
        break;
      }
    }
  }

  return [...new Set(eras)];
}

/**
 * 提取文本中的光影描述
 * @private
 */
function extractLighting(text: string): string[] {
  if (!text) return [];
  const lighting: string[] = [];
  const lowerText = text.toLowerCase();

  for (const [lightType, keywords] of Object.entries(LIGHTING_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        lighting.push(lightType);
        break;
      }
    }
  }

  return [...new Set(lighting)];
}

/**
 * 计算两个集合的相似度
 * @private
 */
function calculateSetSimilarity<T>(set1: T[], set2: T[]): number {
  if (set1.length === 0 || set2.length === 0) return 0;

  const intersection = set1.filter(x => set2.includes(x));
  const union = [...new Set([...set1, ...set2])];

  return intersection.length / union.length;
}

/**
 * 视觉一致性规则类
 */
export class VisualRules implements ConsistencyRule {
  id = 'visual-rules';
  name = '视觉一致性规则';
  description = '检查剧本中视觉风格和描述的一致性，包括色彩、光影和时代背景';
  priority = 80;
  enabled = true;

  private config: VisualRulesConfig;

  constructor(config: Partial<VisualRulesConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行视觉一致性检查
   */
  async check(context: CheckContext): Promise<ConsistencyViolation[]> {
    const violations: ConsistencyViolation[] = [];
    const { scenes, characters, metadata, globalContext } = context;

    console.log(`[VisualRules] Checking visual consistency for ${scenes.length} scenes`);

    // 1. 检查视觉风格统一性
    if (this.config.checkVisualStyle) {
      const styleViolations = this.checkVisualStyleConsistency(scenes, globalContext?.visualStyle);
      violations.push(...styleViolations);
    }

    // 2. 检查色彩一致性
    if (this.config.checkColorConsistency) {
      const colorViolations = this.checkColorConsistency(scenes);
      violations.push(...colorViolations);
    }

    // 3. 检查光影合理性
    if (this.config.checkLighting) {
      const lightingViolations = this.checkLightingConsistency(scenes);
      violations.push(...lightingViolations);
    }

    // 4. 检查时代背景一致性
    if (this.config.checkEraConsistency) {
      const eraViolations = this.checkEraConsistency(scenes, characters, metadata, globalContext?.eraContext);
      violations.push(...eraViolations);
    }

    console.log(`[VisualRules] Found ${violations.length} violations`);
    return violations;
  }

  /**
   * 检查视觉风格统一性
   * @private
   */
  private checkVisualStyleConsistency(
    scenes: ScriptScene[],
    globalVisualStyle?: string
  ): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];

    // 收集所有场景的视觉风格
    const sceneStyles = new Map<string, string[]>();
    for (const scene of scenes) {
      const styles = extractVisualStyle(scene.description || '');
      if (styles.length > 0) {
        sceneStyles.set(scene.id, styles);
      }
    }

    // 如果没有全局视觉风格，检查场景间的一致性
    if (!globalVisualStyle && sceneStyles.size > 1) {
      const styleArrays = Array.from(sceneStyles.values());
      const firstStyles = styleArrays[0];

      for (let i = 1; i < styleArrays.length; i++) {
        const similarity = calculateSetSimilarity(firstStyles, styleArrays[i]);

        if (similarity < 0.3) {
          const sceneId = Array.from(sceneStyles.keys())[i];
          const scene = scenes.find(s => s.id === sceneId);

          violations.push({
            id: `visual-style-mismatch-${sceneId}`,
            type: 'visual_style_mismatch' as ViolationType,
            severity: 'info',
            message: `场景 "${scene?.name}" 的视觉风格与其他场景不一致`,
            sceneIds: [sceneId],
            suggestion: `建议统一剧本的视觉风格，或在场景描述中明确说明风格变化的原因`,
            autoFixable: false,
            confidence: 0.6
          });
        }
      }
    }

    // 检查场景风格是否与全局风格冲突
    if (globalVisualStyle) {
      for (const [sceneId, styles] of sceneStyles.entries()) {
        const hasMatchingStyle = styles.some(s =>
          globalVisualStyle.toLowerCase().includes(s.toLowerCase()) ||
          s.toLowerCase().includes(globalVisualStyle.toLowerCase())
        );

        if (!hasMatchingStyle && styles.length > 0) {
          const scene = scenes.find(s => s.id === sceneId);

          violations.push({
            id: `visual-style-global-mismatch-${sceneId}`,
            type: 'visual_style_mismatch' as ViolationType,
            severity: 'warning',
            message: `场景 "${scene?.name}" 的视觉风格 (${styles.join(', ')}) 与全局风格 "${globalVisualStyle}" 不匹配`,
            sceneIds: [sceneId],
            suggestion: `建议调整场景描述以符合全局视觉风格 "${globalVisualStyle}"，或重新评估全局风格设置`,
            autoFixable: false,
            confidence: 0.7
          });
        }
      }
    }

    return violations;
  }

  /**
   * 检查色彩一致性
   * @private
   */
  private checkColorConsistency(scenes: ScriptScene[]): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];

    // 收集所有场景的色彩描述
    const sceneColors = new Map<string, string[]>();
    for (const scene of scenes) {
      const colors = extractColors(scene.description || '');
      if (colors.length >= this.config.minColorSamples) {
        sceneColors.set(scene.id, colors);
      }
    }

    // 如果场景数量足够，检查色彩一致性
    if (sceneColors.size >= 2) {
      const colorArrays = Array.from(sceneColors.values());
      const allColors = colorArrays.flat();
      const colorFrequency = new Map<string, number>();

      for (const color of allColors) {
        colorFrequency.set(color, (colorFrequency.get(color) || 0) + 1);
      }

      // 检查是否有主导色彩
      const dominantColors = Array.from(colorFrequency.entries())
        .filter(([, count]) => count >= sceneColors.size * 0.5)
        .map(([color]) => color);

      // 检查是否有场景缺少主导色彩
      for (const [sceneId, colors] of sceneColors.entries()) {
        const hasDominantColor = dominantColors.some(dc => colors.includes(dc));

        if (!hasDominantColor && dominantColors.length > 0) {
          const scene = scenes.find(s => s.id === sceneId);

          violations.push({
            id: `color-inconsistency-${sceneId}`,
            type: 'visual_style_mismatch' as ViolationType,
            severity: 'info',
            message: `场景 "${scene?.name}" 的色彩描述与剧本整体色调不一致`,
            sceneIds: [sceneId],
            suggestion: `剧本主要使用 ${dominantColors.join(', ')} 色调，建议场景描述中体现这些色彩以保持视觉统一`,
            autoFixable: false,
            confidence: 0.5
          });
        }
      }
    }

    return violations;
  }

  /**
   * 检查光影一致性
   * @private
   */
  private checkLightingConsistency(scenes: ScriptScene[]): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];

    for (const scene of scenes) {
      const lighting = extractLighting(scene.description || '');
      const timeOfDay = this.inferTimeOfDay(scene.time || '');

      // 检查光影是否与时间匹配
      if (timeOfDay && lighting.length > 0) {
        // 白天场景不应该有暗光描述
        if ((timeOfDay === 'morning' || timeOfDay === 'afternoon') &&
            lighting.includes('暗光') && !lighting.includes('室内')) {
          violations.push({
            id: `lighting-time-mismatch-${scene.id}`,
            type: 'logic_error' as ViolationType,
            severity: 'info',
            message: `场景 "${scene.name}" 的时间 (${scene.time}) 与光影描述 (${lighting.join(', ')}) 可能不匹配`,
            sceneIds: [scene.id],
            suggestion: `${scene.time} 通常是明亮的光线，如果场景确实昏暗，请明确说明原因（如室内、阴天等）`,
            autoFixable: false,
            confidence: 0.5
          });
        }

        // 夜晚场景不应该有强光描述（除非是人造光源）
        if (timeOfDay === 'night' && lighting.includes('强光') && !lighting.includes('人造光')) {
          violations.push({
            id: `lighting-night-mismatch-${scene.id}`,
            type: 'logic_error' as ViolationType,
            severity: 'info',
            message: `场景 "${scene.name}" 的夜晚场景有强光描述，但未说明光源`,
            sceneIds: [scene.id],
            suggestion: `夜晚场景的强光通常来自人造光源（如灯光、车灯等），建议在描述中明确光源`,
            autoFixable: false,
            confidence: 0.5
          });
        }
      }
    }

    return violations;
  }

  /**
   * 推断时间段
   * @private
   */
  private inferTimeOfDay(timeStr: string): 'morning' | 'afternoon' | 'evening' | 'night' | null {
    if (!timeStr) return null;

    const lowerTime = timeStr.toLowerCase();

    if (lowerTime.includes('早') || lowerTime.includes('morning') || lowerTime.includes('晨')) {
      return 'morning';
    }
    if (lowerTime.includes('午') || lowerTime.includes('afternoon') || lowerTime.includes('中午')) {
      return 'afternoon';
    }
    if (lowerTime.includes('晚') || lowerTime.includes('evening') || lowerTime.includes('傍晚')) {
      return 'evening';
    }
    if (lowerTime.includes('夜') || lowerTime.includes('night') || lowerTime.includes('深夜')) {
      return 'night';
    }

    // 尝试解析时间
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      if (hour >= 5 && hour < 12) return 'morning';
      if (hour >= 12 && hour < 18) return 'afternoon';
      if (hour >= 18 && hour < 22) return 'evening';
      return 'night';
    }

    return null;
  }

  /**
   * 检查时代背景一致性
   * @private
   */
  private checkEraConsistency(
    scenes: ScriptScene[],
    characters: ScriptCharacter[],
    metadata: ScriptMetadata,
    globalEraContext?: string
  ): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];

    // 收集所有文本中的时代特征
    const allTexts: string[] = [
      metadata.genre?.join(' ') || '',
      ...scenes.map(s => s.description || ''),
      ...characters.map(c => c.background || '')
    ];

    const detectedEras = new Set<string>();
    for (const text of allTexts) {
      const eras = extractEra(text);
      eras.forEach(e => detectedEras.add(e));
    }

    // 检查是否检测到多个时代
    if (detectedEras.size > 1) {
      violations.push({
        id: 'era-multiple-detected',
        type: 'timeline_conflict' as ViolationType,
        severity: 'warning',
        message: `剧本中检测到多个时代背景: ${Array.from(detectedEras).join(', ')}`,
        suggestion: `建议明确剧本的时代背景，避免不同时代的元素混合造成混乱`,
        autoFixable: false,
        confidence: 0.7
      });
    }

    // 检查是否与全局时代背景冲突
    if (globalEraContext && detectedEras.size > 0) {
      const hasMatchingEra = Array.from(detectedEras).some(era =>
        globalEraContext.toLowerCase().includes(era.toLowerCase()) ||
        era.toLowerCase().includes(globalEraContext.toLowerCase())
      );

      if (!hasMatchingEra) {
        violations.push({
          id: 'era-global-mismatch',
          type: 'timeline_conflict' as ViolationType,
          severity: 'error',
          message: `剧本内容的时代背景 (${Array.from(detectedEras).join(', ')}) 与设定 (${globalEraContext}) 不匹配`,
          suggestion: `请检查剧本内容，确保符合 ${globalEraContext} 的时代特征，或调整时代背景设定`,
          autoFixable: false,
          confidence: 0.8
        });
      }
    }

    return violations;
  }
}

export default VisualRules;
