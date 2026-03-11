# 系统性修复模型配置与解析性能问题

> **计划目标**: 系统性解决模型配置、Provider识别、解析性能等根本问题  
> **计划性质**: 架构级优化，非临时性修复  
> **创建时间**: 2026-03-07

---

## 一、问题根因分析

### 1.1 当前架构问题图谱

```
┌─────────────────────────────────────────────────────────────────┐
│                        问题根因分析                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐      ┌─────────────────────┐          │
│  │ 模型配置层          │      │ 解析执行层          │          │
│  │ ─────────────────── │      │ ─────────────────── │          │
│  │ • MODEL_LIMITS 缺失 │─────→│ • 无法限制maxTokens │          │
│  │ • Provider识别错误  │─────→│ • 错误使用llm provider│        │
│  │ • 模型参数未标准化  │─────→│ • 调用链断裂        │          │
│  └─────────────────────┘      └─────────────────────┘          │
│           │                            │                       │
│           ↓                            ↓                       │
│  ┌─────────────────────┐      ┌─────────────────────┐          │
│  │ 性能问题层          │      │ 用户体验层          │          │
│  │ ─────────────────── │      │ ─────────────────── │          │
│  │ • 串行调用过多      │      │ • 解析速度慢        │          │
│  │ • 短文本过度处理    │      │ • 控制台警告刷屏    │          │
│  │ • 无缓存机制        │      │ • 配置难以理解      │          │
│  └─────────────────────┘      └─────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 核心问题清单

| 优先级 | 问题                                    | 根因             | 影响范围           |
| ------ | --------------------------------------- | ---------------- | ------------------ |
| P0     | MODEL_LIMITS 缺失 Seed 1.6 模型         | 硬编码表未更新   | 所有 Seed 1.6 调用 |
| P0     | Provider 识别为 "llm" 而非 "volcengine" | 配置传递链断裂   | 模型能力查询失败   |
| P1     | 短文本过度提取全局上下文                | 缺乏文本长度判断 | 所有短文本解析     |
| P1     | 串行调用过多                            | 架构设计问题     | 全局上下文提取阶段 |
| P2     | 控制台警告刷屏                          | 日志级别不当     | 开发体验           |
| P2     | 模型参数配置复杂                        | 缺乏智能默认值   | 新用户配置         |

---

## 二、系统性修复方案

### 2.1 架构级修复: 模型配置中心化管理

#### 现状问题

```typescript
// 当前: 硬编码在 ModelCapabilityManager.ts
const MODEL_LIMITS = [
  { provider: 'volcengine', modelId: 'doubao-lite-32k', maxTokens: 4096 },
  // ... 需要手动维护
];

// 问题:
// 1. 新增模型需要修改代码
// 2. 与 config/models.ts 重复
// 3. 容易遗漏
```

#### 修复方案: 动态模型能力发现

```typescript
// 新架构: 从模型配置自动推导
export class ModelCapabilityRegistry {
  private capabilities: Map<string, ModelCapabilities>;

  // 从 ModelConfig 自动注册
  registerFromConfig(config: ModelConfig) {
    const capabilities = this.inferCapabilities(config);
    this.capabilities.set(config.modelId, capabilities);
  }

  // 智能推断能力
  private inferCapabilities(config: ModelConfig): ModelCapabilities {
    return {
      maxTokens: this.inferMaxTokens(config),
      maxInputTokens: this.inferMaxInputTokens(config),
      supportsStreaming: config.capabilities?.supportsStreaming ?? true,
      provider: config.provider, // 确保使用正确的 provider
    };
  }

  // 基于模型ID智能推断
  private inferMaxTokens(config: ModelConfig): number {
    // 1. 优先使用配置中的参数
    const configMax = config.parameters?.find(p => p.name === 'maxTokens')?.defaultValue;
    if (configMax) return Math.min(configMax, 8192); // API 上限保护

    // 2. 基于模型名称推断
    const modelId = config.modelId.toLowerCase();
    if (modelId.includes('lite')) return 4096;
    if (modelId.includes('pro')) return 4096;
    if (modelId.includes('deepseek')) return 8192;
    if (modelId.includes('seed')) return 4096; // Seed 系列

    // 3. 默认值
    return 4096;
  }
}
```

### 2.2 架构级修复: Provider 传递链标准化

#### 现状问题

```typescript
// 问题调用链:
ScriptParser.callLLM(prompt, config)
  └─→ LLMProvider.generateText(prompt, config)
      └─→ calculateEffectiveMaxTokens(config.modelId, maxTokens, config.provider)
          // 这里 config.provider 可能被错误传递为 "llm"
```

#### 修复方案: Provider 上下文强制传递

```typescript
// 1. 在 ModelConfig 类型中强化 provider 字段
type ModelConfig = {
  id: string;
  modelId: string;
  provider: 'volcengine' | 'deepseek' | 'openai' | 'anthropic' | 'aliyun' | 'modelscope';
  // ... 其他字段
};

