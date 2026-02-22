/**
 * Multi-Level Cache System
 *
 * 三级缓存系统 - L1(内存) / L2(IndexedDB) / L3(云端)
 * 基于文档《融合方案_实施细节与代码示例》第2.4节
 *
 * @module services/parsing/MultiLevelCache
 * @version 1.0.0
 */

import { storageService } from '../storage';

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;           // 过期时间（毫秒）
  level: 'L1' | 'L2' | 'L3';
  hitCount: number;
  size: number;          // 数据大小（字节）
}

export interface CacheStats {
  l1Size: number;
  l2Size: number;
  l3Size: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  totalSize: number;
}

export interface CacheOptions {
  l1TTL?: number;        // L1缓存TTL（毫秒）
  l2TTL?: number;        // L2缓存TTL（毫秒）
  l3TTL?: number;        // L3缓存TTL（毫秒）
  maxL1Size?: number;    // L1最大条目数
  maxL2Size?: number;    // L2最大条目数
  maxL3Size?: number;    // L3最大条目数
}

export class MultiLevelCache {
  // L1: 内存缓存
  private l1Cache: Map<string, CacheEntry<any>> = new Map();

  // L2: IndexedDB缓存（通过storageService）
  private l2CacheKey = 'multi_level_cache_l2';

  // 统计信息
  private stats = {
    hits: 0,
    misses: 0,
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0
  };

