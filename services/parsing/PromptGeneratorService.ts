/**
 * PromptGeneratorService - 提示词自动生成服务
 *
 * 职责：从解析结果自动生成AI生图/生视频提示词
 * - 从角色资产生成角色图提示词
 * - 从场景资产生成场景图提示词
 * - 从分镜生成关键帧/视频提示词
 *
 * @version 1.0.0
 */

import { DefaultStylePrompt, getDefaultStylePrompt } from '../prompt';
import { CharacterPromptBuilder, ScenePromptBuilder, ItemPromptBuilder } from '../promptBuilder';
import type {
  ScriptCharacter,
  ScriptScene,
  ScriptItem,
  Shot,
  ShotType,
  CameraMovement,
  CameraAngle,
} from '../../types';

/**
 * 提示词生成配置
 */
export interface PromptGeneratorOptions {
  /** 是否包含质量标签 */
  includeQualityTags?: boolean;
  /** 默认质量标签 */
  defaultQualityTags?: string[];
  /** 是否包含负面提示词 */
  includeNegativePrompt?: boolean;
  /** 默认负面提示词 */
  defaultNegativePrompt?: string[];
}

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: PromptGeneratorOptions = {
  includeQualityTags: true,
  defaultQualityTags: ['8k', 'masterpiece', 'best quality', 'ultra-detailed', 'highly detailed'],
  includeNegativePrompt: false,
  defaultNegativePrompt: ['worst quality', 'low quality', 'blurry', 'distorted', 'ugly'],
};

/**
 * 景别中文映射
 */
const SHOT_TYPE_MAP: Record<ShotType, string> = {
  extreme_long: '大远景',
  long: '远景',
  full: '全景',
  medium: '中景',
  close_up: '近景',
  extreme_close_up: '特写',
};

/**
 * 运镜中文映射
 */
const CAMERA_MOVEMENT_MAP: Record<CameraMovement, string> = {
  static: '静止镜头',
  push: '推镜头',
  pull: '拉镜头',
  pan: '摇镜头',
  tilt: '升降镜头',
  track: '跟镜头',
  crane: '起重机镜头',
  zoom_in: '变焦推',
  zoom_out: '变焦拉',
  dolly_in: '移近',
  dolly_out: '移远',
};

/**
 * 机位角度中文映射
 */
const CAMERA_ANGLE_MAP: Record<CameraAngle, string> = {
  eye_level: '平视',
  high_angle: '俯拍',
  low_angle: '仰拍',
  dutch_angle: '倾斜镜头',
  overhead: '顶拍',
  bird_eye: '鸟瞰',
};

/**
 * 提示词生成服务类
 */
export class PromptGeneratorService {
  private options: PromptGeneratorOptions;

