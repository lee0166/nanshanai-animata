/**
 * Few-Shot Prompt Service - 少样本提示词服务
 *
 * 功能：
 * - 从高质量标注样本库中选择示例
 * - 生成Few-Shot学习Prompt
 * - 支持按故事类型、风格等筛选示例
 *
 * @version 1.0.0
 */

import { getAIGeneratedSamples } from '../dataset/aiGeneratedSamples';
import type { Story, Shot } from '../dataset/types';

/**
 * Few-Shot示例选择策略
 */
export type ExampleSelectionStrategy = 'random' | 'similar' | 'recent' | 'quality';

/**
 * Few-Shot Prompt配置
 */
export interface FewShotPromptOptions {
  /** 示例数量 */
  exampleCount: number;
  /** 选择策略 */
  strategy: ExampleSelectionStrategy;
  /** 目标故事类型（可选） */
  storyType?: string;
  /** 目标风格（可选） */
  filmStyle?: string;
  /** 是否包含完整故事 */
  includeFullStory: boolean;
  /** 是否包含分镜列表 */
  includeShotList: boolean;
  /** 语言 */
  language: 'zh' | 'en';
}

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: FewShotPromptOptions = {
  exampleCount: 3,
  strategy: 'quality',
  includeFullStory: true,
  includeShotList: true,
  language: 'zh',
};

/**
 * Few-Shot示例
 */
export interface FewShotExample {
  story: Story;
  shots: Shot[];
  quality: number;
}

/**
 * Few-Shot Prompt服务类
 */
export class FewShotPromptService {
  private examples: FewShotExample[] = [];
  private options: FewShotPromptOptions;

  constructor(options: Partial<FewShotPromptOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.loadExamples();
  }

  /**
   * 加载高质量标注样本
   */
  private loadExamples(): void {
    const data = getAIGeneratedSamples();
    this.examples = data.stories.map(story => ({
      story,
      shots: story.shots,
      quality: this.estimateQuality(story),
    }));
  }

  /**
   * 估算故事质量
   */
  private estimateQuality(story: Story): number {
    let score = 0;

    // 分镜数量
    if (story.shots.length >= 5) score += 30;
    else if (story.shots.length >= 3) score += 20;
    else score += 10;

    // 角色数量
    if (story.characters.length >= 2) score += 20;
    else if (story.characters.length >= 1) score += 10;

    // 场景数量
    if (story.scenes.length >= 2) score += 20;
    else if (story.scenes.length >= 1) score += 10;

    // 分镜描述长度
    const avgDescriptionLength =
      story.shots.reduce((sum, shot) => sum + (shot.visualDescription?.length || 0), 0) /
      story.shots.length;
    if (avgDescriptionLength >= 100) score += 30;
    else if (avgDescriptionLength >= 50) score += 20;
    else score += 10;

    return Math.min(100, score);
  }

  /**
   * 选择Few-Shot示例
   */
  selectExamples(): FewShotExample[] {
    const candidates = [...this.examples];

    // 按策略筛选
    switch (this.options.strategy) {
      case 'quality':
        candidates.sort((a, b) => b.quality - a.quality);
        break;
      case 'random':
        candidates.sort(() => Math.random() - 0.5);
        break;
      case 'recent':
        candidates.sort(
          (a, b) => (b.story.updatedAt?.getTime() || 0) - (a.story.updatedAt?.getTime() || 0)
        );
        break;
    }

    // 返回指定数量
    return candidates.slice(0, this.options.exampleCount);
  }

  /**
   * 生成Few-Shot Prompt
   */
  generateFewShotPrompt(targetStory?: { title?: string; synopsis?: string }): string {
    const examples = this.selectExamples();
    const parts: string[] = [];

    if (this.options.language === 'zh') {
      parts.push(this.generateChineseIntroduction(targetStory));
    } else {
      parts.push(this.generateEnglishIntroduction(targetStory));
    }

    // 添加示例
    examples.forEach((example, index) => {
      parts.push(this.generateExampleSection(example, index + 1));
    });

    // 添加任务
    if (this.options.language === 'zh') {
      parts.push(this.generateChineseTask());
    } else {
      parts.push(this.generateEnglishTask());
    }

    return parts.join('\n\n');
  }

