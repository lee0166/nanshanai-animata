/**
 * Short Drama Rules Engine
 *
 * 短剧规则引擎 - 黄金3秒、分镜规则、冲突密度等
 * 基于文档《融合方案_实施细节与代码示例》第3.1节
 *
 * @module services/parsing/ShortDramaRules
 * @version 1.0.0
 */

import { ScriptScene, ScriptCharacter } from '../../types';

export interface DramaRule {
  id: string;
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  validate: (context: RuleContext) => RuleViolation[];
}

export interface RuleContext {
  scenes: ScriptScene[];
  characters: ScriptCharacter[];
  targetDuration?: number; // 目标时长（秒）
  targetEpisodes?: number; // 目标集数
}

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  sceneIndex?: number;
  suggestion: string;
}

export interface ShotSuggestion {
  type: 'closeup' | 'medium' | 'wide' | 'extreme_closeup';
  subject: string;
  duration: number;
  cameraMovement?: string;
  motivation: string;
}

export class ShortDramaRules {
  private rules: DramaRule[] = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * 初始化规则库
   */
  private initializeRules(): void {
    // 规则1: 黄金3秒 - 开场必须有强冲突或悬念
    this.rules.push({
      id: 'golden_3s',
      name: '黄金3秒规则',
      description: '开场3秒内必须有强冲突或悬念',
      priority: 'high',
      validate: (context) => {
        const violations: RuleViolation[] = [];
        
        if (context.scenes.length === 0) {
          return violations;
        }

        const firstScene = context.scenes[0];
        const hasConflict = this.detectConflict(firstScene.description);
        const hasSuspense = this.detectSuspense(firstScene.description);

        if (!hasConflict && !hasSuspense) {
          violations.push({
            ruleId: 'golden_3s',
            ruleName: '黄金3秒规则',
            severity: 'error',
            message: '开场场景缺乏强冲突或悬念',
            sceneIndex: 0,
            suggestion: '建议在第一场景加入冲突元素（如争吵、意外、危机）或悬念元素（如神秘事件、未解之谜）'
          });
        }

        return violations;
      }
    });

    // 规则2: 冲突密度 - 每60秒至少1个冲突点
    this.rules.push({
      id: 'conflict_density',
      name: '冲突密度规则',
      description: '每60秒至少1个冲突点',
      priority: 'high',
      validate: (context) => {
        const violations: RuleViolation[] = [];
        const targetDuration = context.targetDuration || 600; // 默认10分钟
        const minConflicts = Math.ceil(targetDuration / 60);

        let totalConflicts = 0;
        context.scenes.forEach((scene, index) => {
          const conflicts = this.countConflicts(scene.description);
          totalConflicts += conflicts;
        });

        if (totalConflicts < minConflicts) {
          violations.push({
            ruleId: 'conflict_density',
            ruleName: '冲突密度规则',
            severity: 'warning',
            message: `冲突点不足，当前${totalConflicts}个，建议至少${minConflicts}个`,
            suggestion: '增加角色间的矛盾、外部阻碍或内心挣扎等冲突元素'
          });
        }

        return violations;
      }
    });

    // 规则3: 情绪曲线 - 必须有高潮和低谷
    this.rules.push({
      id: 'emotional_arc',
      name: '情绪曲线规则',
      description: '情绪必须有起伏，不能平淡',
      priority: 'medium',
      validate: (context) => {
        const violations: RuleViolation[] = [];
        
        if (context.scenes.length < 3) {
          return violations;
        }

        const emotions = context.scenes.map(s => this.detectEmotion(s.description));
        const hasHigh = emotions.some(e => e === 'high');
        const hasLow = emotions.some(e => e === 'low');

        if (!hasHigh || !hasLow) {
          violations.push({
            ruleId: 'emotional_arc',
            ruleName: '情绪曲线规则',
            severity: 'warning',
            message: '情绪曲线过于平淡，缺乏起伏',
            suggestion: '设计情绪高潮（如胜利、团聚）和低谷（如失败、分离）'
          });
        }

        return violations;
      }
    });

    // 规则4: 角色出场 - 主要角色必须在60秒内出场
    this.rules.push({
      id: 'character_intro',
      name: '角色出场规则',
      description: '主要角色必须在60秒内出场',
      priority: 'high',
      validate: (context) => {
        const violations: RuleViolation[] = [];
        
        // 简化实现：假设前3个场景是前60秒
        const introScenes = context.scenes.slice(0, 3);
        const introCharacters = new Set<string>();
        
        introScenes.forEach(scene => {
          scene.characters?.forEach(char => {
            introCharacters.add(char.name);
          });
        });

        context.characters.forEach(char => {
          if (!introCharacters.has(char.name)) {
            violations.push({
              ruleId: 'character_intro',
              ruleName: '角色出场规则',
              severity: 'warning',
              message: `主要角色"${char.name}"在前60秒内未出场`,
              suggestion: `考虑让"${char.name}"尽早出场，或通过对话提及`
            });
          }
        });

        return violations;
      }
    });

    // 规则5: 场景多样性 - 避免场景过于单一
    this.rules.push({
      id: 'scene_diversity',
      name: '场景多样性规则',
      description: '场景类型应该多样化',
      priority: 'low',
      validate: (context) => {
        const violations: RuleViolation[] = [];
        
        if (context.scenes.length < 5) {
          return violations;
        }

        const locations = new Set(context.scenes.map(s => s.locationType));
        if (locations.size < 2) {
          violations.push({
            ruleId: 'scene_diversity',
            ruleName: '场景多样性规则',
            severity: 'info',
            message: '场景类型过于单一',
            suggestion: '增加不同场景类型（室内/室外、白天/夜晚）以增加视觉多样性'
          });
        }

        return violations;
      }
    });
  }

