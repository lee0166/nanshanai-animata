import { ModelCapabilities, ModelParameter } from '../types';

/**
 * 模型模板类型
 */
export type ModelType = 'image' | 'video' | 'llm';

/**
 * 环境限制
 */
export type Environment = 'all' | 'development' | 'production';

/**
 * Provider特定选项
 */
export interface ProviderSpecificOptions {
  provider: string;
  protocol: string;
  strategy?: string;
  endpoint?: string;
  apiVersion?: string;
  region?: string;
  [key: string]: any;
}

/**
 * 模型模板接口
 *
 * 支持继承机制，减少重复配置
 */
export interface ModelTemplate {
  /** 模板唯一标识 */
  id: string;

  /** 模板显示名称 */
  name: string;

  /** 模型类型 */
  type: ModelType;

  /** 继承的父模板ID */
  extends?: string;

  /** 模型能力 */
  capabilities: ModelCapabilities;

  /** 模型参数 */
  parameters: ModelParameter[];

  /** Provider特定选项 */
  providerOptions?: ProviderSpecificOptions;

  /** 环境限制 */
  environment: Environment;

  /** 模板版本 */
  version?: string;

  /** 是否弃用 */
  deprecated?: boolean;

  /** 弃用提示 */
  deprecationMessage?: string;

  /** 替代模板ID */
  replacementTemplateId?: string;
}

/**
 * 基础图像生成模板
 *
 * 所有图像模型的基础配置
 */
export const BASE_IMAGE_TEMPLATE: ModelTemplate = {
  id: 'template-base-image',
  name: '基础图像生成模板',
  type: 'image',

  capabilities: {
    supportsReferenceImage: true,
    maxReferenceImages: 5,
    maxBatchSize: 1,
    supportedResolutions: ['1K', '2K', '4K'],
    supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    defaultResolution: '2K',
  },

  parameters: [
    {
      name: 'resolution',
      type: 'select',
      label: '分辨率',
      options: [
        { label: '1K', value: '1K' },
        { label: '2K', value: '2K' },
        { label: '4K', value: '4K' },
      ],
      defaultValue: '2K',
    },
    {
      name: 'aspectRatio',
      type: 'select',
      label: '宽高比',
      options: [
        { label: '1:1', value: '1:1' },
        { label: '16:9', value: '16:9' },
        { label: '9:16', value: '9:16' },
        { label: '4:3', value: '4:3' },
        { label: '3:4', value: '3:4' },
      ],
      defaultValue: '16:9',
    },
    {
      name: 'guidanceScale',
      type: 'number',
      label: '引导系数',
      min: 1,
      max: 20,
      step: 0.1,
      defaultValue: 3.5,
    },
    {
      name: 'seed',
      type: 'number',
      label: '随机种子',
      defaultValue: -1,
      description: '-1表示随机',
    },
  ],

  environment: 'all',
  version: '1.0.0',
};

/**
 * 基础视频生成模板
 */
export const BASE_VIDEO_TEMPLATE: ModelTemplate = {
  id: 'template-base-video',
  name: '基础视频生成模板',
  type: 'video',

  capabilities: {
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsReferenceImage: false,
    maxReferenceImages: 0,
    supportedGenerationTypes: ['text_to_video'],
    supportsAudioGeneration: false,
  },

  parameters: [
    {
      name: 'duration',
      type: 'number',
      label: '时长(秒)',
      min: 3,
      max: 10,
      step: 1,
      defaultValue: 5,
    },
    {
      name: 'aspectRatio',
      type: 'select',
      label: '宽高比',
      options: [
        { label: '16:9', value: '16:9' },
        { label: '9:16', value: '9:16' },
        { label: '1:1', value: '1:1' },
        { label: '4:3', value: '4:3' },
        { label: '3:4', value: '3:4' },
      ],
      defaultValue: '16:9',
    },
    {
      name: 'resolution',
      type: 'select',
      label: '分辨率',
      options: [
        { label: '480p', value: '480p' },
        { label: '720p', value: '720p' },
        { label: '1080p', value: '1080p' },
      ],
      defaultValue: '720p',
    },
    {
      name: 'seed',
      type: 'number',
      label: '随机种子',
      defaultValue: -1,
      description: '-1表示随机',
    },
  ],

  environment: 'all',
  version: '1.0.0',
};

