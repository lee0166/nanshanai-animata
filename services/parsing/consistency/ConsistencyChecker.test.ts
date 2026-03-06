/**
 * ConsistencyChecker Tests
 *
 * @module services/parsing/consistency/ConsistencyChecker.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ConsistencyChecker,
  ConsistencyRule,
  CheckContext,
  ConsistencyViolation,
  ViolationType
} from './ConsistencyChecker';
import { ScriptMetadata, ScriptCharacter, ScriptScene } from '../../../types';

// Mock data
const mockMetadata: ScriptMetadata = {
  title: 'Test Script',
  author: 'Test Author',
  genre: ['drama'],
  tone: 'serious',
  totalScenes: 2,
  totalCharacters: 2
};

const mockCharacters: ScriptCharacter[] = [
  {
    id: 'char1',
    name: '主角',
    description: '年轻男子，25岁',
    personality: '勇敢、善良',
    appearance: '黑色短发，蓝色眼睛',
    background: '来自小镇'
  },
  {
    id: 'char2',
    name: '配角',
    description: '中年女性，45岁',
    personality: '严厉但公正',
    appearance: '棕色长发，戴眼镜',
    background: '大学教授'
  }
];

const mockScenes: ScriptScene[] = [
  {
    id: 'scene1',
    name: '场景1',
    description: '主角在公园散步',
    location: '公园',
    time: '早晨',
    characters: ['char1'],
    mood: '平静'
  },
  {
    id: 'scene2',
    name: '场景2',
    description: '主角和配角在咖啡厅对话',
    location: '咖啡厅',
    time: '下午',
    characters: ['char1', 'char2'],
    mood: '紧张'
  }
];

const mockContext: CheckContext = {
  metadata: mockMetadata,
  characters: mockCharacters,
  scenes: mockScenes
};

describe('ConsistencyChecker', () => {
  let checker: ConsistencyChecker;

  beforeEach(() => {
    checker = new ConsistencyChecker();
  });

  describe('Rule Management', () => {
    it('should register a rule', () => {
      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockResolvedValue([])
      };

      checker.registerRule(mockRule);
      const rules = checker.getRegisteredRules();

      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('test-rule');
    });

    it('should unregister a rule', () => {
      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockResolvedValue([])
      };

      checker.registerRule(mockRule);
      checker.unregisterRule('test-rule');

      expect(checker.getRegisteredRules()).toHaveLength(0);
    });

    it('should enable and disable rules', () => {
      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: false,
        check: vi.fn().mockResolvedValue([])
      };

      checker.registerRule(mockRule);
      checker.enableRule('test-rule');

      expect(checker.getRegisteredRules()[0].enabled).toBe(true);

      checker.disableRule('test-rule');
      expect(checker.getRegisteredRules()[0].enabled).toBe(false);
    });
  });

  describe('Check Execution', () => {
    it('should return passed result with no violations', async () => {
      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockResolvedValue([])
      };

      checker.registerRule(mockRule);
      const result = await checker.check(mockContext);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect violations from rules', async () => {
      const mockViolation: ConsistencyViolation = {
        id: 'v1',
        type: 'character_inconsistency' as ViolationType,
        severity: 'warning',
        message: '角色描述不一致',
        characterIds: ['char1'],
        confidence: 0.8,
        autoFixable: false
      };

      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockResolvedValue([mockViolation])
      };

      checker.registerRule(mockRule);
      const result = await checker.check(mockContext);

      expect(result.passed).toBe(true); // score >= 80, no errors
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].message).toBe('角色描述不一致');
    });

    it('should fail when there are errors', async () => {
      const mockViolation: ConsistencyViolation = {
        id: 'v1',
        type: 'character_inconsistency' as ViolationType,
        severity: 'error',
        message: '严重不一致',
        confidence: 0.9,
        autoFixable: false
      };

      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockResolvedValue([mockViolation])
      };

      checker.registerRule(mockRule);
      const result = await checker.check(mockContext);

      expect(result.passed).toBe(false);
    });

    it('should filter violations by confidence', async () => {
      const lowConfidenceViolation: ConsistencyViolation = {
        id: 'v1',
        type: 'character_inconsistency' as ViolationType,
        severity: 'warning',
        message: '低置信度问题',
        confidence: 0.5, // 低于默认阈值0.7
        autoFixable: false
      };

      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockResolvedValue([lowConfidenceViolation])
      };

      checker.registerRule(mockRule);
      const result = await checker.check(mockContext);

      expect(result.violations).toHaveLength(0);
    });

    it('should handle rule execution errors gracefully', async () => {
      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockRejectedValue(new Error('Rule failed'))
      };

      checker.registerRule(mockRule);
      const result = await checker.check(mockContext);

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should limit max violations', async () => {
      const checkerWithLimit = new ConsistencyChecker({ maxViolations: 5 });

      const manyViolations: ConsistencyViolation[] = Array.from({ length: 10 }, (_, i) => ({
        id: `v${i}`,
        type: 'logic_error' as ViolationType,
        severity: 'warning',
        message: `问题 ${i}`,
        confidence: 0.8,
        autoFixable: false
      }));

      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockResolvedValue(manyViolations)
      };

      checkerWithLimit.registerRule(mockRule);
      const result = await checkerWithLimit.check(mockContext);

      expect(result.violations).toHaveLength(5);
    });
  });

  describe('Score Calculation', () => {
    it('should calculate score correctly for errors', async () => {
      const errorViolation: ConsistencyViolation = {
        id: 'v1',
        type: 'character_inconsistency' as ViolationType,
        severity: 'error',
        message: 'Error',
        confidence: 1.0,
        autoFixable: false
      };

      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockResolvedValue([errorViolation])
      };

      checker.registerRule(mockRule);
      const result = await checker.check(mockContext);

      expect(result.score).toBe(85); // 100 - 15 * 1.0
    });

    it('should calculate score correctly for warnings', async () => {
      const warningViolation: ConsistencyViolation = {
        id: 'v1',
        type: 'character_inconsistency' as ViolationType,
        severity: 'warning',
        message: 'Warning',
        confidence: 1.0,
        autoFixable: false
      };

      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockResolvedValue([warningViolation])
      };

      checker.registerRule(mockRule);
      const result = await checker.check(mockContext);

      expect(result.score).toBe(92); // 100 - 8 * 1.0
    });

    it('should not go below 0 score', async () => {
      const manyErrors: ConsistencyViolation[] = Array.from({ length: 10 }, (_, i) => ({
        id: `v${i}`,
        type: 'character_inconsistency' as ViolationType,
        severity: 'error',
        message: `Error ${i}`,
        confidence: 1.0,
        autoFixable: false
      }));

      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockResolvedValue(manyErrors)
      };

      checker.registerRule(mockRule);
      const result = await checker.check(mockContext);

      expect(result.score).toBe(0);
    });
  });

  describe('Auto Fix', () => {
    it('should get auto-fixable violations', async () => {
      const fixableViolation: ConsistencyViolation = {
        id: 'v1',
        type: 'character_inconsistency' as ViolationType,
        severity: 'warning',
        message: 'Fixable issue',
        confidence: 0.8,
        autoFixable: true,
        suggestion: '建议修复方案'
      };

      const unfixableViolation: ConsistencyViolation = {
        id: 'v2',
        type: 'scene_continuity' as ViolationType,
        severity: 'error',
        message: 'Unfixable issue',
        confidence: 0.9,
        autoFixable: false
      };

      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockResolvedValue([fixableViolation, unfixableViolation])
      };

      checker.registerRule(mockRule);
      const result = await checker.check(mockContext);
      const autoFixable = checker.getAutoFixableViolations(result);

      expect(autoFixable).toHaveLength(1);
      expect(autoFixable[0].id).toBe('v1');
    });

    it('should return empty when auto fix is disabled', async () => {
      const checkerNoAutoFix = new ConsistencyChecker({ enableAutoFix: false });

      const fixableViolation: ConsistencyViolation = {
        id: 'v1',
        type: 'character_inconsistency' as ViolationType,
        severity: 'warning',
        message: 'Fixable issue',
        confidence: 0.8,
        autoFixable: true,
        suggestion: '建议修复方案'
      };

      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockResolvedValue([fixableViolation])
      };

      checkerNoAutoFix.registerRule(mockRule);
      const result = await checkerNoAutoFix.check(mockContext);
      const autoFixable = checkerNoAutoFix.getAutoFixableViolations(result);

      expect(autoFixable).toHaveLength(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate markdown report', async () => {
      const violation: ConsistencyViolation = {
        id: 'v1',
        type: 'character_inconsistency' as ViolationType,
        severity: 'warning',
        message: '角色描述不一致',
        confidence: 0.8,
        autoFixable: true,
        suggestion: '统一角色描述'
      };

      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockResolvedValue([violation])
      };

      checker.registerRule(mockRule);
      const result = await checker.check(mockContext);
      const report = checker.generateReport(result);

      expect(report).toContain('# 一致性检查报告');
      expect(report).toContain('总体得分');
      expect(report).toContain('角色描述不一致');
      expect(report).toContain('统一角色描述');
    });

    it('should handle empty violations in report', async () => {
      const mockRule: ConsistencyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        priority: 1,
        enabled: true,
        check: vi.fn().mockResolvedValue([])
      };

      checker.registerRule(mockRule);
      const result = await checker.check(mockContext);
      const report = checker.generateReport(result);

      expect(report).toContain('# 一致性检查报告');
      expect(report).toContain('✅ 通过');
    });
  });
});
