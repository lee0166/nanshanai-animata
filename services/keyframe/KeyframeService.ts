import { Shot, Keyframe, CharacterAsset, Asset } from '../../types';
import { keyframeEngine, KeyframeSplitParams } from './KeyframeEngine';
import { storageService } from '../storage';
import { aiService } from '../aiService';

export interface SplitKeyframesOptions {
  shot: Shot;
  keyframeCount: number;
  projectId: string;
  characterAssets?: CharacterAsset[];
  sceneAsset?: Asset;
  modelConfigId?: string; // 用户选择的LLM模型配置ID
}

export interface GenerateKeyframeImageOptions {
  keyframe: Keyframe;
  projectId: string;
  characterAsset?: CharacterAsset;
  sceneAsset?: Asset;
  modelConfigId?: string; // 用户选择的生图模型配置ID
}

export class KeyframeService {
  /**
   * 拆分关键帧
   */
  async splitKeyframes(options: SplitKeyframesOptions): Promise<Keyframe[]> {
    const { shot, keyframeCount, characterAssets, sceneAsset, modelConfigId } = options;

    // 准备参数
    const params: KeyframeSplitParams = {
      shot,
      keyframeCount: Math.max(2, Math.min(4, keyframeCount)),
      characterAssets: characterAssets?.map(c => ({
        id: c.id,
        name: c.name,
        features: c.metadata?.features as string
      })),
      sceneAsset: sceneAsset ? {
        id: sceneAsset.id,
        name: sceneAsset.name,
        features: sceneAsset.metadata?.features as string
      } : undefined,
      modelConfigId // 透传用户选择的模型配置ID
    };

    // 调用引擎拆分
    const result = await keyframeEngine.splitKeyframes(params);
    
    if (result.error) {
      throw new Error(result.error);
    }

    return result.keyframes;
  }

  /**
   * 生成关键帧图片
   * 使用火山引擎API，支持多图参考
   */
  async generateKeyframeImage(options: GenerateKeyframeImageOptions): Promise<Keyframe> {
    const { keyframe, projectId, characterAsset, sceneAsset, modelConfigId } = options;

    keyframe.status = 'generating';

    try {
      // 1. 读取参考图片
      const referenceImages: string[] = [];

      if (characterAsset?.currentImageId) {
        const charImage = characterAsset.generatedImages?.find(
          img => img.id === characterAsset.currentImageId
        );
        if (charImage?.path) {
          const base64 = await this.imageToBase64(charImage.path);
          referenceImages.push(base64);
        }
      }

      if (sceneAsset?.filePath) {
        const base64 = await this.imageToBase64(sceneAsset.filePath);
        referenceImages.push(base64);
      }

      // 2. 调用火山引擎API
      // 使用用户选择的modelConfigId
      const generatedImage = await this.callVolcengineAPI({
        prompt: keyframe.prompt,
        referenceImages,
        size: '2K',
        modelConfigId
      });

      keyframe.generatedImage = generatedImage;
      keyframe.status = 'completed';

    } catch (error) {
      console.error('生成关键帧图片失败:', error);
      keyframe.status = 'failed';
    }

    return keyframe;
  }

  /**
   * 批量生成关键帧图片
   */
  async batchGenerateImages(
    keyframes: Keyframe[],
    options: Omit<GenerateKeyframeImageOptions, 'keyframe'>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Keyframe[]> {
    const results: Keyframe[] = [];

    for (let i = 0; i < keyframes.length; i++) {
      const result = await this.generateKeyframeImage({
        ...options,
        keyframe: keyframes[i]
      });
      results.push(result);
      onProgress?.(i + 1, keyframes.length);
    }

    return results;
  }

  /**
   * 图片转Base64
   */
  private async imageToBase64(filePath: string): Promise<string> {
    try {
      // 读取文件
      const file = await storageService.getFile(filePath);
      if (!file) {
        throw new Error(`文件不存在: ${filePath}`);
      }
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // 转为base64
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);
      
      // 检测图片格式（简单判断）
      const ext = filePath.split('.').pop()?.toLowerCase() || 'png';
      return `data:image/${ext};base64,${base64}`;
    } catch (error) {
      console.error('图片转Base64失败:', error);
      throw error;
    }
  }

  /**
   * 调用火山引擎API
   */
  private async callVolcengineAPI(params: {
    prompt: string;
    referenceImages: string[];
    size: string;
    modelConfigId?: string;
  }): Promise<any> {
    try {
      // 使用aiService.generateImage调用生图API
      // 传入用户选择的modelConfigId
      const result = await aiService.generateImage(
        params.prompt,
        params.modelConfigId || '',
        params.referenceImages,
        undefined,
        params.size
      );

      if (result.success && result.data) {
        return {
          id: result.data.id || `generated_${Date.now()}`,
          path: result.data.url || result.data.path,
          prompt: params.prompt,
          modelConfigId: params.modelConfigId,
          modelId: result.data.modelId,
          referenceImages: params.referenceImages,
          createdAt: Date.now(),
          width: result.data.width,
          height: result.data.height
        };
      } else {
        throw new Error(result.error || '生图失败');
      }
    } catch (error) {
      console.error('调用生图API失败:', error);
      throw error;
    }
  }

  /**
   * 更新关键帧提示词
   */
  updateKeyframePrompt(keyframe: Keyframe, newPrompt: string): Keyframe {
    keyframe.prompt = newPrompt;
    return keyframe;
  }

  /**
   * 删除关键帧
   */
  deleteKeyframe(shot: Shot, keyframeId: string): Keyframe[] {
    if (!shot.keyframes) return [];
    
    shot.keyframes = shot.keyframes.filter(kf => kf.id !== keyframeId);
    
    // 重新排序
    shot.keyframes.forEach((kf, index) => {
      kf.sequence = index + 1;
    });
    
    return shot.keyframes;
  }
}

export const keyframeService = new KeyframeService();