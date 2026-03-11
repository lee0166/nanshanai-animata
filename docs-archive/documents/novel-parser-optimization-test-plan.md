# 小说转分镜脚本优化 - 测试方案

## 一、测试目标

验证以下优化功能的正确性和有效性：

1. **SemanticChunker集成** - 语义分块功能
2. **ShortDramaRules集成** - 分镜质量验证功能
3. **配置系统** - 配置开关和热更新功能
4. **回滚机制** - 配置关闭后恢复原有行为

---

## 二、测试范围

### 2.1 单元测试

| 测试模块         | 测试文件                  | 测试内容                 |
| ---------------- | ------------------------- | ------------------------ |
| ScriptParser配置 | `scriptParser.test.ts`    | 配置初始化、更新、默认值 |
| SemanticChunker  | `SemanticChunker.test.ts` | 语义分块、章节边界识别   |
| ShortDramaRules  | `ShortDramaRules.test.ts` | 规则验证、质量评分       |

### 2.2 集成测试

| 测试场景 | 测试文件                           | 测试内容                   |
| -------- | ---------------------------------- | -------------------------- |
| 解析流程 | `scriptParser.integration.test.ts` | 完整解析流程、质量报告生成 |
| 配置切换 | `config.integration.test.ts`       | 配置开关生效、回滚验证     |

### 2.3 端到端测试

| 测试场景     | 测试方法 | 测试内容     |
| ------------ | -------- | ------------ |
| 小说上传解析 | 手动测试 | 完整用户流程 |
| 分镜质量验证 | 手动测试 | 质量报告展示 |

---

## 三、测试用例设计

### 3.1 SemanticChunker测试用例

#### TC-SC-01: 章节边界识别

```
输入: 包含"第一章"、"第二章"等章节标题的小说文本
预期: 分块在章节边界处分割，不在章节中间切断
验证: 检查每个分块是否以章节标题开始
```

#### TC-SC-02: 段落完整性

```
输入: 包含多个段落的小说文本
预期: 每个分块的段落完整，不在段落中间切断
验证: 检查分块开头和结尾是否为完整段落
```

#### TC-SC-03: 上下文传递

```
输入: 多个分块的小说文本
预期: 每个分块包含前序上下文信息
验证: 检查chunk.prevContext是否存在
```

#### TC-SC-04: 配置开关验证

```
步骤1: 设置useSemanticChunking=true，验证使用语义分块
步骤2: 设置useSemanticChunking=false，验证使用原有分块
预期: 配置切换后行为正确变化
```

### 3.2 ShortDramaRules测试用例

#### TC-DR-01: 黄金3秒规则验证

```
输入: 第一个镜头为远景/中景的分镜序列
预期: 检测到违规，生成警告
验证: qualityReport.violations包含黄金3秒违规
```

#### TC-DR-02: 质量评分计算

```
输入: 符合专业规则的分镜序列
预期: 质量评分 >= 60
验证: qualityReport.score >= 60
```

#### TC-DR-03: 改进建议生成

```
输入: 存在质量问题的分镜序列
预期: 生成具体的改进建议
验证: qualityReport.suggestions不为空
```

#### TC-DR-04: 配置开关验证

```
步骤1: 设置useDramaRules=true，验证生成质量报告
步骤2: 设置useDramaRules=false，验证跳过验证
预期: 配置切换后行为正确变化
```

### 3.3 配置系统测试用例

#### TC-CFG-01: 默认配置验证

```
步骤: 创建ScriptParser实例，不传入配置
预期: 使用DEFAULT_PARSER_CONFIG默认值
验证:
  - useSemanticChunking = true
  - useDramaRules = true
  - dramaRulesMinScore = 60
```

#### TC-CFG-02: 自定义配置验证

```
步骤: 创建ScriptParser实例，传入自定义配置
预期: 使用自定义配置覆盖默认值
验证: getConfig()返回自定义配置
```

#### TC-CFG-03: 配置热更新验证

```
步骤1: 创建ScriptParser实例
步骤2: 调用updateConfig()更新配置
预期: 配置立即生效，无需重新创建实例
验证: getConfig()返回更新后的配置
```

### 3.4 回滚机制测试用例

#### TC-ROLL-01: 全量回滚验证

```
步骤1: 设置所有配置为true
步骤2: 执行解析流程
步骤3: 设置所有配置为false
步骤4: 再次执行解析流程
预期: 步骤4的行为与优化前完全一致
验证:
  - 不使用语义分块
  - 不生成质量报告
  - 解析结果正确
```

---

## 四、测试实施步骤

### Phase 1: 单元测试 (预计2小时)

#### Step 1.1: 创建测试文件

```bash
# 创建测试文件
touch services/scriptParser.config.test.ts
touch services/parsing/SemanticChunker.sync.test.ts
touch services/parsing/ShortDramaRules.validation.test.ts
```

#### Step 1.2: 编写ScriptParser配置测试

