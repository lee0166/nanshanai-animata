/**
 * Parse State Manager Tests
 *
 * 测试用例基于文档《融合方案_实施细节与代码示例》第2.5节
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParseStateManager, SubTaskType, parseStateManager } from './ParseStateManager';
import { storageService } from '../storage';

// Mock storageService
vi.mock('../storage', () => ({
  storageService: {
    getScript: vi.fn(),
    updateScriptParseState: vi.fn()
  }
}));

describe('ParseStateManager', () => {
  let manager: ParseStateManager;

  beforeEach(() => {
    manager = new ParseStateManager();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize new state', () => {
      const state = manager.initialize('script_1', 'project_1');

      expect(state.scriptId).toBe('script_1');
      expect(state.projectId).toBe('project_1');
      expect(state.stage).toBe('idle');
      expect(state.subTasks.size).toBe(0);
      expect(state.costEstimate.totalTokens).toBe(0);
    });

    it('should export singleton instance', () => {
      expect(parseStateManager).toBeDefined();
      expect(parseStateManager).toBeInstanceOf(ParseStateManager);
    });
  });

  describe('SubTask Management', () => {
    beforeEach(() => {
      manager.initialize('script_1', 'project_1');
    });

    it('should create subtask', () => {
      const task = manager.createSubTask('character', '林黛玉');

      expect(task.id).toBe('character_林黛玉');
      expect(task.type).toBe('character');
      expect(task.status).toBe('pending');
      expect(task.retryCount).toBe(0);
    });

    it('should start subtask', () => {
      manager.createSubTask('character', '林黛玉');
      const task = manager.startSubTask('character_林黛玉');

      expect(task.status).toBe('processing');
      expect(task.startTime).toBeDefined();
    });

    it('should complete subtask', () => {
      manager.createSubTask('character', '林黛玉');
      manager.startSubTask('character_林黛玉');

      const result = { name: '林黛玉', age: '16' };
      manager.completeSubTask('character_林黛玉', result, { modelUsed: 'gpt-4o', tokenUsed: 500 });

      const state = manager.getState();
      const task = state?.subTasks.get('character_林黛玉');

      expect(task?.status).toBe('completed');
      expect(task?.result).toEqual(result);
      expect(task?.modelUsed).toBe('gpt-4o');
      expect(task?.tokenUsed).toBe(500);
      expect(state?.costEstimate.totalTokens).toBe(500);
    });

    it('should fail subtask and track retries', () => {
      manager.createSubTask('character', '林黛玉');

      const needsIntervention = manager.failSubTask('character_林黛玉', 'API error');

      const task = manager.getState()?.subTasks.get('character_林黛玉');
      expect(task?.status).toBe('failed');
      expect(task?.retryCount).toBe(1);
      expect(needsIntervention).toBe(false);
    });

    it('should require human intervention after 3 failures', () => {
      manager.createSubTask('character', '林黛玉');

      // 失败3次
      manager.failSubTask('character_林黛玉', 'Error 1');
      manager.resetSubTask('character_林黛玉');
      manager.failSubTask('character_林黛玉', 'Error 2');
      manager.resetSubTask('character_林黛玉');
      const needsIntervention = manager.failSubTask('character_林黛玉', 'Error 3');

      expect(needsIntervention).toBe(true);
    });

    it('should reset subtask for retry', () => {
      manager.createSubTask('character', '林黛玉');
      manager.startSubTask('character_林黛玉');
      manager.failSubTask('character_林黛玉', 'Error');

      manager.resetSubTask('character_林黛玉');

      const task = manager.getState()?.subTasks.get('character_林黛玉');
      expect(task?.status).toBe('pending');
      expect(task?.error).toBeUndefined();
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(() => {
      manager.initialize('script_1', 'project_1');
    });

    it('should update stage', () => {
      manager.updateStage('characters');

      const state = manager.getState();
      expect(state?.stage).toBe('characters');
    });

    it('should update stage progress', () => {
      manager.updateStage('characters');
      manager.updateStageProgress(50);

      const state = manager.getState();
      expect(state?.progressDetail.stage).toBe(50);
      expect(state?.progress).toBeGreaterThan(0);
    });

    it('should calculate overall progress', () => {
      manager.updateStage('metadata');
      expect(manager.getState()?.progress).toBe(10);

      manager.updateStage('characters');
      expect(manager.getState()?.progress).toBe(30);

      manager.updateStage('completed');
      expect(manager.getState()?.progress).toBe(100);
    });

    it('should track subtask progress', () => {
      // 创建3个子任务
      manager.createSubTask('character', '角色1');
      manager.createSubTask('character', '角色2');
      manager.createSubTask('character', '角色3');

      // 完成2个
      manager.startSubTask('character_角色1');
      manager.completeSubTask('character_角色1', {});

      manager.startSubTask('character_角色2');
      manager.completeSubTask('character_角色2', {});

      const state = manager.getState();
      expect(state?.progressDetail.completedTasks).toBe(2);
      expect(state?.progressDetail.totalTasks).toBe(3);
      expect(state?.progressDetail.overall).toBe(67); // 2/3 ≈ 67%
    });
  });

  describe('Task Filtering', () => {
    beforeEach(() => {
      manager.initialize('script_1', 'project_1');
    });

    it('should get uncompleted tasks', () => {
      manager.createSubTask('character', '角色1');
      manager.createSubTask('character', '角色2');
      manager.createSubTask('scene', '场景1');

      manager.startSubTask('character_角色1');
      manager.completeSubTask('character_角色1', {});

      const uncompleted = manager.getUncompletedTasks();
      expect(uncompleted.length).toBe(2);
    });

    it('should get tasks by type', () => {
      manager.createSubTask('character', '角色1');
      manager.createSubTask('character', '角色2');
      manager.createSubTask('scene', '场景1');

      const characters = manager.getTasksByType('character');
      expect(characters.length).toBe(2);

      const scenes = manager.getTasksByType('scene');
      expect(scenes.length).toBe(1);
    });
  });

  describe('Story Bible', () => {
    beforeEach(() => {
      manager.initialize('script_1', 'project_1');
    });

    it('should lock story bible', () => {
      const state = manager.getState();
      state!.characters = [{ name: '林黛玉', appearance: {}, personality: [], signatureItems: [], emotionalArc: [], relationships: [], visualPrompt: '' }];
      state!.scenes = [{ name: '大观园', locationType: 'outdoor', description: '', environment: {}, sceneFunction: '', visualPrompt: '', characters: [] }];

      manager.lockStoryBible('古风');

      expect(manager.isStoryBibleLocked()).toBe(true);
      expect(state?.storyBible?.visualStyle).toBe('古风');
      expect(state?.storyBible?.characters.length).toBe(1);
    });

    it('should check if story bible is locked', () => {
      expect(manager.isStoryBibleLocked()).toBe(false);

      manager.lockStoryBible('现代');

      expect(manager.isStoryBibleLocked()).toBe(true);
    });
  });

  describe('Cost Tracking', () => {
    beforeEach(() => {
      manager.initialize('script_1', 'project_1');
    });

    it('should track token usage', () => {
      manager.createSubTask('character', '角色1');
      manager.startSubTask('character_角色1');
      manager.completeSubTask('character_角色1', {}, { tokenUsed: 1000 });

      manager.createSubTask('character', '角色2');
      manager.startSubTask('character_角色2');
      manager.completeSubTask('character_角色2', {}, { tokenUsed: 1500 });

      const cost = manager.getCostEstimate();
      expect(cost.totalTokens).toBe(2500);
    });
  });

  describe('State Persistence', () => {
    it('should load state from storage', async () => {
      const mockScript = {
        parseState: {
          stage: 'characters',
          progress: 50,
          characters: [{ name: '林黛玉', appearance: {}, personality: [], signatureItems: [], emotionalArc: [], relationships: [], visualPrompt: '' }]
        }
      };

      vi.mocked(storageService.getScript).mockResolvedValue(mockScript as any);

      const state = await manager.load('script_1', 'project_1');

      expect(state).toBeDefined();
      expect(state?.stage).toBe('characters');
      expect(state?.scriptId).toBe('script_1');
      expect(state?.subTasks).toBeInstanceOf(Map);
    });

    it('should return null when no state in storage', async () => {
      vi.mocked(storageService.getScript).mockResolvedValue(null);

      const state = await manager.load('script_1', 'project_1');

      expect(state).toBeNull();
    });

    it('should save state to storage', async () => {
      manager.initialize('script_1', 'project_1');
      manager.updateStage('characters');

      await manager.save();

      expect(storageService.updateScriptParseState).toHaveBeenCalledWith(
        'script_1',
        'project_1',
        expect.any(Function)
      );
    });
  });
});