/**
 * 基础LLM模板
 */
export const BASE_LLM_TEMPLATE: ModelTemplate = {
  id: 'template-base-llm',
  name: '基础LLM模板',
  type: 'llm',

  capabilities: {
    maxContextLength: 32000,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsFunctionCalling: false,
    supportsSystemPrompt: true,
  },

  parameters: [
    {
      name: 'temperature',
      type: 'number',
      label: '温度',
      min: 0,
      max: 2,
      step: 0.1,
      defaultValue: 0.3,
      description: '控制输出的随机性，值越高越随机',
    },
    {
      name: 'maxTokens',
      type: 'number',
      label: '最大Token数',
      min: 100,
      max: 128000,
      step: 100,
      defaultValue: 4000,
    },
    {
      name: 'topP',
      type: 'number',
      label: 'Top P',
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.9,
    },
    {
      name: 'presencePenalty',
      type: 'number',
      label: '存在惩罚',
      min: -2,
      max: 2,
      step: 0.1,
      defaultValue: 0,
    },
    {
      name: 'frequencyPenalty',
      type: 'number',
      label: '频率惩罚',
      min: -2,
      max: 2,
      step: 0.1,
      defaultValue: 0,
    },
  ],

  environment: 'all',
  version: '1.0.0',
};

/**
 * 火山方舟图像模板
 */
export const VOLCENGINE_IMAGE_TEMPLATE: ModelTemplate = {
  id: 'template-volcengine-image',
  name: '火山方舟图像生成模板',
  type: 'image',
  extends: 'template-base-image',

  capabilities: {
    supportsReferenceImage: true,
    maxReferenceImages: 10,
    maxBatchSize: 4,
    supportedResolutions: ['1K', '2K', '4K'],
    supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
    defaultResolution: '2K',
    minPixels: 3686400,
    maxPixels: 16777216,
    minAspectRatio: 0.0625,
    maxAspectRatio: 16,
  },

  parameters: [
    {
      name: 'resolution',
      type: 'select',
      label: '分辨率',
      options: [
        { label: '1K', value: '1K' },
        { label: '2K', value: '2K' },
        { label: '4K', value: '4K' },
      ],
      defaultValue: '2K',
    },
    {
      name: 'aspectRatio',
      type: 'select',
      label: '宽高比',
      options: [
        { label: '1:1', value: '1:1' },
        { label: '16:9', value: '16:9' },
        { label: '9:16', value: '9:16' },
        { label: '4:3', value: '4:3' },
        { label: '3:4', value: '3:4' },
        { label: '3:2', value: '3:2' },
        { label: '2:3', value: '2:3' },
        { label: '21:9', value: '21:9' },
      ],
      defaultValue: '16:9',
    },
    {
      name: 'guidanceScale',
      type: 'number',
      label: '引导系数',
      min: 1,
      max: 20,
      step: 0.1,
      defaultValue: 3.5,
    },
    {
      name: 'seed',
      type: 'number',
      label: '随机种子',
      defaultValue: -1,
      description: '-1表示随机',
    },
    {
      name: 'watermark',
      type: 'boolean',
      label: '水印',
      defaultValue: false,
    },
  ],

  providerOptions: {
    provider: 'volcengine',
    protocol: 'volcengine',
    strategy: 'seedream-4',
  },

  environment: 'all',
  version: '1.0.0',
};

/**
 * 火山方舟视频模板
 */
