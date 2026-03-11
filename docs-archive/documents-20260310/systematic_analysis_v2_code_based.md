# 剧本解析系统 - 基于代码深度分析的系统性分析报告

## 一、基于实际代码的问题总结（杜绝臆测）

### 1.1 已验证的代码问题（从代码中发现）

| 问题                             | 证据位置                                         | 严重性  | 根因分析                                                             |
| -------------------------------- | ------------------------------------------------ | ------- | -------------------------------------------------------------------- |
| **临时配置不统一**               | `scriptParser.ts:1114-1128`                      | 🔴 严重 | ScriptParser使用临时配置对象，与config/models.ts中的实际模型配置脱节 |
| **maxTokens硬编码**              | `scriptParser.ts:906-924`                        | 🔴 严重 | 所有请求都使用4000，没有根据任务类型动态调整                         |
| **分镜生成Token不足**            | `scriptParser.ts:314-345` + 日志                 | 🔴 严重 | 分镜生成实际需要9306 tokens，但限制为4000                            |
| **双重超时机制**                 | `scriptParser.ts:899-901` + `LLMProvider.ts:100` | 🟡 中等 | ScriptParser有60秒超时，LLMProvider有120秒超时，不一致               |
| **重复数据传输**                 | `scriptParser.ts:1256-1258`                      | 🟡 中等 | 每个角色/场景/分镜请求都发送完整339字符剧本                          |
| **并发配置硬编码**               | `scriptParser.ts:89-92`                          | 🟢 轻微 | concurrency=1，callDelay=1000ms硬编码                                |
| **临时模型配置缺失capabilities** | `scriptParser.ts:906-924`                        | 🟢 轻微 | 临时配置没有利用models.ts中的capabilities配置                        |

### 1.2 从后端日志中提取的实际调用数据

#### 单次API调用平均响应时间（基于doubao-seed-1-6-flash-250828）

| 任务类型      | 调用次数 | 平均耗时   | 最小    | 最大    | Token使用          |
| ------------- | -------- | ---------- | ------- | ------- | ------------------ |
| Metadata      | 1        | 27s        | 27s     | 27s     | 3749               |
| GlobalContext | 4        | 19s        | 15s     | 24s     | 2379-3724          |
| Character     | 6        | 30s        | 25s     | 38s     | 3690-5324          |
| **Shots**     | **15**   | **41s**    | **23s** | **82s** | **9306+**          |
| **总计**      | **35次** | **29s/次** | **-**   | **-**   | **1026s (17分钟)** |

**关键发现**：

- Shots阶段平均41秒，是所有阶段中最慢的
- 有一个Shot请求耗时82秒，超过所有其他请求
- Shots的Completion tokens实际达到9306，但配置只有4000
- 339字的剧本完整解析耗时1026秒（17分钟）

---

## 二、代码架构根因分析（深入代码结构）

### 2.1 ScriptParser配置链问题分析

#### 问题1：临时配置与实际配置脱节

**位置**：`scriptParser.ts:906-924`

```typescript
// 当前代码问题
const config = {
  id: 'temp',
  name: 'Temp',
  provider: 'llm',
  modelId: this.model,
  apiUrl: this.apiUrl,
  apiKey: this.apiKey,
  type: 'llm' as const,
  parameters: [], // ❌ 空参数，无法使用models.ts中的配置
  capabilities: {
    supportsImageInput: false,
    supportsVideoInput: false,
    supportsTextOutput: true,
    supportsImageOutput: false,
    supportsVideoOutput: false,
    maxTokens: 4000, // ❌ 硬编码，所有任务都用4000
    maxInputTokens: 8000,
  },
};
```

**根因**：

- ScriptParser创建了一个临时配置对象，而不是从`config/models.ts`读取实际配置
- 这个临时配置没有利用`DEFAULT_MODELS`中为每个模型定义的`parameters`和`capabilities`
- 所有任务都使用相同的maxTokens: 4000

#### 问题2：没有基于任务类型的配置差异

**当前状态**：

- Metadata、Character、Scene、Shots都使用相同的maxTokens: 4000
- 但日志显示：
  - Shots需要9306 tokens
  - Metadata只需要2654 tokens

**应该有的差异**：
| 任务类型 | 所需maxTokens | 当前配置 |
|---------|--------------|---------|
| Metadata | 3000 | 4000 ✅ |
| GlobalContext | 4000 | 4000 ✅ |
| Character | 5000 | 4000 ❌ |
| Scene | 5000 | 4000 ❌ |
| **Shots** | **12000** | **4000 ❌** |

