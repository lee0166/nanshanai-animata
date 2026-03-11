# Embedding 模型下载用户体验方案

## 核心原则

1. **自动触发**：用户开启智能记忆后，自动开始下载模型
2. **进度可见**：显示下载进度，让用户知道当前状态
3. **失败友好**：下载失败时，提供清晰的手动下载指引
4. **不影响主流程**：模型下载失败时，自动回退到标准模式

## 用户体验流程

### 场景 1：首次开启智能记忆

```
用户操作：开启智能记忆开关

系统响应：
┌─────────────────────────────────────────┐
│ 🧠 智能记忆                             │
├─────────────────────────────────────────┤
│                                         │
│ 正在下载 AI 模型...                      │
│ [████████████████░░░░] 65%              │
│                                         │
│ 模型大小：约 80MB                        │
│ 预计剩余时间：30 秒                      │
│                                         │
│ [取消下载]                              │
│                                         │
└─────────────────────────────────────────┘
```

### 场景 2：下载成功

```
下载完成后：
┌─────────────────────────────────────────┐
│ ✅ 模型下载完成                          │
├─────────────────────────────────────────┤
│                                         │
│ AI 模型已准备就绪，可以开始使用智能记忆功能 │
│                                         │
│ [开始解析]                              │
│                                         │
└─────────────────────────────────────────┘
```

### 场景 3：下载失败

```
下载失败时：
┌─────────────────────────────────────────┐
│ ⚠️ 模型下载失败                          │
├─────────────────────────────────────────┤
│                                         │
│ 自动下载失败，可能原因：                  │
│ • 网络连接问题                          │
│ • 模型源服务器暂时不可用                 │
│                                         │
│ 您可以选择：                             │
│                                         │
│ 1. [重试下载] - 重新尝试自动下载         │
│                                         │
│ 2. [手动下载] - 按指引手动下载模型       │
│    下载地址：https://www.modelscope.cn/... │
│    放置位置：./data/models/Xenova/...    │
│                                         │
│ 3. [使用标准模式] - 不使用智能记忆继续   │
│                                         │
└─────────────────────────────────────────┘
```

### 场景 4：已下载过模型

```
用户再次开启智能记忆：

系统检测：模型已存在，跳过下载
直接显示：✅ 智能记忆已启用
```

## 技术实现方案

### 1. 修改 EmbeddingService.ts

**添加下载状态管理**：

```typescript
export interface ModelDownloadState {
  status: 'idle' | 'downloading' | 'success' | 'error';
  progress: number; // 0-100
  totalSize?: string;
  downloadedSize?: string;
  error?: string;
  retryCount: number;
}

export class EmbeddingService {
  private downloadState: ModelDownloadState = {
    status: 'idle',
    progress: 0,
    retryCount: 0,
  };
  private downloadListeners: ((state: ModelDownloadState) => void)[] = [];

  // 订阅下载状态
  onDownloadProgress(callback: (state: ModelDownloadState) => void) {
    this.downloadListeners.push(callback);
    return () => {
      this.downloadListeners = this.downloadListeners.filter(cb => cb !== callback);
    };
  }

  // 更新下载状态
  private updateDownloadState(state: Partial<ModelDownloadState>) {
    this.downloadState = { ...this.downloadState, ...state };
    this.downloadListeners.forEach(cb => cb(this.downloadState));
  }

  // 初始化时尝试下载
  async initialize(): Promise<void> {
    if (this.embedder) return;

    try {
      this.updateDownloadState({ status: 'downloading', progress: 0 });

      // 尝试从多个源下载
      const sources = [
        { name: 'ModelScope', url: 'https://www.modelscope.cn/models/Xenova/all-MiniLM-L6-v2' },
        { name: 'Hugging Face', url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2' },
      ];

      for (const source of sources) {
        try {
          console.log(`[EmbeddingService] Trying to download from ${source.name}...`);
          this.embedder = await this.tryDownloadFromSource(source.url);
          this.updateDownloadState({ status: 'success', progress: 100 });
          return;
        } catch (error) {
          console.warn(`[EmbeddingService] Failed to download from ${source.name}:`, error);
          continue;
        }
      }

      // 所有源都失败
      throw new Error('All download sources failed');
    } catch (error) {
      this.updateDownloadState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // 重试下载
  async retryDownload(): Promise<void> {
    this.downloadState.retryCount++;
    this.updateDownloadState({
      status: 'downloading',
      progress: 0,
      error: undefined,
    });
    await this.initialize();
  }

  // 获取手动下载指引
  getManualDownloadGuide(): {
    modelName: string;
    downloadUrl: string;
    targetPath: string;
    instructions: string[];
  } {
    return {
      modelName: 'Xenova/all-MiniLM-L6-v2',
      downloadUrl: 'https://www.modelscope.cn/models/Xenova/all-MiniLM-L6-v2/files',
      targetPath: './data/models/Xenova/all-MiniLM-L6-v2/',
      instructions: [
        '1. 访问上述下载地址',
        '2. 下载以下文件：config.json、tokenizer.json、tokenizer_config.json、vocab.txt',
        '3. 下载 onnx/model_quantized.onnx',
        '4. 将文件放置到指定目录',
        '5. 刷新页面后重新开启智能记忆',
      ],
    };
  }
}
```

