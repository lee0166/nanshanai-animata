/**
 * 专业Prompt模板服务
 *
 * 基于标注标准v1.0深度优化的分镜生成Prompt
 * 提供高质量的影视分镜生成提示词模板系统
 *
 * @module services/dataset/ProfessionalPromptService
 * @version 1.0.0
 */

import type { Shot } from '../../types';
import type { Character, Scene } from './types';

/**
 * 景别Prompt模板
 */
export const SHOT_TYPE_PROMPTS: Record<string, string> = {
  大远景: 'extreme long shot, wide establishing shot, showing vast environment',
  远景: 'long shot, full body and environment, character introduction',
  全景: 'full shot, character from head to toe, complete action',
  中景: 'medium shot, character from knees up, dialogue interaction',
  近景: 'medium close-up, character from chest up, expression emotion',
  特写: 'close-up, character from shoulders up, detail emotion',
  大特写: 'extreme close-up, local detail, eyes hands',
};

/**
 * 拍摄角度Prompt模板
 */
export const CAMERA_ANGLE_PROMPTS: Record<string, string> = {
  平视: 'eye level shot, objective equal',
  俯拍: 'high angle shot, looking down, vulnerable',
  仰拍: 'low angle shot, looking up, powerful authoritative',
  倾斜: 'dutch angle shot, tilted camera, tension unease',
  顶拍: "overhead shot, bird's eye view, god perspective",
};

/**
 * 镜头运动Prompt模板
 */
export const CAMERA_MOVEMENT_PROMPTS: Record<string, string> = {
  静止: 'static shot, locked off',
  推: 'push in, dolly in, emphasize focus',
  拉: 'pull out, dolly out, reveal distance',
  摇: 'pan left right, follow reveal',
  移: 'tilt up down, show height emotion',
  跟: 'tracking shot, follow character movement',
  变焦推: 'zoom in, emphasize detail',
  变焦拉: 'zoom out, reveal environment',
};

/**
 * 光影Prompt模板
 */
export const LIGHTING_PROMPTS: Record<string, string> = {
  清晨: 'soft morning light, warm golden hour, soft shadows',
  正午: 'harsh midday sun, bright overhead light, strong contrast',
  黄昏: 'golden hour sunset, warm orange light, long soft',
  夜晚: 'night scene, dramatic lighting, deep shadows',
  室内: 'soft interior lighting, warm ambient',
  室外: 'natural outdoor lighting',
  悬疑: 'dramatic low key lighting, deep shadows, high contrast',
  浪漫: 'soft warm lighting, gentle glow, romantic',
  恐怖: 'chiaroscuro lighting, deep shadows, eerie',
  温馨: 'warm cozy lighting, soft glow',
};

/**
 * 天气Prompt模板
 */
export const WEATHER_PROMPTS: Record<string, string> = {
  晴天: 'clear sunny day, bright blue sky',
  多云: 'cloudy day, soft diffused light',
  阴天: 'overcast sky, flat lighting',
  小雨: 'light rain, wet streets, reflections',
  大雨: 'heavy rain, pouring rain, dramatic',
  雪天: 'snow falling, white winter, soft',
  雾天: 'foggy misty, atmospheric, mysterious',
  大风: 'windy day, motion blur, dynamic',
};

/**
 * 情绪氛围Prompt模板
 */
export const MOOD_PROMPTS: Record<string, string> = {
  紧张: 'tense atmosphere, high stakes, dramatic',
  温馨: 'warm cozy atmosphere, intimate, gentle',
  悬疑: 'mysterious suspenseful, unresolved tension',
  浪漫: 'romantic dreamy, soft emotional',
  恐怖: 'horrifying eerie, unsettling',
  欢乐: 'joyful celebratory, bright energetic',
  悲伤: 'sad melancholic, somber',
  激动: 'exciting dynamic, high energy',
};

/**
 * 影视风格Prompt模板
 */
export const STYLE_PROMPTS: Record<string, string> = {
  电影质感: 'cinematic lighting, movie still, shot on 35mm film, realistic 8k masterpiece',
  高清实拍: 'photorealistic, raw photo, DSLR, sharp focus, high fidelity 4k texture',
  暗黑哥特: 'gothic style, dark atmosphere, gloomy fog horror theme muted',
  赛博朋克: 'cyberpunk neon lights futuristic rainy street blue purple hue',
  日漫风格: 'anime style 2D animation cel shading vibrant clean',
  新海诚风: 'Makoto Shinkai style beautiful sky lens flare detailed emotional',
  游戏原画: 'game cg splash art highly detailed epic fantasy',
};

