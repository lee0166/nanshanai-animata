import {
  Shot,
  Keyframe,
  CharacterAsset,
  Asset,
  Script,
  CharacterViewAngle,
  SceneAsset,
  SceneViewType,
} from '../../types';
import { keyframeEngine, KeyframeSplitParams } from './KeyframeEngine';
import { storageService } from '../storage';
import { aiService } from '../aiService';
import { assetReuseService } from '../asset/AssetReuseService';

export interface SplitKeyframesOptions {
  shot: Shot;
  keyframeCount: number;
  projectId: string;
  script?: Script;
  characterAssets?: CharacterAsset[];
  sceneAsset?: Asset;
  modelConfigId?: string; // 用户选择的LLM模型配置ID
  splitOptions?: {
    includeCameraMovement?: boolean;
    includeCharacterDetails?: boolean;
    includeSceneDetails?: boolean;
    focusOnAction?: boolean;
    focusOnEmotion?: boolean;
  };
  temperature?: number;
  maxTokens?: number;
  negativePrompt?: string;
}

export interface BatchSplitKeyframesOptions {
  shots: Shot[];
  keyframeCount: number;
  projectId: string;
  script: Script;
  modelConfigId?: string;
  splitOptions?: {
    includeCameraMovement?: boolean;
    includeCharacterDetails?: boolean;
    includeSceneDetails?: boolean;
    focusOnAction?: boolean;
    focusOnEmotion?: boolean;
  };
  temperature?: number;
  maxTokens?: number;
  negativePrompt?: string;
  concurrencyLimit?: number;
}

export interface GenerateKeyframeImageOptions {
  keyframe: Keyframe;
  projectId: string;
  characterAsset?: CharacterAsset;
  sceneAsset?: Asset;
  modelConfigId?: string; // 用户选择的生图模型配置ID
  size?: string; // 图片尺寸：'1K' | '2K' | '4K'
}

export class KeyframeService {
  /**
   * 拆分关键帧
   */
  async splitKeyframes(options: SplitKeyframesOptions): Promise<Keyframe[]> {
    const {
      shot,
      keyframeCount,
      script,
      characterAssets,
      sceneAsset,
      modelConfigId,
      splitOptions,
      temperature,
      maxTokens,
      negativePrompt,
    } = options;

    console.log(`[KeyframeService] ========== 开始拆分关键帧 ==========`);
    console.log(`[KeyframeService] 分镜ID: ${shot.id}`);
    console.log(`[KeyframeService] 分镜名称: ${shot.sceneName}-镜头${shot.sequence}`);
    console.log(`[KeyframeService] 分镜描述: ${shot.description?.substring(0, 50)}...`);
    console.log(`[KeyframeService] 分镜类型: ${shot.contentType || '未指定'}`);
    console.log(`[KeyframeService] 请求关键帧数量: ${keyframeCount}`);
    console.log(`[KeyframeService] 角色资产数量: ${characterAssets?.length || 0}`);
    console.log(`[KeyframeService] 场景资产: ${sceneAsset?.name || '无'}`);
    console.log(`[KeyframeService] LLM模型配置ID: ${modelConfigId || '未指定'}`);

    // 检测分镜类型（用于日志输出）
    const contentType = keyframeEngine.detectShotType(shot.description, shot.cameraMovement);
    console.log(`[KeyframeService] 检测到分镜类型: ${contentType}`);

    // 准备参数 - 完整传递所有资产信息
    const params: KeyframeSplitParams = {
      shot,
      keyframeCount: Math.max(1, Math.min(10, keyframeCount)), // 合理范围：1-10
      script,
      characterAssets,
      sceneAsset: sceneAsset as SceneAsset | undefined,
      modelConfigId,
      splitOptions,
      temperature,
      maxTokens,
      negativePrompt,
    };

    console.log(`[KeyframeService] 实际关键帧数量: ${params.keyframeCount}`);
    console.log(`[KeyframeService] 调用 KeyframeEngine.splitKeyframes...`);

    // 调用引擎拆分
    const startTime = Date.now();
    const result = await keyframeEngine.splitKeyframes(params);
    const duration = Date.now() - startTime;

    console.log(`[KeyframeService] 关键帧拆分完成，耗时: ${duration}ms`);

    if (result.error) {
      console.error(`[KeyframeService] 拆分失败: ${result.error}`);
      throw new Error(result.error);
    }

    console.log(`[KeyframeService] 成功生成 ${result.keyframes?.length || 0} 个关键帧`);
    result.keyframes?.forEach((kf, idx) => {
      console.log(`[KeyframeService]   关键帧 ${idx + 1}: ${kf.description?.substring(0, 50)}...`);
    });
    console.log(`[KeyframeService] ========== 关键帧拆分完成 ==========`);

    return result.keyframes;
  }

