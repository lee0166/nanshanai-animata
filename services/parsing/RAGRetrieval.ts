/**
 * RAG Retrieval System
 *
 * 检索增强生成系统 - 基于向量相似度的上下文检索
 * 基于文档《融合方案_实施细节与代码示例》第2.2节
 *
 * @module services/parsing/RAGRetrieval
 * @version 1.0.0
 */

import { SemanticChunk } from './SemanticChunker';

export interface Document {
  id: string;
  content: string;
  metadata: {
    source: string;
    chunkIndex?: number;
    characterMentions?: string[];
    sceneType?: string;
    importance?: number;
  };
  embedding?: number[];
}

export interface SearchResult {
  document: Document;
  score: number;
  distance: number;
}

export interface RAGContext {
  query: string;
  relevantChunks: Document[];
  totalTokens: number;
  searchTime: number;
}

// 简单的向量存储实现（内存版）
// 生产环境可替换为实际的向量数据库（如Pinecone、Milvus等）
class VectorStore {
  private documents: Map<string, Document> = new Map();

  add(document: Document): void {
    this.documents.set(document.id, document);
  }

  get(id: string): Document | undefined {
    return this.documents.get(id);
  }

  getAll(): Document[] {
    return Array.from(this.documents.values());
  }

  clear(): void {
    this.documents.clear();
  }

  size(): number {
    return this.documents.size;
  }
}

export class RAGRetrieval {
  private vectorStore = new VectorStore();

  // 模拟嵌入维度
  private readonly EMBEDDING_DIM = 384;

  /**
   * 从语义分块构建向量存储
   */
  async buildFromChunks(chunks: SemanticChunk[]): Promise<void> {
    this.vectorStore.clear();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const document: Document = {
        id: chunk.id,
        content: chunk.content,
        metadata: {
          source: 'novel',
          chunkIndex: i,
          characterMentions: chunk.metadata.characters,
          sceneType: chunk.metadata.chunkType,
          importance: chunk.metadata.importance
        },
        embedding: await this.generateEmbedding(chunk.content)
      };

      this.vectorStore.add(document);
    }

    console.log(`[RAGRetrieval] Built vector store with ${chunks.length} documents`);
  }

  /**
   * 检索相关上下文
   */
  async retrieve(
    query: string,
    options: {
      topK?: number;
      minScore?: number;
      maxTokens?: number;
    } = {}
  ): Promise<RAGContext> {
    const startTime = Date.now();
    const { topK = 5, minScore = 0.7, maxTokens = 2000 } = options;

    // 生成查询向量
    const queryEmbedding = await this.generateEmbedding(query);

    // 计算相似度
    const allDocs = this.vectorStore.getAll();
    const results: SearchResult[] = [];

    for (const doc of allDocs) {
      if (!doc.embedding) continue;

      const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
      if (similarity >= minScore) {
        results.push({
          document: doc,
          score: similarity,
          distance: 1 - similarity
        });
      }
    }

    // 排序并截取topK
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, topK);

    // 按token限制截断
    const relevantChunks = this.truncateByTokens(
      topResults.map(r => r.document),
      maxTokens
    );

    const searchTime = Date.now() - startTime;
    const totalTokens = relevantChunks.reduce((sum, doc) => sum + this.estimateTokens(doc.content), 0);

    return {
      query,
      relevantChunks,
      totalTokens,
      searchTime
    };
  }

  /**
   * 检索特定角色的相关上下文
   */
  async retrieveForCharacter(
    characterName: string,
    options: {
      topK?: number;
      maxTokens?: number;
    } = {}
  ): Promise<RAGContext> {
    const { topK = 10, maxTokens = 3000 } = options;

    // 构建角色查询
    const query = `${characterName}的性格特征 外貌描述 行为动机 情感变化`;

    // 先获取所有包含该角色的文档
    const allDocs = this.vectorStore.getAll();
    const characterDocs = allDocs.filter(doc =>
      doc.metadata.characterMentions?.includes(characterName) ||
      doc.content.includes(characterName)
    );

    // 如果没有找到，使用普通检索
    if (characterDocs.length === 0) {
      return this.retrieve(query, { topK, maxTokens });
    }

    // 按重要性排序
    characterDocs.sort((a, b) =>
      (b.metadata.importance || 0) - (a.metadata.importance || 0)
    );

    const relevantChunks = this.truncateByTokens(characterDocs.slice(0, topK), maxTokens);
    const totalTokens = relevantChunks.reduce((sum, doc) => sum + this.estimateTokens(doc.content), 0);

    return {
      query,
      relevantChunks,
      totalTokens,
      searchTime: 0
    };
  }

  /**
   * 检索场景相关上下文
   */
  async retrieveForScene(
    sceneDescription: string,
    options: {
      topK?: number;
      maxTokens?: number;
    } = {}
  ): Promise<RAGContext> {
    const query = `场景描述: ${sceneDescription} 环境 氛围 时间 地点`;
    return this.retrieve(query, options);
  }

  /**
   * 生成增强提示词
   */
  generateAugmentedPrompt(
    basePrompt: string,
    context: RAGContext,
    options: {
      maxContextLength?: number;
      includeMetadata?: boolean;
    } = {}
  ): string {
    const { maxContextLength = 1500, includeMetadata = false } = options;

    // 构建上下文文本
    let contextText = '';
    let currentLength = 0;

    for (const doc of context.relevantChunks) {
      const docText = includeMetadata
        ? `[${doc.metadata.source}] ${doc.content}`
        : doc.content;

      if (currentLength + docText.length > maxContextLength) {
        break;
      }

      contextText += `\n---\n${docText}`;
      currentLength += docText.length;
    }

    return `基于以下小说原文片段回答问题：

${contextText}

---

问题：${basePrompt}

请严格基于上述原文片段回答，不要添加原文中没有的信息。`;
  }

  /**
   * 生成文本嵌入向量（简化版）
   * 生产环境应调用实际的嵌入模型API（如OpenAI text-embedding-3-small）
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // 简化实现：使用字符哈希生成伪嵌入向量
    // 实际生产环境应替换为真实的嵌入模型调用
    const embedding: number[] = new Array(this.EMBEDDING_DIM).fill(0);

    // 基于字符频率生成向量
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      embedding[char % this.EMBEDDING_DIM] += 1;
    }

    // 归一化
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 估算token数量
   */
  private estimateTokens(text: string): number {
    // 简单估算: 中文字符 ≈ 1 token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return Math.ceil(chineseChars + englishWords * 1.3);
  }

  /**
   * 按token限制截断文档列表
   */
  private truncateByTokens(docs: Document[], maxTokens: number): Document[] {
    const result: Document[] = [];
    let currentTokens = 0;

    for (const doc of docs) {
      const tokens = this.estimateTokens(doc.content);
      if (currentTokens + tokens > maxTokens) {
        break;
      }
      result.push(doc);
      currentTokens += tokens;
    }

    return result;
  }

  /**
   * 获取存储统计
   */
  getStats(): { documentCount: number; averageDocLength: number } {
    const docs = this.vectorStore.getAll();
    const totalLength = docs.reduce((sum, doc) => sum + doc.content.length, 0);

    return {
      documentCount: docs.length,
      averageDocLength: docs.length > 0 ? totalLength / docs.length : 0
    };
  }

  /**
   * 清空存储
   */
  clear(): void {
    this.vectorStore.clear();
  }
}

// 导出单例实例
export const ragRetrieval = new RAGRetrieval();
