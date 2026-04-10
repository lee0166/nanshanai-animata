import { describe, it, expect } from 'vitest';
import { CharacterPromptBuilder } from '../../services/promptBuilder';

describe('promptBuilder.ts - CharacterPromptBuilder', () => {
  describe('基本功能', () => {
    it('应该能创建 CharacterPromptBuilder 实例', () => {
      expect(CharacterPromptBuilder).toBeDefined();
      expect(typeof CharacterPromptBuilder.build).toBe('function');
    });
  });

  describe('build方法 - appearance字段优先', () => {
    it('应该使用 appearance.face', () => {
      const character: any = {
        id: 'test-1',
        name: '测试角色',
        appearance: {
          face: '英俊的脸庞',
          hair: '黑色短发',
          clothing: '黑色西装',
          build: '健壮',
          height: '180cm',
        },
        personality: [],
        signatureItems: [],
        emotionalArc: [],
        relationships: [],
        visualPrompt: '',
      };
      const prompt = CharacterPromptBuilder.build(character);
      expect(prompt).toContain('英俊的脸庞');
      expect(prompt).toContain('黑色短发');
    });

    it('应该使用 appearance.hair', () => {
      const character: any = {
        id: 'test-1',
        name: '测试角色',
        appearance: {
          hair: '金色长发',
        },
        personality: [],
        signatureItems: [],
        emotionalArc: [],
        relationships: [],
        visualPrompt: '',
      };
      const prompt = CharacterPromptBuilder.build(character);
      expect(prompt).toContain('金色长发');
    });

    it('应该使用 appearance.clothing', () => {
      const character: any = {
        id: 'test-1',
        name: '测试角色',
        appearance: {
          clothing: '蓝色连衣裙',
        },
        personality: [],
        signatureItems: [],
        emotionalArc: [],
        relationships: [],
        visualPrompt: '',
      };
      const prompt = CharacterPromptBuilder.build(character);
      expect(prompt).toContain('蓝色连衣裙');
    });

    it('应该使用 appearance.build', () => {
      const character: any = {
        id: 'test-1',
        name: '测试角色',
        appearance: {
          build: '苗条',
        },
        personality: [],
        signatureItems: [],
        emotionalArc: [],
        relationships: [],
        visualPrompt: '',
      };
      const prompt = CharacterPromptBuilder.build(character);
      expect(prompt).toContain('苗条');
    });

    it('应该使用 appearance.height', () => {
      const character: any = {
        id: 'test-1',
        name: '测试角色',
        appearance: {
          height: '165cm',
        },
        personality: [],
        signatureItems: [],
        emotionalArc: [],
        relationships: [],
        visualPrompt: '',
      };
      const prompt = CharacterPromptBuilder.build(character);
      expect(prompt).toContain('165cm');
    });
  });

  describe('build方法 - fallback逻辑', () => {
    it('appearance为空时，应该使用 visualPrompt（包含自动脚部描述）', () => {
      const character: any = {
        id: 'test-1',
        name: '测试角色',
        appearance: {},
        visualPrompt: '美丽的女性角色',
        personality: [],
        signatureItems: [],
        emotionalArc: [],
        relationships: [],
      };
      const prompt = CharacterPromptBuilder.build(character);
      expect(prompt).toContain('美丽的女性角色');
      expect(prompt).toMatch(/鞋|靴|履|足|脚/);
    });

    it('appearance和visualPrompt都为空时，应该使用 description（包含自动脚部描述）', () => {
      const character: any = {
        id: 'test-1',
        name: '测试角色',
        appearance: {},
        description: '一个神秘的人物',
        visualPrompt: '',
        personality: [],
        signatureItems: [],
        emotionalArc: [],
        relationships: [],
      };
      const prompt = CharacterPromptBuilder.build(character);
      expect(prompt).toContain('一个神秘的人物');
      expect(prompt).toMatch(/鞋|靴|履|足|脚/);
    });

    it('所有描述都为空时，只返回脚部描述', () => {
      const character: any = {
        id: 'test-1',
        name: '测试角色',
        appearance: {},
        visualPrompt: '',
        personality: [],
        signatureItems: [],
        emotionalArc: [],
        relationships: [],
      };
      const prompt = CharacterPromptBuilder.build(character);
      expect(prompt).toBeTruthy();
      expect(prompt).toMatch(/鞋|靴|履|足|脚/);
    });
  });

  describe('标志性物品过滤', () => {
    it('应该保留标志性物品', () => {
      const character: any = {
        id: 'test-1',
        name: '测试角色',
        appearance: {},
        signatureItems: ['祖传宝剑', '玉佩'],
        visualPrompt: '',
        personality: [],
        emotionalArc: [],
        relationships: [],
      };
      const prompt = CharacterPromptBuilder.build(character);
      expect(prompt).toContain('祖传宝剑');
      expect(prompt).toContain('玉佩');
    });

    it('应该过滤临时物品', () => {
      const character: any = {
        id: 'test-1',
        name: '测试角色',
        appearance: {},
        signatureItems: ['文件', '咖啡杯'],
        visualPrompt: '',
        personality: [],
        emotionalArc: [],
        relationships: [],
      };
      const prompt = CharacterPromptBuilder.build(character);
      expect(prompt).not.toContain('文件');
      expect(prompt).not.toContain('咖啡杯');
    });

    it('包含标志性关键词的物品应该保留', () => {
      const character: any = {
        id: 'test-1',
        name: '测试角色',
        appearance: {},
        signatureItems: ['祖传文件', '家传宝剑'],
        visualPrompt: '',
        personality: [],
        emotionalArc: [],
        relationships: [],
      };
      const prompt = CharacterPromptBuilder.build(character);
      expect(prompt).toContain('祖传文件');
      expect(prompt).toContain('家传宝剑');
    });
  });

  describe('智能脚部描述补充', () => {
    it('没有脚部描述时应该自动补充', () => {
      const character: any = {
        id: 'test-1',
        name: '测试角色',
        appearance: {
          clothing: '古装',
        },
        visualPrompt: '',
        personality: [],
        signatureItems: [],
        emotionalArc: [],
        relationships: [],
      };
      const prompt = CharacterPromptBuilder.build(character);
      expect(prompt).toMatch(/鞋|靴|履|足|脚/);
    });

    it('已有脚部描述时不应该重复补充', () => {
      const character: any = {
        id: 'test-1',
        name: '测试角色',
        appearance: {
          clothing: '黑色皮鞋',
        },
        visualPrompt: '',
        personality: [],
        signatureItems: [],
        emotionalArc: [],
        relationships: [],
      };
      const prompt = CharacterPromptBuilder.build(character);
      const shoeMatches = (prompt.match(/鞋|靴|履|足|脚/g) || []).length;
      expect(shoeMatches).toBeLessThanOrEqual(2);
    });
  });

  describe('完整场景测试', () => {
    it('应该正确构建完整的角色提示词', () => {
      const character: any = {
        id: 'test-1',
        name: '李逍遥',
        appearance: {
          face: '英俊的脸庞，剑眉星目',
          hair: '黑色长发，束发',
          clothing: '蓝色仙侠长袍',
          build: '挺拔',
          height: '180cm',
        },
        signatureItems: ['祖传宝剑', '玉佩'],
        visualPrompt: '',
        personality: [],
        emotionalArc: [],
        relationships: [],
      };
      const prompt = CharacterPromptBuilder.build(character);
      expect(prompt).toContain('英俊的脸庞');
      expect(prompt).toContain('黑色长发');
      expect(prompt).toContain('蓝色仙侠长袍');
      expect(prompt).toContain('祖传宝剑');
      expect(prompt).toContain('玉佩');
    });
  });
});
