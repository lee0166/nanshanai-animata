# Qwen Image Edit 3D Camera Control 功能集成计划

## 一、功能深度分析

### 1.1 技术概述

**Qwen Image Edit 2511 - 3D Camera Control** 是阿里通义千问团队开源的图像编辑模型，核心能力包括：

| 特性           | 说明                                                      |
| -------------- | --------------------------------------------------------- |
| **模型架构**   | MMDiT (Multi-Modal Diffusion Transformer)，20B 参数量     |
| **核心功能**   | 通过 3D 相机参数控制，实现单张图片的多视角变换            |
| **控制参数**   | Azimuth（方位角）、Elevation（仰角）、Radius（距离/缩放） |
| **LoRA 支持**  | Multiple-Angles LoRA 专门用于多角度视角控制               |
| **一致性**     | 在改变视角的同时保持主体外观高度一致                      |
| **API 可用性** | 可通过 ModelScope API 调用                                |

### 1.2 3D 相机控制参数详解

```
Azimuth (方位角): -180° 到 +180°
  - 0°: 正面
  - -90°: 左侧
  +90°: 右侧
  ±180°: 背面

Elevation (仰角): -90° 到 +90°
  - 0°: 平视
  +正值: 俯视
  -负值: 仰视

Radius (半径/距离): 控制相机与主体的距离
  - 值越小: 越靠近主体（特写效果）
  - 值越大: 越远离主体（全景效果）
```

### 1.3 与现有功能的对比

| 功能       | 当前项目实现           | Qwen 3D Camera Control      |
| ---------- | ---------------------- | --------------------------- |
| 关键帧生成 | LLM 文本描述 → 图生图  | 已有图片 + 3D 参数 → 新视角 |
| 角色一致性 | 依赖参考图和提示词约束 | 模型内建一致性保持          |
| 运镜模拟   | 仅文本提示词描述       | 精确的相机参数控制          |
| 过渡生成   | 需多次生成中间帧       | 可精确控制视角渐变          |

---

## 二、API 调用可行性分析

### 2.1 ModelScope API 接入方式

**已有基础**：

- 项目已集成 `ModelscopeProvider`，支持通过 `api-inference.modelscope.cn` 调用
- 已支持异步任务模式（`X-ModelScope-Async-Mode: true`）
- 已支持任务轮询获取结果

**API 端点**：

```
POST https://api-inference.modelscope.cn/v1/images/generations
```

**请求体结构**：

```json
{
  "model": "Qwen/Qwen-Image-Edit-2511",
  "prompt": "保持原图主体，改变相机角度",
  "image": "base64_encoded_image",
  "extra_params": {
    "azimuth": 45,
    "elevation": 15,
    "radius": 1.0
  }
}
```

### 2.2 集成可行性评估

| 评估项     | 状态      | 说明                              |
| ---------- | --------- | --------------------------------- |
| API 可用性 | ✅ 可行   | ModelScope 已支持 Qwen-Image 系列 |
| 认证方式   | ✅ 兼容   | 复用现有 API Key 机制             |
| 异步模式   | ✅ 兼容   | 复用现有轮询逻辑                  |
| 参数扩展   | ⚠️ 需开发 | 需新增 3D 相机参数支持            |
| 成本       | ⚠️ 需评估 | ModelScope 有免费额度限制         |

---

## 三、功能区定位分析

### 3.1 候选功能区对比

| 功能区                        | 适用性     | 优势                             | 劣势           |
| ----------------------------- | ---------- | -------------------------------- | -------------- |
| **分镜管理 (ShotManager)**    | ⭐⭐⭐⭐⭐ | 直接关联关键帧生成，符合运镜需求 | 需要扩展 UI    |
| **角色资产 (CharacterAsset)** | ⭐⭐⭐     | 可生成角色多角度视图             | 偏离核心工作流 |
| **场景资产 (SceneAsset)**     | ⭐⭐⭐     | 可生成场景漫游效果               | 偏离核心工作流 |
| **图生视频 (Video Gen)**      | ⭐⭐⭐⭐   | 可为视频生成首帧/尾帧            | 需要额外集成   |

### 3.2 推荐方案：分镜管理页面集成

**核心理由**：