/**
 * Prompt模板接口
 */
export interface PromptTemplate {
  id: string;
  name: string;
  nameCN: string;
  description: string;
  category: 'shot' | 'lighting' | 'mood' | 'style' | 'complete';
  prompt: string;
  isDefault?: boolean;
}

/**
 * 完整分镜生成Prompt选项
 */
export interface ShotPromptOptions {
  shotType?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  lighting?: string;
  weather?: string;
  mood?: string;
  style?: string;
  includeQualityTags?: boolean;
  includeNegativePrompt?: boolean;
}

/**
 * 专业Prompt模板服务
 */
export class ProfessionalPromptService {
  private templates: PromptTemplate[] = [];

  constructor() {
    this.initializeTemplates();
  }

  /**
   * 初始化内置模板
   */
  private initializeTemplates(): void {
    // 景别模板
    Object.entries(SHOT_TYPE_PROMPTS).forEach(([name, prompt]) => {
      this.templates.push({
        id: `shot_${name}`,
        name,
        nameCN: name,
        description: `${name}景别提示词`,
        category: 'shot',
        prompt,
        isDefault: true,
      });
    });

    // 光影模板
    Object.entries(LIGHTING_PROMPTS).forEach(([name, prompt]) => {
      this.templates.push({
        id: `lighting_${name}`,
        name,
        nameCN: name,
        description: `${name}光影提示词`,
        category: 'lighting',
        prompt,
        isDefault: true,
      });
    });

    // 情绪模板
    Object.entries(MOOD_PROMPTS).forEach(([name, prompt]) => {
      this.templates.push({
        id: `mood_${name}`,
        name,
        nameCN: name,
        description: `${name}情绪氛围提示词`,
        category: 'mood',
        prompt,
        isDefault: true,
      });
    });

    // 风格模板
    Object.entries(STYLE_PROMPTS).forEach(([name, prompt]) => {
      this.templates.push({
        id: `style_${name}`,
        name,
        nameCN: name,
        description: `${name}风格提示词`,
        category: 'style',
        prompt,
        isDefault: true,
      });
    });
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): PromptTemplate[] {
    return [...this.templates];
  }

  /**
   * 按分类获取模板
   */
  getTemplatesByCategory(category: PromptTemplate['category']): PromptTemplate[] {
    return this.templates.filter(t => t.category === category);
  }

  /**
   * 生成专业分镜Prompt
   */
  generateShotPrompt(
    shot: Partial<Shot>,
    characters: Character[] = [],
    scene?: Partial<Scene>,
    options: ShotPromptOptions = {}
  ): string {
    const parts: string[] = [];

    // 1. 核心画面描述（最优先）
    if (shot.visualDescription) {
      parts.push(this.cleanVisualDescription(shot.visualDescription as string));
    } else if (shot.description) {
      parts.push(shot.description);
    }

    // 2. 景别
    const shotType = options.shotType || shot.shotType;
    if (shotType && SHOT_TYPE_PROMPTS[shotType]) {
      parts.push(SHOT_TYPE_PROMPTS[shotType]);
    }

    // 3. 拍摄角度
    const cameraAngle = options.cameraAngle || shot.cameraAngle;
    if (cameraAngle && CAMERA_ANGLE_PROMPTS[cameraAngle]) {
      parts.push(CAMERA_ANGLE_PROMPTS[cameraAngle]);
    }

    // 4. 镜头运动
    const cameraMovement = options.cameraMovement || shot.cameraMovement;
    if (cameraMovement && CAMERA_MOVEMENT_PROMPTS[cameraMovement]) {
      parts.push(CAMERA_MOVEMENT_PROMPTS[cameraMovement]);
    }

    // 5. 光影
    const lighting = options.lighting || this.inferLighting(scene);
    if (lighting && LIGHTING_PROMPTS[lighting]) {
      parts.push(LIGHTING_PROMPTS[lighting]);
    }

    // 6. 天气
    const weather = options.weather || scene?.weather;
    if (weather && WEATHER_PROMPTS[weather]) {
      parts.push(WEATHER_PROMPTS[weather]);
    }

    // 7. 情绪氛围
    const mood = options.mood || this.inferMood(scene);
    if (mood && MOOD_PROMPTS[mood]) {
      parts.push(MOOD_PROMPTS[mood]);
    }

    // 8. 风格
    const style = options.style || '电影质感';
    if (style && STYLE_PROMPTS[style]) {
      parts.push(STYLE_PROMPTS[style]);
    }

    // 9. 质量标签
    if (options.includeQualityTags !== false) {
      parts.push(
        '8k, masterpiece, best quality, ultra-detailed, highly detailed, cinematic composition'
      );
    }

    return parts.join(', ');
  }

