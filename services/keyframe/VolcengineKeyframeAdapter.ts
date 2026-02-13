import { Keyframe } from '../../types';
import { aiService } from '../aiService';

export interface VolcengineKeyframeParams {
  keyframe: Keyframe;
  characterImageBase64?: string;
  sceneImageBase64?: string;
  size?: '1K' | '2K' | '4K';
  modelConfigId?: string; // 用户选择的生图模型配置ID
}

export class VolcengineKeyframeAdapter {
  /**
   * 使用火山引擎生成关键帧图片
   * 支持多图参考（角色+场景）
   */
  async generateKeyframeImage(params: VolcengineKeyframeParams): Promise<Keyframe> {
    const { keyframe, characterImageBase64, sceneImageBase64, size = '2K', modelConfigId } = params;

    keyframe.status = 'generating';

    try {
      // 准备参考图
      const referenceImages: string[] = [];
      if (characterImageBase64) referenceImages.push(characterImageBase64);
      if (sceneImageBase64) referenceImages.push(sceneImageBase64);

      // 调用火山引擎API
      const result = await this.callVolcengineAPI({
        prompt: keyframe.prompt,
        referenceImages,
        size,
        modelConfigId
      });

      if (result.success && result.data) {
        keyframe.generatedImage = {
          id: `generated_${Date.now()}`,
          path: result.data.url || result.data.path,
          prompt: keyframe.prompt,
          modelConfigId: modelConfigId || 'volc-seedream-4.5',
          modelId: result.data.modelId || 'doubao-seedream-4.5',
          referenceImages: [characterImageBase64, sceneImageBase64].filter(Boolean) as string[],
          createdAt: Date.now(),
          width: result.data.width,
          height: result.data.height
        };
        keyframe.status = 'completed';
      } else {
        keyframe.status = 'failed';
        console.error('火山引擎生图失败:', result.error);
      }
    } catch (error) {
      keyframe.status = 'failed';
      console.error('调用火山引擎API异常:', error);
    }

    return keyframe;
  }

  /**
   * 调用火山引擎API
   */
  private async callVolcengineAPI(params: {
    prompt: string;
    referenceImages: string[];
    size: string;
    modelConfigId?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // 使用aiService调用火山引擎
      // 传入用户选择的modelConfigId
      const result = await aiService.generateImage(
        params.prompt,
        params.modelConfigId || '', // 使用用户选择的模型
        params.referenceImages,
        undefined,
        params.size
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * 批量生成关键帧
   */
  async batchGenerate(
    keyframes: Keyframe[],
    getReferenceImages: (keyframe: Keyframe) => Promise<{ character?: string; scene?: string }>,
    modelConfigId?: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Keyframe[]> {
    const results: Keyframe[] = [];

    for (let i = 0; i < keyframes.length; i++) {
      const refs = await getReferenceImages(keyframes[i]);
      const result = await this.generateKeyframeImage({
        keyframe: keyframes[i],
        characterImageBase64: refs.character,
        sceneImageBase64: refs.scene,
        modelConfigId
      });
      results.push(result);
      onProgress?.(i + 1, keyframes.length);
    }

    return results;
  }
}

export const volcengineKeyframeAdapter = new VolcengineKeyframeAdapter();