// 2. 在 AIService 层强制校验
class AIService {
  async callLLM(prompt: string, config: ModelConfig): Promise<AIResult> {
    // 强制校验 provider
    if (!this.isValidProvider(config.provider)) {
      throw new Error(
        `Invalid provider: ${config.provider}. Must be one of: volcengine, deepseek, openai, anthropic, aliyun, modelscope`
      );
    }

    // 确保 provider 正确传递到下游
    const provider = this.getProvider(config.provider);
    return provider.generateText(prompt, config);
  }
}

// 3. 在 LLMProvider 层增加防御性检查
class LLMProvider {
  async generateText(prompt: string, config: ModelConfig): Promise<AIResult> {
    // 防御性检查
    const effectiveProvider = config.provider || 'volcengine'; // 默认值保护

    const tokenLimit = calculateEffectiveMaxTokens(
      config.modelId,
      maxTokens,
      effectiveProvider // 确保传递正确的 provider
    );
    // ...
  }
}
```

### 2.3 架构级修复: 智能解析策略

#### 现状问题

```typescript
// 当前: 无论文本长短，都执行完整流程
async parseScript(content: string) {
  // 即使是 300 字的短文本，也执行:
  await this.extractGlobalContext(); // 3-4 次 LLM 调用
  await this.extractMetadata();      // 1 次 LLM 调用
  await this.extractCharacters();    // 1 次 LLM 调用
  // ... 总共 10+ 次调用
}
```

#### 修复方案: 自适应解析策略

```typescript
// 新架构: 基于文本长度的自适应策略
interface ParseStrategy {
  shouldExtractGlobalContext: boolean;
  shouldUseSemanticChunking: boolean;
  shouldUseIterativeRefinement: boolean;
  parallelizationLevel: 'none' | 'partial' | 'full';
}

class AdaptiveParser {
  // 根据文本长度选择策略
  selectStrategy(contentLength: number): ParseStrategy {
    if (contentLength < 1000) {
      // 短文本: 简化流程
      return {
        shouldExtractGlobalContext: false, // 跳过全局上下文
        shouldUseSemanticChunking: false, // 跳过语义分块
        shouldUseIterativeRefinement: false,
        parallelizationLevel: 'none',
      };
    }

    if (contentLength < 10000) {
      // 中等文本: 标准流程
      return {
        shouldExtractGlobalContext: true,
        shouldUseSemanticChunking: false,
        shouldUseIterativeRefinement: false,
        parallelizationLevel: 'partial',
      };
    }

    // 长文本: 完整流程
    return {
      shouldExtractGlobalContext: true,
      shouldUseSemanticChunking: true,
      shouldUseIterativeRefinement: true,
      parallelizationLevel: 'full',
    };
  }

  // 并行化全局上下文提取
  async extractGlobalContextParallel(content: string): Promise<GlobalContext> {
    const [story, visual, era] = await Promise.all([
      this.extractStoryContext(content),
      this.extractVisualContext(content),
      this.extractEraContext(content),
    ]);

    return { story, visual, era };
  }
}
```

### 2.4 架构级修复: 全局上下文缓存

#### 修复方案

```typescript
// 全局上下文缓存机制
class GlobalContextCache {
  private cache: Map<string, CachedContext>;
  private readonly CACHE_TTL = 3600000; // 1小时

  // 基于内容哈希的缓存键
  private generateKey(content: string): string {
    return hash(content.substring(0, 1000)); // 前1000字作为指纹
  }

  async getOrExtract(
    content: string,
    extractor: () => Promise<GlobalContext>
  ): Promise<GlobalContext> {
    const key = this.generateKey(content);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('[GlobalContextCache] Cache hit');
      return cached.context;
    }

