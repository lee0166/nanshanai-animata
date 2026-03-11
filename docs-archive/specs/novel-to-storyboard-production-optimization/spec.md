# 小说转分镜脚本生产级优化方案 - Spec (v3.0)

> **方案定位**: 基于全链路代码分析的务实优化方案
> **核心目标**: 提升分镜脚本的"可制作性"，减少人工修改量
> **分析方法**: 全站代码分析 + 模块集成状态核实

---

## 一、项目现状全面分析

### 1.1 已实现且正常工作的功能

| 功能模块       | 文件位置                          | 状态        | 说明                          |
| -------------- | --------------------------------- | ----------- | ----------------------------- |
| **JSON修复**   | `parsing/JSONRepair.ts`           | ✅ 已集成   | 多级修复策略，处理LLM格式错误 |
| **资产关联**   | `types.ts:Keyframe.references`    | ✅ 已实现   | 关键帧支持角色/场景资产ID引用 |
| **关键帧拆分** | `keyframe/KeyframeService.ts`     | ✅ 正常工作 | 拆分时自动关联资产            |
| **图像生成**   | `keyframe/KeyframeService.ts`     | ✅ 正常工作 | 支持参考图生成                |
| **角色映射**   | `components/CharacterMapping.tsx` | ✅ 正常工作 | 支持mappedAssetId             |
| **场景映射**   | `components/SceneMapping.tsx`     | ✅ 正常工作 | 支持mappedAssetId             |

### 1.2 已实现但未集成的模块

| 模块                  | 文件位置                       | 功能         | 未集成原因分析          |
| --------------------- | ------------------------------ | ------------ | ----------------------- |
| **SemanticChunker**   | `parsing/SemanticChunker.ts`   | 语义分块     | 需要集成到scriptParser  |
| **ShortDramaRules**   | `parsing/ShortDramaRules.ts`   | 分镜规则验证 | 需要集成到generateShots |
| **MultiLevelCache**   | `parsing/MultiLevelCache.ts`   | 三级缓存     | 需要集成到LLM调用       |
| **ParseStateManager** | `parsing/ParseStateManager.ts` | 细粒度状态   | 需要替换简单状态管理    |
| **RAGRetrieval**      | `parsing/RAGRetrieval.ts`      | RAG检索      | 需要集成到角色/场景分析 |
| **HumanInTheLoop**    | `parsing/HumanInTheLoop.ts`    | 人工确认     | 需要集成到关键节点      |

### 1.3 数据流现状

```
小说上传 → 元数据提取 → 角色分析 → 场景分析 → 分镜生成
    │           │            │           │           │
    ▼           ▼            ▼           ▼           ▼
 Script    Metadata    Character[]   Scene[]     Shot[]
                                     (名称关联)  (名称关联)
                                                     │
                                                     ▼
                                              关键帧拆分
                                                     │
                                                     ▼
                                              Keyframe[]
                                              (资产ID引用)
```

**关键发现**:

- Shot仅包含角色/场景名称，通过名称查找资产
- Keyframe已包含资产ID引用（`references.character.id`）
- 资产关联发生在"关键帧拆分"阶段，这是正确的设计

---

## 二、真正需要优化的环节

### 2.1 问题1: 分镜生成缺乏专业规则验证

**现状**: 分镜生成后无质量验证

**影响**: 生成的分镜可能不符合短剧专业标准

**解决方案**: 集成已实现的 `ShortDramaRules` 模块

### 2.2 问题2: 文本分块可能切断叙事逻辑

**现状**: 使用固定6000字符分块

**影响**: 可能在章节中间切断，影响解析质量

**解决方案**: 集成已实现的 `SemanticChunker` 模块

### 2.3 问题3: 解析性能可优化

**现状**: 无缓存机制，重复解析成本高

**影响**: 相同内容重复解析浪费API调用

**解决方案**: 集成已实现的 `MultiLevelCache` 模块

---

## 三、优化方案设计

### 3.1 方案原则

1. **不破坏现有功能** - 所有改动通过配置开关控制
2. **优先集成已有模块** - 避免重复开发
3. **渐进式实施** - 每个模块独立集成，可独立回滚
4. **向后兼容** - 新功能默认关闭，需手动启用

### 3.2 核心改造点

#### 改造点1: 集成SemanticChunker

**修改文件**: `services/scriptParser.ts`

**改造方式**:

```typescript
import { SemanticChunker } from './parsing/SemanticChunker';

class ScriptParser {
  private config = {
    useSemanticChunking: true, // 配置开关
    // ...其他配置
  };

  private chunkText(text: string): string[] {
    if (this.config.useSemanticChunking) {
      const chunker = new SemanticChunker({ extractMetadata: true });
      return chunker.chunkSync(text); // 同步方法
    }
    // 保留原有逻辑作为fallback
    return this.legacyChunkText(text);
  }

  // 保留原有方法
  private legacyChunkText(text: string, maxChunkSize = 6000): string[] {
    // 原有实现...
  }
}
```

**回滚方式**: 设置 `useSemanticChunking: false`

#### 改造点2: 集成ShortDramaRules

**修改文件**: `services/scriptParser.ts`

**改造方式**:

