/**
 * ConsistencyChecker - 一致性检查引擎框架
 *
 * 提供剧本解析结果的一致性检查能力，包括角色、场景、视觉等多维度一致性验证
 * 支持规则注册、批量检查、报告生成
 *
 * @module services/parsing/consistency/ConsistencyChecker
 * @version 1.0.0
 */

import { ScriptCharacter, ScriptScene, ScriptMetadata } from '../../../types';

/**
 * 一致性违规类型
 */
export type ViolationType = 
  | 'character_inconsistency'    // 角色描述不一致
  | 'scene_continuity'           // 场景连续性错误
  | 'visual_style_mismatch'      // 视觉风格不匹配
  | 'timeline_conflict'          // 时间线冲突
  | 'logic_error'                // 逻辑错误
  | 'missing_reference';         // 缺失引用

/**
 * 一致性违规严重程度
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * 一致性违规记录
 */
export interface ConsistencyViolation {
  /** 违规ID */
  id: string;
  /** 违规类型 */
  type: ViolationType;
  /** 严重程度 */
  severity: Severity;
  /** 违规描述 */
  message: string;
  /** 涉及的角色ID */
  characterIds?: string[];
  /** 涉及的场景ID */
  sceneIds?: string[];
  /** 建议的修复方案 */
  suggestion?: string;
  /** 自动修复是否可行 */
  autoFixable: boolean;
  /** 置信度 0-1 */
  confidence: number;
}

/**
 * 一致性检查上下文
 */
export interface CheckContext {
  /** 剧本元数据 */
  metadata: ScriptMetadata;
  /** 所有角色 */
  characters: ScriptCharacter[];
  /** 所有场景 */
  scenes: ScriptScene[];
  /** 原始剧本内容 */
  originalText?: string;
  /** 全局上下文 */
  globalContext?: {
    storyStructure?: string;
    visualStyle?: string;
    eraContext?: string;
  };
}

/**
 * 一致性检查结果
 */
export interface ConsistencyCheckResult {
  /** 是否通过检查 */
  passed: boolean;
  /** 总分 0-100 */
  score: number;
  /** 所有违规记录 */
  violations: ConsistencyViolation[];
  /** 按类型分组的违规 */
  violationsByType: Record<ViolationType, ConsistencyViolation[]>;
  /** 检查耗时(ms) */
  duration: number;
  /** 检查时间戳 */
  timestamp: string;
}

/**
 * 一致性规则接口
 */
export interface ConsistencyRule {
  /** 规则ID */
  id: string;
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description: string;
  /** 规则优先级 */
  priority: number;
  /** 执行检查 */
  check(context: CheckContext): Promise<ConsistencyViolation[]>;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 一致性检查配置
 */
export interface ConsistencyCheckerConfig {
  /** 最小置信度阈值 */
  minConfidence: number;
  /** 是否启用自动修复建议 */
  enableAutoFix: boolean;
  /** 最大违规报告数量 */
  maxViolations: number;
  /** 是否包含info级别 */
  includeInfo: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ConsistencyCheckerConfig = {
  minConfidence: 0.7,
  enableAutoFix: true,
  maxViolations: 50,
  includeInfo: false
};

/**
 * 一致性检查引擎
 */
export class ConsistencyChecker {
  private rules: Map<string, ConsistencyRule> = new Map();
  private config: ConsistencyCheckerConfig;

  constructor(config: Partial<ConsistencyCheckerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 注册一致性规则
   * @param rule 规则实例
   */
  registerRule(rule: ConsistencyRule): void {
    this.rules.set(rule.id, rule);
    console.log(`[ConsistencyChecker] Registered rule: ${rule.name} (${rule.id})`);
  }

  /**
   * 注销一致性规则
   * @param ruleId 规则ID
   */
  unregisterRule(ruleId: string): void {
    if (this.rules.delete(ruleId)) {
      console.log(`[ConsistencyChecker] Unregistered rule: ${ruleId}`);
    }
  }

  /**
   * 启用规则
   * @param ruleId 规则ID
   */
  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      console.log(`[ConsistencyChecker] Enabled rule: ${ruleId}`);
    }
  }

