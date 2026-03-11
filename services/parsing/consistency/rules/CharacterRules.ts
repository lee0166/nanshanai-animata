/**
 * CharacterRules - 角色一致性规则
 *
 * 检查剧本中角色信息的一致性，包括：
 * - 角色描述冲突检测
 * - 角色属性一致性
 * - 角色关系逻辑验证
 * - 角色出场连续性
 *
 * @module services/parsing/consistency/rules/CharacterRules
 * @version 1.0.0
 */

import {
  ConsistencyRule,
  CheckContext,
  ConsistencyViolation,
  ViolationType,
} from '../ConsistencyChecker';
import { ScriptCharacter, ScriptScene } from '../../../../types';

/**
 * 角色一致性规则配置
 */
export interface CharacterRulesConfig {
  /** 描述相似度阈值 */
  descriptionSimilarityThreshold: number;
  /** 检查外观描述 */
  checkAppearance: boolean;
  /** 检查性格描述 */
  checkPersonality: boolean;
  /** 检查背景信息 */
  checkBackground: boolean;
  /** 检查角色关系 */
  checkRelationships: boolean;
}

const DEFAULT_CONFIG: CharacterRulesConfig = {
  descriptionSimilarityThreshold: 0.6,
  checkAppearance: true,
  checkPersonality: true,
  checkBackground: true,
  checkRelationships: false,
};

/**
 * 计算两个字符串的相似度（简单实现）
 * @private
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // 使用Jaccard相似度
  const set1 = new Set(s1.split(''));
  const set2 = new Set(s2.split(''));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * 提取关键词
 * @private
 */
function extractKeywords(text: string): string[] {
  if (!text) return [];

  // 简单的关键词提取：去除停用词，保留名词性词汇
  const stopWords = new Set([
    '的',
    '了',
    '是',
    '在',
    '和',
    '有',
    '被',
    '把',
    '为',
    '与',
    '及',
    '等',
  ]);

  return text
    .split(/[\s,，.。!！?？;；]/)
    .filter(word => word.length >= 2 && !stopWords.has(word))
    .map(word => word.toLowerCase());
}

/**
 * 检测描述冲突
 * @private
 */
function detectDescriptionConflict(
  char1: ScriptCharacter,
  char2: ScriptCharacter,
  field: 'appearance' | 'personality' | 'background',
  threshold: number
): { hasConflict: boolean; similarity: number; details: string } {
  const rawDesc1 = char1[field] || '';
  const rawDesc2 = char2[field] || '';

  // 转换为字符串
  const desc1 =
    typeof rawDesc1 === 'string'
      ? rawDesc1
      : Array.isArray(rawDesc1)
        ? rawDesc1.join(' ')
        : JSON.stringify(rawDesc1);
  const desc2 =
    typeof rawDesc2 === 'string'
      ? rawDesc2
      : Array.isArray(rawDesc2)
        ? rawDesc2.join(' ')
        : JSON.stringify(rawDesc2);

  if (!desc1 || !desc2) {
    return { hasConflict: false, similarity: 0, details: '' };
  }

  const similarity = calculateSimilarity(desc1, desc2);

  // 如果相似度很低，可能存在冲突
  if (similarity < threshold && similarity > 0.1) {
    const keywords1 = extractKeywords(desc1);
    const keywords2 = extractKeywords(desc2);

    // 检查是否有互斥的关键词
    const contradictoryPairs = [
      [
        ['高', ' tall'],
        ['矮', ' short'],
      ],
      [
        ['胖', ' fat'],
        ['瘦', ' thin'],
      ],
      [
        ['年轻', ' young'],
        ['年老', ' old', '老'],
      ],
      [
        ['黑', ' black'],
        ['白', ' white'],
      ],
      [
        ['长发', ' long hair'],
        ['短发', ' short hair'],
      ],
      [
        ['开朗', '开朗'],
        ['内向', '内向'],
      ],
      [
        ['善良', '善良'],
        ['邪恶', '邪恶'],
      ],
    ];

    for (const [pair1, pair2] of contradictoryPairs) {
      const has1 = pair1.some(k => keywords1.some(kw => kw.includes(k)));
      const has2 = pair2.some(k => keywords2.some(kw => kw.includes(k)));
      const has1Reverse = pair2.some(k => keywords1.some(kw => kw.includes(k)));
      const has2Reverse = pair1.some(k => keywords2.some(kw => kw.includes(k)));

      if ((has1 && has2) || (has1Reverse && has2Reverse)) {
        return {
          hasConflict: true,
          similarity,
          details: `检测到互斥描述: "${desc1}" vs "${desc2}"`,
        };
      }
    }
  }

  return { hasConflict: false, similarity, details: '' };
}

/**
 * 角色一致性规则类
 */
