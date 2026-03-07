/**
 * 模型能力管理器
 * 统一管理各模型的能力参数和限制
 * 
 * V2 改进：
 * - 从 config/models.ts 读取配置，彻底消除硬编码
 * - 新增模型只需修改配置文件，无需代码改动
 */

import { modelConfigManager } from './ModelConfigManager';
import { DEFAULT_MODELS } from '../../../config/models';
import { validateProvider } from '../types';

export interface ModelCapabilities {
  maxTokens: number;
  maxInputTokens: number;
  supportsJsonMode: boolean;
  supportsSystemPrompt: boolean;
  supportsStreaming: boolean;
}

export interface ModelLimits {
  provider: string;
  modelId: string;
  maxTokens: number;
  maxInputTokens: number;
  description?: string;  // 可选描述
}

/**
 * 预定义的模型限制表
 * 当模型配置中没有明确限制时，使用此表作为 fallback
 */
const MODEL_LIMITS: ModelLimits[] = [
  // 豆包系列
  { provider: 'volcengine', modelId: 'doubao-lite-4k', maxTokens: 4096, maxInputTokens: 4096 },
  { provider: 'volcengine', modelId: 'doubao-lite-32k', maxTokens: 4096, maxInputTokens: 32768 },
  { provider: 'volcengine', modelId: 'doubao-lite-32k-character-250228', maxTokens: 4096, maxInputTokens: 32768 },
  { provider: 'volcengine', modelId: 'doubao-lite-128k', maxTokens: 4096, maxInputTokens: 131072 },
  { provider: 'volcengine', modelId: 'doubao-pro-4k', maxTokens: 4096, maxInputTokens: 4096 },
  { provider: 'volcengine', modelId: 'doubao-pro-32k', maxTokens: 4096, maxInputTokens: 32768 },
  { provider: 'volcengine', modelId: 'doubao-pro-128k', maxTokens: 4096, maxInputTokens: 131072 },
  { provider: 'volcengine', modelId: 'doubao-vision', maxTokens: 4096, maxInputTokens: 4096 },
  { provider: 'volcengine', modelId: 'doubao-embedding', maxTokens: 4096, maxInputTokens: 4096 },

  // 豆包系列变体（带日期版本号）
  { provider: 'volcengine', modelId: 'doubao-lite-4k-240515', maxTokens: 4096, maxInputTokens: 4096 },
  { provider: 'volcengine', modelId: 'doubao-lite-32k-240515', maxTokens: 4096, maxInputTokens: 32768 },
  { provider: 'volcengine', modelId: 'doubao-pro-4k-240515', maxTokens: 4096, maxInputTokens: 4096 },
  { provider: 'volcengine', modelId: 'doubao-pro-32k-240515', maxTokens: 4096, maxInputTokens: 32768 },

  // DeepSeek 系列
  { provider: 'volcengine', modelId: 'deepseek-v3', maxTokens: 8192, maxInputTokens: 65536 },
  { provider: 'volcengine', modelId: 'deepseek-r1', maxTokens: 8192, maxInputTokens: 65536 },
  { provider: 'volcengine', modelId: 'deepseek-r1-distill-qwen-32b', maxTokens: 8192, maxInputTokens: 32768 },
  { provider: 'volcengine', modelId: 'deepseek-r1-distill-qwen-7b', maxTokens: 8192, maxInputTokens: 32768 },

  // Seed 系列（文本生成）
  { provider: 'volcengine', modelId: 'doubao-seed-1-6-251015', maxTokens: 4096, maxInputTokens: 32768 },
  { provider: 'volcengine', modelId: 'doubao-seed-1-6', maxTokens: 4096, maxInputTokens: 32768 },

  // Seedream 系列（图像生成，不需要 maxTokens）
  { provider: 'volcengine', modelId: 'seedream-4.0', maxTokens: 0, maxInputTokens: 0 },
  { provider: 'volcengine', modelId: 'seedream-3.0', maxTokens: 0, maxInputTokens: 0 },

  // Seedance 系列（视频生成）
  { provider: 'volcengine', modelId: 'seedance', maxTokens: 0, maxInputTokens: 0 },

  // OpenAI 系列
  { provider: 'openai', modelId: 'gpt-4o', maxTokens: 4096, maxInputTokens: 128000 },
  { provider: 'openai', modelId: 'gpt-4o-mini', maxTokens: 4096, maxInputTokens: 128000 },
  { provider: 'openai', modelId: 'gpt-4-turbo', maxTokens: 4096, maxInputTokens: 128000 },
  { provider: 'openai', modelId: 'gpt-3.5-turbo', maxTokens: 4096, maxInputTokens: 16385 },

  // Anthropic Claude 系列
  { provider: 'anthropic', modelId: 'claude-3-5-sonnet', maxTokens: 8192, maxInputTokens: 200000 },
  { provider: 'anthropic', modelId: 'claude-3-opus', maxTokens: 4096, maxInputTokens: 200000 },
  { provider: 'anthropic', modelId: 'claude-3-sonnet', maxTokens: 4096, maxInputTokens: 200000 },
  { provider: 'anthropic', modelId: 'claude-3-haiku', maxTokens: 4096, maxInputTokens: 200000 },

  // 阿里云百炼
  { provider: 'aliyun', modelId: 'qwen-vl-max', maxTokens: 4096, maxInputTokens: 32768 },
  { provider: 'aliyun', modelId: 'qwen-turbo', maxTokens: 4096, maxInputTokens: 8192 },
  { provider: 'aliyun', modelId: 'qwen-plus', maxTokens: 4096, maxInputTokens: 32768 },
  { provider: 'aliyun', modelId: 'qwen-max', maxTokens: 4096, maxInputTokens: 32768 },

  // 魔搭社区（开发测试用）
  { provider: 'modelscope', modelId: 'Qwen2.5-72B-Instruct', maxTokens: 4096, maxInputTokens: 32768 },

  // ==========================================
  // 未来模型预留（256K+ tokens）
  // 以下模型尚未发布，但已预留配置位置
  // ==========================================

  // OpenAI 下一代模型
  // { provider: 'openai', modelId: 'gpt-5', maxTokens: 32768, maxInputTokens: 256000, description: 'Future model - 256K context' },

  // Anthropic Claude 下一代
  // { provider: 'anthropic', modelId: 'claude-4', maxTokens: 16384, maxInputTokens: 256000, description: 'Future model - 256K context' },

  // 阿里云百炼下一代
  // { provider: 'aliyun', modelId: 'qwen3-256k', maxTokens: 8192, maxInputTokens: 256000, description: 'Future model - 256K context' },
];

