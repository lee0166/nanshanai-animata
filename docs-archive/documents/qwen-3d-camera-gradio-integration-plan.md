# Qwen 3D Camera Control Gradio 集成方案

## 核心发现

Qwen 3D Camera Control 是一个 **Gradio 应用**，部署在：

```
https://ai-modelscope-qwen-image-multiple-angles-3d-camera.ms.show/
```

需要通过 **Gradio Client HTTP API** 调用，而不是 ModelScope API。

## 关键 API 端点

| API 名称                       | 功能                     | 参数                                                                                                          |
| ------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `/infer_camera_edit`           | **核心：生成3D视角图片** | image, azimuth, elevation, distance, seed, randomize_seed, guidance_scale, num_inference_steps, height, width |
| `/update_prompt_from_sliders`  | 根据滑块值更新提示词     | azimuth, elevation, distance                                                                                  |
| `/update_dimensions_on_upload` | 上传图片后更新尺寸       | image                                                                                                         |

## 界面复刻设计

### 布局结构（完全复刻原版）

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏠 Kmeng AI Animata    ... 资源管理 [3D视角] 设置                    │  ← 导航栏
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  [点击上传 / 拖放图片区域]                                     │   │
│  │                                                              │   │
│  │                    [上传的图片预览]                           │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🎥 3D Camera Control                                        │   │
│  │  Drag the colored handles: 🟢 Azimuth  🔵 Elevation  🟠 Distance│   │
│  │                                                              │   │
│  │     ┌─────────────────────────────────────┐                  │   │
│  │     │                                     │                  │   │
│  │     │      [3D 可视化控制器]               │                  │   │
│  │     │      - 可拖拽的相机轨道              │                  │   │
│  │     │      - 实时预览相机位置              │                  │   │
│  │     │      - 彩色控制点 (绿/蓝/橙)         │                  │   │
│  │     │                                     │                  │   │
│  │     └─────────────────────────────────────┘                  │   │
│  │                                                              │   │
│  │  [🚀 Generate]                                               │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📊 Slider Controls                                          │   │
│  │                                                              │   │
│  │  Azimuth (Horizontal Rotation)                    [0]        │   │
│  │  0°=front, 90°=right, 180°=back, 270°=left                   │   │
│  │  [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]                    │   │
│  │  -180                                    +180                │   │
│  │                                                              │   │
│  │  Elevation (Vertical Angle)                       [0]        │   │
│  │  -90°=low angle, 0°=eye level, 90°=high angle               │   │
│  │  [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]                    │   │
│  │  -90                                     +90                 │   │
│  │                                                              │   │
│  │  Distance                                         [1.0]      │   │
│  │  0.6=close-up, 1.0=medium, 1.4=wide                         │   │
│  │  [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]                    │   │
│  │  0.6                                     1.4                 │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📝 Generated Prompt                                         │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │ <sk> front view eye-level shot medium shot          │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ⚙️ Advanced Settings (可折叠)                                     │
│     - Seed                                                       │
│     - Randomize Seed                                             │
│     - Guidance Scale                                             │
│     - Inference Steps                                            │
│     - Width / Height                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 技术实现方案

### 1. 3D 可视化控制器

使用 **Three.js** 或 **React Three Fiber** 实现：

```tsx
// components/Camera3D/Camera3DVisualizer.tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, Line } from '@react-three/drei';

interface Camera3DVisualizerProps {
  azimuth: number; // 水平角度
  elevation: number; // 垂直角度
  distance: number; // 距离
  onChange: (params: { azimuth: number; elevation: number; distance: number }) => void;
}

// 实现：
// 1. 中心放置一个立方体/平面代表图片
// 2. 环绕的轨道线（水平圆环 + 垂直弧线）
// 3. 可拖拽的相机位置指示器
// 4. 三个彩色控制点：绿色(Azimuth)、蓝色(Elevation)、橙色(Distance)
```

### 2. Gradio API 服务封装

