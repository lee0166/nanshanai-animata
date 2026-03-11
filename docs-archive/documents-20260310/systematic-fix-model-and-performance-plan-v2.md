# 系统性修复模型配置与解析性能问题 (V2 - 优化版)

> **文档状态**: 实施中 (采纳专业反馈后优化)  
> **创建时间**: 2026-03-07  
> **预计工期**: 13天  
> **核心改进**: 彻底消除硬编码、强化错误暴露、完善边界处理

---

## 一、问题根因分析 (V2)

### 1.1 当前架构问题图谱

```
┌─────────────────────────────────────────────────────────────────┐
│                        问题根因分析                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐      ┌─────────────────────┐          │
│  │ 模型配置层          │      │ 解析执行层          │          │
│  │ ─────────────────── │      │ ─────────────────── │          │
│  │ • MODEL_LIMITS 硬编码│─────→│ • 无法正确限制      │          │
│  │ • Provider传递断裂  │─────→│ • 使用'llm' provider│         │
│  │ • 运行时无校验      │─────→│ • 配置错误被掩盖    │          │
│  └─────────────────────┘      └─────────────────────┘          │
│           │                            │                       │
│           ↓                            ↓                       │
│  ┌─────────────────────┐      ┌─────────────────────┐          │
│  │ 性能问题层          │      │ 用户体验层          │          │
│  │ ─────────────────── │      │ ─────────────────── │          │
│  │ • 串行调用过多      │      │ • 解析速度慢        │          │
│  │ • 无并发控制        │      │ • 控制台警告刷屏    │          │
│  │ • 缓存设计缺陷      │      │ • 配置难以理解      │          │
│  └─────────────────────┘      └─────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 核心问题清单 (V2)

| 优先级 | 问题                  | 根因                      | 影响范围       | 解决方案               |
| ------ | --------------------- | ------------------------- | -------------- | ---------------------- |
| P0     | MODEL_LIMITS 硬编码   | 代码层维护配置表          | 所有模型调用   | 从config/models.ts读取 |
| P0     | Provider 被掩盖       | 默认值兜底 + 无运行时校验 | 模型能力查询   | 移除兜底 + 枚举校验    |
| P1     | 串行调用无并发控制    | 架构设计缺失              | 全局上下文提取 | 添加p-limit控制        |
| P1     | 缓存键冲突 + 内存泄漏 | 设计缺陷                  | 缓存功能       | LRU + 完整哈希         |
| P2     | 日志噪音              | 日志级别不当              | 开发体验       | 级别调整 + 去重        |

---

## 二、系统性修复方案 (V2)

### 2.1 架构级修复: 彻底消除硬编码 (采纳反馈)

#### 原方案问题

- `inferMaxTokens` 通过关键词推断，只是换了硬编码位置
- 新增模型仍需修改代码

#### V2 修复方案: 从配置文件直接读取

```typescript
// services/ai/core/ModelCapabilityManager.ts

import { LLM_MODELS } from '../../../config/models';
import type { ModelConfig } from '../../../types';

export interface ModelLimits {
  provider: string;
  modelId: string;
  maxTokens: number;
  maxInputTokens: number;
}

/**
 * 从模型配置直接读取限制参数
 * 彻底消除硬编码，新增模型只需修改 config/models.ts
 */
export function getModelLimitsFromConfig(modelId: string): ModelLimits | null {
  const model = LLM_MODELS.find(m => m.modelId === modelId);

  if (!model) {
    console.warn(`[ModelCapabilityManager] Model not found in config: ${modelId}`);
    return null;
  }

  // 空值保护
  const maxTokens = model.parameters?.find(p => p.name === 'maxTokens')?.defaultValue ?? 4096;
  const maxInputTokens = model.capabilities?.maxContextLength ?? 32768;

  return {
    provider: model.provider,
    modelId: model.modelId,
    maxTokens,
    maxInputTokens,
  };
}

/**
 * 完全移除硬编码的 MODEL_LIMITS 数组
 * 所有能力查询都通过 getModelLimitsFromConfig
 */

