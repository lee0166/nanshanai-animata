import { Shot, Keyframe, ShotType, CameraMovement, ShotContentType, FrameType } from '../../types';
import { aiService } from '../aiService';

export interface KeyframeSplitParams {
  shot: Shot;
  keyframeCount?: number; // 可选，如果不传则自动根据contentType决定
  characterAssets?: { id: string; name: string; features?: string }[];
  sceneAsset?: { id: string; name: string; features?: string };
  modelConfigId?: string; // 用户选择的LLM模型配置ID
}

export interface KeyframeSplitResult {
  keyframes: Keyframe[];
  contentType: ShotContentType;
  error?: string;
}

export class KeyframeEngine {
  /**
   * 自动检测分镜类型（static/dynamic-simple/dynamic-complex）
   * 基于description中的动作词汇判断
   */
  detectShotType(description: string, cameraMovement: CameraMovement): ShotContentType {
    const desc = description.toLowerCase();

    // 复杂动态关键词（需要3个关键帧）
    const complexKeywords = [
      '打斗',
      '战斗',
      '追逐',
      '奔跑',
      '跳跃',
      '翻滚',
      '爆炸',
      '特效',
      'fight',
      'battle',
      'chase',
      'run',
      'jump',
      'roll',
      'explosion',
      'effect',
      '激烈',
      '快速移动',
      '连续动作',
      '复杂的',
      '激烈地',
    ];

    // 简单动态关键词（需要2个关键帧）
    const simpleKeywords = [
      '走',
      '走动',
      '转身',
      '回头',
      '坐下',
      '站起',
      '开门',
      '关门',
      'walk',
      'turn',
      'sit',
      'stand',
      'open',
      'close',
      'move',
      'enter',
      'exit',
      '走向',
      '离开',
      '靠近',
      '拿起',
      '放下',
    ];

    // 检查复杂动态
    if (complexKeywords.some(kw => desc.includes(kw))) {
      return 'dynamic-complex';
    }

    // 检查简单动态
    if (simpleKeywords.some(kw => desc.includes(kw))) {
      return 'dynamic-simple';
    }

    // 运镜判断：如果有动态运镜（推/拉/摇/移/跟），视为简单动态
    const dynamicMovements: CameraMovement[] = [
      'push',
      'pull',
      'pan',
      'tilt',
      'track',
      'zoom_in',
      'zoom_out',
      'dolly_in',
      'dolly_out',
    ];
    if (dynamicMovements.includes(cameraMovement)) {
      return 'dynamic-simple';
    }

    // 默认为静态
    return 'static';
  }

  /**
   * 根据分镜类型确定关键帧数量
   */
  getKeyframeCount(contentType: ShotContentType): number {
    switch (contentType) {
      case 'static':
        return 1; // 静态只需要1帧（首帧）
      case 'dynamic-simple':
        return 2; // 简单动态需要2帧（首帧+尾帧）
      case 'dynamic-complex':
        return 3; // 复杂动态需要3帧（首帧+中间帧+尾帧）
      default:
        return 2;
    }
  }

  /**
   * 获取关键帧类型（start/middle/end）
   */
  getFrameType(index: number, total: number): FrameType {
    if (index === 0) return 'start';
    if (index === total - 1) return 'end';
    return 'middle';
  }

  /**
   * 智能拆分关键帧
   * 1. 自动检测分镜类型
   * 2. 根据类型确定关键帧数量
   * 3. 使用LLM生成关键帧描述
   */
  async splitKeyframes(params: KeyframeSplitParams): Promise<KeyframeSplitResult> {
    try {
      const { shot } = params;

      // Step 1: 自动检测分镜类型
      const contentType = this.detectShotType(shot.description, shot.cameraMovement);
      console.log(`[KeyframeEngine] Detected shot type: ${contentType}`);

      // Step 2: 确定关键帧数量
      const keyframeCount = params.keyframeCount || this.getKeyframeCount(contentType);
      console.log(`[KeyframeEngine] Keyframe count: ${keyframeCount}`);

      // Step 3: 构建并发送Prompt
      const prompt = this.buildSplitPrompt({ ...params, keyframeCount, contentType });

      const result = await aiService.generateText(prompt, params.modelConfigId || '', undefined, {
        temperature: 0.7,
        maxTokens: 2000,
      });

      if (!result.success || !result.data) {
        return { keyframes: [], contentType, error: result.error || 'LLM调用失败' };
      }

      // Step 4: 解析关键帧
      const keyframes = this.parseKeyframesFromResponse(
        result.data,
        shot,
        keyframeCount,
        params.characterAssets,
        params.sceneAsset
      );

      return { keyframes, contentType };
    } catch (error) {
      console.error('[KeyframeEngine] splitKeyframes error:', error);
      return {
        keyframes: [],
        contentType: 'dynamic-simple',
        error: String(error),
      };
    }
  }