```typescript
// services/ai/gradio/Qwen3DCameraService.ts

const GRADIO_API_URL = 'https://ai-modelscope-qwen-image-multiple-angles-3d-camera.ms.show/';

export class Qwen3DCameraService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = GRADIO_API_URL;
  }

  /**
   * 生成3D视角图片（核心API）
   */
  async inferCameraEdit(params: {
    image: string;           // base64
    azimuth: number;
    elevation: number;
    distance: number;
    seed?: number;
    randomizeSeed?: boolean;
    guidanceScale?: number;
    numInferenceSteps?: number;
    height?: number;
    width?: number;
  }): Promise<{
    imageUrl: string;
    seed: number;
    generatedPrompt: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fn_index: 8,  // /infer_camera_edit 的索引
        data: [
          { path: null, url: `data:image/png;base64,${params.image}`, ... },
          params.azimuth,
          params.elevation,
          params.distance,
          params.seed ?? 0,
          params.randomizeSeed ?? true,
          params.guidanceScale ?? 1,
          params.numInferenceSteps ?? 4,
          params.height ?? 1024,
          params.width ?? 1024,
        ]
      })
    });

    const result = await response.json();
    return {
      imageUrl: result.data[0].url,
      seed: result.data[1],
      generatedPrompt: result.data[2],
    };
  }

  /**
   * 根据滑块值更新提示词预览
   */
  async updatePromptFromSliders(
    azimuth: number,
    elevation: number,
    distance: number
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fn_index: 0,  // /update_prompt_from_sliders
        data: [azimuth, elevation, distance]
      })
    });

    const result = await response.json();
    return result.data[0];  // 返回生成的提示词
  }

  /**
   * 上传图片后获取推荐尺寸
   */
  async updateDimensionsOnUpload(imageBase64: string): Promise<{
    width: number;
    height: number;
  }> {
    const response = await fetch(`${this.baseUrl}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fn_index: 9,  // /update_dimensions_on_upload
        data: [{ path: null, url: `data:image/png;base64,${imageBase64}`, ... }]
      })
    });

    const result = await response.json();
    return {
      width: result.data[0],
      height: result.data[1],
    };
  }
}
```

### 3. 状态联动逻辑

```typescript
// hooks/useCamera3D.ts

export const useCamera3D = () => {
  const [params, setParams] = useState({
    azimuth: 0,
    elevation: 0,
    distance: 1.0,
  });

  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputImage, setOutputImage] = useState<string | null>(null);

  const service = useMemo(() => new Qwen3DCameraService(), []);

  // 当滑块值改变时，实时更新提示词
  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      const prompt = await service.updatePromptFromSliders(
        params.azimuth,
        params.elevation,
        params.distance
      );
      setGeneratedPrompt(prompt);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [params, service]);

  // 从3D可视化器更新参数
  const updateParamsFromVisualizer = useCallback((newParams: Partial<typeof params>) => {
    setParams(prev => ({ ...prev, ...newParams }));
  }, []);

  // 生成图片
  const generate = useCallback(
    async (imageBase64: string) => {
      setIsGenerating(true);
      try {
        const result = await service.inferCameraEdit({
          image: imageBase64,
          ...params,
        });
        setOutputImage(result.imageUrl);
        return result;
      } finally {
        setIsGenerating(false);
      }
    },
    [params, service]
  );

  return {
    params,
    setParams,
    generatedPrompt,
    outputImage,
    isGenerating,
    updateParamsFromVisualizer,
    generate,
  };
};
```

### 4. 完整页面实现

```tsx
// views/Camera3DView.tsx

import React, { useState, useCallback } from 'react';
import { Card, CardBody, Button, Slider, Switch, Input } from '@heroui/react';
import { Upload, Scan, Settings2, Wand2 } from 'lucide-react';
import { Camera3DVisualizer } from '../components/Camera3D/Camera3DVisualizer';
import { useCamera3D } from '../hooks/useCamera3D';