```typescript
import { ShortDramaRules } from './parsing/ShortDramaRules';

class ScriptParser {
  private config = {
    useDramaRules: true,  // 配置开关
    dramaRulesMinScore: 60,  // 最低质量分
  };

  async generateShots(content: string, sceneName: string, ...): Promise<Shot[]> {
    // 生成原始分镜
    let shots = await this.generateRawShots(content, sceneName, ...);

    // 验证分镜质量
    if (this.config.useDramaRules) {
      const rules = new ShortDramaRules();
      const quality = rules.analyzeQuality({
        scenes: this.currentScenes,
        characters: this.currentCharacters,
        targetDuration: this.estimatedDuration
      });

      // 记录质量报告
      this.currentParseState.qualityReport = {
        score: quality.score,
        violations: quality.violations,
        suggestions: quality.suggestions
      };

      if (quality.score < this.config.dramaRulesMinScore) {
        console.warn('[ScriptParser] 分镜质量不达标:', quality.violations);
      }
    }

    return shots;
  }
}
```

**回滚方式**: 设置 `useDramaRules: false`

#### 改造点3: 集成MultiLevelCache

**修改文件**: `services/scriptParser.ts`

**改造方式**:

```typescript
import { MultiLevelCache } from './parsing/MultiLevelCache';

class ScriptParser {
  private cache: MultiLevelCache | null = null;

  private config = {
    useCache: true,
    cacheTTL: 3600000,  // 1小时
  };

  constructor() {
    if (this.config.useCache) {
      this.cache = new MultiLevelCache({
        defaultTTL: this.config.cacheTTL
      });
    }
  }

  async callLLM(prompt: string, ...): Promise<string> {
    const cacheKey = this.generateCacheKey(prompt);

    // 检查缓存
    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        console.log('[ScriptParser] Cache hit');
        return cached;
      }
    }

    // 调用LLM
    const response = await this.llmProvider.generateText(prompt, ...);

    // 写入缓存
    if (this.cache) {
      await this.cache.set(cacheKey, response);
    }

    return response;
  }
}
```

**回滚方式**: 设置 `useCache: false`

---

## 四、配置系统设计

### 4.1 配置接口

```typescript
interface ScriptParserConfig {
  // 语义分块
  useSemanticChunking: boolean;
  semanticChunkingOptions?: {
    maxChunkSize?: number;
    preserveChapterBoundary?: boolean;
  };

  // 分镜规则验证
  useDramaRules: boolean;
  dramaRulesMinScore: number; // 0-100
  dramaRulesEnabledRules?: string[]; // 启用的规则列表

  // 缓存
  useCache: boolean;
  cacheTTL: number; // 毫秒

  // 人工确认（可选）
  useHumanInTheLoop: boolean;
  confirmationPoints?: ('metadata' | 'characters' | 'scenes' | 'shots')[];
}

// 默认配置
const DEFAULT_CONFIG: ScriptParserConfig = {
  useSemanticChunking: true,
  useDramaRules: true,
  dramaRulesMinScore: 60,
  useCache: true,
  cacheTTL: 3600000,
  useHumanInTheLoop: false,
};
```

### 4.2 配置持久化

配置存储在 `settings` 中，用户可在设置页面调整。

---

## 五、回滚机制设计

### 5.1 回滚点设置

| 回滚点           | 触发条件                    | 回滚操作             |
| ---------------- | --------------------------- | -------------------- |
| **语义分块回滚** | `useSemanticChunking=false` | 使用原有固定字符分块 |
| **规则验证回滚** | `useDramaRules=false`       | 跳过质量验证         |
| **缓存回滚**     | `useCache=false`            | 每次都调用LLM        |
| **全量回滚**     | 所有开关=false              | 恢复到优化前状态     |

### 5.2 数据兼容性

- 新增字段均为可选，旧数据正常工作
- 质量报告存储在 `parseState.qualityReport`，旧版本忽略即可
- 缓存数据独立存储，不影响主数据

---

## 六、实施优先级

### P0 - 必须实现

| 任务                        | 工时 | 风险 | 回滚难度 |
| --------------------------- | ---- | ---- | -------- |
| Task 1: 集成SemanticChunker | 1h   | 低   | 容易     |
| Task 2: 集成ShortDramaRules | 1h   | 低   | 容易     |

### P1 - 建议实现

| 任务                        | 工时 | 风险 | 回滚难度 |
| --------------------------- | ---- | ---- | -------- |
| Task 3: 集成MultiLevelCache | 1h   | 低   | 容易     |
| Task 4: 添加配置系统        | 0.5h | 低   | 容易     |

### P2 - 可选实现

| 任务                          | 工时 | 风险 | 回滚难度 |
| ----------------------------- | ---- | ---- | -------- |
| Task 5: 集成ParseStateManager | 1.5h | 中   | 中等     |
| Task 6: 集成HumanInTheLoop    | 1.5h | 中   | 中等     |

---

## 七、验收标准

### 功能验收

- [ ] SemanticChunker成功集成，可通过配置开关
- [ ] ShortDramaRules成功集成，生成质量报告
- [ ] MultiLevelCache成功集成，缓存命中率可统计
- [ ] 配置系统正常工作

### 回滚验收

- [ ] 设置 `useSemanticChunking=false` 后使用原有分块
- [ ] 设置 `useDramaRules=false` 后跳过验证
- [ ] 设置 `useCache=false` 后不使用缓存
- [ ] 所有开关关闭后恢复优化前状态

### 质量验收

- [ ] 分镜质量评分可量化
- [ ] 解析性能提升可测量
- [ ] 现有功能不受影响

---

## 八、不改动的内容

以下功能已正常工作，不在本次优化范围内：

1. **Keyframe资产引用** - `references.character.id` 已实现
2. **关键帧拆分服务** - KeyframeService 已正常工作
3. **角色/场景映射** - mappedAssetId 机制已实现
4. **JSON修复** - JSONRepair 已集成
5. **前端组件** - 无需修改

---

**文档版本**: v3.0  
**创建日期**: 2026-02-27  
**最后更新**: 2026-02-27  
**分析方法**: 全站代码分析 + 模块集成状态核实
