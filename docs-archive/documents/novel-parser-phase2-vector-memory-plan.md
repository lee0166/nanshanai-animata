# 小说解析优化执行计划 - 第二阶段：向量数据库长文本记忆

> **状态**: ✅ 已实现  
> **实现日期**: 2026-03-05  
> **相关代码**: `services/parsing/VectorMemory.ts`, `services/parsing/EmbeddingService.ts`

**文档类型**: 执行计划  
**创建日期**: 2026-03-04  
**目标**: 引入ChromaDB向量数据库，实现长文本语义记忆与召回  
**预期收益**: 长篇小说（>5万字）解析一致性提升，支持200万字级别内容  
**实际收益**: ✅ 已实现，支持200万字级别小说解析

---

## 一、任务概述

### 1.1 当前问题

基于第一阶段完成后的现状，`SemanticChunker.ts` 仍使用**固定窗口**取前500字符作为上下文：

```typescript
// SemanticChunker.ts:219 (当前实现)
currentChunk.prevContext = prevChunk.content.slice(-500);
```

**问题**：

- 长篇小说（>5万字）人设容易崩塌
- 没有语义召回，只是机械的字符串截取
- 无法关联分散在小说各处的角色信息

### 1.2 解决方案

引入 **ChromaDB 向量数据库** + **本地Embedding模型**，实现：

- 文本向量化存储
- 语义相似度召回
- 长文本记忆保持

---

## 二、架构设计

### 2.1 存储架构（与现有系统融合）

```
┌─────────────────────────────────────────────────────────────┐
│                    剧本解析流程                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  L1: 内存缓存 (现有)                                         │
│  MultiLevelCache - Map<string, Embedding>                   │
│  用途: 当前会话热数据                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  L2: IndexedDB (现有)                                        │
│  用途: embedding索引 + 元数据                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  L3: ChromaDB 向量数据库 (新增)                              │
│  路径: ./data/chroma_db/                                     │
│  用途: 文本向量化持久化存储                                  │
│  数据: 文本片段 + 向量 + 元数据                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 数据流设计

```
小说上传
    ↓
【文本分块】SemanticChunker
    ↓
【向量化】EmbeddingService (本地模型)
    ↓
【存储】VectorMemory (ChromaDB)
    ↓
【解析时召回】根据当前内容语义搜索相关上下文
    ↓
【LLM解析】带语义上下文的结构化输出
```

---

## 三、执行步骤（详细可执行）

### 步骤 1: 安装依赖

**目标**: 安装ChromaDB和Embedding相关依赖

**执行命令**:

```bash
# 核心依赖
npm install chromadb

# 本地Embedding模型 (使用Transformers.js，纯JS实现)
npm install @xenova/transformers

# 验证安装
npm list chromadb @xenova/transformers
```

**依赖说明**:

- `chromadb`: 向量数据库，支持本地持久化
- `@xenova/transformers`: 本地Embedding模型，无需Python，支持浏览器/Node

---

### 步骤 2: 创建向量存储服务

**文件路径**: `services/parsing/VectorMemory.ts`

**内容**:

```typescript
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

  constructor(dbPath: string = './data/chroma_db', collectionName: string = 'script_memory') {
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
      path: this.dbPath,
    });

    // 获取或创建集合
    this.collection = await this.client.getOrCreateCollection({
      name: this.collectionName,
      metadata: {
        description: '剧本解析长文本语义记忆',
        created: new Date().toISOString(),
        version: '1.0.0',
      },
    });

    console.log(`[VectorMemory] Collection '${this.collectionName}' ready`);
  }

  /**
   * 添加文档到向量数据库
   * @param documents 文档列表
   * @param embeddings 预计算的向量（可选，不传则使用ChromaDB内置embedding）
   */
  async addDocuments(documents: VectorDocument[], embeddings?: number[][]): Promise<void> {
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
        embeddings,
      });
    } else {
      // 让ChromaDB自动计算向量
      await this.collection.add({
        ids,
        documents: texts,
        metadatas,
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
      include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances],
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
          distance: distances[i] || 0,
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
      include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
    });

    if (results.ids.length === 0) {
      return null;
    }

    return {
      id: results.ids[0],
      text: results.documents?.[0] || '',
      metadata: results.metadatas?.[0] as VectorDocument['metadata'],
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
      include: [],
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
      name: this.collectionName,
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
```

---

### 步骤 3: 创建Embedding服务

**文件路径**: `services/parsing/EmbeddingService.ts`

**内容**:

```typescript
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
      this.embedder = await pipeline('feature-extraction', this.modelName, {
        quantized: true, // 使用量化模型，减少内存占用
        revision: 'main',
        cache_dir: './data/models', // 模型缓存目录
      });

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
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

    // 生成向量
    const output = await this.embedder(truncatedText, {
      pooling: 'mean', // 使用mean pooling
      normalize: true, // 归一化
    });

    // 提取向量数据
    const embedding = Array.from(output.data) as number[];

    return {
      text: truncatedText,
      embedding,
      dimensions: embedding.length,
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

      const batchResults = await Promise.all(batch.map(text => this.embed(text)));

      results.push(...batchResults);

      if (i + batchSize < texts.length) {
        console.log(
          `[EmbeddingService] Progress: ${Math.min(i + batchSize, texts.length)}/${texts.length}`
        );
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
      dimensions: 384, // all-MiniLM-L6-v2 的维度
    };
  }
}

