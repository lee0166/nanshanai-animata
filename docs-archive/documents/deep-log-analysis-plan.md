# 后端日志深度排查计划

## 日志概况

- 文件大小：145KB
- 总行数：2405行
- 主要问题：多处错误和警告

## 发现的问题清单

### 问题1：max_tokens 参数错误（最严重）

**错误信息**：

```
InvalidParameter: max_tokens expected <= 4096, but got 5000
```

**影响范围**：

- GlobalContextExtractor.ts - 故事上下文提取失败
- GlobalContextExtractor.ts - 视觉上下文提取失败
- GlobalContextExtractor.ts - 时代背景提取失败
- GlobalContextExtractor.ts - 情感弧线提取失败

**根本原因**：

- 豆包-lite-32k 模型只支持 4096 tokens
- 但代码中使用了 5000 tokens
- 之前修复了 scriptParser.ts，但 GlobalContextExtractor.ts 也有同样问题

**修复方案**：
检查并修复所有使用 LLM 的文件，统一处理 max_tokens 限制

### 问题2：向量数据库连接失败

**错误信息**：

```
GET http://localhost:3000/chroma/api/v2/heartbeat 500 (Internal Server Error)
提取 加载失败:GET "http://localhost:3000/chroma/api/v2/heartbeat"
```

**影响**：VectorMemoryConfig.ts 向量记忆功能不可用

**可能原因**：

- ChromaDB 服务未启动
- 向量数据库配置错误
- 本地模型未下载

**优先级**：中（不影响核心剧本解析功能）

### 问题3：图片加载失败

**错误信息**：

```
提取 加载失败:POST "http://localhost:3000/api/universal-proxy"
```

**影响**：BaseProvider.ts 图片资源加载失败

**可能原因**：

- 图片URL无效
- 代理服务问题
- 网络问题

**优先级**：低

### 问题4：剧本解析警告

**警告信息**：

```
平均每镜时长 13.1秒 过长，可能导致节奏拖沓
```

**影响**：scriptParser.ts 预算验证警告

**性质**：非错误，是内容质量建议

**优先级**：低

### 问题5：迭代优化引擎

**日志信息**：

```
Applied: 0, Skipped: 1, Failed: 0
```

**影响**：RefinementEngine.ts 优化建议被跳过

**可能原因**：

- 优化条件不满足
- 剧本内容不需要优化

**优先级**：低

## 排查步骤

### 步骤1：修复 max_tokens 问题（最高优先级）

1. 检查 GlobalContextExtractor.ts 中的 LLM 调用
2. 检查其他可能使用 LLM 的文件
3. 统一实现 max_tokens 限制逻辑
4. 考虑创建一个通用的 LLM 配置工具函数

### 步骤2：检查向量数据库问题

1. 确认 ChromaDB 服务状态
2. 检查向量数据库配置
3. 确认本地嵌入模型是否已下载

### 步骤3：优化日志输出

1. 减少重复错误日志
2. 添加更清晰的错误提示
3. 区分开发日志和生产日志

### 步骤4：验证修复效果

1. 重新上传小说测试
2. 检查日志是否还有错误
3. 验证剧本解析是否成功

## 预期结果

修复后应该：

- ✅ max_tokens 错误消失
- ✅ 剧本解析成功完成
- ✅ 日志文件大小控制在合理范围
- ⚠️ 向量数据库问题可后续处理（非核心功能）
