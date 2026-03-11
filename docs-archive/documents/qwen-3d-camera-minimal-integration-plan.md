# Qwen 3D Camera Control 最小化集成方案

## 方案概述

在导航栏红色框位置添加"3D视角"标签按钮，以独立页面形式集成 Qwen 3D Camera Control 功能，**最小程度修改现有项目代码**。

## 修改文件清单（仅5个文件）

```
types.ts                              (+15 行) - 新增 AssetType.CAMERA_3D
components/Layout.tsx                 (+15 行) - 添加导航标签
App.tsx                               (+5 行)  - 添加路由
views/Camera3DView.tsx                (新增 250 行) - 主页面
services/ai/providers/ModelscopeProvider.ts  (+40 行) - API调用
```

**总计修改**：约 325 行代码，5 个文件

---

## 详细实现方案

### 1. types.ts - 新增资产类型

```typescript
// 在 AssetType 枚举中添加
export enum AssetType {
  CHARACTER = 'character',
  SCENE = 'scene',
  ITEM = 'item',
  SHOT = 'shot',
  VIDEO_SEGMENT = 'video_segment',
  RESOURCES = 'resources',
  SCRIPT = 'script',
  IMAGE = 'image',
  VIDEO = 'video',
  CAMERA_3D = 'camera_3d', // 新增：3D视角工具
}
```

### 2. components/Layout.tsx - 添加导航标签

```typescript
// 在 tabs 数组中添加
const tabs = [
  { id: AssetType.SCRIPT, label: '剧本管理', icon: FileText },
  { id: AssetType.CHARACTER, label: t.project.characters, icon: User },
  { id: AssetType.SCENE, label: t.project.scenes, icon: Map },
  { id: AssetType.ITEM, label: t.project.items, icon: Box },
  { id: AssetType.SHOT, label: '分镜管理', icon: Camera },
  { id: AssetType.VIDEO_SEGMENT, label: t.project.segments, icon: Film },
  { id: AssetType.RESOURCES, label: t.project.resources, icon: Library },
  { id: AssetType.CAMERA_3D, label: '3D视角', icon: Scan }, // 新增
];
```

**图标选择**：使用 `lucide-react` 的 `Scan` 或 `Box` 或 `Rotate3D` 图标

### 3. App.tsx - 添加路由

```typescript
import Camera3DView from './views/Camera3DView';

// 在 Routes 中添加
<Route
  path="/project/:projectId/camera-3d"
  element={<Camera3DView setActiveTab={setActiveTab} />}
/>
```

### 4. views/Camera3DView.tsx - 主页面（新增）

