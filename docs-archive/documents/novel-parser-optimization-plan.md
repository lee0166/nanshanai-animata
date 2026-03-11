# 小说解析流程优化完整方案

> **方案定位**: 基于现有系统的渐进式优化，严格保护现有功能
> **核心原则**: 向后兼容、风险可控、分阶段实施
> **预期效果**: 成功率 85%→99%+ | 成本降低 40% | 解析时间减少 40%

---

## 一、现有系统分析

### 1.1 核心文件结构

```
services/
├── scriptParser.ts          # 核心解析服务 (约800行)
│   ├── CONFIG              # 配置参数
│   ├── PROMPTS             # Prompt模板
│   ├── ScriptParser 类     # 主解析类
│   └── 工具方法            # chunkText, 缓存等
├── ai/
│   └── providers/
│       └── LLMProvider.ts  # LLM调用封装
├── storage.ts              # 存储服务
types.ts                    # 类型定义
```

### 1.2 现有配置参数 (必须保留)

```typescript
const CONFIG = {
  maxChunkSize: 6000, // 最大分块大小
  defaultModel: 'gpt-4o-mini', // 默认模型
  maxRetries: 3, // 最大重试次数
  retryDelay: 2000, // 重试延迟
  timeout: 60000, // 超时时间
  concurrency: 1, // 并发数
  callDelay: 1000, // 调用间隔
};
```

**保护原则**: 所有现有配置参数必须保留，新增功能通过扩展实现。

### 1.3 现有类型定义 (必须兼容)

```typescript
interface ScriptParseState {
  stage: ParseStage;
  progress: number;
  metadata?: ScriptMetadata;
  characters?: ScriptCharacter[];
  scenes?: ScriptScene[];
  items?: ScriptItem[];
  shots?: Shot[];
  error?: string;
  currentChunkIndex?: number;
  totalChunks?: number;
}
```

**保护原则**: 所有现有类型字段必须保留，新增字段使用可选类型(`?`)。

---

## 二、优化方案总览

### 2.1 优化模块分级

| 优先级 | 模块       | 可行性 | 风险 | 预期收益 |
| ------ | ---------- | ------ | ---- | -------- |
| P0     | JSON修复   | 高     | 极低 | 成功率↑  |
| P0     | 语义分块   | 高     | 低   | 质量↑    |
| P0     | 模型路由   | 高     | 低   | 成本↓40% |
| P0     | 子任务状态 | 高     | 低   | 稳定性↑  |
| P1     | 多级缓存   | 中     | 低   | 成本↓    |
| P1     | RAG检索    | 中     | 中   | 质量↑    |
| P2     | 短剧规则   | 待定   | 高   | 业务适配 |
| P2     | 人工确认   | 待定   | 高   | 体验↑    |

### 2.2 实施阶段规划

**Phase 1: 基础优化 (2-3小时，立即可做)**

- Module 1: JSON修复 (0.5h)
- Module 2: 语义分块 (0.5h)
- Module 3: 模型路由 (0.5h)
- Module 4: 子任务状态管理 (0.5h)

**Phase 2: 效率优化 (2-3小时，可选)**

- Module 5: 多级缓存 (1h)
- Module 6: RAG检索 (1-2h)

**Phase 3: 业务优化 (待定，需确认需求)**

- Module 7: 短剧规则引擎
- Module 8: 人工确认UI

---

## 三、Phase 1: 基础优化详细方案

### Module 1: JSON修复模块

#### 3.1.1 设计目标

- 自动修复AI返回的JSON格式错误
- 提升解析成功率至99%+

#### 3.1.2 实现方案

**新增文件**: `services/JSONRepair.ts`