  /**
   * 构造函数
   * @param options - 提示词生成配置
   */
  constructor(options: PromptGeneratorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 从角色资产生成AI生图提示词
   * @param character - 角色数据
   * @param style - 视觉风格（可选）
   * @returns 完整的AI生图提示词
   */
  generateCharacterPrompt(character: ScriptCharacter, style?: string): string {
    const parts: string[] = [];

    parts.push(this.buildStylizedCharacterDescription(character, style));

    if (this.options.includeQualityTags && this.options.defaultQualityTags) {
      parts.push(this.options.defaultQualityTags.join(', '));
    }

    return parts.join(', ');
  }

  /**
   * 构建带风格的角色描述
   * @param character - 角色数据
   * @param style - 视觉风格（可选）
   * @returns 带风格的角色描述
   */
  private buildStylizedCharacterDescription(character: ScriptCharacter, style?: string): string {
    const parts: string[] = [];

    if (style) {
      const stylePrompt = getDefaultStylePrompt(style);
      if (stylePrompt) {
        parts.push(stylePrompt);
      }
    }

    const characterDescription = CharacterPromptBuilder.build(character);
    if (characterDescription) {
      parts.push(characterDescription);
    }

    return parts.join(', ');
  }

  /**
   * 从场景资产生成AI生图提示词
   * @param scene - 场景数据
   * @param style - 视觉风格（可选）
   * @returns 完整的AI生图提示词
   */
  generateScenePrompt(scene: ScriptScene, style?: string): string {
    const parts: string[] = [];

    parts.push(this.buildStylizedSceneDescription(scene, style));

    if (this.options.includeQualityTags && this.options.defaultQualityTags) {
      parts.push(this.options.defaultQualityTags.join(', '));
    }

    return parts.join(', ');
  }

  /**
   * 构建带风格的场景描述
   * @param scene - 场景数据
   * @param style - 视觉风格（可选）
   * @returns 带风格的场景描述
   */
  private buildStylizedSceneDescription(scene: ScriptScene, style?: string): string {
    const parts: string[] = [];

    if (style) {
      const stylePrompt = getDefaultStylePrompt(style);
      if (stylePrompt) {
        parts.push(stylePrompt);
      }
    }

    const sceneDescription = ScenePromptBuilder.build(scene);
    if (sceneDescription) {
      parts.push(sceneDescription);
    }

    return parts.join(', ');
  }

  /**
   * 从分镜生成AI生图/生视频提示词
   * @param shot - 分镜数据
   * @param style - 视觉风格（可选）
   * @returns 完整的AI生图提示词
   */
  generateShotPrompt(shot: Shot, style?: string): string {
    const parts: string[] = [];

    parts.push(this.buildShotDescription(shot));

    if (style) {
      const stylePrompt = getDefaultStylePrompt(style);
      if (stylePrompt) {
        parts.push(stylePrompt);
      }
    }

    if (this.options.includeQualityTags && this.options.defaultQualityTags) {
      parts.push(this.options.defaultQualityTags.join(', '));
    }

    return parts.join(', ');
  }

  /**
   * 从物品资产生成AI生图提示词
   * @param item - 物品数据
   * @param style - 视觉风格（可选）
   * @returns 完整的AI生图提示词
   */
  generateItemPrompt(item: ScriptItem, style?: string): string {
    const parts: string[] = [];

    parts.push(this.buildStylizedItemDescription(item, style));

    if (this.options.includeQualityTags && this.options.defaultQualityTags) {
      parts.push(this.options.defaultQualityTags.join(', '));
    }

    return parts.join(', ');
  }

  /**
   * 构建带风格的物品描述
   * @param item - 物品数据
   * @param style - 视觉风格（可选）
   * @returns 带风格的物品描述
   */
  private buildStylizedItemDescription(item: ScriptItem, style?: string): string {
    const parts: string[] = [];

    if (style) {
      const stylePrompt = getDefaultStylePrompt(style);
      if (stylePrompt) {
        parts.push(stylePrompt);
      }
    }

    const itemDescription = ItemPromptBuilder.build(item);
    if (itemDescription) {
      parts.push(itemDescription);
    }

    return parts.join(', ');
  }

  /**
   * 构建角色描述
   * @param character - 角色数据
   * @returns 角色描述字符串
   */
  private buildCharacterDescription(character: ScriptCharacter): string {
    const parts: string[] = [];

    parts.push(`${character.name}`);

    if (character.gender && character.gender !== 'unknown') {
      parts.push(character.gender === 'male' ? '男性' : '女性');
    }

    if (character.age) {
      parts.push(`${character.age}`);
    }

    if (character.identity) {
      parts.push(`${character.identity}`);
    }

    if (character.appearance) {
      if (character.appearance.height) parts.push(`身高${character.appearance.height}`);
      if (character.appearance.build) parts.push(`${character.appearance.build}`);
      if (character.appearance.face) parts.push(`${character.appearance.face}`);
      if (character.appearance.hair) parts.push(`${character.appearance.hair}`);
      if (character.appearance.clothing) parts.push(`${character.appearance.clothing}`);
    }

    if (character.personality && character.personality.length > 0) {
      parts.push(`性格：${character.personality.join('、')}`);
    }

    if (character.description) {
      parts.push(character.description);
    }

    if (character.visualPrompt) {
      parts.push(character.visualPrompt);
    }

    return parts.join('，');
  }

  /**
   * 构建场景描述
   * @param scene - 场景数据
   * @returns 场景描述字符串
   */
  private buildSceneDescription(scene: ScriptScene): string {
    const parts: string[] = [];

    parts.push(`${scene.name}`);

    if (scene.location) {
      parts.push(`${scene.location}`);
    }

    if (scene.locationType) {
      parts.push(
        scene.locationType === 'indoor' ? '室内' : scene.locationType === 'outdoor' ? '室外' : ''
      );
    }

    if (scene.timeOfDay) {
      parts.push(`${scene.timeOfDay}`);
    }

    if (scene.season) {
      parts.push(`${scene.season}`);
    }

    if (scene.weather) {
      parts.push(`${scene.weather}`);
    }

    if (scene.mood) {
      parts.push(`氛围：${scene.mood}`);
    }

    if (scene.environment) {
      if (scene.environment.architecture) parts.push(`${scene.environment.architecture}`);
      if (scene.environment.furnishings && scene.environment.furnishings.length > 0) {
        parts.push(`陈设：${scene.environment.furnishings.join('、')}`);
      }
      if (scene.environment.lighting) parts.push(`光照：${scene.environment.lighting}`);
      if (scene.environment.colorTone) parts.push(`色调：${scene.environment.colorTone}`);
    }

    if (scene.description) {
      parts.push(scene.description);
    }

    if (scene.visualPrompt) {
      parts.push(scene.visualPrompt);
    }

    return parts.join('，');
  }

  /**
   * 构建分镜描述
   * @param shot - 分镜数据
   * @returns 分镜描述字符串
   */
  private buildShotDescription(shot: Shot): string {
    const parts: string[] = [];

    if (shot.shotType) {
      parts.push(SHOT_TYPE_MAP[shot.shotType]);
    }

    if (shot.cameraMovement) {
      parts.push(CAMERA_MOVEMENT_MAP[shot.cameraMovement]);
    }

    if (shot.cameraAngle) {
      parts.push(CAMERA_ANGLE_MAP[shot.cameraAngle]);
    }

    parts.push(shot.description);

    if (shot.visualDescription) {
      if (shot.visualDescription.composition) {
        parts.push(`构图：${shot.visualDescription.composition}`);
      }
      if (shot.visualDescription.lighting) {
        parts.push(`光影：${shot.visualDescription.lighting}`);
      }
      if (shot.visualDescription.colorPalette) {
        parts.push(`色调：${shot.visualDescription.colorPalette}`);
      }
    }

    if (shot.mood) {
      parts.push(`情绪氛围：${shot.mood}`);
    }

    if (shot.characters && shot.characters.length > 0) {
      parts.push(`角色：${shot.characters.join('、')}`);
    }

    return parts.join('，');
  }

  /**
   * 获取负面提示词
   * @returns 负面提示词字符串
   */
  getNegativePrompt(): string {
    if (!this.options.includeNegativePrompt || !this.options.defaultNegativePrompt) {
      return '';
    }
    return this.options.defaultNegativePrompt.join(', ');
  }

  /**
   * 获取所有可用的风格列表
   * @returns 风格列表
   */
  getAvailableStyles(): Array<{ id: string; name: string }> {
    return Object.entries(DefaultStylePrompt).map(([id, style]) => ({
      id,
      name: style.nameCN,
    }));
  }
}