```tsx
import React, { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardBody, Button, Slider, Select, SelectItem, Tabs, Tab } from '@heroui/react';
import { Scan, Image, Download, Rotate3D, Eye } from 'lucide-react';
import { AssetType } from '../types';
import { storageService } from '../services/storage';
import { aiService } from '../services/aiService';
import { jobQueue } from '../services/queue';
import { useApp } from '../contexts/context';
import { useToast } from '../contexts/ToastContext';

// 3D 相机参数接口
interface Camera3DParams {
  azimuth: number; // 方位角: -180 到 +180
  elevation: number; // 仰角: -90 到 +90
  radius: number; // 距离: 0.5 到 2.0
}

// 批量生成配置
interface BatchConfig {
  frameCount: number; // 生成帧数
  orbitMode: boolean; // 是否360度环绕
  fixedElevation: boolean; // 是否固定仰角
}

interface Camera3DViewProps {
  setActiveTab?: (tab: AssetType) => void;
}

export const Camera3DView: React.FC<Camera3DViewProps> = ({ setActiveTab }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const { settings } = useApp();
  const { showToast } = useToast();

  // 设置当前活动标签
  React.useEffect(() => {
    setActiveTab?.(AssetType.CAMERA_3D);
  }, [setActiveTab]);

  // 状态管理
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceImageFile, setSourceImageFile] = useState<File | null>(null);
  const [cameraParams, setCameraParams] = useState<Camera3DParams>({
    azimuth: 0,
    elevation: 0,
    radius: 1.0,
  });
  const [batchConfig, setBatchConfig] = useState<BatchConfig>({
    frameCount: 4,
    orbitMode: false,
    fixedElevation: true,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // 处理图片上传
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setSourceImageFile(file);
        const url = URL.createObjectURL(file);
        setSourceImage(url);
        showToast('图片上传成功', 'success');
      }
    },
    [showToast]
  );

  // 处理单张生成
  const handleSingleGenerate = async () => {
    if (!sourceImageFile || !projectId) {
      showToast('请先上传图片', 'warning');
      return;
    }

    const imageModel = settings.models.find(m => m.type === 'image');
    if (!imageModel) {
      showToast('请先在设置中配置生图模型', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      // TODO: 调用 Provider 生成新视角
      // const result = await aiService.generate3DView({
      //   image: sourceImageFile,
      //   params: cameraParams,
      //   modelConfigId: imageModel.id
      // });

      showToast('3D视角生成任务已提交', 'success');
    } catch (error: any) {
      showToast(`生成失败: ${error.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // 处理批量生成
  const handleBatchGenerate = async () => {
    if (!sourceImageFile || !projectId) {
      showToast('请先上传图片', 'warning');
      return;
    }

    showToast(`开始批量生成 ${batchConfig.frameCount} 个视角`, 'info');
    // TODO: 批量生成逻辑
  };

  // 快速预设
  const quickPresets = [
    { name: '左转45°', params: { ...cameraParams, azimuth: -45 } },
    { name: '右转45°', params: { ...cameraParams, azimuth: 45 } },
    { name: '俯视30°', params: { ...cameraParams, elevation: 30 } },
    { name: '仰视30°', params: { ...cameraParams, elevation: -30 } },
    { name: '推进', params: { ...cameraParams, radius: 0.7 } },
    { name: '拉远', params: { ...cameraParams, radius: 1.5 } },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* 头部 */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Scan className="w-6 h-6 text-primary" />
              3D视角生成
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              使用 Qwen 3D Camera Control 生成多角度视图
            </p>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：图片预览 */}
        <div className="w-1/2 p-6 border-r border-slate-200 dark:border-slate-800">
          <Card className="h-full">
            <CardBody className="p-6">
              <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                <Image className="w-4 h-4" />
                源图片
              </h3>

              {sourceImage ? (
                <div className="relative">
                  <img
                    src={sourceImage}
                    alt="Source"
                    className="w-full rounded-lg object-contain max-h-[calc(100vh-300px)]"
                  />
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    className="absolute top-2 right-2"
                    onPress={() => {
                      setSourceImage(null);
                      setSourceImageFile(null);
                    }}
                  >
                    移除
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-12 text-center">
                  <Scan className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                  <p className="text-sm text-slate-500 mb-4">上传图片以生成 3D 视角</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload">
                    <Button as="span" color="primary">
                      选择图片
                    </Button>
                  </label>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* 右侧：控制面板 */}
        <div className="w-1/2 p-6 overflow-y-auto">
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={key => setActiveTab(key as 'single' | 'batch')}
          >
            <Tab key="single" title="单张生成">
              <Card className="mt-4">
                <CardBody className="p-6 space-y-6">
                  {/* 3D 参数控制 */}
                  <div>
                    <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                      <Rotate3D className="w-4 h-4" />
                      3D 相机参数
                    </h3>

                    {/* 方位角 */}
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span>方位角 (Azimuth)</span>
                        <span className="text-primary font-mono">{cameraParams.azimuth}°</span>
                      </div>
                      <Slider
                        min={-180}
                        max={180}
                        step={5}
                        value={cameraParams.azimuth}
                        onChange={v => setCameraParams(p => ({ ...p, azimuth: v }))}
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>左 (-180°)</span>
                        <span>正 (0°)</span>
                        <span>右 (+180°)</span>
                      </div>
                    </div>

                    {/* 仰角 */}
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span>仰角 (Elevation)</span>
                        <span className="text-primary font-mono">{cameraParams.elevation}°</span>
                      </div>
                      <Slider
                        min={-90}
                        max={90}
                        step={5}
                        value={cameraParams.elevation}
                        onChange={v => setCameraParams(p => ({ ...p, elevation: v }))}
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>下 (-90°)</span>
                        <span>平 (0°)</span>
                        <span>上 (+90°)</span>
                      </div>
                    </div>

                    {/* 距离 */}
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span>距离 (Radius)</span>
                        <span className="text-primary font-mono">{cameraParams.radius}x</span>
                      </div>
                      <Slider
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        value={cameraParams.radius}
                        onChange={v => setCameraParams(p => ({ ...p, radius: v }))}
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>特写 (0.5x)</span>
                        <span>中 (1.0x)</span>
                        <span>全景 (2.0x)</span>
                      </div>
                    </div>
                  </div>

                  {/* 快速预设 */}
                  <div>
                    <h3 className="text-sm font-medium mb-3">快速预设</h3>
                    <div className="flex flex-wrap gap-2">
                      {quickPresets.map(preset => (
                        <Button
                          key={preset.name}
                          size="sm"
                          variant="flat"
                          onPress={() => setCameraParams(preset.params)}
                        >
                          {preset.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* 生成按钮 */}
                  <Button
                    color="primary"
                    size="lg"
                    fullWidth
                    isDisabled={!sourceImage}
                    isLoading={isGenerating}
                    onPress={handleSingleGenerate}
                  >
                    <Scan className="w-5 h-5 mr-2" />
                    生成 3D 视角
                  </Button>
                </CardBody>
              </Card>
            </Tab>

            <Tab key="batch" title="批量生成">
              <Card className="mt-4">
                <CardBody className="p-6 space-y-6">
                  {/* 批量配置 */}
                  <div>
                    <h3 className="text-sm font-medium mb-4">批量配置</h3>

                    <div className="mb-4">
                      <label className="text-sm mb-2 block">生成帧数</label>
                      <Select
                        selectedKeys={[batchConfig.frameCount.toString()]}
                        onChange={e =>
                          setBatchConfig(c => ({
                            ...c,
                            frameCount: parseInt(e.target.value),
                          }))
                        }
                      >
                        <SelectItem key="4" value="4">
                          4 帧 (90°间隔)
                        </SelectItem>
                        <SelectItem key="8" value="8">
                          8 帧 (45°间隔)
                        </SelectItem>
                        <SelectItem key="12" value="12">
                          12 帧 (30°间隔)
                        </SelectItem>
                        <SelectItem key="16" value="16">
                          16 帧 (22.5°间隔)
                        </SelectItem>
                      </Select>
                    </div>

                    {/* 生成按钮 */}
                    <Button
                      color="primary"
                      size="lg"
                      fullWidth
                      isDisabled={!sourceImage}
                      onPress={handleBatchGenerate}
                    >
                      <Rotate3D className="w-5 h-5 mr-2" />
                      批量生成 {batchConfig.frameCount} 个视角
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </Tab>
          </Tabs>

          {/* 生成结果预览 */}
          {generatedImages.length > 0 && (
            <Card className="mt-4">
              <CardBody className="p-6">
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  生成结果
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {generatedImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img src={img} alt={`Result ${idx + 1}`} className="w-full rounded-lg" />
                      <Button
                        isIconOnly
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onPress={() => {
                          // TODO: 下载图片
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Camera3DView;
```

### 5. services/ai/providers/ModelscopeProvider.ts - API调用

```typescript
// 在 ModelscopeProvider 类中添加新方法

/**
 * 使用 3D 相机参数编辑图片
 */
async editImageWith3DCamera(
  imageBase64: string,
  params: {
    azimuth: number;
    elevation: number;
    radius: number;
  },
  config: ModelConfig
): Promise<AIResult> {
  try {
    const apiKey = this.getApiKey(config);
    const baseUrl = this.getBaseUrl(config);

    const body = {
      model: config.modelId || 'Qwen/Qwen-Image-Edit-2511',
      image: imageBase64,
      prompt: `Change camera angle: azimuth=${params.azimuth}, elevation=${params.elevation}, radius=${params.radius}`,
      extra_params: {
        azimuth: params.azimuth,
        elevation: params.elevation,
        radius: params.radius,
        // 启用 Multiple-Angles LoRA
        lora: 'Qwen/Qwen-Image-Edit-2511-Multiple-Angles'
      }
    };

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
      throw new Error(`API Error (${submitResponse.status}): ${errorText}`);
    }

    const submitData = await submitResponse.json();
    const taskId = submitData.task_id;

    if (!taskId) {
      throw new Error("Failed to get task_id from API");
    }

    return await this.pollTask(taskId, apiKey, baseUrl);

  } catch (error: any) {
    console.error(`[ModelscopeProvider] 3D Camera Edit Error:`, error);
    return { success: false, error: error.message };
  }
}
```

---

## UI 布局示意图

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏠 Kmeng AI Animata    剧本管理 角色管理 场景管理 ... 3D视角 设置    │  ← 导航栏新增"3D视角"标签
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────┐  ┌─────────────────────────────────┐  │
│  │                          │  │  3D视角生成                      │  │
│  │      源图片预览           │  │                                 │  │
│  │                          │  │  [单张生成] [批量生成]           │  │
│  │   [上传图片区域]          │  │                                 │  │
│  │                          │  │  ─────────────────────────────  │  │
│  │                          │  │                                 │  │
│  │                          │  │  方位角: [-180° ─── +180°]  0°   │  │
│  │                          │  │  仰角:   [ -90° ─── +90°]  0°   │  │
│  │                          │  │  距离:   [ 0.5x ─── 2.0x] 1.0x  │  │
│  │                          │  │                                 │  │
│  │                          │  │  [左转45°] [右转45°] [俯视30°]   │  │
│  │                          │  │                                 │  │
│  │                          │  │  ┌─────────────────────────┐    │  │
│  │                          │  │  │    [生成 3D 视角]       │    │  │
│  │                          │  │  └─────────────────────────┘    │  │
│  │                          │  │                                 │  │
│  └──────────────────────────┘  └─────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 工作量估算

| 任务                    | 工作量       | 说明                     |
| ----------------------- | ------------ | ------------------------ |
| types.ts 修改           | 0.1 天       | 添加 AssetType.CAMERA_3D |
| Layout.tsx 修改         | 0.1 天       | 添加导航标签             |
| App.tsx 修改            | 0.1 天       | 添加路由                 |
| Camera3DView.tsx 开发   | 1-1.5 天     | 主页面开发               |
| ModelscopeProvider 扩展 | 0.5 天       | 3D API 调用              |
| 联调测试                | 0.5 天       | 功能验证                 |
| **总计**                | **2.5-3 天** |                          |

---

## 优势

1. **最小化修改**：仅修改 4 个现有文件，新增 1 个页面
2. **完全独立**：不影响现有 ShotManager 或其他功能
3. **易于测试**：独立页面，无需回归测试
4. **用户体验**：导航栏直接访问，操作便捷
5. **可扩展**：独立页面有充足空间添加高级功能（批量生成、360环绕等）

---

## 下一步行动

1. [ ] 确认方案后，开始实施
2. [ ] 先验证 ModelScope API 的 Qwen-Image-Edit-2511 参数格式
3. [ ] 按文件顺序逐步修改
4. [ ] 测试功能完整性

---

_文档生成时间：2026-02-26_
