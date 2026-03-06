/**
 * ShotQC 模块单元测试
 */

import { describe, it, expect } from 'vitest';
import type { Shot } from '../../../types';
import {
  validateShots,
  autoAdjustShots,
  compressNonCritical,
  expandCritical,
  generateQCReportWithAdjustments,
  type QCOptions,
  type QCReport,
} from './ShotQC';

// 测试数据工厂
function createMockShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: `shot-${Math.random().toString(36).substr(2, 9)}`,
    sequence: 1,
    sceneName: '测试场景',
    shotType: 'medium',
    cameraMovement: 'static',
    description: '测试分镜描述',
    duration: 3,
    characters: [],
    ...overrides,
  };
}

describe('ShotQC', () => {
  describe('validateShots', () => {
    it('应该通过预算范围内的校验', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 3 }),
        createMockShot({ sequence: 2, duration: 4 }),
        createMockShot({ sequence: 3, duration: 3 }),
      ];

      const options: QCOptions = {
        budgetDuration: 10,
        budgetTolerance: 0.15,
      };

      const report = validateShots(shots, options);

      expect(report.passed).toBe(true);
      expect(report.totalDuration).toBe(10);
      expect(report.budgetVariance).toBe(0);
      expect(report.issues).toHaveLength(0);
    });

    it('应该检测超出预算的情况', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 5 }),
        createMockShot({ sequence: 2, duration: 5 }),
        createMockShot({ sequence: 3, duration: 5 }),
      ];

      const options: QCOptions = {
        budgetDuration: 10,
        budgetTolerance: 0.15,
      };

      const report = validateShots(shots, options);

      expect(report.passed).toBe(false);
      expect(report.totalDuration).toBe(15);
      expect(report.budgetVariance).toBe(50);
      expect(report.issues.some(i => i.type === 'budget')).toBe(true);
    });

    it('应该检测连续相同时长的问题', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 3 }),
        createMockShot({ sequence: 2, duration: 3 }),
        createMockShot({ sequence: 3, duration: 3 }),
        createMockShot({ sequence: 4, duration: 3 }),
      ];

      const options: QCOptions = {
        budgetDuration: 12,
        sameDurationThreshold: 3,
      };

      const report = validateShots(shots, options);

      expect(report.issues.some(i => i.type === 'pacing')).toBe(true);
    });

    it('应该检测时长过短的分镜', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 0.5 }),
        createMockShot({ sequence: 2, duration: 3 }),
      ];

      const options: QCOptions = {
        budgetDuration: 5,
        minShotDuration: 1,
      };

      const report = validateShots(shots, options);

      expect(report.issues.some(i => i.type === 'duration' && i.message.includes('过短'))).toBe(true);
    });

    it('应该检测时长过长的分镜', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 35 }),
        createMockShot({ sequence: 2, duration: 3 }),
      ];

      const options: QCOptions = {
        budgetDuration: 40,
        maxShotDuration: 30,
      };

      const report = validateShots(shots, options);

      expect(report.issues.some(i => i.type === 'duration' && i.message.includes('过长'))).toBe(true);
    });
  });

  describe('compressNonCritical', () => {
    it('应该压缩非关键场景时长', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 5 }), // 非关键
        createMockShot({ sequence: 2, duration: 5 }), // 关键
        createMockShot({ sequence: 3, duration: 5 }), // 非关键
      ];

      const isCritical = (shot: Shot) => shot.sequence === 2;
      const result = compressNonCritical(shots, 12, isCritical);

      expect(result.shots[0].duration).toBeLessThan(5);
      expect(result.shots[1].duration).toBe(5); // 关键场景不变
      expect(result.shots[2].duration).toBeLessThan(5);
      expect(result.adjustments).toHaveLength(2);
    });

    it('当没有关键场景时应该按比例压缩所有场景', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 5 }),
        createMockShot({ sequence: 2, duration: 5 }),
        createMockShot({ sequence: 3, duration: 5 }),
      ];

      const result = compressNonCritical(shots, 10);

      expect(result.shots[0].duration).toBeCloseTo(3.33, 1);
      expect(result.shots[1].duration).toBeCloseTo(3.33, 1);
      expect(result.shots[2].duration).toBeCloseTo(3.33, 1);
    });

    it('当当前时长小于目标时长时不应该压缩', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 2 }),
        createMockShot({ sequence: 2, duration: 2 }),
      ];

      const result = compressNonCritical(shots, 10);

      expect(result.shots[0].duration).toBe(2);
      expect(result.shots[1].duration).toBe(2);
      expect(result.adjustments).toHaveLength(0);
    });
  });

  describe('expandCritical', () => {
    it('应该扩展关键场景时长', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 2 }), // 非关键
        createMockShot({ sequence: 2, duration: 2 }), // 关键
        createMockShot({ sequence: 3, duration: 2 }), // 非关键
      ];

      const isCritical = (shot: Shot) => shot.sequence === 2;
      const result = expandCritical(shots, 10, isCritical);

      expect(result.shots[0].duration).toBe(2); // 非关键场景不变
      expect(result.shots[1].duration).toBeGreaterThan(2);
      expect(result.shots[2].duration).toBe(2);
      expect(result.adjustments).toHaveLength(1);
    });

    it('当没有关键场景时应该按比例扩展所有场景', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 2 }),
        createMockShot({ sequence: 2, duration: 2 }),
        createMockShot({ sequence: 3, duration: 2 }),
      ];

      const result = expandCritical(shots, 12);

      expect(result.shots[0].duration).toBe(4);
      expect(result.shots[1].duration).toBe(4);
      expect(result.shots[2].duration).toBe(4);
    });

    it('当当前时长大于目标时长时不应该扩展', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 5 }),
        createMockShot({ sequence: 2, duration: 5 }),
      ];

      const result = expandCritical(shots, 8);

      expect(result.shots[0].duration).toBe(5);
      expect(result.shots[1].duration).toBe(5);
      expect(result.adjustments).toHaveLength(0);
    });
  });

  describe('autoAdjustShots', () => {
    it('应该使用 compressNonCritical 策略', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 5 }),
        createMockShot({ sequence: 2, duration: 5 }),
        createMockShot({ sequence: 3, duration: 5 }),
      ];

      const adjusted = autoAdjustShots(shots, 10, 'compressNonCritical');
      const totalDuration = adjusted.reduce((sum, s) => sum + (s.duration || 0), 0);

      expect(totalDuration).toBeCloseTo(10, 0);
    });

    it('应该使用 expandCritical 策略', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 2 }),
        createMockShot({ sequence: 2, duration: 2 }),
        createMockShot({ sequence: 3, duration: 2 }),
      ];

      const adjusted = autoAdjustShots(shots, 12, 'expandCritical');
      const totalDuration = adjusted.reduce((sum, s) => sum + (s.duration || 0), 0);

      expect(totalDuration).toBe(12);
    });
  });

  describe('generateQCReportWithAdjustments', () => {
    it('应该返回包含调整建议的报告', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 5 }),
        createMockShot({ sequence: 2, duration: 5 }),
        createMockShot({ sequence: 3, duration: 5 }),
      ];

      const options: QCOptions = {
        budgetDuration: 10,
        budgetTolerance: 0.15,
      };

      const report = generateQCReportWithAdjustments(shots, options);

      expect(report.adjustments.length).toBeGreaterThan(0);
      expect(report.totalDuration).toBeCloseTo(10, 0);
    });

    it('如果已经通过校验不应该有调整', () => {
      const shots: Shot[] = [
        createMockShot({ sequence: 1, duration: 3 }),
        createMockShot({ sequence: 2, duration: 4 }),
        createMockShot({ sequence: 3, duration: 3 }),
      ];

      const options: QCOptions = {
        budgetDuration: 10,
        budgetTolerance: 0.15,
      };

      const report = generateQCReportWithAdjustments(shots, options);

      expect(report.passed).toBe(true);
      expect(report.adjustments).toHaveLength(0);
    });
  });
});