  /**
   * 自动处理静态分镜
   * 为静态分镜自动创建单个关键帧
   */
  async autoProcessStaticShot(shot: Shot, projectId: string): Promise<Keyframe[]> {
    console.log(`[KeyframeService] ========== 自动处理静态分镜 ==========`);
    console.log(`[KeyframeService] 分镜ID: ${shot.id}`);
    console.log(`[KeyframeService] 分镜名称: ${shot.sceneName}-镜头${shot.sequence}`);
    console.log(`[KeyframeService] ========== 完整分镜对象详情 ==========`);
    console.log(`[KeyframeService] shot.contentType (原始值):`, shot.contentType);
    console.log(`[KeyframeService] typeof shot.contentType:`, typeof shot.contentType);
    console.log(`[KeyframeService] shot.contentType === 'static':`, shot.contentType === 'static');
    console.log(`[KeyframeService] shot.description:`, shot.description);
    console.log(`[KeyframeService] shot.cameraMovement:`, shot.cameraMovement);
    console.log(`[KeyframeService] =========================================`);

    // 优先使用分镜自己保存的 contentType，如果没有才实时检测
    let contentType = shot.contentType;
    if (!contentType) {
      console.log(`[KeyframeService] 分镜未保存 contentType，开始实时检测...`);
      contentType = keyframeEngine.detectShotType(shot.description, shot.cameraMovement);
      console.log(`[KeyframeService] 实时检测结果: ${contentType}`);
    } else {
      console.log(`[KeyframeService] 使用分镜保存的 contentType: ${contentType}`);
    }

    console.log(`[KeyframeService] 最终 contentType:`, contentType);
    console.log(`[KeyframeService] contentType === 'static'?`, contentType === 'static');

    if (contentType !== 'static') {
      console.log(`[KeyframeService] ❌ 不是静态分镜，跳过自动处理`);
      console.log(`[KeyframeService] 返回空数组`);
      return [];
    }

    console.log(`[KeyframeService] ✅ 是静态分镜，继续处理`);

    // 获取角色和场景资产
    const assets = await storageService.getAssets(projectId);
    const characterAssets =
      shot.characters
        ?.map(charName => assets.find(a => a.type === 'character' && a.name === charName))
        .filter((a): a is CharacterAsset => !!a) || [];

    const sceneAsset = assets.find(a => a.type === 'scene' && a.name === shot.sceneName);

    console.log(`[KeyframeService] 角色资产数量: ${characterAssets.length}`);
    console.log(`[KeyframeService] 场景资产: ${sceneAsset?.name || '无'}`);

    // 创建静态关键帧
    const staticKeyframe: Keyframe = {
      id: `kf_${shot.id}_1`,
      sequence: 1,
      frameType: 'start',
      description: shot.description,
      prompt: `参考角色图：${characterAssets?.[0]?.id || '无'}，参考场景图：${sceneAsset?.id || '无'}；${shot.shotType}，${sceneAsset?.name || ''}，${characterAssets?.[0]?.name || ''}，静态画面，电影级画质`,
      duration: shot.duration,
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
      status: 'pending',
    };

    console.log(`[KeyframeService] 静态分镜关键帧自动创建完成`);
    console.log(`[KeyframeService] ========== 自动处理完成 ==========`);

    return [staticKeyframe];
  }

  /**
   * 根据分镜描述识别角色出镜角度
   */
  private detectCharacterViewAngle(description: string): CharacterViewAngle | undefined {
    const desc = description.toLowerCase();

    if (
      desc.includes('侧身') ||
      desc.includes('侧面') ||
      desc.includes('profile') ||
      desc.includes('side')
    ) {
      return 'side';
    }
    if (
      desc.includes('背对') ||
      desc.includes('背面') ||
      desc.includes('back view') ||
      desc.includes('from behind')
    ) {
      return 'back';
    }
    if (desc.includes('正面') || desc.includes('facing camera') || desc.includes('front view')) {
      return 'front';
    }
    if (desc.includes('四分之三') || desc.includes('three-quarter') || desc.includes('45 degree')) {
      return 'three-quarter';
    }

    return undefined;
  }

