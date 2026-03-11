# 模型排序功能实现计划

## 问题描述

当前模型选择下拉框中的模型排序是固定的，用户无法根据需要调整模型的显示顺序。需要实现一个灵活的排序机制，允许：

1. 在配置中定义模型的排序权重
2. 支持下拉框中按权重排序显示
3. 保持向后兼容

## 当前状态分析

### 模型配置结构

```typescript
interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  type: 'image' | 'video' | 'llm';
  capabilities: ModelCapabilities;
  parameters: ModelParameter[];
  templateId?: string;
  apiKey?: string;
  isDefault?: boolean;
  apiUrl?: string;
  providerOptions?: any;
  costPer1KInput?: number;
  costPer1KOutput?: number;
  // ❌ 缺少排序字段
}
```

### 当前加载逻辑

```typescript
// ScriptManager.tsx:168
const models = settings.models.filter(m => m.type === 'llm');
setLlmModels(models); // 直接设置，无排序
```

### 当前渲染逻辑

```typescript
// ScriptManager.tsx:736
{llmModels.map(model => (
  <SelectItem key={model.id} value={model.id}>
    {model.name}
  </SelectItem>
))}
```

## 实现方案

### 方案 1：添加 sortOrder 字段（推荐）

在 ModelConfig 中添加 `sortOrder` 字段，数字越小排序越靠前。

**优点**：

- 简单直观
- 向后兼容（无 sortOrder 的模型默认排最后）
- 易于配置

**缺点**：

- 需要修改类型定义
- 需要更新现有模型配置

### 方案 2：使用数组顺序

保持 models 数组的顺序作为显示顺序，提供拖拽排序功能。

**优点**：

- 无需修改类型
- 可视化拖拽更直观

**缺点**：

- 实现复杂
- 需要额外的 UI 开发

### 方案 3：按名称/提供商排序

提供几种预设排序方式（名称、提供商、添加时间）。

**优点**：

- 无需修改配置
- 实现简单

**缺点**：

- 不够灵活
- 无法满足个性化需求

## 推荐方案：方案 1（添加 sortOrder 字段）

## 实施步骤

### 步骤 1：更新类型定义

**文件**：`types.ts`

```typescript
export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  type: 'image' | 'video' | 'llm';
  capabilities: ModelCapabilities;
  parameters: ModelParameter[];
  templateId?: string;
  apiKey?: string;
  isDefault?: boolean;
  apiUrl?: string;
  providerOptions?: any;
  costPer1KInput?: number;
  costPer1KOutput?: number;
  sortOrder?: number; // 新增：排序权重，数字越小越靠前，默认 999
}
```

### 步骤 2：更新模型加载逻辑

**文件**：`views/ScriptManager.tsx`

修改 `loadLlmModels` 函数，添加排序逻辑：

```typescript
const loadLlmModels = () => {
  const models = settings.models
    .filter(m => m.type === 'llm')
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)); // 按 sortOrder 排序
  setLlmModels(models);
  // ...
};
```

### 步骤 3：更新模型配置界面

**文件**：`views/Settings.tsx`

在模型编辑表单中添加排序字段：

```typescript
// 在模型编辑表单中添加
<Input
  type="number"
  label="排序权重"
  placeholder="数字越小排序越靠前"
  value={editingModel.sortOrder?.toString() ?? '999'}
  onChange={(e) => setEditingModel({...editingModel, sortOrder: parseInt(e.target.value) || 999})}
/>
```

### 步骤 4：更新默认模型配置

**文件**：`config/models.ts`

为常用模型添加默认排序：

```typescript
export const DEFAULT_MODELS: ModelConfig[] = [
  // LLM 模型 - 常用模型排前面
  {
    id: 'doubao-lite-32k',
    name: '豆包 Lite 32K',
    provider: 'volcengine',
    modelId: 'doubao-lite-32k',
    type: 'llm',
    sortOrder: 10, // 常用，排前面
    // ...
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'volcengine',
    modelId: 'deepseek-v3',
    type: 'llm',
    sortOrder: 20, // 次常用
    // ...
  },
  // ...
];
```

### 步骤 5：迁移现有配置

**文件**：`services/ModelConfigBridge.ts` 或 `config/settings.ts`

为没有 sortOrder 的现有模型添加默认值：

```typescript
// 在加载模型配置时
const migrateModelConfig = (model: ModelConfig): ModelConfig => {
  return {
    ...model,
    sortOrder: model.sortOrder ?? 999, // 无排序值的默认排最后
  };
};
```

## 其他需要更新的文件

### 图像/视频模型选择

以下文件也需要添加相同的排序逻辑：

1. `components/ProjectDetail/GenerationForm.tsx` - 图像生成模型选择
2. `components/ProjectDetail/Shared/ImageGenerationPanel.tsx` - 关键帧生图模型选择
3. `views/ShotManager.tsx` - 视频生成模型选择

### 模型配置管理

1. `services/ai/core/ModelConfigManager.ts` - 模型配置管理
2. `components/Settings/ModelConfigForm.tsx` - 模型配置表单（如果有）

## 向后兼容性

- **无 sortOrder 的模型**：默认值为 999，排到最后
- **现有配置**：自动迁移，不影响使用
- **类型定义**：sortOrder 为可选字段，不破坏现有代码

## 测试验证

1. **新模型配置**：添加 sortOrder 后正确排序
2. **现有模型**：无 sortOrder 时默认排最后
3. **相同 sortOrder**：保持原有顺序（稳定排序）
4. **配置保存**：sortOrder 正确持久化
5. **配置加载**：sortOrder 正确恢复

## UI 建议

### 设置界面

- 在模型列表中显示当前排序
- 提供快速调整排序的按钮（上移/下移）
- 显示排序数字输入框

### 下拉框显示

- 保持当前样式
- 按 sortOrder 排序后的顺序显示

## 实施优先级

| 步骤                 | 优先级 | 工作量 | 说明               |
| -------------------- | ------ | ------ | ------------------ |
| 步骤 1：更新类型定义 | 高     | 5分钟  | 基础，必须先做     |
| 步骤 2：更新加载逻辑 | 高     | 10分钟 | ScriptManager.tsx  |
| 步骤 3：更新配置界面 | 中     | 20分钟 | Settings.tsx       |
| 步骤 4：更新默认配置 | 低     | 15分钟 | models.ts          |
| 步骤 5：迁移逻辑     | 中     | 10分钟 | 可选，有默认值即可 |
| 其他文件更新         | 低     | 30分钟 | 图像/视频模型选择  |

## 总结

通过添加 `sortOrder` 字段，可以实现：

- ✅ 灵活的模型排序
- ✅ 向后兼容
- ✅ 配置持久化
- ✅ 易于理解和使用

预计总工作量：约 1.5 小时
