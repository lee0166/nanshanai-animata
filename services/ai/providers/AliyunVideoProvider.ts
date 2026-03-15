import {
  IProvider,
  AIResult,
  ImageGenerationRequest,
  ImageGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
  TextGenerationRequest,
  TextGenerationResponse,
  ValidationResult,
  HealthCheckResult,
  ProviderInitConfig,
} from '../core/IProvider';
import { ModelConfig } from '../../../types';
import { storageService } from '../../storage';

/**
 * 阿里云通义万相视频生成 Provider
 * 支持通义万相 Wan2.5 系列视频生成模型
 *
 * API文档: https://help.aliyun.com/document_detail/2865005.html
 */
export class AliyunVideoProvider implements IProvider {
  readonly id = 'aliyun-qianwen-video';
  readonly name = '阿里云通义万相';
  readonly supportedTypes: ('image' | 'video' | 'llm')[] = ['video'];
  readonly defaultProtocol = 'aliyun' as const;

  private apiKey: string = '';
  private baseUrl: string = 'https://dashscope.aliyuncs.com/api/v1';

  async initialize(config: ProviderInitConfig): Promise<void> {
    this.apiKey = config.apiKey || '';
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
  }

  /**
   * 图像生成 - 不支持
   */
  async generateImage(request: ImageGenerationRequest): Promise<AIResult<ImageGenerationResponse>> {
    return {
      success: false,
      error: '阿里百炼视频 Provider 不支持图像生成',
    };
  }

  /**
   * 视频生成
   * 支持文生视频和图生视频
   */
  async generateVideo(request: VideoGenerationRequest): Promise<AIResult<VideoGenerationResponse>> {
    try {
      if (!this.apiKey) {
        return { success: false, error: 'API Key 未配置' };
      }

      const {
        prompt,
        modelId = 'wanx2.5-i2v-plus',
        startImage,
        endImage,
        existingTaskId,
        onTaskId,
        extraParams,
      } = request;

      // 如果有现有任务ID，查询任务状态
      if (existingTaskId) {
        return await this.queryVideoTask(existingTaskId);
      }

      // 构建请求体
      const isI2V = modelId.includes('i2v'); // 图生视频模型

      const body: any = {
        model: modelId,
        input: {
          prompt: prompt,
        },
        parameters: {
          size: extraParams?.aspectRatio || '1280*720',
          duration: extraParams?.duration || 5,
        },
      };

      // 图生视频：添加首帧图片
      if (isI2V && startImage) {
        // 如果是本地路径，读取文件
        let imageBase64 = startImage;
        if (!startImage.startsWith('data:image') && !startImage.startsWith('http')) {
          const file = await storageService.getFile(startImage);
          if (file) {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
              binary += String.fromCharCode(uint8Array[i]);
            }
            const ext = startImage.split('.').pop()?.toLowerCase() || 'png';
            imageBase64 = `data:image/${ext};base64,${btoa(binary)}`;
          }
        }
        body.input.first_frame = imageBase64;
      }

      // 首尾帧生成（如果支持）
      if (endImage) {
        let imageBase64 = endImage;
        if (!endImage.startsWith('data:image') && !endImage.startsWith('http')) {
          const file = await storageService.getFile(endImage);
          if (file) {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
              binary += String.fromCharCode(uint8Array[i]);
            }
            const ext = endImage.split('.').pop()?.toLowerCase() || 'png';
            imageBase64 = `data:image/${ext};base64,${btoa(binary)}`;
          }
        }
        body.input.last_frame = imageBase64;
      }

      console.log(`[AliyunVideoProvider] Creating video task with model: ${modelId}`);

      // 创建任务
      const response = await fetch(`${this.baseUrl}/services/aigc/video-generation/generation`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log(`[AliyunVideoProvider] Task created:`, data);

      if (data.output?.task_id) {
        onTaskId?.(data.output.task_id);
        // 开始轮询任务状态
        return await this.pollVideoTask(data.output.task_id);
      }

      return {
        success: false,
        error: '创建任务失败：未返回任务ID',
      };
    } catch (error) {
      console.error('[AliyunVideoProvider] Video generation error:', error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * 轮询视频生成任务
   */
  private async pollVideoTask(taskId: string): Promise<AIResult<VideoGenerationResponse>> {
    const maxAttempts = 60; // 最多轮询60次（10分钟）
    const interval = 10000; // 每10秒查询一次

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await this.queryVideoTask(taskId);

        if (result.success) {
          return result;
        }

        // 如果任务还在处理中，继续等待
        if (result.metadata?.status === 'PENDING' || result.metadata?.status === 'RUNNING') {
          // 每6次（约1分钟）打印一次日志，减少日志量
          if (attempt % 6 === 0) {
            console.log(
              `[AliyunVideoProvider] Task ${taskId} status: ${result.metadata.status}, waiting... (${Math.floor((attempt * 10) / 60)}m elapsed)`
            );
          }
          await new Promise(resolve => setTimeout(resolve, interval));
          continue;
        }

        // 任务失败
        return result;
      } catch (error) {
        // 只在特定间隔打印错误日志
        if (attempt % 6 === 0 || attempt === maxAttempts - 1) {
          console.error(`[AliyunVideoProvider] Poll error (attempt ${attempt + 1}):`, error);
        }
        if (attempt === maxAttempts - 1) {
          return {
            success: false,
            error: `轮询超时: ${error}`,
          };
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    return {
      success: false,
      error: '视频生成超时',
    };
  }

  /**
   * 查询视频任务状态
   */
  private async queryVideoTask(taskId: string): Promise<AIResult<VideoGenerationResponse>> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.status}`);
    }

    const data = await response.json();
    const status = data.output?.task_status;

    console.log(`[AliyunVideoProvider] Task ${taskId} status: ${status}`);

    if (status === 'SUCCEEDED') {
      const videoUrl = data.output?.video_url;
      if (videoUrl) {
        return {
          success: true,
          data: { videoUrl, taskId, status },
          metadata: { status, taskId },
        };
      }
      return {
        success: false,
        error: '任务成功但未返回视频URL',
        metadata: data,
      };
    }

    if (status === 'FAILED') {
      return {
        success: false,
        error: data.output?.message || '视频生成失败',
        metadata: data,
      };
    }

    // 任务进行中
    return {
      success: false,
      error: '任务处理中',
      metadata: { status, taskId },
    };
  }

  /**
   * 文本生成 - 不支持
   */
  async generateText(request: TextGenerationRequest): Promise<AIResult<TextGenerationResponse>> {
    return {
      success: false,
      error: '阿里百炼视频 Provider 不支持文本生成',
    };
  }

  /**
   * 验证配置有效性
   */
  async validateConfig(config: ModelConfig): Promise<ValidationResult> {
    if (!config.apiKey && !this.apiKey) {
      return { valid: false, error: 'API Key 未配置' };
    }
    return { valid: true };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // 简单的健康检查
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (response.ok) {
        return {
          status: 'healthy',
          latency: Date.now() - start,
          timestamp: Date.now(),
        };
      }

      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        error: `HTTP ${response.status}`,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        error: String(error),
        timestamp: Date.now(),
      };
    }
  }
}
