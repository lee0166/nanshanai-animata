# 修复 ChromaDB 启用后错误计划

## 问题描述

用户启用 ChromaDB 服务后，解析小说时出现大量错误。

## 发现的错误

### 错误 1：ChromaDB URL 配置错误

**日志**：

```
scriptParser.ts:978  [ScriptParser] Failed to initialize vector memory: ChromaValueError: Invalid URL: /chroma
```

**分析**：

- VectorMemory.ts 第 75 行使用了 `path: '/chroma'` 参数
- ChromaDB 客户端提示：`The 'path' argument is deprecated. Please use 'ssl', 'host', and 'port' instead`
- 错误：`Invalid URL: /chroma`

**原因**：
ChromaDB JavaScript 客户端更新后，不再支持 `path` 参数，需要使用完整的 URL 格式。

**修复方案**：
修改 `VectorMemory.ts` 中的 ChromaClient 初始化：

```typescript
// 修改前
this.client = new ChromaClient({ path: '/chroma' });

// 修改后
this.client = new ChromaClient({
  path: 'http://localhost:3000/chroma',
});
```

### 错误 2：visualContext.artStyle 类型错误

**日志**：

```
scriptParser.ts:1568  [ScriptParser] Failed to extract global context: TypeError: visualContext.artStyle.toLowerCase is not a function
```

**分析**：

- 第 1568 行在提取全局上下文时出错
- `visualContext.artStyle.toLowerCase()` 调用失败
- 原因：`artStyle` 不是字符串类型

**可能原因**：

1. LLM 返回的 `artStyle` 是数组或对象，不是字符串
2. Zod Schema 验证通过后，数据类型仍然不正确
3. 代码假设 `artStyle` 是字符串，但实际不是

**修复方案**：
添加类型检查和容错处理：

```typescript
// 修改前
const artStyle = visualContext.artStyle?.toLowerCase() || 'cinematic';

// 修改后
const artStyle =
  typeof visualContext.artStyle === 'string' ? visualContext.artStyle.toLowerCase() : 'cinematic';
```

## 实施步骤

### 步骤 1：修复 ChromaDB URL 配置

**文件**：`services/parsing/VectorMemory.ts`

找到 ChromaClient 初始化代码，修改 path 参数为完整 URL。

### 步骤 2：修复 artStyle 类型错误

**文件**：`services/scriptParser.ts`

找到第 1568 行附近的代码，添加类型检查。

### 步骤 3：检查其他可能的类型错误

搜索 `toLowerCase()` 调用，确保所有调用都有类型检查。

### 步骤 4：测试验证

1. 重启 ChromaDB 服务
2. 重新解析小说
3. 检查控制台是否还有错误

## 优先级

| 错误              | 优先级 | 影响                     |
| ----------------- | ------ | ------------------------ |
| ChromaDB URL 错误 | 高     | 向量记忆功能完全无法使用 |
| artStyle 类型错误 | 高     | 全局上下文提取失败       |

## 预计工作量

- 步骤 1：5 分钟
- 步骤 2：10 分钟
- 步骤 3：10 分钟
- 步骤 4：10 分钟

总计：约 35 分钟
