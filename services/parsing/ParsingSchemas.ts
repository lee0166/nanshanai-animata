/**
 * Parsing Schemas - 小说解析Schema定义
 * 使用Zod进行类型安全的结构化输出
 * @version 1.0.0
 */

import { z } from 'zod';

// ==========================================
// Schema 1: 故事结构
// ==========================================
export const StoryStructureSchema = z.object({
  structureType: z.enum(['three_act', 'hero_journey', 'five_act', 'other']).default('other'),
  act1: z.string().default(''),
  act2a: z.string().default(''),
  act2b: z.string().default(''),
  act3: z.string().default(''),
  midpoint: z.string().default(''),
  climax: z.string().default(''),
});

// ==========================================
// Schema 2: 视觉风格
// ==========================================
export const VisualStyleSchema = z.object({
  artDirection: z.string().default(''),
  artStyle: z.string().default(''),
  artStyleDescription: z.string().default(''),
  colorPalette: z.array(z.string()).default([]),
  colorMood: z.string().default(''),
  cinematography: z.string().default(''),
  lightingStyle: z.string().default(''),
});

// ==========================================
// Schema 3: 时代背景
// ==========================================
export const EraContextSchema = z.object({
  era: z.string().default(''),
  eraDescription: z.string().default(''),
  location: z.string().default(''),
  season: z.string().optional(),
  timeOfDay: z.string().optional(),
});

// ==========================================
// Schema 4: 情绪曲线节点
// ==========================================
export const EmotionalPointSchema = z.object({
  plotPoint: z.string(),
  emotion: z.string(),
  intensity: z.number().int().min(0).max(10),
  colorTone: z.string(),
  percentage: z.number().min(0).max(100),
});

// ==========================================
// Schema 5: 一致性规则
// ==========================================
export const ConsistencyRulesSchema = z.object({
  characterTraits: z.record(z.array(z.string())).default({}),
  eraConstraints: z.array(z.string()).default([]),
  styleConstraints: z.array(z.string()).default([]),
  forbiddenElements: z.array(z.string()).default([]),
});

// ==========================================
// Schema 6: 参考信息
// ==========================================
export const ReferencesSchema = z.object({
  films: z.array(z.string()).default([]),
  directors: z.array(z.string()).default([]),
  artStyles: z.array(z.string()).default([]),
});

// ==========================================
// Schema 7: 元数据提取（扩展版）
// ==========================================
export const ScriptMetadataSchema = z.object({
  // 基础信息
  title: z.string().min(1),
  wordCount: z.number().int().min(0),
  estimatedDuration: z.string(),
  characterCount: z.number().int().min(0),
  characterNames: z.array(z.string().min(1)),
  sceneCount: z.number().int().min(0),
  sceneNames: z.array(z.string().min(1)),
  chapterCount: z.number().int().min(0),
  genre: z.string(),
  tone: z.string(),
  
  // Phase 1 新增：故事核心层
  synopsis: z.string().optional(),
  logline: z.string().optional(),
  coreConflict: z.string().optional(),
  theme: z.array(z.string()).optional(),
  
  // Phase 1 新增：故事结构层
  storyStructure: StoryStructureSchema.optional(),
  
  // Phase 1 新增：视觉风格层
  visualStyle: VisualStyleSchema.optional(),
  
  // Phase 1 新增：时代背景层
  eraContext: EraContextSchema.optional(),
  
  // Phase 1 新增：情绪曲线层
  emotionalArc: z.array(EmotionalPointSchema).optional(),
  
  // Phase 1 新增：一致性规则层
  consistencyRules: ConsistencyRulesSchema.optional(),
  
  // Phase 1 新增：参考层
  references: ReferencesSchema.optional(),
});

// ==========================================
// Schema 8: 角色外观
// ==========================================
export const CharacterAppearanceSchema = z.object({
  height: z.string().default('中等身高'),
  build: z.string().default('标准体型'),
  face: z.string().default('面容端正'),
  hair: z.string().default('普通发型'),
  clothing: z.string().default('日常服饰'),
});

// ==========================================
// Schema 9: 情绪曲线节点（角色层面）
// ==========================================
export const EmotionalArcNodeSchema = z.object({
  phase: z.string(),
  emotion: z.string(),
});

// ==========================================
// Schema 10: 角色关系
// ==========================================
export const CharacterRelationshipSchema = z.object({
  character: z.string(),
  relation: z.string(),
});

// ==========================================
// Schema 11: 完整角色
// ==========================================
export const ScriptCharacterSchema = z.object({
  name: z.string().min(1),
  gender: z.enum(['male', 'female', 'unknown']).default('unknown'),
  age: z.string().default('25'),
  identity: z.string().default('未知身份'),
  appearance: CharacterAppearanceSchema,
  personality: z.array(z.string()).default(['性格温和']),
  signatureItems: z.array(z.string()).default([]),
  emotionalArc: z.array(EmotionalArcNodeSchema).default([{ phase: '初始', emotion: '平静' }]),
  relationships: z.array(CharacterRelationshipSchema).default([]),
  visualPrompt: z.string().default('角色形象'),
});

