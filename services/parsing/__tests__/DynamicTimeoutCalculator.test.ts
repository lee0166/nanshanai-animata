/**
 * DynamicTimeoutCalculator 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicTimeoutCalculator } from '../DynamicTimeoutCalculator';

describe('DynamicTimeoutCalculator', () => {
  let calculator: DynamicTimeoutCalculator;

  beforeEach(() => {
    calculator = new DynamicTimeoutCalculator({
      historySize: 5,
      baseSafetyFactor: 2.0,
      minTimeout: 60000,
      maxTimeout: 300000,
      defaultTimeout: 90000,
    });
  });

  describe('基础功能', () => {
    it('应该能正确初始化', () => {
      expect(calculator.getTimeout()).toBe(90000);
      expect(calculator.getTotalCalls()).toBe(0);
    });

    it('应该能记录响应时间', () => {
      calculator.recordResponseTime(5000);
      expect(calculator.getTotalCalls()).toBe(1);
    });

    it('应该能记录失败', () => {
      calculator.recordFailure();
      expect(calculator.getTotalCalls()).toBe(1);
    });
  });

  describe('超时计算', () => {
    it('应该在没有历史数据时使用默认超时', () => {
      expect(calculator.getTimeout()).toBe(90000);
    });

    it('应该能基于平均响应时间计算超时', () => {
      calculator.recordResponseTime(40000);
      calculator.recordResponseTime(60000);

      // 平均 50000ms × 2.5 = 125000ms
      expect(calculator.getTimeout()).toBe(125000);
    });

    it('应该能应用最小超时限制', () => {
      calculator.recordResponseTime(10000);
      calculator.recordResponseTime(20000);

      // 平均 15000ms × 2.5 = 37500ms < 60000ms
      expect(calculator.getTimeout()).toBe(60000);
    });

    it('应该能应用最大超时限制', () => {
      for (let i = 0; i < 5; i++) {
        calculator.recordResponseTime(200000);
      }

      // 平均 200000ms × 2.5 = 500000ms > 300000ms
      expect(calculator.getTimeout()).toBe(300000);
    });
  });

  describe('滑动窗口', () => {
    it('应该能维护历史记录大小', () => {
      // 记录 10 次，超过窗口大小 5
      for (let i = 0; i < 10; i++) {
        calculator.recordResponseTime(10000 * (i + 1));
      }

      const stats = calculator.getStats();
      expect(stats.count).toBe(5);
      expect(stats.history).toHaveLength(5);
    });
  });

  describe('统计信息', () => {
    it('应该能提供详细的统计信息', () => {
      calculator.recordResponseTime(40000);
      calculator.recordResponseTime(60000);
      calculator.recordResponseTime(50000);

      const stats = calculator.getStats();

      expect(stats.count).toBe(3);
      expect(stats.min).toBe(40000);
      expect(stats.max).toBe(60000);
      expect(stats.avg).toBe(50000);
      expect(stats.latest).toBe(50000);
    });
  });

  describe('成功率', () => {
    it('应该能计算成功率', () => {
      calculator.recordResponseTime(50000); // 成功
      calculator.recordFailure(); // 失败
      calculator.recordResponseTime(50000); // 成功

      expect(calculator.getSuccessRate()).toBe(2 / 3);
    });

    it('应该在没有调用时返回 100% 成功率', () => {
      expect(calculator.getSuccessRate()).toBe(1.0);
    });
  });

  describe('配置管理', () => {
    it('应该能更新配置', () => {
      calculator.updateConfig({ historySize: 10, baseSafetyFactor: 3.0 });

      const config = calculator.getConfig();
      expect(config.historySize).toBe(10);
      expect(config.baseSafetyFactor).toBe(3.0);
    });

    it('应该能部分更新配置', () => {
      calculator.updateConfig({ maxTimeout: 600000 });

      const config = calculator.getConfig();
      expect(config.maxTimeout).toBe(600000);
      expect(config.historySize).toBe(5); // 保持不变
    });
  });

  describe('重置功能', () => {
    it('应该能重置状态', () => {
      calculator.recordResponseTime(50000);
      calculator.recordFailure();

      calculator.reset();

      expect(calculator.getTotalCalls()).toBe(0);
      expect(calculator.getTimeout()).toBe(90000);
    });
  });

  describe('超时建议', () => {
    it('应该能提供详细的超时建议', () => {
      calculator.recordResponseTime(40000);
      calculator.recordResponseTime(60000);

      const advice = calculator.getTimeoutAdvice();

      expect(advice.recommendedTimeout).toBe(125000);
      expect(advice.stats.count).toBe(2);
      expect(advice.stats.avg).toBe(50000);
    });

    it('应该能说明使用默认超时的原因', () => {
      const advice = calculator.getTimeoutAdvice();

      expect(advice.reason).toContain('无历史数据');
      expect(advice.reason).toContain('默认超时');
    });
  });
});