  /**
   * 生成中文介绍
   */
  private generateChineseIntroduction(targetStory?: { title?: string; synopsis?: string }): string {
    let intro = `请将以下小说/剧本转换为专业的影视分镜脚本。

请参考以下高质量示例的格式和专业程度：

---

`;

    if (targetStory?.title) {
      intro += `【目标故事】
标题：${targetStory.title}
`;
    }
    if (targetStory?.synopsis) {
      intro += `梗概：${targetStory.synopsis}
`;
    }

    return intro;
  }

  /**
   * 生成英文介绍
   */
  private generateEnglishIntroduction(targetStory?: { title?: string; synopsis?: string }): string {
    let intro = `Please convert the following novel/script into a professional storyboard.

Please refer to the following high-quality examples for format and professionalism:

---

`;

    if (targetStory?.title) {
      intro += `[Target Story]
Title: ${targetStory.title}
`;
    }
    if (targetStory?.synopsis) {
      intro += `Synopsis: ${targetStory.synopsis}
`;
    }

    return intro;
  }

  /**
   * 生成示例部分
   */
  private generateExampleSection(example: FewShotExample, index: number): string {
    const parts: string[] = [];

    if (this.options.language === 'zh') {
      parts.push(`【示例${index}】
标题：${example.story.title}
梗概：${example.story.synopsis}
质量评分：${example.quality}/100

`);
    } else {
      parts.push(`[Example ${index}]
Title: ${example.story.title}
Synopsis: ${example.story.synopsis}
Quality Score: ${example.quality}/100

`);
    }

    if (this.options.includeFullStory) {
      parts.push(this.generateStorySection(example.story));
    }

    if (this.options.includeShotList) {
      parts.push(this.generateShotListSection(example.shots));
    }

    parts.push('---\n');

    return parts.join('');
  }

  /**
   * 生成故事部分
   */
  private generateStorySection(story: Story): string {
    const parts: string[] = [];

    if (this.options.language === 'zh') {
      parts.push('角色：');
      story.characters.forEach(char => {
        parts.push(
          `- ${char.name}（${char.type === 'protagonist' ? '主角' : char.type === 'antagonist' ? '反派' : '配角'}）`
        );
        if (char.personality) {
          parts.push(`  性格：${char.personality}`);
        }
        if (char.appearance) {
          parts.push(`  外貌：${char.appearance}`);
        }
      });

      parts.push('\n场景：');
      story.scenes.forEach(scene => {
        parts.push(`- ${scene.name}（${scene.location}）`);
      });
    } else {
      parts.push('Characters:');
      story.characters.forEach(char => {
        parts.push(`- ${char.name} (${char.type})`);
        if (char.personality) {
          parts.push(`  Personality: ${char.personality}`);
        }
        if (char.appearance) {
          parts.push(`  Appearance: ${char.appearance}`);
        }
      });

      parts.push('\nScenes:');
      story.scenes.forEach(scene => {
        parts.push(`- ${scene.name} (${scene.location})`);
      });
    }

    parts.push('\n');
    return parts.join('\n');
  }

