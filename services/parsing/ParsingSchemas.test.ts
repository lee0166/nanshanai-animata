/**
 * ParsingSchemas 测试
 * 验证所有Schema定义的正确性和类型安全
 */

import { describe, it, expect } from 'vitest';
import {
  ScriptMetadataSchema,
  ScriptCharacterSchema,
  ScriptSceneSchema,
  ScriptItemSchema,
  ShotSchema,
  ScriptCharacterArraySchema,
  ScriptSceneArraySchema,
  getJsonSchemaDescription,
  getArraySchemaDescription,
} from './ParsingSchemas';

describe('ParsingSchemas', () => {
  describe('ScriptMetadataSchema', () => {
    it('should validate valid metadata', () => {
      const result = ScriptMetadataSchema.safeParse({
        title: '测试小说',
        wordCount: 10000,
        estimatedDuration: '10分钟',
        characterCount: 5,
        characterNames: ['张三', '李四'],
        sceneCount: 8,
        sceneNames: ['客厅', '书房'],
        chapterCount: 3,
        genre: '都市',
        tone: '正剧',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid metadata (missing required fields)', () => {
      const result = ScriptMetadataSchema.safeParse({
        title: '测试小说',
        // missing other required fields
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid wordCount (negative number)', () => {
      const result = ScriptMetadataSchema.safeParse({
        title: '测试小说',
        wordCount: -100,
        estimatedDuration: '10分钟',
        characterCount: 5,
        characterNames: ['张三'],
        sceneCount: 8,
        sceneNames: ['客厅'],
        chapterCount: 3,
        genre: '都市',
        tone: '正剧',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ScriptCharacterSchema', () => {
    it('should validate valid character', () => {
      const result = ScriptCharacterSchema.safeParse({
        name: '张三',
        gender: 'male',
        age: '25',
        identity: '程序员',
        appearance: {
          height: '175cm',
          build: '标准体型',
          face: '国字脸',
          hair: '黑色短发',
          clothing: '白色T恤配牛仔裤',
        },
        personality: ['开朗', '细心'],
        signatureItems: ['笔记本电脑', '眼镜'],
        emotionalArc: [{ phase: '初始', emotion: '平静' }],
        relationships: [{ character: '李四', relation: '同事' }],
        visualPrompt: '年轻男性程序员形象',
      });
      expect(result.success).toBe(true);
    });

    it('should fill default values for missing fields', () => {
      const result = ScriptCharacterSchema.safeParse({
        name: '张三',
        appearance: {},
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gender).toBe('unknown');
        expect(result.data.age).toBe('25');
        expect(result.data.identity).toBe('未知身份');
        expect(result.data.appearance.height).toBe('中等身高');
        expect(result.data.personality).toEqual(['性格温和']);
      }
    });

    it('should validate gender enum', () => {
      const validGenders = ['male', 'female', 'unknown'];
      for (const gender of validGenders) {
        const result = ScriptCharacterSchema.safeParse({
          name: '测试',
          gender,
          appearance: {},
        });
        expect(result.success).toBe(true);
      }

      const invalidResult = ScriptCharacterSchema.safeParse({
        name: '测试',
        gender: 'invalid',
        appearance: {},
      });
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('ScriptSceneSchema', () => {
    it('should validate valid scene', () => {
      const result = ScriptSceneSchema.safeParse({
        name: '总裁办公室',
        locationType: 'indoor',
        description: '宽敞明亮的现代化办公室',
        timeOfDay: '上午',
        season: '春季',
        weather: '晴朗',
        environment: {
          architecture: '现代简约风格',
          furnishings: ['真皮沙发', '实木办公桌', '落地窗'],
          lighting: '自然光充足',
          colorTone: '冷色调',
        },
        sceneFunction: '展示主角工作环境',
        visualPrompt: '现代化总裁办公室',
        characters: ['总裁', '秘书'],
      });
      expect(result.success).toBe(true);
    });

    it('should fill default values for missing fields', () => {
      const result = ScriptSceneSchema.safeParse({
        name: '测试场景',
        description: '场景描述',
        environment: {},
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.locationType).toBe('unknown');
        expect(result.data.timeOfDay).toBe('白天');
        expect(result.data.season).toBe('春季');
        expect(result.data.weather).toBe('晴朗');
      }
    });
  });

  describe('ScriptItemSchema', () => {
    it('should validate valid item', () => {
      const result = ScriptItemSchema.safeParse({
        name: '玉佩',
        description: '祖传玉佩，温润通透',
        category: 'jewelry',
        owner: '主角',
        importance: 'major',
        visualPrompt: '翡翠玉佩特写',
      });
      expect(result.success).toBe(true);
    });

    it('should validate category enum', () => {
      const validCategories = ['weapon', 'tool', 'jewelry', 'document', 'creature', 'animal', 'other'];
      for (const category of validCategories) {
        const result = ScriptItemSchema.safeParse({
          name: '测试物品',
          category,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('ShotSchema', () => {
    it('should validate valid shot', () => {
      const result = ShotSchema.safeParse({
        id: 'shot-001',
        sceneName: '总裁办公室',
        sequence: 1,
        shotType: 'medium',
        cameraMovement: 'static',
        description: '主角坐在办公桌前',
        dialogue: '这个项目必须在下周完成',
        sound: '键盘敲击声',
        duration: 5,
        characters: ['主角'],
      });
      expect(result.success).toBe(true);
    });

    it('should validate shotType enum', () => {
      const validShotTypes = ['extreme_long', 'long', 'full', 'medium', 'close_up', 'extreme_close_up'];
      for (const shotType of validShotTypes) {
        const result = ShotSchema.safeParse({
          sceneName: '测试场景',
          sequence: 1,
          description: '测试描述',
          shotType,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should validate cameraMovement enum', () => {
      const validMovements = ['static', 'push', 'pull', 'pan', 'tilt', 'track', 'crane'];
      for (const cameraMovement of validMovements) {
        const result = ShotSchema.safeParse({
          sceneName: '测试场景',
          sequence: 1,
          description: '测试描述',
          cameraMovement,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Array Schemas', () => {
    it('should validate array of characters', () => {
      const result = ScriptCharacterArraySchema.safeParse([
        {
          name: '张三',
          gender: 'male',
          appearance: {},
        },
        {
          name: '李四',
          gender: 'female',
          appearance: {},
        },
      ]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it('should validate array of scenes', () => {
      const result = ScriptSceneArraySchema.safeParse([
        {
          name: '场景1',
          description: '描述1',
          environment: {},
        },
        {
          name: '场景2',
          description: '描述2',
          environment: {},
        },
      ]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });
  });

  describe('Utility Functions', () => {
    it('should generate schema description', () => {
      const description = getJsonSchemaDescription(ScriptMetadataSchema);
      expect(description).toContain('title');
      expect(description).toContain('wordCount');
      expect(description).toContain('characterNames');
    });

    it('should generate array schema description', () => {
      const description = getArraySchemaDescription(ScriptCharacterSchema, '角色');
      expect(description).toContain('角色');
      expect(description).toContain('name');
    });
  });
});
