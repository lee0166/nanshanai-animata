/**
 * 模型能力管理器
 * 统一管理各模型的能力参数和限制
 *
 * 从 config/models.ts 读取配置，无硬编码
 * 新增模型只需修改配置文件，无需代码改动
 */

import { DEFAULT_MODELS } from '../../../config/models';
import { validateProvider } from '../types';
import type { ModelConfig, ModelCapabilities } from '../../../types';

export interface ModelLimits {
  provider: string;
  modelId: string;
  maxTokens: number;
  maxInputTokens: number;
  description?: string;
}

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
  const provider = model.provider;
  try {
    validateProvider(provider);
  } catch (error) {
    console.warn(
      `[ModelCapabilityManager] Invalid provider in config for ${modelId}: ${provider}. Using as-is.`
    );
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
 *
 * @param modelId 模型ID
 * @param provider Provider ID（可选）
 * @returns 模型限制参数，如果找不到则返回 undefined
 */
export function getModelLimits(modelId: string, provider?: string): ModelLimits | undefined {
  if (!modelId) {
    return undefined;
  }

  const configLimits = getModelLimitsFromConfig(modelId);
  if (configLimits) {
    return configLimits;
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
    console.warn(
      `[ModelCapabilityManager] Invalid requestedTokens: ${requestedTokens}. Using minimum value of 1.`
    );
    requestedTokens = 1;
  }

  const limits = getModelLimits(modelId, provider);

  // 未找到模型配置
  if (!limits) {
    console.warn(
      `[ModelCapabilityManager] Unknown model: ${modelId}${provider ? ` (provider: ${provider})` : ''}. Using requested tokens without limit.`
    );
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
    console.warn(
      `[ModelCapabilityManager] Requested tokens (${requestedTokens}) exceed model limit (${maxAllowed}) for ${modelId}. Limiting to ${maxAllowed}.`
    );
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
