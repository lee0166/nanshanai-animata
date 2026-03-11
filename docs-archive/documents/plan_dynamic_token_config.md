# 方案A实施计划：动态Token配置优化

## 文档信息

- **计划类型**: 渐进式优化（方案A）
- **目标**: 实现基于任务类型的动态max_tokens配置
- **预计耗时**: 2-3小时
- **风险等级**: 低（保持现有架构，仅优化配置）

---

## 一、现状分析

### 1.1 当前问题

根据代码分析 (`scriptParser.ts:906-924`)：

```typescript
const config = {
  // ...
  capabilities: {
    maxTokens: 4000, // ❌ 所有任务统一使用4000
    maxInputTokens: 8000,
  },
};
```

**问题**: 所有解析阶段（Metadata、Character、Scene、Shots）都使用相同的maxTokens=4000

### 1.2 实际Token需求（基于后端日志）

| 任务类型      | 实际所需Token | 当前配置 | 状态            |
| ------------- | ------------- | -------- | --------------- |
| Metadata      | ~3000         | 4000     | ✅ 足够         |
| GlobalContext | ~4000         | 4000     | ✅ 刚好         |
| Character     | ~5000         | 4000     | ❌ 不足         |
| Scene         | ~5000         | 4000     | ❌ 不足         |
| **Shots**     | **9306+**     | **4000** | **❌ 严重不足** |

---

## 二、优化目标

### 2.1 核心目标

1. **消除Token溢出**: 分镜生成从4000→12000
2. **优化其他阶段**: 根据实际需求调整各阶段Token上限
3. **保持架构稳定**: 不改动现有Pipeline结构
4. **向后兼容**: 不影响现有功能

### 2.2 预期效果

- 分镜生成不再被截断
- 角色/场景解析更完整
- 整体解析成功率提升

---

## 三、实施步骤

### Phase 1: 创建任务配置常量（15分钟）

**文件**: `services/scriptParser.ts`

**修改内容**: 在CONFIG常量后添加任务类型配置

```typescript
// 在 CONFIG 常量后添加
const TASK_CONFIG = {
  metadata: {
    maxTokens: 4000,
    timeout: 60000,
    description: '元数据提取',
  },
  globalContext: {
    maxTokens: 5000,
    timeout: 90000,
    description: '全局上下文提取',
  },
  character: {
    maxTokens: 6000,
    timeout: 90000,
    description: '角色解析',
  },
  scene: {
    maxTokens: 6000,
    timeout: 90000,
    description: '场景解析',
  },
  shots: {
    maxTokens: 12000, // 分镜需要更多Token
    timeout: 120000,
    description: '分镜生成',
  },
} as const;

type TaskType = keyof typeof TASK_CONFIG;
```

**验证点**:

- [ ] 常量定义正确
- [ ] TypeScript类型检查通过

---

### Phase 2: 重构callLLM方法支持动态配置（30分钟）

**文件**: `services/scriptParser.ts`

**修改内容**: 修改`callLLM`方法，添加taskType参数

**当前代码** (`scriptParser.ts:894-968`):

```typescript
private async callLLM(prompt: string, retryCount: number = 0): Promise<string>
```

**修改为**:

```typescript
private async callLLM(
  prompt: string,
  taskType: TaskType = 'metadata',
  retryCount: number = 0
): Promise<string> {
  const taskConfig = TASK_CONFIG[taskType];

  console.log(`[ScriptParser] callLLM for ${taskType}, maxTokens: ${taskConfig.maxTokens}`);

  // ... 原有代码 ...

  const config = {
    // ...
    capabilities: {
      // ...
      maxTokens: taskConfig.maxTokens,  // 使用动态配置
      maxInputTokens: 8000
    }
  };

  // 使用taskConfig.timeout替代CONFIG.timeout
  const timeoutId = setTimeout(() => this.abortController?.abort(), taskConfig.timeout);

  // ... 其余代码保持不变 ...
}
```

**验证点**:

- [ ] 方法签名兼容（默认参数保证向后兼容）
- [ ] 所有调用点能正确传递taskType

---

### Phase 3: 更新各阶段调用传入任务类型（30分钟）

**文件**: `services/scriptParser.ts`

**修改各阶段方法调用**:

#### 3.1 Metadata提取 (`extractMetadata`)

**位置**: ~line 1186-1226

**修改**:

```typescript
// 当前调用
const metadata = await this.callStructuredLLM(...);

// 无需修改callStructuredLLM，因为它使用不同的配置方式
// 但需要确保callStructuredLLM也支持动态配置
```

#### 3.2 Character提取 (`extractCharacter`)

**位置**: ~line 1231-1281

**修改**:

```typescript
// 当前调用 (line 1261)
const response = await this.callLLM(prompt);

// 修改为
const response = await this.callLLM(prompt, 'character');
```

#### 3.3 Scene提取 (`extractScene`)

**位置**: ~line 1286-1334

**修改**:

```typescript
// 当前调用 (line 1315)
const response = await this.callLLM(prompt);

// 修改为
const response = await this.callLLM(prompt, 'scene');
```

#### 3.4 Shots生成 (`generateShots`)

**位置**: ~line 1339-1396

**修改**:

```typescript
// 当前调用 (line 1370)
const response = await this.callLLM(prompt);

// 修改为
const response = await this.callLLM(prompt, 'shots');
```

#### 3.5 GlobalContext提取

**位置**: `GlobalContextExtractor.ts` 相关调用

