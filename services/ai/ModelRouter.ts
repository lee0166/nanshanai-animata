/**
 * Model Router
 *
 * 智能模型路由系统，根据任务类型选择最优模型
 * 基于文档《融合方案_实施细节与代码示例》第2.3节
 * 改进版：支持动态模型能力匹配，成本作为提示而非限制
 *
 * @module services/ai/ModelRouter
 * @version 3.0.0
 */

import { llmProvider } from './providers/LLMProvider';
import { ModelConfig } from '../../types';

export type TaskType =
  | 'global_summary'
  | 'entity_extraction'
  | 'character_analysis'
  | 'scene_analysis'
  | 'shot_generation'
  | 'validation';

// 模型能力标签
export type ModelCapability = 
  | 'long_context'      // 长上下文 (>100K)
  | 'cheap'             // 低成本
  | 'fast'              // 快速响应
  | 'creative'          // 创意生成
  | 'accurate'          // 高精度
  | 'json_mode'         // JSON模式支持
  | 'chinese'           // 中文优化
  | 'analysis';         // 分析能力

// 模型运行时信息（包含价格和用户配置）
export interface ModelRuntimeInfo {
  name: string;
  provider: string;
  maxTokens: number;
  contextWindow: number;
  costPer1KInput: number;   // 从用户配置读取，有默认值
  costPer1KOutput: number;  // 从用户配置读取，有默认值
  capabilities: ModelCapability[];
  rateLimit: number;
  config: ModelConfig;      // 原始配置引用
}

export interface RoutingDecision {
  model: string;
  estimatedCost: number;
  estimatedTime: number;
  reason: string;
  alternatives: Array<{
    model: string;
    estimatedCost: number;
    reason: string;
  }>;
}

export interface RouteResult {
  content: string;
  modelUsed: string;
  tokensUsed: { input: number; output: number };
  cost: number;
  latency: number;
}

// 任务需求定义（移除 maxCostPer1K 硬性限制）
interface TaskRequirement {
  requiredCapabilities: ModelCapability[];
  preferredCapabilities: ModelCapability[];
  minContextWindow: number;
  description: string;
}

// 默认价格（当用户未配置时使用）
const DEFAULT_COST_PER_1K = {
  input: 0.01,
  output: 0.03
};

export class ModelRouter {
  private modelRuntimes: Map<string, ModelRuntimeInfo> = new Map();

  // 任务需求配置（与具体模型无关，移除成本限制）
  private taskRequirements: Record<TaskType, TaskRequirement> = {
    'global_summary': {
      requiredCapabilities: ['long_context'],
      preferredCapabilities: ['chinese', 'creative'],
      minContextWindow: 100000,
      description: '需要处理长文本，生成长摘要'
    },
    'entity_extraction': {
      requiredCapabilities: ['json_mode'],
      preferredCapabilities: ['cheap', 'fast', 'accurate'],
      minContextWindow: 8000,
      description: '结构化提取，需要JSON输出'
    },
    'character_analysis': {
      requiredCapabilities: ['creative'],
      preferredCapabilities: ['accurate', 'chinese'],
      minContextWindow: 16000,
      description: '创意分析，需要深度理解'
    },
    'scene_analysis': {
      requiredCapabilities: ['creative'],
      preferredCapabilities: ['accurate', 'chinese'],
      minContextWindow: 16000,
      description: '场景分析，视觉描述'
    },
    'shot_generation': {
      requiredCapabilities: ['creative'],
      preferredCapabilities: ['accurate'],
      minContextWindow: 8000,
      description: '分镜生成，创意输出'
    },
    'validation': {
      requiredCapabilities: ['accurate'],
      preferredCapabilities: ['cheap', 'fast'],
      minContextWindow: 4000,
      description: '验证检查，需要准确'
    }
  };

  /**
   * 注册模型（从 ModelConfig 读取价格，支持用户配置）
   */
  registerModel(name: string, config: ModelConfig): void {
    // 从用户配置读取价格，未配置使用默认值
    const costPer1KInput = config.costPer1KInput ?? DEFAULT_COST_PER_1K.input;
    const costPer1KOutput = config.costPer1KOutput ?? DEFAULT_COST_PER_1K.output;

    // 从 capabilities 中提取信息
    const contextWindow = config.capabilities?.maxContextLength ?? 32000;
    const maxTokens = config.capabilities?.maxTokens ?? 4000;

    // 自动推断能力标签
    const capabilities = this.inferCapabilities(config, contextWindow, costPer1KInput);

    const runtimeInfo: ModelRuntimeInfo = {
      name: config.name,
      provider: config.provider,
      maxTokens,
      contextWindow,
      costPer1KInput,
      costPer1KOutput,
      capabilities,
      rateLimit: 10,
      config
    };

    this.modelRuntimes.set(name, runtimeInfo);
  }