### 2. 创建 ModelDownloadProgress 组件

```tsx
// components/ModelDownloadProgress.tsx
import React from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Progress,
} from '@heroui/react';
import { Brain, Download, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { ModelDownloadState } from '../services/parsing/EmbeddingService';

interface ModelDownloadProgressProps {
  isOpen: boolean;
  downloadState: ModelDownloadState;
  onRetry: () => void;
  onCancel: () => void;
  onUseStandardMode: () => void;
  manualGuide: {
    modelName: string;
    downloadUrl: string;
    targetPath: string;
    instructions: string[];
  };
}

export const ModelDownloadProgress: React.FC<ModelDownloadProgressProps> = ({
  isOpen,
  downloadState,
  onRetry,
  onCancel,
  onUseStandardMode,
  manualGuide,
}) => {
  const renderContent = () => {
    switch (downloadState.status) {
      case 'downloading':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <Brain className="w-12 h-12 text-primary animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium">正在下载 AI 模型...</p>
              <p className="text-sm text-gray-500">首次使用需要下载约 80MB 模型文件</p>
            </div>
            <Progress value={downloadState.progress} className="w-full" />
            <div className="flex justify-between text-sm text-gray-500">
              <span>{downloadState.progress}%</span>
              <span>预计剩余时间：{Math.ceil((100 - downloadState.progress) / 2)} 秒</span>
            </div>
            <Button variant="flat" onClick={onCancel} className="w-full">
              取消下载
            </Button>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-success" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-success">模型下载完成</p>
              <p className="text-sm text-gray-500">AI 模型已准备就绪</p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-danger" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-danger">模型下载失败</p>
              <p className="text-sm text-gray-500">自动下载失败，请尝试以下解决方案</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="font-medium">手动下载指引：</p>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                {manualGuide.instructions.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                <p>下载地址：{manualGuide.downloadUrl}</p>
                <p>放置路径：{manualGuide.targetPath}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="flat" onClick={onUseStandardMode} className="flex-1">
                使用标准模式
              </Button>
              <Button
                color="primary"
                onClick={onRetry}
                startContent={<RefreshCw size={16} />}
                className="flex-1"
              >
                重试下载
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {}} hideCloseButton>
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          智能记忆模型
        </ModalHeader>
        <ModalBody>{renderContent()}</ModalBody>
      </ModalContent>
    </Modal>
  );
};
```

### 3. 修改 VectorMemoryToggle 组件

```tsx
// 在 VectorMemoryToggle 中添加下载进度显示
const [downloadState, setDownloadState] = useState<ModelDownloadState>({
  status: 'idle',
  progress: 0,
  retryCount: 0,
});

const handleToggle = async (newEnabled: boolean) => {
  if (newEnabled) {
    // 开启时，先检查模型是否已下载
    const embeddingService = new EmbeddingService();

    // 订阅下载进度
    const unsubscribe = embeddingService.onDownloadProgress(state => {
      setDownloadState(state);
    });

    try {
      await embeddingService.initialize();
      setEnabled(true);
      vectorMemoryConfig.setEnabled(true);
      onToggle?.(true);
    } catch (error) {
      // 下载失败，显示错误状态
      // 但保持开关开启状态，让用户选择如何处理
    } finally {
      unsubscribe();
    }
  } else {
    setEnabled(false);
    vectorMemoryConfig.setEnabled(false);
    onToggle?.(false);
  }
};
```

### 4. 修改 ScriptManager.tsx

```tsx
// 在解析前检查模型下载状态
const handleParseClick = async () => {
  if (useVectorMemory) {
    const embeddingService = new EmbeddingService();

    // 检查模型是否已下载
    try {
      await embeddingService.initialize();
    } catch (error) {
      // 模型下载失败，询问用户如何处理
      showModelDownloadFailedModal();
      return;
    }
  }

  // 模型已就绪，显示解析配置确认弹窗
  setShowParseConfirm(true);
};
```

## 实施步骤

1. **修改 EmbeddingService.ts**
   - 添加下载状态管理
   - 实现多源下载
   - 添加手动下载指引

2. **创建 ModelDownloadProgress 组件**
   - 显示下载进度
   - 显示失败提示
   - 提供手动下载指引

3. **修改 VectorMemoryToggle 组件**
   - 集成下载进度显示
   - 处理下载失败情况

4. **修改 ScriptManager.tsx**
   - 解析前检查模型状态
   - 下载失败时提供选项

## 预期效果

- ✅ 用户开启智能记忆后，自动开始下载模型
- ✅ 显示下载进度，让用户知道当前状态
- ✅ 下载失败时，提供清晰的手动下载指引
- ✅ 不影响主流程，用户可以选择使用标准模式继续
- ✅ 已下载过模型的用户，跳过下载直接启用