    const context = await extractor();
    this.cache.set(key, { context, timestamp: Date.now() });
    return context;
  }
}
```

---

## 三、实施计划

### Phase 1: 紧急修复 (1-2天)

**目标**: 解决当前报错和警告问题

#### Task 1.1: 修复 MODEL_LIMITS 缺失

- [ ] 在 `ModelCapabilityManager.ts` 添加 Seed 1.6 系列模型限制
- [ ] 建立模型限制自动同步机制（从 config/models.ts 生成）
- [ ] 添加单元测试验证所有模型都有对应的限制配置

#### Task 1.2: 修复 Provider 识别问题

- [ ] 调查 Provider 为何被识别为 "llm"
- [ ] 在 LLMProvider 层添加防御性检查
- [ ] 在 AIService 层添加强制校验
- [ ] 添加日志追踪 Provider 传递链

#### Task 1.3: 降低日志噪音

- [ ] 将 "Unknown model" 警告改为 info 级别（非错误）
- [ ] 添加日志去重机制（相同警告只输出一次）
- [ ] 优化 ScriptManager useEffect 重复日志

### Phase 2: 架构重构 (3-5天)

**目标**: 建立可持续维护的架构

#### Task 2.1: 模型能力中心化管理

- [ ] 创建 `ModelCapabilityRegistry` 类
- [ ] 实现从 ModelConfig 自动推导能力
- [ ] 替换硬编码的 MODEL_LIMITS
- [ ] 添加能力缓存机制

#### Task 2.2: Provider 传递链标准化

- [ ] 强化 ModelConfig 类型定义
- [ ] 在 AIService 层添加 Provider 校验
- [ ] 在 LLMProvider 层添加防御性默认值
- [ ] 建立 Provider 传递追踪机制

#### Task 2.3: 自适应解析策略

- [ ] 创建 `AdaptiveParser` 类
- [ ] 实现基于文本长度的策略选择
- [ ] 实现全局上下文并行提取
- [ ] 添加策略选择日志

### Phase 3: 性能优化 (2-3天)

**目标**: 提升解析速度

#### Task 3.1: 全局上下文缓存

- [ ] 实现 `GlobalContextCache`
- [ ] 添加缓存命中率监控
- [ ] 实现缓存过期策略

#### Task 3.2: 并行化优化

- [ ] 并行化全局上下文提取
- [ ] 并行化角色/场景提取（如果独立）
- [ ] 添加并行化控制（防止请求过多）

#### Task 3.3: 短文本优化

- [ ] 跳过短文本的全局上下文提取
- [ ] 简化短文本的解析流程
- [ ] 添加短文本快速路径

### Phase 4: 验证与文档 (1-2天)

**目标**: 确保质量并记录架构

#### Task 4.1: 全面测试

- [ ] 测试所有模型配置
- [ ] 测试短/中/长文本解析
- [ ] 测试 Provider 识别正确性
- [ ] 性能基准测试

#### Task 4.2: 架构文档

- [ ] 更新架构图
- [ ] 编写开发者文档
- [ ] 记录最佳实践

---

## 四、技术实现细节

### 4.1 模型限制自动同步脚本

```typescript
// scripts/sync-model-limits.ts
// 从 config/models.ts 自动生成 MODEL_LIMITS

import { LLM_MODELS } from '../config/models';

function generateModelLimits() {
  const limits = LLM_MODELS.map(model => ({
    provider: model.provider,
    modelId: model.modelId,
    maxTokens: model.parameters?.find(p => p.name === 'maxTokens')?.defaultValue ?? 4096,
    maxInputTokens: model.capabilities?.maxContextLength ?? 32768,
  }));

  // 生成 TypeScript 代码
  const code = `// Auto-generated from config/models.ts
// Do not edit manually
export const MODEL_LIMITS = ${JSON.stringify(limits, null, 2)};`;

  fs.writeFileSync('src/services/ai/core/ModelLimits.generated.ts', code);
}
```

### 4.2 Provider 传递追踪

```typescript
// 在开发环境启用 Provider 追踪
const DEBUG_PROVIDER_CHAIN = true;

function traceProvider(label: string, provider: string, config: ModelConfig) {
  if (DEBUG_PROVIDER_CHAIN) {
    console.log(`[ProviderTrace] ${label}:`, {
      provider,
      modelId: config.modelId,
      configProvider: config.provider,
      stack: new Error().stack?.split('\n')[2],
    });
  }
}
```

### 4.3 性能监控

```typescript
// 解析性能监控
class ParsePerformanceMonitor {
  record(stage: string, duration: number, metadata: object) {
    console.log(`[Performance] ${stage}: ${duration}ms`, metadata);
  }

  // 生成性能报告
  generateReport() {
    // 分析各阶段耗时
    // 识别瓶颈
  }
}
```

---

## 五、风险评估与应对

| 风险               | 可能性 | 影响 | 应对措施             |
| ------------------ | ------ | ---- | -------------------- |
| 架构改动引入新bug  | 中     | 高   | 全面测试，渐进式部署 |
| 缓存导致数据不一致 | 低     | 中   | 合理的缓存过期策略   |
| 并行化导致请求过多 | 中     | 中   | 添加并发控制         |
| 模型推断不准确     | 低     | 中   | 保留手动覆盖机制     |

---

## 六、成功标准

### 6.1 功能标准

- [ ] 所有模型（包括 Seed 1.6）都能正确识别 provider
- [ ] 控制台无 "Unknown model" 警告
- [ ] 短文本（<1000字）解析时间 < 30秒
- [ ] 长文本解析时间减少 50%

### 6.2 架构标准

- [ ] 新增模型无需修改代码（自动识别）
- [ ] Provider 传递链 100% 可追溯
- [ ] 代码覆盖率 > 80%

### 6.3 体验标准

- [ ] 新用户配置模型时间 < 5分钟
- [ ] 控制台日志清晰可读
- [ ] 解析进度可感知

---

## 七、后续优化方向

1. **AI 配置助手**: 实现之前设计的文档解析功能
2. **智能模型推荐**: 根据文本类型推荐最优模型
3. **成本优化**: 根据预算自动选择性价比模型
4. **质量监控**: 自动检测解析质量并优化

---

**计划状态**: 📋 待审批  
**预计工期**: 7-12天  
**优先级**: 高（影响核心功能）
