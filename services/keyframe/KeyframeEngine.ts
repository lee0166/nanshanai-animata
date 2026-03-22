import { Shot, Keyframe, ShotType, CameraMovement, ShotContentType, FrameType, Script } from '../../types';
import { aiService } from '../aiService';

export interface KeyframeSplitParams {
  shot: Shot;
  keyframeCount?: number; // 可选，如果不传则自动根据contentType决定
  script?: Script;
  characterAssets?: { id: string; name: string; features?: string }[];
  sceneAsset?: { id: string; name: string; features?: string };
  modelConfigId?: string; // 用户选择的LLM模型配置ID
  splitOptions?: {
    includeCameraMovement?: boolean; // 是否包含运镜信息
    includeCharacterDetails?: boolean; // 是否包含角色细节
    includeSceneDetails?: boolean; // 是否包含场景细节
    focusOnAction?: boolean; // 是否专注于动作
    focusOnEmotion?: boolean; // 是否专注于情感表达
  };
  temperature?: number; // LLM生成温度
  maxTokens?: number; // LLM最大 tokens
  negativePrompt?: string;
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
      '说话',
      '交谈',
      '表情',
      'look',
      'speak',
      'talk',
      'express',
      '表情变化',
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
      const { shot, temperature = 0.7, maxTokens = 2000, negativePrompt } = params;

      // Step 1: 自动检测分镜类型
      const contentType = this.detectShotType(shot.description, shot.cameraMovement);
      console.log(`[KeyframeEngine] Detected shot type: ${contentType}`);

      // Step 2: 确定关键帧数量
      const keyframeCount = params.keyframeCount || this.getKeyframeCount(contentType);
      console.log(`[KeyframeEngine] Keyframe count: ${keyframeCount}`);

      // Step 3: 构建并发送Prompt
      const prompt = this.buildSplitPrompt({ ...params, keyframeCount, contentType });

