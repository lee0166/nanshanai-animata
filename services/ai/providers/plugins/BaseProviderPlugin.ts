import {
  IProvider,
  AIResult,
  ImageGenerationRequest,
  ImageGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
  TextGenerationRequest,
  TextGenerationResponse,
  ProviderInitConfig,
  ValidationResult,
  HealthCheckResult,
} from '../../core/IProvider';
import { ModelConfig } from '@/types';
import { storageService } from '@/services/storage';

/**
 * Provider插件基类
 *
 * 提供通用功能：
 * 1. HTTP请求处理（含代理支持）
 * 2. 图片加载和Base64转换
 * 3. API密钥管理
 * 4. 超时控制
 */
export abstract class BaseProviderPlugin implements IProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly supportedTypes: ('image' | 'video' | 'llm')[];
  abstract readonly defaultProtocol: 'openai' | 'volcengine' | 'aliyun' | 'custom';

  protected config: ProviderInitConfig = {};

  /**
   * 初始化Provider
   */
  async initialize(config: ProviderInitConfig): Promise<void> {
    this.config = config;
  }

  /**
   * 图像生成 - 可选实现
   */
  generateImage?(request: ImageGenerationRequest): Promise<AIResult<ImageGenerationResponse>>;

  /**
   * 视频生成 - 可选实现
   */
  generateVideo?(request: VideoGenerationRequest): Promise<AIResult<VideoGenerationResponse>>;

  /**
   * 文本生成 - 可选实现
   */
  generateText?(request: TextGenerationRequest): Promise<AIResult<TextGenerationResponse>>;

  /**
   * 验证配置有效性 - 子类必须实现
   */
  abstract validateConfig(config: ModelConfig): Promise<ValidationResult>;

  /**
   * 健康检查 - 可选实现
   */
  async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: 'unknown',
      timestamp: Date.now(),
    };
  }

  /**
   * 获取可用模型列表 - 可选实现
   */
  listModels?(): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      capabilities?: Record<string, any>;
    }>
  >;

  /**
   * 销毁Provider - 可选实现
   */
  async dispose?(): Promise<void> {
    // 默认空实现
  }

  /**
   * 获取API密钥
   */
  protected getApiKey(config: ModelConfig): string {
    const key = config.apiKey || this.config.apiKey;
    if (!key) {
      throw new Error(`API Key is missing for provider: ${this.id}`);
    }
    return key;
  }

  /**
   * 获取基础URL
   */
  protected getBaseUrl(config?: ModelConfig): string {
    return config?.apiUrl || this.config.baseUrl || '';
  }

  /**
   * 加载Blob为Base64
   */
  protected async loadBlobAsBase64(urlOrPath: string): Promise<string | null> {
    if (urlOrPath.startsWith('data:')) return urlOrPath;

    try {
      let blob: Blob;
      if (urlOrPath.startsWith('http')) {
        const res = await this.makeRequest(urlOrPath);
        blob = await res.blob();
      } else {
        const storageUrl = await storageService.getAssetUrl(urlOrPath);
        if (!storageUrl) return null;
        const res = await fetch(storageUrl);
        blob = await res.blob();
      }
      return await this.blobToBase64DataUri(blob);
    } catch (e) {
      console.error('[BaseProviderPlugin] Failed to load blob as base64', e);
      return null;
    }
  }

  /**
   * Blob转Base64 Data URI
   */
  protected blobToBase64DataUri(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 通用HTTP请求
   *
   * 开发环境通过Vite代理避免CORS问题
   */
  protected async makeRequest(
    url: string,
    options: RequestInit = {},
    timeout: number = 60000
  ): Promise<Response> {
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const shouldUseProxy = (import.meta as any).env?.DEV || isLocalhost;

    console.log(
      `[BaseProviderPlugin] Requesting: ${url}, Mode: ${
        (import.meta as any).env?.DEV ? 'DEV' : 'PROD'
      }, Localhost: ${isLocalhost}`
    );

    // 创建AbortController用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`[BaseProviderPlugin] Request timeout after ${timeout}ms: ${url}`);
      controller.abort();
    }, timeout);

    try {
      let response: Response;

      if (shouldUseProxy) {
        const proxyUrl = '/api/universal-proxy';
        const headers = new Headers(options.headers || {});

        // 避免重复设置X-Target-URL
        if (!headers.has('X-Target-URL')) {
          headers.set('X-Target-URL', url);
        }

        console.log(`[BaseProviderPlugin] Using Proxy: ${proxyUrl} -> ${url}`);
        response = await fetch(proxyUrl, {
          ...options,
          headers,
          signal: controller.signal,
        });
      } else {
        // 生产环境直接请求
        response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);
      console.log(
        `[BaseProviderPlugin] Response received: ${response.status} ${response.statusText}`
      );
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error(`[BaseProviderPlugin] Request aborted (timeout): ${url}`);
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      console.error(`[BaseProviderPlugin] Request failed: ${url}`, error);
      throw error;
    }
  }

  /**
   * 构建标准错误响应
   */
  protected createErrorResult(error: unknown): AIResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `[${this.id}] ${message}`,
    };
  }

  /**
   * 构建标准成功响应
   */
  protected createSuccessResult<T>(data: T, metadata?: Record<string, any>): AIResult<T> {
    return {
      success: true,
      data,
      metadata,
    };
  }
}