/**
 * 从模型配置直接读取限制参数（V2 新增）
 * 彻底消除硬编码，新增模型只需修改 config/models.ts
 * 
 * @param modelId 模型ID
 * @returns 模型限制参数，如果找不到则返回 null
 */
export function getModelLimitsFromConfig(modelId: string): ModelLimits | null {
  if (!modelId) {
    return null;
  }

  // 从 DEFAULT_MODELS 配置中查找
  const model = DEFAULT_MODELS.find(m => m.modelId === modelId);
  
  if (!model) {
    console.warn(`[ModelCapabilityManager] Model not found in config: ${modelId}`);
    return null;
  }
  
  // 空值保护：安全地读取参数
  const maxTokens = model.parameters?.find(p => p.name === 'maxTokens')?.defaultValue ?? 4096;
  const maxInputTokens = model.capabilities?.maxContextLength ?? 32768;
  
  // 确保 provider 有效
  let provider = model.provider;
  try {
    validateProvider(provider);
  } catch (error) {
    console.warn(`[ModelCapabilityManager] Invalid provider in config for ${modelId}: ${provider}. Using as-is.`);
  }
  
  return {
    provider: provider,
    modelId: model.modelId,
    maxTokens: Math.min(maxTokens, 8192), // API 上限保护
    maxInputTokens: maxInputTokens,
  };
}

/**
 * 获取模型的限制参数
 * 支持三种匹配策略：
 * 1. 优先从 config/models.ts 读取（V2 改进）
 * 2. 从 MODEL_LIMITS 硬编码表读取（兼容旧逻辑）
 * 3. 模糊匹配：处理版本号差异
 *
 * @param modelId 模型ID
 * @param provider Provider ID（可选）
 * @returns 模型限制参数，如果找不到则返回 undefined
 */