export const VOLCENGINE_VIDEO_TEMPLATE: ModelTemplate = {
  id: 'template-volcengine-video',
  name: '火山方舟视频生成模板',
  type: 'video',
  extends: 'template-base-video',

  capabilities: {
    supportsStartFrame: true,
    supportsEndFrame: true,
    supportsReferenceImage: true,
    maxReferenceImages: 10,
    supportedGenerationTypes: ['text_to_video', 'first_last_frame', 'multi_ref'],
    supportsAudioGeneration: true,
  },

  parameters: [
    {
      name: 'duration',
      type: 'number',
      label: '时长(秒)',
      min: 3,
      max: 10,
      step: 1,
      defaultValue: 5,
    },
    {
      name: 'aspectRatio',
      type: 'select',
      label: '宽高比',
      options: [
        { label: '16:9', value: '16:9' },
        { label: '9:16', value: '9:16' },
        { label: '4:3', value: '4:3' },
        { label: '3:4', value: '3:4' },
        { label: '1:1', value: '1:1' },
      ],
      defaultValue: '16:9',
    },
    {
      name: 'resolution',
      type: 'select',
      label: '分辨率',
      options: [
        { label: '480p', value: '480p' },
        { label: '720p', value: '720p' },
        { label: '1080p', value: '1080p' },
      ],
      defaultValue: '720p',
    },
    {
      name: 'seed',
      type: 'number',
      label: '随机种子',
      defaultValue: -1,
      description: '-1表示随机',
    },
    {
      name: 'watermark',
      type: 'boolean',
      label: '水印',
      defaultValue: false,
    },
    {
      name: 'generateAudio',
      type: 'boolean',
      label: '生成音频',
      defaultValue: true,
    },
  ],

  providerOptions: {
    provider: 'volcengine',
    protocol: 'volcengine',
  },

  environment: 'all',
  version: '1.0.0',
};

/**
 * OpenAI兼容LLM模板
 *
 * 适用于：阿里百炼、DeepSeek、Kimi、智谱等
 */
export const OPENAI_COMPATIBLE_LLM_TEMPLATE: ModelTemplate = {
  id: 'template-openai-llm',
  name: 'OpenAI兼容LLM模板',
  type: 'llm',
  extends: 'template-base-llm',

  capabilities: {
    maxContextLength: 32000,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsFunctionCalling: true,
    supportsSystemPrompt: true,
  },

  parameters: [
    {
      name: 'temperature',
      type: 'number',
      label: '温度',
      min: 0,
      max: 2,
      step: 0.1,
      defaultValue: 0.3,
    },
    {
      name: 'maxTokens',
      type: 'number',
      label: '最大Token数',
      min: 100,
      max: 32000,
      step: 100,
      defaultValue: 4000,
    },
    {
      name: 'topP',
      type: 'number',
      label: 'Top P',
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.9,
    },
    {
      name: 'presencePenalty',
      type: 'number',
      label: '存在惩罚',
      min: -2,
      max: 2,
      step: 0.1,
      defaultValue: 0,
    },
    {
      name: 'frequencyPenalty',
      type: 'number',
      label: '频率惩罚',
      min: -2,
      max: 2,
      step: 0.1,
      defaultValue: 0,
    },
  ],

  providerOptions: {
    provider: 'openai-compatible',
    protocol: 'openai',
  },

  environment: 'all',
  version: '1.0.0',
};

/**
 * 魔搭社区开发测试模板
 */
export const MODELSCOPE_DEV_TEMPLATE: ModelTemplate = {
  id: 'template-modelscope-dev',
  name: '魔搭社区开发测试模板',
  type: 'image',

  capabilities: {
    supportsReferenceImage: true,
    maxReferenceImages: 5,
    maxBatchSize: 1,
    supportedResolutions: ['1024x1024'],
    defaultResolution: '1024x1024',
    minPixels: 1048576,
    maxPixels: 1048576,
  },

  parameters: [
    {
      name: 'resolution',
      type: 'select',
      label: '分辨率',
      options: [{ label: '1024x1024', value: '1024x1024' }],
      defaultValue: '1024x1024',
    },
    {
      name: 'guidanceScale',
      type: 'number',
      label: '引导系数',
      min: 1,
      max: 10,
      step: 0.1,
      defaultValue: 3.5,
    },
  ],

  providerOptions: {
    provider: 'modelscope',
    protocol: 'openai',
  },

  environment: 'development',
  version: '1.0.0',
};

/**
 * 模型模板注册表
 */
