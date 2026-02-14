# AI影视资产生成平台项目规则

## 项目概述

本项目是一个基于AI的影视资产生成平台，支持通过文字描述（Prompt）生成图像和视频资产。平台采用现代Web技术栈构建，提供直观的前端界面与灵活的AI服务集成架构。系统设计遵循模块化原则，支持多AI提供商（Provider）接入，具备任务队列管理、本地存储、批处理生成等核心能力。

**技术栈概览**：React 18 + TypeScript + Vite + HeroUI + TailwindCSS

**核心功能模块**：

- 文本到图像生成（Image Generation）
- 图像到视频生成（Video Generation）
- 多模态参考图像支持
- 任务队列管理与状态监控
- 项目与资产管理（角色、场景、物品、视频片段）
- 本地文件系统集成（OPFS/IndexedDB）

---

## 项目目录结构

```
d:\kemeng-Ai\
├── components/                    # 前端React组件
│   ├── AssetList.tsx             # 资产列表通用组件
│   ├── JobMonitor.tsx            # 任务监控面板
│   ├── Layout.tsx                # 应用主布局
│   ├── LoadingView.tsx           # 加载状态视图
│   ├── PreviewProvider.tsx       # 预览上下文提供者
│   ├── ResourcePicker.tsx        # 资源选择器
│   ├── WelcomeView.tsx           # 欢迎页面
│   └── ProjectDetail/            # 项目详情模块
│       ├── AssetPreview.tsx      # 资产预览组件
│       ├── CharacterSidebar.tsx  # 角色侧边栏
│       ├── DetailView.tsx        # 详情视图
│       ├── FragmentSidebar.tsx   # 片段侧边栏
│       ├── GenerationForm.tsx    # 生成表单
│       ├── ItemSidebar.tsx       # 物品侧边栏
│       ├── SceneSidebar.tsx      # 场景侧边栏
│       ├── Character/            # 角色详情模块
│       │   └── CharacterDetail.tsx
│       ├── Fragment/             # 片段详情模块
│       │   └── FragmentDetail.tsx
│       ├── Item/                 # 物品详情模块
│       │   └── ItemDetail.tsx
│       ├── Resource/             # 资源管理模块
│       │   └── ResourceManager.tsx
│       ├── Scene/                # 场景详情模块
│       │   └── SceneDetail.tsx
│       └── Shared/               # 共享组件
│           ├── DynamicModelParameters.tsx
│           ├── ImageGenerationPanel.tsx
│           └── StyleSelector.tsx
│
├── config/                       # 配置文件
│   ├── models.ts                 # AI模型配置定义
│   └── settings.ts               # 应用设置配置
│
├── contexts/                     # React上下文
│   ├── AppContext.tsx            # 应用状态上下文
│   ├── ToastContext.tsx          # 提示消息上下文
│   └── context.tsx               # 通用上下文
│
├── public/styles/                # 静态资源（风格参考图）
│   ├── anime.png
│   ├── cyberpunk.png
│   ├── game.png
│   ├── gothic.png
│   ├── movie.png
│   ├── photorealistic.png
│   └── shinkai.png
│
├── services/                     # 核心服务层
│   ├── aiService.ts              # AI生成服务（主入口）
│   ├── fileUtils.ts              # 文件操作工具
│   ├── metadata.ts               # 媒体元数据提取
│   ├── modelUtils.ts             # 模型配置工具
│   ├── prompt.ts                 # Prompt处理工具
│   ├── queue.ts                  # 任务队列管理
│   ├── storage.ts                # 存储服务（IndexedDB/OPFS）
│   └── ai/                       # AI服务模块
│       ├── definitions.ts        # 类型定义
│       ├── interfaces.ts         # 接口定义
│       ├── adapters/             # 适配器
│       │   └── volcengine/       # 火山引擎适配器
│       │       └── strategies.ts
│       └── providers/            # AI提供商实现
│           ├── BaseProvider.ts   # 基类
│           ├── ModelscopeProvider.ts
│           ├── ViduProvider.ts
│           └── VolcengineProvider.ts
│
├── views/                        # 页面视图
│   ├── Dashboard.tsx             # 仪表板页面
│   ├── ProjectDetail.tsx         # 项目详情页面
│   ├── Settings.tsx              # 设置页面
│   └── Tasks.tsx                 # 任务页面
│
├── App.tsx                       # 应用根组件
├── index.tsx                     # 入口文件
├── types.ts                      # 核心类型定义
├── vite.config.ts                # Vite配置
├── tailwind.config.js            # TailwindCSS配置
├── tsconfig.json                 # TypeScript配置
├── package.json                  # 依赖配置
└── CLAUDE.md                     # 本项目规则文件
```

---

## 核心类型系统

### 资产类型（AssetType枚举）

```typescript
// 定义于types.ts
enum AssetType {
  CHARACTER = 'character',      // 角色资产
  SCENE = 'scene',              // 场景资产
  ITEM = 'item',                // 物品/道具资产
  VIDEO_SEGMENT = 'video_segment', // 视频片段
  RESOURCES = 'resources',      # 资源集合
  IMAGE = 'image',              # 独立图像
  VIDEO = 'video'               # 独立视频
}
```

### 任务状态（JobStatus枚举）

```typescript
enum JobStatus {
  PENDING = 'pending',      // 等待处理
  PROCESSING = 'processing', // 处理中
  COMPLETED = 'completed',   // 已完成
  FAILED = 'failed'          // 失败
}
```

### 核心数据结构

**Project（项目）**

```typescript
interface Project {
  id: string;              // 项目唯一标识
  name: string;            // 项目名称
  description: string;     // 项目描述
  createdAt: number;       // 创建时间戳
  updatedAt: number;       // 更新时间戳
}
```

**Asset（资产基类）**

```typescript
interface Asset {
  id: string;                    // 资产唯一标识
  projectId: string;             // 所属项目ID
  type: AssetType;               // 资产类型
  name: string;                  // 资产名称
  prompt: string;                // 生成提示词
  negativePrompt?: string;       // 负面提示词
  filePath?: string;             // 文件路径
  thumbnailPath?: string;        // 缩略图路径
  metadata?: Record<string, any>;// 扩展元数据
  category?: 'generated' | 'imported'; // 分类
  createdAt: number;             // 创建时间
  updatedAt: number;             // 更新时间
}
```

**Job（任务）**

```typescript
interface Job {
  id: string;                    // 任务ID
  type: 'generate_image' | 'generate_video'; // 任务类型
  status: JobStatus;             // 任务状态
  projectId: string;             // 项目ID
  params: any;                   // 任务参数
  result?: any;                  // 任务结果
  error?: string;                // 错误信息
  createdAt: number;             // 创建时间
  updatedAt: number;             // 更新时间
}
```

**GeneratedImage（生成的图像）**

