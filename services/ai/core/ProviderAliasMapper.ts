/**
 * Provider 别名映射器
 * 
 * 解决普通用户配置模型时 Provider 选择混乱的问题
 * 让用户可以使用任意厂商名称，系统自动映射到正确的 Provider
 * 
 * @module services/ai/core/ProviderAliasMapper
 * @version 1.0.0
 */

/**
 * 别名映射配置
 * key: 用户输入的厂商名称（小写）
 * value: 系统内部的 Provider ID
 */
const ALIAS_MAP: Record<string, string> = {
  'minimax': 'llm',
  'mini-max': 'llm',
  'minimax-abab': 'llm',
  'openai': 'llm',
  'open-ai': 'llm',
  'gpt': 'llm',
  'gpt-4': 'llm',
  'gpt-4o': 'llm',
  'gpt-4o-mini': 'llm',
  'anthropic': 'llm',
  'claude': 'llm',
  'claude-3': 'llm',
  'claude-3.5': 'llm',
  'volcengine': 'volcengine',
  '火山': 'volcengine',
  '火山引擎': 'volcengine',
  'doubao': 'volcengine',
  '豆包': 'volcengine',
  'vidu': 'vidu',
  'modelscope': 'modelscope',
  'model_scope': 'modelscope',
  '魔搭': 'modelscope',
  'aliyun': 'volcengine',
  '阿里云': 'volcengine',
  'qwen': 'volcengine',
  '通义千问': 'volcengine',
  'deepseek': 'llm',
  'deep-seek': 'llm',
  'zhipu': 'llm',
  '智谱': 'llm',
  'glm': 'llm',
  'glm-4': 'llm',
};

/**
 * 归一化输入字符串
 * - 转小写
 * - 移除多余空格
 * - 移除特殊字符
 */
function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[-_\s]+/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
}

/**
 * Provider 别名映射器
 */
export class ProviderAliasMapper {
  private static instance: ProviderAliasMapper;

  private constructor() {}

  public static getInstance(): ProviderAliasMapper {
    if (!ProviderAliasMapper.instance) {
      ProviderAliasMapper.instance = new ProviderAliasMapper();
    }
    return ProviderAliasMapper.instance;
  }

  /**
   * 映射厂商名称到内部 Provider ID
   * 
   * @param input 用户输入的厂商名称
   * @returns 映射后的内部 Provider ID
   */
  public map(input: string): string {
    if (!input || input.trim() === '') {
      return input;
    }

    const normalized = normalizeInput(input);

    // 1. 精确匹配（归一化后）
    if (ALIAS_MAP[normalized]) {
      console.log(`[ProviderAliasMapper] Exact match: "${input}" → "${ALIAS_MAP[normalized]}"`);
      return ALIAS_MAP[normalized];
    }

    // 2. 前缀匹配
    for (const [alias, provider] of Object.entries(ALIAS_MAP)) {
      if (normalized.startsWith(alias)) {
        console.log(`[ProviderAliasMapper] Prefix match: "${input}" → "${provider}"`);
        return provider;
      }
    }

    // 3. 包含匹配
    for (const [alias, provider] of Object.entries(ALIAS_MAP)) {
      if (normalized.includes(alias)) {
        console.log(`[ProviderAliasMapper] Contains match: "${input}" → "${provider}"`);
        return provider;
      }
    }

    // 4. 如果是已有的 Provider ID，直接返回（向后兼容）
    const existingProviders = ['llm', 'volcengine', 'vidu', 'modelscope'];
    if (existingProviders.includes(input.toLowerCase())) {
      console.log(`[ProviderAliasMapper] Existing provider: "${input}"`);
      return input.toLowerCase();
    }

    // 5. 默认返回 'llm'（OpenAI 兼容）
    console.log(`[ProviderAliasMapper] Defaulting to 'llm' for: "${input}"`);
    return 'llm';
  }

  /**
   * 获取所有支持的别名（用于 UI 显示）
   */
  public getSupportedAliases(): Array<{ label: string; value: string; provider: string }> {
    return [
      { label: '硅基流动 (Volcengine)', value: 'volcengine', provider: 'volcengine' },
      { label: 'MiniMax (OpenAI 兼容)', value: 'minimax', provider: 'llm' },
      { label: 'OpenAI (官方)', value: 'openai', provider: 'llm' },
      { label: 'Anthropic Claude', value: 'anthropic', provider: 'llm' },
      { label: 'DeepSeek', value: 'deepseek', provider: 'llm' },
      { label: '智谱 GLM', value: 'zhipu', provider: 'llm' },
      { label: 'Vidu', value: 'vidu', provider: 'vidu' },
      { label: 'ModelScope (魔搭)', value: 'modelscope', provider: 'modelscope' },
    ];
  }
}

export const providerAliasMapper = ProviderAliasMapper.getInstance();
