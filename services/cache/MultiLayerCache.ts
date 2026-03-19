/**
 * MultiLayerCache - 多层缓存系统
 *
 * 职责：实现 L1 内存→L2 IndexedDB→L3 文件系统的三级缓存架构
 *
 * 缓存层级：
 * - L1：内存缓存（最快，<1ms，应用生命周期）
 * - L2：IndexedDB 缓存（快，10-50ms，浏览器持久化）
 * - L3：文件系统（慢，100ms+，持久化存储）
 *
 * 缓存策略：
 * 1. 读取：L1 → L2 → L3（逐级回退）
 * 2. 写入：L1 + L2 + L3（同时写入）
 * 3. 失效：L1 自动失效，L2/L3 基于 TTL
 *
 * 使用场景：
 * - settings.json 频繁读取
 * - 模型配置缓存
 * - 用户偏好设置
 *
 * @module services/cache/MultiLayerCache
 * @version 1.0.0
 */

/**
 * 缓存项
 */
interface CacheItem<T> {
  /** 数据 */
  data: T;
  /** 时间戳 */
  timestamp: number;
  /** TTL（毫秒） */
  ttl: number;
  /** 访问时间戳（用于LRU） */
  accessTime: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** L1 是否启用，默认 true */
  enableL1?: boolean;
  /** L2 是否启用，默认 true */
  enableL2?: boolean;
  /** 默认 TTL（毫秒），默认 5 分钟 */
  defaultTTL?: number;
  /** 最大 L1 缓存项数量，默认 100 */
  maxL1Items?: number;
}

/**
 * 缓存统计
 */
export interface CacheStats {
  /** L1 命中次数 */
  l1Hits: number;
  /** L2 命中次数 */
  l2Hits: number;
  /** L3 命中次数 */
  l3Hits: number;
  /** 未命中次数 */
  misses: number;
  /** 总请求次数 */
  total: number;
  /** 命中率 */
  hitRate: number;
}

/**
 * 多层缓存类
 */
export class MultiLayerCache {
  /** L1 内存缓存 */
  private l1Cache: Map<string, CacheItem<any>> = new Map();

  /** L2 IndexedDB 数据库 */
  private l2DB: IDBDatabase | null = null;

  /** 配置 */
  private config: Required<CacheConfig>;

  /** 统计 */
  private stats: CacheStats = {
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0,
    misses: 0,
    total: 0,
    hitRate: 0,
  };

  /** IndexedDB 数据库名 */
  private static readonly DB_NAME = 'MultiLayerCache';
  /** 存储名称 */
  private static readonly STORE_NAME = 'cache';

  /**
   * 构造函数
   */
  constructor(config: CacheConfig = {}) {
    this.config = {
      enableL1: config.enableL1 ?? true,
      enableL2: config.enableL2 ?? true,
      defaultTTL: config.defaultTTL ?? 5 * 60 * 1000, // 5 分钟
      maxL1Items: config.maxL1Items ?? 100,
    };

    // 初始化 L2 IndexedDB
    this.initL2();

    console.log(`[MultiLayerCache] Initialized with config:`, this.config);
  }