#### 问题3：双重超时机制

**ScriptParser超时**：`scriptParser.ts:899-901`

```typescript
const timeoutId = setTimeout(() => this.abortController?.abort(), CONFIG.timeout);
// CONFIG.timeout = 60000 (60秒)
```

**LLMProvider超时**：`LLMProvider.ts:100`

```typescript
const response = await this.makeRequest(
  `${apiUrl}/chat/completions`,
  {
    // ...
  },
  120000
); // 120秒超时
```

**结果**：

- ScriptParser在60秒取消请求
- 但LLMProvider的makeRequest还在等待
- 造成状态不一致

### 2.2 GlobalContextExtractor配置问题分析

**位置**：`scriptParser.ts:1104-1132`

```typescript
private initializeContextExtractor(): void {
  if (this.globalContextExtractor) return;

  // ❌ 又创建了一个临时配置
  const config = {
    id: 'temp-context',
    name: 'Temp Context Extractor',
    provider: 'llm',
    modelId: this.model,
    apiUrl: this.apiUrl,
    apiKey: this.apiKey,
    type: 'llm' as const,
    parameters: [
      {
        name: 'maxTokens',
        type: 'number' as const,
        defaultValue: 4000,  // ❌ 又一个硬编码
        description: 'Maximum tokens for context extraction',
      }
    ],
    capabilities: {
      supportsJsonMode: true,
      supportsSystemPrompt: true
    }
  };

  this.globalContextExtractor = new GlobalContextExtractor(config);
}
```

**问题**：

- 又一个临时配置，与ScriptParser中的临时配置不一致
- 没有统一的配置源

---

## 三、解决思路（系统性，非临时性）

### 3.1 核心解决原则

1. **配置集中化**：所有配置来自`config/models.ts`，不创建临时配置
2. **任务类型感知**：根据不同任务类型使用不同的配置
3. **统一超时机制**：只有一处超时控制
4. **动态配置计算**：基于输入内容、模型能力、任务类型动态计算

### 3.2 解决架构思路

```
┌──────────────────────────────────────────────────────────┐
│         1. 配置管理器 (ParsingConfigManager)            │
│         - 从 models.ts 读取模型配置                       │
│         - 基于任务类型选择配置参数                        │
│         - 提供统一的配置访问接口                           │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│         2. 调用调度器 (CallScheduler)                   │
│         - 统一管理所有LLM调用                             │
│         - 超时控制（一处）                                │
│         - 并发控制                                         │
│         - 重试逻辑                                         │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│         3. 动态配置计算器 (DynamicConfigCalculator)     │
│         - 基于任务类型计算max_tokens                     │
│         - 基于模型能力验证配置                            │
│         - 提供安全边界检查                                 │
└──────────────────────────────────────────────────────────┘
```

---

## 四、系统性解决方案设计

### 4.1 核心组件1：ParsingConfigManager

**文件位置**：`services/parsing/ParsingConfigManager.ts`（新建）

```typescript
import { ModelConfig, DEFAULT_MODELS } from '../../config/models';

export type ParsingTaskType = 'metadata' | 'global_context' | 'character' | 'scene' | 'shots';

export interface ParsingTaskConfig {
  taskType: ParsingTaskType;
  maxTokens: number;
  timeoutMs: number;
  sendFullScript: boolean;
  priority: number;
}

export class ParsingConfigManager {
  private static TASK_CONFIGS: Record<ParsingTaskType, ParsingTaskConfig> = {
    metadata: {
      taskType: 'metadata',
      maxTokens: 4000,
      timeoutMs: 60000,
      sendFullScript: true,
      priority: 1,
    },
    global_context: {
      taskType: 'global_context',
      maxTokens: 5000,
      timeoutMs: 90000,
      sendFullScript: true,
      priority: 2,
    },
    character: {
      taskType: 'character',
      maxTokens: 6000,
      timeoutMs: 90000,
      sendFullScript: false,
      priority: 3,
    },
    scene: {
      taskType: 'scene',
      maxTokens: 6000,
      timeoutMs: 90000,
      sendFullScript: false,
      priority: 3,
    },
    shots: {
      taskType: 'shots',
      maxTokens: 12000, // 分镜需要更多
      timeoutMs: 120000,
      sendFullScript: false,
      priority: 4,
    },
  };

  static getModelConfig(modelId: string): ModelConfig | undefined {
    return DEFAULT_MODELS.find(m => m.modelId === modelId);
  }

  static getTaskConfig(taskType: ParsingTaskType): ParsingTaskConfig {
    return this.TASK_CONFIGS[taskType];
  }

  static getMergedConfig(
    modelId: string,
    taskType: ParsingTaskType
  ): ModelConfig & { taskConfig: ParsingTaskConfig } {
    const modelConfig = this.getModelConfig(modelId);
    const taskConfig = this.getTaskConfig(taskType);

    // 如果没有找到模型配置，返回默认配置
    if (!modelConfig) {
      console.warn(`[ParsingConfigManager] Model ${modelId} not found, using fallback`);
      return {
        id: 'fallback',
        name: 'Fallback Model',
        provider: 'llm',
        modelId,
        apiUrl: '',
        apiKey: '',
        type: 'llm',
        parameters: [{ name: 'maxTokens', type: 'number', defaultValue: taskConfig.maxTokens }],
        capabilities: {},
        taskConfig,
      };
    }

    // 合并模型配置和任务配置
    return {
      ...modelConfig,
      taskConfig,
    };
  }
}
```