```typescript
interface GeneratedImage {
  id: string;                    // 图像ID
  path: string;                  // 文件路径
  prompt: string;                // 提示词
  userPrompt?: string;           // 用户原始提示词
  modelConfigId: string;         // 模型配置ID
  modelId: string;               // API模型标识
  referenceImages: string[];     // 参考图像列表
  metadata?: Record<string, any>;// 元数据
  createdAt: number;             // 创建时间
  width?: number;                // 宽度
  height?: number;               // 高度
  size?: number;                 // 文件大小（字节）
}
```

**GeneratedVideo（生成的视频）**

```typescript
interface GeneratedVideo {
  id: string;                    // 视频ID
  name?: string;                 // 视频名称
  path: string;                  // 文件路径
  prompt: string;                // 提示词
  userPrompt?: string;           // 用户原始提示词
  modelConfigId: string;         // 模型配置ID
  modelId: string;               // API模型标识
  referenceImages?: string[];    // 参考图像
  metadata?: Record<string, any>;// 元数据
  params?: any;                  // 生成参数
  createdAt: number;             // 创建时间
  duration?: number;             // 时长（秒）
  width?: number;                // 宽度
  height?: number;               // 高度
}
```

**CharacterAsset（角色资产）**

```typescript
interface CharacterAsset extends Asset {
  gender?: 'male' | 'female' | 'unlimited';
  ageGroup?: 'childhood' | 'youth' | 'middle_aged' | 'elderly' | 'unknown';
  generatedImages?: GeneratedImage[];
  currentImageId?: string;
}
```

**SceneAsset（场景资产）**

```typescript
interface SceneAsset extends Asset {
  generatedImages?: GeneratedImage[];
  currentImageId?: string;
}
```

**ItemAsset（物品资产）**

```typescript
interface ItemAsset extends Asset {
  itemType: ItemType;            // 物品类型
  generatedImages?: GeneratedImage[];
  currentImageId?: string;
}

enum ItemType {
  PROP = 'prop',                 // 道具
  CREATURE = 'creature',         // 生物
  ANIMAL = 'animal',             // 动物
  EFFECT = 'effect',             // 特效
  REFERENCE = 'reference'        // 参考
}
```

**FragmentAsset（片段资产）**

```typescript
interface FragmentAsset extends Asset {
  videoName?: string;
  videos?: GeneratedVideo[];
  currentVideoId?: string;
  generatedImages?: GeneratedImage[];
}
```

**ModelCapabilities（模型能力配置）**

```typescript
interface ModelCapabilities {
  supportsImageInput?: boolean;           // 支持图像输入
  supportsVideoInput?: boolean;           // 支持视频输入
  supportsAudioGeneration?: boolean;      // 支持音频生成
  supportsReferenceImage?: boolean;       // 支持参考图像
  supportsStartFrame?: boolean;           // 支持起始帧（视频）
  supportsEndFrame?: boolean;             // 支持结束帧（视频）
  supportedGenerationTypes?: (
    'text_to_video' | 'first_last_frame' | 'multi_ref'
  )[];                                    // 支持的生成类型
  maxReferenceImages?: number;            // 最大参考图像数
  maxBatchSize?: number;                  // 最大批处理数量
  appendCountToPrompt?: boolean;          // 是否自动追加数量到提示词
  requiresImageInput?: boolean;           // 是否需要图像输入
  supportedResolutions?: string[];        // 支持的分辨率
  defaultResolution?: string;             // 默认分辨率
  minPixels?: number;                     // 最小像素数
  maxPixels?: number;                     // 最大像素数
  minAspectRatio?: number;                // 最小宽高比
  maxAspectRatio?: number;                // 最大宽高比
}
```

**ModelParameter（模型参数）**

```typescript
interface ModelParameter {
  name: string;                       // API参数名
  label: string;                      // UI显示标签
  type: 'string' | 'number' | 'boolean' | 'select'; // 参数类型
  options?: { label: string; value: any }[]; // 下拉选项
  defaultValue?: any;                 // 默认值
  min?: number;                       // 最小值（number类型）
  max?: number;                       // 最大值（number类型）
  step?: number;                      // 步长
  description?: string;               // 描述
  required?: boolean;                 // 是否必填
  visibilityCondition?: {             // 条件显示控制
    generationType?: ('text_to_video' | 'first_last_frame' | 'multi_ref')[];
    hasStartImage?: boolean;
    hasEndImage?: boolean;
  };
  hiddenCondition?: {                 // 条件隐藏控制
    generationType?: ('text_to_video' | 'first_last_frame' | 'multi_ref')[];
    hasStartImage?: boolean;
    hasEndImage?: boolean;
  };
}
```

**ModelConfig（模型配置）**

```typescript
interface ModelConfig {
  id: string;                         // 模板或实例ID
  name: string;                       // 显示名称
  provider: string;                   // 提供商标识
  modelId: string;                    // API模型标识
  type: 'image' | 'video';            // 模型类型
  capabilities: ModelCapabilities;    // 能力配置
  parameters: ModelParameter[];       // 参数列表
  templateId?: string;                // 实例关联的模板ID
  apiKey?: string;                    // API密钥（仅实例有）
  isDefault?: boolean;                // 是否默认模板
  apiUrl?: string;                    // API地址（可覆盖）
  providerOptions?: any;              // 提供商特定选项
}
```

**AppSettings（应用设置）**

```typescript
interface AppSettings {
  theme: ThemeMode;                  // 主题模式
  language: Language;                // 语言
  models: ModelConfig[];             // 模型配置列表
  pollingInterval: number;           // 轮询间隔（毫秒）
  useSandbox: boolean;               // 是否使用沙盒模式
}

type ThemeMode = 'light' | 'dark' | 'system';
type Language = 'en' | 'zh';
```

---

## AI服务架构

### 服务入口：AIService

**文件位置**：`services/aiService.ts`

AIService是AI生成的核心服务类，负责任务调度、批处理和提供商管理。

```typescript
class AIService {
  private providers: Map<string, IAIProvider> = new Map();

  constructor() {
    this.registerProvider(new VolcengineProvider());
    this.registerProvider(new ViduProvider());
    this.registerProvider(new ModelscopeProvider());
  }

  registerProvider(provider: IAIProvider): void {
    this.providers.set(provider.id, provider);
    console.log(`[AIService] Registered provider: ${provider.id}`);
  }

  createGenerationJobs(
    model: ModelConfig,
    params: GenerationJobParams,
    totalCount: number
  ): Job[] {
    const capabilities = model.capabilities || {};
    const maxBatchSize = capabilities.maxBatchSize || 4;

    const jobs: Job[] = [];
    let remaining = totalCount;

    while (remaining > 0) {
      const currentBatchCount = Math.min(remaining, maxBatchSize);
      const isSeedEdit = model.modelId.includes('seededit');

      const job: Job = {
        id: typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2) + Date.now().toString(36),
        projectId: params.projectId,
        type: 'generate_image',
        status: JobStatus.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        params: {
          prompt: params.prompt,
          userPrompt: params.userPrompt,
          model: model.id,
          modelConfigId: model.id,
          modelId: model.modelId,
          assetName: params.assetName,
          assetType: params.assetType,
          assetId: params.assetId,
          projectId: params.projectId,
          referenceImages: params.referenceImages,
          aspectRatio: params.aspectRatio,
          resolution: params.resolution,
          generateCount: currentBatchCount,
          style: params.style,
          guidanceScale: isSeedEdit ? params.guidanceScale : undefined
        }
      };

      jobs.push(job);
      remaining -= currentBatchCount;
    }

    return jobs;
  }

  createVideoGenerationJobs(
    model: ModelConfig,
    params: VideoGenerationJobParams,
    totalCount: number
  ): Job[] { /* 视频任务创建逻辑 */ }
}
```

