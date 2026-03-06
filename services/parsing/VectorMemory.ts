/**
 * VectorMemory - 向量数据库存储服务
 * 基于ChromaDB实现长文本语义记忆
 * 
 * 注意：此模块使用自定义EmbeddingService生成向量，
 * 避免依赖ChromaDB的默认嵌入函数（在浏览器环境中会有问题）
 * 
 * @module services/parsing/VectorMemory
 * @version 1.1.0
 */

import { ChromaClient, Collection, IncludeEnum } from 'chromadb';
import { SemanticChunk } from './SemanticChunker';
import { EmbeddingService } from './EmbeddingService';

export interface VectorDocument {
  id: string;
  text: string;
  metadata: {
    chunkIndex: number;
    characters: string[];
    sceneHint: string;
    importance: number;
    wordCount: number;
    source: string; // 小说标题/ID
  };
}

export interface VectorSearchResult {
  id: string;
  text: string;
  metadata: VectorDocument['metadata'];
  distance: number; // 相似度距离
}

export class VectorMemory {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;
  private dbPath: string;
  private collectionName: string;
  private embeddingService: EmbeddingService;

  constructor(
    dbPath: string = 'http://localhost:8000',
    collectionName: string = 'script_memory'
  ) {
    // ChromaDB v2+ 需要HTTP服务器
    // 本地持久化需要通过HTTP服务器
    this.dbPath = dbPath;
    this.collectionName = collectionName;
    this.embeddingService = new EmbeddingService();
  }

  /**
   * 初始化向量数据库
   */
  async initialize(): Promise<void> {
    console.log('[VectorMemory] Initializing ChromaDB...');
    console.log(`[VectorMemory] Database path: ${this.dbPath}`);

    // 初始化Embedding服务
    await this.embeddingService.initialize();

    // 创建客户端（本地持久化）
    this.client = new ChromaClient({
      path: this.dbPath
    });

    // 获取或创建集合
    this.collection = await this.client.getOrCreateCollection({
      name: this.collectionName,
      metadata: {
        description: '剧本解析长文本语义记忆',
        created: new Date().toISOString(),
        version: '1.1.0'
      }
    });

    console.log(`[VectorMemory] Collection '${this.collectionName}' ready`);
  }

  /**
   * 添加文档到向量数据库
   * @param documents 文档列表
   * @param embeddings 预计算的向量（可选，不传则使用EmbeddingService生成）
   */
  async addDocuments(
    documents: VectorDocument[],
    embeddings?: number[][]
  ): Promise<void> {
    if (!this.collection) {
      throw new Error('VectorMemory not initialized. Call initialize() first.');
    }

    console.log(`[VectorMemory] Adding ${documents.length} documents...`);

    const ids = documents.map(d => d.id);
    const texts = documents.map(d => d.text);
    // 将文本存储在metadata中以便后续检索
    const metadatas = documents.map(d => ({
      ...d.metadata,
      source: d.text // 存储文本到source字段
    }));

    let finalEmbeddings: number[][];

    if (embeddings && embeddings.length === documents.length) {
      // 使用预计算的向量
      finalEmbeddings = embeddings;
    } else {
      // 使用EmbeddingService生成向量（避免依赖ChromaDB默认嵌入）
      console.log(`[VectorMemory] Generating embeddings for ${documents.length} documents...`);
      finalEmbeddings = await this.embeddingService.embedBatch(texts);
    }

    // 使用预计算的向量添加文档（不传递documents以避免ChromaDB尝试使用默认嵌入）
    await this.collection.add({
      ids,
      metadatas,
      embeddings: finalEmbeddings
    });

    console.log(`[VectorMemory] Added ${documents.length} documents successfully`);
  }

  /**
   * 语义搜索召回
   * @param queryText 查询文本
   * @param nResults 返回结果数量
   * @param filter 元数据过滤条件
   */
  async query(
    queryText: string,
    nResults: number = 5,
    filter?: Record<string, any>
  ): Promise<VectorSearchResult[]> {
    if (!this.collection) {
      throw new Error('VectorMemory not initialized. Call initialize() first.');
    }

    console.log(`[VectorMemory] Querying: "${queryText.substring(0, 50)}..."`);
    console.log(`[VectorMemory] Requesting ${nResults} results`);

    // 使用EmbeddingService生成查询向量（避免依赖ChromaDB默认嵌入）
    const queryEmbedding = await this.embeddingService.embed(queryText);

    const results = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
      where: filter,
      include: [
        IncludeEnum.metadatas,
        IncludeEnum.distances
      ]
    });

    const searchResults: VectorSearchResult[] = [];

    if (results.ids && results.ids.length > 0) {
      const ids = results.ids[0];
      const metadatas = results.metadatas?.[0] || [];
      const distances = results.distances?.[0] || [];

      for (let i = 0; i < ids.length; i++) {
        const metadata = metadatas[i] as VectorDocument['metadata'];
        searchResults.push({
          id: ids[i],
          text: metadata?.source || '', // 从metadata中获取文本信息
          metadata: metadata,
          distance: distances[i] || 0
        });
      }
    }

    console.log(`[VectorMemory] Found ${searchResults.length} relevant documents`);
    return searchResults;
  }

  /**
   * 根据ID获取文档
   * 注意：由于使用自定义嵌入，文档文本存储在metadata中
   */
  async getDocument(id: string): Promise<VectorDocument | null> {
    if (!this.collection) {
      throw new Error('VectorMemory not initialized. Call initialize() first.');
    }

    const results = await this.collection.get({
      ids: [id],
      include: [IncludeEnum.metadatas]
    });

    if (results.ids.length === 0) {
      return null;
    }

    const metadata = results.metadatas?.[0] as VectorDocument['metadata'];
    return {
      id: results.ids[0],
      text: metadata?.source || '', // 从metadata中获取文本
      metadata: metadata
    };
  }

  /**
   * 删除文档
   */
  async deleteDocuments(ids: string[]): Promise<void> {
    if (!this.collection) {
      throw new Error('VectorMemory not initialized. Call initialize() first.');
    }

    await this.collection.delete({ ids });
    console.log(`[VectorMemory] Deleted ${ids.length} documents`);
  }

  /**
   * 清空集合
   */
  async clear(): Promise<void> {
    if (!this.collection) {
      throw new Error('VectorMemory not initialized. Call initialize() first.');
    }

    const allIds = await this.collection.get({
      include: []
    });

    if (allIds.ids.length > 0) {
      await this.collection.delete({ ids: allIds.ids });
      console.log(`[VectorMemory] Cleared ${allIds.ids.length} documents`);
    }
  }

  /**
   * 获取集合统计信息
   */
  async getStats(): Promise<{ count: number; name: string }> {
    if (!this.collection) {
      throw new Error('VectorMemory not initialized. Call initialize() first.');
    }

    const count = await this.collection.count();
    return {
      count,
      name: this.collectionName
    };
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    console.log('[VectorMemory] Closing connection...');
    this.collection = null;
    this.client = null;
  }
}

// 单例实例
export const vectorMemory = new VectorMemory();