      const result = await aiService.generateText(prompt, params.modelConfigId || '', undefined, {
        temperature,
        maxTokens,
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
        params.sceneAsset,
        negativePrompt,
        params.script
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
    const { shot, keyframeCount, contentType, characterAssets, sceneAsset, splitOptions, script, negativePrompt } = params;
    
    console.log('[DEBUG KeyframeEngine] ========== buildSplitPrompt 被调用 ==========');
    console.log('[DEBUG KeyframeEngine] 接收到的 script:', script);
    console.log('[DEBUG KeyframeEngine] 接收到的 negativePrompt:', negativePrompt);
    console.log('[DEBUG KeyframeEngine] 接收到的 visualStyle:', script?.parseState?.metadata?.visualStyle);
    
    // 读取全局视觉风格
    const visualStyle = script?.parseState?.metadata?.visualStyle;
    
    // 构建视觉风格描述
    let visualStyleDesc = '';
    if (visualStyle) {
      const parts: string[] = [];
      if (visualStyle.artDirection) parts.push(`美术风格：${visualStyle.artDirection}`);
      if (visualStyle.artStyle) parts.push(`艺术风格：${visualStyle.artStyle}`);
      if (visualStyle.colorMood) parts.push(`色彩情绪：${visualStyle.colorMood}`);
      if (visualStyle.cinematography) parts.push(`摄影风格：${visualStyle.cinematography}`);
      if (visualStyle.lightingStyle) parts.push(`光影风格：${visualStyle.lightingStyle}`);
      if (visualStyle.colorPalette && visualStyle.colorPalette.length > 0) {
        parts.push(`主色调：${visualStyle.colorPalette.join('、')}`);
      }
      if (parts.length > 0) {
        visualStyleDesc = parts.join('，');
      }
    }

    const characterDesc =
      characterAssets?.map(c => `- ${c.name}${c.features ? `（${c.features}）` : ''}`).join('\n') ||
      '无';

    const sceneDesc = sceneAsset
      ? `${sceneAsset.name}${sceneAsset.features ? `（${sceneAsset.features}）` : ''}`
      : '未指定';

    // 构建视觉描述信息
    let visualDetails = '';
    if (shot.visualDescription) {
      if (shot.visualDescription.composition) {
        visualDetails += `构图：${shot.visualDescription.composition}，`;
      }
      if (shot.visualDescription.lighting) {
        visualDetails += `光影：${shot.visualDescription.lighting}，`;
      }
      if (shot.visualDescription.colorPalette) {
        visualDetails += `色调：${shot.visualDescription.colorPalette}，`;
      }
      if (shot.visualDescription.characterPositions) {
        const positions = shot.visualDescription.characterPositions
          .map(pos => `${pos.characterId}在${pos.position}，${pos.action}，${pos.expression}`)
          .join('；');
        visualDetails += `角色位置：${positions}，`;
      }
    }

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

    // 获取运镜指导
    const movementGuidance =
      splitOptions?.includeCameraMovement !== false
        ? this.getMovementGuidance(shot.cameraMovement)
        : '运镜信息未指定';

    // 获取叙事结构指导
    const narrativeStructure = this.getNarrativeStructure(keyframeCount, shot.duration);

    // 构建额外的拆分要求
    let additionalRequirements = '';
    if (splitOptions) {
      if (splitOptions.includeCharacterDetails) {
        additionalRequirements += '6. 详细描述角色的表情、服装和动作细节\n';
      }
      if (splitOptions.includeSceneDetails) {
        additionalRequirements += '7. 详细描述场景的环境、道具和氛围\n';
      }
      if (splitOptions.focusOnAction) {
        additionalRequirements += '8. 重点突出动作的连贯性和力量感\n';
      }
      if (splitOptions.focusOnEmotion) {
        additionalRequirements += '9. 重点突出角色的情感表达和内心活动\n';
      }
    }

    // 构建参考图信息
    let referenceInfo = '';
    if (characterAssets && characterAssets.length > 0) {
      referenceInfo += '【参考角色】\n';
      characterAssets.forEach((char, index) => {
        referenceInfo += `角色${index + 1}: ${char.name}${char.features ? `，特征：${char.features}` : ''}\n`;
      });
    }
    if (sceneAsset) {
      referenceInfo += '【参考场景】\n';
      referenceInfo += `场景：${sceneAsset.name}${sceneAsset.features ? `，特征：${sceneAsset.features}` : ''}\n`;
    }

    // 构建视觉风格部分
    let visualStyleSection = '';
    if (visualStyleDesc) {
      visualStyleSection = `【全局视觉风格】
${visualStyleDesc}

`;
    }

    return `你是一位专业的电影分镜师。请将以下分镜描述拆分为${keyframeCount}个连贯的静态关键帧。

【运镜指导】
${movementGuidance}

【叙事结构】
${narrativeStructure}

${visualStyleSection}【参考图信息】
${referenceInfo || '无参考图'}

【连贯性要求】
相邻关键帧的角色姿态变化应该是渐进的，避免大幅度跳跃。保持场景和角色的一致性，确保动作的流畅过渡。

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
6. prompt字段使用英文逗号分隔元素
7. prompt字段必须包含质量标签：masterpiece, 8k, ultra detailed, best quality
8. prompt字段必须融入全局视觉风格（如果有）
9. prompt字段不要包含内部数据库ID（如kf_xxx_1）
${additionalRequirements}

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
- prompt要适配图生图工具，包含质量标签和视觉风格
- prompt格式示例：masterpiece, 8k, ultra detailed, best quality, [角色描述], [场景描述], [视觉风格], [景别描述], [光影描述]`;
  }

  /**
   * 解析LLM返回的关键帧
   */
  private parseKeyframesFromResponse(
    response: string,
    shot: Shot,
    keyframeCount: number,
    characterAssets?: { id: string; name: string }[],
    sceneAsset?: { id: string; name: string },
    negativePrompt?: string,
    script?: Script
  ): Keyframe[] {
    console.log('[DEBUG KeyframeEngine] ========== parseKeyframesFromResponse 被调用 ==========');
    console.log('[DEBUG KeyframeEngine] 接收到的 negativePrompt:', negativePrompt);
    console.log('[DEBUG KeyframeEngine] LLM返回的原始response:', response.substring(0, 500) + '...');
    
    try {
      // 提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析LLM返回的JSON');
      }

      const data = JSON.parse(jsonMatch[0]);
      console.log('[DEBUG KeyframeEngine] 解析后的JSON数据:', data);

      if (!data.keyframes || !Array.isArray(data.keyframes)) {
        throw new Error('返回数据格式错误');
      }

      const keyframes = data.keyframes.map((kf: any, index: number) => {
        const frameType = kf.frameType || this.getFrameType(index, keyframeCount);

        const keyframe = {
          id: `kf_${shot.id}_${index + 1}`,
          sequence: kf.sequence || index + 1,
          frameType: frameType as FrameType,
          description: kf.description || '',
          prompt: kf.prompt || '',
          negativePrompt,
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
        
        console.log(`[DEBUG KeyframeEngine] 解析出的关键帧 ${index + 1}:`, keyframe);
        return keyframe;
      });
      
      console.log('[DEBUG KeyframeEngine] 最终返回的关键帧数组:', keyframes);
      return keyframes;
    } catch (error) {
      console.error('[KeyframeEngine] 解析关键帧失败:', error);
      // 返回默认关键帧
      console.log('[DEBUG KeyframeEngine] 回退到generateDefaultKeyframes');
      return this.generateDefaultKeyframes(shot, keyframeCount, characterAssets, sceneAsset, negativePrompt, script);
    }
  }

  /**
   * 获取运镜指导文本
   */
  private getMovementGuidance(movement: CameraMovement): string {
    const guidanceMap: Record<CameraMovement, string> = {
      static: '固定镜头：关键帧应该体现角色动作的变化，保持画面构图稳定。',
      push: '推镜头：关键帧应该体现景别从大到小的变化。第1帧用较大景别（能看到角色全身），第2帧中等景别（腰部以上），第3帧特写（脸部表情）。',
      pull: '拉镜头：关键帧应该体现景别从小到大的变化。第1帧特写（脸部表情），第2帧中等景别（腰部以上），第3帧较大景别（能看到角色全身）。',
      pan: '摇镜头：关键帧应该体现画面内容的水平移动。第1帧画面左侧内容，第2帧画面中央内容，第3帧画面右侧内容。',
      tilt: '升降镜头：关键帧应该体现画面内容的垂直移动。',
      track:
        '移镜头：关键帧应该体现空间位置的变化。第1帧角色在画面一侧，第2帧角色在画面中央，第3帧角色在画面另一侧。',
      crane: '升降镜头：关键帧应该体现大范围的视角变化。',
      zoom_in: '推镜头：关键帧应该体现景别从大到小的变化。',
      zoom_out: '拉镜头：关键帧应该体现景别从小到大的变化。',
      dolly_in: '推镜头：关键帧应该体现景别从大到小的变化。',
      dolly_out: '拉镜头：关键帧应该体现景别从小到大的变化。',
    };

    return guidanceMap[movement] || guidanceMap.static;
  }

  /**
   * 获取叙事结构指导
   */
  private getNarrativeStructure(count: number, duration: number): string {
    if (count === 2) {
      return `生成2个关键帧：
- 第1帧（动作起点）：${Math.ceil(duration * 0.5)}秒，建立初始姿态
- 第2帧（动作终点）：${Math.ceil(duration * 0.5)}秒，展示最终姿态`;
    }

    if (count === 3) {
      return `生成3个关键帧：
- 第1帧（动作起点）：${Math.ceil(duration * 0.4)}秒，建立初始姿态
- 第2帧（动作顶点/转折）：${Math.ceil(duration * 0.3)}秒，展示最激烈的瞬间或转折点
- 第3帧（动作终点）：${Math.ceil(duration * 0.3)}秒，展示最终稳定姿态`;
    }

    if (count === 4) {
      return `生成4个关键帧：
- 第1帧（动作起点）：${Math.ceil(duration * 0.3)}秒，建立初始姿态
- 第2帧（动作发展）：${Math.ceil(duration * 0.25)}秒，展示动作发展
- 第3帧（动作顶点）：${Math.ceil(duration * 0.25)}秒，展示最激烈的瞬间
- 第4帧（动作终点）：${Math.ceil(duration * 0.2)}秒，展示最终稳定姿态`;
    }

    return '';
  }

  /**
   * 生成默认关键帧（解析失败时使用）
   */
  private generateDefaultKeyframes(
    shot: Shot,
    keyframeCount: number,
    characterAssets?: { id: string; name: string }[],
    sceneAsset?: { id: string; name: string },
    negativePrompt?: string,
    script?: Script
  ): Keyframe[] {
    const durationPerFrame = Math.ceil(shot.duration / keyframeCount);

    // 读取全局视觉风格
    const visualStyle = script?.parseState?.metadata?.visualStyle;
    const stylePrompts: string[] = [];
    if (visualStyle?.artStyle) stylePrompts.push(visualStyle.artStyle);
    if (visualStyle?.cinematography) stylePrompts.push(visualStyle.cinematography);
    if (visualStyle?.colorPalette && Array.isArray(visualStyle.colorPalette)) {
      visualStyle.colorPalette.forEach(color => {
        if (color) stylePrompts.push(color);
      });
    }

    return Array.from({ length: keyframeCount }, (_, i) => {
      const frameType = this.getFrameType(i, keyframeCount);
      const progress = (i + 1) / keyframeCount;
      
      let typeDesc = '';
      let promptSuffix = '';
      let descriptionSuffix = '';
      
      if (frameType === 'start') {
        typeDesc = '起始';
        promptSuffix = ', opening scene, full shot, soft lighting';
        descriptionSuffix = '（开场画面）';
      } else if (frameType === 'end') {
        typeDesc = '结束';
        promptSuffix = ', closing scene, close-up, lasting impression';
        descriptionSuffix = '（收尾画面）';
      } else {
        const middleFrameCount = keyframeCount - 2;
        const middleFrameIndex = i;
        if (middleFrameCount === 1) {
          typeDesc = '过渡';
          promptSuffix = ', transition frame, medium shot, detail focus';
          descriptionSuffix = '（中间过渡）';
        } else {
          const middleProgress = (middleFrameIndex) / (middleFrameCount + 1);
          if (middleProgress < 0.5) {
            typeDesc = '发展';
            promptSuffix = ', developing scene, medium close-up, plot progression';
            descriptionSuffix = '（发展中画面）';
          } else {
            typeDesc = '高潮';
            promptSuffix = ', climax frame, close-up, emotional build-up';
            descriptionSuffix = '（高潮前画面）';
          }
        }
      }

      const shotNumber = shot.shotNumber || shot.sequence;
      
      const promptParts = [
        'masterpiece, 8k, ultra detailed, best quality',
        ...stylePrompts,
        shot.shotType,
        sceneAsset?.name,
        characterAssets?.[0]?.name,
        `${typeDesc} pose`
      ].filter(Boolean);
      
      return {
        id: `kf_${shot.id}_${i + 1}`,
        sequence: i + 1,
        frameType: frameType,
        description: `${shotNumber}-${i + 1} ${shot.description}${descriptionSuffix}`,
        prompt: `${promptParts.join(', ')}${promptSuffix}`,
        negativePrompt,
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