**GenerationJobParams接口**

```typescript
interface GenerationJobParams {
  projectId: string;            // 项目ID
  prompt: string;               // 生成提示词
  userPrompt?: string;          // 用户原始提示词
  assetName: string;            // 资产名称
  assetType: AssetType;         // 资产类型
  assetId: string;              // 资产ID
  referenceImages?: string[];   // 参考图像
  aspectRatio?: string;         // 宽高比
  resolution?: string;          // 分辨率
  style?: string;               // 风格
  guidanceScale?: number;       // 引导强度
}
```

**VideoGenerationJobParams接口**

```typescript
interface VideoGenerationJobParams {
  projectId: string;
  prompt: string;
  userPrompt?: string;
  assetName: string;
  assetType: AssetType;
  assetId: string;
  duration?: number;
  ratio?: string;
  startImage?: string;
  endImage?: string;
  referenceImages?: string[];
  extraParams?: Record<string, any>;
}
```

### AI提供商接口（IAIProvider）

**文件位置**：`services/ai/interfaces.ts`

所有AI提供商必须实现以下接口：

```typescript
interface IAIProvider {
  id: string;  // 提供商标识（如'volcengine'、'modelscope'、'vidu'）

  generateImage(
    prompt: string,
    config: ModelConfig,
    referenceImages?: string[],
    aspectRatio?: string,
    resolution?: string,
    count?: number,
    guidanceScale?: number,
    extraParams?: Record<string, any>
  ): Promise<AIResult>;

  generateVideo(
    prompt: string,
    config: ModelConfig,
    startImage?: string,
    endImage?: string,
    existingTaskId?: string,
    onTaskId?: (id: string) => void,
    extraParams?: Record<string, any>
  ): Promise<AIResult>;

  validateConfig(config: ModelConfig): boolean;
}
```

**AIResult返回格式**

```typescript
interface AIResult {
  success: boolean;      // 是否成功
  data?: any;            // 成功时的数据
  meta?: any;            // 额外元数据
  error?: string;        // 错误信息
}
```

### BaseProvider基类

**文件位置**：`services/ai/providers/BaseProvider.ts`

提供通用功能实现，包括API密钥管理、请求代理、Blob处理等。

```typescript
abstract class BaseProvider implements IAIProvider {
  abstract id: string;

  abstract generateImage(...): Promise<AIResult>;
  abstract generateVideo(...): Promise<AIResult>;

  validateConfig(config: ModelConfig): boolean {
    return !!config.apiKey;
  }

  protected getApiKey(config: ModelConfig): string {
    const key = config.apiKey || process.env.API_KEY;
    if (!key) {
      throw new Error(`API Key is missing for model: ${config.name}`);
    }
    return key;
  }

  protected async loadBlobAsBase64(urlOrPath: string): Promise<string | null> {
    if (urlOrPath.startsWith('data:')) return urlOrPath;

    try {
      let blob: Blob;
      if (urlOrPath.startsWith('http')) {
        const res = await this.makeRequest(urlOrPath);
        blob = await res.blob();
      } else {
        const storageUrl = await storageService.getAssetUrl(urlOrPath);
        if (!storageUrl) return null;
        const res = await fetch(storageUrl);
        blob = await res.blob();
      }
      return await this.blobToBase64DataUri(blob);
    } catch (e) {
      console.error("Failed to load blob as base64", e);
      return null;
    }
  }

  protected blobToBase64DataUri(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  protected async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const isLocalhost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const shouldUseProxy = import.meta.env.DEV || isLocalhost;

    if (shouldUseProxy) {
      const proxyUrl = '/api/universal-proxy';
      const headers = new Headers(options.headers || {});
      if (!headers.has('X-Target-URL')) {
        headers.set('X-Target-URL', url);
      }
      return fetch(proxyUrl, { ...options, headers });
    }

    return fetch(url, options);
  }
}
```

### 提供商实现

#### ModelscopeProvider

**文件位置**：`services/ai/providers/ModelscopeProvider.ts`

ModelScope API集成，支持图像生成和异步任务轮询。

```typescript
export class ModelscopeProvider extends BaseProvider {
  id = 'modelscope';

  private getBaseUrl(config?: ModelConfig): string {
    return config?.apiUrl || 'https://api-inference.modelscope.cn/v1';
  }

  async generateImage(
    prompt: string,
    config: ModelConfig,
    referenceImages?: string[],
    aspectRatio?: string,
    resolution: string = '1024x1024',
    count: number = 1,
    guidanceScale?: number,
    extraParams?: Record<string, any>
  ): Promise<AIResult> {
    try {
      const apiKey = this.getApiKey(config);
      const baseUrl = this.getBaseUrl(config);

      const body: any = {
        model: config.modelId,
        prompt: prompt,
        n: count > 1 ? count : undefined,
      };

      if (resolution) {
        body.size = resolution;
      }

      if (guidanceScale) {
        body.guidance_scale = guidanceScale;
      }

      if (referenceImages && referenceImages.length > 0) {
        const images: string[] = [];
        for (const path of referenceImages) {
          const b64 = await this.loadBlobAsBase64(path);
          if (b64) images.push(b64);
        }
        if (images.length > 0) {
          body.images = images;
        }
      }

      if (extraParams) {
        Object.assign(body, extraParams);
      }

      const submitResponse = await this.makeRequest(
        `${baseUrl}/images/generations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'X-ModelScope-Async-Mode': 'true'
          },
          body: JSON.stringify(body)
        }
      );

      if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        throw new Error(`Modelscope API Error (${submitResponse.status}): ${errorText}`);
      }

      const submitData: any = await submitResponse.json();
      const taskId = submitData.task_id;

      if (!taskId) {
        throw new Error("Failed to get task_id from Modelscope API");
      }

      return await this.pollTask(taskId, apiKey, baseUrl);
    } catch (error: any) {
      console.error(`[ModelscopeProvider] Exception:`, error);
      return { success: false, error: error.message };
    }
  }

  private async pollTask(taskId: string, apiKey: string, baseUrl: string): Promise<AIResult> {
    const pollUrl = `${baseUrl}/tasks/${taskId}`;
    const maxAttempts = 86400 / 3;
    const interval = 12000;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await this.makeRequest(pollUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'X-ModelScope-Task-Type': 'image_generation'
          }
        });

        if (!response.ok) {
          if (response.status >= 500) {
            await new Promise(r => setTimeout(r, interval));
            continue;
          }
          const errorText = await response.text();
          throw new Error(`Modelscope polling error (${response.status}): ${errorText}`);
        }

        const data: ModelscopeTaskResponse = await response.json();

        if (data.task_status === 'SUCCEED') {
          if (data.output_images && data.output_images.length > 0) {
            const results = data.output_images.map((url: string) => ({ url }));
            return { success: true, data: results, meta: data };
          }
          return { success: false, error: "Task succeeded but no images found", meta: data };
        }

        if (data.task_status === 'FAILED') {
          const errorMsg = data.errors?.message || 'Unknown error';
          return { success: false, error: `Task failed: ${errorMsg}`, meta: data };
        }
      } catch (e: any) {
        console.error(`[ModelscopeProvider] Polling exception for task ${taskId}:`, e);
      }

      await new Promise(r => setTimeout(r, interval));
    }

    return { success: false, error: "Image generation timed out (24h limit)" };
  }
}
```

#### VolcengineProvider

**文件位置**：`services/ai/providers/VolcengineProvider.ts`

火山引擎AI服务集成，支持图像和视频生成。

#### ViduProvider

**文件位置**：`services/ai/providers/ViduProvider.ts`

Vidu视频生成服务集成，支持图像到视频转换。

---

## 任务队列系统

### JobQueue类

**文件位置**：`services/queue.ts`

负责任务的添加、处理调度和状态通知。

```typescript
type JobUpdateCallback = (job: Job) => void;

