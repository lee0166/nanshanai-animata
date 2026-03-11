# 修复 sortOrder 持久化问题计划

## 问题描述

用户反馈 sortOrder（排序权重）在编辑保存后可能没有正确持久化保存。

## 问题分析

经过代码检查，发现以下问题：

### 问题 1：API Key 直接修改时丢失 sortOrder

**位置**：`views/Settings.tsx` 第 1407-1410 行

**问题代码**：

```typescript
const updatedModels = settings.models.map(m => (m.id === model.id ? { ...m, apiKey: val } : m));
updateSettings({ ...settings, models: updatedModels });
```

**问题**：虽然使用了 `{ ...m }` 展开，但这种写法在 TypeScript 中可能会丢失某些字段的类型推断，或者当 model 对象结构变化时可能不完整。

### 问题 2：需要验证保存逻辑

**位置**：`views/Settings.tsx` 第 341-371 行（handleSaveEdit）

**当前代码**：

```typescript
return {
  ...m,
  name: editFormData.name,
  modelId: editFormData.modelId,
  apiKey: editFormData.apiKey,
  apiUrl: editFormData.apiUrl || undefined,
  parameters: updatedParameters,
  costPer1KInput: editFormData.costPer1KInput,
  costPer1KOutput: editFormData.costPer1KOutput,
  sortOrder: editFormData.sortOrder,
};
```

看起来是正确的，但需要验证是否确实保存到了 storage。

## 修复方案

### 步骤 1：修复 API Key 修改逻辑

将内联的 apiKey 修改逻辑改为使用完整的模型对象更新：

```typescript
// 修改前
const updatedModels = settings.models.map(m => (m.id === model.id ? { ...m, apiKey: val } : m));

// 修改后
const updatedModels = settings.models.map(m => {
  if (m.id === model.id) {
    return { ...m, apiKey: val };
  }
  return m;
});
```

### 步骤 2：添加保存验证日志

在 handleSaveEdit 中添加 console.log 验证 sortOrder 是否正确保存：

```typescript
console.log('[Settings] Saving model with sortOrder:', editFormData.sortOrder);
console.log(
  '[Settings] Updated models:',
  updatedModels.find(m => m.id === editingModel.id)
);
```

### 步骤 3：检查 storage 保存逻辑

验证 `updateSettings` 是否正确将数据保存到 storage：

```typescript
// 在 updateSettings 调用后检查
const savedSettings = await storageService.getSettings();
console.log(
  '[Settings] Saved to storage:',
  savedSettings.models.find(m => m.id === editingModel.id)?.sortOrder
);
```

## 实施步骤

1. **修复 API Key 修改逻辑**（5分钟）
   - 修改第 1407-1410 行的代码格式
2. **添加调试日志**（5分钟）
   - 在 handleSaveEdit 中添加日志
   - 测试保存后查看日志输出

3. **验证修复**（10分钟）
   - 编辑模型，修改 sortOrder
   - 保存后刷新页面
   - 检查 sortOrder 是否持久化

## 预期结果

- sortOrder 能够正确保存到 storage
- 刷新页面后 sortOrder 值保持不变
- 表格中显示的排序权重与设置一致