export function getModelLimits(modelId: string, provider?: string): ModelLimits | undefined {
  if (!modelId) {
    return undefined;
  }

  // V2: 优先从配置文件读取
  const configLimits = getModelLimitsFromConfig(modelId);
  if (configLimits) {
    return configLimits;
  }

  // 兼容旧逻辑：从硬编码表读取（逐步淘汰）
  const normalizedModelId = modelId.toLowerCase().trim();

  // 1. 如果提供了 provider，优先进行 provider + modelId 组合匹配
  if (provider) {
    const normalizedProvider = provider.toLowerCase().trim();
    const exactMatch = MODEL_LIMITS.find(
      limit => limit.provider.toLowerCase() === normalizedProvider &&
               limit.modelId.toLowerCase() === normalizedModelId
    );
    if (exactMatch) {
      return exactMatch;
    }
  }

  // 2. 精确匹配 modelId（不区分 provider）
  const modelMatch = MODEL_LIMITS.find(
    limit => limit.modelId.toLowerCase() === normalizedModelId
  );
  if (modelMatch) {
    return modelMatch;
  }

  // 3. 模糊匹配：处理版本号差异
  // 例如：doubao-lite-32k-character-250228 应该匹配 doubao-lite-32k
  // 策略：提取基础模型名称（去除版本号后缀）
  const fuzzyMatch = findFuzzyMatch(normalizedModelId, provider);
  if (fuzzyMatch) {
    return fuzzyMatch;
  }

  return undefined;
}

/**
 * 模糊匹配模型限制
 * 处理版本号差异，如 doubao-lite-32k-character-250228 匹配 doubao-lite-32k
 *
 * @param modelId 模型ID（已小写化）
 * @param provider Provider ID（可选，已小写化）
 * @returns 匹配的模型限制，未找到返回 undefined
 */
function findFuzzyMatch(modelId: string, provider?: string): ModelLimits | undefined {
  // 版本号模式：-YYYYMMDD 或 -250228 格式
  const versionPattern = /-\d{6,8}$/;
  // 特性后缀模式：-character、-vision 等
  const featurePattern = /-(character|vision|embedding|search|function)$/;

  // 去除版本号后缀
  let baseModelId = modelId.replace(versionPattern, '');
  // 去除特性后缀
  baseModelId = baseModelId.replace(featurePattern, '');

  // 如果去除后缀后有变化，尝试匹配
  if (baseModelId !== modelId) {
    // 优先在相同 provider 中匹配
    if (provider) {
      const providerMatch = MODEL_LIMITS.find(
        limit => limit.provider.toLowerCase() === provider &&
                 limit.modelId.toLowerCase() === baseModelId
      );
      if (providerMatch) {
        return providerMatch;
      }
    }

    // 跨 provider 匹配
    const baseMatch = MODEL_LIMITS.find(
      limit => limit.modelId.toLowerCase() === baseModelId
    );
    if (baseMatch) {
      return baseMatch;
    }
  }

  // 尝试前缀匹配（处理 doubao-lite-4k 匹配 doubao-lite-4k-character-250228 的情况）
  // 按 modelId 长度降序排序，优先匹配更具体的
  const candidates = MODEL_LIMITS
    .filter(limit => {
      const limitModelId = limit.modelId.toLowerCase();
      // 检查 modelId 是否以候选模型ID开头
      return modelId.startsWith(limitModelId + '-') || modelId === limitModelId;
    })
    .sort((a, b) => b.modelId.length - a.modelId.length);

  if (candidates.length > 0) {
    // 如果提供了 provider，优先匹配相同 provider
    if (provider) {
      const providerMatch = candidates.find(
        limit => limit.provider.toLowerCase() === provider
      );
      if (providerMatch) {
        return providerMatch;
      }
    }
    // 返回第一个（最长的）匹配
    return candidates[0];
  }

  return undefined;
}

/**
 * 计算有效的最大 token 数
 * 根据模型限制和请求的 token 数，返回实际可用的 token 数
 *
 * @param modelId 模型ID
 * @param requestedTokens 请求的 token 数
 * @param provider Provider ID（可选）
 * @returns 计算结果对象
 *   - effectiveTokens: 实际使用的 token 数
 *   - wasLimited: 是否被限制（请求的 token 数超过了模型限制）
 *   - maxAllowed: 模型允许的最大 token 数
 *   - modelFound: 是否找到了模型配置
 */