````typescript
export class JSONRepair {
  /**
   * 尝试修复损坏的JSON字符串
   */
  static repair(jsonString: string): string | null {
    // 1. 尝试直接解析
    try {
      JSON.parse(jsonString);
      return jsonString;
    } catch (e) {
      // 继续修复
    }

    // 2. 提取JSON部分（去除markdown标记等）
    let repaired = this.extractJSON(jsonString);

    // 3. 修复常见错误
    repaired = this.fixQuotes(repaired);
    repaired = this.fixBrackets(repaired);
    repaired = this.fixTrailingCommas(repaired);

    // 4. 验证修复结果
    try {
      JSON.parse(repaired);
      return repaired;
    } catch (e) {
      return null;
    }
  }

  private static extractJSON(str: string): string {
    // 提取 ```json ... ``` 中的内容
    const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) return codeBlockMatch[1].trim();

    // 提取 { ... } 或 [ ... ] 中的内容
    const objectMatch = str.match(/(\{[\s\S]*\})/);
    if (objectMatch) return objectMatch[1].trim();

    const arrayMatch = str.match(/(\[[\s\S]*\])/);
    if (arrayMatch) return arrayMatch[1].trim();

    return str.trim();
  }

  private static fixQuotes(str: string): string {
    // 单引号转双引号
    return str.replace(/'/g, '"');
  }

  private static fixBrackets(str: string): string {
    // 平衡括号
    let openBraces = 0;
    let openBrackets = 0;

    for (const char of str) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }

    // 补充缺失的闭合括号
    while (openBraces > 0) {
      str += '}';
      openBraces--;
    }
    while (openBrackets > 0) {
      str += ']';
      openBrackets--;
    }

    return str;
  }

  private static fixTrailingCommas(str: string): string {
    // 移除尾随逗号
    return str.replace(/,(\s*[}\]])/g, '$1');
  }
}
````

**修改文件**: `services/scriptParser.ts`

在解析JSON的地方添加修复逻辑：

```typescript
// 原有代码
const data = JSON.parse(content);

// 修改为
import { JSONRepair } from './JSONRepair';

let data;
try {
  data = JSON.parse(content);
} catch (e) {
  const repaired = JSONRepair.repair(content);
  if (repaired) {
    data = JSON.parse(repaired);
  } else {
    throw new Error('JSON解析失败且无法修复');
  }
}
```

#### 3.1.3 向后兼容

- 纯新增模块，不影响现有逻辑
- 修复失败时抛出异常，行为与原来一致

#### 3.1.4 回退方案

- 删除 `JSONRepair.repair` 调用
- 恢复原有直接 `JSON.parse` 逻辑

---

### Module 2: 语义分块模块

#### 3.2.1 设计目标

- 智能识别章节/场景边界
- 保留叙事逻辑完整性
- 提取分块元数据

#### 3.2.2 实现方案

**修改文件**: `types.ts` (扩展类型定义)

```typescript
// 新增类型定义
export interface SemanticChunk {
  id: string;
  content: string;
  prevContext: string;
  metadata: {
    characters: string[];
    sceneHint: string;
    importance: number; // 0-10
    wordCount: number;
  };
}
```

**修改文件**: `services/scriptParser.ts` (新增语义分块方法)