export class CharacterRules implements ConsistencyRule {
  id = 'character-rules';
  name = '角色一致性规则';
  description = '检查剧本中角色信息的一致性，包括描述冲突、属性一致性和关系逻辑';
  priority = 90; // 高优先级
  enabled = true;

  private config: CharacterRulesConfig;

  constructor(config: Partial<CharacterRulesConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行角色一致性检查
   */
  async check(context: CheckContext): Promise<ConsistencyViolation[]> {
    const violations: ConsistencyViolation[] = [];
    const { characters, scenes } = context;

    console.log(`[CharacterRules] Checking ${characters.length} characters`);

    // 1. 检查角色描述冲突
    const descriptionViolations = this.checkDescriptionConflicts(characters);
    violations.push(...descriptionViolations);

    // 2. 检查角色属性一致性
    const attributeViolations = this.checkAttributeConsistency(characters);
    violations.push(...attributeViolations);

    // 3. 检查角色出场连续性
    const continuityViolations = this.checkCharacterContinuity(characters, scenes);
    violations.push(...continuityViolations);

    // 4. 检查角色名称重复或相似
    const nameViolations = this.checkNameConflicts(characters);
    violations.push(...nameViolations);

    console.log(`[CharacterRules] Found ${violations.length} violations`);
    return violations;
  }

  /**
   * 检查角色描述冲突
   * @private
   */
  private checkDescriptionConflicts(characters: ScriptCharacter[]): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];

