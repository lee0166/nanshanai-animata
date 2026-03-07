/**
 * ModelConfigManager 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelConfigManager } from '../ModelConfigManager';
import type { ModelConfig } from '../../../types';

describe('ModelConfigManager', () => {
  let manager: ModelConfigManager;

  beforeEach(() => {
    manager = new ModelConfigManager();
  });

  describe('createFromTemplate', () => {
    it('应该从模板创建配置', () => {
      const result = manager.createFromTemplate('base-image', {
        name: '测试模型',
        apiKey: 'test-key'
      });

      expect(result.valid).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.config?.name).toBe('测试模型');
      expect(result.config?.apiKey).toBe('test-key');
    });

    it('应该处理不存在的模板', () => {
      const result = manager.createFromTemplate('non-existent-template', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('TEMPLATE_NOT_FOUND');
    });
  });

  describe('createCustom', () => {
    it('应该创建自定义配置', () => {
      const result = manager.createCustom({
        name: '自定义模型',
        type: 'image',
        provider: 'test-provider',
        modelId: 'test-model',
        apiKey: 'test-key'
      });

      expect(result.valid).toBe(true);
      expect(result.config?.name).toBe('自定义模型');
    });

    it('应该验证必填字段', () => {
      const result = manager.createCustom({
        name: '',  // 空名称
        type: 'image',
        provider: 'test',
        modelId: 'test'
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('应该验证有效配置', () => {
      const config: ModelConfig = {
        id: 'test',
        name: '测试模型',
        type: 'image',
        provider: 'test',
        modelId: 'test-model',
        apiKey: 'key',
        enabled: true,
        capabilities: { textToImage: true }
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(true);
    });

    it('应该检测缺少必填字段', () => {
      const config = {
        id: 'test',
        name: '',
        type: 'image',
        provider: 'test',
        modelId: 'test-model'
      } as ModelConfig;

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该检测魔搭社区在生产环境的使用', () => {
      // 模拟生产环境
      vi.stubGlobal('process', { env: { NODE_ENV: 'production' } });

      const config: ModelConfig = {
        id: 'test',
        name: '魔搭模型',
        type: 'image',
        provider: 'modelscope',
        modelId: 'test',
        apiKey: 'key',
        enabled: true,
        capabilities: { textToImage: true }
      };

      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DEV_ONLY_PROVIDER_IN_PROD')).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  describe('updateConfig', () => {
    it('应该更新现有配置', () => {
      // 先创建配置
      const createResult = manager.createCustom({
        name: '原始名称',
        type: 'image',
        provider: 'test',
        modelId: 'test'
      });

      expect(createResult.valid).toBe(true);
      const configId = createResult.config!.id;

      // 更新配置
      const updateResult = manager.updateConfig(configId, {
        name: '新名称'
      });

      expect(updateResult.valid).toBe(true);
      expect(updateResult.config?.name).toBe('新名称');
    });

    it('应该处理不存在的配置', () => {
      const result = manager.updateConfig('non-existent', {
        name: '新名称'
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('CONFIG_NOT_FOUND');
    });
  });

  describe('deleteConfig', () => {
    it('应该删除配置', () => {
      const createResult = manager.createCustom({
        name: '待删除',
        type: 'image',
        provider: 'test',
        modelId: 'test'
      });

      const configId = createResult.config!.id;
      expect(manager.getConfig(configId)).toBeDefined();

      const deleted = manager.deleteConfig(configId);
      expect(deleted).toBe(true);
      expect(manager.getConfig(configId)).toBeUndefined();
    });

    it('应该处理不存在的配置', () => {
      const deleted = manager.deleteConfig('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('exportConfigs', () => {
    it('应该导出所有配置', () => {
      manager.createCustom({
        name: '模型1',
        type: 'image',
        provider: 'test',
        modelId: 'model1',
        apiKey: 'secret-key'
      });

      const exportData = manager.exportConfigs();

      expect(exportData.version).toBe('1.0.0');
      expect(exportData.configs).toHaveLength(1);
      expect(exportData.metadata.total).toBe(1);
      // API密钥应该被脱敏
      expect(exportData.configs[0].apiKey).toBe('***REDACTED***');
    });

    it('应该支持导出指定配置', () => {
      const result1 = manager.createCustom({
        name: '模型1',
        type: 'image',
        provider: 'test',
        modelId: 'model1'
      });

      manager.createCustom({
        name: '模型2',
        type: 'video',
        provider: 'test',
        modelId: 'model2'
      });

      const exportData = manager.exportConfigs([result1.config!.id]);

      expect(exportData.configs).toHaveLength(1);
      expect(exportData.configs[0].name).toBe('模型1');
    });
  });

  describe('importConfigs', () => {
    it('应该导入配置', () => {
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        configs: [{
          id: 'imported-1',
          name: '导入模型',
          type: 'image',
          provider: 'test',
          modelId: 'imported-model',
          apiKey: '',
          enabled: true,
          capabilities: { textToImage: true }
        }],
        metadata: {
          total: 1,
          providers: ['test'],
          types: ['image']
        }
      };

      const result = manager.importConfigs(exportData);

      expect(result.valid).toBe(true);
      expect(result.imported).toBe(1);
      // 导入的配置默认禁用
      const imported = manager.getConfig('imported-1');
      expect(imported?.enabled).toBe(false);
    });

    it('应该处理无效配置', () => {
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        configs: [{
          id: 'invalid',
          name: '',  // 无效：空名称
          type: 'image',
          provider: 'test',
          modelId: 'test',
          apiKey: '',
          enabled: true,
          capabilities: {}
        }],
        metadata: {
          total: 1,
          providers: ['test'],
          types: ['image']
        }
      };

      const result = manager.importConfigs(exportData);

      expect(result.valid).toBe(false);
      expect(result.failed).toBe(1);
    });
  });

  describe('version management', () => {
    it('应该保存配置版本', () => {
      const createResult = manager.createCustom({
        name: '版本测试',
        type: 'image',
        provider: 'test',
        modelId: 'test'
      });

      const configId = createResult.config!.id;

      // 更新几次
      manager.updateConfig(configId, { name: '版本1' });
      manager.updateConfig(configId, { name: '版本2' });
      manager.updateConfig(configId, { name: '版本3' });

      const versions = manager.getConfigVersions(configId);
      expect(versions.length).toBeGreaterThanOrEqual(3);
    });

    it('应该支持回滚', () => {
      const createResult = manager.createCustom({
        name: '原始名称',
        type: 'image',
        provider: 'test',
        modelId: 'test'
      });

      const configId = createResult.config!.id;
      manager.updateConfig(configId, { name: '新名称' });

      const versions = manager.getConfigVersions(configId);
      const originalVersion = versions[0].version;

      // 回滚到原始版本
      const rolledBack = manager.rollbackToVersion(configId, originalVersion);
      expect(rolledBack?.name).toBe('原始名称');
    });
  });

  describe('batch operations', () => {
    it('应该批量启用/禁用', () => {
      const result1 = manager.createCustom({
        name: '模型1',
        type: 'image',
        provider: 'test',
        modelId: 'model1'
      });

      const result2 = manager.createCustom({
        name: '模型2',
        type: 'image',
        provider: 'test',
        modelId: 'model2'
      });

      const ids = [result1.config!.id, result2.config!.id];

      // 批量禁用
      const disabled = manager.batchSetEnabled(ids, false);
      expect(disabled).toBe(2);

      // 验证
      expect(manager.getConfig(result1.config!.id)?.enabled).toBe(false);
      expect(manager.getConfig(result2.config!.id)?.enabled).toBe(false);
    });

    it('应该批量删除', () => {
      const result1 = manager.createCustom({
        name: '模型1',
        type: 'image',
        provider: 'test',
        modelId: 'model1'
      });

      const result2 = manager.createCustom({
        name: '模型2',
        type: 'image',
        provider: 'test',
        modelId: 'model2'
      });

      const ids = [result1.config!.id, result2.config!.id];
      const deleted = manager.batchDelete(ids);

      expect(deleted).toBe(2);
      expect(manager.getConfig(result1.config!.id)).toBeUndefined();
      expect(manager.getConfig(result2.config!.id)).toBeUndefined();
    });
  });
});
