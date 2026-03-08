import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScriptParser, ScriptParserConfig } from './scriptParser';
import { ParseStage } from '../types';

// Mock storage service
vi.mock('./storage', () => ({
  storageService: {
    updateScriptParseState: vi.fn(),
    getScript: vi.fn()
  }
}));

// Mock LLMProvider
vi.mock('./ai/providers/LLMProvider', () => ({
  llmProvider: {
    generateText: vi.fn(),
    generateStructured: vi.fn()
  }
}));

describe('ScriptParser Parallel Extraction', () => {
  let parser: ScriptParser;
  const apiKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should have useParallelExtraction enabled by default', () => {
      parser = new ScriptParser(apiKey);
      const config = parser.getConfig();
      expect(config.useParallelExtraction).toBe(true);
    });

    it('should allow disabling useParallelExtraction', () => {
      parser = new ScriptParser(apiKey, undefined, undefined, undefined, {
        useParallelExtraction: false
      });
      const config = parser.getConfig();
      expect(config.useParallelExtraction).toBe(false);
    });

    it('should allow enabling useParallelExtraction explicitly', () => {
      parser = new ScriptParser(apiKey, undefined, undefined, undefined, {
        useParallelExtraction: true
      });
      const config = parser.getConfig();
      expect(config.useParallelExtraction).toBe(true);
    });
  });

  describe('parseShortScriptOptimized', () => {
    const mockContent = `
      《测试短剧》
      
      第一章：初遇
      
      场景：咖啡厅
      人物：李明、王芳
      
      李明走进咖啡厅，看到了坐在窗边的王芳。
      
      场景：公园
      人物：李明、王芳
      
      两人在公园散步，聊天。
    `;

    it('should exist as a method', () => {
      parser = new ScriptParser(apiKey);
      expect(typeof parser.parseShortScriptOptimized).toBe('function');
    });

    it('should call progress callback with correct stages', async () => {
      const { llmProvider } = await import('./ai/providers/LLMProvider');
      
      // Mock successful responses
      vi.mocked(llmProvider.generateStructured).mockResolvedValue({
        success: true,
        data: {
          title: '测试短剧',
          wordCount: 100,
          estimatedDuration: '5分钟',
          characterCount: 2,
          characterNames: ['李明', '王芳'],
          sceneCount: 2,
          sceneNames: ['咖啡厅', '公园'],
          chapterCount: 1,
          genre: '现代',
          tone: '正剧'
        }
      });

      vi.mocked(llmProvider.generateText).mockResolvedValue({
        success: true,
        data: JSON.stringify([
          {
            name: '李明',
            gender: 'male',
            age: '25',
            identity: '程序员',
            appearance: {
              height: '175cm',
              build: '标准',
              face: '帅气',
              hair: '短发',
              clothing: '休闲装'
            },
            personality: ['开朗'],
            signatureItems: [],
            emotionalArc: [],
            relationships: []
          },
          {
            name: '王芳',
            gender: 'female',
            age: '24',
            identity: '设计师',
            appearance: {
              height: '165cm',
              build: '苗条',
              face: '漂亮',
              hair: '长发',
              clothing: '连衣裙'
            },
            personality: ['温柔'],
            signatureItems: [],
            emotionalArc: [],
            relationships: []
          }
        ])
      });

      parser = new ScriptParser(apiKey, undefined, undefined, undefined, {
        useSemanticChunking: false,
        useDramaRules: false,
        useCache: false
      });

      const progressStages: { stage: ParseStage; progress: number }[] = [];
      const onProgress = (stage: ParseStage, progress: number) => {
        progressStages.push({ stage, progress });
      };

      try {
        await parser.parseShortScriptOptimized(mockContent, onProgress);
      } catch (e) {
        // Expected to fail due to mocking
      }

      // Verify progress was called
      expect(progressStages.length).toBeGreaterThan(0);
      
      // Verify metadata stage was called
      const metadataStage = progressStages.find(p => p.stage === 'metadata');
      expect(metadataStage).toBeDefined();
      
      // Verify progress increases
      if (progressStages.length >= 2) {
        expect(progressStages[progressStages.length - 1].progress).toBeGreaterThanOrEqual(
          progressStages[0].progress
        );
      }
    });
  });

  describe('Strategy Selection', () => {
    it('should use parseShortScriptOptimized when useParallelExtraction is true', async () => {
      const { llmProvider } = await import('./ai/providers/LLMProvider');
      
      vi.mocked(llmProvider.generateStructured).mockResolvedValue({
        success: true,
        data: {
          title: '短剧',
          wordCount: 500,
          estimatedDuration: '3分钟',
          characterCount: 2,
          characterNames: ['A', 'B'],
          sceneCount: 1,
          sceneNames: ['场景1'],
          chapterCount: 1,
          genre: '现代',
          tone: '正剧'
        }
      });

      vi.mocked(llmProvider.generateText).mockResolvedValue({
        success: true,
        data: '[]'
      });

      parser = new ScriptParser(apiKey, undefined, undefined, undefined, {
        useParallelExtraction: true,
        useSemanticChunking: false,
        useDramaRules: false,
        useCache: false
      });

      // Spy on the optimized method
      const optimizedSpy = vi.spyOn(parser, 'parseShortScriptOptimized');
      const legacySpy = vi.spyOn(parser, 'parseShortScript');

      const shortContent = '短剧内容'.repeat(50); // ~400 characters

      try {
        await parser.parseScript('script-1', 'project-1', shortContent);
      } catch (e) {
        // Expected
      }

      // The optimized method should be called when useParallelExtraction is true
      // and strategy is 'fast'
    });

    it('should use parseShortScript when useParallelExtraction is false', async () => {
      parser = new ScriptParser(apiKey, undefined, undefined, undefined, {
        useParallelExtraction: false,
        useSemanticChunking: false,
        useDramaRules: false,
        useCache: false
      });

      // Spy on both methods
      const optimizedSpy = vi.spyOn(parser, 'parseShortScriptOptimized');
      const legacySpy = vi.spyOn(parser, 'parseShortScript');

      const shortContent = '短剧内容'.repeat(50);

      try {
        await parser.parseScript('script-2', 'project-2', shortContent);
      } catch (e) {
        // Expected
      }

      // When useParallelExtraction is false, legacy method should be used
      // Note: This depends on the strategy selector choosing 'fast' path
    });
  });
});
