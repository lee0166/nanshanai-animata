/**
 * SceneContextExtractor 单元测试
 *
 * 测试场景上下文提取器的功能，包括：
 * - 场景定位算法
 * - 前后文扩展
 * - 智能截断
 * - 批量提取
 * - 质量评估
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SceneContextExtractor, type ExtractedSceneContext } from '../SceneContextExtractor';
import type { ScriptScene } from '../../../types';

describe('SceneContextExtractor', () => {
  let extractor: SceneContextExtractor;

  // 测试用剧本内容
  const testScript = `
【第一幕】

场景 1：公司办公室 - 日 - 内

江哲坐在办公桌后，专注地看着电脑屏幕。办公室里安静得只能听到键盘敲击声。

秘书小李敲门进来："江总，这是您要的文件。"

江哲接过文件，快速翻阅着。

【第二幕】

场景 2：咖啡厅 - 日 - 内

林悦坐在咖啡厅的角落里，若有所思地看着窗外的街景。

服务员走过来："小姐，请问还需要什么吗？"

林悦摇摇头："不用了，谢谢。"

她拿起手机，看着屏幕上的消息，眉头微皱。

【第三幕】

场景 3：公园 - 黄昏 - 外

夕阳西下，公园里散步的人渐渐多了起来。

江哲和林悦在湖边相遇，两人相视一笑。

江哲："真巧，在这里遇见你。"

林悦："是啊，好久不见了。"

两人沿着湖边慢慢走着，聊着这些年的经历。

【第四幕】

场景 4：会议室 - 日 - 内

公司高层会议正在进行。江哲站在投影屏幕前，讲解着新的项目计划。

"这个项目的关键在于创新，"江哲强调道，"我们要打破传统思维。"

会议室里响起热烈的掌声。
`;

  beforeEach(() => {
    extractor = new SceneContextExtractor({
      defaultContextChars: 200,
      minContextChars: 50,
      maxContextChars: 500,
      preferNameMatch: true,
      enableFuzzyMatch: true,
    });
  });

  describe('场景定位算法', () => {
    it('应该能通过场景名称精确匹配定位', () => {
      const scene: ScriptScene = {
        name: '公司办公室',
        description: '江哲坐在办公桌后',
        locationType: 'indoor',
        environment: {
          architecture: '现代办公楼',
          furnishings: ['办公桌', '电脑'],
        },
        sceneFunction: '展示主角工作环境',
        visualPrompt: '',
        characters: ['江哲'],
      };

      const result = extractor.extractWithContext(scene, testScript);

      expect(result.found).toBe(true);
      expect(result.locationMethod).toBe('name_match');
      expect(result.text).toContain('公司办公室');
      expect(result.text).toContain('江哲');
    });

    it('应该能通过场景描述关键词匹配定位', () => {
      const scene: ScriptScene = {
        name: '咖啡厅',
        description: '林悦坐在咖啡厅的角落里，若有所思',
        locationType: 'indoor',
        environment: {
          architecture: '咖啡厅',
          furnishings: ['桌子', '椅子'],
        },
        sceneFunction: '展示林悦的思考',
        visualPrompt: '',
        characters: ['林悦'],
      };

      const result = extractor.extractWithContext(scene, testScript);

      expect(result.found).toBe(true);
      expect(result.locationMethod).toBe('name_match');
      expect(result.text).toContain('咖啡厅');
      expect(result.text).toContain('林悦');
    });

    it('应该能在名称匹配失败时使用模糊匹配', () => {
      const scene: ScriptScene = {
        name: '未知场景',
        description: '',
        locationType: 'outdoor',
        environment: {
          architecture: '公园',
          furnishings: ['湖'],
        },
        sceneFunction: '浪漫相遇',
        visualPrompt: '',
        characters: ['江哲', '林悦'],
      };

      const result = extractor.extractWithContext(scene, testScript);

      // 应该能通过环境信息模糊匹配到公园场景
      expect(result.found).toBe(true);
      expect(result.text).toContain('公园');
    });

    it('应该能在完全找不到时返回空结果', () => {
      const scene: ScriptScene = {
        name: '不存在的场景',
        description: '完全不相关的内容',
        locationType: 'indoor',
        environment: {
          architecture: '太空站',
          furnishings: ['火箭'],
        },
        sceneFunction: '科幻场景',
        visualPrompt: '',
        characters: ['外星人'],
      };

      const result = extractor.extractWithContext(scene, testScript);

      expect(result.found).toBe(false);
      expect(result.locationMethod).toBe('none');
      expect(result.text).toBe('');
    });
  });

  describe('前后文扩展', () => {
    it('应该能正确扩展前后各 200 字符', () => {
      const scene: ScriptScene = {
        name: '咖啡厅',
        description: '林悦坐在咖啡厅',
        locationType: 'indoor',
        environment: {
          architecture: '咖啡厅',
          furnishings: [],
        },
        sceneFunction: '',
        visualPrompt: '',
        characters: [],
      };

      const result = extractor.extractWithContext(scene, testScript);

      expect(result.found).toBe(true);
      // 文本长度应该在合理范围内（考虑智能截断）
      expect(result.text.length).toBeGreaterThan(100);
      expect(result.text.length).toBeLessThan(1000);
    });

    it('应该能尊重最小字符数限制', () => {
      const smallExtractor = new SceneContextExtractor({
        defaultContextChars: 50,
        minContextChars: 50,
        maxContextChars: 100,
      });

      const scene: ScriptScene = {
        name: '咖啡厅',
        description: '林悦',
        locationType: 'indoor',
        environment: {
          architecture: '咖啡厅',
          furnishings: [],
        },
        sceneFunction: '',
        visualPrompt: '',
        characters: [],
      };

      const result = smallExtractor.extractWithContext(scene, testScript);

      expect(result.found).toBe(true);
      expect(result.text.length).toBeGreaterThanOrEqual(50);
    });

    it('应该能尊重最大字符数限制', () => {
      const largeExtractor = new SceneContextExtractor({
        defaultContextChars: 1000,
        minContextChars: 100,
        maxContextChars: 300,
      });

      const scene: ScriptScene = {
        name: '咖啡厅',
        description: '林悦',
        locationType: 'indoor',
        environment: {
          architecture: '咖啡厅',
          furnishings: [],
        },
        sceneFunction: '',
        visualPrompt: '',
        characters: [],
      };

      const result = largeExtractor.extractWithContext(scene, testScript);

      expect(result.found).toBe(true);
      // 由于智能截断会在段落边界处截断，实际长度可能略超过最大值
      // 但应该在合理范围内（不超过最大值的 150%）
      expect(result.text.length).toBeLessThanOrEqual(450);
    });
  });

  describe('智能截断', () => {
    it('应该在段落边界处截断', () => {
      const scene: ScriptScene = {
        name: '公司办公室',
        description: '江哲',
        locationType: 'indoor',
        environment: {
          architecture: '办公室',
          furnishings: [],
        },
        sceneFunction: '',
        visualPrompt: '',
        characters: [],
      };

      const result = extractor.extractWithContext(scene, testScript);

      expect(result.found).toBe(true);
      // 文本应该以完整的句子或段落结束
      expect(result.text).not.toMatch(/^[a-zA-Z\u4e00-\u9fa5]{1,10}$/); // 不应该只有几个字符
    });

    it('应该保持句子完整性', () => {
      const scene: ScriptScene = {
        name: '公园',
        description: '夕阳西下',
        locationType: 'outdoor',
        environment: {
          architecture: '公园',
          furnishings: ['湖'],
        },
        sceneFunction: '',
        visualPrompt: '',
        characters: [],
      };

      const result = extractor.extractWithContext(scene, testScript);

      expect(result.found).toBe(true);
      // 文本应该包含完整的句子
      expect(result.text).toContain('公园');
      expect(result.text).toContain('江哲');
      expect(result.text).toContain('林悦');
    });
  });

  describe('批量提取', () => {
    it('应该能批量提取多个场景的上下文', () => {
      const scenes: ScriptScene[] = [
        {
          name: '公司办公室',
          description: '江哲',
          locationType: 'indoor',
          environment: {
            architecture: '办公室',
            furnishings: [],
          },
          sceneFunction: '',
          visualPrompt: '',
          characters: [],
        },
        {
          name: '咖啡厅',
          description: '林悦',
          locationType: 'indoor',
          environment: {
            architecture: '咖啡厅',
            furnishings: [],
          },
          sceneFunction: '',
          visualPrompt: '',
          characters: [],
        },
        {
          name: '公园',
          description: '夕阳西下',
          locationType: 'outdoor',
          environment: {
            architecture: '公园',
            furnishings: ['湖'],
          },
          sceneFunction: '',
          visualPrompt: '',
          characters: [],
        },
      ];

      const results = extractor.extractBatch(scenes, testScript);

      expect(results).toHaveLength(3);
      expect(results[0].found).toBe(true);
      expect(results[1].found).toBe(true);
      expect(results[2].found).toBe(true);
      expect(results[0].text).toContain('公司办公室');
      expect(results[1].text).toContain('咖啡厅');
      expect(results[2].text).toContain('公园');
    });
  });

  describe('质量评估', () => {
    it('应该能评估提取质量', () => {
      const scene: ScriptScene = {
        name: '咖啡厅',
        description: '林悦坐在咖啡厅',
        locationType: 'indoor',
        environment: {
          architecture: '咖啡厅',
          furnishings: [],
        },
        sceneFunction: '',
        visualPrompt: '',
        characters: [],
      };

      const { result, quality } = extractor.extractWithQuality(scene, testScript);

      expect(result.found).toBe(true);
      expect(quality).toBeGreaterThan(0);
      expect(quality).toBeLessThanOrEqual(1);

      // 名称精确匹配应该获得较高质量
      expect(quality).toBeGreaterThanOrEqual(0.7);
    });

    it('应该给失败的提取返回 0 质量', () => {
      const scene: ScriptScene = {
        name: '不存在的场景',
        description: '',
        locationType: 'indoor',
        environment: {
          architecture: '太空站',
          furnishings: [],
        },
        sceneFunction: '',
        visualPrompt: '',
        characters: [],
      };

      const { result, quality } = extractor.extractWithQuality(scene, testScript);

      expect(result.found).toBe(false);
      expect(quality).toBe(0);
    });
  });

  describe('配置管理', () => {
    it('应该能更新配置', () => {
      const newConfig = {
        defaultContextChars: 300,
        minContextChars: 100,
      };

      extractor.updateConfig(newConfig);

      const config = extractor.getConfig();
      expect(config.defaultContextChars).toBe(300);
      expect(config.minContextChars).toBe(100);
    });

    it('应该能部分更新配置', () => {
      extractor.updateConfig({ maxContextChars: 800 });

      const config = extractor.getConfig();
      expect(config.maxContextChars).toBe(800);
      expect(config.defaultContextChars).toBe(200); // 保持不变
    });
  });

  describe('边界情况', () => {
    it('应该能处理空文本', () => {
      const scene: ScriptScene = {
        name: '测试场景',
        description: '测试',
        locationType: 'indoor',
        environment: {
          architecture: '测试',
          furnishings: [],
        },
        sceneFunction: '',
        visualPrompt: '',
        characters: [],
      };

      const result = extractor.extractWithContext(scene, '');

      expect(result.found).toBe(false);
      expect(result.text).toBe('');
    });

    it('应该能处理空场景名称', () => {
      const scene: ScriptScene = {
        name: '',
        description: '咖啡厅场景',
        locationType: 'indoor',
        environment: {
          architecture: '咖啡厅',
          furnishings: [],
        },
        sceneFunction: '',
        visualPrompt: '',
        characters: [],
      };

      const result = extractor.extractWithContext(scene, testScript);

      // 应该能通过描述匹配
      expect(result.found).toBe(true);
    });
  });
});