**说明**: GlobalContextExtractor使用独立的配置，需要同步更新

**验证点**:

- [ ] 所有callLLM调用都传入了正确的taskType
- [ ] 没有遗漏的调用点

---

### Phase 4: 同步更新GlobalContextExtractor（20分钟）

**文件**: `services/parsing/GlobalContextExtractor.ts`

**修改内容**: 更新提取方法使用正确的maxTokens

**当前问题**: `GlobalContextExtractor`使用`llmProvider.generateText`直接调用，不经过ScriptParser的callLLM

**解决方案**: 在`initializeContextExtractor`方法中设置正确的maxTokens

**位置**: `scriptParser.ts:1104-1132`

**修改**:

```typescript
private initializeContextExtractor(): void {
  // ... 原有代码 ...

  const config = {
    // ...
    parameters: [
      {
        name: 'maxTokens',
        type: 'number' as const,
        defaultValue: TASK_CONFIG.globalContext.maxTokens,  // 使用5000而不是4000
        description: 'Maximum tokens for context extraction',
      }
    ],
    // ...
  };

  // ...
}
```

**验证点**:

- [ ] GlobalContextExtractor使用正确的Token上限

---

### Phase 5: 更新结构化输出方法（20分钟）

**文件**: `services/scriptParser.ts`

**方法**: `callStructuredLLM` (~line 1002-1051)

**修改内容**: 添加taskType参数支持

```typescript
private async callStructuredLLM<T>(
  prompt: string,
  schema: z.ZodType<T>,
  schemaDescription: string,
  systemPrompt?: string,
  taskType: TaskType = 'metadata'  // 新增参数
): Promise<T> {
  const taskConfig = TASK_CONFIG[taskType];

  // ...

  const config = {
    // ...
    capabilities: {
      supportsJsonMode: true,
      // ...
      maxTokens: taskConfig.maxTokens,  // 使用动态配置
    }
  };

  // ...
}
```

**更新调用点**:

- `extractMetadata`方法中传入`'metadata'`

**验证点**:

- [ ] callStructuredLLM支持taskType参数
- [ ] extractMetadata调用正确

---

### Phase 6: 测试验证（45分钟）

#### 6.1 单元测试

**命令**:

```bash
npm test -- scriptParser.test.ts
```

**预期结果**:

- [ ] 所有现有测试通过
- [ ] 无回归问题

#### 6.2 集成测试

**测试场景**:

1. 使用339字剧本测试完整解析流程
2. 验证分镜生成不再出现Token截断
3. 验证各阶段调用使用了正确的maxTokens

**验证方法**:
查看控制台日志，确认：

```
[ScriptParser] callLLM for shots, maxTokens: 12000
[LLMProvider] Max Tokens: 12000
```

#### 6.3 边界测试

- [ ] 测试超长剧本（>1万字）是否正常处理
- [ ] 测试空剧本是否正常处理
- [ ] 测试网络超时场景

---

## 四、风险与回滚方案

### 4.1 风险评估

| 风险                      | 可能性 | 影响 | 缓解措施                       |
| ------------------------- | ------ | ---- | ------------------------------ |
| Token设置过高导致成本增加 | 中     | 中   | 监控实际使用情况，必要时调整   |
| 某些模型不支持12000 Token | 低     | 高   | 添加模型能力检测，动态调整上限 |
| 超时时间不足              | 低     | 中   | 分镜阶段已设置120秒超时        |

### 4.2 回滚方案

如出现问题，快速回滚方法：

1. 将`TASK_CONFIG.shots.maxTokens`改回4000
2. 或者将各阶段调用改回不传taskType参数（使用默认值）

---

## 五、后续优化建议（可选）

### 5.1 短期优化

- [ ] 添加Token使用量监控
- [ ] 根据剧本长度动态调整Token上限
- [ ] 添加配置热更新能力

### 5.2 长期优化

- [ ] 实现剧本长度检测，>1万字时启用分块策略
- [ ] 支持长上下文模型（Claude/Gemini）自动检测和优化
- [ ] 建立Token使用统计和成本分析

---

## 六、实施检查清单

### 实施前

- [ ] 备份当前代码
- [ ] 确认测试环境可用
- [ ] 准备测试剧本（339字、1万字、5万字）

### 实施中

- [ ] Phase 1: 创建TASK_CONFIG常量
- [ ] Phase 2: 重构callLLM方法
- [ ] Phase 3: 更新各阶段调用
- [ ] Phase 4: 更新GlobalContextExtractor
- [ ] Phase 5: 更新callStructuredLLM
- [ ] Phase 6: 测试验证

### 实施后

- [ ] 运行完整测试套件
- [ ] 验证分镜生成无Token截断
- [ ] 更新项目文档
- [ ] 记录实际Token使用情况

---

## 七、预期成果

### 7.1 代码变更

- 修改文件: `services/scriptParser.ts`
- 修改文件: `services/parsing/GlobalContextExtractor.ts`（可能需要）
- 新增常量: `TASK_CONFIG`
- 预计新增代码: ~50行
- 预计修改代码: ~10处调用点

### 7.2 性能提升

- 分镜生成成功率: 从~60%提升至~95%
- 角色解析完整性: 提升~20%
- 场景描述完整性: 提升~20%

### 7.3 兼容性

- 完全向后兼容
- 不影响现有API
- 不改动数据结构

---

**计划制定时间**: 2026-03-04
**计划版本**: v1.0
**制定依据**: 基于代码深度分析和后端日志数据