export const Camera3DView: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    params,
    setParams,
    generatedPrompt,
    outputImage,
    isGenerating,
    updateParamsFromVisualizer,
    generate,
  } = useCamera3D();

  // 处理图片上传
  const handleImageUpload = useCallback(async (file: File) => {
    const base64 = await fileToBase64(file);
    setSourceImage(base64);

    // 获取推荐尺寸
    const dimensions = await service.updateDimensionsOnUpload(base64);
    // 更新尺寸设置...
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 图片上传区域 */}
      <Card>
        <CardBody className="p-6">
          {!sourceImage ? (
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center">
              <Upload className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <p className="text-slate-500 mb-4">点击上传或拖放图片</p>
              <input
                type="file"
                accept="image/*"
                onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload">
                <Button as="span" color="primary">
                  选择图片
                </Button>
              </label>
            </div>
          ) : (
            <div className="relative">
              <img
                src={`data:image/png;base64,${sourceImage}`}
                alt="Source"
                className="max-h-96 mx-auto rounded-lg"
              />
              <Button
                size="sm"
                color="danger"
                className="absolute top-2 right-2"
                onPress={() => setSourceImage(null)}
              >
                移除
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* 3D Camera Control */}
      <Card>
        <CardBody className="p-6">
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <Scan className="w-5 h-5" />
            3D Camera Control
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Drag the colored handles:
            <span className="text-green-500">● Azimuth</span>{' '}
            <span className="text-blue-500">● Elevation</span>{' '}
            <span className="text-orange-500">● Distance</span>
          </p>

          {/* 3D 可视化器 */}
          <div className="h-80 bg-slate-900 rounded-lg mb-4">
            <Camera3DVisualizer
              azimuth={params.azimuth}
              elevation={params.elevation}
              distance={params.distance}
              onChange={updateParamsFromVisualizer}
            />
          </div>

          {/* Generate 按钮 */}
          <Button
            color="primary"
            size="lg"
            fullWidth
            isLoading={isGenerating}
            isDisabled={!sourceImage}
            onPress={() => sourceImage && generate(sourceImage)}
            startContent={<Wand2 className="w-5 h-5" />}
          >
            Generate
          </Button>
        </CardBody>
      </Card>

      {/* Slider Controls */}
      <Card>
        <CardBody className="p-6 space-y-6">
          <h3 className="font-medium">Slider Controls</h3>

          {/* Azimuth */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Azimuth (Horizontal Rotation)</span>
              <span className="font-mono">{params.azimuth}</span>
            </div>
            <p className="text-xs text-slate-500 mb-2">0°=front, 90°=right, 180°=back, 270°=left</p>
            <Slider
              min={-180}
              max={180}
              step={1}
              value={params.azimuth}
              onChange={v => setParams(p => ({ ...p, azimuth: v }))}
            />
          </div>

          {/* Elevation */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Elevation (Vertical Angle)</span>
              <span className="font-mono">{params.elevation}</span>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              -90°=low angle, 0°=eye level, 90°=high angle
            </p>
            <Slider
              min={-90}
              max={90}
              step={1}
              value={params.elevation}
              onChange={v => setParams(p => ({ ...p, elevation: v }))}
            />
          </div>

          {/* Distance */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Distance</span>
              <span className="font-mono">{params.distance}</span>
            </div>
            <p className="text-xs text-slate-500 mb-2">0.6=close-up, 1.0=medium, 1.4=wide</p>
            <Slider
              min={0.6}
              max={1.4}
              step={0.01}
              value={params.distance}
              onChange={v => setParams(p => ({ ...p, distance: v }))}
            />
          </div>
        </CardBody>
      </Card>

      {/* Generated Prompt */}
      <Card>
        <CardBody className="p-6">
          <h3 className="font-medium mb-2">Generated Prompt</h3>
          <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg font-mono text-sm">
            {generatedPrompt || '<sk> front view eye-level shot medium shot'}
          </div>
        </CardBody>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardBody className="p-6">
          <Button
            variant="light"
            onPress={() => setShowAdvanced(!showAdvanced)}
            startContent={<Settings2 className="w-4 h-4" />}
          >
            Advanced Settings
          </Button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              {/* Seed */}
              <div className="flex items-center justify-between">
                <span>Seed</span>
                <Input type="number" defaultValue={0} className="w-32" />
              </div>

              {/* Randomize Seed */}
              <div className="flex items-center justify-between">
                <span>Randomize Seed</span>
                <Switch defaultSelected />
              </div>

              {/* Guidance Scale */}
              <div>
                <span>Guidance Scale</span>
                <Slider min={0} max={10} step={0.1} defaultValue={1} />
              </div>

              {/* Inference Steps */}
              <div>
                <span>Inference Steps</span>
                <Slider min={1} max={50} step={1} defaultValue={4} />
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* 输出结果 */}
      {outputImage && (
        <Card>
          <CardBody className="p-6">
            <h3 className="font-medium mb-4">Output</h3>
            <img src={outputImage} alt="Generated" className="max-h-96 mx-auto rounded-lg" />
          </CardBody>
        </Card>
      )}
    </div>
  );
};
```

## 依赖项

```json
{
  "dependencies": {
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.92.0",
    "three": "^0.160.0"
  }
}
```

## 修改文件清单

| 文件                                         | 操作 | 说明                     |
| -------------------------------------------- | ---- | ------------------------ |
| `package.json`                               | 修改 | 添加 three.js 依赖       |
| `types.ts`                                   | 修改 | 添加 AssetType.CAMERA_3D |
| `components/Layout.tsx`                      | 修改 | 添加导航标签             |
| `App.tsx`                                    | 修改 | 添加路由                 |
| `services/ai/gradio/Qwen3DCameraService.ts`  | 新增 | Gradio API 封装          |
| `hooks/useCamera3D.ts`                       | 新增 | 状态管理 Hook            |
| `components/Camera3D/Camera3DVisualizer.tsx` | 新增 | 3D 可视化组件            |
| `views/Camera3DView.tsx`                     | 新增 | 主页面（完全复刻原版）   |

## 工作量估算

| 任务                         | 工作量   |
| ---------------------------- | -------- |
| Qwen3DCameraService API 封装 | 0.5 天   |
| useCamera3D Hook             | 0.5 天   |
| Camera3DVisualizer 3D组件    | 1.5 天   |
| Camera3DView 页面            | 1 天     |
| 联调测试                     | 0.5 天   |
| **总计**                     | **4 天** |

## 注意事项

1. **Gradio API 是免费的**，但可能有速率限制
2. **3D 可视化器**需要仔细调整以匹配原版交互体验
3. **CORS 问题**：直接从前端调用 Gradio API 可能遇到跨域，可能需要：
   - 使用 Vite 代理
   - 或通过后端转发请求

---

_此方案完全复刻 Qwen 3D Camera Control 的 Gradio 界面和功能_
