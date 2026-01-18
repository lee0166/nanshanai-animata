# 视频生成模型统一参数指南

本文档介绍了系统封装后的视频生成模型统一参数标准。这些参数涵盖了从生成时长、分辨率到高级运镜控制的各类选项。

## 统一参数键名 (Unified Keys)

所有参数键名定义在 `services/modelUtils.ts` 的 `UNIFIED_KEYS` 常量中。

| 统一键名 (Key) | 描述 | 类型 | 示例值 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| `resolution` | 视频分辨率 | `string` (Select) | `"720p"`, `"1080p"`, `"1K"` | |
| `aspectRatio` | 视频宽高比 | `string` (Select) | `"16:9"`, `"9:16"`, `"1:1"`, `"adaptive"` | `adaptive` 表示自适应首帧比例 |
| `duration` | 视频时长 (秒) | `number` / `select` | `5`, `10` | |
| `generateAudio` | 是否生成音效 | `boolean` | `true`, `false` | 部分模型支持同步生成音效 |
| `bgm` | 背景音乐 | `boolean` | `true`, `false` | Vidu 模型专用 |
| `movementAmplitude` | 运动幅度 | `string` (Select) | `"auto"`, `"small"`, `"medium"`, `"large"` | Vidu 模型专用，控制画面运动幅度 |
| `voiceId` | 声音 ID | `string` | `"zh_female_1"` | Vidu 模型专用，用于口型同步等 |
| `isRec` | 是否录制 | `boolean` | `true`, `false` | Vidu 模型专用 |
| `seed` | 随机种子 | `number` | `123456` | 用于结果复现 |
| `watermark` | 是否添加水印 | `boolean` | `false`, `true` | |
| `returnLastFrame` | 是否返回尾帧 | `boolean` | `true`, `false` | 用于生成连贯视频的下一段 |
| `cameraFixed` | 镜头固定 | `boolean` | `true`, `false` | 减少运镜幅度，保持画面稳定 |
| `frames` | 总帧数 | `number` | `25`, `50` | 高级参数，通常由 duration * fps 决定 |
| `framesPerSecond` | 帧率 (FPS) | `number` | `24`, `30`, `60` | |
| `offPeak` | 错峰模式 | `boolean` | `true` | Vidu 模型特有，低优先级生成 |

## 参数详情与映射示例

### 1. resolution (分辨率) & aspectRatio (宽高比)

*   **定义**: 视频的尺寸和比例。
*   **Provider 映射**:
    *   **Volcengine**:
        *   `resolution` -> `req.body.resolution` (API V3)
        *   `aspectRatio` -> `req.body.ratio` (API V3)
    *   **Vidu**:
        *   `resolution` -> `req.body.resolution`
        *   `aspectRatio` -> `req.body.aspect_ratio`

### 2. duration (时长)

*   **定义**: 生成视频的长度。
*   **注意**: 不同模型支持的时长范围不同 (如 3-10秒)。
*   **Provider 映射**:
    *   **Volcengine**: `req.body.duration`
    *   **Vidu**: `req.body.duration`

### 3. Audio & Music (音效与音乐)

*   **generateAudio (Volcengine)**:
    *   **定义**: 是否生成背景音效。
    *   **映射**: `req.body.generate_audio` (boolean)
*   **bgm (Vidu)**:
    *   **定义**: 是否生成背景音乐。
    *   **映射**: `req.body.bgm` (boolean)

### 4. Movement Control (运动控制)

*   **movementAmplitude (Vidu)**:
    *   **定义**: 画面运动的幅度强度。
    *   **映射**: `req.body.movement_amplitude` ("auto", "small", "medium", "large")
*   **cameraFixed (Volcengine)**:
    *   **定义**: 镜头是否固定。
    *   **映射**: 影响 prompt 关键词或特定参数

### 5. Advanced Vidu Params (Vidu 高级参数)

*   **voiceId**: `req.body.voice_id`
*   **isRec**: `req.body.is_rec`
*   **watermark**: `req.body.watermark`

## 接入新模型开发流程

1.  **配置定义**: 在 `config/models.ts` 中定义新视频模型。
2.  **通用参数引用**: 推荐使用 `COMMON_VOLC_VIDEO_PARAMS` 或 `COMMON_VIDU_PARAMS` 等预设常量来快速配置基础参数。
3.  **UI 渲染**: `FragmentDetail.tsx` 和 `GenerationForm.tsx` 会根据配置动态渲染表单。
4.  **Provider 适配**: 在 `ViduProvider.ts` 或其他 Provider 中，确保从 `extraParams` 中正确读取并映射参数。

## 示例配置 (models.ts)

```typescript
// 引用通用参数
const COMMON_VIDU_PARAMS = [
  { name: "bgm", type: "boolean", defaultValue: false },
  { name: "movementAmplitude", type: "select", options: [...] },
];

// 模型定义
{
  id: "vidu-new-model",
  type: "video",
  parameters: [
    ...COMMON_VIDU_PARAMS, // 继承通用参数
    {
      name: "duration", // 覆盖或新增特定参数
      label: "时长",
      type: "number",
      defaultValue: 5,
    }
  ]
}
```