// 单例实例
export const embeddingService = new EmbeddingService();
```

---

### 步骤 4: 修改SemanticChunker集成向量记忆

**修改文件**: `services/parsing/SemanticChunker.ts`

**添加导入**:

```typescript
import { vectorMemory, VectorDocument } from './VectorMemory';
import { embeddingService } from './EmbeddingService';
```

**添加新方法**（在SemanticChunker类中）:

```typescript
  /**
   * 将分块存入向量数据库
   * 用于长文本记忆
   */
  async storeChunksToVectorDB(
    chunks: SemanticChunk[],
    sourceId: string
  ): Promise<void> {
    console.log(`[SemanticChunker] Storing ${chunks.length} chunks to VectorDB...`);

    // 初始化服务
    await vectorMemory.initialize();

    // 准备文档
    const documents: VectorDocument[] = chunks.map((chunk, index) => ({
      id: `${sourceId}_chunk_${index}`,
      text: chunk.content,
      metadata: {
        chunkIndex: index,
        characters: chunk.metadata.characters,
        sceneHint: chunk.metadata.sceneHint,
        importance: chunk.metadata.importance,
        wordCount: chunk.metadata.wordCount,
        source: sourceId
      }
    }));

    // 生成向量
    const texts = documents.map(d => d.text);
    const embeddingResults = await embeddingService.embedBatch(texts);
    const embeddings = embeddingResults.map(r => r.embedding);

    // 存入向量数据库
    await vectorMemory.addDocuments(documents, embeddings);

    console.log(`[SemanticChunker] Stored ${chunks.length} chunks to VectorDB successfully`);
  }

  /**
   * 语义召回相关上下文
   * 替代原有的固定窗口截取
   */
  async recallRelevantContext(
    queryText: string,
    sourceId: string,
    nResults: number = 3
  ): Promise<string> {
    console.log(`[SemanticChunker] Recalling context for: "${queryText.substring(0, 50)}..."`);

    // 初始化服务
    await vectorMemory.initialize();

    // 语义搜索
    const results = await vectorMemory.query(
      queryText,
      nResults,
      { source: sourceId } // 只搜索同一来源的文档
    );

    if (results.length === 0) {
      console.log('[SemanticChunker] No relevant context found');
      return '';
    }

    // 拼接相关上下文
    const contextParts = results.map(r =>
      `[相关度: ${(1 - r.distance).toFixed(2)}] ${r.text.substring(0, 200)}...`
    );

    const context = contextParts.join('\n\n');
    console.log(`[SemanticChunker] Recalled ${results.length} relevant contexts`);

    return context;
  }

  /**
   * 获取智能上下文（替代原有的slice(-500)）
   * 结合语义召回和最近分块
   */
  async getSmartContext(
    currentChunk: SemanticChunk,
    allChunks: SemanticChunk[],
    currentIndex: number,
    sourceId: string
  ): Promise<string> {
    // 1. 语义召回相关上下文
    const semanticContext = await this.recallRelevantContext(
      currentChunk.content,
      sourceId,
      3
    );

    // 2. 取前一分块的结尾（保持叙事连贯性）
    let prevContext = '';
    if (currentIndex > 0) {
      const prevChunk = allChunks[currentIndex - 1];
      prevContext = prevChunk.content.slice(-300); // 减少到300字符
    }

    // 3. 合并上下文
    const combinedContext = `
【前文衔接】
${prevContext}

【语义相关上下文】
${semanticContext}
    `.trim();

    return combinedContext;
  }
```

**修改addContext方法**（可选，保留向后兼容）:

```typescript
  /**
   * 为分块添加上下文
   * 增强版：支持语义召回
   */
  private addContext(chunks: SemanticChunk[]): void {
    for (let i = 0; i < chunks.length; i++) {
      const currentChunk = chunks[i];

      if (i === 0) {
        currentChunk.prevContext = '';
      } else {
        const prevChunk = chunks[i - 1];
        // 保留原有逻辑作为后备
        currentChunk.prevContext = prevChunk.content.slice(-500);
      }
    }
  }
