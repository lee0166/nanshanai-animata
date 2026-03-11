import {
  CharacterAsset,
  CharacterViewAngle,
  CharacterViews,
  SceneAsset,
  SceneViewType,
  SceneViews,
  GeneratedImage,
} from '../../types';
import { aiService } from '../aiService';
import { storageService } from '../storage';

export interface GenerateCharacterViewParams {
  character: CharacterAsset;
  viewAngle: CharacterViewAngle;
  modelConfigId: string;
  projectId: string;
}

export interface GenerateSceneViewParams {
  scene: SceneAsset;
  viewType: SceneViewType;
  modelConfigId: string;
  projectId: string;
}

export interface AssetReuseResult {
  success: boolean;
  image?: GeneratedImage;
  error?: string;
}

/**
 * 资产复用服务
 * 管理角色三视图和场景多视角的生成
 */
export class AssetReuseService {
  /**
   * 生成角色三视图
   * 基于已有角色图生成其他角度的视图
   */
  async generateCharacterView(params: GenerateCharacterViewParams): Promise<AssetReuseResult> {
    try {
      const { character, viewAngle, modelConfigId, projectId } = params;

      console.log(`[AssetReuseService] Generating character view: ${viewAngle}`);

      // 获取参考图（优先使用正面图）
      const referenceImage =
        character.views?.front ||
        character.generatedImages?.find(img => img.id === character.currentImageId);

      if (!referenceImage) {
        return { success: false, error: '没有可用的参考图，请先生成角色正面图' };
      }

      // 构建视角提示词
      const viewPrompts: Record<CharacterViewAngle, string> = {
        front: 'front view, facing camera directly',
        side: 'side view, profile view, facing left',
        back: 'back view, from behind, facing away from camera',
        'three-quarter': 'three-quarter view, 45 degree angle',
      };

      // 构建生成提示词
      const prompt = `${character.prompt}, ${viewPrompts[viewAngle]}, same character, consistent appearance, maintaining all facial features, hairstyle, and clothing details`;

      // 读取参考图base64
      const referenceBase64 = await this.imageToBase64(referenceImage.path);

      // 调用生图API
      const result = await aiService.generateImage(
        prompt,
        modelConfigId,
        [referenceBase64],
        undefined,
        '1024x1024'
      );

      if (!result.success || !result.data) {
        return { success: false, error: result.error || '生成失败' };
      }

      // 处理返回的图片数据
      const imageData = Array.isArray(result.data) ? result.data[0] : result.data;
      const generatedImage = await this.saveGeneratedImage(
        imageData,
        projectId,
        prompt,
        modelConfigId
      );

      return { success: true, image: generatedImage };
    } catch (error) {
      console.error('[AssetReuseService] Generate character view failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 生成场景多视角
   * 基于场景描述生成不同视角的场景图
   */
  async generateSceneView(params: GenerateSceneViewParams): Promise<AssetReuseResult> {
    try {
      const { scene, viewType, modelConfigId, projectId } = params;

      console.log(`[AssetReuseService] Generating scene view: ${viewType}`);

      // 构建视角提示词
      const viewPrompts: Record<SceneViewType, string> = {
        panorama: 'panoramic view, wide angle, 360 degree view, complete environment',
        wide: 'wide shot, establishing shot, full view of the scene',
        detail: 'detailed view, close-up of key elements, texture details',
        aerial: 'aerial view, bird eye view, top-down perspective, overview',
      };

      // 构建生成提示词
      const prompt = `${scene.prompt}, ${viewPrompts[viewType]}, same location, consistent lighting and atmosphere`;

      // 如果有已有场景图，使用作为参考
      const referenceImages: string[] = [];
      if (scene.views?.wide || scene.currentImageId) {
        const refImage =
          scene.views?.wide || scene.generatedImages?.find(img => img.id === scene.currentImageId);
        if (refImage) {
          const refBase64 = await this.imageToBase64(refImage.path);
          referenceImages.push(refBase64);
        }
      }

      // 调用生图API
      const result = await aiService.generateImage(
        prompt,
        modelConfigId,
        referenceImages.length > 0 ? referenceImages : undefined,
        undefined,
        viewType === 'panorama' ? '1920x1080' : '1024x1024'
      );

      if (!result.success || !result.data) {
        return { success: false, error: result.error || '生成失败' };
      }

      // 处理返回的图片数据
      const imageData = Array.isArray(result.data) ? result.data[0] : result.data;
      const generatedImage = await this.saveGeneratedImage(
        imageData,
        projectId,
        prompt,
        modelConfigId
      );

      return { success: true, image: generatedImage };
    } catch (error) {
      console.error('[AssetReuseService] Generate scene view failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 获取角色特定视角的图片
   * 用于分镜生图时作为参考
   */
  getCharacterViewForShot(
    character: CharacterAsset,
    preferredAngle?: CharacterViewAngle
  ): GeneratedImage | undefined {
    // 优先使用指定视角
    if (preferredAngle && character.views?.[preferredAngle]) {
      return character.views[preferredAngle];
    }

    // 其次使用当前选中的图片
    if (character.currentImageId) {
      return character.generatedImages?.find(img => img.id === character.currentImageId);
    }

    // 最后使用任意可用图片
    return character.generatedImages?.[0];
  }

  /**
   * 获取场景特定视角的图片
   * 用于分镜生图时作为参考
   */
  getSceneViewForShot(scene: SceneAsset, shotType?: string): GeneratedImage | undefined {
    // 根据分镜类型选择最佳场景视角
    if (shotType) {
      if (['extreme_long', 'long'].includes(shotType) && scene.views?.panorama) {
        return scene.views.panorama;
      }
      if (shotType === 'full' && scene.views?.wide) {
        return scene.views.wide;
      }
    }

    // 优先使用全景或广角
    if (scene.views?.panorama) return scene.views.panorama;
    if (scene.views?.wide) return scene.views.wide;

    // 使用当前选中的图片
    if (scene.currentImageId) {
      return scene.generatedImages?.find(img => img.id === scene.currentImageId);
    }

    return scene.generatedImages?.[0];
  }

  /**
   * 图片转Base64
   */
  private async imageToBase64(filePath: string): Promise<string> {
    const file = await storageService.getFile(filePath);
    if (!file) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    const ext = filePath.split('.').pop()?.toLowerCase() || 'png';
    return `data:image/${ext};base64,${base64}`;
  }

  /**
   * 保存生成的图片
   */
  private async saveGeneratedImage(
    imageData: any,
    projectId: string,
    prompt: string,
    modelConfigId: string
  ): Promise<GeneratedImage> {
    const imageUrl = imageData.url || imageData.path;

    // 下载图片
    let localPath = imageUrl;
    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      try {
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(imageUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
        const filename = `${timestamp}_${random}.${ext}`;
        const path = `projects/${projectId}/assets/${filename}`;

        await storageService.saveBinaryFile(path, blob);
        localPath = path;
      } catch (error) {
        console.error('[AssetReuseService] Download image failed:', error);
      }
    }

    return {
      id: imageData.id || `generated_${Date.now()}`,
      path: localPath,
      prompt,
      modelConfigId,
      modelId: imageData.modelId,
      referenceImages: [],
      createdAt: Date.now(),
      width: imageData.width,
      height: imageData.height,
    };
  }

  /**
   * 更新角色的视图
   */
  async updateCharacterViews(
    character: CharacterAsset,
    viewAngle: CharacterViewAngle,
    image: GeneratedImage
  ): Promise<CharacterViews> {
    const views = character.views || {};
    views[viewAngle] = image;
    return views;
  }

  /**
   * 更新场景的视图
   */
  async updateSceneViews(
    scene: SceneAsset,
    viewType: SceneViewType,
    image: GeneratedImage
  ): Promise<SceneViews> {
    const views = scene.views || {};
    if (viewType === 'detail') {
      if (!views.detail) views.detail = [];
      views.detail.push(image);
    } else {
      views[viewType] = image;
    }
    return views;
  }
}

export const assetReuseService = new AssetReuseService();
