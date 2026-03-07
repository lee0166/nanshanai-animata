/**
 * EnvironmentConfigLoader 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnvironmentConfigLoader, DEV_ONLY_PROVIDERS } from '../EnvironmentConfigLoader';
import type { ModelConfig } from '../../../types';

describe('EnvironmentConfigLoader', () => {
  let loader: EnvironmentConfigLoader;

  beforeEach(() => {
    // 默认使用开发环境
    loader = new EnvironmentConfigLoader('development');
  });

  describe('environment detection', () => {
    it('应该正确检测开发环境', () => {
      const devLoader = new EnvironmentConfigLoader('development');
      expect(devLoader.getCurrentEnvironment()).toBe('development');
      expect(devLoader.isProduction()).toBe(false);
    });

    it('应该正确检测生产环境', () => {
      const prodLoader = new EnvironmentConfigLoader('production');
      expect(prodLoader.getCurrentEnvironment()).toBe('production');
      expect(prodLoader.isProduction()).toBe(true);
    });

    it('应该正确检测测试环境', () => {
      const testLoader = new EnvironmentConfigLoader('testing');
      expect(testLoader.getCurrentEnvironment()).toBe('testing');
      expect(testLoader.isProduction()).toBe(false);
    });
  });

  describe('provider validation', () => {
    it('开发环境应该允许所有Provider', () => {
      expect(loader.isProviderAllowed('modelscope')).toBe(true);
      expect(loader.isProviderAllowed('volcengine')).toBe(true);
      expect(loader.isProviderAllowed('aliyun')).toBe(true);
    });

    it('生产环境应该阻止开发测试Provider', () => {
      const prodLoader = new EnvironmentConfigLoader('production');
      expect(prodLoader.isProviderAllowed('modelscope')).toBe(false);
      expect(prodLoader.isProviderAllowed('localhost')).toBe(false);
      expect(prodLoader.isProviderAllowed('127.0.0.1')).toBe(false);
    });

    it('生产环境应该允许商用Provider', () => {
      const prodLoader = new EnvironmentConfigLoader('production');
      expect(prodLoader.isProviderAllowed('volcengine')).toBe(true);
      expect(prodLoader.isProviderAllowed('aliyun')).toBe(true);
      expect(prodLoader.isProviderAllowed('openai')).toBe(true);
    });
  });

  describe('dev model detection', () => {
    it('应该识别魔搭社区模型', () => {
      const model: ModelConfig = {
        id: 'test',
        name: '魔搭模型',
        type: 'image',
        provider: 'modelscope',
        modelId: 'test-model',
        apiKey: '',
        enabled: true,
        capabilities: {}
      };

      expect(loader.isDevOnlyModel(model)).toBe(true);
    });

    it('应该识别测试模型', () => {
      const model: ModelConfig = {
        id: 'test',
        name: 'Test Model',
        type: 'image',
        provider: 'openai',
        modelId: 'test-model',
        apiKey: '',
        enabled: true,
        capabilities: {}
      };

      expect(loader.isDevOnlyModel(model)).toBe(true);
    });

    it('应该识别本地地址', () => {
      const model: ModelConfig = {
        id: 'test',
        name: '本地模型',
        type: 'image',
        provider: 'custom',
        modelId: 'local-model',
        baseUrl: 'http://localhost:8080',
        apiKey: '',
        enabled: true,
        capabilities: {}
      };

      expect(loader.isDevOnlyModel(model)).toBe(true);
    });

    it('应该识别商用模型', () => {
      const model: ModelConfig = {
        id: 'test',
        name: '火山方舟',
        type: 'image',
        provider: 'volcengine',
        modelId: 'seedream-4.0',
        apiKey: '',
        enabled: true,
        capabilities: {}
      };

      expect(loader.isDevOnlyModel(model)).toBe(false);
    });
  });

  describe('config filtering', () => {
    it('开发环境应该保留所有模型', () => {
      const configs: ModelConfig[] = [
        {
          id: '1',
          name: '魔搭模型',
          type: 'image',
          provider: 'modelscope',
          modelId: 'test',
          apiKey: '',
          enabled: true,
          capabilities: {}
        },
        {
          id: '2',
          name: '火山方舟',
          type: 'image',
          provider: 'volcengine',
          modelId: 'seedream',
          apiKey: '',
          enabled: true,
          capabilities: {}
        }
      ];

      const filtered = loader.filterConfigs(configs);
      expect(filtered).toHaveLength(2);
    });

    it('生产环境应该过滤开发测试模型', () => {
      const prodLoader = new EnvironmentConfigLoader('production');
      
      const configs: ModelConfig[] = [
        {
          id: '1',
          name: '魔搭模型',
          type: 'image',
          provider: 'modelscope',
          modelId: 'test',
          apiKey: '',
          enabled: true,
          capabilities: {}
        },
        {
          id: '2',
          name: '火山方舟',
          type: 'image',
          provider: 'volcengine',
          modelId: 'seedream',
          apiKey: '',
          enabled: true,
          capabilities: {}
        }
      ];

      const filtered = prodLoader.filterConfigs(configs);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('火山方舟');
    });
  });

  describe('config validation', () => {
    it('应该验证有效配置', () => {
      const model: ModelConfig = {
        id: 'test',
        name: '有效模型',
        type: 'image',
        provider: 'volcengine',
        modelId: 'test',
        apiKey: 'key',
        enabled: true,
        capabilities: {}
      };

      const result = loader.validateConfig(model);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测不允许的Provider', () => {
      const prodLoader = new EnvironmentConfigLoader('production');
      
      const model: ModelConfig = {
        id: 'test',
        name: '魔搭模型',
        type: 'image',
        provider: 'modelscope',
        modelId: 'test',
        apiKey: '',
        enabled: true,
        capabilities: {}
      };

      const result = prodLoader.validateConfig(model);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('modelscope'))).toBe(true);
    });

    it('应该检测开发测试模型', () => {
      const prodLoader = new EnvironmentConfigLoader('production');
      
      const model: ModelConfig = {
        id: 'test',
        name: '测试模型',
        type: 'image',
        provider: 'modelscope',
        modelId: 'test',
        apiKey: '',
        enabled: true,
        capabilities: {}
      };

      const result = prodLoader.validateConfig(model);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('开发测试'))).toBe(true);
    });
  });

  describe('security warnings', () => {
    it('生产环境应该返回安全提示', () => {
      const prodLoader = new EnvironmentConfigLoader('production');
      const warnings = prodLoader.getSecurityWarnings();
      
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.includes('生产环境'))).toBe(true);
    });

    it('开发环境应该返回开发提示', () => {
      const warnings = loader.getSecurityWarnings();
      
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.includes('开发环境'))).toBe(true);
    });
  });

  describe('environment labels', () => {
    it('应该为开发测试模型返回标签', () => {
      const model: ModelConfig = {
        id: 'test',
        name: '魔搭模型',
        type: 'image',
        provider: 'modelscope',
        modelId: 'test',
        apiKey: '',
        enabled: true,
        capabilities: {}
      };

      const label = loader.getModelEnvironmentLabel(model);
      expect(label).toBeDefined();
      expect(label?.label).toBe('开发测试');
    });

    it('生产环境应该为商用模型返回标签', () => {
      const prodLoader = new EnvironmentConfigLoader('production');
      
      const model: ModelConfig = {
        id: 'test',
        name: '火山方舟',
        type: 'image',
        provider: 'volcengine',
        modelId: 'test',
        apiKey: '',
        enabled: true,
        capabilities: {}
      };

      const label = prodLoader.getModelEnvironmentLabel(model);
      expect(label).toBeDefined();
      expect(label?.label).toBe('生产就绪');
    });
  });

  describe('environment variable overrides', () => {
    it('应该从环境变量读取API密钥', () => {
      // 模拟环境变量
      vi.stubGlobal('process', {
        env: {
          NODE_ENV: 'production',
          API_KEY_VOLCENGINE: 'env-api-key'
        }
      });

      const prodLoader = new EnvironmentConfigLoader('production');
      
      const model: ModelConfig = {
        id: 'test',
        name: '火山方舟',
        type: 'image',
        provider: 'volcengine',
        modelId: 'test',
        apiKey: '',  // 空密钥
        enabled: true,
        capabilities: {}
      };

      const overridden = prodLoader.applyEnvironmentOverrides(model);
      expect(overridden.apiKey).toBe('env-api-key');

      vi.unstubAllGlobals();
    });
  });
});