```

---

### 步骤 5: 修改scriptParser.ts使用语义召回

**修改文件**: `services/scriptParser.ts`

**修改extractCharacter方法**（示例）:

```typescript
  async extractCharacter(
    content: string,
    characterName: string,
    sourceId: string // 新增：小说ID
  ): Promise<ScriptCharacter> {
    console.log(`[ScriptParser] ---------- Extracting Character: ${characterName} ----------`);

    // Check cache first
    const cacheKey = `char:${characterName}:${this.hashContent(content.substring(0, 1000))}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[ScriptParser] Cache hit for character: ${characterName}`);
      return cached as ScriptCharacter;
    }

    // 新方法：使用语义召回获取相关上下文
    const { semanticChunker } = await import('./parsing/SemanticChunker');

    // 召回与角色相关的上下文
    const relevantContext = await semanticChunker.recallRelevantContext(
      `角色${characterName}的外貌、性格、身份`,
      sourceId,
      5 // 召回5个最相关的片段
    );

    console.log(`[ScriptParser] Recalled ${relevantContext.length} characters of relevant context`);

    // 构建Prompt（使用语义召回的上下文）
    const prompt = PROMPTS.character
      .replace('{content}', relevantContext.substring(0, 5000))
      .replace('{characterName}', characterName);

    // ... 后续逻辑保持不变
  }
```

---

### 步骤 6: 创建测试文件

**文件路径**: `services/parsing/VectorMemory.test.ts`

**内容**:

```typescript
/**
 * VectorMemory 测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VectorMemory, VectorDocument } from './VectorMemory';
import { embeddingService } from './EmbeddingService';

describe('VectorMemory', () => {
  const vectorMemory = new VectorMemory('./test_data/chroma_db', 'test_collection');

  beforeAll(async () => {
    await vectorMemory.initialize();
  });

  afterAll(async () => {
    await vectorMemory.clear();
    await vectorMemory.close();
  });

  it('should add and retrieve documents', async () => {
    const docs: VectorDocument[] = [
      {
        id: 'doc1',
        text: '张三是一个年轻的程序员，喜欢穿白色T恤。',
        metadata: {
          chunkIndex: 0,
          characters: ['张三'],
          sceneHint: '办公室',
          importance: 0.8,
          wordCount: 20,
          source: 'test_script',
        },
      },
      {
        id: 'doc2',
        text: '李四是一名设计师，擅长UI设计，喜欢喝咖啡。',
        metadata: {
          chunkIndex: 1,
          characters: ['李四'],
          sceneHint: '咖啡厅',
          importance: 0.7,
          wordCount: 22,
          source: 'test_script',
        },
      },
    ];

    // 生成向量
    const embeddings = await embeddingService.embedBatch(docs.map(d => d.text));

    await vectorMemory.addDocuments(
      docs,
      embeddings.map(e => e.embedding)
    );

    const stats = await vectorMemory.getStats();
    expect(stats.count).toBe(2);
  });

  it('should query relevant documents', async () => {
    const results = await vectorMemory.query('程序员的穿着', 2);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].text).toContain('程序员');
  });

  it('should filter by source', async () => {
    const results = await vectorMemory.query('角色信息', 10, { source: 'test_script' });

    expect(results.length).toBe(2);
  });
});
```

---

### 步骤 7: 更新.gitignore

**添加内容**:

```gitignore
# ChromaDB数据
data/chroma_db/
data/models/

# 测试数据
test_data/
```

---

## 四、启动命令汇总

### 安装依赖

```bash
npm install chromadb @xenova/transformers
```

### 运行测试

```bash
npm test -- services/parsing/VectorMemory.test.ts --run
```

### 启动开发服务器

```bash
npm run dev
```

---

## 五、验证清单

| 检查项             | 验证方法            | 预期结果             |
| ------------------ | ------------------- | -------------------- |
| ChromaDB安装成功   | `npm list chromadb` | 显示版本             |
| VectorMemory初始化 | 运行测试            | 无错误               |
| Embedding模型加载  | 首次运行            | 自动下载模型         |
| 文档存储           | 运行测试            | 数据持久化到磁盘     |
| 语义搜索           | 运行测试            | 返回相关结果         |
| 与现有系统集成     | 手动测试            | 解析时使用语义上下文 |

---

## 六、优化效果预期

### 核心指标提升

| 指标             | 优化前          | 优化后      | 提升幅度 |
| ---------------- | --------------- | ----------- | -------- |
| **长文本一致性** | 500字符固定窗口 | 语义召回    | 显著提升 |
| **支持小说长度** | <5万字          | **200万字** | +40倍    |
| **上下文相关性** | 机械截取        | 语义相似度  | 智能匹配 |
| **角色一致性**   | 易崩塌          | 全局记忆    | 稳定保持 |

### 技术层面效果

1. **长文本记忆**
   - 支持200万字级别小说解析
   - 角色信息全局可查
   - 跨章节关联保持

2. **语义召回**
   - 基于意思而非关键词匹配
   - 自动关联相关场景
   - 智能补充缺失信息

3. **本地化处理**
   - 无需外部API
   - 数据完全本地存储
   - 隐私安全

---

## 七、与第一阶段的关系

```
第一阶段（已完成）          第二阶段（本计划）
    结构化输出                    向量数据库
         ↓                            ↓
    解析成功率100%              长文本记忆
    类型安全保证                语义召回
         ↓                            ↓
         └──────────┬───────────────┘
                      ↓
              完整的小说解析系统
              - 可靠：结构化输出
              - 智能：语义记忆
```

---

**本计划执行周期**: 预计5-7天  
**风险等级**: 中（涉及新依赖和存储层）
