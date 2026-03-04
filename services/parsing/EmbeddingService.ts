/**
 * EmbeddingService - 文本向量化服务
 * 使用本地Embedding模型，无需外部API
 * 
 * @module services/parsing/EmbeddingService
 * @version 1.0.0
 */

import { pipeline, Pipeline } from '@xenova/transformers';

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  dimensions: number;
}

export class EmbeddingService {
  private embedder: Pipeline | null = null;
  private modelName: string;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(
    modelName: string = 'Xenova/all-MiniLM-L6-v2' // 轻量级模型，384维
  ) {
    this.modelName = modelName;
  }

  /**
   * 初始化Embedding模型
   * 首次调用会下载模型（约80MB）
   */
  async initialize(): Promise<void> {
    if (this.embedder) {
      return; // 已初始化
    }

    if (this.isInitializing && this.initPromise) {
      return this.initPromise; // 等待初始化完成
    }

    this.isInitializing = true;
    this.initPromise = this.doInitialize();

    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      console.log(`[EmbeddingService] Loading model: ${this.modelName}`);
      console.log('[EmbeddingService] First time may take a while to download...');

      // 创建feature-extraction pipeline
      this.embedder = await pipeline(
        'feature-extraction',
        this.modelName,
        {
          quantized: true, // 使用量化模型，减少内存占用
          revision: 'main',
          cache_dir: './data/models' // 模型缓存目录
        }
      );

      console.log('[EmbeddingService] Model loaded successfully');
    } catch (error) {
      console.error('[EmbeddingService] Failed to load model:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * 生成文本向量
   * @param text 输入文本
   * @returns 向量结果
   */
  async embed(text: string): Promise<EmbeddingResult> {
    await this.initialize();

    if (!this.embedder) {
      throw new Error('Embedding model not initialized');
    }

    // 限制文本长度（模型有最大输入限制）
    const maxLength = 512;
    const truncatedText = text.length > maxLength 
      ? text.substring(0, maxLength) 
      : text;

    // 生成向量
    const output = await this.embedder(truncatedText, {
      pooling: 'mean', // 使用mean pooling
      normalize: true  // 归一化
    });

    // 提取向量数据
    const embedding = Array.from(output.data) as number[];

    return {
      text: truncatedText,
      embedding,
      dimensions: embedding.length
    };
  }

  /**
   * 批量生成向量
   * @param texts 文本列表
   * @returns 向量结果列表
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    await this.initialize();

    if (!this.embedder) {
      throw new Error('Embedding model not initialized');
    }

    console.log(`[EmbeddingService] Embedding ${texts.length} texts...`);

    const results: EmbeddingResult[] = [];

    // 批量处理，避免内存溢出
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(text => this.embed(text))
      );
      
      results.push(...batchResults);
      
      if (i + batchSize < texts.length) {
        console.log(`[EmbeddingService] Progress: ${Math.min(i + batchSize, texts.length)}/${texts.length}`);
      }
    }

    console.log(`[EmbeddingService] Embedded ${results.length} texts successfully`);
    return results;
  }

  /**
   * 计算两个向量的余弦相似度
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 获取模型信息
   */
  getModelInfo(): { name: string; dimensions: number } {
    return {
      name: this.modelName,
      dimensions: 384 // all-MiniLM-L6-v2 的维度
    };
  }
}

// 单例实例
export const embeddingService = new EmbeddingService();
