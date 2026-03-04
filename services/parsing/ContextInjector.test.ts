/**
 * ContextInjector 单元测试
 * 
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ContextInjector,
  createContextInjector,
  InjectionOptions,
} from './ContextInjector';
import type { GlobalContext } from './GlobalContextExtractor';
import type { ScriptScene } from '../../types';

describe('ContextInjector', () => {
  let injector: ContextInjector;
  let mockContext: GlobalContext;

  beforeEach(() => {
    injector = new ContextInjector();
    
    // 创建模拟的全局上下文
    mockContext = {
      story: {
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
      },
      visual: {
        artDirection: '写实电影感',
        artStyle: '写实',
        colorPalette: ['#000000', '#FFFFFF', '#FF0000'],
        colorMood: '冷峻',
        cinematography: '电影感构图',
        lightingStyle: '自然光',
        references: ['参考影片', '导演测试'],
      },
      era: {
        era: '2024年',
        eraDescription: '现代都市',
        location: '北京',
        season: '春季',
        timeOfDay: '白天',
      },
      emotional: {
        overallMood: '励志向上',
        arc: [
          {
            plotPoint: '开场',
            emotion: '平静',
            intensity: 3,
            colorTone: '明亮',
            percentage: 0,
          },
          {
            plotPoint: '高潮',
            emotion: '紧张',
            intensity: 8,
            colorTone: '阴暗',
            percentage: 75,
          },
        ],
      },
      rules: {
        characterTraits: {
          '主角': ['勇敢', '善良'],
        },
        eraConstraints: ['禁止出现古代元素'],
        styleConstraints: ['保持写实风格'],
        forbiddenElements: ['手机', '电脑'],
      },
    };
  });

  describe('基本功能', () => {
    it('应该正确创建实例', () => {
      expect(injector).toBeDefined();
      expect(injector).toBeInstanceOf(ContextInjector);
    });

    it('createContextInjector工厂函数应该正确工作', () => {
      const instance = createContextInjector();
      expect(instance).toBeInstanceOf(ContextInjector);
    });

    it('应该接受自定义选项', () => {
      const customInjector = new ContextInjector({
        includeStoryContext: false,
        maxPromptLength: 5000,
      });
      expect(customInjector).toBeInstanceOf(ContextInjector);
    });
  });

  describe('injectForCharacter', () => {
    it('应该为角色注入上下文', () => {
      const basePrompt = '请分析角色"主角"的特征';
      const result = injector.injectForCharacter(basePrompt, mockContext, '主角');

      expect(result).toContain('【故事背景】');
      expect(result).toContain('一句话简介');
      expect(result).toContain('【视觉风格】');
      expect(result).toContain('写实');
      expect(result).toContain('【时代背景】');
      expect(result).toContain('2024年');
      expect(result).toContain(basePrompt);
      expect(result).toContain('主角');
    });

    it('应该包含角色一致性规则', () => {
      const basePrompt = '请分析角色"主角"的特征';
      const result = injector.injectForCharacter(basePrompt, mockContext, '主角');

      expect(result).toContain('【一致性规则】');
      expect(result).toContain('勇敢');
      expect(result).toContain('善良');
    });

    it('当角色没有特征时不应显示一致性规则', () => {
      const basePrompt = '请分析角色"配角"的特征';
      const result = injector.injectForCharacter(basePrompt, mockContext, '配角');

      // 配角没有在characterTraits中定义，不应显示角色特征
      expect(result).not.toContain('必须保持的特征');
    });

    it('当禁用故事上下文时不应包含故事背景', () => {
      const customInjector = new ContextInjector({ includeStoryContext: false });
      const basePrompt = '请分析角色';
      const result = customInjector.injectForCharacter(basePrompt, mockContext, '主角');

      expect(result).not.toContain('【故事背景】');
      expect(result).toContain('【视觉风格】');
    });
  });

  describe('injectForScene', () => {
    it('应该为场景注入上下文', () => {
      const basePrompt = '请分析场景"办公室"的特征';
      const result = injector.injectForScene(basePrompt, mockContext, '办公室');

      expect(result).toContain('【故事背景】');
      expect(result).toContain('【视觉风格】');
      expect(result).toContain('【时代背景】');
      expect(result).toContain(basePrompt);
      expect(result).toContain('办公室');
    });

    it('应该包含情绪指导', () => {
      const basePrompt = '请分析场景"高潮"的特征';
      const result = injector.injectForScene(basePrompt, mockContext, '高潮场景');

      // 场景名称包含"高潮"，应该匹配到情绪点
      expect(result).toContain('【情绪指导】');
    });

    it('当禁用情绪上下文时不应包含情绪指导', () => {
      const customInjector = new ContextInjector({ includeEmotionalContext: false });
      const basePrompt = '请分析场景';
      const result = customInjector.injectForScene(basePrompt, mockContext, '办公室');

      expect(result).not.toContain('【情绪指导】');
    });
  });

  describe('injectForShots', () => {
    it('应该为分镜注入视觉指导', () => {
      const mockScene: ScriptScene = {
        id: '1',
        name: '办公室',
        description: '现代办公室',
        visualPrompt: '现代办公室场景',
        sceneFunction: '开场',
        characters: ['主角'],
        items: [],
        shots: [],
      };

      const basePrompt = '请为场景生成分镜';
      const result = injector.injectForShots(basePrompt, mockContext, mockScene);

      expect(result).toContain('【视觉指导】');
      expect(result).toContain('摄影风格');
      expect(result).toContain('光影风格');
      expect(result).toContain(basePrompt);
    });

    it('应该包含时代限制', () => {
      const mockScene: ScriptScene = {
        id: '1',
        name: '办公室',
        description: '现代办公室',
        visualPrompt: '现代办公室场景',
        sceneFunction: '开场',
        characters: ['主角'],
        items: [],
        shots: [],
      };

      const basePrompt = '请为场景生成分镜';
      const result = injector.injectForShots(basePrompt, mockContext, mockScene);

      expect(result).toContain('【时代限制】');
      expect(result).toContain('禁止出现');
    });
  });

  describe('injectForItems', () => {
    it('应该为道具注入时代背景', () => {
      const basePrompt = '请分析道具"手机"的特征';
      const result = injector.injectForItems(basePrompt, mockContext);

      expect(result).toContain('【时代背景】');
      expect(result).toContain('2024年');
      expect(result).toContain(basePrompt);
    });

    it('应该包含时代限制', () => {
      const basePrompt = '请分析道具';
      const result = injector.injectForItems(basePrompt, mockContext);

      expect(result).toContain('【时代限制】');
    });
  });

  describe('Prompt长度限制', () => {
    it('应该截断过长的Prompt', () => {
      const customInjector = new ContextInjector({ maxPromptLength: 100 });
      const basePrompt = '这是一个很长的基础Prompt，' + '重复内容'.repeat(50);
      const result = customInjector.injectForCharacter(basePrompt, mockContext, '主角');

      expect(result.length).toBeLessThanOrEqual(200); // 允许一些余量
      expect(result).toContain('[Prompt已截断...]');
    });

    it('短Prompt不应被截断', () => {
      const basePrompt = '短Prompt';
      const result = injector.injectForCharacter(basePrompt, mockContext, '主角');

      expect(result).not.toContain('[Prompt已截断...]');
    });
  });

  describe('空上下文处理', () => {
    it('应该处理空故事上下文', () => {
      const emptyContext: GlobalContext = {
        story: {
          synopsis: '',
          logline: '',
          coreConflict: '',
          themes: [],
          structure: {
            structureType: 'other',
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
          era: '',
          eraDescription: '',
          location: '',
        },
        emotional: {
          overallMood: '',
          arc: [],
        },
        rules: {
          characterTraits: {},
          eraConstraints: [],
          styleConstraints: [],
          forbiddenElements: [],
        },
      };

      const basePrompt = '请分析角色';
      const result = injector.injectForCharacter(basePrompt, emptyContext, '主角');

      // 应该返回基础Prompt，不包含上下文区块
      expect(result).toContain(basePrompt);
      expect(result).not.toContain('【故事背景】');
      expect(result).not.toContain('【视觉风格】');
    });
  });

  describe('配置选项', () => {
    it('应该支持部分上下文注入', () => {
      const partialInjector = new ContextInjector({
        includeStoryContext: true,
        includeVisualContext: false,
        includeEraContext: true,
        includeEmotionalContext: false,
        includeConsistencyRules: false,
      });

      const basePrompt = '请分析场景';
      const result = partialInjector.injectForScene(basePrompt, mockContext, '办公室');

      expect(result).toContain('【故事背景】');
      expect(result).not.toContain('【视觉风格】');
      expect(result).toContain('【时代背景】');
      expect(result).not.toContain('【情绪指导】');
    });
  });
});