export class ModelTemplateRegistry {
  private templates = new Map<string, ModelTemplate>();
  private initialized = false;

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * 初始化默认模板
   */
  private initializeDefaultTemplates(): void {
    if (this.initialized) return;

    // 注册基础模板
    this.register(BASE_IMAGE_TEMPLATE);
    this.register(BASE_VIDEO_TEMPLATE);
    this.register(BASE_LLM_TEMPLATE);

    // 注册厂商模板
    this.register(VOLCENGINE_IMAGE_TEMPLATE);
    this.register(VOLCENGINE_VIDEO_TEMPLATE);
    this.register(OPENAI_COMPATIBLE_LLM_TEMPLATE);

    // 注册开发测试模板
    this.register(MODELSCOPE_DEV_TEMPLATE);

    this.initialized = true;
    console.log(`[ModelTemplateRegistry] Registered ${this.templates.size} templates`);
  }

  /**
   * 注册模板
   */
  register(template: ModelTemplate): void {
    // 处理继承
    if (template.extends) {
      const parent = this.templates.get(template.extends);
      if (parent) {
        template = this.mergeTemplate(parent, template);
      } else {
        console.warn(`[ModelTemplateRegistry] Parent template not found: ${template.extends}`);
      }
    }

    this.templates.set(template.id, template);
  }

  /**
   * 获取模板
   */
  getTemplate(id: string): ModelTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): ModelTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 按类型获取模板
   */
  getTemplatesByType(type: ModelType): ModelTemplate[] {
    return this.getAllTemplates().filter(t => t.type === type);
  }

  /**
   * 按Provider获取模板
   */
  getTemplatesByProvider(provider: string): ModelTemplate[] {
    return this.getAllTemplates().filter(t => t.providerOptions?.provider === provider);
  }

  /**
   * 检查模板是否存在
   */
  hasTemplate(id: string): boolean {
    return this.templates.has(id);
  }

  /**
   * 合并模板（继承逻辑）
   */
  private mergeTemplate(parent: ModelTemplate, child: ModelTemplate): ModelTemplate {
    return {
      ...parent,
      ...child,
      capabilities: {
        ...parent.capabilities,
        ...child.capabilities,
      },
      parameters: this.mergeParameters(parent.parameters, child.parameters),
    };
  }

  /**
   * 合并参数（子模板可覆盖父模板）
   */
  private mergeParameters(parent: ModelParameter[], child: ModelParameter[]): ModelParameter[] {
    const merged = new Map<string, ModelParameter>();

    // 先添加父模板参数
    for (const param of parent) {
      merged.set(param.name, param);
    }

    // 子模板参数覆盖
    for (const param of child) {
      const existing = merged.get(param.name);
      if (existing) {
        merged.set(param.name, { ...existing, ...param });
      } else {
        merged.set(param.name, param);
      }
    }

    return Array.from(merged.values());
  }
}

// 全局单例
let globalTemplateRegistry: ModelTemplateRegistry | null = null;

/**
 * 获取模型模板注册表实例
 */
export function getModelTemplateRegistry(): ModelTemplateRegistry {
  if (!globalTemplateRegistry) {
    globalTemplateRegistry = new ModelTemplateRegistry();
  }
  return globalTemplateRegistry;
}

/**
 * 重置模型模板注册表（主要用于测试）
 */
export function resetModelTemplateRegistry(): void {
  globalTemplateRegistry = null;
}

/**
 * 预定义的模板列表（用于导出）
 */
export const PREDEFINED_TEMPLATES = {
  // 基础模板
  BASE_IMAGE: BASE_IMAGE_TEMPLATE,
  BASE_VIDEO: BASE_VIDEO_TEMPLATE,
  BASE_LLM: BASE_LLM_TEMPLATE,

  // 厂商模板
  VOLCENGINE_IMAGE: VOLCENGINE_IMAGE_TEMPLATE,
  VOLCENGINE_VIDEO: VOLCENGINE_VIDEO_TEMPLATE,
  OPENAI_LLM: OPENAI_COMPATIBLE_LLM_TEMPLATE,

  // 开发测试模板
  MODELSCOPE_DEV: MODELSCOPE_DEV_TEMPLATE,
};

/**
 * 全局模型模板注册表实例
 * 用于直接导入使用
 */
export const modelTemplateRegistry = getModelTemplateRegistry();