```typescript
/**
 * 语义分块 - 基于章节/段落/句子边界
 * 保留原有 chunkText 作为 fallback
 */
private async semanticChunk(content: string): Promise<SemanticChunk[]> {
  const chunks: SemanticChunk[] = [];

  // 1. 识别章节边界 (【第一章】、第一章、CHAPTER 1 等)
  const chapterPattern = /(?:【第[一二三四五六七八九十百千万]+章】|第[一二三四五六七八九十百千万]+章|CHAPTER\s+\d+|Chapter\s+\d+)/g;

  // 2. 识别场景转换 (时间/地点变化)
  const scenePatterns = [
    /(?:次日|第二天|几天后|不久|与此同时|另一边)/,
    /(?:清晨|早晨|上午|中午|下午|傍晚|晚上|深夜|午夜)/,
    /(?:场景转换|镜头切换)/,
  ];

  // 3. 基于边界分块
  const boundaries = this.identifyBoundaries(content, chapterPattern, scenePatterns);

  // 4. 生成 SemanticChunk
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1] || content.length;
    const chunkContent = content.slice(start, end).trim();

    if (chunkContent.length === 0) continue;

    // 提取前200字作为上下文
    const prevContext = start > 0
      ? content.slice(Math.max(0, start - 200), start)
      : '';

    chunks.push({
      id: `chunk_${i}`,
      content: chunkContent,
      prevContext,
      metadata: await this.extractChunkMetadata(chunkContent),
    });
  }

  return chunks.length > 0 ? chunks : this.fallbackToTextChunk(content);
}

/**
 * 提取分块元数据
 */
private async extractChunkMetadata(content: string): Promise<SemanticChunk['metadata']> {
  // 简单规则提取（无需AI调用）
  const characters = this.extractCharacterNames(content);
  const sceneHint = this.extractSceneHint(content);
  const importance = this.calculateImportance(content);

  return {
    characters,
    sceneHint,
    importance,
    wordCount: content.length,
  };
}

/**
 * 计算分块重要性
 */
private calculateImportance(content: string): number {
  let score = 5; // 基础分

  // 对话多 → 重要
  const dialogueMatches = content.match(/["""'][\s\S]*?["""']/g);
  if (dialogueMatches && dialogueMatches.length > 3) score += 1;

  // 情绪词多 → 重要
  const emotionWords = /[愤怒喜哀乐悲惊恐慌]/g;
  const emotionMatches = content.match(emotionWords);
  if (emotionMatches && emotionMatches.length > 5) score += 1;

  // 动作描写多 → 重要
  const actionWords = /[打杀走跑跳说喊叫]/g;
  const actionMatches = content.match(actionWords);
  if (actionMatches && actionMatches.length > 5) score += 1;

  return Math.min(10, Math.max(1, score));
}

/**
 * Fallback: 使用原有分块逻辑
 */
private fallbackToTextChunk(content: string): SemanticChunk[] {
  const chunks = this.chunkText(content, CONFIG.maxChunkSize);
  return chunks.map((content, i) => ({
    id: `chunk_${i}`,
    content,
    prevContext: i > 0 ? chunks[i - 1].slice(-200) : '',
    metadata: {
      characters: [],
      sceneHint: '',
      importance: 5,
      wordCount: content.length,
    },
  }));
}
```

#### 3.2.3 向后兼容

- 保留原有 `chunkText` 方法
- 新增 `semanticChunk` 方法
- 通过配置切换：`useSemanticChunk: true/false`

#### 3.2.4 回退方案

- 设置 `useSemanticChunk: false`
- 使用原有 `chunkText` 方法

---

### Module 3: 模型路由模块

#### 3.3.1 设计目标

- 按任务类型选择最优模型
- 降低解析成本 40%
- 支持模型降级

#### 3.3.2 实现方案

**新增文件**: `services/ModelRouter.ts`

