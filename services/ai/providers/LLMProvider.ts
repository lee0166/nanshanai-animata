import { AIResult, IAIProvider } from '../interfaces';
import { ModelConfig } from '../../../types';
import { BaseProvider } from './BaseProvider';
import { z } from 'zod';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  enable_thinking?: boolean;
}

export interface LLMResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LLMProvider extends BaseProvider implements IAIProvider {
  id = 'llm';

  /**
   * Generate text using LLM
   * This is the main method for text parsing/script analysis
   */
  async generateText(
    prompt: string,
    config: ModelConfig,
    systemPrompt?: string,
    extraParams?: Record<string, any>
  ): Promise<AIResult> {
    try {
      const apiKey = this.getApiKey(config);
      const apiUrl = config.apiUrl || 'https://api.openai.com/v1';
      const modelId = config.modelId;

      // Build messages
      const messages: LLMMessage[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      // Get parameters from config
      const temperature = extraParams?.temperature ?? 
        config.parameters?.find(p => p.name === 'temperature')?.defaultValue ?? 0.3;
      const maxTokens = extraParams?.maxTokens ?? 
        config.parameters?.find(p => p.name === 'maxTokens')?.defaultValue ??
        config.capabilities?.maxTokens ?? 4000;

      // Build request body - conditionally add enable_thinking for providers that need it
      const requestBody: LLMRequest & { enable_thinking?: boolean } = {
        model: modelId,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      };

      // Add enable_thinking from model config (providerOptions)
      // For non-streaming calls, some providers (like Modelscope Qwen3) require explicit enable_thinking=false
      // Always set to false for non-streaming requests to ensure compatibility with all models
      requestBody.enable_thinking = false;

      console.log(`[LLMProvider] ========== API Request ==========`);
      console.log(`[LLMProvider] Endpoint: ${apiUrl}/chat/completions`);
      console.log(`[LLMProvider] Model: ${modelId}`);
      console.log(`[LLMProvider] enable_thinking: false`);
      console.log(`[LLMProvider] Temperature: ${temperature}`);
      console.log(`[LLMProvider] Max Tokens: ${maxTokens}`);
      console.log(`[LLMProvider] Messages count: ${messages.length}`);
      console.log(`[LLMProvider] First message length: ${messages[0]?.content?.length || 0} characters`);
      console.log(`[LLMProvider] Request body:`, JSON.stringify(requestBody, null, 2).substring(0, 500) + '...');

      console.log('[LLMProvider] Sending request...');
      const startTime = Date.now();

      const response = await this.makeRequest(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      }, 120000); // 120 second timeout for LLM

      const elapsed = Date.now() - startTime;
      console.log(`[LLMProvider] Request completed in ${elapsed}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLMProvider] API Error: ${response.status} - ${errorText}`);
        return {
          success: false,
          error: `API Error: ${response.status} - ${errorText}`,
        };
      }

      const data: LLMResponse = await response.json();
      const content = data.choices[0]?.message?.content || '';

      console.log(`[LLMProvider] ========== API Response ==========`);
      console.log(`[LLMProvider] Response length: ${content.length} characters`);
      console.log(`[LLMProvider] Prompt tokens: ${data.usage?.prompt_tokens}`);
      console.log(`[LLMProvider] Completion tokens: ${data.usage?.completion_tokens}`);
      console.log(`[LLMProvider] Total tokens: ${data.usage?.total_tokens}`);
      console.log(`[LLMProvider] Response preview: ${content.substring(0, 100)}...`);

      return {
        success: true,
        data: content,
        metadata: {
          usage: data.usage,
          model: modelId,
        },
      };
    } catch (error: any) {
      console.error('[LLMProvider] Error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Not implemented - LLM provider doesn't generate images
   */
  async generateImage(
    prompt: string,
    config: ModelConfig,
    referenceImages?: string[],
    aspectRatio?: string,
    resolution?: string,
    count?: number,
    guidanceScale?: number,
    extraParams?: Record<string, any>
  ): Promise<AIResult> {
    return {
      success: false,
      error: 'LLM provider does not support image generation',
    };
  }

  /**
   * Not implemented - LLM provider doesn't generate videos
   */
  async generateVideo(
    prompt: string,
    config: ModelConfig,
    startImage?: string,
    endImage?: string,
    existingTaskId?: string,
    onTaskId?: (id: string) => void,
    extraParams?: Record<string, any>
  ): Promise<AIResult> {
    return {
      success: false,
      error: 'LLM provider does not support video generation',
    };
  }

  /**
   * Validate LLM config
   */
  validateConfig(config: ModelConfig): boolean {
    return !!config.apiKey && !!config.modelId;
  }

  /**
   * 生成结构化输出（使用JSON Mode）
   * @param prompt 用户提示词
   * @param config 模型配置
   * @param schema Zod Schema（用于类型校验）
   * @param schemaDescription Schema的文字描述（给LLM看）
   * @param systemPrompt 系统提示词
   */
  async generateStructured<T>(
    prompt: string,
    config: ModelConfig,
    schema: z.ZodType<T>,
    schemaDescription: string,
    systemPrompt?: string
  ): Promise<AIResult<T>> {
    try {
      const apiKey = this.getApiKey(config);
      const apiUrl = config.apiUrl || 'https://api.openai.com/v1';
      const modelId = config.modelId;

      // 构建增强的系统提示词
      const enhancedSystemPrompt = systemPrompt
        ? `${systemPrompt}\n\n【重要】请严格按照以下JSON Schema输出，不要添加任何额外内容：\n${schemaDescription}`
        : `你是一个专业的剧本分析助手。请严格按照以下JSON Schema输出，不要添加任何额外内容：\n${schemaDescription}`;

      // 构建消息
      const messages: LLMMessage[] = [
        { role: 'system', content: enhancedSystemPrompt },
        { role: 'user', content: prompt }
      ];

      // 从配置获取参数
      const temperature = config.parameters?.find(p => p.name === 'temperature')?.defaultValue ?? 0.3;
      const maxTokens = config.parameters?.find(p => p.name === 'maxTokens')?.defaultValue ??
        config.capabilities?.maxTokens ?? 4000;

      // 检查模型是否支持json_mode
      const useJsonMode = config.capabilities?.supportsJsonMode ?? false;

      // 构建请求体
      const requestBody: LLMRequest & { response_format?: { type: string } } = {
        model: modelId,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
        enable_thinking: false,
      };

      // 如果支持json_mode，添加response_format
      if (useJsonMode) {
        requestBody.response_format = { type: 'json_object' };
      }

      console.log(`[LLMProvider] ========== Structured Output Request ==========`);
      console.log(`[LLMProvider] Endpoint: ${apiUrl}/chat/completions`);
      console.log(`[LLMProvider] Model: ${modelId}`);
      console.log(`[LLMProvider] JSON Mode: ${useJsonMode}`);

      console.log('[LLMProvider] Sending structured output request...');
      const startTime = Date.now();

      const response = await this.makeRequest(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      }, 120000);

      const elapsed = Date.now() - startTime;
      console.log(`[LLMProvider] Structured request completed in ${elapsed}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLMProvider] API Error: ${response.status} - ${errorText}`);
        return { success: false, error: `API Error: ${response.status} - ${errorText}` };
      }

      const data: LLMResponse = await response.json();
      const content = data.choices[0]?.message?.content || '';

      console.log(`[LLMProvider] Response length: ${content.length} characters`);

      // 直接尝试解析JSON
      let parsedData: any;
      try {
        parsedData = JSON.parse(content);
      } catch (e) {
        // 如果直接解析失败，尝试用JSONRepair（作为最后的后备方案）
        console.warn('[LLMProvider] Direct JSON parse failed, trying repair...');
        const { JSONRepair } = await import('../../parsing/JSONRepair');
        const repairResult = JSONRepair.repairAndParse(content);
        if (!repairResult.success || !repairResult.data) {
          return { success: false, error: 'Failed to parse JSON even after repair' };
        }
        parsedData = repairResult.data;
      }

      // 使用Zod进行类型校验和补全默认值
      const validationResult = schema.safeParse(parsedData);
      if (!validationResult.success) {
        console.error('[LLMProvider] Zod validation failed:', validationResult.error);
        return {
          success: false,
          error: `Schema validation failed: ${validationResult.error.message}`
        };
      }

      console.log('[LLMProvider] Structured output validated successfully');

      return {
        success: true,
        data: validationResult.data,
        metadata: {
          usage: data.usage,
          model: modelId,
        },
      };
    } catch (error: any) {
      console.error('[LLMProvider] Structured output error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }
}

export const llmProvider = new LLMProvider();
