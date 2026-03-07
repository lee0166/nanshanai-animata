/**
 * AI Service Types
 * 
 * 定义 AI 服务的通用类型和枚举
 * 
 * @module services/ai/types
 * @version 2.0.0
 */

/**
 * 支持的 AI 提供商枚举
 * 使用 const assertion 确保类型安全
 */
export const PROVIDER_ENUM = {
  VOLCENGINE: 'volcengine',
  DEEPSEEK: 'deepseek',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  ALIYUN: 'aliyun',
  MODELSCOPE: 'modelscope',
} as const;

/**
 * Provider 类型
 */
export type ProviderType = typeof PROVIDER_ENUM[keyof typeof PROVIDER_ENUM];

/**
 * 有效的 provider 值数组
 */
export const VALID_PROVIDERS: string[] = Object.values(PROVIDER_ENUM);

/**
 * 校验 provider 是否有效
 * 无效时抛出明确错误，不掩盖
 * 
 * @param provider - 要校验的 provider 字符串
 * @returns 校验后的 ProviderType
 * @throws Error 如果 provider 无效
 */
export function validateProvider(provider: string): ProviderType {
  if (!VALID_PROVIDERS.includes(provider)) {
    throw new Error(
      `Invalid provider: "${provider}". ` +
      `Expected one of: ${VALID_PROVIDERS.join('/')}`
    );
  }
  return provider as ProviderType;
}

/**
 * 检查 provider 是否有效（不抛出错误）
 * 
 * @param provider - 要检查的 provider 字符串
 * @returns 是否有效
 */
export function isValidProvider(provider: string): provider is ProviderType {
  return VALID_PROVIDERS.includes(provider);
}

/**
 * AI 请求配置
 */
export interface AIRequestConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  enable_thinking?: boolean;
}

/**
 * AI 响应结果
 */
export interface AIResult {
  success: boolean;
  data?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 结构化输出结果
 */
export interface StructuredAIResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rawResponse?: string;
}

/**
 * 任务类型
 */
export type TaskType = 'metadata' | 'characters' | 'scenes' | 'shots' | 'dialogue' | 'quality';

/**
 * 任务配置
 */
export interface TaskConfig {
  maxTokens: number;
  temperature: number;
  timeout: number;
}
