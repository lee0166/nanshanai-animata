/**
 * Model Router Tests
 *
 * 测试用例基于文档《融合方案_实施细节与代码示例》第2.3节
 * 改进版：支持动态模型能力匹配，成本作为提示而非限制
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelRouter, TaskType, modelRouter, ModelCapability } from './ModelRouter';
import { llmProvider } from './providers/LLMProvider';

// Mock LLMProvider
vi.mock('./providers/LLMProvider', () => ({
  llmProvider: {
    generateText: vi.fn()
  }
}));

describe('ModelRouter', () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = new ModelRouter();
    vi.clearAllMocks();
  });

  // 辅助函数：创建模型配置
  const createModelConfig = (
    name: string,
    provider: string,
    costInput?: number,
    costOutput?: number,
    contextWindow: number = 32000
  ) => ({
    id: name,
    name: name,
    provider: provider,
    modelId: name,
    type: 'llm' as const,
    capabilities: {
      maxTokens: 4000,
      maxContextLength: contextWindow,
      supportsJsonMode: true,
      supportsTextOutput: true
    },
    parameters: [],
    costPer1KInput: costInput,
    costPer1KOutput: costOutput
  });

  describe('Model Registration with Price', () => {
    it('should register model with user-configured price', () => {
      router.registerModel('qwen', createModelConfig('qwen', 'aliyun', 0.002, 0.006));

      const runtimeInfo = router.getModelRuntimeInfo('qwen');
      expect(runtimeInfo).toBeDefined();
      expect(runtimeInfo?.costPer1KInput).toBe(0.002);
      expect(runtimeInfo?.costPer1KOutput).toBe(0.006);
    });

    it('should use default price when user does not configure', () => {
      router.registerModel('unknown-model', createModelConfig('unknown-model', 'test'));

      const runtimeInfo = router.getModelRuntimeInfo('unknown-model');
      expect(runtimeInfo).toBeDefined();
      expect(runtimeInfo?.costPer1KInput).toBe(0.01); // 默认值
      expect(runtimeInfo?.costPer1KOutput).toBe(0.03); // 默认值
    });

    it('should auto-infer capabilities based on price and provider', () => {
      // 便宜的国产模型
      router.registerModel('cheap-chinese', createModelConfig('cheap-chinese', 'aliyun', 0.001, 0.003));
      let runtimeInfo = router.getModelRuntimeInfo('cheap-chinese');
      expect(runtimeInfo?.capabilities).toContain('cheap');
      expect(runtimeInfo?.capabilities).toContain('chinese');

      // 贵的模型
      router.registerModel('expensive', createModelConfig('expensive', 'openai', 0.05, 0.15));
      runtimeInfo = router.getModelRuntimeInfo('expensive');
      expect(runtimeInfo?.capabilities).toContain('accurate');
    });

    it('should unregister model', () => {
      router.registerModel('test-model', createModelConfig('test-model', 'test'));
      expect(router.getAvailableModels()).toContain('test-model');

      router.unregisterModel('test-model');
      expect(router.getAvailableModels()).not.toContain('test-model');
    });
  });

  describe('Capability-based Routing without Cost Limit', () => {
    beforeEach(() => {
      // 注册测试模型 - 不同价格
      router.registerModel('expensive-model', createModelConfig('expensive-model', 'openai', 0.05, 0.15, 128000));
      router.registerModel('cheap-model', createModelConfig('cheap-model', 'aliyun', 0.001, 0.003, 32000));
      router.registerModel('mid-model', createModelConfig('mid-model', 'moonshot', 0.01, 0.03, 200000));
    });

    it('should route to model with required capabilities regardless of cost', () => {
      // entity_extraction 需要 json_mode
      // 所有模型都应该可用（不因为贵而排除）
      const decision = router.getRoutingDecision('entity_extraction', 1000);

      expect(decision.model).toBeDefined();
      // 应该选择了某个模型（不会因为贵而报错）
      expect(['expensive-model', 'cheap-model', 'mid-model']).toContain(decision.model);
    });

    it('should prefer cheaper model when both satisfy requirements', () => {
      // 先清空之前注册的模型
      router.unregisterModel('expensive-model');
      router.unregisterModel('cheap-model');
      router.unregisterModel('mid-model');
      
      // 注册两个都满足要求的模型
      router.registerModel('model-a', createModelConfig('model-a', 'test', 0.001, 0.003, 32000));
      router.registerModel('model-b', createModelConfig('model-b', 'test', 0.01, 0.03, 32000));

      const decision = router.getRoutingDecision('entity_extraction', 1000);

      // 应该选择更便宜的 model-a
      expect(decision.model).toBe('model-a');
    });

    it('should use preferred model when specified', () => {
      const decision = router.getRoutingDecision('entity_extraction', 1000, 'expensive-model');

      expect(decision.model).toBe('expensive-model');
      expect(decision.reason).toBe('用户指定');
    });

    it('should return alternatives in decision', () => {
      const decision = router.getRoutingDecision('entity_extraction', 1000);

      expect(decision.alternatives).toBeDefined();
      expect(decision.alternatives.length).toBeGreaterThan(0);
      // 备选方案应该包含成本信息
      expect(decision.alternatives[0].estimatedCost).toBeGreaterThan(0);
    });

    it('should include cost info in reason', () => {
      const decision = router.getRoutingDecision('entity_extraction', 1000);

      expect(decision.reason).toContain('成本');
      expect(decision.reason).toContain('$');
    });

    it('should throw error when no model has required capabilities', () => {
      // 清空所有模型
      router.unregisterModel('expensive-model');
      router.unregisterModel('cheap-model');
      router.unregisterModel('mid-model');

      // 注册一个没有 json_mode 的模型
      router.registerModel('no-json', {
        ...createModelConfig('no-json', 'test'),
        capabilities: {
          maxTokens: 4000,
          maxContextLength: 32000,
          supportsJsonMode: false, // 不支持JSON
          supportsTextOutput: true
        }
      });

      expect(() => router.getRoutingDecision('entity_extraction', 1000))
        .toThrow('No suitable model found');
    });
  });

  describe('Cost as Scoring Factor (Not Hard Limit)', () => {
    it('should not exclude expensive model if it is the only option', () => {
      // 只注册一个贵的模型
      router.registerModel('only-expensive', createModelConfig('only-expensive', 'openai', 0.1, 0.3, 128000));

      const decision = router.getRoutingDecision('entity_extraction', 1000);

      // 应该能用（不因为贵而排除）
      expect(decision.model).toBe('only-expensive');
      expect(decision.estimatedCost).toBeGreaterThan(0);
    });

    it('should score expensive model lower but still usable', () => {
      // 注册两个都满足要求的模型，一个贵一个便宜
      router.registerModel('cheap', createModelConfig('cheap', 'test', 0.001, 0.003, 32000));
      router.registerModel('expensive', createModelConfig('expensive', 'test', 0.1, 0.3, 32000));

      const decision = router.getRoutingDecision('entity_extraction', 1000);

      // 应该选择便宜的
      expect(decision.model).toBe('cheap');

      // 但贵的也在备选方案中
      const expensiveAlternative = decision.alternatives.find(a => a.model === 'expensive');
      expect(expensiveAlternative).toBeDefined();
    });
  });

  describe('Route and Execute', () => {
    beforeEach(() => {
      router.registerModel('test-model', createModelConfig('test-model', 'test', 0.01, 0.03));

      vi.mocked(llmProvider.generateText).mockResolvedValue({
        success: true,
        data: 'test result'
      });
    });

    it('should execute with selected model and calculate actual cost', async () => {
      const result = await router.routeAndExecute('entity_extraction', 'test prompt');

      expect(result.modelUsed).toBe('test-model');
      expect(result.content).toBe('test result');
      expect(result.cost).toBeGreaterThan(0); // 使用配置的价格计算
    });

    it('should use user-configured price for cost calculation', async () => {
      // 注册一个特定价格的模型
      router.registerModel('priced-model', createModelConfig('priced-model', 'test', 0.001, 0.003));

      const result = await router.routeAndExecute('entity_extraction', 'test prompt');

      // 成本应该基于 0.001/0.003 计算
      expect(result.cost).toBeLessThan(0.01); // 应该很便宜
    });
  });

  describe('Dynamic Model Updates', () => {
    it('should adapt when new cheaper model is added', () => {
      // 初始只有贵的模型
      router.registerModel('expensive', createModelConfig('expensive', 'test', 0.1, 0.3));

      let decision = router.getRoutingDecision('entity_extraction', 1000);
      expect(decision.model).toBe('expensive');

      // 添加更便宜的模型
      router.registerModel('cheap', createModelConfig('cheap', 'test', 0.001, 0.003));

      decision = router.getRoutingDecision('entity_extraction', 1000);
      expect(decision.model).toBe('cheap'); // 现在选择便宜的
    });

    it('should fallback when model is removed', () => {
      router.registerModel('model-a', createModelConfig('model-a', 'test', 0.01, 0.03));
      router.registerModel('model-b', createModelConfig('model-b', 'test', 0.02, 0.06));

      let decision = router.getRoutingDecision('entity_extraction', 1000);
      expect(decision.model).toBe('model-a'); // 选便宜的

      // 移除便宜的
      router.unregisterModel('model-a');

      decision = router.getRoutingDecision('entity_extraction', 1000);
      expect(decision.model).toBe('model-b'); // 回退到model-b
    });
  });

  describe('Custom Task Types', () => {
    it('should support adding custom task types', () => {
      // 注册一个有 accurate 能力的模型（贵的模型会自动获得 accurate 标签）
      router.registerModel('accurate-model', createModelConfig('accurate-model', 'test', 0.05, 0.15));
      
      router.addTaskType('custom_task' as TaskType, {
        requiredCapabilities: ['accurate'],
        preferredCapabilities: ['fast'],
        minContextWindow: 8000,
        description: '自定义任务'
      });

      const decision = router.getRoutingDecision('custom_task' as TaskType, 1000);
      expect(decision.model).toBe('accurate-model');
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton instance', () => {
      expect(modelRouter).toBeDefined();
      expect(modelRouter).toBeInstanceOf(ModelRouter);
    });
  });
});
