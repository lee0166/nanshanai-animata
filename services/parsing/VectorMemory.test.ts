/**
 * VectorMemory 测试
 * 注意：此测试需要ChromaDB服务器运行
 * 启动服务器: chroma run --path ./data/chroma_db
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VectorMemory, VectorDocument } from './VectorMemory';
import { embeddingService } from './EmbeddingService';

describe('VectorMemory', () => {
  // 使用本地服务器进行测试
  const vectorMemory = new VectorMemory('http://localhost:8000', 'test_collection');
  let isInitialized = false;

  beforeAll(async () => {
    try {
      await vectorMemory.initialize();
      isInitialized = true;
    } catch (error) {
      console.warn('[Test] ChromaDB not available, skipping tests');
      console.warn('[Test] To run these tests, start ChromaDB server:');
      console.warn('[Test]   npx chroma run --path ./data/chroma_db');
    }
  });

  afterAll(async () => {
    if (isInitialized) {
      try {
        await vectorMemory.clear();
        await vectorMemory.close();
      } catch (error) {
        // 忽略清理错误
      }
    }
  });

  it('should add and retrieve documents', async () => {
    if (!isInitialized) {
      console.warn('[Test] Skipping: ChromaDB not available');
      return;
    }

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
          source: 'test_script'
        }
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
          source: 'test_script'
        }
      }
    ];

    // 生成向量
    const embeddings = await embeddingService.embedBatch(docs.map(d => d.text));
    
    await vectorMemory.addDocuments(docs, embeddings.map(e => e.embedding));

    const stats = await vectorMemory.getStats();
    expect(stats.count).toBe(2);
  });

  it('should query relevant documents', async () => {
    if (!isInitialized) {
      console.warn('[Test] Skipping: ChromaDB not available');
      return;
    }

    const results = await vectorMemory.query('程序员的穿着', 2);
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].text).toContain('程序员');
  });

  it('should filter by source', async () => {
    if (!isInitialized) {
      console.warn('[Test] Skipping: ChromaDB not available');
      return;
    }

    const results = await vectorMemory.query(
      '角色信息',
      10,
      { source: 'test_script' }
    );
    
    expect(results.length).toBe(2);
  });
});
