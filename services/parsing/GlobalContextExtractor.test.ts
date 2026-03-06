/**
 * GlobalContextExtractor 单元测试
 * 
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GlobalContextExtractor,
  createGlobalContextExtractor,
  GlobalContext,
  StoryContext,
  VisualContext,
} from './GlobalContextExtractor';
import * as LLMProviderModule from '../ai/providers/LLMProvider';
import type { ModelConfig } from '../../types';

// Mock llmProvider
vi.mock('../ai/providers/LLMProvider', () => ({
  llmProvider: {
    generateText: vi.fn(),
  },
}));

describe('GlobalContextExtractor', () => {
  let mockGenerateText: ReturnType<typeof vi.fn>;
  let extractor: GlobalContextExtractor;
  const mockModelConfig: ModelConfig = {
    id: 'test-model',
    name: 'Test Model',
    provider: 'llm',
    modelId: 'test',
    apiUrl: 'http://test',
    apiKey: 'test-key',
    type: 'llm',
    parameters: [],
    capabilities: {
      supportsJsonMode: true,
      supportsSystemPrompt: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateText = vi.fn();
    (LLMProviderModule.llmProvider as any).generateText = mockGenerateText;
    extractor = new GlobalContextExtractor(mockModelConfig);
  });

  describe('基本功能', () => {
    it('应该正确创建实例', () => {
      expect(extractor).toBeDefined();
      expect(extractor).toBeInstanceOf(GlobalContextExtractor);
    });

    it('createGlobalContextExtractor工厂函数应该正确工作', () => {
      const instance = createGlobalContextExtractor(mockModelConfig);
      expect(instance).toBeInstanceOf(GlobalContextExtractor);
    });
  });

  describe('extract方法', () => {
    it('应该返回完整的GlobalContext对象', async () => {
      // Mock LLM响应
      mockGenerateText
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            synopsis: '这是一个测试故事梗概',
            logline: '一句话简介',
            coreConflict: '核心冲突',
            themes: ['主题1', '主题2'],
            structure: {
              structureType: 'three_act',
              act1: '第一幕',
              act2a: '第二幕上',
              act2b: '第二幕下',
              act3: '第三幕',
              midpoint: '中点',
              climax: '高潮',
            },
          }),
        })
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            artDirection: '写实电影感',
            artStyle: '写实',
            colorPalette: ['#000000', '#FFFFFF'],
            colorMood: '冷峻',
            cinematography: '电影感构图',
            lightingStyle: '自然光',
            references: ['参考影片'],
          }),
        })
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            era: '2024年',
            eraDescription: '现代',
            location: '北京',
            season: '春季',
            timeOfDay: '白天',
          }),
        })
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            overallMood: '励志向上',
            arc: [
              {
                plotPoint: '开场',
                emotion: '平静',
                intensity: 3,
                colorTone: '明亮',
                percentage: 0,
              },
            ],
          }),
        });

      const content = '测试剧本内容';
      const result = await extractor.extract(content);

      expect(result).toBeDefined();
      expect(result.story).toBeDefined();
      expect(result.visual).toBeDefined();
      expect(result.era).toBeDefined();
      expect(result.emotional).toBeDefined();
      expect(result.rules).toBeDefined();
    });

    it('当LLM调用失败时应该返回默认值', async () => {
      mockGenerateText.mockRejectedValue(new Error('LLM Error'));

      const content = '测试剧本内容';
      const result = await extractor.extract(content);

      expect(result).toBeDefined();
      expect(result.story.synopsis).toBe('');
      expect(result.story.logline).toBe('');
      expect(result.visual.artDirection).toBe('');
      expect(result.era.era).toBe('现代');
    });
  });

  describe('convertToMetadata方法', () => {
    it('应该正确转换GlobalContext为ScriptMetadata部分字段', () => {
      const mockContext: GlobalContext = {
        story: {
          synopsis: '故事梗概',
          logline: '一句话简介',
          coreConflict: '核心冲突',
          themes: ['主题1'],
          structure: {
            structureType: 'three_act',
            act1: '第一幕',
            act2a: '第二幕上',
            act2b: '第二幕下',
            act3: '第三幕',
            midpoint: '中点',
            climax: '高潮',
          },
        },
        visual: {
          artDirection: '写实电影感',
          artStyle: '写实',
          colorPalette: ['#000000'],
          colorMood: '冷峻',
          cinematography: '电影感构图',
          lightingStyle: '自然光',
          references: ['参考影片', '导演测试'],
        },
        era: {
          era: '2024年',
          eraDescription: '现代',
          location: '北京',
          season: '春季',
          timeOfDay: '白天',
        },
        emotional: {
          overallMood: '励志向上',
          arc: [],
        },
        rules: {
          characterTraits: {},
          eraConstraints: [],
          styleConstraints: [],
          forbiddenElements: [],
        },
      };

      const metadata = extractor.convertToMetadata(mockContext);

      expect(metadata.synopsis).toBe('故事梗概');
      expect(metadata.logline).toBe('一句话简介');
      expect(metadata.coreConflict).toBe('核心冲突');
      expect(metadata.theme).toEqual(['主题1']);
      expect(metadata.storyStructure).toBeDefined();
      expect(metadata.visualStyle).toBeDefined();
      expect(metadata.eraContext).toBeDefined();
      expect(metadata.emotionalArc).toEqual([]);
      expect(metadata.consistencyRules).toBeDefined();
      expect(metadata.references).toBeDefined();
    });
  });

  describe('一致性规则生成', () => {
    it('古代背景应该生成相应的时代限制', async () => {
      mockGenerateText
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            synopsis: '古代故事',
            logline: '简介',
            coreConflict: '冲突',
            themes: [],
            structure: {
              structureType: 'three_act',
              act1: '',
              act2a: '',
              act2b: '',
              act3: '',
              midpoint: '',
              climax: '',
            },
          }),
        })
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            artDirection: '',
            artStyle: '',
            colorPalette: [],
            colorMood: '',
            cinematography: '',
            lightingStyle: '',
            references: [],
          }),
        })
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            era: '唐代',
            eraDescription: '古代',
            location: '长安',
          }),
        })
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            overallMood: '',
            arc: [],
          }),
        });

      const content = '唐代故事';
      const result = await extractor.extract(content);

      expect(result.rules.eraConstraints.length).toBeGreaterThan(0);
      expect(result.rules.forbiddenElements).toContain('手机');
      expect(result.rules.forbiddenElements).toContain('电脑');
    });

    it('写实风格应该生成相应的风格限制', async () => {
      mockGenerateText
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            synopsis: '现代故事',
            logline: '简介',
            coreConflict: '冲突',
            themes: [],
            structure: {
              structureType: 'three_act',
              act1: '',
              act2a: '',
              act2b: '',
              act3: '',
              midpoint: '',
              climax: '',
            },
          }),
        })
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            artDirection: '写实电影感',
            artStyle: '写实风格',
            colorPalette: [],
            colorMood: '',
            cinematography: '',
            lightingStyle: '',
            references: [],
          }),
        })
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            era: '2024年',
            eraDescription: '现代',
            location: '北京',
          }),
        })
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            overallMood: '',
            arc: [],
          }),
        });

      const content = '现代写实故事';
      const result = await extractor.extract(content);

      expect(result.rules.styleConstraints.length).toBeGreaterThan(0);
      expect(result.rules.styleConstraints[0]).toContain('写实');
    });
  });
});
