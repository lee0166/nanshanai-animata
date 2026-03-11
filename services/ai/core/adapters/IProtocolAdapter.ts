/**
 * 协议适配器接口
 *
 * 设计目的：
 * 1. 统一不同厂商API的调用方式
 * 2. 支持OpenAI兼容协议批量接入
 * 3. 简化新Provider接入成本
 */

/**
 * 适配器请求参数
 */
export interface AdapterRequestParams {
  /** 操作类型 */
  operation: 'chat' | 'image_generation' | 'video_generation' | 'embeddings' | 'models';

  /** 模型ID */
  modelId: string;

  /** 消息列表（用于LLM） */
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;

  /** 提示词（用于图像/视频生成） */
  prompt?: string;

  /** 系统提示词 */
  systemPrompt?: string;

  /** 温度参数 */
  temperature?: number;

  /** 最大Token数 */
  maxTokens?: number;

  /** Top P */
  topP?: number;

  /** 存在惩罚 */
  presencePenalty?: number;

  /** 频率惩罚 */
  frequencyPenalty?: number;

  /** 参考图片 */
  referenceImages?: string[];

  /** 起始图片 */
  startImage?: string;

  /** 结束图片 */
  endImage?: string;

  /** 宽高比 */
  aspectRatio?: string;

  /** 分辨率 */
  resolution?: string;

  /** 生成数量 */
  count?: number;

  /** 引导系数 */
  guidanceScale?: number;

  /** 额外参数 */
  extraParams?: Record<string, any>;
}

/**
 * 适配器响应
 */
export interface AdapterResponse {
  /** 内容 */
  content?: string;

  /** 图像URL列表 */
  imageUrls?: string[];

  /** 视频URL */
  videoUrl?: string;

  /** 任务ID（用于异步任务） */
  taskId?: string;

  /** Token使用情况 */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  /** 模型信息 */
  model?: string;

  /** 原始响应 */
  raw?: any;
}

/**
 * 适配器错误
 */
export interface AdapterError {
  /** 错误代码 */
  code: string;

  /** 错误消息 */
  message: string;

  /** 错误类型 */
  type: ErrorType;

  /** 原始错误 */
  raw?: any;
}

/**
 * 错误类型
 */
export type ErrorType =
  | 'auth_error' // 认证错误
  | 'rate_limit' // 限流
  | 'server_error' // 服务器错误
  | 'request_error' // 请求错误
  | 'timeout' // 超时
  | 'network_error' // 网络错误
  | 'unknown_error'; // 未知错误

/**
 * 协议适配器接口
 */
export interface IProtocolAdapter {
  /**
   * 构建请求体
   */
  buildRequest(params: AdapterRequestParams): unknown;

  /**
   * 解析响应体
   */
  parseResponse(response: unknown): AdapterResponse;

  /**
   * 处理错误
   */
  handleError(error: unknown): AdapterError;

  /**
   * 获取认证头
   */
  getAuthHeaders(apiKey: string): Record<string, string>;

  /**
   * 获取API端点
   */
  getEndpoint(baseUrl: string, operation: string): string;

  /**
   * 检查是否支持特定操作
   */
  supportsOperation?(operation: string): boolean;
}

/**
 * 协议适配器工厂
 */
export class ProtocolAdapterFactory {
  private static adapters = new Map<string, new () => IProtocolAdapter>();

  /**
   * 注册适配器
   */
  static register(protocol: string, adapterClass: new () => IProtocolAdapter): void {
    this.adapters.set(protocol, adapterClass);
  }

  /**
   * 创建适配器实例
   */
  static create(protocol: string): IProtocolAdapter {
    const AdapterClass = this.adapters.get(protocol);
    if (!AdapterClass) {
      throw new Error(`Protocol adapter not found: ${protocol}`);
    }
    return new AdapterClass();
  }

  /**
   * 检查是否支持特定协议
   */
  static supports(protocol: string): boolean {
    return this.adapters.has(protocol);
  }

  /**
   * 获取支持的协议列表
   */
  static getSupportedProtocols(): string[] {
    return Array.from(this.adapters.keys());
  }
}

/**
 * 创建协议适配器
 */
export function createProtocolAdapter(protocol: string): IProtocolAdapter {
  return ProtocolAdapterFactory.create(protocol);
}