    for (let i = 0; i < characters.length; i++) {
      for (let j = i + 1; j < characters.length; j++) {
        const char1 = characters[i];
        const char2 = characters[j];

        // 检查外观描述冲突
        if (this.config.checkAppearance) {
          const appearanceConflict = detectDescriptionConflict(
            char1,
            char2,
            'appearance',
            this.config.descriptionSimilarityThreshold
          );

          if (appearanceConflict.hasConflict) {
            violations.push({
              id: `char-appearance-conflict-${char1.id}-${char2.id}`,
              type: 'character_inconsistency' as ViolationType,
              severity: 'warning',
              message: `角色 "${char1.name}" 和 "${char2.name}" 的外观描述可能存在冲突`,
              characterIds: [char1.id, char2.id],
              suggestion: `请检查并统一两个角色的外观描述，确保不会产生混淆`,
              autoFixable: false,
              confidence: 0.75,
            });
          }
        }

        // 检查性格描述冲突（仅当角色可能是同一人时）
        if (this.config.checkPersonality && char1.name === char2.name) {
          const personalityConflict = detectDescriptionConflict(
            char1,
            char2,
            'personality',
            this.config.descriptionSimilarityThreshold
          );

          if (personalityConflict.hasConflict) {
            violations.push({
              id: `char-personality-conflict-${char1.id}-${char2.id}`,
              type: 'character_inconsistency' as ViolationType,
              severity: 'error',
              message: `同名角色 "${char1.name}" (ID: ${char1.id}, ${char2.id}) 的性格描述不一致`,
              characterIds: [char1.id, char2.id],
              suggestion: `同名角色应该具有统一的性格描述，请检查是否为重复角色或需要合并`,
              autoFixable: false,
              confidence: 0.9,
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * 检查角色属性一致性
   * @private
   */
  private checkAttributeConsistency(characters: ScriptCharacter[]): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];

    for (const character of characters) {
      // 检查角色是否有基本描述
      if (!character.description || character.description.length < 5) {
        violations.push({
          id: `char-missing-desc-${character.id}`,
          type: 'missing_reference' as ViolationType,
          severity: 'info',
          message: `角色 "${character.name}" 缺少详细描述`,
          characterIds: [character.id],
          suggestion: `建议为角色添加更详细的描述，包括外貌、性格等信息`,
          autoFixable: false,
          confidence: 0.8,
        });
      }

      // 检查外观和描述是否一致
      if (this.config.checkAppearance && character.appearance && character.description) {
        const appearanceStr =
          typeof character.appearance === 'string'
            ? character.appearance
            : JSON.stringify(character.appearance);
        const appearanceKeywords = extractKeywords(appearanceStr);
        const descKeywords = extractKeywords(character.description);

        const commonKeywords = appearanceKeywords.filter(k =>
          descKeywords.some(dk => dk.includes(k) || k.includes(dk))
        );

        // 如果外观关键词在描述中完全没有体现
        if (appearanceKeywords.length > 0 && commonKeywords.length === 0) {
          violations.push({
            id: `char-appearance-mismatch-${character.id}`,
            type: 'character_inconsistency' as ViolationType,
            severity: 'warning',
            message: `角色 "${character.name}" 的外观描述与基本描述不一致`,
            characterIds: [character.id],
            suggestion: `角色的外观描述 "${character.appearance}" 与基本描述 "${character.description}" 缺乏关联，建议统一`,
            autoFixable: false,
            confidence: 0.7,
          });
        }
      }

      // 检查背景信息是否合理
      if (this.config.checkBackground && character.background) {
        const backgroundLower = character.background.toLowerCase();

        // 检查是否有时间线冲突（简单的年龄检查）
        const ageMatch = character.description?.match(/(\d+)岁/);
        if (ageMatch) {
          const age = parseInt(ageMatch[1]);

          // 如果背景提到"童年"但年龄显示为成年人
          if (backgroundLower.includes('童年') && age > 18) {
            violations.push({
              id: `char-background-age-${character.id}`,
              type: 'timeline_conflict' as ViolationType,
              severity: 'warning',
              message: `角色 "${character.name}" 的背景描述可能存在时间线问题`,
              characterIds: [character.id],
              suggestion: `角色年龄为${age}岁，但背景提到"童年"，请检查时间线是否一致`,
              autoFixable: false,
              confidence: 0.65,
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * 检查角色出场连续性
   * @private
   */
  private checkCharacterContinuity(
    characters: ScriptCharacter[],
    scenes: ScriptScene[]
  ): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];

    // 统计每个角色的出场次数
    const characterSceneCount = new Map<string, number>();

    for (const scene of scenes) {
      for (const charId of scene.characters || []) {
        characterSceneCount.set(charId, (characterSceneCount.get(charId) || 0) + 1);
      }
    }

    // 检查是否有角色从未出场
    for (const character of characters) {
      const sceneCount = characterSceneCount.get(character.id) || 0;

      if (sceneCount === 0) {
        violations.push({
          id: `char-no-appearance-${character.id}`,
          type: 'missing_reference' as ViolationType,
          severity: 'info',
          message: `角色 "${character.name}" 在任何场景中都未出场`,
          characterIds: [character.id],
          suggestion: `该角色已定义但未在任何场景中出现，请检查是否为遗漏或需要删除`,
          autoFixable: false,
          confidence: 0.95,
        });
      }

      // 检查主角出场频率
      if (characterSceneCount.size > 0) {
        const maxAppearances = Math.max(...characterSceneCount.values());

        // 如果某个角色出场次数是主角的10倍以上，可能是重要角色标记错误
        if (sceneCount > 0 && maxAppearances > 5 && sceneCount < maxAppearances / 10) {
          violations.push({
            id: `char-minor-role-${character.id}`,
            type: 'logic_error' as ViolationType,
            severity: 'info',
            message: `角色 "${character.name}" 出场次数较少（${sceneCount}/${maxAppearances}）`,
            characterIds: [character.id],
            suggestion: `该角色出场频率较低，考虑是否将其标记为配角或临时角色`,
            autoFixable: false,
            confidence: 0.6,
          });
        }
      }
    }

    return violations;
  }

  /**
   * 检查角色名称冲突
   * @private
   */
  private checkNameConflicts(characters: ScriptCharacter[]): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];
    const nameMap = new Map<string, ScriptCharacter[]>();

    // 按名称分组
    for (const character of characters) {
      const existing = nameMap.get(character.name) || [];
      existing.push(character);
      nameMap.set(character.name, existing);
    }

    // 检查同名角色
    for (const [name, chars] of nameMap.entries()) {
      if (chars.length > 1) {
        // 检查同名角色是否真的是不同的人
        const uniqueIds = chars.map(c => c.id);

        violations.push({
          id: `char-duplicate-name-${name}`,
          type: 'character_inconsistency' as ViolationType,
          severity: 'warning',
          message: `发现 ${chars.length} 个同名角色 "${name}"`,
          characterIds: uniqueIds,
          suggestion: `剧本中有多个名为"${name}"的角色，请确认是否为同一人或需要区分（如使用"${name}A"、"${name}B"）`,
          autoFixable: false,
          confidence: 0.85,
        });
      }

      // 检查相似名称（简单的编辑距离检查）
      for (const [otherName, otherChars] of nameMap.entries()) {
        if (name >= otherName) continue; // 避免重复检查

        // 如果名称相似度很高
        const similarity = calculateSimilarity(name, otherName);
        if (similarity > 0.8 && similarity < 1) {
          violations.push({
            id: `char-similar-name-${name}-${otherName}`,
            type: 'character_inconsistency' as ViolationType,
            severity: 'info',
            message: `角色名称 "${name}" 和 "${otherName}" 非常相似`,
            characterIds: [...chars.map(c => c.id), ...otherChars.map(c => c.id)],
            suggestion: `两个角色名称相似，可能会造成混淆，建议明确区分`,
            autoFixable: false,
            confidence: 0.7,
          });
        }
      }
    }

    return violations;
  }
}

export default CharacterRules;
