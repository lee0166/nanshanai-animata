import { Keyframe, ShotContentType } from '../../types';
import { aiService } from '../aiService';
import { storageService } from '../storage';

export interface VideoGenerationParams {
  keyframes: Keyframe[];
  prompt: string;
  modelConfigId: string;
  projectId: string;
  duration?: number; // 视频时长（秒）
  resolution?: string; // 分辨率
}

export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  localPath?: string;
  error?: string;
}

/**
 * 视频生成服务
 * 集成通义万相 Wan2.5-I2V API
 * 支持首帧/首尾帧视频生成
 */
export class VideoGenerationService {
  /**
   * 生成视频
   * 根据关键帧数量决定使用哪种生成模式
   */
  async generateVideo(params: VideoGenerationParams): Promise<VideoGenerationResult> {
    try {
      const { keyframes, prompt, modelConfigId, projectId } = params;

      console.log('[VideoGenerationService] Starting video generation...');
      console.log(`[VideoGenerationService] Keyframes count: ${keyframes.length}`);

      // 根据关键帧数量确定生成模式
      let result: VideoGenerationResult;

      if (keyframes.length === 1) {
        // 单帧：首帧生成视频
        result = await this.generateFromStartFrame({
          startFrame: keyframes[0],
          prompt,
          modelConfigId,
        });
      } else if (keyframes.length >= 2) {
        // 双帧或以上：使用首尾帧生成视频
        result = await this.generateFromStartEndFrames({
          startFrame: keyframes.find(k => k.frameType === 'start') || keyframes[0],
          endFrame: keyframes.find(k => k.frameType === 'end') || keyframes[keyframes.length - 1],
          prompt,
          modelConfigId,
        });
      } else {
        return {
          success: false,
          error: '关键帧数量不足，至少需要1个关键帧',
        };
      }

      // 如果生成成功，下载并保存视频
      if (result.success && result.videoUrl) {
        const localPath = await this.downloadAndSaveVideo(result.videoUrl, projectId);
        return { ...result, localPath };
      }

      return result;
    } catch (error) {
      console.error('[VideoGenerationService] Video generation failed:', error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * 使用首帧生成视频
   * 适用于静态分镜（1个关键帧）
   */
  private async generateFromStartFrame(params: {
    startFrame: Keyframe;
    prompt: string;
    modelConfigId: string;
  }): Promise<VideoGenerationResult> {
    console.log('[VideoGenerationService] Mode: Start Frame Only');

    try {
      // 获取首帧图片
      const startImage = await this.getKeyframeImageBase64(params.startFrame);
      if (!startImage) {
        return { success: false, error: '首帧图片不存在' };
      }

      // 调用AI服务生成视频
      // 注意：当前接口只支持 startImage 和 endImage，单帧时endImage不传
      const result = await aiService.generateVideo(
        params.prompt,
        params.modelConfigId,
        startImage,
        undefined, // endImage
        undefined, // existingTaskId
        undefined, // onTaskId
        {} // extraParams
      );

      if (result?.success && result.data?.url) {
        return {
          success: true,
          videoUrl: result.data.url,
        };
      }

      return {
        success: false,
        error: result?.error || '视频生成失败',
      };
    } catch (error) {
      return {
        success: false,
        error: `首帧视频生成失败: ${error}`,
      };
    }
  }

  /**
   * 使用首尾帧生成视频
   * 适用于简单动态和复杂动态分镜（2个或更多关键帧）
   */
  private async generateFromStartEndFrames(params: {
    startFrame: Keyframe;
    endFrame: Keyframe;
    prompt: string;
    modelConfigId: string;
  }): Promise<VideoGenerationResult> {
    console.log('[VideoGenerationService] Mode: Start + End Frames');

    try {
      // 获取首尾帧图片
      const startImage = await this.getKeyframeImageBase64(params.startFrame);
      const endImage = await this.getKeyframeImageBase64(params.endFrame);

      if (!startImage) {
        return { success: false, error: '首帧图片不存在' };
      }

      // 调用AI服务生成视频
      const result = await aiService.generateVideo(
        params.prompt,
        params.modelConfigId,
        startImage,
        endImage || undefined, // endImage可能为空
        undefined, // existingTaskId
        undefined, // onTaskId
        {} // extraParams
      );

      if (result?.success && result.data?.url) {
        return {
          success: true,
          videoUrl: result.data.url,
        };
      }

      return {
        success: false,
        error: result?.error || '视频生成失败',
      };
    } catch (error) {
      return {
        success: false,
        error: `首尾帧视频生成失败: ${error}`,
      };
    }
  }

  /**
   * 获取关键帧图片的Base64
   */
  private async getKeyframeImageBase64(keyframe: Keyframe): Promise<string | null> {
    try {
      // 优先使用当前选中的图片
      const currentImage =
        keyframe.generatedImages?.find(img => img.id === keyframe.currentImageId) ||
        keyframe.generatedImage;

      if (!currentImage?.path) {
        return null;
      }

      // 读取文件并转为base64
      const file = await storageService.getFile(currentImage.path);
      if (!file) {
        return null;
      }

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);

      // 检测图片格式
      const ext = currentImage.path.split('.').pop()?.toLowerCase() || 'png';
      return `data:image/${ext};base64,${base64}`;
    } catch (error) {
      console.error('[VideoGenerationService] Failed to get keyframe image:', error);
      return null;
    }
  }

  /**
   * 下载并保存视频
   */
  private async downloadAndSaveVideo(videoUrl: string, projectId: string): Promise<string> {
    try {
      console.log('[VideoGenerationService] Downloading video:', videoUrl);

      // 下载视频
      let blob: Blob;
      try {
        // 尝试使用代理
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(videoUrl)}`;
        const proxyRes = await fetch(proxyUrl);
        if (!proxyRes.ok) throw new Error(`Proxy fetch failed: ${proxyRes.statusText}`);
        blob = await proxyRes.blob();
      } catch (proxyError) {
        // 代理失败，直接下载
        console.log('[VideoGenerationService] Proxy failed, trying direct fetch...');
        const directRes = await fetch(videoUrl);
        if (!directRes.ok) throw new Error(`Direct fetch failed: ${directRes.statusText}`);
        blob = await directRes.blob();
      }

      // 生成文件名
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const filename = `${timestamp}_${random}.mp4`;
      const path = `projects/${projectId}/videos/${filename}`;

      // 保存到本地
      await storageService.saveBinaryFile(path, blob);
      console.log('[VideoGenerationService] Video saved to:', path);

      return path;
    } catch (error) {
      console.error('[VideoGenerationService] Failed to download video:', error);
      // 如果下载失败，返回原始URL
      return videoUrl;
    }
  }

  /**
   * 根据分镜类型获取推荐视频时长
   */
  getRecommendedDuration(contentType: ShotContentType): number {
    switch (contentType) {
      case 'static':
        return 3; // 静态分镜3秒
      case 'dynamic-simple':
        return 5; // 简单动态5秒
      case 'dynamic-complex':
        return 8; // 复杂动态8秒
      default:
        return 5;
    }
  }
}

export const videoGenerationService = new VideoGenerationService();