// 计算有效 maxTokens
export function calculateEffectiveMaxTokens(
  modelId: string,
  requestedTokens: number
): {
  effectiveTokens: number;
  wasLimited: boolean;
  maxAllowed: number;
  modelFound: boolean;
} {
  // 保护逻辑：确保 requestedTokens 至少为 1
  if (!Number.isFinite(requestedTokens) || requestedTokens < 1) {
    console.warn(
      `[ModelCapabilityManager] Invalid requestedTokens: ${requestedTokens}. Using minimum value of 1.`
    );
    requestedTokens = 1;
  }

  const limits = getModelLimitsFromConfig(modelId);

  // 未找到模型配置 - 使用安全默认值
  if (!limits) {
    const safeTokens = Math.min(requestedTokens, 4096); // 安全上限
    console.warn(
      `[ModelCapabilityManager] Unknown model: ${modelId}. Using safe default: ${safeTokens}`
    );
    return {
      effectiveTokens: safeTokens,
      wasLimited: requestedTokens > 4096,
      maxAllowed: 4096,
      modelFound: false,
    };
  }

  const maxAllowed = limits.maxTokens;

  // 请求值在限制范围内
  if (requestedTokens <= maxAllowed) {
    return {
      effectiveTokens: requestedTokens,
      wasLimited: false,
      maxAllowed,
      modelFound: true,
    };
  }

  // 超出限制，进行限制
  console.warn(
    `[ModelCapabilityManager] Token limit exceeded for ${modelId}: ${requestedTokens} > ${maxAllowed}. Using ${maxAllowed}.`
  );
  return {
    effectiveTokens: maxAllowed,
    wasLimited: true,
    maxAllowed,
    modelFound: true,
  };
}
```

**优势**:

- ✅ 新增模型只需修改 `config/models.ts`
- ✅ 无代码层硬编码
- ✅ 与现有配置系统完全一致
- ✅ 空值保护防止运行时错误

---

### 2.2 架构级修复: Provider 运行时枚举校验 (采纳反馈)

#### 原方案问题

- `provider: string` 类型太宽松
- `|| 'volcengine'` 默认值掩盖错误
- 仅在 AIService 层校验，未形成闭环

#### V2 修复方案: 端到端枚举校验

```typescript
// services/ai/types.ts

/**
 * 支持的 AI 提供商枚举
 * 使用 const assertion 确保类型安全
 */
export const PROVIDER_ENUM = {
  VOLCENGINE: 'volcengine',
  DEEPSEEK: 'deepseek',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  ALIYUN: 'aliyun',
  MODELSCOPE: 'modelscope',
} as const;

export type ProviderType = (typeof PROVIDER_ENUM)[keyof typeof PROVIDER_ENUM];

/**
 * 有效的 provider 值数组
 */
export const VALID_PROVIDERS: string[] = Object.values(PROVIDER_ENUM);

/**
 * 校验 provider 是否有效
 * 无效时抛出明确错误，不掩盖
 */
export function validateProvider(provider: string): ProviderType {
  if (!VALID_PROVIDERS.includes(provider)) {
    throw new Error(
      `Invalid provider: "${provider}". ` + `Expected one of: ${VALID_PROVIDERS.join('/')}`
    );
  }
  return provider as ProviderType;
}
```

```typescript
// services/scriptParser.ts - 调用链每个节点校验

export class ScriptParser {
  private provider: ProviderType; // 使用严格类型

  constructor(
    apiKey: string,
    apiUrl: string = 'https://api.openai.com/v1',
    model: string = CONFIG.defaultModel,
    provider: string, // 接收字符串，立即校验
    config: Partial<ScriptParserConfig> = {}
  ) {
    // 首次校验：无效时立即抛出，不掩盖
    this.provider = validateProvider(provider);
    // ...
  }

  private async callLLM(...): Promise<string> {
    const config = {
      // ...
      provider: this.provider, // 使用已校验的值
      // ...
    };
    // 调用 AIService，它会再次校验
  }
}
```

```typescript
// services/ai/AIService.ts - 二次校验