```typescript
import { ModelConfig } from '../types';
import { LLMProvider } from './ai/providers/LLMProvider';

export type TaskType = 'metadata' | 'character' | 'scene' | 'shot' | 'validation';

interface ModelRoute {
  primary: string; // 主模型
  fallbacks: string[]; // 备用模型链
  maxTokens: number;
  temperature: number;
}

const MODEL_ROUTES: Record<TaskType, ModelRoute> = {
  // 元数据提取 - 简单任务，用便宜模型
  metadata: {
    primary: 'gpt-4o-mini',
    fallbacks: ['deepseek-chat', 'qwen-turbo'],
    maxTokens: 2000,
    temperature: 0.3,
  },

  // 角色分析 - 需要创意，用中等模型
  character: {
    primary: 'gpt-4o',
    fallbacks: ['claude-3-sonnet', 'kimi'],
    maxTokens: 4000,
    temperature: 0.5,
  },

  // 场景分析 - 类似角色
  scene: {
    primary: 'gpt-4o',
    fallbacks: ['claude-3-sonnet', 'kimi'],
    maxTokens: 4000,
    temperature: 0.5,
  },

  // 分镜生成 - 需要高创意
  shot: {
    primary: 'gpt-4o',
    fallbacks: ['claude-3-opus', 'kimi'],
    maxTokens: 6000,
    temperature: 0.7,
  },

  // 验证/修复 - 简单任务
  validation: {
    primary: 'gpt-4o-mini',
    fallbacks: ['deepseek-chat'],
    maxTokens: 2000,
    temperature: 0.3,
  },
};

export class ModelRouter {
  private llmProvider = new LLMProvider();
  private modelConfigs: Map<string, ModelConfig> = new Map();

  /**
   * 注册模型配置
   */
  registerModel(config: ModelConfig): void {
    this.modelConfigs.set(config.modelId, config);
  }

  /**
   * 路由并执行请求
   */
  async route(
    taskType: TaskType,
    prompt: string,
    systemPrompt?: string
  ): Promise<{
    content: string;
    modelUsed: string;
    tokensUsed: { input: number; output: number };
  }> {
    const route = MODEL_ROUTES[taskType];
    const modelChain = [route.primary, ...route.fallbacks];

    for (const modelId of modelChain) {
      const config = this.modelConfigs.get(modelId);
      if (!config) continue;

      try {
        const result = await this.llmProvider.generateText(prompt, config, systemPrompt, {
          maxTokens: route.maxTokens,
          temperature: route.temperature,
        });

        if (result.success) {
          return {
            content: result.data as string,
            modelUsed: modelId,
            tokensUsed: result.metadata?.usage || { input: 0, output: 0 },
          };
        }

        console.warn(`[ModelRouter] Model ${modelId} failed:`, result.error);
      } catch (error) {
        console.warn(`[ModelRouter] Model ${modelId} error:`, error);
      }
    }

    throw new Error(`All models failed for task ${taskType}`);
  }

  /**
   * 获取路由决策（用于预估）
   */
  getRouteDecision(taskType: TaskType): ModelRoute {
    return MODEL_ROUTES[taskType];
  }
}
```

**修改文件**: `services/scriptParser.ts`

```typescript
// 新增导入
import { ModelRouter, TaskType } from './ModelRouter';

export class ScriptParser {
  private modelRouter = new ModelRouter();
  private useModelRouter = true; // 可通过配置控制

  constructor() {
    // 注册可用模型
    this.registerAvailableModels();
  }

  private registerAvailableModels() {
    // 从 settings 中读取模型配置并注册
    const settings = storageService.getSettings();
    settings.models.filter(m => m.type === 'llm').forEach(m => this.modelRouter.registerModel(m));
  }

  /**
   * 修改原有的LLM调用，使用路由
   */
  private async callLLM(
    taskType: TaskType,
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    if (!this.useModelRouter) {
      // 回退到原有逻辑
      return this.callLLMLegacy(prompt, systemPrompt);
    }

    const result = await this.modelRouter.route(taskType, prompt, systemPrompt);
    return result.content;
  }

  // 保留原有调用逻辑作为 fallback
  private async callLLMLegacy(prompt: string, systemPrompt?: string): Promise<string> {
    // ... 原有实现
  }
}
```

#### 3.3.3 向后兼容

- 保留原有 `callLLM` 逻辑作为 `callLLMLegacy`
- 通过 `useModelRouter` 配置切换
- 模型未注册时自动回退

#### 3.3.4 回退方案

- 设置 `useModelRouter: false`
- 使用原有 `callLLMLegacy` 方法

---

### Module 4: 子任务级状态管理

#### 3.4.1 设计目标

- 实现子任务级断点续传
- 精准失败重试
- 不重复执行已完成任务

#### 3.4.2 实现方案

**修改文件**: `types.ts` (扩展类型)

