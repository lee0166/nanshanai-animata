import { Shot, Keyframe, ShotType, CameraMovement } from '../../types';
import { aiService } from '../aiService';

export interface KeyframeSplitParams {
  shot: Shot;
  keyframeCount: number; // 2-4
  characterAssets?: { id: string; name: string; features?: string }[];
  sceneAsset?: { id: string; name: string; features?: string };
  modelConfigId?: string; // 用户选择的LLM模型配置ID
}

export interface KeyframeSplitResult {
  keyframes: Keyframe[];
  error?: string;
}

export class KeyframeEngine {
  /**
   * 使用LLM拆分关键帧
   */
  async splitKeyframes(params: KeyframeSplitParams): Promise<KeyframeSplitResult> {
    try {
      const prompt = this.buildSplitPrompt(params);
      
      const result = await aiService.generateText(
        prompt,
        params.modelConfigId || '', // 使用用户选择的模型
        undefined,
        { temperature: 0.7, maxTokens: 2000 }
      );

      if (!result.success || !result.data) {
        return { keyframes: [], error: result.error || 'LLM调用失败' };
      }

      const keyframes = this.parseKeyframesFromResponse(
        result.data,
        params.shot,
        params.characterAssets,
        params.sceneAsset
      );

      return { keyframes };
    } catch (error) {
      return { keyframes: [], error: String(error) };
    }
  }

  /**
   * 构建拆分提示词
   */
  private buildSplitPrompt(params: KeyframeSplitParams): string {
    const { shot, keyframeCount, characterAssets, sceneAsset } = params;
    
    const characterDesc = characterAssets?.map(c => 
      `- ${c.name}${c.features ? `（${c.features}）` : ''}`
    ).join('\n') || '无';

    const sceneDesc = sceneAsset 
      ? `${sceneAsset.name}${sceneAsset.features ? `（${sceneAsset.features}）` : ''}`
      : '未指定';

    return `你是一位专业的电影分镜师。请将以下分镜描述拆分为${keyframeCount}个连贯的静态关键帧。

【分镜信息】
- 场景：${sceneDesc}
- 景别：${shot.shotType}
- 运镜：${shot.cameraMovement}
- 时长：${shot.duration}秒
- 角色：
${characterDesc}

【画面描述】
${shot.description}

【拆分要求】
1. 按动作时间线排序（起始→过渡→结束）
2. 每个关键帧必须是静态画面，描述具体姿态
3. 保持角色和场景一致性
4. 符合${shot.shotType}景别要求
5. 总时长控制在${shot.duration}秒内

【输出格式】
请严格按以下JSON格式输出，不要包含其他内容：

{
  "keyframes": [
    {
      "sequence": 1,
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

      return data.keyframes.map((kf: any, index: number) => ({
        id: `kf_${shot.id}_${index + 1}`,
        sequence: kf.sequence || index + 1,
        description: kf.description || '',
        prompt: kf.prompt || '',
        duration: kf.duration || Math.ceil(shot.duration / data.keyframes.length),
        references: {
          character: characterAssets?.[0] ? {
            id: characterAssets[0].id,
            name: characterAssets[0].name
          } : undefined,
          scene: sceneAsset ? {
            id: sceneAsset.id,
            name: sceneAsset.name
          } : undefined
        },
        status: 'pending' as const
      }));
    } catch (error) {
      console.error('解析关键帧失败:', error);
      // 返回默认关键帧
      return this.generateDefaultKeyframes(shot, characterAssets, sceneAsset);
    }
  }

  /**
   * 生成默认关键帧（解析失败时使用）
   */
  private generateDefaultKeyframes(
    shot: Shot,
    characterAssets?: { id: string; name: string }[],
    sceneAsset?: { id: string; name: string }
  ): Keyframe[] {
    const count = 3;
    const durationPerFrame = Math.ceil(shot.duration / count);
    
    return Array.from({ length: count }, (_, i) => ({
      id: `kf_${shot.id}_${i + 1}`,
      sequence: i + 1,
      description: `${shot.description}（关键帧${i + 1}）`,
      prompt: `参考角色图：${characterAssets?.[0]?.id || '无'}，参考场景图：${sceneAsset?.id || '无'}；${shot.shotType}，${sceneAsset?.name || ''}，${characterAssets?.[0]?.name || ''}，静态姿态，电影级画质`,
      duration: durationPerFrame,
      references: {
        character: characterAssets?.[0] ? {
          id: characterAssets[0].id,
          name: characterAssets[0].name
        } : undefined,
        scene: sceneAsset ? {
          id: sceneAsset.id,
          name: sceneAsset.name
        } : undefined
      },
      status: 'pending' as const
    }));
  }
}

export const keyframeEngine = new KeyframeEngine();