1. **完美匹配 Spec 需求**：
   - Spec 中提到的"运镜感知的关键帧生成"正好需要 3D 相机控制
   - "推镜头体现景别变化" → 可通过 Radius 参数精确控制
   - "摇镜头体现水平移动" → 可通过 Azimuth 参数精确控制

2. **增强现有工作流**：
   - 当前关键帧生成依赖 LLM 文本描述
   - 3D Camera Control 可提供精确的视角控制，作为补充手段

3. **UI 扩展成本低**：
   - 可在现有 ShotManager 的关键帧编辑区域添加"3D 视角调整"面板
   - 复用现有的图片预览和生成功能

---

## 四、集成方案设计

### 4.1 功能架构

```
┌─────────────────────────────────────────────────────────────┐
│                    ShotManager (分镜管理)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  分镜列表    │  │ 关键帧预览   │  │   3D 相机控制面板    │  │
│  │             │  │             │  │                     │  │
│  │ • 场景1-1   │  │ [关键帧图片] │  │  Azimuth: [-180°]   │  │
│  │ • 场景1-2   │  │             │  │  Elevation: [+15°]  │  │
│  │ • 场景2-1   │  │ 描述文本    │  │  Radius: [1.0x]     │  │
│  │             │  │             │  │                     │  │
│  │             │  │ 提示词编辑   │  │  [生成新视角]       │  │
│  │             │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              ModelscopeProvider (扩展)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │  editImageWith3DCamera()                             │  │
│  │  - 接收源图片 + 3D 参数                               │  │
│  │  - 调用 Qwen-Image-Edit-2511                         │  │
│  │  - 返回新视角图片                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 新增类型定义

```typescript
// types.ts 扩展

/**
 * 3D 相机控制参数
 */
export interface Camera3DParams {
  azimuth: number; // 方位角: -180 到 +180 度
  elevation: number; // 仰角: -90 到 +90 度
  radius: number; // 距离倍数: 0.5 (特写) 到 2.0 (全景)
}

/**
 * 关键帧 3D 变换配置
 */
export interface Keyframe3DTransform {
  enabled: boolean;
  sourceImageId: string; // 源图片 ID
  cameraParams: Camera3DParams;
  prompt?: string; // 可选的额外提示词
}

/**
 * 运镜类型与 3D 参数映射
 */
export interface CameraMovement3DMapping {
  movement: CameraMovement;
  defaultParams: Camera3DParams;
  paramRange: {
    azimuth: { min: number; max: number };
    elevation: { min: number; max: number };
    radius: { min: number; max: number };
  };
}
```

### 4.3 运镜类型与 3D 参数映射表

| 运镜类型             | Azimuth   | Elevation | Radius    | 说明               |
| -------------------- | --------- | --------- | --------- | ------------------ |
| **推 (Push)**        | 0°        | 0°        | 1.0 → 0.6 | 距离减小，景别变大 |
| **拉 (Pull)**        | 0°        | 0°        | 0.6 → 1.0 | 距离增大，景别变小 |
| **左摇 (Pan Left)**  | 0° → -45° | 0°        | 1.0       | 水平向左转动       |
| **右摇 (Pan Right)** | 0° → +45° | 0°        | 1.0       | 水平向右转动       |
| **升 (Tilt Up)**     | 0°        | 0° → +30° | 1.0       | 仰视角度增加       |
| **降 (Tilt Down)**   | 0°        | 0° → -30° | 1.0       | 俯视角度增加       |
| **环绕 (Orbit)**     | 0° → 360° | 0°        | 1.0       | 360度环绕主体      |

### 4.4 Provider 扩展

```typescript
// services/ai/providers/ModelscopeProvider.ts 扩展

