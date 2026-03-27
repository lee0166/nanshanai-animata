import {
  CharacterAsset,
  CharacterViewAngle,
  CharacterViews,
  SceneAsset,
  SceneViewType,
  SceneViews,
  ItemAsset,
  ItemViewType,
  ItemViews,
  GeneratedImage,
  ModelConfig,
} from '../../types';
import { aiService } from '../aiService';
import { storageService } from '../storage';

export interface GenerateCharacterViewParams {
  character: CharacterAsset;
  viewAngle: CharacterViewAngle;
  modelConfigId: string;
  modelConfig?: ModelConfig;
  projectId: string;
  customPrompt?: string;
}

export interface GenerateSceneViewParams {
  scene: SceneAsset;
  viewType: SceneViewType;
  modelConfigId: string;
  modelConfig?: ModelConfig;
  projectId: string;
}

export interface GenerateItemViewParams {
  item: ItemAsset;
  viewType: ItemViewType;
  modelConfigId: string;
  modelConfig?: ModelConfig;
  projectId: string;
  customPrompt?: string;
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
      const { character, viewAngle, modelConfigId, modelConfig, projectId, customPrompt } = params;

      console.log(`[AssetReuseService] Generating character view: ${viewAngle}`);

      // 参数验证
      if (!character) {
        return { success: false, error: '角色资产不能为空' };
      }
      if (!viewAngle) {
        return { success: false, error: '视角类型不能为空' };
      }
      if (!modelConfigId) {
        return { success: false, error: '模型配置不能为空' };
      }
      if (!projectId) {
        return { success: false, error: '项目ID不能为空' };
      }

      // 模型能力检查
      if (modelConfig) {
        const capabilities = modelConfig.capabilities || {};
        if (!capabilities.supportsReferenceImage) {
          return { 
            success: false, 
            error: '当前选择的模型不支持参考图功能，请选择支持图生图的模型' 
          };
        }
        if (capabilities.requiresImageInput && !character.currentImageId && !character.generatedImages?.length) {
          return { 
            success: false, 
            error: '该模型需要参考图才能生成，请先在单图管理中生成一张参考图' 
          };
        }
      }

      // 获取参考图（优先使用正面图，其次是当前选中图）
      const referenceImage =
        character.views?.front ||
        character.generatedImages?.find(img => img.id === character.currentImageId) ||
        character.generatedImages?.[0];

      if (!referenceImage) {
        return { 
          success: false, 
          error: '没有可用的参考图，请先在单图管理中生成一张角色正面图作为参考' 
        };
      }

      if (!referenceImage.path) {
        return { success: false, error: '参考图路径无效' };
      }

      // 构建视角提示词（优先使用自定义提示词）
      const viewPrompts: Record<CharacterViewAngle, string> = {
        front: 'front view, facing camera directly',
        side: 'side view, profile view, facing left',
        back: 'back view, from behind, facing away from camera',
        'three-quarter': 'three-quarter view, 45 degree angle',
      };

      const viewPrompt = customPrompt || viewPrompts[viewAngle];

      // 构建生成提示词
      const basePrompt = character.prompt || '';
      const prompt = basePrompt 
        ? `${basePrompt}, ${viewPrompt}, same character, consistent appearance, maintaining all facial features, hairstyle, and clothing details`
        : `${viewPrompt}, character design, consistent appearance`;

      // 读取参考图base64
      let referenceBase64: string;
      try {
        referenceBase64 = await this.imageToBase64(referenceImage.path);
      } catch (error) {
        console.error('[AssetReuseService] Failed to read reference image:', error);
        return { success: false, error: '读取参考图失败，请检查图片文件是否存在' };
      }

      // 调用生图API
      let result;
      try {
        result = await aiService.generateImage(
          prompt,
          modelConfigId,
          [referenceBase64],
          undefined,
          '1024x1024'
        );
      } catch (error) {
        console.error('[AssetReuseService] AI service call failed:', error);
        return { success: false, error: 'AI服务调用失败，请检查网络连接和模型配置' };
      }

      if (!result.success || !result.data) {
        return { success: false, error: result.error || '生成失败，请稍后重试' };
      }

      // 处理返回的图片数据
      const imageData = Array.isArray(result.data) ? result.data[0] : result.data;
      
      if (!imageData) {
        return { success: false, error: '生成结果为空' };
      }

      let generatedImage: GeneratedImage;
      try {
        generatedImage = await this.saveGeneratedImage(
          imageData,
          projectId,
          prompt,
          modelConfigId,
          { viewAngle, stage: 'views' }
        );
      } catch (error) {
        console.error('[AssetReuseService] Failed to save generated image:', error);
        return { success: false, error: '保存生成的图片失败，请检查存储空间' };
      }

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
      const { scene, viewType, modelConfigId, modelConfig, projectId } = params;

      console.log(`[AssetReuseService] Generating scene view: ${viewType}`);

      // 参数验证
      if (!scene) {
        return { success: false, error: '场景资产不能为空' };
      }
      if (!viewType) {
        return { success: false, error: '视角类型不能为空' };
      }
      if (!modelConfigId) {
        return { success: false, error: '模型配置不能为空' };
      }
      if (!projectId) {
        return { success: false, error: '项目ID不能为空' };
      }

