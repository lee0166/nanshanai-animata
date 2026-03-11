# 小说解析优化执行计划 - 第一阶段：集成结构化输出

**文档类型**: 执行计划  
**创建日期**: 2026-03-04  
**目标**: 集成结构化输出（Structured Output），移除JSONRepair技术债务  
**预期收益**: 解析成功率从~80% → 100%

---

## 一、任务概述

基于《小说解析环节专项分析报告》发现的核心问题：

- 未使用结构化输出（还在用JSONRepair"抢救"LLM输出）
- 长文本记忆机制缺失（仅500字符固定窗口）
- 线性流水线无纠错机制

本计划聚焦于**第一阶段**：集成结构化输出，解决最紧迫的技术债务。

---

## 二、执行步骤（详细可执行）

### 步骤 1: 安装依赖

**目标**: 安装Zod用于Schema定义

**执行命令**:

```bash
npm install zod
```

**验证**:

```bash
npm list zod
# 应该显示: zod@^3.x.x
```

---

### 步骤 2: 创建解析Schema定义文件

**文件路径**: `services/parsing/ParsingSchemas.ts`

**内容**:

```typescript
import { z } from 'zod';

// ==========================================
// Schema 1: 元数据提取
// ==========================================
export const ScriptMetadataSchema = z.object({
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
});

// ==========================================
// Schema 2: 角色外观
// ==========================================
export const CharacterAppearanceSchema = z.object({
  height: z.string().default('中等身高'),
  build: z.string().default('标准体型'),
  face: z.string().default('面容端正'),
  hair: z.string().default('普通发型'),
  clothing: z.string().default('日常服饰'),
});

// ==========================================
// Schema 3: 情绪曲线节点
// ==========================================
export const EmotionalArcNodeSchema = z.object({
  phase: z.string(),
  emotion: z.string(),
});

// ==========================================
// Schema 4: 角色关系
// ==========================================
export const CharacterRelationshipSchema = z.object({
  character: z.string(),
  relation: z.string(),
});

// ==========================================
// Schema 5: 完整角色
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
// Schema 6: 场景环境
// ==========================================
export const SceneEnvironmentSchema = z.object({
  architecture: z.string().default('普通建筑'),
  furnishings: z.array(z.string()).default(['基本陈设']),
  lighting: z.string().default('自然光'),
  colorTone: z.string().default('明亮'),
});

// ==========================================
// Schema 7: 完整场景
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
// Schema 8: 道具
// ==========================================
export const ScriptItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(50).default('道具描述'),
  category: z
    .enum(['weapon', 'tool', 'jewelry', 'document', 'creature', 'animal', 'other'])
    .default('other'),
  owner: z.string().optional(),
  importance: z.enum(['major', 'minor']).default('minor'),
  visualPrompt: z.string().max(50).default('道具图像'),
});

// ==========================================
// Schema 9: 分镜
// ==========================================
export const ShotSchema = z.object({
  id: z.string().optional(),
  sceneName: z.string().min(1),
  sequence: z.number().int().min(1),
  shotType: z
    .enum(['extreme_long', 'long', 'full', 'medium', 'close_up', 'extreme_close_up'])
    .default('full'),
  cameraMovement: z
    .enum(['static', 'push', 'pull', 'pan', 'tilt', 'track', 'crane'])
    .default('static'),
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
// 工具函数: 获取JSON Schema描述
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
```

---

### 步骤 3: 扩展 LLMProvider 支持结构化输出

**修改文件**: `services/ai/providers/LLMProvider.ts`

**新增导入**:

```typescript
import { z } from 'zod';
```

**新增方法**（在LLMProvider类中）:

