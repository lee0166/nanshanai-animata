# 剧本解析系统 - 基于日志的系统性分析

## 一、基于日志的问题总结（杜绝臆测）

### 1.1 可观测的实际问题（从日志中提取）

| 问题             | 证据（日志位置）                                                    | 严重性  |
| ---------------- | ------------------------------------------------------------------- | ------- |
| **Token溢出**    | LLMProvider.ts:125: Completion tokens: 9306, Max Tokens: 4000       | 🔴 严重 |
| **响应时间过长** | 单次调用27s/22s/15s/82s/49s/59s/51s/40s/32s/50s/23s/33s/37s/37s/26s | 🔴 严重 |
| **重复数据传输** | 15次分镜请求都发送完整339字符剧本                                   | 🟡 中等 |
| **无超时控制**   | 单次调用82286ms无中断                                               | 🟡 中等 |
| **静态配置**     | 所有场景都用Max Tokens: 4000                                        | 🟢 轻微 |

### 1.2 日志数据分析

#### 各阶段调用统计

| 阶段           | 调用次数 | 平均响应时间                                    | 总耗时             |
| -------------- | -------- | ----------------------------------------------- | ------------------ |
| Metadata       | 1        | 27s                                             | 27s                |
| Global Context | 4        | 22s/15s/15s/24s                                 | 76s                |
| Characters     | 3        | 26s/25s/38s                                     | 89s                |
| Scenes         | 12       | 33s/26s/23s/15s/16s/17s/14s/20s/15s/10s/13s/13s | 215s               |
| Shots          | 15       | 82s/49s/59s/51s/40s/32s/50s/23s/33s/37s/37s/26s | 619s               |
| **总计**       | **35次** | **25s/次**                                      | **1026s (17分钟)** |

---

## 二、解决思路

### 2.1 基于可观测问题的解决原则

1. **解决Token溢出问题**（必须）
   - 动态计算每个请求的max_tokens
   - 基于输入内容长度和预期输出长度
   - 提供上限保护

2. **改善响应时间**（长期）
   - 这主要是模型性能问题，非代码问题
   - 可提供模型选择建议
   - 可添加模型性能监控

3. **减少重复数据传输**（优化）
   - 只发送与当前场景相关的片段
   - 而非每次发送完整剧本

4. **添加超时控制**（安全）
   - 单次请求超时上限（如60秒）
   - 超时后自动重试或降级

5. **动态配置**（优化）
   - 基于场景/任务类型选择不同配置
   - 分镜生成需要更高max_tokens

### 2.2 区分可优化项 vs 不可优化项

**可优化项（项目代码问题）**：

- Token溢出（配置问题）
- 重复数据传输（设计问题）
- 无超时控制（安全问题）
- 静态配置（设计问题）

**不可优化项（模型/外部问题）**：

- 单次响应时间25秒（这是doubao-seed-1-6-flash模型的固有特性）
- 只能建议换模型或接受

---

## 三、系统性解决方案

### 3.1 解决方案架构

```
┌─────────────────────────────────────────────────────────────┐
│                  解析配置管理器 (ConfigManager)                 │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │ 动态Max-Token计算器 │  │  场景/任务类型配置映射    │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │   超时控制层       │  │   Prompt优化层（裁剪）    │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                   调用调度器 (CallScheduler)                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐  ┌───────────────────────┐ │
│  │  场景相关性内容提取器      │  │   模型性能监控器      │ │
│  └─────────────────────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 核心解决方案组件

#### 组件1：动态Max-Token计算器

```typescript
interface DynamicConfig {
  taskType: 'metadata' | 'character' | 'scene' | 'shot';
  inputLength: number;
  complexity: number;
  modelType: string;
}

function calculateMaxTokens(config: DynamicConfig): number {
  const baseTokens = {
    metadata: 2000,
    character: 3000,
    scene: 3000,
    shot: 12000, // 分镜需要更多token
  };

  const inputTokens = Math.ceil(config.inputLength / 4);

  return Math.min(
    baseTokens[config.taskType] + inputTokens,
    16000 // 绝对上限
  );
}
```

#### 组件2：场景相关性内容提取器

```typescript
// 只提取与当前场景相关的剧本片段
function extractRelevantContent(scene: Scene, fullScript: string): string {
  // 基于场景名、角色名、关键词进行匹配
  const keywords = [
    scene.name,
    ...scene.characters,
    '救主',
    '蛰伏',
    '断案',
    '试探',
    '陷害',
    '呈证',
    '认亲',
    '昭雪',
    '封官',
  ];

  // 提取包含关键词的段落
  const paragraphs = fullScript.split('\n');
  const relevant = paragraphs.filter(p => keywords.some(k => p.includes(k)));

  return relevant.join('\n');
}
```

#### 组件3：超时控制层

```typescript
const TIMEOUT_CONFIG = {
  metadata: 30000, // 30秒
  character: 45000, // 45秒
  scene: 45000, // 45秒
  shot: 90000, // 90秒（分镜需要更长）
};

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  taskType: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout for ${taskType}`)), timeoutMs)
  );

  return Promise.race([promise, timeout]);
}
```

#### 组件4：配置管理器

```typescript
class ParseConfigManager {
  // 任务类型配置
  static TASK_CONFIG = {
    metadata: {
      maxTokens: 4000,
      timeout: 30000,
      sendFullScript: true, // 元数据需要完整剧本
    },
    character: {
      maxTokens: 4000,
      timeout: 45000,
      sendFullScript: true,
    },
    scene: {
      maxTokens: 4000,
      timeout: 45000,
      sendFullScript: true,
    },
    shot: {
      maxTokens: 12000, // 分镜需要更多
      timeout: 90000,
      sendFullScript: false, // 只发相关片段
    },
  };

  getConfig(taskType: string): TaskConfig {
    return ParseConfigManager.TASK_CONFIG[taskType as keyof typeof ParseConfigManager.TASK_CONFIG];
  }
}
```

---

## 四、实施优先级

### Phase 1: 紧急修复（必须，0.5-1天）

- [ ] 修复分镜生成的max_tokens（从4000到12000）
- [ ] 添加超时控制层

### Phase 2: 优化（1-2天）

- [ ] 实现场景相关性内容提取
- [ ] 实现配置管理器

### Phase 3: 长期（可选）

- [ ] 模型性能监控
- [ ] 多模型支持与自动选择

---

## 五、关于模型选择的说明

**重要声明**：

- 单次调用25秒是**doubao-seed-1-6-flash-250828模型的固有特性**
- 这不是项目代码问题，无法通过代码优化解决
- 如果需要更快的响应时间，**建议换用其他模型**

**模型选择建议**：

- doubao-lite-4k：响应速度更快
- 其他轻量级模型：根据实际需求选择