  /**
   * 生成分镜列表部分
   */
  private generateShotListSection(shots: Shot[]): string {
    const parts: string[] = [];

    if (this.options.language === 'zh') {
      parts.push('分镜列表：');
    } else {
      parts.push('Shot List:');
    }

    shots.forEach(shot => {
      const shotTypeCN = this.translateShotType(shot.shotType);
      const cameraAngleCN = this.translateCameraAngle(shot.cameraAngle);
      const cameraMovementCN = this.translateCameraMovement(shot.cameraMovement);

      if (this.options.language === 'zh') {
        parts.push(`
分镜${shot.shotNumber}：
- 景别：${shotTypeCN}
- 拍摄角度：${cameraAngleCN}
- 镜头运动：${cameraMovementCN}
- 时长：${shot.duration}秒
- 画面描述：${shot.visualDescription}
`);
      } else {
        parts.push(`
Shot ${shot.shotNumber}:
- Shot Type: ${shot.shotType}
- Camera Angle: ${shot.cameraAngle}
- Camera Movement: ${shot.cameraMovement}
- Duration: ${shot.duration}s
- Visual Description: ${shot.visualDescription}
`);
      }

      if (shot.characters) {
        parts.push(
          this.options.language === 'zh'
            ? `- 出场角色：${shot.characters}`
            : `- Characters: ${shot.characters}`
        );
      }
      if (shot.dialogue) {
        parts.push(
          this.options.language === 'zh'
            ? `- 对话：${shot.dialogue}`
            : `- Dialogue: ${shot.dialogue}`
        );
      }
      if (shot.musicSound) {
        parts.push(
          this.options.language === 'zh'
            ? `- 音乐/音效：${shot.musicSound}`
            : `- Music/Sound: ${shot.musicSound}`
        );
      }
    });

    return parts.join('\n');
  }

  /**
   * 景别翻译
   */
  private translateShotType(shotType: string): string {
    const map: Record<string, string> = {
      extremeLong: '大远景',
      long: '远景',
      full: '全景',
      medium: '中景',
      mediumClose: '中近景',
      close: '特写',
      extremeClose: '大特写',
    };
    return map[shotType] || shotType;
  }

  /**
   * 拍摄角度翻译
   */
  private translateCameraAngle(cameraAngle: string): string {
    const map: Record<string, string> = {
      eyeLevel: '平视',
      low: '仰视',
      high: '俯视',
      bird: '鸟瞰',
      dutch: '斜角',
    };
    return map[cameraAngle] || cameraAngle;
  }

  /**
   * 镜头运动翻译
   */
  private translateCameraMovement(cameraMovement: string): string {
    const map: Record<string, string> = {
      static: '静止',
      push: '推',
      pull: '拉',
      pan: '摇',
      tilt: '移',
      track: '跟',
      zoomIn: '变焦推',
      zoomOut: '变焦拉',
    };
    return map[cameraMovement] || cameraMovement;
  }

  /**
   * 生成中文任务
   */
  private generateChineseTask(): string {
    return `【现在请处理】

请按照上面示例的专业格式，为目标故事生成分镜脚本。

要求：
1. 每个分镜都要包含：景别、拍摄角度、镜头运动、时长、画面描述
2. 画面描述要详细（100-200字），包含光影、色彩、构图等专业元素
3. 景别选择：大远景、远景、全景、中景、近景、特写、大特写
4. 拍摄角度：平视、仰视、俯视、鸟瞰、斜角
5. 镜头运动：静止、推、拉、摇、移、跟、变焦推、变焦拉
6. 分镜数量要适合故事长度（一般3-8个分镜）
7. 符合影视分镜标注标准v1.1

请输出JSON格式，包含：title, synopsis, characters, scenes, shots`;
  }

  /**
   * 生成英文任务
   */
  private generateEnglishTask(): string {
    return `[Now Please Process]

Please generate a storyboard for the target story following the professional format of the examples above.

Requirements:
1. Each shot must include: shot type, camera angle, camera movement, duration, visual description
2. Visual description should be detailed (100-200 words), including professional elements like lighting, color, composition
3. Shot types: extreme long, long, full, medium, close, extreme close
4. Camera angles: eye level, low, high, bird's eye, dutch
5. Camera movements: static, push, pull, pan, tilt, track, zoom in, zoom out
6. Number of shots should fit the story length (typically 3-8 shots)
7. Follow storyboard annotation standard v1.1

Please output JSON format including: title, synopsis, characters, scenes, shots`;
  }

  /**
   * 获取所有示例信息
   */
  getExampleInfo(): Array<{
    id: string;
    title: string;
    shotCount: number;
    quality: number;
  }> {
    return this.examples.map(ex => ({
      id: ex.story.id,
      title: ex.story.title,
      shotCount: ex.shots.length,
      quality: ex.quality,
    }));
  }
}

// 导出单例
export const fewShotPromptService = new FewShotPromptService();