  /**
   * 根据分镜景别选择场景视角
   */
  private selectSceneViewType(shotType: string): SceneViewType | undefined {
    if (shotType === 'extreme_long' || shotType === 'long') {
      return 'panorama';
    }
    if (shotType === 'full') {
      return 'wide';
    }
    if (shotType === 'close_up' || shotType === 'extreme_close_up') {
      return 'detail';
    }

    return undefined;
  }

  /**
   * 生成关键帧图片
   * 使用火山引擎API，支持多图参考，支持视角智能选择
   */
  async generateKeyframeImage(options: GenerateKeyframeImageOptions): Promise<Keyframe> {
    const { keyframe, projectId, characterAsset, sceneAsset, modelConfigId, size = '2K' } = options;

    console.log(`[KeyframeService] ========== 开始生成关键帧图片 ==========`);
    console.log(`[KeyframeService] 关键帧ID: ${keyframe.id}`);
    console.log(`[KeyframeService] 关键帧序号: ${keyframe.sequence}`);
    console.log(`[KeyframeService] 提示词: ${keyframe.prompt?.substring(0, 100)}...`);
    console.log(`[KeyframeService] 项目ID: ${projectId}`);
    console.log(
      `[KeyframeService] 角色资产: ${characterAsset?.name || '无'} (ID: ${characterAsset?.id || 'N/A'})`
    );
    console.log(
      `[KeyframeService] 场景资产: ${sceneAsset?.name || '无'} (ID: ${sceneAsset?.id || 'N/A'})`
    );
    console.log(`[KeyframeService] 生图模型配置ID: ${modelConfigId || '未指定'}`);
    console.log(`[KeyframeService] 图片尺寸: ${size}`);

    keyframe.status = 'generating';

    try {
      // 1. 读取参考图片
      const referenceImages: string[] = [];
      console.log(`[KeyframeService] 准备参考图片...`);

      // 智能选择角色视角
      if (characterAsset) {
        const charAsset = characterAsset as CharacterAsset;
        const preferredAngle = keyframe.description
          ? this.detectCharacterViewAngle(keyframe.description)
          : undefined;
        console.log(`[KeyframeService] 角色视角选择: 优先角度=${preferredAngle}`);

        const charImage = assetReuseService.getCharacterViewForShot(charAsset, preferredAngle);

        if (charImage?.path) {
          console.log(
            `[KeyframeService] 读取角色参考图: ${charImage.path} (视角: ${preferredAngle || '默认'})`
          );
          const base64 = await this.imageToBase64(charImage.path);
          referenceImages.push(base64);
          console.log(`[KeyframeService] 角色参考图转换成功，大小: ${base64.length} 字符`);
        } else {
          console.log(`[KeyframeService] 角色资产未找到可用图片`);
        }
      }

      // 智能选择场景视角
      if (sceneAsset) {
        const scnAsset = sceneAsset as SceneAsset;
        const preferredViewType = (keyframe as any).shotType
          ? this.selectSceneViewType((keyframe as any).shotType)
          : undefined;
        console.log(`[KeyframeService] 场景视角选择: 优先视角=${preferredViewType}`);

        const sceneImage = assetReuseService.getSceneViewForShot(scnAsset, preferredViewType);

        if (sceneImage?.path) {
          console.log(
            `[KeyframeService] 读取场景参考图: ${sceneImage.path} (视角: ${preferredViewType || '默认'})`
          );
          const base64 = await this.imageToBase64(sceneImage.path);
          referenceImages.push(base64);
          console.log(`[KeyframeService] 场景参考图转换成功，大小: ${base64.length} 字符`);
        } else {
          console.log(`[KeyframeService] 场景资产未找到可用图片`);
        }
      }

      console.log(`[KeyframeService] 参考图片总数: ${referenceImages.length}`);

      // 2. 调用生图API
      console.log(`[KeyframeService] 调用生图API...`);
      const apiStartTime = Date.now();
      const generatedImage = await this.callVolcengineAPI({
        prompt: keyframe.prompt,
        referenceImages,
        size,
        modelConfigId,
      });
      const apiDuration = Date.now() - apiStartTime;
      console.log(`[KeyframeService] 生图API调用完成，耗时: ${apiDuration}ms`);

      // 添加到历史记录数组
      if (!keyframe.generatedImages) {
        keyframe.generatedImages = [];
      }
      keyframe.generatedImages.push(generatedImage);

      // 设置当前选中的图片
      keyframe.currentImageId = generatedImage.id;

      // 兼容旧字段
      keyframe.generatedImage = generatedImage;
      keyframe.status = 'completed';

      console.log(`[KeyframeService] 关键帧图片生成成功`);
      console.log(`[KeyframeService]   图片ID: ${generatedImage.id}`);
      console.log(`[KeyframeService]   本地路径: ${generatedImage.localPath || 'N/A'}`);
      console.log(`[KeyframeService] ========== 关键帧图片生成完成 ==========`);
    } catch (error) {
      console.error('[KeyframeService] 生成关键帧图片失败:', error);
      keyframe.status = 'failed';
      console.log(`[KeyframeService] ========== 关键帧图片生成失败 ==========`);
    }

    return keyframe;
  }

