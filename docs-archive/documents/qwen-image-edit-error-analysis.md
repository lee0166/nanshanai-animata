# Qwen-Image-Edit-2511 错误分析

## 错误信息

```
Qwen Image Edit requires image upload
```

## 错误原因

**Qwen/Qwen-Image-Edit-2511** 是一个**图生图（Image-to-Image）**模型，而不是文生图（Text-to-Image）模型。

### 模型特性对比

| 特性         | Qwen-Image-Edit-2511             | 普通文生图模型       |
| ------------ | -------------------------------- | -------------------- |
| **类型**     | 图生图                           | 文生图               |
| **必需输入** | 必须有输入图片                   | 只需要文本提示词     |
| **功能**     | 基于输入图片进行编辑/修改        | 根据文本生成全新图片 |
| **使用场景** | 修改现有图片、风格迁移、局部编辑 | 从零生成图片         |

## 解决方案

### 方案 1：使用文生图模型（推荐）

如果您想根据文本描述生成图片，请使用以下文生图模型：

| 模型名称                                    | 提供商     | 说明                |
| ------------------------------------------- | ---------- | ------------------- |
| `Qwen/Qwen2.5-VL-7B-Instruct`               | ModelScope | 通义千问文生图      |
| ` stabilityai/stable-diffusion-xl-base-1.0` | ModelScope | Stable Diffusion XL |
| `AI-ModelScope/FLUX.1-dev`                  | ModelScope | FLUX 模型           |

### 方案 2：提供输入图片

如果您确实需要使用 Qwen-Image-Edit-2511，必须提供输入图片：

```typescript
// 调用方式示例
const result = await modelscopeProvider.generateImage(
  '修改描述',
  modelConfig,
  ['path/to/input/image.png'], // 必须提供参考图片
  aspectRatio,
  resolution
);
```

## 如何区分模型类型

### 在设置中添加模型时：

1. **文生图模型**：
   - 不需要勾选 "支持参考图"
   - 只需要文本提示词

2. **图生图模型**（如 Qwen-Image-Edit-2511）：
   - 必须勾选 "支持参考图"
   - 调用时必须提供输入图片
   - 模型名称通常包含 "Edit" 字样

## 当前项目配置建议

### 如果您想使用 Qwen-Image-Edit-2511：

1. 在设置 → 模型配置中添加模型
2. 勾选 "支持参考图"
3. 在使用时上传输入图片

### 如果您想文生图：

1. 在设置 → 模型配置中选择其他文生图模型
2. 或使用已配置的默认文生图模型

## 相关 API 文档

根据 `Qwen 3D Camera Control功能的api文档.txt`，Qwen-Image-Edit-2511 的正确调用方式：

```python
# 图生图调用示例
result = client.predict(
    image=handle_file('input.png'),  # 必须提供输入图片
    azimuth=0,
    elevation=0,
    distance=1,
    seed=0,
    randomize_seed=True,
    guidance_scale=1,
    num_inference_steps=4,
    height=1024,
    width=1024,
    api_name="/infer_camera_edit"
)
```

## 总结

- **错误原因**：用文生图方式调用了图生图模型
- **解决方案**：要么换文生图模型，要么提供输入图片
- **建议**：根据实际需求选择合适的模型类型
