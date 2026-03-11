import { getProviderPluginManager } from '../core/ProviderPluginManager';
import { IProvider, ProviderMetadata } from '../core/IProvider';
import { OpenAICompatibleProviderPlugin } from './plugins/OpenAICompatibleProviderPlugin';
import { AliyunVideoProvider } from './AliyunVideoProvider';

/**
 * Provider插件注册表
 *
 * 集中管理所有Provider插件的注册
 */

/**
 * 注册所有Provider插件
 *
 * 调用时机：应用启动时
 */
export async function registerAllProviders(): Promise<void> {
  const manager = getProviderPluginManager();

  // 核心Provider配置列表
  const providers: Array<{ provider: IProvider; metadata: ProviderMetadata }> = [
    // OpenAI官方
    {
      provider: new OpenAICompatibleProviderPlugin('openai', 'OpenAI'),
      metadata: { environment: 'all', priority: 100 },
    },

    // 阿里百炼
    {
      provider: new OpenAICompatibleProviderPlugin('aliyun', '阿里百炼'),
      metadata: { environment: 'all', priority: 100 },
    },

    // 阿里百炼视频生成
    {
      provider: new AliyunVideoProvider(),
      metadata: { environment: 'all', priority: 100 },
    },

    // DeepSeek
    {
      provider: new OpenAICompatibleProviderPlugin('deepseek', 'DeepSeek'),
      metadata: { environment: 'all', priority: 100 },
    },

    // Kimi
    {
      provider: new OpenAICompatibleProviderPlugin('kimi', 'Kimi'),
      metadata: { environment: 'all', priority: 100 },
    },

    // 智谱AI
    {
      provider: new OpenAICompatibleProviderPlugin('zhipu', '智谱AI'),
      metadata: { environment: 'all', priority: 100 },
    },

    // 注意：火山方舟和Vidu由于使用自定义协议，将在后续步骤中单独注册
    // {
    //   provider: new VolcengineProviderPlugin(),
    //   metadata: { environment: 'all', priority: 100 },
    // },
    // {
    //   provider: new ViduProviderPlugin(),
    //   metadata: { environment: 'all', priority: 100 },
    // },

    // 魔搭社区（开发测试专用）
    // {
    //   provider: new ModelscopeProviderPlugin(),
    //   metadata: { environment: 'development', priority: 50 },
    // },
  ];

  // 批量注册
  await manager.registerFromConfig(providers);

  console.log(`[PluginRegistry] Registered ${providers.length} providers`);
}

/**
 * 获取Provider管理器实例
 */
export { getProviderPluginManager } from '../core/ProviderPluginManager';