  /**
   * 批量生成关键帧图片
   * 支持并行处理，提高效率
   */
  async batchGenerateImages(
    keyframes: Keyframe[],
    options: Omit<GenerateKeyframeImageOptions, 'keyframe'>,
    onProgress?: (completed: number, total: number) => void,
    concurrencyLimit: number = 3 // 默认并发数限制
  ): Promise<Keyframe[]> {
    console.log(`[KeyframeService] ========== 开始批量生成关键帧图片 ==========`);
    console.log(`[KeyframeService] 总关键帧数量: ${keyframes.length}`);
    console.log(`[KeyframeService] 并发限制: ${concurrencyLimit}`);

    const results: Keyframe[] = [];
    const batchStartTime = Date.now();
    let completedCount = 0;

    // 并发控制函数
    const processBatch = async () => {
      const batchSize = Math.min(concurrencyLimit, keyframes.length - completedCount);

      if (batchSize <= 0) return [];

      console.log(`[KeyframeService] 开始处理批次，大小: ${batchSize}`);

      const batchPromises = [];
      for (let i = 0; i < batchSize; i++) {
        const index = completedCount + i;
        const keyframe = keyframes[index];

        console.log(`[KeyframeService] 正在生成第 ${index + 1}/${keyframes.length} 个关键帧...`);

        const promise = this.generateKeyframeImage({
          ...options,
          keyframe,
        }).then(result => {
          console.log(`[KeyframeService] 第 ${index + 1} 个关键帧生成完成，状态: ${result.status}`);
          completedCount++;
          onProgress?.(completedCount, keyframes.length);
          return result;
        });

        batchPromises.push(promise);
      }

      const batchResults = await Promise.all(batchPromises);
      return batchResults;
    };

    // 分批处理
    while (completedCount < keyframes.length) {
      const batchResults = await processBatch();
      results.push(...batchResults);
    }

    const batchDuration = Date.now() - batchStartTime;
    const successCount = results.filter(r => r.status === 'completed').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    console.log(`[KeyframeService] ========== 批量生成完成 ==========`);
    console.log(
      `[KeyframeService] 总耗时: ${batchDuration}ms (${(batchDuration / 1000).toFixed(1)}s)`
    );
    console.log(`[KeyframeService] 成功: ${successCount}/${keyframes.length}`);
    console.log(`[KeyframeService] 失败: ${failedCount}/${keyframes.length}`);
    console.log(`[KeyframeService] ==========================================`);

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
        // 处理不同 provider 返回的数据格式
        // Modelscope 返回数组格式: [{ url: "xxx" }]
        // Volcengine 返回对象格式: { url: "xxx" }
        const imageData = Array.isArray(result.data) ? result.data[0] : result.data;

        console.log('[KeyframeService] imageData from provider:', imageData);

        const imageUrl = imageData.url || imageData.path;

        // 下载图片并保存到本地
        let localPath = imageUrl;
        if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
          try {
            console.log('[KeyframeService] Downloading image from:', imageUrl);

            // 使用代理下载图片（避免CORS问题）
            let blob: Blob;
            try {
              const proxyUrl = `/api/proxy?url=${encodeURIComponent(imageUrl)}`;
              const proxyRes = await fetch(proxyUrl);
              if (!proxyRes.ok) throw new Error(`Proxy fetch failed: ${proxyRes.statusText}`);
              blob = await proxyRes.blob();
            } catch (proxyError) {
              console.log('[KeyframeService] Proxy failed, trying direct fetch...');
              const directRes = await fetch(imageUrl);
              if (!directRes.ok) throw new Error(`Direct fetch failed: ${directRes.statusText}`);
              blob = await directRes.blob();
            }

            // 根据blob类型确定扩展名
            let ext = 'jpg';
            if (blob.type === 'image/webp') ext = 'webp';
            else if (blob.type === 'image/png') ext = 'png';

            // 生成文件名
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8);
            const filename = `${timestamp}_${random}.${ext}`;
            const path = `generated/keyframes/${filename}`;

            // 保存到本地
            await storageService.saveBinaryFile(path, blob);
            console.log('[KeyframeService] Image saved to:', path);

            localPath = path;
          } catch (error) {
            console.error('[KeyframeService] Failed to download image:', error);
            // 如果下载失败，使用原始 URL
            localPath = imageUrl;
          }
        }

        const generatedImage = {
          id: imageData.id || `generated_${Date.now()}`,
          path: localPath,
          prompt: params.prompt,
          modelConfigId: params.modelConfigId,
          modelId: imageData.modelId,
          referenceImages: params.referenceImages,
          createdAt: Date.now(),
          width: imageData.width,
          height: imageData.height,
        };

        console.log('[KeyframeService] generatedImage:', generatedImage);

        return generatedImage;
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
   * 批量拆分关键帧
   * 支持并行处理，提高效率
   */
  async batchSplitKeyframes(
    options: BatchSplitKeyframesOptions,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, Keyframe[]>> {
    const {
      shots,
      keyframeCount,
      projectId,
      script,
      modelConfigId,
      splitOptions,
      temperature,
      maxTokens,
      negativePrompt,
      concurrencyLimit = 3,
    } = options;

    console.log(`[KeyframeService] ========== 开始批量拆分关键帧 ==========`);
    console.log(`[KeyframeService] 总分镜数量: ${shots.length}`);
    console.log(`[KeyframeService] 每个分镜关键帧数量: ${keyframeCount}`);
    console.log(`[KeyframeService] 并发限制: ${concurrencyLimit}`);
    console.log(`[KeyframeService] LLM模型配置ID: ${modelConfigId || '未指定'}`);

    const results = new Map<string, Keyframe[]>();
    const batchStartTime = Date.now();
    let completedCount = 0;

    // 获取所有资产，避免重复调用
    const allAssets = await storageService.getAssets(projectId);

    // 并发控制函数
    const processBatch = async () => {
      const batchSize = Math.min(concurrencyLimit, shots.length - completedCount);

      if (batchSize <= 0) return [];

      console.log(`[KeyframeService] 开始处理批次，大小: ${batchSize}`);

      const batchPromises = [];
      for (let i = 0; i < batchSize; i++) {
        const index = completedCount + i;
        const shot = shots[index];

        console.log(`[KeyframeService] 正在处理第 ${index + 1}/${shots.length} 个分镜...`);
        console.log(`[KeyframeService] 分镜名称: ${shot.sceneName}-镜头${shot.sequence}`);

        const promise = (async () => {
          try {
            // 获取当前分镜的角色和场景资产
            const characterAssets =
              shot.characters
                ?.map(charName =>
                  allAssets.find(a => a.type === 'character' && a.name === charName)
                )
                .filter((a): a is CharacterAsset => !!a) || [];

            const sceneAsset = allAssets.find(a => a.type === 'scene' && a.name === shot.sceneName);

            // 调用拆分方法
            const keyframes = await this.splitKeyframes({
              shot,
              keyframeCount,
              projectId,
              script,
              characterAssets,
              sceneAsset,
              modelConfigId,
              splitOptions,
              temperature,
              maxTokens,
              negativePrompt,
            });

            results.set(shot.id, keyframes);
            return { shotId: shot.id, success: true };
          } catch (error) {
            console.error(`[KeyframeService] 拆分分镜 ${shot.id} 失败:`, error);
            results.set(shot.id, []);
            return { shotId: shot.id, success: false, error: String(error) };
          } finally {
            completedCount++;
            onProgress?.(completedCount, shots.length);
          }
        })();

        batchPromises.push(promise);
      }

      const batchResults = await Promise.all(batchPromises);
      return batchResults;
    };

    // 分批处理
    while (completedCount < shots.length) {
      await processBatch();
    }

    const batchDuration = Date.now() - batchStartTime;
    const successCount = Array.from(results.values()).filter(
      keyframes => keyframes.length > 0
    ).length;
    const failedCount = shots.length - successCount;

    console.log(`[KeyframeService] ========== 批量拆分完成 ==========`);
    console.log(
      `[KeyframeService] 总耗时: ${batchDuration}ms (${(batchDuration / 1000).toFixed(1)}s)`
    );
    console.log(`[KeyframeService] 成功: ${successCount}/${shots.length}`);
    console.log(`[KeyframeService] 失败: ${failedCount}/${shots.length}`);
    console.log(`[KeyframeService] ==========================================`);

    return results;
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