```typescript
// services/scriptParser.config.test.ts
describe('ScriptParser Configuration', () => {
  test('should use default config when not provided', () => {
    const parser = new ScriptParser('test-key');
    const config = parser.getConfig();
    expect(config.useSemanticChunking).toBe(true);
    expect(config.useDramaRules).toBe(true);
    expect(config.dramaRulesMinScore).toBe(60);
  });

  test('should override default config with custom config', () => {
    const parser = new ScriptParser('test-key', undefined, undefined, {
      useSemanticChunking: false,
      dramaRulesMinScore: 80,
    });
    const config = parser.getConfig();
    expect(config.useSemanticChunking).toBe(false);
    expect(config.dramaRulesMinScore).toBe(80);
  });

  test('should update config dynamically', () => {
    const parser = new ScriptParser('test-key');
    parser.updateConfig({ useSemanticChunking: false });
    expect(parser.getConfig().useSemanticChunking).toBe(false);
  });
});
```

#### Step 1.3: 编写SemanticChunker测试

```typescript
// services/parsing/SemanticChunker.sync.test.ts
describe('SemanticChunker sync method', () => {
  test('should split at chapter boundaries', () => {
    const chunker = new SemanticChunker();
    const text = '第一章 开端\n\n内容...\n\n第二章 发展\n\n内容...';
    const chunks = chunker.chunkSync(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content).toContain('第一章');
  });

  test('should preserve paragraph integrity', () => {
    const chunker = new SemanticChunker();
    const text = '段落1\n\n段落2\n\n段落3';
    const chunks = chunker.chunkSync(text);
    chunks.forEach(chunk => {
      expect(chunk.content.trim().length).toBeGreaterThan(0);
    });
  });
});
```

#### Step 1.4: 编写ShortDramaRules测试

```typescript
// services/parsing/ShortDramaRules.validation.test.ts
describe('ShortDramaRules validation', () => {
  test('should detect golden 3 seconds violation', () => {
    const rules = new ShortDramaRules();
    const context = {
      scenes: [{ name: '场景1', characters: ['角色1'], description: '描述' }],
      characters: ['角色1'],
      targetDuration: 60,
    };
    const quality = rules.analyzeQuality(context);
    expect(quality.score).toBeDefined();
    expect(quality.violations).toBeDefined();
  });

  test('should generate suggestions for low quality', () => {
    const rules = new ShortDramaRules();
    const context = {
      scenes: [],
      characters: [],
      targetDuration: 0,
    };
    const quality = rules.analyzeQuality(context);
    expect(quality.suggestions.length).toBeGreaterThan(0);
  });
});
```

### Phase 2: 集成测试 (预计1小时)

#### Step 2.1: 创建集成测试文件

```typescript
// services/scriptParser.integration.test.ts
describe('ScriptParser Integration', () => {
  test('should generate quality report when drama rules enabled', async () => {
    const parser = new ScriptParser('test-key', undefined, undefined, {
      useDramaRules: true,
    });
    // ... 执行解析流程
    const report = parser.getQualityReport();
    expect(report).toBeDefined();
  });

  test('should not generate quality report when drama rules disabled', async () => {
    const parser = new ScriptParser('test-key', undefined, undefined, {
      useDramaRules: false,
    });
    // ... 执行解析流程
    const report = parser.getQualityReport();
    expect(report).toBeNull();
  });
});
```

### Phase 3: 手动端到端测试 (预计1小时)

#### Step 3.1: 准备测试数据

```
准备一份测试小说文本，包含：
- 至少3个章节
- 至少5个角色
- 至少3个场景
- 约5000字
```

#### Step 3.2: 执行手动测试

**测试场景1: 语义分块验证**

1. 启动开发服务器
2. 上传测试小说
3. 打开浏览器控制台
4. 执行解析
5. 检查控制台日志，确认使用语义分块
6. 验证分块不在章节中间切断

**测试场景2: 分镜质量验证**

1. 完成小说解析
2. 检查控制台日志，确认质量报告生成
3. 验证质量评分和建议

**测试场景3: 配置回滚验证**

1. 修改配置，关闭所有优化功能
2. 重新执行解析
3. 验证行为与优化前一致

---

## 五、验收标准

### 5.1 单元测试验收

| 指标       | 目标值 |
| ---------- | ------ |
| 测试覆盖率 | > 80%  |
| 测试通过率 | 100%   |
| 测试用例数 | > 15   |

### 5.2 集成测试验收

| 指标       | 目标值 |
| ---------- | ------ |
| 场景覆盖   | 100%   |
| 测试通过率 | 100%   |

### 5.3 功能验收

| 功能            | 验收标准             |
| --------------- | -------------------- |
| SemanticChunker | 分块不在章节中间切断 |
| ShortDramaRules | 质量报告正确生成     |
| 配置系统        | 配置开关生效         |
| 回滚机制        | 关闭后行为恢复       |

---

## 六、测试执行命令

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- scriptParser.config.test.ts
npm test -- SemanticChunker.sync.test.ts
npm test -- ShortDramaRules.validation.test.ts

# 运行测试并生成覆盖率报告
npm test -- --coverage

# 运行集成测试
npm test -- integration
```

---

## 七、测试报告模板

### 测试执行报告

| 测试类型 | 用例数 | 通过数 | 失败数 | 通过率 |
| -------- | ------ | ------ | ------ | ------ |
| 单元测试 | -      | -      | -      | -      |
| 集成测试 | -      | -      | -      | -      |
| 手动测试 | -      | -      | -      | -      |

### 问题记录

| 问题ID | 描述 | 严重程度 | 状态 |
| ------ | ---- | -------- | ---- |
| -      | -    | -        | -    |

---

**文档版本**: v1.0  
**创建日期**: 2026-02-27  
**预计工时**: 4小时