  /**
   * 注销模型
   */
  unregisterModel(name: string): void {
    this.modelRuntimes.delete(name);
  }

  /**
   * 自动推断模型能力
   */
  private inferCapabilities(config: ModelConfig, contextWindow: number, cost: number): ModelCapability[] {
    const caps: ModelCapability[] = [];

    // 长上下文
    if (contextWindow >= 100000) {
      caps.push('long_context');
    }

    // 低成本（低于默认价格的一半）
    if (cost < 0.005) {
      caps.push('cheap');
    }

    // JSON模式支持
    if (config.capabilities?.supportsJsonMode) {
      caps.push('json_mode');
    }

    // 中文优化（根据提供商推断）
    if (['aliyun', 'moonshot', 'baidu'].includes(config.provider)) {
      caps.push('chinese');
    }

    // 创意能力（默认所有LLM都有）
    if (config.type === 'llm') {
      caps.push('creative');
    }

    // 高精度（贵的模型）
    if (cost > 0.02) {
      caps.push('accurate');
    }

    return caps;
  }

  /**
   * 获取路由决策（基于能力匹配，成本作为提示）
   */
  getRoutingDecision(
    taskType: TaskType, 
    promptLength: number,
    preferredModel?: string
  ): RoutingDecision {
    // 如果用户指定了模型，直接使用
    if (preferredModel && this.modelRuntimes.has(preferredModel)) {
      const modelInfo = this.modelRuntimes.get(preferredModel)!;
      const cost = this.estimateCost(preferredModel, promptLength);
      return {
        model: preferredModel,
        estimatedCost: cost,
        estimatedTime: 3000,
        reason: '用户指定',
        alternatives: []
      };
    }

    // 基于能力匹配
    const requirement = this.taskRequirements[taskType];
    const scoredModels = this.getScoredModels(requirement);

    if (scoredModels.length === 0) {
      throw new Error(
        `No suitable model found for task ${taskType}. ` +
        `Please register a model with required capabilities: ${requirement.requiredCapabilities.join(', ')}`
      );
    }

    // 选择得分最高的模型
    const bestModel = scoredModels[0];
    
    // 收集备选方案（前3个）
    const alternatives = scoredModels.slice(1, 4).map(m => ({
      model: m.name,
      estimatedCost: this.estimateCost(m.name, promptLength),
      reason: `匹配度: ${m.score.toFixed(1)}分, 成本: $${m.costPer1K}/1K`
    }));

    return {
      model: bestModel.name,
      estimatedCost: this.estimateCost(bestModel.name, promptLength),
      estimatedTime: 3000,
      reason: `匹配能力: ${bestModel.matchedCapabilities.join(', ')}, ` +
              `成本: $${bestModel.costPer1K}/1K tokens ` +
              `(输入$${bestModel.inputCost}/1K, 输出$${bestModel.outputCost}/1K)`,
      alternatives
    };
  }

  /**
   * 路由并执行任务
   */
  async routeAndExecute(
    taskType: TaskType,
    prompt: string,
    options: {
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      preferredModel?: string;
    } = {}
  ): Promise<RouteResult> {
    const startTime = Date.now();
    
    // 获取路由决策
    const decision = this.getRoutingDecision(
      taskType, 
      prompt.length,
      options.preferredModel
    );

    const modelName = decision.model;
    const runtimeInfo = this.modelRuntimes.get(modelName);
    
    if (!runtimeInfo) {
      throw new Error(`Model ${modelName} not found`);
    }

    try {
      const result = await llmProvider.generateText(
        prompt,
        runtimeInfo.config,
        options.systemPrompt || '你是一个专业的剧本分析助手。'
      );

      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      const inputTokens = this.estimateTokens(prompt);
      const outputTokens = this.estimateTokens(result.data || '');
      
      // 使用实际价格计算成本
      const actualCost = (inputTokens / 1000) * runtimeInfo.costPer1KInput +
                         (outputTokens / 1000) * runtimeInfo.costPer1KOutput;

      return {
        content: result.data || '',
        modelUsed: modelName,
        tokensUsed: { input: inputTokens, output: outputTokens },
        cost: actualCost,
        latency: Date.now() - startTime
      };

    } catch (error) {
      console.error(`[ModelRouter] Model ${modelName} failed:`, error);
      throw error;
    }
  }

