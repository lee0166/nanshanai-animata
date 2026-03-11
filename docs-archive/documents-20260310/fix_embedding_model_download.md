# 修复 EmbeddingService 模型下载问题

## 问题分析

**错误信息**：

```
Failed to load model: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

**根本原因**：

- `@xenova/transformers` 库默认从 Hugging Face (huggingface.co) 下载模型
- 在中国境内，Hugging Face 可能被墙或访问缓慢
- 请求返回了 HTML 错误页面（通常是 403 或连接超时），而不是 JSON 数据

## 解决方案

### 方案 1：使用 ModelScope 镜像（推荐）

ModelScope 是阿里巴巴的模型托管平台，提供 Hugging Face 模型的国内镜像。

**实施步骤**：

1. **安装 @xenova/transformers 的环境变量支持**

   ```bash
   npm install @xenova/transformers
   ```

2. **修改 EmbeddingService.ts**，添加 ModelScope 镜像配置：

   ```typescript
   // 在文件顶部添加环境变量配置
   import { env } from '@xenova/transformers';

   // 配置 ModelScope 镜像
   env.remoteHost = 'https://www.modelscope.cn';
   env.remotePathTemplate = '{model}/resolve/master/{file}';
   ```

3. **或者使用本地模型路径**，手动下载模型：
   - 从 ModelScope 下载 `Xenova/all-MiniLM-L6-v2` 模型
   - 放置到 `./data/models` 目录
   - 修改代码使用本地路径

### 方案 2：使用 Vite 代理模型下载请求

配置 Vite 代理，将 Hugging Face 请求转发到可访问的镜像。

**实施步骤**：

1. **修改 vite.config.ts**，添加代理：

   ```typescript
   server: {
     proxy: {
       '/huggingface': {
         target: 'https://www.modelscope.cn',
         changeOrigin: true,
         rewrite: (path) => path.replace(/^\/huggingface/, '')
       }
     }
   }
   ```

2. **修改 EmbeddingService.ts**，配置代理：
   ```typescript
   import { env } from '@xenova/transformers';
   env.remoteHost = '/huggingface';
   ```

### 方案 3：预下载模型到本地

手动下载模型文件，避免运行时下载。

**实施步骤**：

1. **从 ModelScope 下载模型**：

   ```bash
   # 访问 https://www.modelscope.cn/models/Xenova/all-MiniLM-L6-v2
   # 下载所有模型文件
   ```

2. **放置到项目目录**：

   ```
   ./data/models/Xenova/all-MiniLM-L6-v2/
   ├── config.json
   ├── tokenizer.json
   ├── tokenizer_config.json
   ├── vocab.txt
   └── onnx/
       └── model_quantized.onnx
   ```

3. **修改 EmbeddingService.ts**，使用本地模型：
   ```typescript
   this.embedder = await pipeline(
     'feature-extraction',
     './data/models/Xenova/all-MiniLM-L6-v2', // 本地路径
     {
       quantized: true,
       local_files_only: true, // 强制使用本地文件
     }
   );
   ```

### 方案 4：禁用 VectorMemory（临时方案）

如果暂时不需要智能记忆功能，可以禁用 VectorMemory。

**实施步骤**：

1. **修改 VectorMemoryConfig.ts**：

   ```typescript
   enabled: false,  // 默认关闭
   ```

2. **或者修改 scriptParser.ts**，捕获 EmbeddingService 错误：
   ```typescript
   try {
     await this.vectorMemory.initialize();
   } catch (error) {
     console.warn('[ScriptParser] VectorMemory initialization failed, continuing without it');
     this.vectorMemory = null;
   }
   ```

## 推荐实施方案

**采用方案 1 + 方案 3 的组合**：

### 步骤 1：配置 ModelScope 镜像

修改 `EmbeddingService.ts`：

```typescript
import { pipeline, Pipeline, env } from '@xenova/transformers';

// 配置 ModelScope 镜像
env.remoteHost = 'https://www.modelscope.cn';
env.remotePathTemplate = '{model}/resolve/master/{file}';

export class EmbeddingService {
  // ... 其余代码不变
}
```

### 步骤 2：添加错误处理和降级机制

修改 `VectorMemory.ts` 的 `initialize` 方法：

```typescript
async initialize(): Promise<void> {
  try {
    // 初始化 Embedding 服务
    await this.embeddingService.initialize();

    // 创建客户端
    this.client = new ChromaClient({
      path: this.dbPath
    });

    // ... 其余代码
  } catch (error) {
    console.error('[VectorMemory] Initialization failed:', error);
    // 抛出错误让上层处理
    throw error;
  }
}
```

### 步骤 3：在 UI 中显示模型下载进度

修改 `VectorMemoryToggle.tsx`，添加下载状态提示：

```typescript
// 显示模型下载中提示
if (isModelLoading) {
  return (
    <div>
      <Spinner size="sm" />
      <span>正在下载 AI 模型（约 80MB），请稍候...</span>
    </div>
  );
}
```

## 验证步骤

1. **清除浏览器缓存**
2. **刷新页面**
3. **启用智能记忆功能**
4. **观察控制台日志**：
   - 应该显示从 ModelScope 下载模型
   - 或者显示使用本地模型
5. **测试剧本解析**：
   - VectorMemory 应该成功初始化
   - 不再出现 `"<!DOCTYPE"... is not valid JSON` 错误

## 备选方案

如果 ModelScope 也无法访问，可以考虑：

1. **使用其他 Embedding 服务**：
   - 阿里云 DashScope
   - 百度 AI Studio
   - 本地部署的 Embedding 模型

2. **完全禁用 VectorMemory**：
   - 将 `enabled` 默认设为 `false`
   - 在 UI 中隐藏智能记忆选项
   - 仅使用普通解析模式
