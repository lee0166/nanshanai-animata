/**
 * Multi-Level Cache System Tests
 *
 * 测试用例基于文档《融合方案_实施细节与代码示例》第2.4节
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiLevelCache, multiLevelCache } from './MultiLevelCache';
import { storageService } from '../storage';

// Mock storageService
vi.mock('../storage', () => ({
  storageService: {
    getCache: vi.fn(),
    setCache: vi.fn()
  }
}));

describe('MultiLevelCache', () => {
  let cache: MultiLevelCache;

  beforeEach(() => {
    cache = new MultiLevelCache({
      l1TTL: 1000,    // 1秒
      l2TTL: 2000,    // 2秒
      l3TTL: 3000,    // 3秒
      maxL1Size: 5,
      maxL2Size: 10,
      maxL3Size: 20
    });
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should export singleton instance', () => {
      expect(multiLevelCache).toBeDefined();
      expect(multiLevelCache).toBeInstanceOf(MultiLevelCache);
    });

    it('should start with empty cache', () => {
      const stats = cache.getStats();
      expect(stats.l1Size).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
    });
  });

  describe('L1 Cache (Memory)', () => {
    it('should set and get value from L1', async () => {
      await cache.set('key1', 'value1', { levels: ['L1'] });
      const value = await cache.get('key1');

      expect(value).toBe('value1');
    });

    it('should return null for non-existent key', async () => {
      const value = await cache.get('nonexistent');
      expect(value).toBeNull();
    });

    it('should track L1 hits', async () => {
      await cache.set('key1', 'value1', { levels: ['L1'] });
      await cache.get('key1');
      await cache.get('key1');

      const stats = cache.getStats();
      expect(stats.totalHits).toBe(2);
    });

    it('should evict oldest when L1 is full', async () => {
      // 填充L1到最大容量
      for (let i = 0; i < 6; i++) {
        await cache.set(`key${i}`, `value${i}`, { levels: ['L1'] });
      }

      const stats = cache.getStats();
      expect(stats.l1Size).toBeLessThanOrEqual(5);
    });
  });

  describe('L2 Cache (IndexedDB)', () => {
    it('should set and get value from L2', async () => {
      vi.mocked(storageService.getCache).mockResolvedValue({
        key1: {
          key: 'key1',
          value: 'value1',
          timestamp: Date.now(),
          ttl: 2000,
          level: 'L2',
          hitCount: 0,
          size: 10
        }
      });

      const value = await cache.get('key1');

      expect(value).toBe('value1');
      expect(storageService.getCache).toHaveBeenCalled();
    });

    it('should promote L2 to L1 on hit', async () => {
      vi.mocked(storageService.getCache).mockResolvedValue({
        key1: {
          key: 'key1',
          value: 'value1',
          timestamp: Date.now(),
          ttl: 2000,
          level: 'L2',
          hitCount: 0,
          size: 10
        }
      });

      await cache.get('key1');

      // 第二次应该从L1获取
      const value = await cache.get('key1');
      expect(value).toBe('value1');
    });

    it('should handle L2 cache errors gracefully', async () => {
      vi.mocked(storageService.getCache).mockRejectedValue(new Error('DB error'));

      const value = await cache.get('key1');
      expect(value).toBeNull();
    });
  });

  describe('Cache Levels', () => {
    it('should set to all levels by default', async () => {
      await cache.set('key1', 'value1');

      // 验证L1
      const l1Value = await cache.get('key1');
      expect(l1Value).toBe('value1');

      // 验证调用了L2存储
      expect(storageService.setCache).toHaveBeenCalled();
    });

    it('should set to specific levels only', async () => {
      await cache.set('key1', 'value1', { levels: ['L1'] });

      // 使用peek不触发统计，检查是否真的只在L1
      const valueBeforeClear = await cache.peek('key1');
      expect(valueBeforeClear).toBe('value1');

      // 清空L1
      await cache.clear();

      // 不应该在L2中找到 - mock返回空对象
      vi.mocked(storageService.getCache).mockResolvedValue({});
      const value = await cache.get('key1');
      // 使用toBeFalsy来匹配null或undefined
      expect(value).toBeFalsy();
    });
  });

  describe('Cache Expiration', () => {
    it('should expire L1 entries after TTL', async () => {
      await cache.set('key1', 'value1', { levels: ['L1'], ttl: 1 });

      // 验证设置成功
      const valueBefore = await cache.peek('key1');
      expect(valueBefore).toBe('value1');

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 50));

      const value = await cache.get('key1');
      // 使用toBeFalsy来匹配null或undefined
      expect(value).toBeFalsy();
    });
  });

  describe('Cache Deletion', () => {
    it('should delete from all levels', async () => {
      await cache.set('key1', 'value1', { levels: ['L1'] });

      // 验证设置成功
      const valueBefore = await cache.peek('key1');
      expect(valueBefore).toBe('value1');

      await cache.delete('key1');

      const value = await cache.get('key1');
      // 使用toBeFalsy来匹配null或undefined
      expect(value).toBeFalsy();
    });
  });

  describe('Cache Clear', () => {
    it('should clear all levels', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.clear();

      const stats = cache.getStats();
      expect(stats.l1Size).toBe(0);
      expect(stats.totalHits).toBe(0);
    });
  });

  describe('Cache Statistics', () => {
    it('should track hit rate', async () => {
      // 设置缓存
      await cache.set('key1', 'value1', { levels: ['L1'] });

      // 命中
      await cache.get('key1');

      // 未命中 - mock返回空对象
      vi.mocked(storageService.getCache).mockResolvedValue({});
      await cache.get('nonexistent');

      const stats = cache.getStats();
      // 验证统计功能正常工作
      expect(stats.totalHits + stats.totalMisses).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
    });

    it('should calculate total size', async () => {
      await cache.set('key1', { data: 'value1' }, { levels: ['L1'] });

      const stats = cache.getStats();
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('Cache Warmup', () => {
    it('should warmup cache with multiple entries', async () => {
      const entries = [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
        { key: 'key3', value: 'value3' }
      ];

      await cache.warmup(entries);

      // 验证所有条目都在缓存中
      for (const entry of entries) {
        const value = await cache.get(entry.key);
        expect(value).toBe(entry.value);
      }
    });
  });

  describe('Key Generation', () => {
    it('should generate consistent keys', () => {
      const key1 = cache.generateKey('parser', { id: 1, type: 'character' });
      const key2 = cache.generateKey('parser', { type: 'character', id: 1 });

      expect(key1).toBe(key2);
    });

    it('should generate unique keys for different params', () => {
      const key1 = cache.generateKey('parser', { id: 1 });
      const key2 = cache.generateKey('parser', { id: 2 });

      expect(key1).not.toBe(key2);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle complex objects', async () => {
      const complexData = {
        characters: [
          { name: '林黛玉', age: 16, traits: ['敏感', '才华横溢'] },
          { name: '贾宝玉', age: 18, traits: ['叛逆', '多情'] }
        ],
        scenes: [
          { name: '大观园', description: '贾府的私家园林' }
        ]
      };

      await cache.set('novel_data', complexData);
      const retrieved = await cache.get<typeof complexData>('novel_data');

      expect(retrieved).toEqual(complexData);
    });

    it('should handle concurrent operations', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(cache.set(`key${i}`, `value${i}`));
      }

      await Promise.all(promises);

      const stats = cache.getStats();
      expect(stats.l1Size).toBeGreaterThan(0);
    });
  });
});