  /**
   * 验证所有规则
   */
  validate(context: RuleContext): RuleViolation[] {
    const allViolations: RuleViolation[] = [];

    for (const rule of this.rules) {
      try {
        const violations = rule.validate(context);
        allViolations.push(...violations);
      } catch (e) {
        console.error(`[ShortDramaRules] Rule ${rule.id} validation failed:`, e);
      }
    }

    // 按严重程度排序
    const severityOrder = { 'error': 0, 'warning': 1, 'info': 2 };
    allViolations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return allViolations;
  }

  /**
   * 生成分镜建议
   */
  generateShotSuggestions(scene: ScriptScene, sceneIndex: number): ShotSuggestion[] {
    const suggestions: ShotSuggestion[] = [];

    // 开场场景 - 使用特写制造冲击
    if (sceneIndex === 0) {
      suggestions.push({
        type: 'extreme_closeup',
        subject: scene.characters[0]?.name || '主角',
        duration: 3,
        motivation: '黄金3秒，制造视觉冲击'
      });
    }

    // 冲突场景 - 使用中景和特写交替
    if (this.detectConflict(scene.description)) {
      suggestions.push({
        type: 'medium',
        subject: '冲突双方',
        duration: 5,
        cameraMovement: '快速切换',
        motivation: '强化冲突张力'
      });
      
      suggestions.push({
        type: 'closeup',
        subject: scene.characters[0]?.name || '主角',
        duration: 3,
        motivation: '捕捉情绪反应'
      });
    }

    // 情感场景 - 使用特写
    if (this.detectEmotion(scene.description) === 'high') {
      suggestions.push({
        type: 'closeup',
        subject: scene.characters[0]?.name || '主角',
        duration: 4,
        motivation: '强调情感表达'
      });
    }

    // 场景转换 - 使用全景
    if (sceneIndex > 0) {
      suggestions.push({
        type: 'wide',
        subject: scene.name,
        duration: 3,
        motivation: '建立场景环境'
      });
    }

    return suggestions;
  }

  /**
   * 分析剧本质量
   */
  analyzeQuality(context: RuleContext): {
    score: number;
    violations: RuleViolation[];
    suggestions: string[];
  } {
    const violations = this.validate(context);
    const suggestions: string[] = [];

    // 计算得分
    let score = 100;
    violations.forEach(v => {
      if (v.severity === 'error') score -= 15;
      else if (v.severity === 'warning') score -= 8;
      else if (v.severity === 'info') score -= 3;
    });

    score = Math.max(0, score);

    // 生成改进建议
    if (violations.length === 0) {
      suggestions.push('剧本质量良好，符合短剧制作标准');
    } else {
      const errorCount = violations.filter(v => v.severity === 'error').length;
      const warningCount = violations.filter(v => v.severity === 'warning').length;
      
      if (errorCount > 0) {
        suggestions.push(`发现${errorCount}个严重问题，建议优先修复`);
      }
      if (warningCount > 0) {
        suggestions.push(`发现${warningCount}个警告，建议优化`);
      }
    }

    // 添加通用建议
    if (context.scenes.length < 5) {
      suggestions.push('建议增加场景数量以丰富剧情');
    }

    return { score, violations, suggestions };
  }

  /**
   * 获取规则列表
   */
  getRules(): DramaRule[] {
    return [...this.rules];
  }

  // ==================== 辅助方法 ====================

  /**
   * 检测冲突
   */
  private detectConflict(text: string): boolean {
    const conflictKeywords = [
      '争吵', '打架', '冲突', '对立', '矛盾', '斗争', '对抗',
      '骂', '打', '杀', '死', '伤', '恨', '怒', '战',
      '拒绝', '反对', '质疑', '挑战', '威胁', '逼迫'
    ];
    return conflictKeywords.some(kw => text.includes(kw));
  }

  /**
   * 检测悬念
   */
  private detectSuspense(text: string): boolean {
    const suspenseKeywords = [
      '神秘', '未知', '秘密', '谜', '悬念', '奇怪', '异常',
      '突然', '意外', '竟然', '居然', '没想到', '出乎意料',
      '谁', '什么', '为什么', '怎么回事', '难道'
    ];
    return suspenseKeywords.some(kw => text.includes(kw));
  }

  /**
   * 统计冲突数量
   */
  private countConflicts(text: string): number {
    const conflictKeywords = [
      '争吵', '打架', '冲突', '对立', '矛盾', '斗争', '对抗',
      '骂', '打', '杀', '拒绝', '反对', '质疑', '挑战'
    ];
    let count = 0;
    conflictKeywords.forEach(kw => {
      const matches = text.match(new RegExp(kw, 'g'));
      if (matches) count += matches.length;
    });
    return count;
  }

  /**
   * 检测情绪强度
   */
  private detectEmotion(text: string): 'high' | 'medium' | 'low' {
    const highEmotionKeywords = [
      '狂喜', '暴怒', '悲痛', '惊恐', '兴奋', '激动', '绝望',
      '爱', '恨', '死', '杀', '胜利', '失败', '成功', '崩溃'
    ];
    const lowEmotionKeywords = [
      '平静', '安静', '平和', '普通', '日常', '平常', '一般'
    ];

    if (highEmotionKeywords.some(kw => text.includes(kw))) {
      return 'high';
    }
    if (lowEmotionKeywords.some(kw => text.includes(kw))) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * 添加自定义规则
   */
  addRule(rule: DramaRule): void {
    this.rules.push(rule);
  }

  /**
   * 移除规则
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }
}

// 导出单例实例
export const shortDramaRules = new ShortDramaRules();