  /**
   * 初始化 L2 IndexedDB
   */
  private async initL2(): Promise<void> {
    if (!this.config.enableL2) return;

    try {
      const request = indexedDB.open(MultiLayerCache.DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(MultiLayerCache.STORE_NAME)) {
          db.createObjectStore(MultiLayerCache.STORE_NAME);
        }
      };

      request.onsuccess = () => {
        this.l2DB = request.result;
        console.log(`[MultiLayerCache] L2 IndexedDB initialized`);
      };

      request.onerror = () => {
        console.warn(`[MultiLayerCache] L2 IndexedDB initialization failed`);
        this.l2DB = null;
      };
    } catch (error) {
      console.warn(`[MultiLayerCache] L2 IndexedDB error:`, error);
      this.l2DB = null;
    }
  }

  /**
   * 从缓存获取数据
   *
   * 读取策略：L1 → L2 → L3
   *
   * @param key - 缓存键
   * @param l3Loader - L3 加载函数（如果 L1/L2 未命中时调用）
   * @returns 缓存数据或 null
   */
  async get<T>(key: string, l3Loader?: () => Promise<T>): Promise<T | null> {
    this.stats.total++;

    // 尝试 L1
    if (this.config.enableL1) {
      const l1Result = this.getL1<T>(key);
      if (l1Result !== null) {
        this.stats.l1Hits++;
        this.updateHitRate();
        console.log(`[MultiLayerCache] L1 hit: ${key}`);
        return l1Result;
      }
    }

    // 尝试 L2
    if (this.config.enableL2 && this.l2DB) {
      const l2Result = await this.getL2<T>(key);
      if (l2Result !== null) {
        // 回填 L1
        this.setL1(key, l2Result.data, l2Result.ttl);
        this.stats.l2Hits++;
        this.updateHitRate();
        console.log(`[MultiLayerCache] L2 hit: ${key}`);
        return l2Result.data;
      }
    }

    // 尝试 L3
    if (l3Loader) {
      const l3Result = await l3Loader();
      if (l3Result !== null) {
        // 回填 L1 和 L2
        this.set(key, l3Result);
        this.stats.l3Hits++;
        this.updateHitRate();
        console.log(`[MultiLayerCache] L3 hit: ${key}`);
        return l3Result;
      }
    }

    // 未命中
    this.stats.misses++;
    this.updateHitRate();
    console.log(`[MultiLayerCache] Cache miss: ${key}`);
    return null;
  }

  /**
   * 设置缓存
   *
   * 写入策略：L1 + L2 + L3
   *
   * @param key - 缓存键
   * @param data - 数据
   * @param ttl - TTL（毫秒），可选
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const actualTTL = ttl ?? this.config.defaultTTL;
    const timestamp = Date.now();

    // 写入 L1
    if (this.config.enableL1) {
      this.setL1(key, data, actualTTL);
    }

    // 写入 L2
    if (this.config.enableL2 && this.l2DB) {
      await this.setL2(key, data, actualTTL);
    }

    console.log(`[MultiLayerCache] Cache set: ${key} (TTL: ${actualTTL}ms)`);
  }

  /**
   * 从 L1 获取数据
   */
  private getL1<T>(key: string): T | null {
    const item = this.l1Cache.get(key) as CacheItem<T> | undefined;
    if (!item) return null;

    // 检查 TTL
    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.l1Cache.delete(key);
      return null;
    }

    // 更新访问时间（用于LRU）
    item.accessTime = now;
    this.l1Cache.set(key, item);

    return item.data;
  }

  /**
   * 设置 L1 缓存
   */
  private setL1<T>(key: string, data: T, ttl: number): void {
    // LRU：如果超过最大数量，删除最久未访问的
    if (this.l1Cache.size >= this.config.maxL1Items) {
      let leastRecentlyUsedKey: string | null = null;
      let oldestAccessTime = Number.MAX_SAFE_INTEGER;

      for (const [cacheKey, item] of this.l1Cache.entries()) {
        if (item.accessTime < oldestAccessTime) {
          oldestAccessTime = item.accessTime;
          leastRecentlyUsedKey = cacheKey;
        }
      }

      if (leastRecentlyUsedKey) {
        this.l1Cache.delete(leastRecentlyUsedKey);
        console.log(`[MultiLayerCache] L1 evicted: ${leastRecentlyUsedKey}`);
      }
    }

    const now = Date.now();
    this.l1Cache.set(key, {
      data,
      timestamp: now,
      ttl,
      accessTime: now,
    });
  }

  /**
   * 从 L2 获取数据
   */
  private async getL2<T>(key: string): Promise<CacheItem<T> | null> {
    if (!this.l2DB) return null;

    return new Promise(resolve => {
      try {
        const transaction = this.l2DB.transaction([MultiLayerCache.STORE_NAME], 'readonly');
        const store = transaction.objectStore(MultiLayerCache.STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const item = request.result as CacheItem<T> | undefined;
          if (!item) {
            resolve(null);
            return;
          }

          // 检查 TTL
          const now = Date.now();
          if (now - item.timestamp > item.ttl) {
            this.deleteL2(key);
            resolve(null);
            return;
          }

          resolve(item);
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch (error) {
        console.warn(`[MultiLayerCache] L2 get error:`, error);
        resolve(null);
      }
    });
  }

  /**
   * 设置 L2 缓存
   */
  private async setL2<T>(key: string, data: T, ttl: number): Promise<void> {
    if (!this.l2DB) return;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.l2DB.transaction([MultiLayerCache.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(MultiLayerCache.STORE_NAME);
        const request = store.put(
          {
            data,
            timestamp: Date.now(),
            ttl,
          },
          key
        );

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      } catch (error) {
        console.warn(`[MultiLayerCache] L2 set error:`, error);
        reject(error);
      }
    });
  }

  /**
   * 删除 L2 缓存
   */
  private async deleteL2(key: string): Promise<void> {
    if (!this.l2DB) return;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.l2DB.transaction([MultiLayerCache.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(MultiLayerCache.STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      } catch (error) {
        console.warn(`[MultiLayerCache] L2 delete error:`, error);
        reject(error);
      }
    });
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    // 删除 L1
    if (this.config.enableL1) {
      this.l1Cache.delete(key);
    }

    // 删除 L2
    if (this.config.enableL2 && this.l2DB) {
      await this.deleteL2(key);
    }

    console.log(`[MultiLayerCache] Cache deleted: ${key}`);
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    // 清空 L1
    if (this.config.enableL1) {
      this.l1Cache.clear();
    }

    // 清空 L2
    if (this.config.enableL2 && this.l2DB) {
      return new Promise((resolve, reject) => {
        try {
          const transaction = this.l2DB.transaction([MultiLayerCache.STORE_NAME], 'readwrite');
          const store = transaction.objectStore(MultiLayerCache.STORE_NAME);
          const request = store.clear();

          request.onsuccess = () => {
            resolve();
          };

          request.onerror = () => {
            reject(request.error);
          };
        } catch (error) {
          console.warn(`[MultiLayerCache] L2 clear error:`, error);
          reject(error);
        }
      });
    }

    console.log(`[MultiLayerCache] Cache cleared`);
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      misses: 0,
      total: 0,
      hitRate: 0,
    };
  }

  /**
   * 批量获取缓存
   * @param keys - 缓存键数组
   * @param l3Loader - L3 加载函数（如果 L1/L2 未命中时调用）
   * @returns 缓存数据映射
   */
  async getBatch<T>(keys: string[], l3Loader?: (key: string) => Promise<T>): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    const promises = keys.map(async (key) => {
      const value = await this.get(key, l3Loader ? () => l3Loader(key) : undefined);
      results.set(key, value);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * 批量设置缓存
   * @param items - 键值对数组
   * @param ttl - TTL（毫秒），可选
   */
  async setBatch<T>(items: Array<{ key: string; data: T }>, ttl?: number): Promise<void> {
    const promises = items.map(item => this.set(item.key, item.data, ttl));
    await Promise.all(promises);
  }

  /**
   * 缓存预热
   * @param items - 键值对数组
   * @param ttl - TTL（毫秒），可选
   */
  async warmup<T>(items: Array<{ key: string; data: T }>, ttl?: number): Promise<void> {
    console.log(`[MultiLayerCache] Starting warmup with ${items.length} items`);
    await this.setBatch(items, ttl);
    console.log(`[MultiLayerCache] Warmup completed`);
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    if (this.stats.total === 0) {
      this.stats.hitRate = 0;
    } else {
      const hits = this.stats.l1Hits + this.stats.l2Hits + this.stats.l3Hits;
      this.stats.hitRate = Math.round((hits / this.stats.total) * 100) / 100;
    }
  }
}

/**
 * 创建多层缓存实例
 */
export function createMultiLayerCache(config: CacheConfig = {}): MultiLayerCache {
  return new MultiLayerCache(config);
}
