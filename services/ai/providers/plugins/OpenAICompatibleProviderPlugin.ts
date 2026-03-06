import { BaseProviderPlugin } from "./BaseProviderPlugin";
import {
  AIResult,
  TextGenerationRequest,
  TextGenerationResponse,
  ValidationResult,
  HealthCheckResult,
} from "../../core/IProvider";
import {
  createProtocolAdapter,
  OpenAIProtocolAdapter,
} from "../../core/adapters";
import { ModelConfig } from "../../../types";

/**
 * OpenAI兼容Provider插件
 *
 * 适用于：阿里百炼、DeepSeek、Kimi、智谱等OpenAI兼容API
 *
 * 特点：
 * 1. 使用OpenAIProtocolAdapter处理请求/响应
 * 2. 只需配置baseUrl即可接入新供应商
 * 3. 支持标准OpenAI API功能
 */
export class OpenAICompatibleProviderPlugin extends BaseProviderPlugin {
  readonly id: string;
  readonly name: string;
  readonly supportedTypes = ["llm"] as const;
  readonly defaultProtocol = "openai" as const;

  private adapter: OpenAIProtocolAdapter;

  constructor(id: string, name: string) {
    super();
    this.id = id;
    this.name = name;
    this.adapter = createProtocolAdapter("openai") as OpenAIProtocolAdapter;
  }

  /**
   * 初始化Provider
   */
  async initialize(config: { apiKey?: string; baseUrl?: string }): Promise<void> {
    await super.initialize(config);
    this.adapter = createProtocolAdapter("openai") as OpenAIProtocolAdapter;
  }

  /**
   * 文本生成
   */
  async generateText(
    request: TextGenerationRequest
  ): Promise<AIResult<TextGenerationResponse>> {
    try {
      const apiKey = this.getApiKey({ apiKey: request.extraParams?.apiKey } as ModelConfig);
      const baseUrl = this.getBaseUrl({ apiUrl: request.extraParams?.baseUrl } as ModelConfig);

      // 构建请求体
      const body = this.adapter.buildRequest({
        operation: "chat",
        modelId: request.modelId,
        messages: request.messages || [
          { role: "user", content: request.prompt },
        ],
        systemPrompt: request.systemPrompt,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        extraParams: request.extraParams,
      });

      // 发送请求
      const response = await this.makeRequest(
        this.adapter.getEndpoint(baseUrl || "https://api.openai.com/v1", "chat"),
        {
          method: "POST",
          headers: this.adapter.getAuthHeaders(apiKey),
          body: JSON.stringify(body),
        },
        120000
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      // 解析响应
      const data = await response.json();
      const result = this.adapter.parseResponse(data);

      return this.createSuccessResult(
        {
          content: result.content || "",
          usage: result.usage,
          metadata: result.raw,
        },
        { model: result.model }
      );
    } catch (error) {
      return this.createErrorResult(error);
    }
  }

  /**
   * 验证配置有效性
   */
  async validateConfig(config: ModelConfig): Promise<ValidationResult> {
    try {
      const apiKey = this.getApiKey(config);
      const baseUrl = this.getBaseUrl(config) || "https://api.openai.com/v1";

      // 调用模型列表接口验证
      const response = await this.makeRequest(
        this.adapter.getEndpoint(baseUrl, "models"),
        {
          headers: this.adapter.getAuthHeaders(apiKey),
        },
        10000
      );

      if (response.status === 200) {
        return { valid: true };
      } else if (response.status === 401) {
        return { valid: false, error: "API密钥无效或已过期" };
      } else {
        return { valid: false, error: `验证失败: ${response.status}` };
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // 简单的连通性检查
      const baseUrl = this.config.baseUrl || "https://api.openai.com/v1";
      const response = await this.makeRequest(
        `${baseUrl.replace(/\/$/, "")}/models`,
        {
          headers: this.adapter.getAuthHeaders(this.config.apiKey || ""),
        },
        10000
      );

      const latency = Date.now() - startTime;

      if (response.ok) {
        return {
          status: "healthy",
          latency,
          timestamp: Date.now(),
          checks: {
            connectivity: { status: "pass", latency },
            apiKey: { status: "pass" },
            service: { status: "pass" },
          },
        };
      } else {
        return {
          status: "degraded",
          latency,
          timestamp: Date.now(),
          checks: {
            connectivity: { status: "pass", latency },
            apiKey: { status: response.status === 401 ? "fail" : "pass" },
            service: { status: "fail", message: `HTTP ${response.status}` },
          },
        };
      }
    } catch (error) {
      return {
        status: "unhealthy",
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        checks: {
          connectivity: { status: "fail", message: String(error) },
        },
      };
    }
  }
}

/**
 * 创建特定供应商的OpenAI兼容Provider
 */
export function createOpenAICompatibleProvider(
  id: string,
  name: string,
  defaultBaseUrl?: string
): OpenAICompatibleProviderPlugin {
  const provider = new OpenAICompatibleProviderPlugin(id, name);
  if (defaultBaseUrl) {
    provider.initialize({ baseUrl: defaultBaseUrl });
  }
  return provider;
}