```typescript
// 新增子任务状态类型
export interface SubTaskState {
  id: string; // 如 "char_林黛玉", "scene_大观园"
  type: 'character' | 'scene' | 'shot' | 'item';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  retryCount: number;
  startTime?: number;
  endTime?: number;
}

// 扩展 ScriptParseState
export interface ScriptParseState {
  stage: ParseStage;
  progress: number;
  metadata?: ScriptMetadata;
  characters?: ScriptCharacter[];
  scenes?: ScriptScene[];
  items?: ScriptItem[];
  shots?: Shot[];
  error?: string;
  currentChunkIndex?: number;
  totalChunks?: number;
  // 新增字段（可选，向后兼容）
  subTasks?: SubTaskState[];
  version?: number; // 状态版本，用于迁移
}
```

**修改文件**: `services/scriptParser.ts`

```typescript
export class ScriptParser {
  private subTaskConcurrency = 3; // 子任务并发数

  /**
   * 主解析流程 - 支持断点续传
   */
  async parseScript(
    scriptId: string,
    projectId: string,
    content: string,
    onProgress?: (stage: ParseStage, progress: number, message?: string) => void
  ): Promise<ScriptParseState> {
    // 1. 尝试恢复状态
    let state = await this.loadState(scriptId, projectId);

    if (state && state.stage !== 'completed') {
      onProgress?.(state.stage, state.progress, `从 ${state.stage} 阶段恢复...`);
      return this.resumeParse(state, content, onProgress);
    }

    // 2. 新解析流程
    state = this.createInitialState();

    // ... 原有解析逻辑，但使用子任务管理

    return state;
  }

  /**
   * 恢复解析
   */
  private async resumeParse(
    state: ScriptParseState,
    content: string,
    onProgress?: ParseProgressCallback
  ): Promise<ScriptParseState> {
    if (!state.subTasks || state.subTasks.length === 0) {
      // 旧版本状态，使用原有逻辑
      return this.parseScript(state.id, state.projectId!, content, onProgress);
    }

    // 找出未完成的子任务
    const pendingTasks = state.subTasks.filter(
      t => t.status === 'pending' || t.status === 'failed'
    );

    // 并行执行未完成任务
    const limit = pLimit(this.subTaskConcurrency);
    await Promise.all(
      pendingTasks.map(task => limit(() => this.executeSubTask(task, state, content, onProgress)))
    );

    return state;
  }

  /**
   * 执行子任务
   */
  private async executeSubTask(
    task: SubTaskState,
    state: ScriptParseState,
    content: string,
    onProgress?: ParseProgressCallback
  ): Promise<void> {
    // 检查重试次数
    if (task.retryCount >= CONFIG.maxRetries) {
      task.status = 'failed';
      task.error = '超过最大重试次数';
      await this.saveState(state);
      return;
    }

    task.status = 'processing';
    task.startTime = Date.now();
    task.retryCount++;
    await this.saveState(state);

    try {
      // 根据任务类型执行
      switch (task.type) {
        case 'character':
          task.result = await this.parseCharacter(content, task.id.replace('char_', ''));
          break;
        case 'scene':
          task.result = await this.parseScene(content, task.id.replace('scene_', ''));
          break;
        // ... 其他类型
      }

      task.status = 'completed';
      task.endTime = Date.now();
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : '未知错误';
      task.endTime = Date.now();
    }

    await this.saveState(state);
  }

  /**
   * 创建子任务
   */
  private createSubTasks(
    type: 'character' | 'scene' | 'shot' | 'item',
    items: string[]
  ): SubTaskState[] {
    return items.map((item, index) => ({
      id: `${type}_${item}`,
      type,
      status: 'pending',
      retryCount: 0,
    }));
  }

  /**
   * 保存状态
   */
  private async saveState(state: ScriptParseState): Promise<void> {
    await storageService.updateScriptParseState(state.id, state.projectId!, () => state);
  }

  /**
   * 加载状态
   */
  private async loadState(scriptId: string, projectId: string): Promise<ScriptParseState | null> {
    const script = await storageService.getScript(scriptId, projectId);
    return script?.parseState || null;
  }
}

// 简单的并发限制器
import pLimit from 'p-limit';
```

#### 3.4.3 向后兼容