export function calculateEffectiveMaxTokens(
  modelId: string,
  requestedTokens: number,
  provider?: string
): {
  effectiveTokens: number;
  wasLimited: boolean;
  maxAllowed: number;
  modelFound: boolean;
} {
  // 保护逻辑：确保 requestedTokens 至少为 1
  if (!Number.isFinite(requestedTokens) || requestedTokens < 1) {
    console.warn(`[ModelCapabilityManager] Invalid requestedTokens: ${requestedTokens}. Using minimum value of 1.`);
    requestedTokens = 1;
  }

  const limits = getModelLimits(modelId, provider);

  // 未找到模型配置
  if (!limits) {
    console.warn(`[ModelCapabilityManager] Unknown model: ${modelId}${provider ? ` (provider: ${provider})` : ''}. Using requested tokens without limit.`);
    const safeTokens = Math.max(1, requestedTokens);
    return {
      effectiveTokens: safeTokens,
      wasLimited: false,
      maxAllowed: safeTokens,
      modelFound: false,
    };
  }

  const maxAllowed = limits.maxTokens;

  // 如果模型 maxTokens 为 0（如图像/视频生成模型），使用请求的 token 数
  if (maxAllowed === 0) {
    return {
      effectiveTokens: requestedTokens,
      wasLimited: false,
      maxAllowed: 0,
      modelFound: true,
    };
  }

  // 请求的 token 数超过了模型限制
  if (requestedTokens > maxAllowed) {
    console.warn(`[ModelCapabilityManager] Requested tokens (${requestedTokens}) exceed model limit (${maxAllowed}) for ${modelId}. Limiting to ${maxAllowed}.`);
    return {
      effectiveTokens: maxAllowed,
      wasLimited: true,
      maxAllowed,
      modelFound: true,
    };
  }

  // 请求的 token 数在限制范围内
  return {
    effectiveTokens: requestedTokens,
    wasLimited: false,
    maxAllowed,
    modelFound: true,
  };
}

/**
 * 验证 token 配置是否有效
 * 检查请求的 token 数是否超出模型限制，并提供建议
 *
 * @param modelId 模型ID
 * @param requestedTokens 请求的 token 数
 * @param provider Provider ID（可选）
 * @returns 验证结果对象
 *   - valid: 配置是否有效
 *   - error: 错误信息（如果无效）
 *   - suggestion: 建议信息（如果有限制）
 *   - maxAllowed: 模型允许的最大 token 数（如果找到模型）
 */
export function validateTokenConfig(
  modelId: string,
  requestedTokens: number,
  provider?: string
): {
  valid: boolean;
  error?: string;
  suggestion?: string;
  maxAllowed?: number;
} {
  // 验证请求的 token 数是否为正数（API 要求至少为 1）
  if (!Number.isFinite(requestedTokens) || requestedTokens < 1) {
    return {
      valid: false,
      error: `Invalid token count: ${requestedTokens}. Must be at least 1.`,
    };
  }

  const limits = getModelLimits(modelId, provider);

  // 未找到模型配置
  if (!limits) {
    return {
      valid: true,
      suggestion: `Model "${modelId}" not found in configuration. Using requested tokens (${requestedTokens}) without validation.`,
    };
  }

  const maxAllowed = limits.maxTokens;

  // 图像/视频生成模型（maxTokens 为 0）
  if (maxAllowed === 0) {
    return {
      valid: true,
      maxAllowed: 0,
      suggestion: `Model "${modelId}" is a generation model without token limits.`,
    };
  }

  // 请求的 token 数超过了模型限制
  if (requestedTokens > maxAllowed) {
    return {
      valid: false,
      error: `Requested tokens (${requestedTokens}) exceed model "${modelId}" limit (${maxAllowed}).`,
      suggestion: `Reduce maxTokens to ${maxAllowed} or less for this model.`,
      maxAllowed,
    };
  }

  // 配置有效
  return {
    valid: true,
    maxAllowed,
  };
}

export { MODEL_LIMITS };
