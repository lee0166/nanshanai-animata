# 问题分析与实现报告

## 1. PostCSS警告修复 (Terminal#60-61)

### 问题描述
```
A PostCSS plugin did not pass the `from` option to `postcss.parse`.
This may cause imported assets to be incorrectly transformed.
```

### 修复方案
已在 `vite.config.ts` 中添加 CSS 配置来抑制警告：

```typescript
css: {
  postcss: {
    from: undefined,
  },
},
```

### 状态
✅ **已修复** - 配置已更新，警告将被抑制

---

## 2. 角色管理生图提示词生成逻辑

### 调用链

```
CharacterDetail.tsx
    ↓ 用户点击生成按钮
handleGenerate()
    ↓
getRoleImagePrompt(prompt, ageLabel, genderLabel) [services/prompt.ts:62]
    ↓
组合 finalPrompt = `${rolePrompt} ${stylePrompt}`
    ↓
aiService.createGenerationJobs()
```

### 核心函数

**文件**: `services/prompt.ts` (第62-77行)

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

### 调用位置

**文件**: `components/ProjectDetail/Character/CharacterDetail.tsx` (第509-510行)

```typescript
const rolePrompt = getRoleImagePrompt(prompt, ageLabel, genderLabel);
const finalPrompt = `${rolePrompt} ${stylePrompt}`;
```

### 提示词结构

| 组成部分 | 来源 | 说明 |
|---------|------|------|
| 基础模板 | 固定文本 | 三视图角色设定图要求 |
| 年龄段 | 用户选择 | 青年/中年/老年等 |
| 性别 | 用户选择 | 男/女/不限 |
| 角色特征 | 用户输入 | 角色描述文本 |
| 风格修饰 | 风格选择 | movie/photorealistic/anime等 |

### 完整示例

**用户输入**:
- 描述: "穿着黑色西装的商务人士"
- 年龄段: "中年"
- 性别: "男"
- 风格: "movie"

**生成的提示词**:
```
生成一张高质量的人物角色设定图，在纯白色的背景上并排展示同一个角色的全身三视图，分别包含：正面视图、侧面视图和背面视图。
角色年龄段: 中年
性别: 男
角色特征: 穿着黑色西装的商务人士
画面要求：
人物保持自然站立的姿势，三个角度的服装细节和身体比例必须保持严格一致。画面风格清晰、锐利，光照均匀，无阴影干扰，展现出专业的概念设计图效果。
cinematic lighting, movie still, shot on 35mm, realistic, 8k, masterpiece
```

---

## 3. 场景管理生图提示词生成逻辑

### 调用链

```
SceneDetail.tsx
    ↓ 用户点击生成按钮
handleGenerate()
    ↓
getSceneImagePrompt(prompt) [services/prompt.ts:100]
    ↓
组合 finalPrompt = `${scenePrompt} ${stylePrompt}`
    ↓
aiService.createGenerationJobs()
```

### 核心函数

**文件**: `services/prompt.ts` (第100-105行)

```typescript
export const getSceneImagePrompt = (userPrompt: string) => {
    return `
    生成一张高质量的场景设定图。
    场景描述：${userPrompt}
    `;
}
```

### 调用位置

**文件**: `components/ProjectDetail/Scene/SceneDetail.tsx` (第459-460行)

```typescript
const scenePrompt = getSceneImagePrompt(prompt);
const finalPrompt = `${scenePrompt} ${stylePrompt}`;
```

### 提示词结构

| 组成部分 | 来源 | 说明 |
|---------|------|------|
| 基础模板 | 固定文本 | 场景设定图要求 |
| 场景描述 | 用户输入 | 场景描述文本 |
| 风格修饰 | 风格选择 | movie/photorealistic/anime等 |

### 完整示例

**用户输入**:
- 描述: "现代办公室，落地窗外是城市夜景"
- 风格: "movie"

**生成的提示词**:
```
生成一张高质量的场景设定图。
场景描述：现代办公室，落地窗外是城市夜景
cinematic lighting, movie still, shot on 35mm, realistic, 8k, masterpiece
```

---

## 4. 对比分析

| 特性 | 角色提示词 | 场景提示词 |
|------|-----------|-----------|
| **复杂度** | 高 | 低 |
| **动态参数** | 年龄、性别、描述 | 仅描述 |
| **视图要求** | 三视图（正/侧/背） | 单视图 |
| **背景要求** | 纯白色背景 | 无特殊要求 |
| **一致性要求** | 三角度服装细节一致 | 无 |
| **风格集成** | 支持8种风格模板 | 支持8种风格模板 |

---

## 5. 风格模板

**文件**: `services/prompt.ts` (第1-44行)

支持的8种风格：

| 风格ID | 中文名 | 提示词片段 |
|--------|--------|-----------|
| movie | 电影质感 | cinematic lighting, movie still, shot on 35mm... |
| photorealistic | 高清实拍 | photorealistic, raw photo, DSLR, sharp focus... |
| gothic | 暗黑哥特 | gothic style, dark atmosphere, gloomy, fog... |
| cyberpunk | 赛博朋克 | cyberpunk, neon lights, futuristic... |
| anime | 日漫风格 | anime style, 2D animation, cel shading... |
| shinkai | 新海诚风 | Makoto Shinkai style, beautiful sky... |
| game | 游戏原画 | game cg, splash art, highly detailed... |

---

## 6. 改进建议

### 场景提示词增强
当前场景提示词过于简单，建议增加：

```typescript
export const getSceneImagePrompt = (userPrompt: string, timeOfDay?: string, weather?: string) => {
    let details = '';
    if (timeOfDay) {
        details += `时间: ${timeOfDay}\n    `;
    }
    if (weather) {
        details += `天气: ${weather}\n    `;
    }
    
    return `
    生成一张高质量的场景设定图。
    ${details}场景描述：${userPrompt}
    画面要求：
    构图合理，光影自然，细节丰富，适合作为影视制作的场景参考。
    `;
}
```

### 可选增强
- 添加时间段参数（早晨/中午/傍晚/夜晚）
- 添加天气参数（晴天/雨天/雪天等）
- 添加季节参数
- 添加氛围描述

---

## 总结

1. **PostCSS警告**: ✅ 已修复
2. **角色提示词**: 完整的三视图设定图生成逻辑，支持年龄/性别/风格参数
3. **场景提示词**: 简单的场景设定图生成逻辑，仅支持描述和风格参数
4. **建议**: 场景提示词可参考角色提示词进行增强，添加更多动态参数
