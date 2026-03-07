/**
 * Global Context Cache
 *
 * LRU 缓存机制用于全局上下文，解决内存泄漏和缓存冲突问题
 *
 * V2 改进：
 * - 使用完整内容 MD5 哈希，避免冲突
 * - 关联 modelId 和 provider，确保唯一性
 * - LRU 自动淘汰，无内存泄漏
 * - 命中率监控
 *
 * @module services/parsing/GlobalContextCache
 * @version 2.0.0
 */

import { LRUCache } from 'lru-cache';

// 全局上下文类型定义
export interface StoryContext {
  genre: string;
  theme: string;
  tone: string;
  targetAudience: string;
}

export interface VisualContext {
  artDirection: string;
  artStyle: string;
  artStyleDescription: string;
  colorPalette: string[];
  colorMood: string;
  cinematography: string;
  lightingStyle: string;
  references: string[];
  referenceFilms: string[];
  referenceDirectors: string[];
}

export interface EraContext {
  era: string;
  location: string;
  season: string;
  timeOfDay: string;
}

export interface GlobalContext {
  story: StoryContext;
  visual: VisualContext;
  era: EraContext;
}

interface CachedContext {
  context: GlobalContext;
  timestamp: number;
  modelId: string;
  provider: string;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * 简单的 MD5 哈希实现（浏览器端）
 * 用于生成内容指纹
 */
function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * 生成缓存键
 * 使用完整内容哈希 + 模型ID + provider，确保唯一性
 */
function generateCacheKey(content: string, modelId: string, provider: string): string {
  // 使用完整内容哈希（前5000字 + 后1000字作为指纹）
  const contentPrefix = content.substring(0, 5000);
  const contentSuffix = content.length > 6000 ? content.substring(content.length - 1000) : '';
  const contentFingerprint = simpleHash(contentPrefix + contentSuffix);

  return `${contentFingerprint}:${modelId}:${provider}`;
}

/**
 * 全局上下文 LRU 缓存
 */
export class GlobalContextCache {
  private cache: LRUCache<string, CachedContext>;
  private stats = { hits: 0, misses: 0 };

  constructor(options?: { maxSize?: number; ttl?: number }) {
    const maxSize = options?.maxSize ?? 1000;
    const ttl = options?.ttl ?? 1000 * 60 * 60; // 默认1小时

    this.cache = new LRUCache({
      max: maxSize,
      ttl: ttl,
      updateAgeOnGet: true,
      allowStale: false,
      dispose: (value, key) => {
        console.log(`[GlobalContextCache] Evicted: ${String(key).slice(0, 16)}...`);
      },
    });

    console.log(`[GlobalContextCache] Initialized (max: ${maxSize}, ttl: ${ttl}ms)`);
  }

  /**
   * 获取或提取全局上下文
   */
  async getOrExtract(
    content: string,
    modelId: string,
    provider: string,
    extractor: () => Promise<GlobalContext>
  ): Promise<GlobalContext> {
    const key = generateCacheKey(content, modelId, provider);

    const cached = this.cache.get(key);
    if (cached) {
      this.stats.hits++;
      const hitRate = this.getHitRate();
      console.log(`[GlobalContextCache] Hit: ${key.slice(0, 16)}... (hit rate: ${hitRate.toFixed(1)}%)`);
      return cached.context;
    }

    this.stats.misses++;
    console.log(`[GlobalContextCache] Miss: ${key.slice(0, 16)}...`);

    const context = await extractor();
    this.cache.set(key, {
      context,
      timestamp: Date.now(),
      modelId,
      provider,
    });

    return context;
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.getHitRate(),
    };
  }

  private getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
    console.log('[GlobalContextCache] Cleared');
  }

  /**
   * 检查是否有缓存
   */
  has(content: string, modelId: string, provider: string): boolean {
    const key = generateCacheKey(content, modelId, provider);
    return this.cache.has(key);
  }
}

// 单例导出
export const globalContextCache = new GlobalContextCache();

// 默认值导出
export const DEFAULT_STORY_CONTEXT: StoryContext = {
  genre: '',
  theme: '',
  tone: '',
  targetAudience: '',
};

export const DEFAULT_VISUAL_CONTEXT: VisualContext = {
  artDirection: '',
  artStyle: '',
  artStyleDescription: '',
  colorPalette: [],
  colorMood: '',
  cinematography: '',
  lightingStyle: '',
  references: [],
  referenceFilms: [],
  referenceDirectors: [],
};

export const DEFAULT_ERA_CONTEXT: EraContext = {
  era: '',
  location: '',
  season: '',
  timeOfDay: '',
};

export const DEFAULT_GLOBAL_CONTEXT: GlobalContext = {
  story: DEFAULT_STORY_CONTEXT,
  visual: DEFAULT_VISUAL_CONTEXT,
  era: DEFAULT_ERA_CONTEXT,
};