export class ModelscopeProvider extends BaseProvider {
  /**
   * 使用 3D 相机参数编辑图片
   *
   * @param sourceImage - 源图片路径或 base64
   * @param cameraParams - 3D 相机参数
   * @param config - 模型配置
   * @param prompt - 可选的额外提示词
   */
  async editImageWith3DCamera(
    sourceImage: string,
    cameraParams: Camera3DParams,
    config: ModelConfig,
    prompt?: string
  ): Promise<AIResult> {
    const apiKey = this.getApiKey(config);
    const baseUrl = this.getBaseUrl(config);

    const body = {
      model: 'Qwen/Qwen-Image-Edit-2511',
      image: await this.loadImageAsBase64(sourceImage),
      prompt:
        prompt ||
        `Change camera angle to azimuth=${cameraParams.azimuth}, elevation=${cameraParams.elevation}`,
      extra_params: {
        azimuth: cameraParams.azimuth,
        elevation: cameraParams.elevation,
        radius: cameraParams.radius,
        // 启用 Multiple-Angles LoRA
        lora: 'Qwen/Qwen-Image-Edit-2511-Multiple-Angles',
      },
    };

    // 复用现有的异步任务提交和轮询逻辑
    const submitResponse = await this.makeRequest(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-ModelScope-Async-Mode': 'true',
      },
      body: JSON.stringify(body),
    });

    // ... 复用 pollTask 逻辑
  }
}
```

### 4.5 UI 设计

#### 4.5.1 3D 相机控制面板

```tsx
// components/ProjectDetail/Keyframe3DControl.tsx

interface Keyframe3DControlProps {
  keyframe: Keyframe;
  onTransform: (params: Camera3DParams) => void;
  cameraMovement: CameraMovement;
}

