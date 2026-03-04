/**
 * VectorMemory - 向量数据库存储服务
 * 基于ChromaDB实现长文本语义记忆
 * 
 * @module services/parsing/VectorMemory
 * @version 1.0.0
 */

import { ChromaClient, Collection, IncludeEnum } from 'chromadb';
import { SemanticChunk } from './SemanticChunker';

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

  constructor(
    dbPath: string = 'http://localhost:8000',
    collectionName: string = 'script_memory'
  ) {
    // ChromaDB v2+ 需要HTTP服务器
    // 本地持久化需要通过HTTP服务器
    this.dbPath = dbPath;
    this.collectionName = collectionName;
  }

  /**
   * 初始化向量数据库
   */
  async initialize(): Promise<void> {
    console.log('[VectorMemory] Initializing ChromaDB...');
    console.log(`[VectorMemory] Database path: ${this.dbPath}`);

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
        version: '1.0.0'
      }
    });

    console.log(`[VectorMemory] Collection '${this.collectionName}' ready`);
  }

  /**
   * 添加文档到向量数据库
   * @param documents 文档列表
   * @param embeddings 预计算的向量（可选，不传则使用ChromaDB内置embedding）
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
    const metadatas = documents.map(d => d.metadata);

    if (embeddings && embeddings.length === documents.length) {
      // 使用预计算的向量
      await this.collection.add({
        ids,
        documents: texts,
        metadatas,
        embeddings
      });
    } else {
      // 让ChromaDB自动计算向量
      await this.collection.add({
        ids,
        documents: texts,
        metadatas
      });
    }

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

    const results = await this.collection.query({
      queryTexts: [queryText],
      nResults,
      where: filter,
      include: [
        IncludeEnum.documents,
        IncludeEnum.metadatas,
        IncludeEnum.distances
      ]
    });

    const searchResults: VectorSearchResult[] = [];

    if (results.ids && results.ids.length > 0) {
      const ids = results.ids[0];
      const documents = results.documents?.[0] || [];
      const metadatas = results.metadatas?.[0] || [];
      const distances = results.distances?.[0] || [];

      for (let i = 0; i < ids.length; i++) {
        searchResults.push({
          id: ids[i],
          text: documents[i] || '',
          metadata: metadatas[i] as VectorDocument['metadata'],
          distance: distances[i] || 0
        });
      }
    }

    console.log(`[VectorMemory] Found ${searchResults.length} relevant documents`);
    return searchResults;
  }

  /**
   * 根据ID获取文档
   */
  async getDocument(id: string): Promise<VectorDocument | null> {
    if (!this.collection) {
      throw new Error('VectorMemory not initialized. Call initialize() first.');
    }

    const results = await this.collection.get({
      ids: [id],
      include: [IncludeEnum.documents, IncludeEnum.metadatas]
    });

    if (results.ids.length === 0) {
      return null;
    }

    return {
      id: results.ids[0],
      text: results.documents?.[0] || '',
      metadata: results.metadatas?.[0] as VectorDocument['metadata']
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
