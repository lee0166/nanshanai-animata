# 问题分析与实施计划

## 问题1: Terminal#60-61 PostCSS插件警告

### 问题描述

```
A PostCSS plugin did not pass the `from` option to `postcss.parse`.
This may cause imported assets to be incorrectly transformed.
```

### 问题分析

- 警告来自 `@tailwindcss/postcss` 插件
- 这是 TailwindCSS v4 的已知问题
- 不影响功能，但会产生控制台噪音

### 解决方案

**方案A: 升级/修复配置（推荐）**

1. 检查 `@tailwindcss/postcss` 版本
2. 更新 `postcss.config.js` 添加 `from` 选项
3. 或升级到修复版本

**方案B: 抑制警告**

1. 配置 Vite 隐藏 PostCSS 警告
2. 或在开发服务器配置中过滤

### 实施步骤

1. 查看 `package.json` 确认 `@tailwindcss/postcss` 版本
2. 尝试更新配置或升级包
3. 验证警告是否消失

---

## 问题2: 角色管理中生图提示词的生成逻辑

### 当前实现

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
};
```

### 调用位置

需要查找角色生成功能的调用点：

- `components/ProjectDetail/Character/` 目录
- `views/ShotManager.tsx`
- `services/keyframe/KeyframeEngine.ts`

### 提示词结构分析

1. **基础模板**: 三视图角色设定图
2. **动态参数**:
   - `userPrompt`: 用户输入的角色描述
   - `age`: 年龄段（青年/中年/老年等）
   - `gender`: 性别（男/女/不限）
3. **固定要求**:
   - 纯白背景
   - 三视图（正面/侧面/背面）
   - 全身展示
   - 服装细节一致
   - 专业概念设计图效果

---

## 问题3: 场景管理中生图提示词的生成逻辑

### 当前实现

**文件**: `services/prompt.ts` (第100-105行)

```typescript
export const getSceneImagePrompt = (userPrompt: string) => {
  return `
    生成一张高质量的场景设定图。
    场景描述：${userPrompt}
    `;
};
```

### 调用位置

需要查找场景生成功能的调用点：

- `components/ProjectDetail/Scene/SceneDetail.tsx`
- `components/ProjectDetail/Fragment/FragmentDetail.tsx`

### 提示词结构分析

1. **基础模板**: 场景设定图
2. **动态参数**:
   - `userPrompt`: 用户输入的场景描述
3. **当前问题**: 提示词过于简单，缺少风格、光照、构图等要求

---

## 实施计划

### 阶段1: 修复PostCSS警告

1. 检查 `@tailwindcss/postcss` 版本
2. 尝试更新到最新版本
3. 或配置 Vite 抑制警告

### 阶段2: 分析角色提示词调用链

1. 查找 `getRoleImagePrompt` 的所有调用位置
2. 分析参数传递路径
3. 检查是否有风格模板集成
4. 验证提示词生成是否符合预期

### 阶段3: 分析场景提示词调用链

1. 查找 `getSceneImagePrompt` 的所有调用位置
2. 分析参数传递路径
3. 检查与角色提示词的差异
4. 评估是否需要增强场景提示词模板

### 阶段4: 验证与测试

1. 验证PostCSS警告修复
2. 测试角色生成功能
3. 测试场景生成功能
4. 检查生成的提示词质量

---

## 预期输出

1. **PostCSS警告**: 消除或抑制
2. **角色提示词文档**: 完整的调用链分析和提示词模板说明
3. **场景提示词文档**: 完整的调用链分析和提示词模板说明
4. **改进建议**（如有）: 针对提示词模板的优化建议