export const Keyframe3DControl: React.FC<Keyframe3DControlProps> = ({
  keyframe,
  onTransform,
  cameraMovement,
}) => {
  const [azimuth, setAzimuth] = useState(0);
  const [elevation, setElevation] = useState(0);
  const [radius, setRadius] = useState(1.0);

  // 根据运镜类型推荐参数范围
  const getRecommendedParams = (movement: CameraMovement) => {
    const mappings: Record<CameraMovement, Partial<Camera3DParams>> = {
      push: { radius: 0.7 },
      pull: { radius: 1.3 },
      pan: { azimuth: 30 },
      tilt: { elevation: 20 },
      track: { azimuth: 15 },
      crane: { elevation: 30 },
      static: {},
    };
    return mappings[movement] || {};
  };

  return (
    <Card className="p-4">
      <h4 className="text-sm font-medium mb-4">3D 相机控制</h4>

      {/* 方位角 */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span>方位角 (Azimuth)</span>
          <span>{azimuth}°</span>
        </div>
        <Slider
          min={-180}
          max={180}
          step={5}
          value={azimuth}
          onChange={setAzimuth}
          marks={[
            { value: -180, label: '后' },
            { value: -90, label: '左' },
            { value: 0, label: '正' },
            { value: 90, label: '右' },
            { value: 180, label: '后' },
          ]}
        />
      </div>

      {/* 仰角 */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span>仰角 (Elevation)</span>
          <span>{elevation}°</span>
        </div>
        <Slider
          min={-90}
          max={90}
          step={5}
          value={elevation}
          onChange={setElevation}
          marks={[
            { value: -90, label: '下' },
            { value: 0, label: '平' },
            { value: 90, label: '上' },
          ]}
        />
      </div>

      {/* 距离 */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span>距离 (Radius)</span>
          <span>{radius}x</span>
        </div>
        <Slider
          min={0.5}
          max={2.0}
          step={0.1}
          value={radius}
          onChange={setRadius}
          marks={[
            { value: 0.5, label: '近' },
            { value: 1.0, label: '中' },
            { value: 2.0, label: '远' },
          ]}
        />
      </div>

      {/* 快速预设 */}
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant="flat" onPress={() => setAzimuth(-45)}>
          左转45°
        </Button>
        <Button size="sm" variant="flat" onPress={() => setAzimuth(45)}>
          右转45°
        </Button>
        <Button size="sm" variant="flat" onPress={() => setElevation(30)}>
          俯视30°
        </Button>
      </div>

      {/* 生成按钮 */}
      <Button color="primary" fullWidth onPress={() => onTransform({ azimuth, elevation, radius })}>
        生成新视角
      </Button>
    </Card>
  );
};
```

#### 4.5.2 集成到 ShotManager

```tsx
// views/ShotManager.tsx 扩展

// 在关键帧详情区域添加 3D 控制面板
{
  selectedShot.keyframes[selectedKeyframeIndex] && (
    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(400px,0.8fr)_300px] gap-6">
      {/* 左侧：图片和描述 */}
      <div className="space-y-4">{/* ... 现有代码 ... */}</div>

      {/* 中间：提示词和操作 */}
      <div className="space-y-4">{/* ... 现有代码 ... */}</div>

      {/* 右侧：新增 3D 相机控制 */}
      <div className="space-y-4">
        <Keyframe3DControl
          keyframe={selectedShot.keyframes[selectedKeyframeIndex]}
          cameraMovement={selectedShot.cameraMovement}
          onTransform={handle3DTransform}
        />
      </div>
    </div>
  );
}
```

---

## 五、实施计划

### 5.1 开发阶段

| 阶段        | 任务                                 | 预计工作量 | 依赖                |
| ----------- | ------------------------------------ | ---------- | ------------------- |
| **Phase 1** | 扩展 ModelscopeProvider 支持 3D 参数 | 1-2 天     | 需确认 API 参数格式 |
| **Phase 2** | 新增 Camera3DParams 类型定义         | 0.5 天     | 无                  |
| **Phase 3** | 开发 Keyframe3DControl 组件          | 2-3 天     | Phase 2             |
| **Phase 4** | 集成到 ShotManager                   | 1-2 天     | Phase 3             |
| **Phase 5** | 运镜类型自动映射                     | 1 天       | Phase 4             |
| **Phase 6** | 测试与优化                           | 2-3 天     | Phase 5             |

### 5.2 风险与缓解

| 风险                    | 可能性 | 影响 | 缓解措施                     |
| ----------------------- | ------ | ---- | ---------------------------- |
| API 参数格式与预期不符  | 中     | 高   | 先进行 API 测试验证          |
| ModelScope 免费额度不足 | 中     | 中   | 实现成本估算和额度提醒       |
| 生成质量不达预期        | 中     | 高   | 提供参数微调功能和预览       |
| 与现有工作流冲突        | 低     | 中   | 作为可选功能，不影响现有流程 |

### 5.3 成本估算

**ModelScope API 定价**（参考）：

- Qwen-Image-Edit-2511：约 ¥0.1-0.2/张（需确认最新价格）
- 免费额度：每日 2000 次调用（部分模型）

**项目使用预估**：

- 单个分镜 3-5 个关键帧
- 每个关键帧可能需要 2-3 次视角调整
- 一个 100 分镜的项目：约 600-1500 次调用

---

## 六、替代方案

### 6.1 方案 B：独立 3D 视角工具页面

如果不适合集成到 ShotManager，可创建独立页面：

```
/views/Camera3DTool.tsx
- 上传图片
- 调整 3D 参数
- 批量生成多角度视图
- 导出到分镜
```

### 6.2 方案 C：仅作为模型配置选项

在模型配置中添加"启用 3D 相机控制"选项：

```typescript
// ModelConfig 扩展
capabilities: {
  supports3DCameraControl: boolean;
  supported3DParams: ['azimuth', 'elevation', 'radius'];
}
```

---

## 七、结论与建议

### 7.1 核心结论

1. **技术上完全可行**：
   - ModelScope API 已支持 Qwen-Image-Edit-2511
   - 项目已有 ModelscopeProvider 可直接扩展
   - 异步任务模式已成熟

2. **业务上高度契合**：
   - 完美匹配 Spec 中的"运镜感知关键帧生成"需求
   - 解决当前"运镜信息被忽略"的问题
   - 增强导演对关键帧的精确控制

3. **推荐集成位置**：
   - **首选**：分镜管理页面 (ShotManager) 的关键帧编辑区域
   - **作为现有生图功能的补充**，而非替代

### 7.2 实施建议

1. **先验证 API**：使用 curl 或 Postman 验证 ModelScope 的 Qwen-Image-Edit-2511 API 参数格式
2. **渐进式集成**：
   - 第一步：基础 3D 参数支持（Azimuth/Elevation/Radius）
   - 第二步：运镜类型自动映射
   - 第三步：批量视角生成
3. **保持向后兼容**：新功能作为可选增强，不影响现有工作流

### 7.3 下一步行动

1. [ ] 确认 ModelScope API 的具体参数格式和定价
2. [ ] 创建 API 测试脚本验证功能
3. [ ] 评估与当前 Spec 的优先级关系
4. [ ] 决定是否纳入当前迭代或后续版本

---

_文档生成时间：2026-02-26_
_基于 Qwen-Image-Edit-2511 公开资料分析_
