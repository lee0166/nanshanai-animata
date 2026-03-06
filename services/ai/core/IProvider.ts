import { ModelConfig } from "../../types";

/**
 * Provider插件标准接口
 * 所有Provider插件必须实现此接口
 *
 * 设计原则：
 * 1. 接口稳定 - 不轻易变更，保证向后兼容
 * 2. 最小必需 - 只定义核心方法，扩展通过配置实现
 * 3. 协议无关 - 具体协议由Adapter处理
 */

/**
 * AI生成结果
 */
export interface AIResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * 图像生成请求
 */
export interface ImageGenerationRequest {
  prompt: string;
  modelId: string;
  referenceImages?: string[];
  aspectRatio?: string;
  resolution?: string;
  count?: number;
  guidanceScale?: number;
  extraParams?: Record<string, any>;
}

/**
 * 图像生成响应
 */
export interface ImageGenerationResponse {
  images: Array<{
    url: string;
    width?: number;
    height?: number;
  }>;
  metadata?: Record<string, any>;
}

/**
 * 视频生成请求
 */
export interface VideoGenerationRequest {
  prompt: string;
  modelId: string;
  startImage?: string;
  endImage?: string;
  referenceImages?: string[];
  duration?: number;
  aspectRatio?: string;
  resolution?: string;
  extraParams?: Record<string, any>;
  existingTaskId?: string;
  onTaskId?: (id: string) => void;
}

/**
 * 视频生成响应
 */
export interface VideoGenerationResponse {
  videoUrl?: string;
  taskId?: string;
  status?: string;
  metadata?: Record<string, any>;
}

/**
 * 文本生成请求
 */
export interface TextGenerationRequest {
  prompt: string;
  modelId: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  extraParams?: Record<string, any>;
}

/**
 * 文本生成响应
 */
export interface TextGenerationResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>;
}

/**
 * 配置验证结果
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: Record<string, any>;
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  latency?: number;
  error?: string;
  timestamp: number;
  checks?: {
    apiKey?: { status: "pass" | "fail"; message?: string };
    connectivity?: { status: "pass" | "fail"; latency?: number; message?: string };
    service?: { status: "pass" | "fail"; message?: string };
  };
}

/**
 * Provider初始化配置
 */
export interface ProviderInitConfig {
  /** API密钥 */
  apiKey?: string;

  /** 自定义API端点 */
  baseUrl?: string;

  /** 超时设置（毫秒） */
  timeout?: number;

  /** 重试次数 */
  maxRetries?: number;

  /** 额外配置 */
  options?: Record<string, any>;
}

/**
 * Provider元数据
 */
export interface ProviderMetadata {
  /** 环境限制 */
  environment: "all" | "development" | "production";

  /** 加载优先级（数字越小优先级越高） */
  priority: number;

  /** 依赖的其他Provider */
  dependencies?: string[];

  /** 版本要求 */
  version?: string;
}

/**
 * Provider插件标准接口
 */
export interface IProvider {
  /** Provider唯一标识 */
  readonly id: string;

  /** Provider显示名称 */
  readonly name: string;

  /** 支持的模型类型 */
  readonly supportedTypes: ("image" | "video" | "llm")[];

  /** 默认协议适配器类型 */
  readonly defaultProtocol: "openai" | "volcengine" | "aliyun" | "custom";

  /**
   * 初始化Provider
   * @param config Provider配置
   */
  initialize(config: ProviderInitConfig): Promise<void>;

  /**
   * 图像生成
   */
  generateImage(
    request: ImageGenerationRequest
  ): Promise<AIResult<ImageGenerationResponse>>;

  /**
   * 视频生成
   */
  generateVideo?(
    request: VideoGenerationRequest
  ): Promise<AIResult<VideoGenerationResponse>>;

  /**
   * 文本生成
   */
  generateText?(
    request: TextGenerationRequest
  ): Promise<AIResult<TextGenerationResponse>>;

  /**
   * 验证配置有效性
   */
  validateConfig(config: ModelConfig): Promise<ValidationResult>;

  /**
   * 健康检查
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * 获取可用模型列表
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
   * 销毁Provider（资源清理）
   */
  dispose?(): Promise<void>;
}

/**
 * Provider错误基类
 */
export class ProviderError extends Error {
  constructor(
    public providerId: string,
    message: string,
    public code?: string
  ) {
    super(`[${providerId}] ${message}`);
    this.name = "ProviderError";
  }
}

/**
 * Provider未找到错误
 */
export class ProviderNotFoundError extends ProviderError {
  constructor(providerId: string) {
    super(providerId, `Provider not found: ${providerId}`, "PROVIDER_NOT_FOUND");
    this.name = "ProviderNotFoundError";
  }
}

/**
 * Provider不可用错误
 */
export class ProviderNotAvailableError extends ProviderError {
  constructor(
    providerId: string,
    public reason: string
  ) {
    super(providerId, `Provider not available: ${reason}`, "PROVIDER_NOT_AVAILABLE");
    this.name = "ProviderNotAvailableError";
  }
}