  /**
   * 禁用规则
   * @param ruleId 规则ID
   */
  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      console.log(`[ConsistencyChecker] Disabled rule: ${ruleId}`);
    }
  }

  /**
   * 获取所有已注册规则
   */
  getRegisteredRules(): ConsistencyRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 执行一致性检查
   * @param context 检查上下文
   * @returns 检查结果
   */
  async check(context: CheckContext): Promise<ConsistencyCheckResult> {
    const startTime = Date.now();
    console.log('[ConsistencyChecker] Starting consistency check...');

    const allViolations: ConsistencyViolation[] = [];
    const enabledRules = Array.from(this.rules.values()).filter(r => r.enabled);

    // 按优先级排序
    enabledRules.sort((a, b) => b.priority - a.priority);

    // 并行执行所有规则检查
    const checkPromises = enabledRules.map(async (rule) => {
      try {
        console.log(`[ConsistencyChecker] Running rule: ${rule.name}`);
        const violations = await rule.check(context);
        
        // 过滤低置信度违规
        const filteredViolations = violations.filter(
          v => v.confidence >= this.config.minConfidence
        );

        console.log(`[ConsistencyChecker] Rule ${rule.name} found ${filteredViolations.length} violations`);
        return filteredViolations;
      } catch (error) {
        console.error(`[ConsistencyChecker] Rule ${rule.id} failed:`, error);
        return [];
      }
    });

    const results = await Promise.all(checkPromises);
    
    // 合并所有违规
    results.forEach(violations => {
      allViolations.push(...violations);
    });

    // 限制违规数量
    if (allViolations.length > this.config.maxViolations) {
      // 按严重程度排序：error > warning > info
      const severityOrder = { error: 0, warning: 1, info: 2 };
      allViolations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
      allViolations.splice(this.config.maxViolations);
    }

    // 按类型分组
    const violationsByType = this.groupViolationsByType(allViolations);

    // 计算总分
    const score = this.calculateScore(allViolations);

    const duration = Date.now() - startTime;
    console.log(`[ConsistencyChecker] Check completed in ${duration}ms, score: ${score}`);

    return {
      passed: score >= 80 && !allViolations.some(v => v.severity === 'error'),
      score,
      violations: allViolations,
      violationsByType,
      duration,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 按类型分组违规
   * @private
   */
  private groupViolationsByType(
    violations: ConsistencyViolation[]
  ): Record<ViolationType, ConsistencyViolation[]> {
    const grouped: Partial<Record<ViolationType, ConsistencyViolation[]>> = {};

    violations.forEach(v => {
      if (!grouped[v.type]) {
        grouped[v.type] = [];
      }
      grouped[v.type]!.push(v);
    });

    return grouped as Record<ViolationType, ConsistencyViolation[]>;
  }

  /**
   * 计算一致性得分
   * @private
   */
  private calculateScore(violations: ConsistencyViolation[]): number {
    if (violations.length === 0) return 100;

    // 基础分100，根据违规扣分
    let score = 100;

    violations.forEach(v => {
      const weight = v.confidence;
      switch (v.severity) {
        case 'error':
          score -= 15 * weight;
          break;
        case 'warning':
          score -= 8 * weight;
          break;
        case 'info':
          score -= 3 * weight;
          break;
      }
    });

    return Math.max(0, Math.round(score));
  }

  /**
   * 获取可自动修复的违规
   * @param result 检查结果
   */
  getAutoFixableViolations(result: ConsistencyCheckResult): ConsistencyViolation[] {
    if (!this.config.enableAutoFix) return [];
    
    return result.violations.filter(v => v.autoFixable && v.suggestion);
  }

  /**
   * 生成检查报告
   * @param result 检查结果
   */
  generateReport(result: ConsistencyCheckResult): string {
    const lines: string[] = [];
    
    lines.push('# 一致性检查报告');
    lines.push('');
    lines.push(`**检查时间**: ${result.timestamp}`);
    lines.push(`**检查耗时**: ${result.duration}ms`);
    lines.push(`**总体得分**: ${result.score}/100`);
    lines.push(`**检查结果**: ${result.passed ? '✅ 通过' : '❌ 未通过'}`);
    lines.push('');

    // 违规统计
    lines.push('## 违规统计');
    lines.push('');
    
    const typeNames: Record<ViolationType, string> = {
      character_inconsistency: '角色不一致',
      scene_continuity: '场景连续性',
      visual_style_mismatch: '视觉风格不匹配',
      timeline_conflict: '时间线冲突',
      logic_error: '逻辑错误',
      missing_reference: '缺失引用'
    };

    Object.entries(result.violationsByType).forEach(([type, violations]) => {
      lines.push(`- **${typeNames[type as ViolationType]}**: ${violations.length}个`);
    });
    lines.push('');

    // 详细违规列表
    if (result.violations.length > 0) {
      lines.push('## 详细违规列表');
      lines.push('');

      result.violations.forEach((v, index) => {
        const severityEmoji = v.severity === 'error' ? '🔴' : v.severity === 'warning' ? '🟡' : '🔵';
        lines.push(`### ${index + 1}. ${severityEmoji} ${v.message}`);
        lines.push(`- **类型**: ${typeNames[v.type]}`);
        lines.push(`- **严重程度**: ${v.severity}`);
        lines.push(`- **置信度**: ${(v.confidence * 100).toFixed(1)}%`);
        lines.push(`- **可自动修复**: ${v.autoFixable ? '是' : '否'}`);
        if (v.suggestion) {
          lines.push(`- **建议**: ${v.suggestion}`);
        }
        lines.push('');
      });
    }

    return lines.join('\n');
  }
}

export default ConsistencyChecker;