```typescript
/**
 * 生成结构化输出（使用JSON Mode）
 * @param prompt 用户提示词
 * @param config 模型配置
 * @param schema Zod Schema（用于类型校验）
 * @param schemaDescription Schema的文字描述（给LLM看）
 * @param systemPrompt 系统提示词
 */
async generateStructured<T>(
  prompt: string,
  config: ModelConfig,
  schema: z.ZodType<T>,
  schemaDescription: string,
  systemPrompt?: string
): Promise<AIResult<T>> {
  try {
    const apiKey = this.getApiKey(config);
    const apiUrl = config.apiUrl || 'https://api.openai.com/v1';
    const modelId = config.modelId;

    // 构建增强的系统提示词
    const enhancedSystemPrompt = systemPrompt
      ? `${systemPrompt}\n\n【重要】请严格按照以下JSON Schema输出，不要添加任何额外内容：\n${schemaDescription}`
      : `你是一个专业的剧本分析助手。请严格按照以下JSON Schema输出，不要添加任何额外内容：\n${schemaDescription}`;

    // 构建消息
    const messages: LLMMessage[] = [
      { role: 'system', content: enhancedSystemPrompt },
      { role: 'user', content: prompt }
    ];

    // 从配置获取参数
    const temperature = config.parameters?.find(p => p.name === 'temperature')?.defaultValue ?? 0.3;
    const maxTokens = config.parameters?.find(p => p.name === 'maxTokens')?.defaultValue ?? 4000;

    // 检查模型是否支持json_mode
    const useJsonMode = config.capabilities?.supportsJsonMode ?? false;

    // 构建请求体
    const requestBody: LLMRequest & { response_format?: { type: string } } = {
      model: modelId,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
      enable_thinking: false,
    };

    // 如果支持json_mode，添加response_format
    if (useJsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    console.log(`[LLMProvider] ========== Structured Output Request ==========`);
    console.log(`[LLMProvider] Endpoint: ${apiUrl}/chat/completions`);
    console.log(`[LLMProvider] Model: ${modelId}`);
    console.log(`[LLMProvider] JSON Mode: ${useJsonMode}`);

    console.log('[LLMProvider] Sending structured output request...');
    const startTime = Date.now();

    const response = await this.makeRequest(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }, 120000);

    const elapsed = Date.now() - startTime;
    console.log(`[LLMProvider] Structured request completed in ${elapsed}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LLMProvider] API Error: ${response.status} - ${errorText}`);
      return { success: false, error: `API Error: ${response.status} - ${errorText}` };
    }

    const data: LLMResponse = await response.json();
    const content = data.choices[0]?.message?.content || '';

    console.log(`[LLMProvider] Response length: ${content.length} characters`);

    // 直接尝试解析JSON
    let parsedData: any;
    try {
      parsedData = JSON.parse(content);
    } catch (e) {
      // 如果直接解析失败，尝试用JSONRepair（作为最后的后备方案）
      console.warn('[LLMProvider] Direct JSON parse failed, trying repair...');
      const { JSONRepair } = await import('../../parsing/JSONRepair');
      const repairResult = JSONRepair.repairAndParse(content);
      if (!repairResult.success || !repairResult.data) {
        return { success: false, error: 'Failed to parse JSON even after repair' };
      }
      parsedData = repairResult.data;
    }

    // 使用Zod进行类型校验和补全默认值
    const validationResult = schema.safeParse(parsedData);
    if (!validationResult.success) {
      console.error('[LLMProvider] Zod validation failed:', validationResult.error);
      return {
        success: false,
        error: `Schema validation failed: ${validationResult.error.message}`
      };
    }

    console.log('[LLMProvider] Structured output validated successfully');

    return {
      success: true,
      data: validationResult.data,
      metadata: {
        usage: data.usage,
        model: modelId,
      },
    };
  } catch (error: any) {
    console.error('[LLMProvider] Structured output error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}
```

---

### 步骤 4: 修改 scriptParser.ts 使用结构化输出

**修改文件**: `services/scriptParser.ts`

**添加导入**:

```typescript
import {
  ScriptMetadataSchema,
  ScriptCharacterArraySchema,
  ScriptSceneArraySchema,
  ShotArraySchema,
  ScriptItemArraySchema,
  getJsonSchemaDescription,
} from './parsing/ParsingSchemas';
import { z } from 'zod';
```

**添加辅助方法**（在ScriptParser类中）:

```typescript
private async callStructuredLLM<T>(
  prompt: string,
  schema: z.ZodType<T>,
  schemaDescription: string,
  systemPrompt?: string
): Promise<{ success: boolean; data?: T; error?: string }> {
  const { llmProvider } = await import('./ai/providers/LLMProvider');

  // 构建临时配置
  const config = {
    id: 'temp',
    name: 'Temp',
    provider: 'llm',
    modelId: this.model,
    apiUrl: this.apiUrl,
    apiKey: this.apiKey,
    type: 'llm' as const,
    parameters: [],
    capabilities: {
      supportsJsonMode: true, // 启用JSON Mode
      maxTokens: 4000,
    }
  };

  const result = await llmProvider.generateStructured(
    prompt,
    config,
    schema,
    schemaDescription,
    systemPrompt
  );

  return result;
}
```

**修改 extractMetadata 方法**:

