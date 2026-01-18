# 图片生成模型统一参数指南

本文档介绍了系统封装后的图片生成模型统一参数标准。这些参数用于前端 UI 组件与后端 AI 服务之间的数据交互，确保不同模型提供商（如火山引擎、Vidu 等）的接入规范一致性。

## 统一参数键名 (Unified Keys)

所有参数键名定义在 `services/modelUtils.ts` 的 `UNIFIED_KEYS` 常量中。

| 统一键名 (Key) | 描述 | 类型 | 示例值 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| `resolution` | 生成图片的分辨率/尺寸 | `string` (Select) | `"1K"`, `"2K"`, `"4K"`, `"1024x1024"`, `"1080p"` | 核心参数，不同模型支持的选项不同 |
| `aspectRatio` | 图片宽高比 | `string` (Select) | `"1:1"`, `"16:9"`, `"3:4"` | 部分模型通过 `resolution` 直接指定尺寸，部分通过此参数控制比例 |
| `guidanceScale` | 提示词相关性 (CFG Scale) | `number` | `3.5` (范围通常 1-20) | 控制生成内容与提示词的匹配程度 |
| `seed` | 随机种子 | `number` | `123456` (-1 表示随机) | 用于复现生成结果 |
| `watermark` | 是否添加水印 | `boolean` | `false`, `true` | |
| `responseFormat` | 图片返回格式 | `string` (Select) | `"b64_json"`, `"url"` | 决定返回 Base64 数据还是图片 URL |
| `count` | 生成数量 | `number` | `1`, `4` | 单次请求生成的图片数量 |
| `style` | 风格预设 | `string` | `"anime"`, `"photorealistic"` | 可选的风格修饰词 |

## 参数详情与映射示例

### 1. resolution (分辨率)

*   **定义**: 控制生成图片的尺寸大小。
*   **常见选项**:
    *   `1K` (约 100万像素，Vidu 映射为 `1080p`)
    *   `2K` (约 200万像素)
    *   `4K` (约 400万像素)
    *   `1024x1024` (具体像素值)
*   **Provider 映射**:
    *   **Volcengine (Seedream)**: 映射为 API 的 `size` 参数 (如 `1024*1024`) 或通过策略类 `resolveSize` 动态计算。
    *   **Vidu**: 映射为 `resolution`。
        *   `viduq1`: 仅支持 `1080p` (映射自 `1K`)。
        *   `viduq2`: 支持 `1080p` (映射自 `1K`), `2K`, `4K`。

### 2. aspectRatio (宽高比)

*   **定义**: 控制生成图片的宽高比例。
*   **Provider 映射**:
    *   **Volcengine**: 通常通过 `size` (resolution) 隐含控制。
    *   **Vidu**: 显式映射为 `aspect_ratio` (如 `16:9`, `9:16`, `1:1`, `21:9` 等)。
        *   支持 `auto` 选项，表示与首张输入图保持相同比例。

### 3. guidanceScale (相关性)

*   **定义**: 控制生成内容对 Prompt 的遵循程度。
*   **默认值**: 通常为 `3.5` 或 `7.0`。
*   **Provider 映射**:
    *   **Volcengine**: 映射为 `guidance_scale`。

### 4. seed (随机种子)

*   **定义**: 用于控制生成的随机性。
*   **用法**: 前端传递 `-1` 时，后端不传递该参数或生成一个随机数；传递具体数值时，后端透传给模型。
*   **Provider 映射**:
    *   **Volcengine**: 映射为 `seed`。
    *   **Vidu**: 映射为 `seed`。

## 接入新模型开发流程

1.  **配置定义**: 在 `config/models.ts` 中定义新模型。
2.  **参数声明**: 在 `parameters` 数组中声明该模型支持的统一参数。
3.  **UI 渲染**: 前端组件 (如 `GenerationForm.tsx`) 会自动读取 `parameters` 并渲染对应的 Input/Select。
4.  **参数处理**: 在 `Provider` (如 `VolcengineProvider.ts`) 中，从 `extraParams` 对象中读取统一键名，并映射到具体 API 的请求字段。

## 示例配置 (models.ts)

```typescript
{
  id: "vidu-img-q2",
  name: "Vidu Q2 (Image)",
  type: "image",
  parameters: [
    {
      name: "resolution", // 使用统一键名
      label: "Resolution",
      type: "select",
      options: [
        { label: "1080p", value: "1080p" },
        { label: "2K", value: "2K" }
      ],
      defaultValue: "1080p"
    },
    {
      name: "aspectRatio",
      label: "Ratio",
      type: "select",
      options: [
        { label: "16:9", value: "16:9" },
        { label: "1:1", value: "1:1" }
      ],
      defaultValue: "16:9"
    }
  ]
}
```