export class JobQueue {
  private processingCount = 0;
  private inFlightIds = new Set<string>();
  private listeners: JobUpdateCallback[] = [];

  subscribe(callback: JobUpdateCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  hasActiveJobs(): boolean {
    return this.processingCount > 0 || this.inFlightIds.size > 0;
  }

  private notify(job: Job) {
    this.listeners.forEach(cb => cb(job));
  }

  async addJob(job: Job) {
    await storageService.saveJob(job);
    this.notify(job);
    this.processQueue();
  }

  async addJobs(jobs: Job[]) {
    if (jobs.length === 0) return;
    await storageService.saveJobs(jobs);
    jobs.forEach(job => this.notify(job));
    this.processQueue();
  }

  async loadQueue() {
    this.processQueue();
  }

  private async updateAssetWithResult(job: Job, resultPaths: string[]) {
    const projectId = job.params.projectId || job.projectId;
    if (!job.params.assetId || !projectId) {
      console.warn('[Queue] Missing assetId or projectId for asset update', job.params);
      return;
    }

    try {
      await storageService.updateAsset(job.params.assetId, projectId, async (asset) => {
        if (job.type === 'generate_image') {
          const charAsset = asset as CharacterAsset;
          const finalPrompt = job.params.userPrompt || job.params.prompt || "";

          const newImages: GeneratedImage[] = await Promise.all(
            resultPaths.map(async path => {
              const uuid = typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : Math.random().toString(36).substring(2) + Date.now().toString(36);

              let metadata = {};
              try {
                metadata = await getMediaMetadata(path);
              } catch (e) {
                console.warn(`[Queue] Failed to extract metadata for ${path}`, e);
              }

              return {
                id: uuid,
                path: path,
                prompt: finalPrompt,
                userPrompt: job.params.userPrompt,
                modelConfigId: job.params.model,
                modelId: job.params.modelId || job.params.model,
                createdAt: Date.now(),
                referenceImages: job.params.referenceImages,
                ...metadata,
                metadata: {
                  aspectRatio: job.params.aspectRatio,
                  resolution: job.params.resolution,
                  fullPrompt: job.params.prompt,
                  style: job.params.style,
                  generateCount: job.params.generateCount,
                  guidanceScale: job.params.guidanceScale
                }
              };
            })
          );

          const existingImages = charAsset.generatedImages || [];
          charAsset.generatedImages = [...existingImages, ...newImages];
          if (!charAsset.currentImageId && newImages.length > 0) {
            charAsset.currentImageId = newImages[0].id;
          }

          return charAsset;
        }
        return asset;
      });
    } catch (e) {
      console.error('[Queue] Failed to update asset:', e);
    }
  }

  private async processQueue() {
    // 任务处理逻辑
  }
}
```

---

## 存储服务架构

### StorageService类

**文件位置**：`services/storage.ts`

提供IndexedDB和OPFS（Origin Private File System）双模式存储。

```typescript
export interface ResourceItem {
  id: string;
  path: string;
  type: 'image' | 'video';
  source: 'generated' | 'imported';
  sourceAssetId?: string;
  sourceAssetType?: AssetType;
  sourceAssetName?: string;
  metadata?: {
    width?: number;
    height?: number;
    size?: number;
    duration?: number;
    fps?: number;
    modelId?: string;
    fileType?: string;
  };
  prompt?: string;
  generationParams?: any;
  createdAt: number;
}

export class StorageService {
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private useOpfs: boolean = false;
  private isFsResponsive: boolean = true;
  private locks: Map<string, Promise<void>> = new Map();

  private async lock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    let resolveUnlock: () => void;
    const newLock = new Promise<void>((resolve) => {
      resolveUnlock = resolve;
    });

    const currentLock = this.locks.get(key) || Promise.resolve();
    this.locks.set(key, currentLock.then(() => newLock));

    try {
      await currentLock.catch(() => {});
      return await fn();
    } finally {
      resolveUnlock!();
    }
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return null;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn("IndexedDB opening timed out.");
        resolve(null);
      }, 1000);

      try {
        const request = indexedDB.open('ai_video_shorts_db', 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('handles');
        };
        request.onsuccess = () => {
          clearTimeout(timeout);
          resolve(request.result);
        };
        request.onerror = () => {
          clearTimeout(timeout);
          resolve(null);
        };
      } catch (e) {
        clearTimeout(timeout);
        resolve(null);
      }
    });
  }

  async isConnected(): Promise<boolean> {
    return !!this.directoryHandle;
  }

  isOpfs(): boolean {
    return this.useOpfs;
  }

  isResponsive(): boolean {
    return this.isFsResponsive;
  }

  async getAssetUrl(path: string): Promise<string | null> {
    return null;
  }

  async saveJob(job: Job): Promise<void> {}
  async saveJobs(jobs: Job[]): Promise<void> {}
  async updateAsset(
    assetId: string,
    projectId: string,
    updater: (asset: Asset) => Promise<Asset>
  ): Promise<void> {}
  async loadProject(id: string): Promise<Project | null> {}
  async saveProject(project: Project): Promise<void> {}
  async loadSettings(): Promise<AppSettings | null> {}
  async saveSettings(settings: AppSettings): Promise<void> {}
  async resetWorkspace(): Promise<void> {}
  async getWorkspaceName(): Promise<string> {}
}
```

---

## 前端组件架构

### GenerationForm组件

**文件位置**：`components/ProjectDetail/GenerationForm.tsx`

核心生成表单组件，提供参数配置和生成触发功能。

```typescript
interface GenerationParams {
  prompt: string;
  modelId: string;
  referenceImages?: string[];
  startImage?: string;
  endImage?: string;
  aspectRatio?: string;
  resolution?: string;
  count?: number;
  guidanceScale?: number;
  extraParams?: Record<string, any>;
}