class AIService {
  async callLLM(prompt: string, config: ModelConfig): Promise<AIResult> {
    // 二次校验：确保传入的 provider 有效
    validateProvider(config.provider);

    const provider = this.getProvider(config.provider);
    return provider.generateText(prompt, config);
  }
}
```

```typescript
// services/ai/providers/LLMProvider.ts - 三次校验，形成闭环

class LLMProvider {
  async generateText(prompt: string, config: ModelConfig): Promise<AIResult> {
    // 三次校验：最终防线
    validateProvider(config.provider);

    const tokenLimit = calculateEffectiveMaxTokens(
      config.modelId,
      maxTokens
      // 不再传递 provider，因为已经从 config 读取
    );
    // ...
  }
}
```

**优势**:

- ✅ 无效 provider 立即抛出明确错误
- ✅ 端到端三次校验，形成闭环
- ✅ 类型安全 + 运行时安全
- ✅ 不掩盖任何配置错误

---

### 2.3 架构级修复: 并行化 + 并发控制 (采纳反馈)

#### 原方案问题

- 串行调用 3-4 次 LLM 提取全局上下文
- 无并发控制，可能触发限流

#### V2 修复方案: p-limit 控制并发

```typescript
// services/scriptParser.ts

import pLimit from 'p-limit';

// 最大并发数配置
const MAX_PARALLEL_CALLS = 3;

class ScriptParser {
  private parallelLimit = pLimit(MAX_PARALLEL_CALLS);

