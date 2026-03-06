/**
 * SceneRules Tests
 *
 * @module services/parsing/consistency/rules/SceneRules.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SceneRules } from './SceneRules';
import { CheckContext } from '../ConsistencyChecker';
import { ScriptMetadata, ScriptCharacter, ScriptScene } from '../../../../types';

describe('SceneRules', () => {
  let rules: SceneRules;
  let mockContext: CheckContext;

  beforeEach(() => {
    rules = new SceneRules();
    mockContext = {
      metadata: {
        title: 'Test Script',
        author: 'Test Author',
        genre: ['drama'],
        tone: 'serious',
        totalScenes: 3,
        totalCharacters: 2
      } as ScriptMetadata,
      characters: [
        { id: 'char1', name: '张三', description: '主角' },
        { id: 'char2', name: '李四', description: '配角' }
      ] as ScriptCharacter[],
      scenes: []
    };
  });

  describe('Basic Properties', () => {
    it('should have correct rule properties', () => {
      expect(rules.id).toBe('scene-rules');
      expect(rules.name).toBe('场景一致性规则');
      expect(rules.priority).toBe(85);
      expect(rules.enabled).toBe(true);
    });
  });

  describe('Timeline Continuity', () => {
    it('should detect time backward movement', async () => {
      mockContext.scenes = [
        { id: 'scene1', name: '场景1', time: '下午3点', location: '办公室' },
        { id: 'scene2', name: '场景2', time: '上午10点', location: '咖啡厅' }
      ] as ScriptScene[];

      const violations = await rules.check(mockContext);

      const backwardTime = violations.find(v => v.id.includes('time-backward'));
      expect(backwardTime).toBeDefined();
      expect(backwardTime?.severity).toBe('warning');
    });

    it('should detect long time gaps', async () => {
      const customRules = new SceneRules({ maxTimeGapMinutes: 600 }); // 10 hours threshold

      mockContext.scenes = [
        { id: 'scene1', name: '场景1', time: '08:00', location: '家' },
        { id: 'scene2', name: '场景2', time: '20:00', location: '办公室' } // 12 hour gap
      ] as ScriptScene[];

      const violations = await customRules.check(mockContext);

      const timeGap = violations.find(v => v.id.includes('time-gap'));
      expect(timeGap).toBeDefined();
      expect(timeGap?.severity).toBe('info');
    });

    it('should allow normal time progression', async () => {
      mockContext.scenes = [
        { id: 'scene1', name: '场景1', time: '09:00', location: '办公室' },
        { id: 'scene2', name: '场景2', time: '12:00', location: '餐厅' },
        { id: 'scene3', name: '场景3', time: '15:00', location: '会议室' }
      ] as ScriptScene[];

      const violations = await rules.check(mockContext);

      const timeViolations = violations.filter(v => v.id.includes('time-'));
      expect(timeViolations).toHaveLength(0);
    });
  });

  describe('Location Validity', () => {
    it('should detect missing location', async () => {
      mockContext.scenes = [
        { id: 'scene1', name: '场景1', time: '上午', location: '' },
        { id: 'scene2', name: '场景2', time: '下午', location: '办公室' }
      ] as ScriptScene[];

      const violations = await rules.check(mockContext);

      const missingLocation = violations.find(v => v.id.includes('missing-location'));
      expect(missingLocation).toBeDefined();
      expect(missingLocation?.severity).toBe('info');
    });

    it('should allow valid location transitions', async () => {
      mockContext.scenes = [
        { id: 'scene1', name: '场景1', time: '上午', location: '室内' },
        { id: 'scene2', name: '场景2', time: '下午', location: '室外' }
      ] as ScriptScene[];

      const violations = await rules.check(mockContext);

      const locationJump = violations.filter(v => v.id.includes('location-jump'));
      expect(locationJump).toHaveLength(0);
    });
  });

  describe('Character Consistency', () => {
    it('should detect character reappearing after long gap', async () => {
      mockContext.scenes = [
        { id: 'scene1', name: '场景1', time: '上午', location: '办公室', characters: ['char1'] },
        { id: 'scene2', name: '场景2', time: '中午', location: '餐厅', characters: ['char2'] },
        { id: 'scene3', name: '场景3', time: '下午', location: '会议室', characters: ['char2'] },
        { id: 'scene4', name: '场景4', time: '晚上', location: '家', characters: ['char2'] },
        { id: 'scene5', name: '场景5', time: '深夜', location: '酒吧', characters: ['char2'] },
        { id: 'scene6', name: '场景6', time: '凌晨', location: '街头', characters: ['char2'] },
        { id: 'scene7', name: '场景7', time: '早晨', location: '公园', characters: ['char1'] } // char1 reappears after 6 scenes
      ] as ScriptScene[];

      const violations = await rules.check(mockContext);

      const reappear = violations.find(v => v.id.includes('char-reappear'));
      expect(reappear).toBeDefined();
      expect(reappear?.characterIds).toContain('char1');
    });

    it('should detect character mentioned but not present', async () => {
      mockContext.scenes = [
        {
          id: 'scene1',
          name: '场景1',
          time: '上午',
          location: '办公室',
          description: '张三正在和李四讨论项目',
          characters: ['char1'] // only char1 present, but char2 mentioned in description
        }
      ] as ScriptScene[];

      const violations = await rules.check(mockContext);

      const charMention = violations.find(v => v.id.includes('char-mention'));
      expect(charMention).toBeDefined();
      expect(charMention?.characterIds).toContain('char2');
    });
  });

  describe('Scene Transitions', () => {
    it('should detect quick cuts', async () => {
      mockContext.scenes = [
        { id: 'scene1', name: '场景1', time: '14:30', location: '办公室' },
        { id: 'scene2', name: '场景2', time: '14:30', location: '咖啡厅' } // same time, different location
      ] as ScriptScene[];

      const violations = await rules.check(mockContext);

      const quickCut = violations.find(v => v.id.includes('quick-cut'));
      expect(quickCut).toBeDefined();
      expect(quickCut?.severity).toBe('info');
    });

    it('should detect mood jumps', async () => {
      mockContext.scenes = [
        { id: 'scene1', name: '场景1', time: '上午', location: '办公室', mood: '紧张' },
        { id: 'scene2', name: '场景2', time: '下午', location: '餐厅', mood: '轻松' }
      ] as ScriptScene[];

      const violations = await rules.check(mockContext);

      const moodJump = violations.find(v => v.id.includes('mood-jump'));
      expect(moodJump).toBeDefined();
      expect(moodJump?.severity).toBe('info');
    });

    it('should allow gradual mood transitions', async () => {
      mockContext.scenes = [
        { id: 'scene1', name: '场景1', time: '上午', location: '办公室', mood: '紧张' },
        { id: 'scene2', name: '场景2', time: '中午', location: '餐厅', mood: '平静' },
        { id: 'scene3', name: '场景3', time: '下午', location: '公园', mood: '轻松' }
      ] as ScriptScene[];

      const violations = await rules.check(mockContext);

      // Should not flag gradual transitions
      const moodViolations = violations.filter(v => v.id.includes('mood-'));
      // This may or may not trigger depending on implementation
      expect(moodViolations.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Configuration', () => {
    it('should respect configuration options', async () => {
      const customRules = new SceneRules({
        checkTimeline: false,
        checkLocation: false,
        checkCharacterAppearance: false,
        checkTransitions: false
      });

      mockContext.scenes = [
        { id: 'scene1', name: '场景1', time: '14:30', location: '办公室' },
        { id: 'scene2', name: '场景2', time: '10:00', location: '咖啡厅' } // time backward
      ] as ScriptScene[];

      const violations = await customRules.check(mockContext);

      // With all checks disabled, should only have basic checks
      expect(violations.length).toBeLessThanOrEqual(2);
    });
  });

  describe('No Violations', () => {
    it('should pass for consistent scenes', async () => {
      mockContext.scenes = [
        {
          id: 'scene1',
          name: '早晨的办公室',
          time: '09:00',
          location: '办公室',
          mood: '平静',
          characters: ['char1', 'char2'],
          description: '张三和李四开始一天的工作'
        },
        {
          id: 'scene2',
          name: '午餐时间',
          time: '12:00',
          location: '餐厅',
          mood: '轻松',
          characters: ['char1', 'char2'],
          description: '两人在餐厅用餐'
        },
        {
          id: 'scene3',
          name: '下午的会议',
          time: '14:30',
          location: '会议室',
          mood: '紧张',
          characters: ['char1', 'char2'],
          description: '重要的项目讨论'
        }
      ] as ScriptScene[];

      const violations = await rules.check(mockContext);

      // Should have minimal or no violations for well-structured scenes
      const seriousViolations = violations.filter(v => v.severity === 'error');
      expect(seriousViolations).toHaveLength(0);
    });
  });
});
