/**
 * ProgressTracker 单元测试
 *
 * @module services/parsing/__tests__/ProgressTracker.test
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { ProgressTracker } from '../ProgressTracker';
import type { ParseStage } from '../../../types';

type MockCallback = Mock<
  (stage: ParseStage, progress: number, message?: string, details?: any) => void
>;

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;
  let mockCallback: MockCallback;

  beforeEach(() => {
    mockCallback = vi.fn();
    tracker = new ProgressTracker(5000); // 5000 characters
  });

  describe('Basic functionality', () => {
    it('should initialize with correct default values', () => {
      expect(tracker.getOverallProgress()).toBe(0);
      expect(tracker.getCurrentStage()).toBe('idle');
      expect(tracker.isActive()).toBe(false);
    });

    it('should start tracking when start() is called', () => {
      tracker.start(mockCallback);
      expect(tracker.isActive()).toBe(true);
    });

    it('should stop tracking when stop() is called', () => {
      tracker.start(mockCallback);
      tracker.stop();
      expect(tracker.isActive()).toBe(false);
    });
  });

  describe('Stage management', () => {
    beforeEach(() => {
      tracker.start(mockCallback);
    });

    it('should start a new stage', () => {
      tracker.startStage('metadata');
      expect(tracker.getCurrentStage()).toBe('metadata');
    });

    it('should update stage progress', () => {
      tracker.startStage('metadata');
      tracker.updateStageProgress('metadata', 0.5);
      expect(tracker.getStageProgress('metadata')).toBe(0.5);
    });

    it('should complete tracking', () => {
      tracker.complete();
      expect(tracker.getOverallProgress()).toBe(100);
      expect(tracker.isActive()).toBe(false);
    });
  });

  describe('Progress calculation', () => {
    beforeEach(() => {
      tracker.start(mockCallback);
    });

    it('should calculate overall progress based on stage weights', () => {
      // Complete metadata stage (15%)
      tracker.startStage('metadata');
      tracker.updateStageProgress('metadata', 1.0);

      // Overall progress should be approximately 15%
      const progress = tracker.getOverallProgress();
      expect(progress).toBeGreaterThanOrEqual(14);
      expect(progress).toBeLessThanOrEqual(16);
    });

    it('should update progress by work units', () => {
      tracker.startStage('characters');
      tracker.updateByWorkUnit('characters', 5, 10);

      // Should be 50% of characters stage (25% weight) = ~12.5% overall
      const stageProgress = tracker.getStageProgress('characters');
      expect(stageProgress).toBe(0.5);
    });
  });

  describe('Callback invocation', () => {
    beforeEach(() => {
      tracker.start(mockCallback);
    });

    it('should call callback on progress update', () => {
      tracker.startStage('metadata');
      tracker.updateStageProgress('metadata', 0.5);

      // Callback should have been called
      expect(mockCallback).toHaveBeenCalled();
    });

    it('should pass correct parameters to callback', () => {
      tracker.startStage('characters');
      tracker.updateStageProgress('characters', 0.5, 'Test message');

      const lastCall = mockCallback.mock.calls[mockCallback.mock.calls.length - 1];
      expect(lastCall[0]).toBe('characters'); // stage
      expect(typeof lastCall[1]).toBe('number'); // progress
      expect(lastCall[2]).toBe('Test message'); // message
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      tracker.start(mockCallback);
    });

    it('should report errors and call callback with error message', () => {
      tracker.startStage('metadata');
      tracker.reportError('Test error');

      // Callback should have been called with error message
      const errorCall = mockCallback.mock.calls.find((call: any[]) => call[2]?.includes('错误'));
      expect(errorCall).toBeDefined();
      expect(errorCall![2]).toContain('Test error');
    });
  });

  describe('Adaptive weights', () => {
    it('should use short text weights for content < 500 chars', () => {
      const shortTracker = new ProgressTracker(300);
      shortTracker.start(mockCallback);
      shortTracker.startStage('metadata');
      shortTracker.updateStageProgress('metadata', 1.0);

      // Short text has metadata weight of 20% instead of 15%
      const progress = shortTracker.getOverallProgress();
      expect(progress).toBeGreaterThanOrEqual(19);
      expect(progress).toBeLessThanOrEqual(21);
    });

    it('should use long text weights for content > 10000 chars', () => {
      const longTracker = new ProgressTracker(15000);
      longTracker.start(mockCallback);
      longTracker.startStage('metadata');
      longTracker.updateStageProgress('metadata', 1.0);

      // Long text has metadata weight of 10% instead of 15%
      const progress = longTracker.getOverallProgress();
      expect(progress).toBeGreaterThanOrEqual(9);
      expect(progress).toBeLessThanOrEqual(11);
    });
  });
});