interface GenerationFormProps {
  prompt: string;
  setPrompt: (s: string) => void;
  selectedModelId: string;
  setSelectedModelId: (s: string) => void;
  generating: boolean;
  onGenerate: (params: GenerationParams) => void;
  models: ModelConfig[];
  t: any;
}

const GenerationForm: React.FC<GenerationFormProps> = ({
  prompt, setPrompt,
  selectedModelId, setSelectedModelId,
  generating, onGenerate,
  models, t
}) => {
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [startImage, setStartImage] = useState<string>('');
  const [endImage, setEndImage] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [resolution, setResolution] = useState<string>('2K');
  const [count, setCount] = useState<number>(1);
  const [guidanceScale, setGuidanceScale] = useState<number>(2.5);
  const [extraParams, setExtraParams] = useState<Record<string, any>>({});

  const selectedModel = models.find(m => m.id === selectedModelId);
  const staticModel = resolveModelConfig(selectedModel);

  const modelConfig = React.useMemo(() => {
    if (!selectedModel) return staticModel;
    return {
      ...staticModel,
      ...selectedModel,
      parameters: staticModel?.parameters || selectedModel?.parameters
    };
  }, [selectedModel, staticModel]);

  const capabilities = {
    ...staticModel?.capabilities,
    ...selectedModel?.capabilities,
    supportedResolutions: (selectedModel?.capabilities?.supportedResolutions &&
      selectedModel.capabilities.supportedResolutions.length > 0)
      ? selectedModel.capabilities.supportedResolutions
      : staticModel?.capabilities?.supportedResolutions,
    minPixels: selectedModel?.capabilities?.minPixels ?? staticModel?.capabilities?.minPixels,
    maxPixels: selectedModel?.capabilities?.maxPixels ?? staticModel?.capabilities?.maxPixels,
    minAspectRatio: selectedModel?.capabilities?.minAspectRatio ?? staticModel?.capabilities?.minAspectRatio,
    maxAspectRatio: selectedModel?.capabilities?.maxAspectRatio ?? staticModel?.capabilities?.maxAspectRatio,
  };

  const isImageModel = selectedModel?.type === 'image';
  const isVideoModel = selectedModel?.type === 'video';
  const isSeedEdit = selectedModel?.modelId?.includes('seededit');
  const maxBatchSize = capabilities.maxBatchSize || 1;

  const availableResolutions = capabilities.supportedResolutions || ['2K', '4K'];

  const allAspectRatios = [
    '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'
  ];
  const availableAspectRatios = allAspectRatios.filter(ratio => {
    const [w, h] = ratio.split(':').map(Number);
    const val = w / h;
    if (capabilities.minAspectRatio && val < capabilities.minAspectRatio) return false;
    if (capabilities.maxAspectRatio && val > capabilities.maxAspectRatio) return false;
    return true;
  });

  const handleGenerate = () => {
    onGenerate({
      prompt,
      modelId: selectedModelId,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      startImage: startImage || undefined,
      endImage: endImage || undefined,
      aspectRatio,
      resolution,
      count,
      guidanceScale,
      extraParams
    });
  };

  return (
    <div className="generation-form">
      {/* 模型选择 */}
      <Select
        label="Model"
        selectedKeys={[selectedModelId]}
        onSelectionChange={(keys) => setSelectedModelId(Array.from(keys)[0] as string)}
      >
        {models.map(model => (
          <SelectItem key={model.id}>{model.name}</SelectItem>
        ))}
      </Select>

      {/* Prompt输入 */}
      <Textarea
        label="Prompt"
        placeholder="Describe your content in detail..."
        value={prompt}
        onValueChange={setPrompt}
      />

      {/* 参考图像上传 */}
      <input
        type="file"
        ref={refInputRef}
        accept="image/*"
        multiple
        onChange={handleRefImageChange}
        style={{ display: 'none' }}
      />
      <Button onPress={() => refInputRef.current?.click()}>
        Upload Reference Images
      </Button>

      {/* 参数配置 */}
      <DynamicModelParameters
        model={modelConfig}
        params={extraParams}
        onChange={setExtraParams}
      />

      {/* 生成按钮 */}
      <Button
        color="primary"
        onPress={handleGenerate}
        isLoading={generating}
      >
        Generate
      </Button>
    </div>
  );
};
```

### JobMonitor组件

**文件位置**：`components/JobMonitor.tsx`

任务监控面板，显示任务队列状态和进度。

### AssetPreview组件

**文件位置**：`components/ProjectDetail/AssetPreview.tsx`

资产预览组件，支持图像和视频的展示。

### 侧边栏组件

各类型资产的侧边栏管理：

- `CharacterSidebar.tsx`：角色资产侧边栏
- `SceneSidebar.tsx`：场景资产侧边栏
- `ItemSidebar.tsx`：物品资产侧边栏
- `FragmentSidebar.tsx`：片段资产侧边栏

### DetailView组件

**文件位置**：`components/ProjectDetail/DetailView.tsx`

详情视图组件，根据资产类型显示不同的详情面板。

---

## 模型配置管理

### 默认模型配置

**文件位置**：`config/models.ts`

```typescript
const COMMON_IMAGE_PARAMS: ModelParameter[] = [
  {
    name: "guidanceScale",
    label: "Guidance Scale",
    type: "number",
    defaultValue: 3.5,
    min: 1,
    max: 20,
    step: 0.1,
  },
  {
    name: "seed",
    label: "Seed",
    type: "number",
    defaultValue: -1,
    description: "Random seed (-1 for random)",
  },
];

const COMMON_VOLC_VIDEO_PARAMS: ModelParameter[] = [
  {
    name: "resolution",
    label: "Resolution",
    type: "select",
    options: [
      { label: "480p", value: "480p" },
      { label: "720p", value: "720p" },
      { label: "1080p", value: "1080p" },
    ],
    defaultValue: "720p",
  },
  {
    name: "seed",
    label: "Seed",
    type: "number",
    defaultValue: -1,
    description: "Random seed (-1 for random)",
  },
  {
    name: "watermark",
    label: "Watermark",
    type: "boolean",
    defaultValue: false,
  },
  {
    name: "cameraFixed",
    label: "Camera Fixed",
    type: "boolean",
    defaultValue: false,
  },
];

const COMMON_VIDU_PARAMS: ModelParameter[] = [
  {
    name: "bgm",
    label: "Background Music",
    type: "boolean",
    defaultValue: false,
    hiddenCondition: {
      generationType: ["first_last_frame"],
      hasEndImage: false,
    },
  },
  {
    name: "seed",
    label: "Seed",
    type: "number",
    defaultValue: 0,
    description: "Random seed (0 for random)",
  },
  {
    name: "watermark",
    label: "Watermark",
    type: "boolean",
    defaultValue: false,
  },
  {
    name: "offPeak",
    label: "Off Peak",
    type: "boolean",
    defaultValue: false,
  },
];

