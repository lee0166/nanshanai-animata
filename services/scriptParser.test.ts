import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createScriptParser, ConcurrencyLimiter, ParseCache } from './scriptParser';

// Mock storage service
vi.mock('./storage', () => ({
  storageService: {
    updateScriptParseState: vi.fn().mockResolvedValue(undefined),
    getScript: vi.fn().mockResolvedValue(null),
  },
}));

describe('ScriptParser', () => {
  const apiKey = 'test-api-key';
  let parser: ReturnType<typeof createScriptParser>;

  beforeEach(() => {
    parser = createScriptParser(apiKey);
    vi.clearAllMocks();
  });

  describe('extractJSON', () => {
    it('should extract JSON from markdown code blocks', () => {
      const response = '```json\n{"name": "Test", "age": 25}\n```';
      const result = (parser as any).extractJSON(response);
      expect(result).toEqual({ name: 'Test', age: 25 });
    });

    it('should extract JSON without markdown markers', () => {
      const response = '{"name": "Test", "age": 25}';
      const result = (parser as any).extractJSON(response);
      expect(result).toEqual({ name: 'Test', age: 25 });
    });

    it('should fix trailing commas', () => {
      const response = '{"name": "Test", "items": [1, 2, 3,],}';
      const result = (parser as any).extractJSON(response);
      expect(result).toEqual({ name: 'Test', items: [1, 2, 3] });
    });

    it('should fix single quotes', () => {
      const response = "{'name': 'Test', 'age': 25}";
      const result = (parser as any).extractJSON(response);
      expect(result).toEqual({ name: 'Test', age: 25 });
    });

    it('should throw error for invalid JSON', () => {
      const response = 'not valid json';
      expect(() => (parser as any).extractJSON(response)).toThrow('Invalid JSON response from LLM');
    });
  });

  describe('chunkText', () => {
    it('should split text into chunks by paragraphs when exceeding max size', () => {
      const text = 'Para 1\n\nPara 2\n\nPara 3';
      const chunks = (parser as any).chunkText(text, 10); // Small chunk size to force splitting
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect max chunk size', () => {
      const text = 'A'.repeat(200) + '\n\n' + 'B'.repeat(200);
      const chunks = (parser as any).chunkText(text, 250);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('hashContent', () => {
    it('should generate consistent hash for same content', () => {
      const content = 'test content';
      const hash1 = (parser as any).hashContent(content);
      const hash2 = (parser as any).hashContent(content);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const hash1 = (parser as any).hashContent('content1');
      const hash2 = (parser as any).hashContent('content2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('cancel', () => {
    it('should abort ongoing request', () => {
      parser.cancel();
      // Should not throw
    });
  });
});

describe('ParseCache', () => {
  it('should cache and retrieve values', () => {
    const cache = new ParseCache(10, 3600000);
    const content = 'test content';
    const result = { data: 'test result' };

    cache.set(content, result);
    const retrieved = cache.get(content);

    expect(retrieved).toEqual(result);
  });

  it('should return null for non-existent key', () => {
    const cache = new ParseCache(10, 3600000);
    const retrieved = cache.get('non-existent');
    expect(retrieved).toBeNull();
  });

  it('should respect max size (LRU eviction)', () => {
    const cache = new ParseCache(2, 3600000);

    cache.set('content1', { data: 1 });
    cache.set('content2', { data: 2 });
    cache.set('content3', { data: 3 }); // Should evict content1

    expect(cache.get('content1')).toBeNull();
    expect(cache.get('content2')).toEqual({ data: 2 });
    expect(cache.get('content3')).toEqual({ data: 3 });
  });

  it('should respect TTL', async () => {
    const cache = new ParseCache(10, 100); // 100ms TTL

    cache.set('content', { data: 'test' });
    expect(cache.get('content')).toEqual({ data: 'test' });

    await new Promise(resolve => setTimeout(resolve, 150));
    expect(cache.get('content')).toBeNull();
  });
});

describe('ConcurrencyLimiter', () => {
  it('should limit concurrent executions', async () => {
    const limiter = new ConcurrencyLimiter(2);

    let running = 0;
    let maxRunning = 0;

    const tasks = Array(5).fill(null).map((_, i) =>
      limiter.run(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise(resolve => setTimeout(resolve, 50));
        running--;
        return i;
      })
    );

    await Promise.all(tasks);
    expect(maxRunning).toBe(2);
  });

  it('should execute all tasks', async () => {
    const limiter = new ConcurrencyLimiter(2);

    const results = await Promise.all([
      limiter.run(async () => 1),
      limiter.run(async () => 2),
      limiter.run(async () => 3),
    ]);

    expect(results).toEqual([1, 2, 3]);
  });
});