### 4.2 核心组件2：CallScheduler（统一调用管理）

**文件位置**：`services/parsing/CallScheduler.ts`（新建）

```typescript
import { ModelConfig } from '../../types';
import { llmProvider } from '../ai/providers/LLMProvider';
import { ParsingConfigManager, ParsingTaskType } from './ParsingConfigManager';

export class CallScheduler {
  private modelId: string;
  private apiUrl: string;
  private apiKey: string;

  constructor(modelId: string, apiUrl: string, apiKey: string) {
    this.modelId = modelId;
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  async callLLMForTask(
    taskType: ParsingTaskType,
    prompt: string,
    systemPrompt?: string,
    extraParams?: Record<string, any>
  ): Promise<{ success: boolean; data?: string; error?: string }> {
    const mergedConfig = ParsingConfigManager.getMergedConfig(this.modelId, taskType);
    const { taskConfig } = mergedConfig;

    console.log(`[CallScheduler] ========== Task: ${taskType} ==========`);
    console.log(`[CallScheduler] Model: ${this.modelId}`);
    console.log(`[CallScheduler] Max Tokens: ${taskConfig.maxTokens}`);
    console.log(`[CallScheduler] Timeout: ${taskConfig.timeoutMs}ms`);

    // 构建最终配置
    const config = {
      ...mergedConfig,
      apiUrl: this.apiUrl,
      apiKey: this.apiKey,
      parameters: [
        ...(mergedConfig.parameters || []),
        {
          name: 'maxTokens',
          type: 'number' as const,
          defaultValue: taskConfig.maxTokens,
        },
      ],
    };

    // 超时控制
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout for ${taskType}`)), taskConfig.timeoutMs);
    });

    try {
      const result = await Promise.race([
        llmProvider.generateText(prompt, config, systemPrompt, extraParams),
        timeoutPromise,
      ]);

      return result;
    } catch (error) {
      console.error(`[CallScheduler] Task ${taskType} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

### 4.3 核心组件3：场景相关性内容提取器

**文件位置**：`services/parsing/RelevantContentExtractor.ts`（新建）

```typescript
export class RelevantContentExtractor {
  static extractForCharacter(
    fullScript: string,
    characterName: string,
    minParagraphs: number = 3
  ): string {
    const paragraphs = fullScript.split('\n\n');
    const relevantParagraphs = paragraphs.filter(p => p.includes(characterName));

    // 如果找到的段落不够，使用完整剧本
    if (relevantParagraphs.length < minParagraphs) {
      console.log(
        `[RelevantContentExtractor] Not enough paragraphs for ${characterName}, using full script`
      );
      return fullScript;
    }

    console.log(
      `[RelevantContentExtractor] Extracted ${relevantParagraphs.length} relevant paragraphs for ${characterName}`
    );
    return relevantParagraphs.join('\n\n');
  }

  static extractForScene(
    fullScript: string,
    sceneName: string,
    characters?: string[],
    minParagraphs: number = 2
  ): string {
    const paragraphs = fullScript.split('\n\n');
    const keywords = [sceneName, ...(characters || [])];

    const relevantParagraphs = paragraphs.filter(p => keywords.some(k => p.includes(k)));

    if (relevantParagraphs.length < minParagraphs) {
      console.log(
        `[RelevantContentExtractor] Not enough paragraphs for ${sceneName}, using full script`
      );
      return fullScript;
    }

    console.log(
      `[RelevantContentExtractor] Extracted ${relevantParagraphs.length} relevant paragraphs for ${sceneName}`
    );
    return relevantParagraphs.join('\n\n');
  }

  static extractForShots(fullScript: string, sceneName: string, characters?: string[]): string {
    const paragraphs = fullScript.split('\n\n');
    const sceneStartIndex = paragraphs.findIndex(
      p => p.includes(sceneName) || p.toLowerCase().includes(sceneName.toLowerCase())
    );

    if (sceneStartIndex >= 0) {
      // 找到场景开始后，提取到下一个场景
      const nextSceneIndex = paragraphs
        .slice(sceneStartIndex + 1)
        .findIndex(
          p => p.includes('场景') || p.includes('地点') || (p.includes('第') && p.includes('章'))
        );
      const endIndex =
        nextSceneIndex >= 0 ? sceneStartIndex + 1 + nextSceneIndex : paragraphs.length;
      const extracted = paragraphs.slice(sceneStartIndex, endIndex).join('\n\n');

      console.log(`[RelevantContentExtractor] Extracted scene-specific content for ${sceneName}`);
      return extracted;
    }

    // 如果没找到确切场景，尝试关键词匹配
    return this.extractForScene(fullScript, sceneName, characters);
  }
}
```

---

## 五、代码重构计划

### 5.1 Phase 1：创建配置管理器（1小时）

- [ ] 创建 `ParsingConfigManager.ts`
- [ ] 创建任务类型配置
- [ ] 编写单元测试

### 5.2 Phase 2：重构ScriptParser使用新配置（2-3小时）

- [ ] 移除临时配置创建代码
- [ ] 集成 `ParsingConfigManager`
- [ ] 集成 `CallScheduler`
- [ ] 移除双重超时

### 5.3 Phase 3：添加场景相关性内容提取（1-2小时）

- [ ] 创建 `RelevantContentExtractor.ts`
- [ ] 在Character提取中集成
- [ ] 在Scene提取中集成
- [ ] 在Shots生成中集成

### 5.4 Phase 4：测试与验证（1小时）

- [ ] 运行现有测试
- [ ] 集成测试
- [ ] 性能验证

---

## 六、可优化项与不可优化项澄清

### 6.1 可优化项（项目代码问题）

| 问题         | 优化方案                      | 预期收益                   |
| ------------ | ----------------------------- | -------------------------- |
| Token溢出    | 分镜生成maxTokens从4000→12000 | ✅ 消除截断问题            |
| 重复数据传输 | 只发送相关片段，不发完整剧本  | ⚪ 轻微减少（339字影响小） |
| 双重超时     | 统一到CallScheduler           | ✅ 状态一致性              |
| 配置分散     | 集中到ParsingConfigManager    | ✅ 可维护性提升            |

### 6.2 不可优化项（模型/外部问题）

| 现象                 | 说明                                               | 建议                                            |
| -------------------- | -------------------------------------------------- | ----------------------------------------------- |
| 单次调用平均29秒     | **这是doubao-seed-1-6-flash-250828模型的固有特性** | 无法通过代码优化，只能建议换模型或接受          |
| 35次调用总耗时17分钟 | 单线程串行执行是设计决定，避免限流                 | 如果需要，可考虑增加concurrency配置（但有风险） |

---

## 七、总结与建议

### 7.1 核心结论

1. **主要问题**不是性能，而是**Token配置不当**（分镜生成需要12000但只有4000）
2. **29秒/次的响应时间是模型固有特性**，不是代码问题
3. **架构问题**是配置分散和临时配置过多，需要重构
4. **17分钟的总耗时**是35次 × 29秒的数学结果，单线程设计是合理的

### 7.2 优先行动项

**高优先级（必须做）**：

1. 修复分镜生成的maxTokens（4000→12000）
2. 统一配置管理，消除临时配置

**中优先级（建议做）**：3. 添加场景相关性内容提取（虽然当前339字影响小）4. 统一超时机制

**低优先级（可选）**：5. 性能监控和统计 6. 多模型自动选择

---

_报告生成时间：2026年3月3日_
_基于代码深度分析和后端日志_