  /**
   * 清理画面描述（移除多余的中文描述，保留视觉关键词）
   */
  private cleanVisualDescription(description: string): string {
    // 保留中文画面描述，但添加英文视觉关键词
    return description;
  }

  /**
   * 从场景推断光影
   */
  private inferLighting(scene?: Partial<Scene>): string | undefined {
    if (!scene) return undefined;

    const time = scene.time;
    const atmosphere = scene.atmosphere;

    if (atmosphere && LIGHTING_PROMPTS[atmosphere]) {
      return atmosphere;
    }

    if (time) {
      const timeMap: Record<string, string> = {
        dawn: '清晨',
        morning: '清晨',
        noon: '正午',
        afternoon: '正午',
        dusk: '黄昏',
        night: '夜晚',
        midnight: '夜晚',
        day: '晴天',
      };
      return timeMap[time];
    }

    return undefined;
  }

  /**
   * 从场景推断情绪
   */
  private inferMood(scene?: Partial<Scene>): string | undefined {
    if (!scene?.atmosphere) return undefined;

    const atmosphere = scene.atmosphere;

    const moodMap: Record<string, string> = {
      warm: '温馨',
      tense: '紧张',
      horror: '恐怖',
      romantic: '浪漫',
      comedy: '欢乐',
      action: '激动',
      mystery: '悬疑',
      sad: '悲伤',
      neutral: '温馨',
    };

    return moodMap[atmosphere];
  }

  /**
   * 生成角色Prompt
   */
  generateCharacterPrompt(
    character: Character,
    style?: string,
    includeQualityTags: boolean = true
  ): string {
    const parts: string[] = [];

    // 角色外观描述
    if (character.appearance) {
      parts.push(character.appearance);
    }

    // 性格（可选，用于增强）
    if (character.personality) {
      parts.push(`personality: ${character.personality}`);
    }

    // 风格
    if (style && STYLE_PROMPTS[style]) {
      parts.push(STYLE_PROMPTS[style]);
    }

    // 质量标签
    if (includeQualityTags) {
      parts.push(
        '8k, masterpiece, best quality, ultra-detailed, character design sheet, professional concept art'
      );
    }

    return parts.join(', ');
  }

  /**
   * 生成场景Prompt
   */
  generateScenePrompt(scene: Scene, style?: string, includeQualityTags: boolean = true): string {
    const parts: string[] = [];

    // 场景描述
    if (scene.description) {
      parts.push(scene.description);
    }

    // 位置
    if (scene.location) {
      parts.push(`location: ${scene.location}`);
    }

    // 光影
    if (scene.lighting) {
      parts.push(`lighting: ${scene.lighting}`);
    }

    // 道具
    if (scene.props) {
      parts.push(`props: ${scene.props}`);
    }

    // 风格
    if (style && STYLE_PROMPTS[style]) {
      parts.push(STYLE_PROMPTS[style]);
    }

    // 质量标签
    if (includeQualityTags) {
      parts.push(
        '8k, masterpiece, best quality, ultra-detailed, environment design, professional concept art'
      );
    }

    return parts.join(', ');
  }

  /**
   * 获取负面提示词
   */
  getNegativePrompt(): string {
    return 'worst quality, low quality, blurry, distorted, ugly, deformed, bad anatomy, bad hands, extra fingers, missing fingers, extra limbs, missing limbs, bad proportions, out of frame, cropped, watermark, signature, username, text, error, jpeg artifacts, duplicate, morbid, mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, dehydrated, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck';
  }

  /**
   * 添加自定义模板
   */
  addTemplate(template: Omit<PromptTemplate, 'isDefault'>): void {
    this.templates.push({
      ...template,
      isDefault: false,
    });
  }

  /**
   * 删除自定义模板
   */
  removeTemplate(templateId: string): boolean {
    const index = this.templates.findIndex(t => t.id === templateId && !t.isDefault);
    if (index !== -1) {
      this.templates.splice(index, 1);
      return true;
    }
    return false;
  }
}

export default ProfessionalPromptService;
