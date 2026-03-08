/**
 * GlobalContextExtractor 单元测试
 * 
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GlobalContextExtractor,
  createGlobalContextExtractor,
  GlobalContextExtractorConfig,
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
      // 统一提取只需要一次 LLM 调用
      mockGenerateText
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            story: {
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
            },
            visual: {
              artDirection: '',
              artStyle: '',
              colorPalette: [],
              colorMood: '',
              cinematography: '',
              lightingStyle: '',
              references: [],
            },
            era: {
              era: '唐代',
              eraDescription: '古代',
              location: '长安',
            },
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
      // 统一提取只需要一次 LLM 调用
      mockGenerateText
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            story: {
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
            },
            visual: {
              artDirection: '写实电影感',
              artStyle: '写实风格',
              colorPalette: [],
              colorMood: '',
              cinematography: '',
              lightingStyle: '',
              references: [],
            },
            era: {
              era: '2024年',
              eraDescription: '现代',
              location: '北京',
            },
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

  describe('配置功能', () => {
    it('应该支持通过构造函数传入配置', () => {
      const config: GlobalContextExtractorConfig = {
        extractEmotionalArc: false,
        textLengthThreshold: 1000,
      };
      const extractorWithConfig = new GlobalContextExtractor(mockModelConfig, config);
      
      expect(extractorWithConfig.getConfig().extractEmotionalArc).toBe(false);
      expect(extractorWithConfig.getConfig().textLengthThreshold).toBe(1000);
    });

    it('应该使用默认配置当未提供配置时', () => {
      const defaultExtractor = new GlobalContextExtractor(mockModelConfig);
      
      expect(defaultExtractor.getConfig().extractEmotionalArc).toBe(true);
      expect(defaultExtractor.getConfig().textLengthThreshold).toBe(800);
    });

    it('应该支持通过updateConfig更新配置', () => {
      extractor.updateConfig({ extractEmotionalArc: false });
      
      expect(extractor.getConfig().extractEmotionalArc).toBe(false);
      // 其他配置应保持不变
      expect(extractor.getConfig().textLengthThreshold).toBe(800);
    });

    it('当文本长度低于阈值时应该跳过情绪曲线提取', async () => {
      // 设置阈值为1000，但内容长度小于1000
      const extractorWithHighThreshold = new GlobalContextExtractor(mockModelConfig, {
        extractEmotionalArc: true,
        textLengthThreshold: 1000,
      });

      // Mock统一提取响应
      mockGenerateText.mockResolvedValueOnce({
        success: true,
        data: JSON.stringify({
          story: {
            synopsis: '短文本测试',
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
          },
          visual: {
            artDirection: '写实',
            artStyle: '写实',
            colorPalette: [],
            colorMood: '',
            cinematography: '',
            lightingStyle: '',
            references: [],
          },
          era: {
            era: '现代',
            eraDescription: '现代背景',
            location: '北京',
          },
        }),
      });

      const shortContent = '这是一个短文本'; // 长度小于1000
      const result = await extractorWithHighThreshold.extract(shortContent);

      // 应该只调用一次（统一提取），不会调用情绪曲线提取
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(result.emotional.arc).toEqual([]);
      expect(result.emotional.overallMood).toBe('');
    });

    it('当extractEmotionalArc为false时应该跳过情绪曲线提取', async () => {
      const extractorDisabled = new GlobalContextExtractor(mockModelConfig, {
        extractEmotionalArc: false,
        textLengthThreshold: 800,
      });

      // Mock统一提取响应
      mockGenerateText.mockResolvedValueOnce({
        success: true,
        data: JSON.stringify({
          story: {
            synopsis: '测试故事',
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
          },
          visual: {
            artDirection: '写实',
            artStyle: '写实',
            colorPalette: [],
            colorMood: '',
            cinematography: '',
            lightingStyle: '',
            references: [],
          },
          era: {
            era: '现代',
            eraDescription: '现代背景',
            location: '北京',
          },
        }),
      });

      const content = '这是一个很长的文本内容'.repeat(50); // 长度超过800
      const result = await extractorDisabled.extract(content);

      // 应该只调用一次（统一提取），不会调用情绪曲线提取
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(result.emotional.arc).toEqual([]);
    });

    it('当文本长度超过阈值且extractEmotionalArc为true时应该提取情绪曲线', async () => {
      const extractorEnabled = new GlobalContextExtractor(mockModelConfig, {
        extractEmotionalArc: true,
        textLengthThreshold: 100, // 设置较低的阈值以便测试
      });

      // Mock统一提取响应
      mockGenerateText.mockResolvedValueOnce({
        success: true,
        data: JSON.stringify({
          story: {
            synopsis: '测试故事',
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
          },
          visual: {
            artDirection: '写实',
            artStyle: '写实',
            colorPalette: [],
            colorMood: '',
            cinematography: '',
            lightingStyle: '',
            references: [],
          },
          era: {
            era: '现代',
            eraDescription: '现代背景',
            location: '北京',
          },
        }),
      });

      // Mock情绪曲线提取响应
      mockGenerateText.mockResolvedValueOnce({
        success: true,
        data: JSON.stringify({
          overallMood: '励志向上',
          arc: [
            { plotPoint: '开场', emotion: '平静', intensity: 3, colorTone: '明亮', percentage: 0 },
            { plotPoint: '高潮', emotion: '喜悦', intensity: 8, colorTone: '暖色', percentage: 80 },
          ],
        }),
      });

      const content = '这是一个很长的文本内容，需要超过100字符的阈值才能触发情绪曲线提取。'.repeat(3); // 长度超过100
      const result = await extractorEnabled.extract(content);

      // 应该调用两次（统一提取 + 情绪曲线提取）
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      expect(result.emotional.arc.length).toBeGreaterThan(0);
      expect(result.emotional.overallMood).toBe('励志向上');
    });
  });
});
