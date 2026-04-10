import { describe, it, expect } from 'vitest';
import { PromptGeneratorService } from '../../services/parsing/PromptGeneratorService';

describe('PromptGeneratorService', () => {
  describe('基本功能', () => {
    it('应该能创建 PromptGeneratorService 实例', () => {
      const service = new PromptGeneratorService();
      expect(service).toBeDefined();
      expect(typeof service.generateCharacterPrompt).toBe('function');
      expect(typeof service.generateScenePrompt).toBe('function');
      expect(typeof service.generateShotPrompt).toBe('function');
    });

    it('应该能使用自定义配置', () => {
      const service = new PromptGeneratorService({
        includeQualityTags: false,
      });
      expect(service).toBeDefined();
    });
  });

  describe('角色提示词生成', () => {
    it('应该能生成角色提示词', () => {
      const service = new PromptGeneratorService();
      const character: any = {
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
      
      const prompt = service.generateCharacterPrompt(character);
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('应该能包含风格', () => {
      const service = new PromptGeneratorService();
      const character: any = {
        name: '测试角色',
        appearance: {},
        personality: [],
        signatureItems: [],
        emotionalArc: [],
        relationships: [],
        visualPrompt: '',
      };
      
      const prompt = service.generateCharacterPrompt(character, 'movie');
      expect(prompt).toBeTruthy();
    });

    it('应该能包含质量标签', () => {
      const service = new PromptGeneratorService({ includeQualityTags: true });
      const character: any = {
        name: '测试角色',
        appearance: {},
        personality: [],
        signatureItems: [],
        emotionalArc: [],
        relationships: [],
        visualPrompt: '',
      };
      
      const prompt = service.generateCharacterPrompt(character);
      expect(prompt).toContain('8k');
      expect(prompt).toContain('masterpiece');
    });

    it('应该能不包含质量标签', () => {
      const service = new PromptGeneratorService({ includeQualityTags: false });
      const character: any = {
        name: '测试角色',
        appearance: {},
        personality: [],
        signatureItems: [],
        emotionalArc: [],
        relationships: [],
        visualPrompt: '',
      };
      
      const prompt = service.generateCharacterPrompt(character);
      expect(prompt).not.toContain('8k');
    });
  });

  describe('场景提示词生成', () => {
    it('应该能生成场景提示词', () => {
      const service = new PromptGeneratorService();
      const scene: any = {
        name: '测试场景',
        location: '森林',
        locationType: 'outdoor',
        timeOfDay: '白天',
        appearance: {},
        environment: {},
        visualPrompt: '',
      };
      
      const prompt = service.generateScenePrompt(scene);
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe('分镜提示词生成', () => {
    it('应该能生成分镜提示词', () => {
      const service = new PromptGeneratorService();
      const shot: any = {
        id: 'shot-1',
        description: '一个人走在森林里',
        shotType: 'medium',
        cameraMovement: 'static',
        cameraAngle: 'eye_level',
      };
      
      const prompt = service.generateShotPrompt(shot);
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('应该能包含景别', () => {
      const service = new PromptGeneratorService();
      const shot: any = {
        id: 'shot-1',
        description: '测试分镜',
        shotType: 'extreme_close_up',
      };
      
      const prompt = service.generateShotPrompt(shot);
      expect(prompt).toContain('特写');
    });

    it('应该能包含运镜', () => {
      const service = new PromptGeneratorService();
      const shot: any = {
        id: 'shot-1',
        description: '测试分镜',
        cameraMovement: 'push',
      };
      
      const prompt = service.generateShotPrompt(shot);
      expect(prompt).toContain('推镜头');
    });

    it('应该能包含机位角度', () => {
      const service = new PromptGeneratorService();
      const shot: any = {
        id: 'shot-1',
        description: '测试分镜',
        cameraAngle: 'high_angle',
      };
      
      const prompt = service.generateShotPrompt(shot);
      expect(prompt).toContain('俯拍');
    });
  });

  describe('辅助功能', () => {
    it('应该能获取可用风格列表', () => {
      const service = new PromptGeneratorService();
      const styles = service.getAvailableStyles();
      expect(Array.isArray(styles)).toBe(true);
      expect(styles.length).toBeGreaterThan(0);
      expect(styles[0]).toHaveProperty('id');
      expect(styles[0]).toHaveProperty('name');
    });

    it('应该能获取负面提示词', () => {
      const service = new PromptGeneratorService({ includeNegativePrompt: true });
      const negativePrompt = service.getNegativePrompt();
      expect(negativePrompt).toBeTruthy();
    });

    it('应该能返回空的负面提示词', () => {
      const service = new PromptGeneratorService({ includeNegativePrompt: false });
      const negativePrompt = service.getNegativePrompt();
      expect(negativePrompt).toBe('');
    });
  });
});