      // 模型能力检查
      if (modelConfig) {
        const capabilities = modelConfig.capabilities || {};
        if (!capabilities.supportsReferenceImage) {
          return { 
            success: false, 
            error: '当前选择的模型不支持参考图功能，请选择支持图生图的模型' 
          };
        }
        if (capabilities.requiresImageInput && !scene.currentImageId && !scene.generatedImages?.length) {
          return { 
            success: false, 
            error: '该模型需要参考图才能生成，请先在单图管理中生成一张参考图' 
          };
        }
      }

      // 构建视角提示词
      const viewPrompts: Record<SceneViewType, string> = {
        panorama: 'panoramic view, wide angle, 360 degree view, complete environment',
        wide: 'wide shot, establishing shot, full view of the scene',
        detail: 'detailed view, close-up of key elements, texture details',
        aerial: 'aerial view, bird eye view, top-down perspective, overview',
      };

      // 构建生成提示词
      const basePrompt = scene.prompt || '';
      const prompt = basePrompt
        ? `${basePrompt}, ${viewPrompts[viewType]}, same location, consistent lighting and atmosphere`
        : `${viewPrompts[viewType]}, environment design, detailed background`;

      // 如果有已有场景图，使用作为参考
      const referenceImages: string[] = [];
      if (scene.views?.wide || scene.currentImageId || scene.generatedImages?.[0]) {
        const refImage =
          scene.views?.wide ||
          scene.generatedImages?.find(img => img.id === scene.currentImageId) ||
          scene.generatedImages?.[0];
        if (refImage?.path) {
          try {
            const refBase64 = await this.imageToBase64(refImage.path);
            referenceImages.push(refBase64);
          } catch (error) {
            console.warn('[AssetReuseService] Failed to read reference image, continuing without:', error);
          }
        }
      }

      // 调用生图API
      let result;
      try {
        result = await aiService.generateImage(
          prompt,
          modelConfigId,
          referenceImages.length > 0 ? referenceImages : undefined,
          undefined,
          viewType === 'panorama' ? '1920x1080' : '1024x1024'
        );
      } catch (error) {
        console.error('[AssetReuseService] AI service call failed:', error);
        return { success: false, error: 'AI服务调用失败，请检查网络连接和模型配置' };
      }

      if (!result.success || !result.data) {
        return { success: false, error: result.error || '生成失败，请稍后重试' };
      }

      // 处理返回的图片数据
      const imageData = Array.isArray(result.data) ? result.data[0] : result.data;
      
      if (!imageData) {
        return { success: false, error: '生成结果为空' };
      }

      let generatedImage: GeneratedImage;
      try {
        generatedImage = await this.saveGeneratedImage(
          imageData,
          projectId,
          prompt,
          modelConfigId,
          { viewType, stage: 'views' }
        );
      } catch (error) {
        console.error('[AssetReuseService] Failed to save generated image:', error);
        return { success: false, error: '保存生成的图片失败，请检查存储空间' };
      }

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
    if (!filePath) {
      throw new Error('文件路径不能为空');
    }