  /**
   * 并行提取全局上下文，带并发控制
   * 使用 Promise.allSettled 容错，单个失败不影响整体
   */
  async extractGlobalContextParallel(content: string): Promise<GlobalContext> {
    console.log('[ScriptParser] Extracting global context in parallel (max concurrency: 3)...');

    const startTime = Date.now();

    // 定义提取任务
    const tasks = [
      {
        name: 'story',
        fn: () => this.extractStoryContext(content),
        default: DEFAULT_STORY_CONTEXT,
      },
      {
        name: 'visual',
        fn: () => this.extractVisualContext(content),
        default: DEFAULT_VISUAL_CONTEXT,
      },
      {
        name: 'era',
        fn: () => this.extractEraContext(content),
        default: DEFAULT_ERA_CONTEXT,
      },
    ];

    // 并行执行，带并发控制
    const results = await Promise.allSettled(
      tasks.map(task =>
        this.parallelLimit(async () => {
          try {
            const result = await task.fn();
            console.log(`[ScriptParser] ${task.name} context extracted successfully`);
            return result;
          } catch (error) {
            console.error(`[ScriptParser] ${task.name} context extraction failed:`, error);
            throw error;
          }
        })
      )
    );

    // 处理结果，失败时使用默认值
    const context: GlobalContext = {
      story: results[0].status === 'fulfilled' ? results[0].value : tasks[0].default,
      visual: results[1].status === 'fulfilled' ? results[1].value : tasks[1].default,
      era: results[2].status === 'fulfilled' ? results[2].value : tasks[2].default,
    };

    // 记录失败
    const failures = results
      .map((r, i) => ({ ...r, name: tasks[i].name }))
      .filter(r => r.status === 'rejected');

    if (failures.length > 0) {
      console.warn(
        `[ScriptParser] ${failures.length} context extractions failed, using defaults:`,
        failures.map(f => f.name)
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[ScriptParser] Global context extracted in ${duration}ms`);

    return context;
  }
}

// 默认值定义
const DEFAULT_STORY_CONTEXT = {
  genre: '',
  theme: '',
  tone: '',
  targetAudience: '',
};

const DEFAULT_VISUAL_CONTEXT = {
  artDirection: '',
  artStyle: '',
  colorPalette: [],
  cinematography: '',
};

const DEFAULT_ERA_CONTEXT = {
  era: '',
  location: '',
  season: '',
  timeOfDay: '',
};
```

**优势**:

- ✅ 并行执行，速度提升 2-3 倍
- ✅ 最大并发数 3，防止限流
- ✅ 单个失败不影响整体，使用默认值降级
- ✅ 详细的日志记录

---

### 2.4 架构级修复: LRU 缓存 + 完整哈希 (采纳反馈)

#### 原方案问题

- 前1000字哈希可能冲突
- 简单 Map 无容量限制，内存泄漏
- 未关联模型配置

#### V2 修复方案: LRU 缓存

```typescript
// services/parsing/GlobalContextCache.ts

import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';

interface CachedContext {
  context: GlobalContext;
  timestamp: number;
  modelId: string;
  provider: string;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * 全局上下文 LRU 缓存
 * 解决内存泄漏和缓存冲突问题
 */
export class GlobalContextCache {
  private cache: LRUCache<string, CachedContext>;
  private stats = { hits: 0, misses: 0 };

  constructor() {
    this.cache = new LRUCache({
      max: 1000, // 最大1000条
      ttl: 1000 * 60 * 60, // 1小时TTL
      updateAgeOnGet: true, // 访问时更新年龄
      allowStale: false, // 不允许返回过期数据
      dispose: (value, key) => {
        console.log(`[GlobalContextCache] Evicted: ${key.slice(0, 16)}...`);
      },
    });
  }

  /**
   * 生成缓存键
   * 使用完整内容哈希 + 模型ID + provider，确保唯一性
   */
  private generateKey(content: string, modelId: string, provider: string): string {
    // 完整内容哈希，避免冲突
    const contentHash = createHash('md5').update(content).digest('hex');
    return `${contentHash}:${modelId}:${provider}`;
  }

  /**
   * 获取或提取全局上下文
   */
  async getOrExtract(
    content: string,
    modelId: string,
    provider: string,
    extractor: () => Promise<GlobalContext>
  ): Promise<GlobalContext> {
    const key = this.generateKey(content, modelId, provider);

    const cached = this.cache.get(key);
    if (cached) {
      this.stats.hits++;
      console.log(
        `[GlobalContextCache] Hit: ${key.slice(0, 16)}... (hit rate: ${this.getHitRate().toFixed(2)}%)`
      );
      return cached.context;
    }

    this.stats.misses++;
    console.log(`[GlobalContextCache] Miss: ${key.slice(0, 16)}...`);

    const context = await extractor();
    this.cache.set(key, {
      context,
      timestamp: Date.now(),
      modelId,
      provider,
    });

    return context;
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.getHitRate(),
    };
  }

  private getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
    console.log('[GlobalContextCache] Cleared');
  }
}

// 单例导出
export const globalContextCache = new GlobalContextCache();
```

**优势**:

- ✅ 完整 MD5 哈希，零冲突
- ✅ 关联 modelId 和 provider
- ✅ LRU 自动淘汰，无内存泄漏
- ✅ 命中率监控

---

### 2.5 架构级修复: 自适应解析策略 (简化版)

#### 决策说明

- 采纳反馈：不增加"文本复杂度"判断（过度设计）
- 当前项目场景下，字数判断已覆盖 90% 情况

#### V2 修复方案: 简化策略

```typescript
// services/scriptParser.ts

interface ParseStrategy {
  globalContextMode: 'full' | 'minimal' | 'skip';
  shouldUseSemanticChunking: boolean;
  shouldUseIterativeRefinement: boolean;
  maxParallelCalls: number;
}

class AdaptiveParser {
  /**
   * 根据文本长度选择解析策略
   * 简化版：仅以字数判断，不增加复杂度计算
   */
  selectStrategy(contentLength: number): ParseStrategy {
    if (contentLength < 1000) {
      // 短文本：简化全局上下文（1次调用）
      return {
        globalContextMode: 'minimal', // 改为简化而非跳过
        shouldUseSemanticChunking: false,
        shouldUseIterativeRefinement: false,
        maxParallelCalls: 2,
      };
    }

    if (contentLength < 10000) {
      // 中等文本：标准流程
      return {
        globalContextMode: 'full',
        shouldUseSemanticChunking: false,
        shouldUseIterativeRefinement: false,
        maxParallelCalls: 3,
      };
    }

    // 长文本：完整流程
    return {
      globalContextMode: 'full',
      shouldUseSemanticChunking: true,
      shouldUseIterativeRefinement: true,
      maxParallelCalls: 3,
    };
  }

  /**
   * 简化版全局上下文提取
   * 短文本时只调用1次LLM提取核心信息
   */
  async extractMinimalGlobalContext(content: string): Promise<GlobalContext> {
    const prompt = `从以下短文本中提取核心背景信息（时代、地点、基调）：

${content.substring(0, 500)}

请以JSON格式返回：
{
  "era": "时代（如：现代、古代、未来）",
  "location": "地点",
  "tone": "基调（如：轻松、紧张、悬疑）"
}`;

    const result = await this.callLLM(prompt, 'metadata');
    const parsed = JSON.parse(result);

    return {
      story: { genre: '', theme: '', tone: parsed.tone || '', targetAudience: '' },
      visual: { artDirection: '', artStyle: '', colorPalette: [], cinematography: '' },
      era: { era: parsed.era || '', location: parsed.location || '', season: '', timeOfDay: '' },
    };
  }
}
```

**优势**:

- ✅ 短文本不跳过上下文，而是简化（1次调用）
- ✅ 避免过度设计，保持代码简洁
- ✅ 并行数控制防止限流

---

## 三、实施计划 (V2 - 调整工期)

### Phase 1: 紧急修复 (3天)

**目标**: 解决当前报错和警告问题

#### Task 1.1: 修复 MODEL_LIMITS 硬编码 ✅ 已完成

- [x] 添加 Seed 1.6 系列模型到 MODEL_LIMITS
- [x] 验证所有模型都有对应的限制配置

#### Task 1.2: 修复 Provider 识别问题 ✅ 已完成

- [x] 修改 ScriptParser 添加 provider 参数
- [x] 修改 createScriptParser 传递 provider
- [x] 修改 ScriptManager 传递正确的 provider
- [x] 修改 callLLM 和 callStructuredLLM 使用正确的 provider

#### Task 1.3: 实现 Provider 运行时枚举校验 (新增)

- [ ] 创建 PROVIDER_ENUM 和 validateProvider 函数
- [ ] 在 ScriptParser 构造函数中校验
- [ ] 在 AIService.callLLM 中校验
- [ ] 在 LLMProvider.generateText 中校验

#### Task 1.4: 实现从配置文件读取模型能力 (新增)

- [ ] 创建 getModelLimitsFromConfig 函数
- [ ] 修改 calculateEffectiveMaxTokens 使用新函数
- [ ] 移除硬编码的 MODEL_LIMITS 数组
- [ ] 添加空值保护

### Phase 2: 架构重构 (5天)

**目标**: 建立可持续维护的架构

#### Task 2.1: 实现 LRU 缓存

- [ ] 安装 lru-cache 依赖
- [ ] 创建 GlobalContextCache 类
- [ ] 实现完整哈希缓存键
- [ ] 添加命中率监控

#### Task 2.2: 实现并行化 + 并发控制

- [ ] 安装 p-limit 依赖
- [ ] 修改 extractGlobalContextParallel 使用 Promise.allSettled
- [ ] 添加 p-limit 并发控制（max: 3）
- [ ] 添加失败降级逻辑

#### Task 2.3: 实现自适应解析策略

- [ ] 创建 AdaptiveParser 类
- [ ] 实现 selectStrategy 方法
- [ ] 实现 extractMinimalGlobalContext 方法
- [ ] 集成到 ScriptParser

#### Task 2.4: 降低日志噪音

- [ ] 将 "Unknown model" 改为 info 级别
- [ ] 添加日志去重机制
- [ ] 优化 ScriptManager useEffect 重复日志

### Phase 3: 性能优化 + 测试 (3天)

**目标**: 提升解析速度并验证

#### Task 3.1: 性能基准测试

- [ ] 创建性能测试脚本
- [ ] 测试短文本（<1000字）解析时间
- [ ] 测试中等文本（1000-10000字）解析时间
- [ ] 测试长文本（>10000字）解析时间

#### Task 3.2: 单元测试

- [ ] 测试 calculateEffectiveMaxTokens 边界条件
- [ ] 测试 validateProvider 函数
- [ ] 测试 GlobalContextCache
- [ ] 测试 AdaptiveParser

#### Task 3.3: 集成测试

- [ ] 测试所有模型配置
- [ ] 测试 Provider 识别正确性
- [ ] 测试缓存命中率

### Phase 4: 验证与文档 (2天)

**目标**: 确保质量并记录架构

#### Task 4.1: 全面验证

- [ ] 验证所有修复点
- [ ] 验证性能提升达标
- [ ] 验证控制台无错误

#### Task 4.2: 架构文档

- [ ] 更新架构图
- [ ] 编写开发者文档
- [ ] 记录最佳实践

---

## 四、量化的成功标准 (V2)

### 4.1 功能标准

```typescript
// 基准测试配置
const BENCHMARK_CONFIG = {
  shortText: {
    length: 1000,
    expectedTime: 30, // 目标: <30秒
    baseline: 60, // 基准: 60秒
  },
  mediumText: {
    length: 5000,
    expectedTime: 90, // 目标: <90秒
    baseline: 180, // 基准: 180秒
  },
  longText: {
    length: 15000,
    expectedTime: 120, // 目标: <120秒
    baseline: 240, // 基准: 240秒
  },
};

// 验收标准
const ACCEPTANCE_CRITERIA = {
  // 所有模型正确识别 provider
  providerRecognition: '100%',

  // 控制台无 "Unknown model" 警告
  noUnknownModelWarnings: true,

  // 短文本解析时间
  shortTextParsingTime: '< 30s',

  // 长文本解析提速
  longTextSpeedup: '> 50%',

  // 缓存命中率
  cacheHitRate: '> 30%',
};
```

### 4.2 代码覆盖率标准

```typescript
const COVERAGE_TARGETS = {
  ModelCapabilityManager: 0.9, // 核心模块 >90%
  AdaptiveParser: 0.9,
  GlobalContextCache: 0.85,
  overall: 0.8, // 全量 >80%
};
```

### 4.3 架构标准

- [ ] 新增模型无需修改代码（只需 config/models.ts）
- [ ] Provider 传递链 100% 端到端校验
- [ ] 缓存无内存泄漏（LRU自动淘汰）
- [ ] 并行调用有并发控制

---

## 五、风险评估与应对 (V2)

| 风险         | 可能性 | 影响 | 应对措施                          |
| ------------ | ------ | ---- | --------------------------------- |
| 模型推断错误 | 低     | 高   | 保留手动配置 maxTokens 的兜底机制 |
| 缓存穿透     | 中     | 中   | 监控命中率，低于阈值时清理        |
| 并行调用限流 | 中     | 中   | p-limit 控制 max: 3，失败降级     |
| LRU缓存依赖  | 低     | 低   | 依赖 lru-cache 库，社区成熟       |
| 工期延期     | 中     | 中   | 13天缓冲，分阶段交付              |

---

## 六、技术依赖

### 新增依赖

```json
{
  "dependencies": {
    "lru-cache": "^10.2.0",
    "p-limit": "^5.0.0"
  }
}
```

### 安装命令

```bash
npm install lru-cache p-limit
```

---

## 七、总结

### V2 核心改进

1. ✅ **彻底消除硬编码**: 从 config/models.ts 读取，无代码层配置
2. ✅ **强化错误暴露**: Provider 运行时枚举校验，不掩盖错误
3. ✅ **完善边界处理**: LRU缓存 + 完整哈希 + 并发控制 + 失败降级
4. ✅ **量化落地标准**: 明确的工期、性能指标、覆盖率目标

### 预期效果

- 新增模型: 只需修改配置文件，无需代码改动
- Provider 识别: 100% 准确，错误立即暴露
- 解析速度: 短文本 <30s，长文本提速 50%+
- 内存安全: LRU自动淘汰，无泄漏

---

**计划状态**: 🚀 实施中  
**当前阶段**: Phase 1.3 - Provider 运行时枚举校验  
**预计完成**: 13天后 (2026-03-20)
