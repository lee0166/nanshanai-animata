import { describe, it, expect } from 'vitest';
import {
  DefaultStylePrompt,
  getDefaultStylePrompt,
  getRoleImagePrompt,
  getItemImagePrompt,
  getSceneImagePrompt,
  extractFaceDescription,
  extractFullBodyDescription,
  getFacePortraitPrompt,
  getFullBodyPrompt,
} from '../../services/prompt';

describe('prompt.ts - 风格提示词', () => {
  describe('DefaultStylePrompt', () => {
    it('应该包含所有7种风格', () => {
      const styles = Object.keys(DefaultStylePrompt);
      expect(styles).toHaveLength(7);
      expect(styles).toContain('movie');
      expect(styles).toContain('photorealistic');
      expect(styles).toContain('gothic');
      expect(styles).toContain('cyberpunk');
      expect(styles).toContain('anime');
      expect(styles).toContain('shinkai');
      expect(styles).toContain('game');
    });

    it('每种风格应该有中英文名称', () => {
      Object.values(DefaultStylePrompt).forEach((style) => {
        expect(style.nameEN).toBeTruthy();
        expect(style.nameCN).toBeTruthy();
      });
    });

    it('每种风格应该有提示词', () => {
      Object.values(DefaultStylePrompt).forEach((style) => {
        expect(style.prompt).toBeTruthy();
        expect(typeof style.prompt).toBe('string');
        expect(style.prompt.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getDefaultStylePrompt', () => {
    it('应该返回正确的风格提示词', () => {
      const moviePrompt = getDefaultStylePrompt('movie');
      expect(moviePrompt).toBe(DefaultStylePrompt.movie.prompt);
    });

    it('空参数应该返回空字符串', () => {
      expect(getDefaultStylePrompt('')).toBe('');
    });

    it('不存在的风格应该返回空字符串', () => {
      expect(getDefaultStylePrompt('nonexistent')).toBe('');
    });
  });
});

describe('prompt.ts - 描述提取函数', () => {
  describe('extractFaceDescription', () => {
    it('应该从 JSON 中提取面部描述', () => {
      const scriptDescription = JSON.stringify({
        face: '大眼睛，高鼻梁',
        hair: '黑色长发',
      });
      const result = extractFaceDescription(scriptDescription);
      expect(result).toContain('大眼睛');
      expect(result).toContain('黑色长发');
    });

    it('undefined 应该返回空字符串', () => {
      expect(extractFaceDescription(undefined)).toBe('');
    });

    it('无效的 JSON 应该返回空字符串', () => {
      expect(extractFaceDescription('invalid json')).toBe('');
    });

    it('空的 appearance 应该返回空字符串', () => {
      expect(extractFaceDescription('{}')).toBe('');
    });
  });

  describe('extractFullBodyDescription', () => {
    it('应该从 JSON 中提取全身描述', () => {
      const scriptDescription = JSON.stringify({
        height: '180cm',
        build: '健壮',
        face: '英俊',
        hair: '短发',
        clothing: '西装',
      });
      const result = extractFullBodyDescription(scriptDescription);
      expect(result).toContain('180cm');
      expect(result).toContain('健壮');
      expect(result).toContain('西装');
    });

    it('undefined 应该返回空字符串', () => {
      expect(extractFullBodyDescription(undefined)).toBe('');
    });

    it('无效的 JSON 应该返回空字符串', () => {
      expect(extractFullBodyDescription('invalid json')).toBe('');
    });
  });
});

describe('prompt.ts - 角色提示词生成', () => {
  describe('getRoleImagePrompt', () => {
    it('应该生成角色图像提示词', () => {
      const prompt = getRoleImagePrompt('金色头发', '青年', '男');
      expect(prompt).toContain('金色头发');
      expect(prompt).toContain('青年');
      expect(prompt).toContain('男');
    });

    it('应该处理 unknown 年龄', () => {
      const prompt = getRoleImagePrompt('测试', 'unknown', '男');
      expect(prompt).not.toContain('unknown');
    });

    it('应该处理 unlimited 性别', () => {
      const prompt = getRoleImagePrompt('测试', '青年', 'unlimited');
      expect(prompt).not.toContain('unlimited');
    });
  });

  describe('getFacePortraitPrompt', () => {
    it('应该生成面部特写提示词', () => {
      const prompt = getFacePortraitPrompt(
        '金色头发',
        '青年',
        '男',
        undefined,
        '1:1',
        'zh'
      );
      expect(prompt).toBeTruthy();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('应该支持英文提示词', () => {
      const prompt = getFacePortraitPrompt(
        'blonde hair',
        'young',
        'male',
        undefined,
        '1:1',
        'en'
      );
      expect(prompt).toBeTruthy();
    });
  });

  describe('getFullBodyPrompt', () => {
    it('应该生成全身设定图提示词', () => {
      const prompt = getFullBodyPrompt('金色头发，西装', '青年', '男', 'zh');
      expect(prompt).toBeTruthy();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('应该包含正确的人体比例要求', () => {
      const prompt = getFullBodyPrompt('测试', '青年', '男', 'zh');
      expect(prompt).toContain('7.5-8头身');
      expect(prompt).toContain('正确的人体比例');
    });
  });
});

describe('prompt.ts - 场景和物品提示词', () => {
  describe('getSceneImagePrompt', () => {
    it('应该生成场景图像提示词', () => {
      const prompt = getSceneImagePrompt('森林中的小屋');
      expect(prompt).toContain('森林中的小屋');
      expect(prompt).toBeTruthy();
    });
  });

  describe('getItemImagePrompt', () => {
    it('应该生成物品图像提示词', () => {
      const prompt = getItemImagePrompt('金色的剑', '武器');
      expect(prompt).toContain('金色的剑');
      expect(prompt).toContain('武器');
      expect(prompt).toBeTruthy();
    });

    it('应该包含纯白色背景要求', () => {
      const prompt = getItemImagePrompt('测试', '道具');
      expect(prompt).toContain('纯白色的背景');
    });
  });
});
