# 人物形象生图功能说明

本文档介绍人物形象生图功能的核心特点，包括提示词自动增强机制和生成规范。

## 功能概述

人物形象生图模块采用智能提示词增强技术，系统会根据用户输入的原始描述，自动生成符合专业概念设计图标准的提示词。这一设计确保生成的图像具有统一的格式和质量标准。

## 提示词增强机制

### 增强流程

在 `CharacterDetail.tsx` 的 `handleGenerate` 函数中，系统会自动对用户输入的提示词进行增强处理：

```typescript
// 获取性别和年龄的翻译标签
const genderLabel = t.character.genderOptions[gender] || gender;
const ageLabel = t.character.ageOptions[ageGroup] || ageGroup;

// 调用提示词增强函数
const rolePrompt = getRoleImagePrompt(prompt, ageLabel, genderLabel);

// 叠加风格修饰词
const finalPrompt = `${rolePrompt} ${stylePrompt}`;
```

### 增强函数实现

`services/prompt.ts` 中的 `getRoleImagePrompt` 函数负责核心增强逻辑：

```typescript
export const getRoleImagePrompt = (userPrompt: string, age: string, gender: string) => {
    let details = '';
    if (age && age !== 'unknown' && age !== '不详') {
        details += `角色年龄段: ${age}\n    `;
    }
    if (gender && gender !== 'unlimited' && gender !== '不限') {
        details += `性别: ${gender}\n    `;
    }

    return `
    生成一张高质量的人物角色设定图，在纯白色的背景上并排展示同一个角色的全身三视图，分别包含：正面视图、侧面视图和背面视图。
    ${details}角色特征: ${userPrompt} 
    画面要求：
    人物保持自然站立的姿势，三个角度的服装细节和身体比例必须保持严格一致。画面风格清晰、锐利，光照均匀，无阴影干扰，展现出专业的概念设计图效果。
    `;
}
```

### 增强内容

系统会自动在用户提示词基础上添加以下增强内容：

| 增强项 | 说明 |
| :--- | :--- |
| **构图要求** | 在纯白色背景上并排展示三视图（正面、侧面、背面） |
| **性别标注** | 自动添加用户选择的性别信息 |
| **年龄段标注** | 自动添加用户选择的年龄段信息 |
| **姿态要求** | 自然站立姿势 |
| **一致性要求** | 三个角度的服装细节和身体比例必须严格一致 |
| **质量要求** | 清晰、锐利、光照均匀、无阴影干扰 |

## 生成特点

### 三视图生成

默认情况下，人物形象生图功能会生成**三视图**图像，包含：

1. **正面视图 (Front View)** - 展示角色的正面特征
2. **侧面视图 (Side View)** - 展示角色的侧面轮廓
3. **背面视图 (Back View)** - 展示角色的背面细节

三个视图在纯白色背景上并排展示，确保服装、身材比例在各角度保持一致。

### 风格叠加

如果用户选择了特定风格（如电影质感、高清实拍、暗黑哥特等），系统会自动将风格修饰词追加到最终提示词中：

| 风格 | 修饰词 |
| :--- | :--- |
| 电影质感 | cinematic lighting, movie still, shot on 35mm |
| 高清实拍 | photorealistic, raw photo, DSLR, sharp focus |
| 暗黑哥特 | gothic style, dark atmosphere, gloomy, fog |
| 赛博朋克 | cyberpunk, neon lights, futuristic, rainy street |
| 日漫风格 | anime style, 2D animation, cel shading |
| 新海诚风 | Makoto Shinkai style, beautiful sky, lens flare |
| 游戏原画 | game cg, splash art, highly detailed, epic composition |

## 数据存储

### 提示词字段说明

系统会分别保存原始提示词和增强后的提示词：

| 字段名 | 内容 | 说明 |
| :--- | :--- | :--- |
| `prompt` | 增强后的完整提示词 | 发送给 AI 模型的实际内容 |
| `userPrompt` | 用户输入的原始描述 | 用于记录用户意图，可用于后续回溯 |

### 示例

用户输入：
```
黑色长发，蓝色眼睛，红色连衣裙
```

系统生成：
```
生成一张高质量的人物角色设定图，在纯白色的背景上并排展示同一个角色的全身三视图，分别包含：正面视图、侧面视图和背面视图。
角色年龄段: 成年
性别: 女性
角色特征: 黑色长发，蓝色眼睛，红色连衣裙 
画面要求：
人物保持自然站立的姿势，三个角度的服装细节和身体比例必须保持严格一致。画面风格清晰、锐利，光照均匀，无阴影干扰，展现出专业的概念设计图效果。
```

## 注意事项

### AI 模型行为

- AI 模型对提示词的理解可能存在差异，某些情况下可能只生成单视图而非完整的三视图
- 模型可能根据自身理解对提示词进行调整，导致生成结果与预期有所差异
- 建议在生成后仔细检查各角度的一致性

### 参数影响

- **宽高比 (aspectRatio)**：设置为 1:1 时最适合三视图展示
- **分辨率 (resolution)**：更高的分辨率可以呈现更清晰的细节
- **生成数量 (count)**：建议设置为 1 以获得最佳单次生成效果

## 相关文件

| 文件路径 | 说明 |
| :--- | :--- |
| `components/ProjectDetail/Character/CharacterDetail.tsx` | 人物详情组件，包含生图逻辑 |
| `services/prompt.ts` | 提示词增强函数定义 |
| `services/aiService.ts` | AI 服务协调层 |
| `services/ai/providers/` | 各模型提供商实现 |

## 常见问题

### Q: 可以只生成正面视图吗？

A: 当前版本暂不支持选择生成单视图。如有需要，可联系开发团队添加此功能选项。

### Q: 为什么有时候生成的不是三视图？

A: AI 模型对提示词的理解可能不完全一致，建议尝试以下方法：
1. 明确在提示词中强调"三视图"
2. 调整生成参数后重试
3. 尝试使用不同的模型

### Q: 生成的图像角度不一致怎么办？

A: 这是 AI 模型的固有特性。建议：
1. 多次尝试生成
2. 使用参考图像辅助生成
3. 在后期处理中手动调整
