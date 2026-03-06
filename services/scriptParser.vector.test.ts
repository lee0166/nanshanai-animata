/**
 * ScriptParser Vector Memory Integration Tests
 *
 * Tests for vector memory integration with ScriptParser
 * @module services/scriptParser.vector.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock VectorMemory and EmbeddingService before importing ScriptParser
vi.mock('./parsing/VectorMemory', () => ({
  VectorMemory: vi.fn()
}));

vi.mock('./parsing/EmbeddingService', () => ({
  EmbeddingService: vi.fn()
}));

// Import after mocks are set up
import { ScriptParser } from './scriptParser';
import { VectorMemory } from './parsing/VectorMemory';
import { EmbeddingService } from './parsing/EmbeddingService';

describe('ScriptParser Vector Memory Integration', () => {
  let parser: ScriptParser;
  let mockInitialize: ReturnType<typeof vi.fn>;
  let mockAddDocuments: ReturnType<typeof vi.fn>;
  let mockQuery: ReturnType<typeof vi.fn>;
  let mockClear: ReturnType<typeof vi.fn>;
  let mockGetStats: ReturnType<typeof vi.fn>;
  let mockEmbeddingInit: ReturnType<typeof vi.fn>;
  let mockEmbed: ReturnType<typeof vi.fn>;
  let mockEmbedBatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock functions
    mockInitialize = vi.fn().mockResolvedValue(undefined);
    mockAddDocuments = vi.fn().mockResolvedValue(undefined);
    mockQuery = vi.fn().mockResolvedValue([]);
    mockClear = vi.fn().mockResolvedValue(undefined);
    mockGetStats = vi.fn().mockResolvedValue({ count: 42 });
    mockEmbeddingInit = vi.fn().mockResolvedValue(undefined);
    mockEmbed = vi.fn().mockResolvedValue({ embedding: [0.1, 0.2, 0.3], dimensions: 3 });
    mockEmbedBatch = vi.fn().mockResolvedValue([
      { embedding: [0.1, 0.2], dimensions: 2 },
      { embedding: [0.3, 0.4], dimensions: 2 }
    ]);

    // Set up VectorMemory mock implementation
    vi.mocked(VectorMemory).mockImplementation(() => ({
      initialize: mockInitialize,
      addDocuments: mockAddDocuments,
      query: mockQuery,
      clear: mockClear,
      getStats: mockGetStats
    }) as any);

    // Set up EmbeddingService mock implementation
    vi.mocked(EmbeddingService).mockImplementation(() => ({
      initialize: mockEmbeddingInit,
      embed: mockEmbed,
      embedBatch: mockEmbedBatch
    }) as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize vector memory when enabled', async () => {
      parser = new ScriptParser({
        enableVectorMemory: true,
        vectorMemoryConfig: {
          collectionName: 'test_collection'
        }
      });

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(VectorMemory).toHaveBeenCalledWith(
        undefined,
        'test_collection'
      );
      expect(mockInitialize).toHaveBeenCalled();
      expect(EmbeddingService).toHaveBeenCalled();
      expect(mockEmbeddingInit).toHaveBeenCalled();
    });

    it('should not initialize vector memory when disabled', async () => {
      parser = new ScriptParser({
        enableVectorMemory: false
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(VectorMemory).not.toHaveBeenCalled();
    });

    it('should fallback to normal mode when vector memory initialization fails', async () => {
      mockInitialize.mockRejectedValue(new Error('ChromaDB not available'));

      parser = new ScriptParser({
        enableVectorMemory: true
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not throw, just log warning
      expect(VectorMemory).toHaveBeenCalled();
      expect(mockInitialize).toHaveBeenCalled();
    });
  });

  describe('Chunk Storage', () => {
    it('should store chunks to vector database when enabled', async () => {
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
      mockQuery.mockResolvedValue([
        { id: 'chunk1', text: '相关内容1', metadata: { chunkIndex: 0 }, distance: 0.1 },
        { id: 'chunk2', text: '相关内容2', metadata: { chunkIndex: 1 }, distance: 0.2 }
      ]);

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
      mockQuery.mockResolvedValue([
        { id: 'chunk1', text: '当前分块', metadata: { chunkIndex: 5 }, distance: 0.1 },
        { id: 'chunk2', text: '其他分块', metadata: { chunkIndex: 2 }, distance: 0.2 }
      ]);

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
      parser = new ScriptParser({
        enableVectorMemory: true
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      await parser.clearVectorMemory();

      expect(mockClear).toHaveBeenCalled();
    });

    it('should get vector memory stats', async () => {
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
      mockQuery.mockRejectedValue(new Error('Query failed'));

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
      mockEmbedBatch.mockRejectedValue(new Error('Embedding failed'));

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