- `subTasks` 字段为可选
- 旧版本状态无 `subTasks` 时，使用原有逻辑
- 新增 `version` 字段用于状态迁移

#### 3.4.4 回退方案

- 忽略 `subTasks` 字段
- 使用原有阶段级解析逻辑

---

## 四、Phase 2: 效率优化方案

### Module 5: 多级缓存系统

#### 4.1 设计目标

- 使用 IndexedDB 实现三级缓存
- 降低重复解析成本
- 缓存命中率 > 60%

#### 4.2 实现方案

**新增文件**: `services/MultiLevelCache.ts`

```typescript
// 使用 IndexedDB 替代 Redis
const DB_NAME = 'ScriptParserCache';
const DB_VERSION = 1;

interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
}

export class MultiLevelCache {
  private db: IDBDatabase | null = null;
  private memoryCache = new Map<string, CacheEntry<any>>();

  // L1: 内存缓存 (TTL: 1小时)
  private l1TTL = 60 * 60 * 1000;

  // L2: IndexedDB 缓存 (TTL: 24小时)
  private l2TTL = 24 * 60 * 60 * 1000;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('l2_cache')) {
          db.createObjectStore('l2_cache', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('l3_cache')) {
          db.createObjectStore('l3_cache', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string, level: 1 | 2 | 3 = 1): Promise<T | null> {
    // L1: 内存
    if (level >= 1) {
      const l1Entry = this.memoryCache.get(key);
      if (l1Entry && Date.now() - l1Entry.timestamp < l1Entry.ttl) {
        return l1Entry.data;
      }
    }

    // L2: IndexedDB
    if (level >= 2 && this.db) {
      const l2Entry = await this.getFromDB('l2_cache', key);
      if (l2Entry && Date.now() - l2Entry.timestamp < l2Entry.ttl) {
        // 回填L1
        this.memoryCache.set(key, l2Entry);
        return l2Entry.data;
      }
    }

    return null;
  }

  /**
   * 设置缓存
   */
  async set<T>(key: string, data: T, level: 1 | 2 | 3 = 1): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      ttl: level === 1 ? this.l1TTL : this.l2TTL,
    };

    if (level >= 1) {
      this.memoryCache.set(key, entry);
    }

    if (level >= 2 && this.db) {
      await this.setToDB('l2_cache', entry);
    }
  }

  private async getFromDB<T>(storeName: string, key: string): Promise<CacheEntry<T> | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async setToDB<T>(storeName: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
```

---

### Module 6: RAG检索系统

#### 4.3 设计目标

- 基于语义检索相关文本片段
- 提升角色/场景分析质量
- 减少Token消耗

#### 4.4 实现方案

**新增文件**: `services/RAGRetriever.ts`

```typescript
// 轻量级实现，使用简单的向量相似度
// 如需完整功能，可后续集成 ChromaDB

interface TextChunk {
  id: string;
  content: string;
  embedding?: number[];
  metadata: {
    characters: string[];
    sceneHint: string;
    importance: number;
  };
}

export class RAGRetriever {
  private chunks: TextChunk[] = [];

  /**
   * 索引文本
   */
  async index(content: string, semanticChunks: SemanticChunk[]): Promise<void> {
    this.chunks = semanticChunks.map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      metadata: chunk.metadata,
    }));

    // 简化版：使用关键词匹配代替向量嵌入
    // 如需完整向量检索，可后续集成 embedding 模型
  }

  /**
   * 检索角色相关片段
   */
  async retrieveForCharacter(characterName: string, topK: number = 5): Promise<TextChunk[]> {
    // 基于关键词和重要性排序
    const scored = this.chunks.map(chunk => {
      let score = 0;

      // 包含角色名
      if (chunk.content.includes(characterName)) score += 10;
      if (chunk.metadata.characters.includes(characterName)) score += 5;

      // 重要性加权
      score += chunk.metadata.importance;

      // 外貌/动作描写
      const descriptionPatterns = /[貌相颜容身着穿戴]/g;
      const descMatches = chunk.content.match(descriptionPatterns);
      if (descMatches) score += descMatches.length;

      return { chunk, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.chunk);
  }

  /**
   * 检索场景相关片段
   */
  async retrieveForScene(sceneName: string, topK: number = 5): Promise<TextChunk[]> {
    const scored = this.chunks.map(chunk => {
      let score = 0;

      if (chunk.content.includes(sceneName)) score += 10;
      if (chunk.metadata.sceneHint.includes(sceneName)) score += 5;
      score += chunk.metadata.importance;

      return { chunk, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.chunk);
  }
}
```

