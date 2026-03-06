/**
 * ScriptParser Vector Memory Integration Tests
 *
 * Tests for vector memory integration with ScriptParser
 * @module services/scriptParser.vector.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ScriptParser } from './scriptParser';
import { VectorMemory } from './parsing/VectorMemory';
import { EmbeddingService } from './parsing/EmbeddingService';

// Mock dependencies
vi.mock('./parsing/VectorMemory');
vi.mock('./parsing/EmbeddingService');

describe('ScriptParser Vector Memory Integration', () => {
  let parser: ScriptParser;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize vector memory when enabled', async () => {
      const mockInitialize = vi.fn().mockResolvedValue(undefined);
      const mockVectorMemory = {
        initialize: mockInitialize,
        addDocuments: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        getStats: vi.fn()
      };

      const mockEmbeddingInit = vi.fn().mockResolvedValue(undefined);
      const mockEmbeddingService = {
        initialize: mockEmbeddingInit,
        embed: vi.fn(),
        embedBatch: vi.fn()
      };

      vi.mocked(VectorMemory).mockImplementation(() => mockVectorMemory as any);
      vi.mocked(EmbeddingService).mockImplementation(() => mockEmbeddingService as any);

      parser = new ScriptParser({
        enableVectorMemory: true,
        vectorMemoryConfig: {
          collectionName: 'test_collection'
        }
      });

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockInitialize).toHaveBeenCalled();
      expect(mockEmbeddingInit).toHaveBeenCalled();
    });

    it('should not initialize vector memory when disabled', async () => {
      const mockInitialize = vi.fn();
      vi.mocked(VectorMemory).mockImplementation(() => ({
        initialize: mockInitialize
      }) as any);

      parser = new ScriptParser({
        enableVectorMemory: false
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockInitialize).not.toHaveBeenCalled();
    });

    it('should fallback to normal mode when vector memory initialization fails', async () => {
      const mockInitialize = vi.fn().mockRejectedValue(new Error('ChromaDB not available'));
      vi.mocked(VectorMemory).mockImplementation(() => ({
        initialize: mockInitialize
      }) as any);

      parser = new ScriptParser({
        enableVectorMemory: true
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not throw, just log warning
      expect(mockInitialize).toHaveBeenCalled();
    });
  });

  describe('Chunk Storage', () => {
    it('should store chunks to vector database when enabled', async () => {
      const mockAddDocuments = vi.fn().mockResolvedValue(undefined);
      const mockEmbedBatch = vi.fn().mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]);

      vi.mocked(VectorMemory).mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        addDocuments: mockAddDocuments,
        query: vi.fn(),
        clear: vi.fn(),
        getStats: vi.fn()
      }) as any);

      vi.mocked(EmbeddingService).mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        embed: vi.fn(),
        embedBatch: mockEmbedBatch
      }) as any);

      parser = new ScriptParser({
        enableVectorMemory: true,
        useSemanticChunking: true
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Test chunk storage through semantic chunking
      const testText = '第一章\n\n这是测试内容。\n\n第二章\n\n更多测试内容。';

      // Access private method for testing
      const chunkTextMethod = (parser as any).chunkText.bind(parser);
      await chunkTextMethod(testText);

      // Verify embeddings were generated and documents stored
      expect(mockEmbedBatch).toHaveBeenCalled();
      expect(mockAddDocuments).toHaveBeenCalled();
    });

    it('should not store chunks when vector memory is disabled', async () => {
      const mockAddDocuments = vi.fn();

      parser = new ScriptParser({
        enableVectorMemory: false,
        useSemanticChunking: true
      });

      const testText = '第一章\n\n这是测试内容。';
      const chunkTextMethod = (parser as any).chunkText.bind(parser);
      await chunkTextMethod(testText);

      expect(mockAddDocuments).not.toHaveBeenCalled();
    });
  });

  describe('Context Recall', () => {
    it('should recall relevant context when enabled', async () => {
      const mockQuery = vi.fn().mockResolvedValue([
        { id: 'chunk1', text: '相关内容1', metadata: { chunkIndex: 0 }, distance: 0.1 },
        { id: 'chunk2', text: '相关内容2', metadata: { chunkIndex: 1 }, distance: 0.2 }
      ]);

      vi.mocked(VectorMemory).mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        addDocuments: vi.fn(),
        query: mockQuery,
        clear: vi.fn(),
        getStats: vi.fn()
      }) as any);

      vi.mocked(EmbeddingService).mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        embed: vi.fn(),
        embedBatch: vi.fn()
      }) as any);

      parser = new ScriptParser({
        enableVectorMemory: true
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const getSmartContextMethod = (parser as any).getSmartContext.bind(parser);
      const context = await getSmartContextMethod('查询内容');

      expect(mockQuery).toHaveBeenCalledWith('查询内容', 3);
      expect(context).toContain('相关内容1');
      expect(context).toContain('相关内容2');
    });

    it('should return empty string when vector memory is disabled', async () => {
      parser = new ScriptParser({
        enableVectorMemory: false
      });

      const getSmartContextMethod = (parser as any).getSmartContext.bind(parser);
      const context = await getSmartContextMethod('查询内容');

      expect(context).toBe('');
    });

    it('should exclude current chunk from context', async () => {
      const mockQuery = vi.fn().mockResolvedValue([
        { id: 'chunk1', text: '当前分块', metadata: { chunkIndex: 5 }, distance: 0.1 },
        { id: 'chunk2', text: '其他分块', metadata: { chunkIndex: 2 }, distance: 0.2 }
      ]);

      vi.mocked(VectorMemory).mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        addDocuments: vi.fn(),
        query: mockQuery,
        clear: vi.fn(),
        getStats: vi.fn()
      }) as any);

      vi.mocked(EmbeddingService).mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        embed: vi.fn(),
        embedBatch: vi.fn()
      }) as any);

      parser = new ScriptParser({
        enableVectorMemory: true
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const getSmartContextMethod = (parser as any).getSmartContext.bind(parser);
      const context = await getSmartContextMethod('查询内容', 5);

      expect(context).not.toContain('当前分块');
      expect(context).toContain('其他分块');
    });
  });

  describe('Utility Methods', () => {
    it('should clear vector memory', async () => {
      const mockClear = vi.fn().mockResolvedValue(undefined);

      vi.mocked(VectorMemory).mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        addDocuments: vi.fn(),
        query: vi.fn(),
        clear: mockClear,
        getStats: vi.fn()
      }) as any);

      vi.mocked(EmbeddingService).mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        embed: vi.fn(),
        embedBatch: vi.fn()
      }) as any);

      parser = new ScriptParser({
        enableVectorMemory: true
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      await parser.clearVectorMemory();

      expect(mockClear).toHaveBeenCalled();
    });

    it('should get vector memory stats', async () => {
      const mockGetStats = vi.fn().mockResolvedValue({ count: 42 });

      vi.mocked(VectorMemory).mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        addDocuments: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        getStats: mockGetStats
      }) as any);

      vi.mocked(EmbeddingService).mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        embed: vi.fn(),
        embedBatch: vi.fn()
      }) as any);

      parser = new ScriptParser({
        enableVectorMemory: true
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      const stats = await parser.getVectorMemoryStats();

      expect(mockGetStats).toHaveBeenCalled();
      expect(stats).toEqual({ count: 42 });
    });

    it('should return null stats when vector memory is not initialized', async () => {
      parser = new ScriptParser({
        enableVectorMemory: false
      });

      const stats = await parser.getVectorMemoryStats();
      expect(stats).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle query failures gracefully', async () => {
      const mockQuery = vi.fn().mockRejectedValue(new Error('Query failed'));

      vi.mocked(VectorMemory).mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        addDocuments: vi.fn(),
        query: mockQuery,
        clear: vi.fn(),
        getStats: vi.fn()
      }) as any);

      vi.mocked(EmbeddingService).mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        embed: vi.fn(),
        embedBatch: vi.fn()
      }) as any);

      parser = new ScriptParser({
        enableVectorMemory: true
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const getSmartContextMethod = (parser as any).getSmartContext.bind(parser);
      const context = await getSmartContextMethod('查询内容');

      // Should return empty string instead of throwing
      expect(context).toBe('');
    });

    it('should handle storage failures gracefully', async () => {
      const mockEmbedBatch = vi.fn().mockRejectedValue(new Error('Embedding failed'));

      vi.mocked(VectorMemory).mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        addDocuments: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        getStats: vi.fn()
      }) as any);

      vi.mocked(EmbeddingService).mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        embed: vi.fn(),
        embedBatch: mockEmbedBatch
      }) as any);

      parser = new ScriptParser({
        enableVectorMemory: true,
        useSemanticChunking: true
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const testText = '第一章\n\n这是测试内容。';
      const chunkTextMethod = (parser as any).chunkText.bind(parser);

      // Should not throw even if embedding fails
      await expect(chunkTextMethod(testText)).resolves.not.toThrow();
    });
  });
});
