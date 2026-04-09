/**
 * 提示词质量评估工具
 *
 * 提供提示词质量实时评估功能，包括：
 * - 细节丰富度评估
 * - 具体性评估
 * - 连贯性评估
 * - 优化建议生成
 *
 * @module services/promptQualityEvaluator
 * @author Nanshan AI Team
 * @version 1.0.0
 */

import { ScriptCharacter, ScriptScene, ScriptItem } from '../types';

/**
 * 提示词质量反馈接口
 */
export interface PromptQualityFeedback {
  detailLevel: '不足' | '适中' | '丰富';
  specificity: '笼统' | '具体' | '非常具体';
  coherence: '割裂' | '连贯' | '非常连贯';
  overallScore: number; // 0-100分
  suggestions: string[];
  strengths: string[];
}

/**
 * 资产类型
 */
export type AssetType = 'role' | 'scene' | 'item';

/**
 * 美术特征知识库
 */
const ART_KNOWLEDGE = {
  // 角色面部细节
  faceDetails: {
    eyeTypes: ['丹凤眼', '杏眼', '桃花眼', '柳叶眼', '圆眼', '桃花眼', '狐狸眼', '凤眼', '杏眼', '桃花眼'],
    faceShapes: ['瓜子脸', '鹅蛋脸', '国字脸', '圆脸', '长脸', '方脸', '菱形脸', '心形脸'],
    lipColors: ['豆沙唇', '正红唇', '淡粉唇', '裸色唇', '梅子唇', '珊瑚唇', '西柚唇', '奶茶唇'],
  },
  // 材质描述库
  materials: {
    clothing: ['哑光皮革', '丝绸', '棉麻', '刺绣', '针织', '亮面绸缎', '雪纺', '蕾丝', '牛仔', '羊毛', '羊绒'],
    metal: ['哑光金属', '亮面金属', '做旧金属', '拉丝金属', '抛光金属', '磨砂金属'],
    wood: ['实木', '做旧木材', '抛光木材', '纹理清晰木材', '原木', '红木', '檀木'],
  },
  // 光影描述库
  lighting: ['侧光', '顶光', '逆光', '柔光', '硬光', '漫射光', '自然光', '人工光', '伦勃朗光', '蝴蝶光'],
  // 视角描述库
  perspective: ['正面视角', '四分之三视角', '侧面视角', '俯视视角', '仰视视角', '平视视角'],
  // 笼统词汇
  vagueKeywords: ['漂亮', '好看', '普通', '一般', '合适', '搭配', '美丽', '英俊', '帅气', '可爱', '迷人', '优雅', '高贵'],
};

/**
 * 评估提示词的细节丰富度
 */
function evaluateDetailLevel(prompt: string, assetType: AssetType): { level: '不足' | '适中' | '丰富'; count: number } {
  const { faceDetails, materials, lighting } = ART_KNOWLEDGE;
  
  let detailKeywords: string[] = [];
  
  if (assetType === 'role') {
    detailKeywords = [
      ...faceDetails.eyeTypes,
      ...faceDetails.faceShapes,
      ...faceDetails.lipColors,
      ...materials.clothing,
      ...lighting,
    ];
  } else if (assetType === 'scene') {
    detailKeywords = [
      ...materials.wood,
      ...materials.metal,
      ...lighting,
    ];
  } else { // item
    detailKeywords = [
      ...materials.metal,
      ...materials.wood,
    ];
  }
  
  const detailCount = detailKeywords.filter(kw => prompt.includes(kw)).length;
  
  let level: '不足' | '适中' | '丰富';
  if (detailCount < 2) {
    level = '不足';
  } else if (detailCount >= 5) {
    level = '丰富';
  } else {
    level = '适中';
  }
  
  return { level, count: detailCount };
}

/**
 * 评估提示词的具体性
 */
function evaluateSpecificity(prompt: string): { level: '笼统' | '具体' | '非常具体'; hasVague: boolean } {
  const { vagueKeywords } = ART_KNOWLEDGE;
  const hasVague = vagueKeywords.some(kw => prompt.includes(kw));
  
  // 检查是否有具体描述（非笼统词汇）
  const hasSpecificDetails = !hasVague && 
    (prompt.includes('丹凤') || prompt.includes('瓜子') || prompt.includes('刺绣') || 
     prompt.includes('丝绸') || prompt.includes('哑光') || prompt.includes('抛光') ||
     prompt.length > 50);
  
  let level: '笼统' | '具体' | '非常具体';
  if (hasVague) {
    level = '笼统';
  } else if (hasSpecificDetails && prompt.length > 100) {
    level = '非常具体';
  } else {
    level = '具体';
  }
  
  return { level, hasVague };
}

/**
 * 评估提示词的连贯性
 */
function evaluateCoherence(prompt: string): { level: '割裂' | '连贯' | '非常连贯'; score: number } {
  const parts = prompt.split(/[，。；,.]/).filter(Boolean);
  
  // 检查是否有机械拼接痕迹
  const hasIncoherent = parts.some(part => 
    part.length < 3 || 
    (part.includes('脚穿') && parts.indexOf(part) < parts.length - 2)
  );
  
  // 检查是否有语义连接词
  const hasConnectives = prompt.includes('面容') || prompt.includes('发型') || 
                        prompt.includes('服装') || prompt.includes('体型') ||
                        prompt.includes('身高') || prompt.includes('陈设') ||
                        prompt.includes('光线') || prompt.includes('色调');
  
  let level: '割裂' | '连贯' | '非常连贯';
  let score = 50;
  
  if (hasIncoherent) {
    level = '割裂';
    score = 40;
  } else if (hasConnectives && parts.length > 3) {
    level = '非常连贯';
    score = 90;
  } else {
    level = '连贯';
    score = 70;
  }
  
  return { level, score };
}

