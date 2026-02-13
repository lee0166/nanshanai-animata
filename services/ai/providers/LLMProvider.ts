import { AIResult, IAIProvider } from '../interfaces';
import { ModelConfig } from '../../../types';
import { BaseProvider } from './BaseProvider';

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
        config.parameters?.find(p => p.name === 'maxTokens')?.defaultValue ?? 4000;

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
      // Default to false for all non-streaming requests to ensure compatibility
      const enableThinking = config.providerOptions?.enableThinking;
      requestBody.enable_thinking = enableThinking !== undefined ? enableThinking : false;

      console.log(`[LLMProvider] ========== API Request ==========`);
      console.log(`[LLMProvider] Endpoint: ${apiUrl}/chat/completions`);
      console.log(`[LLMProvider] Model: ${modelId}`);
      console.log(`[LLMProvider] enable_thinking: ${enableThinking}`);
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
}

export const llmProvider = new LLMProvider();
