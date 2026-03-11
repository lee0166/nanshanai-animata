# 修复 GlobalContextExtractor JSON 解析错误

## 问题诊断（已确认）

### 错误现象

后端日志显示4处 JSON 解析错误：

```
Error extracting story context: SyntaxError: Unexpected token '`', "`json\n{\n  \"synop"... is not valid JSON
Error extracting visual context: SyntaxError: Unexpected token '`', "`json\n{\n  \"artDi"... is not valid JSON
Error extracting era context: SyntaxError: Unexpected token '`', "`json\n{\n  \"era"... is not valid JSON
Error extracting emotional arc: SyntaxError: Unexpected token '`', "`json\n{\n  \"overa"... is not valid JSON
```

### 根本原因（已确认）

**问题1：未使用 JSONRepair 提取 JSON**

- `GlobalContextExtractor` 直接使用 `JSON.parse(result.data)` 解析 LLM 响应
- LLM 返回的响应包含 markdown 代码块标记（`json ... `）
- 直接解析导致语法错误

**对比验证**：

- `ScriptParser` 使用 `JSONRepair.repairAndParse(response)` 成功解析
- `GlobalContextExtractor` 使用 `JSON.parse(result.data)` 失败

**问题2：临时模型配置缺少 maxTokens 参数**

- `ScriptParser` 创建的临时配置：`parameters: []`
- 导致使用 LLMProvider 默认值 4000 tokens
- 虽然 4000 tokens 理论上足够，但建议显式设置

### 日志证据

**失败的调用**（GlobalContextExtractor）：

```
Response length: 584 characters
Completion tokens: 357
Error: Unexpected token '`', "`json\n..." is not valid JSON
```

**成功的调用**（ScriptParser 分镜生成）：

```
Response length: 2801 characters
Completion tokens: 1158
JSON repaired using: extracted_from_code_block
```

## 修复方案

### 修复1：使用 JSONRepair 提取 JSON（必须）

**文件**：`services/parsing/GlobalContextExtractor.ts`

**修改内容**：

```typescript
import { JSONRepair } from './JSONRepair';

// 在 extractStoryContext, extractVisualContext, extractEraContext, extractEmotionalArc 中
// 将：
const parsed = JSON.parse(result.data);

// 改为：
const repairResult = JSONRepair.repairAndParse(result.data);
if (!repairResult.success || !repairResult.data) {
  throw new Error('Failed to parse JSON: ' + repairResult.error);
}
const parsed = repairResult.data;
```

### 修复2：添加 maxTokens 参数（建议）

**文件**：`services/scriptParser.ts`

**修改内容**：

```typescript
const config = {
  ...
  parameters: [
    {
      name: 'maxTokens',
      type: 'number',
      defaultValue: 4000,
    }
  ],
  ...
};
```

## 实施步骤

1. **修改 GlobalContextExtractor.ts**
   - [ ] 导入 JSONRepair
   - [ ] 修改 extractStoryContext 方法
   - [ ] 修改 extractVisualContext 方法
   - [ ] 修改 extractEraContext 方法
   - [ ] 修改 extractEmotionalArc 方法

2. **修改 scriptParser.ts**（可选）
   - [ ] 在临时模型配置中添加 maxTokens 参数

3. **测试验证**
   - [ ] 运行 GlobalContextExtractor 单元测试
   - [ ] 手动测试剧本解析流程
   - [ ] 验证全局上下文提取成功

## 预期结果

- 全局上下文提取不再出现 JSON 解析错误
- 提取的上下文数据完整可用
- 解析流程正常完成

## 风险评估

- **低风险**：修改范围小，只影响 GlobalContextExtractor
- **回滚策略**：如出现问题，可禁用全局上下文功能（`useGlobalContext: false`）