const VIDU_MOVEMENT_PARAM: ModelParameter = {
  name: "movementAmplitude",
  label: "Movement Amplitude",
  type: "number",
  defaultValue: 5,
  min: 1,
  max: 10,
  step: 1,
  description: "Control camera movement intensity",
};
```

### 模型参数定义

**文件位置**：`services/ai/definitions.ts`

```typescript
interface ParamDefinition {
  labelKey: string;
  format?: (value: any) => string;
}

export const AI_PARAM_DEFINITIONS: Record<string, ParamDefinition> = {
  aspectRatio: { labelKey: 'aiParams.aspectRatio' },
  resolution: { labelKey: 'aiParams.resolution' },
  guidanceScale: { labelKey: 'aiParams.guidanceScale' },
  step: { labelKey: 'aiParams.step' },
  steps: { labelKey: 'aiParams.step' },
  strength: { labelKey: 'aiParams.strength' },
  sampler: { labelKey: 'aiParams.sampler' },
  seed: { labelKey: 'aiParams.seed' },
  negativePrompt: { labelKey: 'aiParams.negativePrompt' },
  modelConfigId: { labelKey: 'aiParams.modelConfigId' },
  style: { labelKey: 'aiParams.style' },
  generateCount: { labelKey: 'aiParams.generateCount' },
  duration: { labelKey: 'aiParams.duration' },
  fps: { labelKey: 'aiParams.fps' },
};
```

---

## Prompt工具函数库

### 风格提示词配置

**文件位置**：`services/prompt.ts`

系统预置8种风格模板：

```typescript
export const DefaultStylePrompt = {
  'movie': {
    nameEN: 'movie',
    nameCN: '电影质感',
    image: '/styles/movie.png',
    prompt: 'cinematic lighting, movie still, shot on 35mm, realistic, 8k, masterpiece'
  },
  'photorealistic': {
    nameEN: 'photorealistic',
    nameCN: '高清实拍',
    image: '/styles/photorealistic.png',
    prompt: 'photorealistic, raw photo, DSLR, sharp focus, high fidelity, 4k texture'
  },
  'gothic': {
    nameEN: 'gothic',
    nameCN: '暗黑哥特',
    image: '/styles/gothic.png',
    prompt: 'gothic style, dark atmosphere, gloomy, fog, horror theme, muted colors'
  },
  'cyberpunk': {
    nameEN: 'cyberpunk',
    nameCN: '赛博朋克',
    image: '/styles/cyberpunk.png',
    prompt: 'cyberpunk, neon lights, futuristic, rainy street, blue and purple hue'
  },
  'anime': {
    nameEN: 'anime',
    nameCN: '日漫风格',
    image: '/styles/anime.png',
    prompt: 'anime style, 2D animation, cel shading, vibrant colors, clean lines'
  },
  'shinkai': {
    nameEN: 'shinkai',
    nameCN: '新海诚风',
    image: '/styles/shinkai.png',
    prompt: 'Makoto Shinkai style, beautiful sky, lens flare, detailed background, emotional'
  },
  'game': {
    nameEN: 'game',
    nameCN: '游戏原画',
    image: '/styles/game.png',
    prompt: 'game cg, splash art, highly detailed, epic composition, fantasy style'
  },
};

export const getDefaultStylePrompt = (style: string = ''): string => {
  return style ? (DefaultStylePrompt[style]?.prompt || '') : '';
};

export const getRoleImagePrompt = (
  userPrompt: string,
  age: string,
  gender: string
): string => {
  let details = '';
  if (age && age !== 'unknown' && age !== '不详' && age !== 'unknown') {
    details += `角色年龄段: ${age}\n`;
  }
  if (gender && gender !== 'unlimited' && gender !== '不限' && gender !== 'unlimited') {
    details += `性别: ${gender}\n`;
  }

  return `
    生成一张高质量的人物角色设定图，在纯白色的背景上并排展示同一个角色的全身三视图，分别包含：正面视图、侧面视图和背面视图。
    ${details}角色特征: ${userPrompt}
    画面要求：
    人物保持自然站立的姿势，三个角度的服装细节和身体比例必须保持严格一致。画面风格清晰、锐利，光照均匀，无阴影干扰，展现出专业的概念设计图效果。
  `;
};

export const getItemImagePrompt = (
  userPrompt: string,
  itemType: string
): string => {
  return `
    生成一张高质量的物品设定图，在纯白色的背景上展示。
    物品类型: ${itemType}
    物品特征: ${userPrompt}
    画面要求：
    画面风格清晰、锐利，光照均匀，无阴影干扰，展现出专业的概念设计图效果。
  `;
};

export const getSceneImagePrompt = (userPrompt: string): string => {
  return `
    生成一张高质量的场景设定图。
    场景描述：${userPrompt}
  `;
};
```

---

## 模型配置工具

### 统一参数键（UNIFIED_KEYS）

**文件位置**：`services/modelUtils.ts`

```typescript
export const UNIFIED_KEYS = {
  RESOLUTION: 'resolution',
  ASPECT_RATIO: 'aspectRatio',
  DURATION: 'duration',
  GUIDANCE_SCALE: 'guidanceScale',
  NEGATIVE_PROMPT: 'negativePrompt',
  SEED: 'seed',
  COUNT: 'count',
  STYLE: 'style',
  OFF_PEAK: 'offPeak',
  RESPONSE_FORMAT: 'responseFormat',
  GENERATE_AUDIO: 'generateAudio',
  WATERMARK: 'watermark',
  FRAMES: 'frames',
  FPS: 'framesPerSecond',
  CAMERA_FIXED: 'cameraFixed',
  RETURN_LAST_FRAME: 'returnLastFrame',
  MOVEMENT_AMPLITUDE: 'movementAmplitude',
  BGM: 'bgm',
  VOICE_ID: 'voiceId',
  IS_REC: 'isRec',
  PAYLOAD: 'payload',
  AUDIO: 'audio',
};

export const resolveModelConfig = (
  runtimeModel: ModelConfig | undefined
): ModelConfig | undefined => {
  if (!runtimeModel) return undefined;

  if (runtimeModel.templateId) {
    const templateMatch = DEFAULT_MODELS.find(m => m.id === runtimeModel.templateId);
    if (templateMatch) return templateMatch;
  }

  const exactMatch = DEFAULT_MODELS.find(
    m => m.id === runtimeModel.id || m.modelId === runtimeModel.modelId
  );
  if (exactMatch) return exactMatch;

  return DEFAULT_MODELS.find(
    m => m.provider === runtimeModel.provider && m.type === runtimeModel.type
  );
};

export const getUnifiedModelParams = (
  modelConfig: ModelConfig | undefined
): string[] => {
  if (!modelConfig || !modelConfig.parameters) return [];
  return modelConfig.parameters.map(p => p.name);
};