  // 配置
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      l1TTL: 5 * 60 * 1000,      // 5分钟
      l2TTL: 60 * 60 * 1000,     // 1小时
      l3TTL: 24 * 60 * 60 * 1000, // 24小时
      maxL1Size: 100,
      maxL2Size: 1000,
      maxL3Size: 10000,
      ...options
    };

    // 启动定期清理
    this.startCleanupTimer();
  }

  /**
   * 获取缓存值（自动级联查询）
   */
  async get<T>(key: string): Promise<T | null> {
    // 1. 查询L1
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && !this.isExpired(l1Entry)) {
      l1Entry.hitCount++;
      this.stats.hits++;
      this.stats.l1Hits++;
      return l1Entry.value as T;
    }

    // 2. 查询L2
    const l2Entry = await this.getFromL2<T>(key);
    if (l2Entry && !this.isExpired(l2Entry)) {
      // 提升到L1
      this.setL1(key, l2Entry.value, l2Entry.ttl);
      this.stats.hits++;
      this.stats.l2Hits++;
      return l2Entry.value;
    }

    // 3. 查询L3（云端）
    const l3Entry = await this.getFromL3<T>(key);
    if (l3Entry && !this.isExpired(l3Entry)) {
      // 提升到L2和L1
      await this.setL2(key, l3Entry.value, l3Entry.ttl);
      this.setL1(key, l3Entry.value, this.options.l1TTL);
      this.stats.hits++;
      this.stats.l3Hits++;
      return l3Entry.value;
    }

    // 未命中
    this.stats.misses++;
    return null;
  }

  /**
   * 获取缓存值（不触发统计）
   */
  async peek<T>(key: string): Promise<T | null> {
    // 1. 查询L1
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && !this.isExpired(l1Entry)) {
      return l1Entry.value as T;
    }

    // 2. 查询L2
    const l2Entry = await this.getFromL2<T>(key);
    if (l2Entry && !this.isExpired(l2Entry)) {
      return l2Entry.value;
    }

    // 3. 查询L3
    const l3Entry = await this.getFromL3<T>(key);
    if (l3Entry && !this.isExpired(l3Entry)) {
      return l3Entry.value;
    }

    return null;
  }

  /**
   * 设置缓存值
   */
  async set<T>(
    key: string,
    value: T,
    options: {
      ttl?: number;
      levels?: ('L1' | 'L2' | 'L3')[];
    } = {}
  ): Promise<void> {
    const { ttl = this.options.l1TTL, levels = ['L1', 'L2', 'L3'] } = options;

    // 计算数据大小
    const size = this.estimateSize(value);

    if (levels.includes('L1')) {
      this.setL1(key, value, ttl);
    }

    if (levels.includes('L2')) {
      await this.setL2(key, value, ttl);
    }

    if (levels.includes('L3')) {
      await this.setL3(key, value, ttl);
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    // 删除L1
    this.l1Cache.delete(key);

    // 删除L2
    await this.deleteFromL2(key);

    // 删除L3
    await this.deleteFromL3(key);
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    // 清空L1
    this.l1Cache.clear();

    // 清空L2
    await this.clearL2();

    // 清空L3
    await this.clearL3();

    // 重置统计
    this.stats = { hits: 0, misses: 0, l1Hits: 0, l2Hits: 0, l3Hits: 0 };
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    // 计算各层大小
    let l1Size = 0;
    for (const entry of this.l1Cache.values()) {
      l1Size += entry.size;
    }

    return {
      l1Size: this.l1Cache.size,
      l2Size: 0, // 需要异步获取
      l3Size: 0, // 需要异步获取
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate,
      totalSize: l1Size
    };
  }

  /**
   * 预热缓存（批量加载）
   */
  async warmup<T>(entries: { key: string; value: T; ttl?: number }[]): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, {
        ttl: entry.ttl,
        levels: ['L1', 'L2']
      });
    }
    console.log(`[MultiLevelCache] Warmup completed: ${entries.length} entries`);
  }

  /**
   * 生成缓存键
   */
  generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${JSON.stringify(params[k])}`)
      .join('&');
    return `${prefix}:${sortedParams}`;
  }

  // ==================== L1 (内存) 操作 ====================

  private setL1<T>(key: string, value: T, ttl: number): void {
    // 检查是否需要清理
    if (this.l1Cache.size >= this.options.maxL1Size) {
      this.evictL1();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl,
      level: 'L1',
      hitCount: 0,
      size: this.estimateSize(value)
    };

    this.l1Cache.set(key, entry);
  }

  private evictL1(): void {
    // LRU策略：删除最少使用的
    let minHitCount = Infinity;
    let keyToDelete: string | null = null;

    for (const [key, entry] of this.l1Cache.entries()) {
      if (entry.hitCount < minHitCount) {
        minHitCount = entry.hitCount;
        keyToDelete = key;
      }
    }

    if (keyToDelete) {
      this.l1Cache.delete(keyToDelete);
    }
  }

  // ==================== L2 (IndexedDB) 操作 ====================

  private async getFromL2<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const cache = await storageService.getCache<Record<string, CacheEntry<any>>>(this.l2CacheKey);
      if (!cache) return null;

      const entry = cache[key];
      if (!entry) return null;

      return entry as CacheEntry<T>;
    } catch (e) {
      console.error('[MultiLevelCache] L2 get error:', e);
      return null;
    }
  }

  private async setL2<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      const cache = await storageService.getCache<Record<string, CacheEntry<any>>>(this.l2CacheKey) || {};

      // 检查大小限制
      const keys = Object.keys(cache);
      if (keys.length >= this.options.maxL2Size) {
        // 删除最旧的
        const oldestKey = keys[0];
        delete cache[oldestKey];
      }

      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        ttl,
        level: 'L2',
        hitCount: 0,
        size: this.estimateSize(value)
      };

      cache[key] = entry;
      await storageService.setCache(this.l2CacheKey, cache);
    } catch (e) {
      console.error('[MultiLevelCache] L2 set error:', e);
    }
  }

  private async deleteFromL2(key: string): Promise<void> {
    try {
      const cache = await storageService.getCache<Record<string, CacheEntry<any>>>(this.l2CacheKey);
      if (cache && cache[key]) {
        delete cache[key];
        await storageService.setCache(this.l2CacheKey, cache);
      }
    } catch (e) {
      console.error('[MultiLevelCache] L2 delete error:', e);
    }
  }

  private async clearL2(): Promise<void> {
    try {
      await storageService.setCache(this.l2CacheKey, {});
    } catch (e) {
      console.error('[MultiLevelCache] L2 clear error:', e);
    }
  }

  // ==================== L3 (云端) 操作 ====================

  private async getFromL3<T>(key: string): Promise<CacheEntry<T> | null> {
    // L3缓存目前使用IndexedDB模拟
    // 实际生产环境应调用云端API
    try {
      const l3Key = `l3_${key}`;
      const cache = await storageService.getCache<Record<string, CacheEntry<any>>>(l3Key);
      return cache ? (cache as CacheEntry<T>) : null;
    } catch (e) {
      return null;
    }
  }

  private async setL3<T>(key: string, value: T, ttl: number): Promise<void> {
    // L3缓存目前使用IndexedDB模拟
    try {
      const l3Key = `l3_${key}`;
      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        ttl,
        level: 'L3',
        hitCount: 0,
        size: this.estimateSize(value)
      };

      await storageService.setCache(l3Key, entry);
    } catch (e) {
      console.error('[MultiLevelCache] L3 set error:', e);
    }
  }

  private async deleteFromL3(key: string): Promise<void> {
    try {
      const l3Key = `l3_${key}`;
      await storageService.setCache(l3Key, null);
    } catch (e) {
      console.error('[MultiLevelCache] L3 delete error:', e);
    }
  }

  private async clearL3(): Promise<void> {
    // 清除所有L3缓存（通过前缀匹配）
    // 实际实现可能需要更复杂的逻辑
    console.log('[MultiLevelCache] L3 clear requested');
  }

  // ==================== 辅助方法 ====================

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private estimateSize(value: any): number {
    try {
      const str = JSON.stringify(value);
      // 估算UTF-8字节数
      let size = 0;
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code <= 0x7f) {
          size += 1;
        } else if (code <= 0x7ff) {
          size += 2;
        } else {
          size += 3;
        }
      }
      return size;
    } catch {
      return 0;
    }
  }

  private startCleanupTimer(): void {
    // 每5分钟清理一次过期缓存
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup(): void {
    // 清理L1过期缓存
    for (const [key, entry] of this.l1Cache.entries()) {
      if (this.isExpired(entry)) {
        this.l1Cache.delete(key);
      }
    }

    console.log('[MultiLevelCache] Cleanup completed');
  }
}

// 导出单例实例
export const multiLevelCache = new MultiLevelCache();
