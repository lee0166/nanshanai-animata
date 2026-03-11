import {
  IProtocolAdapter,
  AdapterRequestParams,
  AdapterResponse,
  AdapterError,
  ErrorType,
  ProtocolAdapterFactory,
} from './IProtocolAdapter';

/**
 * OpenAI兼容协议适配器
 *
 * 适用厂商：阿里百炼、DeepSeek、Kimi、智谱等
 *
 * 特点：
 * 1. 支持标准OpenAI API格式
 * 2. 自动处理消息格式转换
 * 3. 统一的错误处理
 */
export class OpenAIProtocolAdapter implements IProtocolAdapter {
  /**
   * 构建请求体
   */
  buildRequest(params: AdapterRequestParams): unknown {
    switch (params.operation) {
      case 'chat':
        return this.buildChatRequest(params);
      case 'embeddings':
        return this.buildEmbeddingsRequest(params);
      default:
        throw new Error(`Unsupported operation: ${params.operation}`);
    }
  }

  /**
   * 构建聊天请求
   */
  private buildChatRequest(params: AdapterRequestParams): unknown {
    const messages: Array<{ role: string; content: string }> = [];

    // 添加系统提示词
    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt });
    }

    // 添加消息列表或用户提示词
    if (params.messages && params.messages.length > 0) {
      messages.push(...params.messages);
    } else if (params.prompt) {
      messages.push({ role: 'user', content: params.prompt });
    }

    const request: Record<string, any> = {
      model: params.modelId,
      messages,
      temperature: params.temperature ?? 0.3,
      max_tokens: params.maxTokens ?? 4000,
      stream: false,
    };

    // 添加可选参数
    if (params.topP !== undefined) request.top_p = params.topP;
    if (params.presencePenalty !== undefined) request.presence_penalty = params.presencePenalty;
    if (params.frequencyPenalty !== undefined) request.frequency_penalty = params.frequencyPenalty;

    // 合并额外参数
    if (params.extraParams) {
      Object.assign(request, params.extraParams);
    }

    return request;
  }

  /**
   * 构建嵌入请求
   */
  private buildEmbeddingsRequest(params: AdapterRequestParams): unknown {
    return {
      model: params.modelId,
      input: params.prompt,
    };
  }

  /**
   * 解析响应体
   */
  parseResponse(response: unknown): AdapterResponse {
    const data = response as any;

    // 处理错误响应
    if (data.error) {
      throw new Error(data.error.message || 'Unknown error');
    }

    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      model: data.model,
      raw: data,
    };
  }

  /**
   * 处理错误
   */
  handleError(error: unknown): AdapterError {
    const err = error as any;

    // 提取错误信息
    const errorMessage = err.error?.message || err.message || String(error);
    const errorCode = err.error?.code || 'unknown_error';
    const statusCode = err.status || err.statusCode;

    return {
      code: errorCode,
      message: errorMessage,
      type: this.classifyError(statusCode, errorCode),
      raw: err,
    };
  }

  /**
   * 分类错误类型
   */
  private classifyError(statusCode: number | undefined, errorCode: string): ErrorType {
    // 根据状态码分类
    if (statusCode === 401) return 'auth_error';
    if (statusCode === 429) return 'rate_limit';
    if (statusCode && statusCode >= 500) return 'server_error';
    if (statusCode && statusCode >= 400) return 'request_error';

    // 根据错误代码分类
    if (errorCode.includes('auth')) return 'auth_error';
    if (errorCode.includes('rate') || errorCode.includes('limit')) return 'rate_limit';
    if (errorCode.includes('timeout')) return 'timeout';
    if (errorCode.includes('network')) return 'network_error';

    return 'unknown_error';
  }

  /**
   * 获取认证头
   */
  getAuthHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
  }

  /**
   * 获取API端点
   */
  getEndpoint(baseUrl: string, operation: string): string {
    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

    const endpoints: Record<string, string> = {
      chat: '/chat/completions',
      embeddings: '/embeddings',
      models: '/models',
    };

    const path = endpoints[operation];
    if (!path) {
      throw new Error(`Unsupported operation: ${operation}`);
    }

    return `${normalizedBaseUrl}${path}`;
  }

  /**
   * 检查是否支持特定操作
   */
  supportsOperation(operation: string): boolean {
    return ['chat', 'embeddings', 'models'].includes(operation);
  }
}

// 注册到工厂
ProtocolAdapterFactory.register('openai', OpenAIProtocolAdapter);