// ==========================================
// Schema 12: 场景环境
// ==========================================
export const SceneEnvironmentSchema = z.object({
  architecture: z.string().default('普通建筑'),
  furnishings: z.array(z.string()).default(['基本陈设']),
  lighting: z.string().default('自然光'),
  colorTone: z.string().default('明亮'),
});

// ==========================================
// Schema 13: 完整场景
// ==========================================
export const ScriptSceneSchema = z.object({
  name: z.string().min(1),
  locationType: z.enum(['indoor', 'outdoor', 'unknown']).default('unknown'),
  description: z.string().min(1),
  timeOfDay: z.string().default('白天'),
  season: z.string().default('春季'),
  weather: z.string().default('晴朗'),
  environment: SceneEnvironmentSchema,
  sceneFunction: z.string().default('推进剧情'),
  visualPrompt: z.string().default('场景画面'),
  characters: z.array(z.string()).default([]),
});

// ==========================================
// Schema 14: 道具
// ==========================================
export const ScriptItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(50).default('道具描述'),
  category: z.enum(['weapon', 'tool', 'jewelry', 'document', 'creature', 'animal', 'other']).default('other'),
  owner: z.string().optional(),
  importance: z.enum(['major', 'minor']).default('minor'),
  visualPrompt: z.string().max(50).default('道具图像'),
});

// ==========================================
// Schema 15: 分镜
// ==========================================
export const ShotSchema = z.object({
  id: z.string().optional(),
  sceneName: z.string().min(1),
  sequence: z.number().int().min(1),
  shotType: z.enum(['extreme_long', 'long', 'full', 'medium', 'close_up', 'extreme_close_up']).default('full'),
  cameraMovement: z.enum(['static', 'push', 'pull', 'pan', 'tilt', 'track', 'crane']).default('static'),
  description: z.string().min(1),
  dialogue: z.string().optional(),
  sound: z.string().optional(),
  duration: z.number().int().min(1).default(3),
  characters: z.array(z.string()).default([]),
});

// ==========================================
// 批量Schema
// ==========================================
export const ScriptCharacterArraySchema = z.array(ScriptCharacterSchema);
export const ScriptSceneArraySchema = z.array(ScriptSceneSchema);
export const ScriptItemArraySchema = z.array(ScriptItemSchema);
export const ShotArraySchema = z.array(ShotSchema);

// ==========================================
// TypeScript类型导出
// ==========================================
export type StoryStructure = z.infer<typeof StoryStructureSchema>;
export type VisualStyle = z.infer<typeof VisualStyleSchema>;
export type EraContext = z.infer<typeof EraContextSchema>;
export type EmotionalPoint = z.infer<typeof EmotionalPointSchema>;
export type ConsistencyRules = z.infer<typeof ConsistencyRulesSchema>;
export type References = z.infer<typeof ReferencesSchema>;
export type ScriptMetadata = z.infer<typeof ScriptMetadataSchema>;
export type CharacterAppearance = z.infer<typeof CharacterAppearanceSchema>;
export type EmotionalArcNode = z.infer<typeof EmotionalArcNodeSchema>;
export type CharacterRelationship = z.infer<typeof CharacterRelationshipSchema>;
export type ScriptCharacter = z.infer<typeof ScriptCharacterSchema>;
export type SceneEnvironment = z.infer<typeof SceneEnvironmentSchema>;
export type ScriptScene = z.infer<typeof ScriptSceneSchema>;
export type ScriptItem = z.infer<typeof ScriptItemSchema>;
export type Shot = z.infer<typeof ShotSchema>;

// ==========================================
// 工具函数: 获取JSON Schema描述（给LLM看的）
// ==========================================
export function getJsonSchemaDescription(schema: z.ZodType): string {
  const shape = (schema as any).shape;
  if (!shape) return '';
  
  const fields = Object.keys(shape).map(key => {
    const field = shape[key];
    let type = 'string';
    let required = true;
    
    if (field._def.typeName === 'ZodArray') type = 'array';
    if (field._def.typeName === 'ZodNumber') type = 'number';
    if (field._def.typeName === 'ZodBoolean') type = 'boolean';
    if (field._def.typeName === 'ZodEnum') type = 'enum';
    if (field._def.typeName === 'ZodObject') type = 'object';
    if (field._def.defaultValue !== undefined) required = false;
    
    return `- ${key}: ${type}${required ? ' (required)' : ' (optional)'}`;
  });
  
  return fields.join('\n');
}

// ==========================================
// 工具函数: 获取批量Schema描述
// ==========================================
export function getArraySchemaDescription(itemSchema: z.ZodType, itemName: string): string {
  return `返回一个${itemName}数组，每个${itemName}对象包含以下字段：\n${getJsonSchemaDescription(itemSchema)}`;
}