/**
 * 生成优化建议
 */
function generateSuggestions(
  prompt: string,
  assetType: AssetType,
  detailLevel: string,
  specificity: string,
  coherence: string
): string[] {
  const suggestions: string[] = [];
  
  // 细节丰富度建议
  if (detailLevel === '不足') {
    if (assetType === 'role') {
      suggestions.push('建议增加面部特征描述（如"丹凤眼""瓜子脸"）');
      suggestions.push('建议补充服装材质描述（如"丝绸""哑光皮革"）');
    } else if (assetType === 'scene') {
      suggestions.push('建议增加陈设材质描述（如"实木""做旧木材"）');
      suggestions.push('建议补充光影描述（如"侧光""柔光"）');
    } else {
      suggestions.push('建议增加材质描述（如"哑光金属""抛光木材"）');
    }
  }
  
  // 具体性建议
  if (specificity === '笼统') {
    suggestions.push('避免使用"漂亮""普通"等笼统词汇，改为具体描述');
    suggestions.push('例如用"丹凤眼"替代"好看的眼睛"，用"哑光皮革"替代"普通的皮革"');
  }
  
  // 连贯性建议
  if (coherence === '割裂') {
    suggestions.push('提示词语义不连贯，建议调整描述顺序（先核心特征，后辅助特征）');
    suggestions.push('可以使用"面容：...发型：...服装：..."这样的结构来组织描述');
  }
  
  // 通用建议
  if (prompt.length < 50) {
    suggestions.push('提示词偏短，建议补充更多细节描述');
  }
  
  return suggestions;
}

/**
 * 识别提示词的优点
 */
function identifyStrengths(
  prompt: string,
  detailLevel: string,
  specificity: string,
  coherence: string
): string[] {
  const strengths: string[] = [];
  
  if (detailLevel === '丰富') {
    strengths.push('细节描述非常丰富');
  } else if (detailLevel === '适中') {
    strengths.push('细节描述较为完整');
  }
  
  if (specificity === '非常具体') {
    strengths.push('描述非常具体，避免了笼统词汇');
  } else if (specificity === '具体') {
    strengths.push('描述较为具体');
  }
  
  if (coherence === '非常连贯') {
    strengths.push('提示词语义非常连贯，结构清晰');
  } else if (coherence === '连贯') {
    strengths.push('提示词语义连贯');
  }
  
  if (strengths.length === 0) {
    strengths.push('提示词结构完整');
  }
  
  return strengths;
}

/**
 * 计算综合评分
 */
function calculateOverallScore(
  detailLevel: string,
  specificity: string,
  coherence: string
): number {
  let score = 0;
  
  // 细节丰富度评分
  if (detailLevel === '丰富') score += 40;
  else if (detailLevel === '适中') score += 25;
  else score += 10;
  
  // 具体性评分
  if (specificity === '非常具体') score += 35;
  else if (specificity === '具体') score += 20;
  else score += 10;
  
  // 连贯性评分
  if (coherence === '非常连贯') score += 25;
  else if (coherence === '连贯') score += 15;
  else score += 5;
  
  return Math.min(100, Math.max(0, score));
}

/**
 * 评估角色提示词质量
 */
export function evaluateCharacterPrompt(character: ScriptCharacter): PromptQualityFeedback {
  const prompt = character.visualPrompt || 
                 (character.appearance ? JSON.stringify(character.appearance) : '') ||
                 character.description || '';
  
  return evaluatePromptQuality(prompt, 'role');
}

/**
 * 评估场景提示词质量
 */
export function evaluateScenePrompt(scene: ScriptScene): PromptQualityFeedback {
  const prompt = scene.visualPrompt || 
                 scene.description || '';
  
  return evaluatePromptQuality(prompt, 'scene');
}

/**
 * 评估物品提示词质量
 */
export function evaluateItemPrompt(item: ScriptItem): PromptQualityFeedback {
  const prompt = item.visualPrompt || 
                 item.description || '';
  
  return evaluatePromptQuality(prompt, 'item');
}

/**
 * 评估提示词质量（通用函数）
 */
export function evaluatePromptQuality(prompt: string, assetType: AssetType): PromptQualityFeedback {
  const detailResult = evaluateDetailLevel(prompt, assetType);
  const specificityResult = evaluateSpecificity(prompt);
  const coherenceResult = evaluateCoherence(prompt);
  const overallScore = calculateOverallScore(
    detailResult.level,
    specificityResult.level,
    coherenceResult.level
  );
  const suggestions = generateSuggestions(
    prompt,
    assetType,
    detailResult.level,
    specificityResult.level,
    coherenceResult.level
  );
  const strengths = identifyStrengths(
    prompt,
    detailResult.level,
    specificityResult.level,
    coherenceResult.level
  );
  
  return {
    detailLevel: detailResult.level,
    specificity: specificityResult.level,
    coherence: coherenceResult.level,
    overallScore,
    suggestions,
    strengths,
  };
}

/**
 * 获取评分颜色
 */
export function getScoreColor(score: number): 'success' | 'warning' | 'danger' | 'default' {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
}

/**
 * 获取评分文字描述
 */
export function getScoreText(score: number): string {
  if (score >= 90) return '优秀';
  if (score >= 80) return '良好';
  if (score >= 60) return '一般';
  return '需改进';
}