  /**
   * 构建拆分提示词
   */
  private buildSplitPrompt(
    params: KeyframeSplitParams & { keyframeCount: number; contentType: ShotContentType }
  ): string {
    const { shot, keyframeCount, contentType, characterAssets, sceneAsset } = params;

    const characterDesc =
      characterAssets?.map(c => `- ${c.name}${c.features ? `（${c.features}）` : ''}`).join('\n') ||
      '无';

    const sceneDesc = sceneAsset
      ? `${sceneAsset.name}${sceneAsset.features ? `（${sceneAsset.features}）` : ''}`
      : '未指定';

    // 根据分镜类型生成不同的拆分要求
    let splitRequirement = '';
    let frameTypeDesc = '';

    switch (contentType) {
      case 'static':
        splitRequirement = '此分镜为静态画面，只需1个关键帧，描述主要画面构图';
        frameTypeDesc = 'start（首帧）';
        break;
      case 'dynamic-simple':
        splitRequirement = '此分镜为简单动态，需要2个关键帧：起始姿态和结束姿态';
        frameTypeDesc = 'start（首帧）, end（尾帧）';
        break;
      case 'dynamic-complex':
        splitRequirement = '此分镜为复杂动态，需要3个关键帧：起始姿态、中间过渡姿态、结束姿态';
        frameTypeDesc = 'start（首帧）, middle（中间帧）, end（尾帧）';
        break;
    }

    return `你是一位专业的电影分镜师。请将以下分镜描述拆分为${keyframeCount}个连贯的静态关键帧。

【分镜信息】
- 场景：${sceneDesc}
- 景别：${shot.shotType}
- 运镜：${shot.cameraMovement}
- 时长：${shot.duration}秒
- 分镜类型：${contentType}
- 角色：
${characterDesc}

【画面描述】
${shot.description}

【拆分要求】
${splitRequirement}
1. 按动作时间线排序（起始→过渡→结束）
2. 每个关键帧必须是静态画面，描述具体姿态
3. 保持角色和场景一致性
4. 符合${shot.shotType}景别要求
5. 总时长控制在${shot.duration}秒内

【关键帧类型说明】
- frameType字段必须是以下之一：${frameTypeDesc}
- start: 动作起始时的静态画面
- middle: 动作过程中的关键过渡姿态（仅复杂动态需要）
- end: 动作结束时的静态画面

【输出格式】
请严格按以下JSON格式输出，不要包含其他内容：

{
  "keyframes": [
    {
      "sequence": 1,
      "frameType": "start",
      "description": "静态画面描述（具体姿态）",
      "prompt": "图生图提示词，包含角色特征、场景特征、光影风格",
      "duration": 时长秒数
    }
  ]
}

注意：
- description要描述静态姿态，不能有动态动作词
- prompt要适配图生图工具，包含参考图关联信息
- 提示词格式：参考角色图：{角色ID}，参考场景图：{场景ID}；景别，场景，角色（特征），姿态描述，光影风格，电影级画质`;
  }

  /**
   * 解析LLM返回的关键帧
   */
  private parseKeyframesFromResponse(
    response: string,
    shot: Shot,
    keyframeCount: number,
    characterAssets?: { id: string; name: string }[],
    sceneAsset?: { id: string; name: string }
  ): Keyframe[] {
    try {
      // 提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析LLM返回的JSON');
      }

      const data = JSON.parse(jsonMatch[0]);

      if (!data.keyframes || !Array.isArray(data.keyframes)) {
        throw new Error('返回数据格式错误');
      }

      return data.keyframes.map((kf: any, index: number) => {
        const frameType = kf.frameType || this.getFrameType(index, keyframeCount);

        return {
          id: `kf_${shot.id}_${index + 1}`,
          sequence: kf.sequence || index + 1,
          frameType: frameType as FrameType,
          description: kf.description || '',
          prompt: kf.prompt || '',
          duration: kf.duration || Math.ceil(shot.duration / data.keyframes.length),
          references: {
            character: characterAssets?.[0]
              ? {
                  id: characterAssets[0].id,
                  name: characterAssets[0].name,
                }
              : undefined,
            scene: sceneAsset
              ? {
                  id: sceneAsset.id,
                  name: sceneAsset.name,
                }
              : undefined,
          },
          status: 'pending' as const,
        };
      });
    } catch (error) {
      console.error('[KeyframeEngine] 解析关键帧失败:', error);
      // 返回默认关键帧
      return this.generateDefaultKeyframes(shot, keyframeCount, characterAssets, sceneAsset);
    }
  }

  /**
   * 生成默认关键帧（解析失败时使用）
   */
  private generateDefaultKeyframes(
    shot: Shot,
    keyframeCount: number,
    characterAssets?: { id: string; name: string }[],
    sceneAsset?: { id: string; name: string }
  ): Keyframe[] {
    const durationPerFrame = Math.ceil(shot.duration / keyframeCount);

    return Array.from({ length: keyframeCount }, (_, i) => {
      const frameType = this.getFrameType(i, keyframeCount);
      const typeDesc = frameType === 'start' ? '起始' : frameType === 'end' ? '结束' : '过渡';

      return {
        id: `kf_${shot.id}_${i + 1}`,
        sequence: i + 1,
        frameType: frameType,
        description: `${shot.description}（${typeDesc}姿态）`,
        prompt: `参考角色图：${characterAssets?.[0]?.id || '无'}，参考场景图：${sceneAsset?.id || '无'}；${shot.shotType}，${sceneAsset?.name || ''}，${characterAssets?.[0]?.name || ''}，${typeDesc}姿态，电影级画质`,
        duration: durationPerFrame,
        references: {
          character: characterAssets?.[0]
            ? {
                id: characterAssets[0].id,
                name: characterAssets[0].name,
              }
            : undefined,
          scene: sceneAsset
            ? {
                id: sceneAsset.id,
                name: sceneAsset.name,
              }
            : undefined,
        },
        status: 'pending' as const,
      };
    });
  }
}

export const keyframeEngine = new KeyframeEngine();