  /**
   * 批量执行
   */
  async routeAndExecuteBatch(
    taskType: TaskType,
    prompts: string[],
    options: {
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      preferredModel?: string;
      concurrency?: number;
    } = {}
  ): Promise<RouteResult[]> {
    const results: RouteResult[] = [];

    for (let i = 0; i < prompts.length; i++) {
      try {
        const result = await this.routeAndExecute(taskType, prompts[i], options);
        results[i] = result;
      } catch (error) {
        results[i] = {
          content: '',
          modelUsed: 'none',
          tokensUsed: { input: 0, output: 0 },
          cost: 0,
          latency: 0
        };
      }
    }

    return results;
  }

  /**
   * 获取模型评分列表（按匹配度排序，成本作为评分因素而非门槛）
   */
  private getScoredModels(requirement: TaskRequirement): Array<{
    name: string;
    score: number;
    matchedCapabilities: string[];
    costPer1K: number;
    inputCost: number;
    outputCost: number;
  }> {
    const scored: Array<{
      name: string;
      score: number;
      matchedCapabilities: string[];
      costPer1K: number;
      inputCost: number;
      outputCost: number;
    }> = [];

    for (const [name, info] of this.modelRuntimes.entries()) {
      // 检查基本要求：上下文窗口
      if (info.contextWindow < requirement.minContextWindow) {
        continue;
      }

      // 计算匹配分数
      let score = 0;
      const matchedCapabilities: string[] = [];

      // 必需能力（必须全部满足）- 硬性门槛
      const hasAllRequired = requirement.requiredCapabilities.every(cap => {
        if (info.capabilities.includes(cap)) {
          score += 10;
          matchedCapabilities.push(cap);
          return true;
        }
        return false;
      });

      if (!hasAllRequired) {
        continue; // 不满足必需能力，排除
      }

      // 优选能力（满足加分）
      requirement.preferredCapabilities.forEach(cap => {
        if (info.capabilities.includes(cap)) {
          score += 5;
          matchedCapabilities.push(cap);
        }
      });

      // 成本评分（便宜加分，但不排除贵的）
      const avgCost = (info.costPer1KInput + info.costPer1KOutput) / 2;
      // 成本越低分越高，但即使很贵也能用（只是分数低）
      const costScore = Math.max(0, 5 - avgCost * 100); // 最高加5分
      score += costScore;

      // 上下文窗口加分
      const contextScore = Math.min(5, info.contextWindow / 50000);
      score += contextScore;

      scored.push({
        name,
        score,
        matchedCapabilities,
        costPer1K: avgCost,
        inputCost: info.costPer1KInput,
        outputCost: info.costPer1KOutput
      });
    }

    // 按分数排序（高到低）
    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * 估算成本（使用用户配置的价格）
   */
  private estimateCost(modelName: string, inputLength: number, outputLength?: number): number {
    const info = this.modelRuntimes.get(modelName);
    if (!info) return 0;

    const inputTokens = this.estimateTokens('x'.repeat(inputLength));
    const outputTokens = outputLength ? this.estimateTokens('x'.repeat(outputLength)) : info.maxTokens * 0.5;

    return (inputTokens / 1000) * info.costPer1KInput +
           (outputTokens / 1000) * info.costPer1KOutput;
  }

  /**
   * 估算token数量
   */
  private estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return Math.ceil(chineseChars + englishWords * 1.3);
  }

  /**
   * 获取可用模型列表
   */
  getAvailableModels(): string[] {
    return Array.from(this.modelRuntimes.keys());
  }

  /**
   * 获取模型运行时信息
   */
  getModelRuntimeInfo(name: string): ModelRuntimeInfo | undefined {
    return this.modelRuntimes.get(name);
  }

  /**
   * 更新任务需求配置
   */
  updateTaskRequirement(taskType: TaskType, requirement: Partial<TaskRequirement>): void {
    if (this.taskRequirements[taskType]) {
      this.taskRequirements[taskType] = {
        ...this.taskRequirements[taskType],
        ...requirement
      };
    }
  }

  /**
   * 添加新任务类型
   */
  addTaskType(taskType: string, requirement: TaskRequirement): void {
    this.taskRequirements[taskType as TaskType] = requirement;
  }
}

// 导出单例实例
export const modelRouter = new ModelRouter();