---

## 五、Phase 3: 业务优化（需确认）

### 待确认问题

1. **短剧规则引擎**
   - 系统是否专门用于短剧制作？
   - 是否需要强制黄金3秒规则？
   - 是否需要单集时长限制(60-180秒)？

2. **人工确认UI**
   - 是否需要导演确认角色/场景设定？
   - 确认流程的UI设计需求？
   - 确认后锁定机制的具体要求？

3. **资产相似度匹配**
   - 是否需要自动推荐相似资产？
   - 相似度阈值设置要求？

---

## 六、实施计划

### Phase 1 实施顺序 (2-3小时)

1. **JSON修复** (0.5h)
   - 创建 `services/JSONRepair.ts`
   - 集成到 `scriptParser.ts`
   - 编写单元测试

2. **语义分块** (0.5h)
   - 扩展 `types.ts`
   - 实现 `semanticChunk` 方法
   - 添加 fallback 机制

3. **模型路由** (0.5h)
   - 创建 `services/ModelRouter.ts`
   - 修改 `scriptParser.ts` 使用路由
   - 注册可用模型

4. **子任务状态** (0.5h)
   - 扩展 `types.ts`
   - 实现子任务管理
   - 实现断点续传

### 每个模块交付物

1. **代码文件**
   - 新增/修改的文件列表
   - 代码变更说明

2. **测试用例**
   - 单元测试代码
   - 测试运行命令

3. **回退方案**
   - 如何禁用新功能
   - 如何恢复原有逻辑

4. **效果验证**
   - 性能指标对比
   - 功能验证方法

---

## 七、风险管控

### 7.1 向后兼容保证

| 模块       | 兼容策略             | 回退方式                     |
| ---------- | -------------------- | ---------------------------- |
| JSON修复   | 纯新增，失败时抛异常 | 删除调用                     |
| 语义分块   | 保留原方法，配置切换 | 设置 useSemanticChunk: false |
| 模型路由   | 保留原逻辑，配置切换 | 设置 useModelRouter: false   |
| 子任务状态 | 新增字段为可选       | 忽略 subTasks 字段           |
| 多级缓存   | 缓存miss走正常流程   | 禁用缓存                     |
| RAG检索    | 可选模块，配置开关   | 关闭RAG                      |

### 7.2 测试策略

1. **单元测试**
   - 每个新增模块独立测试
   - 覆盖率 > 80%

2. **集成测试**
   - 完整解析流程测试
   - 新旧逻辑对比测试

3. **回归测试**
   - 现有功能不受影响
   - 旧数据格式兼容

---

## 八、预期效果

### Phase 1 完成后

| 指标       | 当前   | 优化后   | 提升    |
| ---------- | ------ | -------- | ------- |
| 解析成功率 | 85%    | 99%+     | +14%    |
| 解析成本   | ¥25-30 | ¥15-18   | -40%    |
| 断点续传   | 阶段级 | 子任务级 | 精准度↑ |
| 向后兼容   | -      | 100%     | -       |

### Phase 2 完成后

| 指标         | 优化后   |
| ------------ | -------- |
| 缓存命中率   | > 60%    |
| 重复解析成本 | 0        |
| 解析质量     | 显著提升 |

---

**方案版本**: v1.0  
**制定日期**: 2026-02-21  
**适用范围**: AI影视资产生成平台 - 小说解析模块