    const file = await storageService.getFile(filePath);
    if (!file) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('文件内容为空');
    }

    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    // 安全的扩展名获取
    let ext = 'png';
    try {
      const parts = filePath.split('.');
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1].toLowerCase();
        if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(lastPart)) {
          ext = lastPart === 'jpg' ? 'jpeg' : lastPart;
        }
      }
    } catch (error) {
      console.warn('[AssetReuseService] Failed to extract file extension:', error);
    }
    
    return `data:image/${ext};base64,${base64}`;
  }

  /**
   * 保存生成的图片
   */
  private async saveGeneratedImage(
    imageData: any,
    projectId: string,
    prompt: string,
    modelConfigId: string,
    metadata?: Record<string, any>
  ): Promise<GeneratedImage> {
    if (!imageData) {
      throw new Error('图片数据不能为空');
    }
    if (!projectId) {
      throw new Error('项目ID不能为空');
    }

    const imageUrl = imageData.url || imageData.path;

    // 下载图片
    let localPath = imageUrl || '';
    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      try {
        // 首先尝试代理下载
        let blob: Blob | null = null;
        try {
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(imageUrl)}`;
          console.log(`[AssetReuseService] Downloading via proxy: ${proxyUrl}`);
          const response = await fetch(proxyUrl);
          if (response.ok) {
            blob = await response.blob();
          }
        } catch (proxyError) {
          console.warn('[AssetReuseService] Proxy download failed, trying direct:', proxyError);
        }

        // 如果代理失败，尝试直接下载
        if (!blob) {
          try {
            console.log(`[AssetReuseService] Downloading directly: ${imageUrl}`);
            const response = await fetch(imageUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            blob = await response.blob();
          } catch (directError) {
            console.error('[AssetReuseService] Direct download also failed:', directError);
            throw new Error('图片下载失败，请检查网络连接');
          }
        }

        if (!blob || blob.size === 0) {
          throw new Error('下载的文件为空');
        }

        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        
        // 安全的扩展名判断
        let ext = 'jpg';
        if (blob.type === 'image/webp') {
          ext = 'webp';
        } else if (blob.type === 'image/png') {
          ext = 'png';
        } else if (blob.type === 'image/gif') {
          ext = 'gif';
        }

        const filename = `${timestamp}_${random}.${ext}`;
        const path = `projects/${projectId}/assets/${filename}`;

        console.log(`[AssetReuseService] Saving image to: ${path}`);
        await storageService.saveBinaryFile(path, blob);
        localPath = path;
        console.log(`[AssetReuseService] Image saved successfully`);
      } catch (error) {
        console.error('[AssetReuseService] Download image failed:', error);
        // 如果下载失败，保留原始URL但不抛出错误
        localPath = imageUrl;
      }
    }

    // 安全的返回对象，确保所有必需字段都有值
    return {
      id: imageData.id || `generated_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      path: localPath,
      prompt: prompt || '',
      modelConfigId: modelConfigId || '',
      modelId: imageData.modelId || '',
      referenceImages: [],
      metadata: metadata || {},
      createdAt: Date.now(),
      width: imageData.width || 1024,
      height: imageData.height || 1024,
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

  /**
   * 生成物品多视角
   * 基于物品描述生成不同视角的物品图
   */
  async generateItemView(params: GenerateItemViewParams): Promise<AssetReuseResult> {
    try {
      const { item, viewType, modelConfigId, modelConfig, projectId, customPrompt } = params;

      console.log(`[AssetReuseService] Generating item view: ${viewType}`);

      if (!item) {
        return { success: false, error: '物品资产不能为空' };
      }
      if (!viewType) {
        return { success: false, error: '视角类型不能为空' };
      }
      if (!modelConfigId) {
        return { success: false, error: '模型配置不能为空' };
      }
      if (!projectId) {
        return { success: false, error: '项目ID不能为空' };
      }

      if (modelConfig) {
        const capabilities = modelConfig.capabilities || {};
        if (!capabilities.supportsReferenceImage) {
          return { 
            success: false, 
            error: '当前选择的模型不支持参考图功能，请选择支持图生图的模型' 
          };
        }
        if (capabilities.requiresImageInput && !item.currentImageId && !item.generatedImages?.length) {
          return { 
            success: false, 
            error: '该模型需要参考图才能生成，请先在单图管理中生成一张参考图' 
          };
        }
      }

      const referenceImage =
        item.views?.front ||
        item.generatedImages?.find(img => img.id === item.currentImageId) ||
        item.generatedImages?.[0];

      const viewPrompts: Record<ItemViewType, string> = {
        front: 'front view, facing camera directly, full view of the item',
        side: 'side view, profile view, full view from the side',
        top: 'top view, bird\'s-eye view, looking down from above',
        'three-quarter': 'three-quarter view, 45 degree angle, showing front and side',
      };

      const viewPrompt = customPrompt || viewPrompts[viewType];
      const basePrompt = item.prompt || '';
      const prompt = basePrompt 
        ? `${basePrompt}, ${viewPrompt}, same item, consistent appearance, maintaining all details and textures`
        : `${viewPrompt}, item design, product photography`;

      const referenceImages: string[] = [];
      if (referenceImage?.path) {
        try {
          const refBase64 = await this.imageToBase64(referenceImage.path);
          referenceImages.push(refBase64);
        } catch (error) {
          console.warn('[AssetReuseService] Failed to read reference image for item:', error);
        }
      }

      let result;
      try {
        result = await aiService.generateImage(
          prompt,
          modelConfigId,
          referenceImages.length > 0 ? referenceImages : undefined,
          undefined,
          '1024x1024'
        );
      } catch (error) {
        console.error('[AssetReuseService] AI service call failed for item:', error);
        return { success: false, error: 'AI服务调用失败，请检查网络连接和模型配置' };
      }

      if (!result.success || !result.data) {
        return { success: false, error: result.error || '生成失败，请稍后重试' };
      }

      const imageData = Array.isArray(result.data) ? result.data[0] : result.data;
      
      if (!imageData) {
        return { success: false, error: '生成结果为空' };
      }

      let generatedImage: GeneratedImage;
      try {
        generatedImage = await this.saveGeneratedImage(
          imageData,
          projectId,
          prompt,
          modelConfigId,
          { viewType, stage: 'views' }
        );
      } catch (error) {
        console.error('[AssetReuseService] Failed to save generated item image:', error);
        return { success: false, error: '保存生成的图片失败，请检查存储空间' };
      }

      return { success: true, image: generatedImage };
    } catch (error: any) {
      console.error('[AssetReuseService] Generate item view failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 更新物品的视图
   */
  async updateItemViews(
    item: ItemAsset,
    viewType: ItemViewType,
    image: GeneratedImage
  ): Promise<ItemViews> {
    const views = item.views || {};
    views[viewType] = image;
    return views;
  }
}

export const assetReuseService = new AssetReuseService();