export const getModelParamInfo = (
  modelConfig: ModelConfig | undefined,
  paramKey: string
): ModelParameter | undefined => {
  if (!modelConfig || !modelConfig.parameters) return undefined;
  return modelConfig.parameters.find(p => p.name === paramKey);
};
```

---

## 文件工具函数

### 文件类型检测

**文件位置**：`services/fileUtils.ts`

```typescript
export const VIDEO_EXTENSIONS = [
  'mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv',
  'flv', 'wmv', 'm4v', '3gp'
];

export const IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp',
  'bmp', 'tiff', 'svg', 'ico'
];

export const isVideoFile = (path?: string): boolean => {
  if (!path) return false;
  const cleanPath = path.split(/[?#]/)[0];
  return new RegExp(`\\.(${VIDEO_EXTENSIONS.join('|')})$`, 'i').test(cleanPath);
};

export const isImageFile = (path?: string): boolean => {
  if (!path) return false;
  const cleanPath = path.split(/[?#]/)[0];
  return new RegExp(`\\.(${IMAGE_EXTENSIONS.join('|')})$`, 'i').test(cleanPath);
};

export const getFileType = (path?: string): 'video' | 'image' | 'unknown' => {
  if (isVideoFile(path)) return 'video';
  if (isImageFile(path)) return 'image';
  return 'unknown';
};

export const getMimeType = (path?: string): string => {
  if (!path) return 'application/octet-stream';
  const cleanPath = path.split(/[?#]/)[0];
  const ext = cleanPath.split('.').pop()?.toLowerCase();

  if (!ext) return 'application/octet-stream';

  switch (ext) {
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'ogg': return 'video/ogg';
    case 'mov': return 'video/quicktime';
    case 'avi': return 'video/x-msvideo';
    case 'mkv': return 'video/x-matroska';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
};
```

---

## 媒体元数据提取

### 元数据接口

**文件位置**：`services/metadata.ts`

```typescript
export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
  size?: number;
  fps?: number;
  fileType?: string;
}

export const extractMp4Fps = async (blob: Blob): Promise<number | undefined> => {
  try {
    const buffer = await blob.slice(0, 256 * 1024).arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    let timescale: number | undefined;
    let sampleDelta: number | undefined;

    let offset = 0;
    while (offset < bytes.length - 8) {
      if (!timescale &&
          bytes[offset] === 0x6d && bytes[offset+1] === 0x64 &&
          bytes[offset+2] === 0x68 && bytes[offset+3] === 0x64) {
        const version = view.getUint8(offset + 4);
        timescale = view.getUint32(offset + (version === 0 ? 16 : 24));
      }

      if (!sampleDelta &&
          bytes[offset] === 0x73 && bytes[offset+1] === 0x74 &&
          bytes[offset+2] === 0x74 && bytes[offset+3] === 0x73) {
        const entryCount = view.getUint32(offset + 8);
        if (entryCount > 0) {
          sampleDelta = view.getUint32(offset + 16);
        }
      }

      if (timescale && sampleDelta) break;
      offset++;
    }

    if (timescale && sampleDelta) {
      return Math.round(timescale / sampleDelta);
    }
  } catch (e) {
    console.error('[Metadata] FPS extraction failed:', e);
  }
  return undefined;
};
```

---

## 应用配置

### 默认设置

**文件位置**：`config/settings.ts`

```typescript
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'zh',
  models: [],
  pollingInterval: 5000,
  useSandbox: false
};
```

### 多语言配置

**文件位置**：`locales.ts`

```typescript
export const translations = {
  en: {
    appTitle: "Nanshan AI Animata",
    sidebar: {
      openWorkspace: "Open Workspace",
      dashboard: "Dashboard",
      projectOverview: "Overview",
      settings: "Settings",
      project: "Project"
    },
    workspace: {
      selectTitle: "Select Workspace",
      selectDesc: "To respect your privacy and ensure data ownership, please select a local folder to store your projects and assets.",
      button: "Open Local Folder"
    },
    dashboard: {
      title: "My Projects",
      subtitle: "Manage and organize your AI video shorts.",
      newProject: "New Project"
    },
    project: {
      create: "Create New",
      generate: "Generate",
      library: "Library",
      assets: "Assets",
      characters: "Characters",
      scenes: "Scenes",
      items: "Items",
      resources: "Resources"
    }
  },
  zh: {
    appTitle: "南山AI短剧版",
    sidebar: {
      openWorkspace: "打开工作区",
      dashboard: "仪表板",
      projectOverview: "概览",
      settings: "设置",
      project: "项目"
    },
    workspace: {
      selectTitle: "选择工作区",
      selectDesc: "为了尊重您的隐私并确保数据所有权，请选择一个本地文件夹来存储您的项目和资产。",
      button: "打开本地文件夹"
    },
    dashboard: {
      title: "我的项目",
      subtitle: "管理和组织您的AI视频项目。",
      newProject: "新建项目"
    },
    project: {
      create: "创建新",
      generate: "生成",
      library: "素材库",
      assets: "资产",
      characters: "角色",
      scenes: "场景",
      items: "物品",
      resources: "资源"
    }
  }
};
```

---

## 应用上下文

### AppContext核心功能

**文件位置**：`contexts/AppContext.tsx`

```typescript
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [browserSupported, setBrowserSupported] = useState(true);
  const [workspaceName, setWorkspaceName] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isFsResponsive, setIsFsResponsive] = useState(true);

  const t = translations[settings.language];

  const checkConnection = async () => {
    const connected = await storageService.isConnected();
    setIsConnected(connected);
    const responsive = storageService.isResponsive();
    setIsFsResponsive(responsive);
    return connected;
  };

  const resetWorkspace = async () => {
    setIsConnected(false);
    setWorkspaceName('');
    await storageService.resetWorkspace();
    const connected = await storageService.connect(true);
    if (connected) {
      window.location.href = '/';
    } else {
      window.location.reload();
    }
  };

  const reloadSettings = async () => {
    const connected = await checkConnection();
    if (connected) {
      setWorkspaceName(await storageService.getWorkspaceName());
      const s = await storageService.loadSettings();
      let merged = { ...DEFAULT_SETTINGS };
      if (s) {
        merged = { ...merged, ...s };
      }

      const parsedPolling = Number((merged as any).pollingInterval);
      let pollingInterval = Number.isFinite(parsedPolling) ? parsedPolling : DEFAULT_SETTINGS.pollingInterval;
      if (pollingInterval > 0 && pollingInterval < 1000) {
        pollingInterval = pollingInterval * 1000;
      }
      merged.pollingInterval = Math.max(1000, Math.floor(pollingInterval));
      merged.useSandbox = storageService.isOpfs();

      setSettings(merged as AppSettings);
    }
    setLoaded(true);
  };

  const pollingInterval = Math.max(1000, Math.floor(settings.pollingInterval));

  return (
    <AppContext.Provider value={{
      settings,
      setSettings,
      loaded,
      isInitializing,
      browserSupported,
      workspaceName,
      isConnected,
      isFsResponsive,
      t,
      checkConnection,
      resetWorkspace,
      reloadSettings,
      pollingInterval
    }}>
      {children}
    </AppContext.Provider>
  );
};
```

---

## 工作流程规范

### 图像生成流程

```
用户输入Prompt
    ↓
选择模型（ModelConfig）
    ↓
配置参数（分辨率、宽高比、引导强度等）
    ↓
（可选）上传参考图像
    ↓
AIService.createGenerationJobs() → 生成Job数组
    ↓
JobQueue.addJobs() → 添加到队列
    ↓
Provider.generateImage() → 调用AI API
    ↓
轮询任务状态（异步任务，12秒间隔）
    ↓
任务完成 → StorageService.updateAsset()
    ↓
UI更新显示生成结果
```

### 视频生成流程

```
用户输入Prompt + 起始帧图像
    ↓
选择视频模型（如Vidu、Volcengine）
    ↓
配置参数（分辨率、时长、运动幅度等）
    ↓
（可选）上传结束帧图像
    ↓
AIService.createVideoGenerationJobs() → 生成Job数组
    ↓
Provider.generateVideo() → 调用AI API
    ↓
任务完成 → 保存GeneratedVideo
    ↓
UI更新显示生成视频
```

### 批处理机制

当需要生成多张图像时，系统自动进行批处理分割：

```typescript
const maxBatchSize = capabilities.maxBatchSize || 4;
let remaining = totalCount;

while (remaining > 0) {
  const currentBatchCount = Math.min(remaining, maxBatchSize);

  const job: Job = {
    id: crypto.randomUUID(),
    type: 'generate_image',
    params: {
      ...params,
      generateCount: currentBatchCount,
    }
  };

  jobs.push(job);
  remaining -= currentBatchCount;
}
```

---

## 开发规范

### 代码风格

- **语言**：TypeScript（严格模式）
- **UI框架**：React 18 + HeroUI组件库
- **样式**：TailwindCSS
- **图标**：Lucide React
- **构建工具**：Vite

### 命名规范

- **组件文件**：PascalCase（如CharacterDetail.tsx）
- **服务文件**：camelCase（如aiService.ts）
- **类型文件**：PascalCase（如types.ts）
- **配置对象**：camelCase或UPPER_SNAKE_CASE

### 导入顺序

```typescript
// 1. React核心
import React, { useState, useEffect, useRef } from 'react';

// 2. 第三方库
import { Button, Textarea, Select } from "@heroui/react";
import { Sparkles, ArrowRight } from 'lucide-react';

// 3. 类型定义
import { ModelConfig, Job } from '../types';

// 4. 配置文件
import { DEFAULT_MODELS } from '../config/models';

// 5. 服务层
import { aiService } from '../services/aiService';

// 6. 工具函数
import { resolveModelConfig } from '../services/modelUtils';

// 7. 本地组件
import { DynamicModelParameters } from './Shared/DynamicModelParameters';
```

### 错误处理规范

```typescript
try {
  // 业务逻辑
} catch (error: any) {
  console.error(`[ProviderName] Exception:`, error);
  return { success: false, error: error.message };
}
```

### 日志规范

```typescript
// Provider级别日志
console.log(`[ProviderName] Action: ${message}`);
console.error(`[ProviderName] Error: ${error}`);

// Service级别日志
console.log(`[AIService] Method: ${methodName}`);

// 调试日志（生产环境可关闭）
if (import.meta.env.DEV) {
  console.debug('Debug info', data);
}
```

---

## API集成规范

### 请求代理配置

开发环境通过Vite代理转发API请求：

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api/universal-proxy': {
        target: '...',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/universal-proxy/, ''),
      },
    },
  },
});
```

---

## 已知限制与注意事项

### 技术限制

1. **异步任务轮询**：当前使用HTTP轮询（12秒间隔），非WebSocket实时推送
2. **超时设置**：最长等待24小时（86400次尝试 × 12秒）
3. **单用户模式**：不支持多用户并发编辑和实时同步
4. **本地存储限制**：OPFS和IndexedDB有存储配额限制

### 功能限制

1. **不支持图像编辑**：缺少Inpainting/Outpainting局部重绘功能
2. **不支持视频编辑**：生成的视频无法进行二次编辑
3. **不支持批量风格统一**：无法对多个生成结果进行统一风格调整
4. **缺少版本管理**：无法追溯和回滚到历史版本
5. **无剧本生成能力**：系统仅支持图像/视频生成，不支持小说到剧本的转换
6. **无分镜生成能力**：不支持自动生成分镜序列

### 性能注意事项

1. **Base64传输**：参考图像通过Base64编码传输，大文件可能影响性能
2. **批处理限制**：单批最大生成数量受模型capabilities.maxBatchSize限制
3. **存储锁机制**：文件操作使用锁机制防止竞态，但可能影响并发性能
4. **元数据提取**：getMediaMetadata为同步操作，大文件可能阻塞UI

### 注意事项

1. **ModelScope异步任务**：图像生成采用异步模式，需要轮询获取结果
2. **API密钥管理**：生产环境需确保API密钥安全存储
3. **文件路径处理**：处理用户上传文件时需注意路径分隔符兼容性
4. **浏览器兼容性**：依赖FileSystem API，需要现代浏览器支持

---

## 依赖配置

### 核心依赖

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "typescript": "^5.0.0",
  "vite": "^5.0.0",
  "@heroui/react": "^2.0.0",
  "tailwindcss": "^3.4.0",
  "framer-motion": "^10.0.0",
  "lucide-react": "^0.290.0"
}
```

### 开发依赖

```json
{
  "@types/react": "^18.2.0",
  "@types/node": "^20.0.0",
  "@vitejs/plugin-react": "^4.0.0",
  "postcss": "^8.4.0",
  "autoprefixer": "^10.4.0"
}
```

---

## 快速参考

### 添加新AI提供商步骤

1. 在`services/ai/providers/`下创建`NewProvider.ts`
2. 继承`BaseProvider`类
3. 实现`generateImage`和`generateVideo`方法
4. 在`aiService.ts`的构造函数中注册

### 添加新资产类型步骤

1. 在`types.ts`中扩展`AssetType`枚举
2. 创建对应的资产接口（如`CharacterAsset`）
3. 在`StorageService`中实现存储逻辑
4. 创建对应的UI组件
5. 在ProjectDetail中添加入口

### 修改模型配置步骤

1. 在`config/models.ts`中添加或修改`ModelConfig`
2. 更新`ModelCapabilities`配置
3. 如需新参数，在`COMMON_*_PARAMS`中添加`ModelParameter`

### 风格提示词模板结构

```typescript
{
  'styleKey': {
    nameEN: 'Style Name (English)',
    nameCN: '风格名称（中文）',
    image: '/styles/style-image.png',
    prompt: 'Style prompt keywords...'
  }
}
```

---

*本文档由代码分析自动生成，最后更新：2026年1月30日*