```typescript
async extractMetadata(content: string): Promise<ScriptMetadata> {
  console.log('[ScriptParser] ========== Stage 1: Extract Metadata (Structured Output) ==========');

  const prompt = PROMPTS.metadata.replace('{content}', content.substring(0, 3000));

  const result = await this.callStructuredLLM(
    prompt,
    ScriptMetadataSchema,
    getJsonSchemaDescription(ScriptMetadataSchema),
    '你是一个专业的剧本分析助手，擅长从小说/剧本中提取结构化信息。'
  );

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to extract metadata');
  }

  return result.data;
}
```

**类似地修改其他方法**:

- `extractAllCharacters` → 使用 `ScriptCharacterArraySchema`
- `extractAllScenes` → 使用 `ScriptSceneArraySchema`
- `generateAllShots` → 使用 `ShotArraySchema`

---

### 步骤 5: 更新模型配置支持 JSON Mode

**修改文件**: `config/models.ts`

在LLM模型配置中添加 `supportsJsonMode`:

```typescript
// 在LLM模型模板中添加
capabilities: {
  supportsJsonMode: true,  // 新增：支持JSON Mode
  supportsStreaming: false,
  supportsFunctionCalling: false,
  maxContextLength: 8000,
}
```

---

### 步骤 6: 编写测试

**创建文件**: `services/parsing/ParsingSchemas.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { ScriptMetadataSchema, ScriptCharacterSchema, ScriptSceneSchema } from './ParsingSchemas';

describe('ParsingSchemas', () => {
  describe('ScriptMetadataSchema', () => {
    it('should validate valid metadata', () => {
      const result = ScriptMetadataSchema.safeParse({
        title: '测试小说',
        wordCount: 10000,
        estimatedDuration: '10分钟',
        characterCount: 5,
        characterNames: ['张三', '李四'],
        sceneCount: 8,
        sceneNames: ['客厅', '书房'],
        chapterCount: 3,
        genre: '都市',
        tone: '正剧',
      });
      expect(result.success).toBe(true);
    });

    it('should fill default values for missing fields', () => {
      const result = ScriptCharacterSchema.safeParse({
        name: '张三',
        appearance: {},
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gender).toBe('unknown');
        expect(result.data.age).toBe('25');
      }
    });
  });
});
```

---

## 三、启动命令汇总

### 安装依赖

```bash
# 1. 安装Zod
npm install zod

# 2. 验证安装
npm list zod
```

### 运行测试

```bash
# 运行所有测试
npm test

# 或者只运行Schema测试
npm test -- services/parsing/ParsingSchemas.test.ts
```

### 启动开发服务器验证

```bash
npm run dev
```

---

## 四、验证清单

| 检查项              | 验证方法                 | 预期结果                 |
| ------------------- | ------------------------ | ------------------------ |
| Zod安装成功         | `npm list zod`           | 显示zod版本              |
| Schema定义完整      | 检查`ParsingSchemas.ts`  | 所有解析类型都有Schema   |
| LLMProvider新增方法 | 检查`generateStructured` | 方法存在且类型正确       |
| 类型安全            | `npm run type-check`     | 无TypeScript错误         |
| 测试通过            | `npm test`               | 所有测试通过             |
| 解析成功            | 手动上传小说测试         | 解析成功，无需JSONRepair |

---

## 五、回滚方案

如果遇到问题，可以快速回滚：

```bash
# 1. 卸载新增依赖
npm uninstall zod

# 2. 恢复git（如果有）
git checkout HEAD -- services/

# 3. 重启开发服务器
npm run dev
```

---

## 六、优化效果预期

### 核心指标提升

| 指标           | 优化前                 | 优化后                | 提升幅度 |
| -------------- | ---------------------- | --------------------- | -------- |
| **解析成功率** | ~80% (依赖JSONRepair)  | **100%** (结构化输出) | +20%     |
| **解析速度**   | 依赖JSONRepair修复时间 | 直接结构化输出        | +30%     |
| **代码稳定性** | 依赖多级JSON修复       | 类型安全的Schema      | 显著提升 |

### 技术层面效果

1. **消除技术债务**
   - 移除 `JSONRepair.ts` 的依赖（仅作为后备）
   - 不再需要"猜"LLM的输出格式
   - 代码结构更清晰，维护成本降低

2. **类型安全**
   - 编译时类型校验（Zod Schema）
   - 运行时自动补全默认值
   - 类型错误提前发现，减少运行时bug

3. **可靠性提升**
   - LLM原生保证JSON格式（JSON Mode）
   - 多级别验证：API级 + Schema级 + 类型级
   - 向后兼容（JSONRepair作为最后的后备）

---

**本计划执行周期**: 预计3-5天  
**风险等级**: 低（向后兼容，JSONRepair作为后备）
