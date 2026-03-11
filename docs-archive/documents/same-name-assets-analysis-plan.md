# 不同剧本同名角色/场景问题分析与解决方案

## 问题理解

**用户场景**：

1. 一个项目可以上传多个剧本
2. 不同剧本中可能有同名的角色或场景（如：两个剧本都有"张三"这个角色）
3. 当前系统会提示"名称已存在"
4. 这会导致分镜制作时关联混乱

**核心问题**：

- 系统如何区分不同剧本的同名角色/场景？
- 分镜制作时如何正确关联到对应剧本的角色/场景？
- 如何避免同名造成的混淆？

## 当前系统实现分析

### 1. 数据结构

**Asset接口**（types.ts第30-35行）：

```typescript
export interface Asset {
  id: string;
  projectId: string;
  scriptId?: string; // 关联剧本ID，用于区分不同剧本的角色
  type: AssetType;
  name: string;
  // ...
}
```

**关键字段**：`scriptId` - 已经存在，用于关联剧本

### 2. 重复名称检查逻辑

**位置**：views/ProjectDetail.tsx 第316-321行

```typescript
const assets = await storageService.getAssets(id || '');
const exists = assets.some(
  a => a.type === updatedAsset.type && a.name === updatedAsset.name && a.id !== updatedAsset.id
);
if (exists) {
  showToast(t.errors?.duplicateName || 'Name already exists', 'error');
  return;
}
```

**问题**：检查重复时**没有考虑scriptId**，导致不同剧本的同名角色也被视为重复

### 3. 资产创建逻辑

**CharacterMapping.tsx**（第60-99行）：

- 创建角色时设置了`scriptId`字段
- 但没有检查是否已存在同名的角色

**SceneMapping.tsx**（第58-行）：

- 创建场景时设置了`scriptId`字段
- 同样没有检查重复

### 4. 分镜关联逻辑

**ShotList.tsx**（第105-115行）：

```typescript
const assets = await storageService.getAssets(projectId);
setProjectAssets({
  characters: assets.filter(a => a.type === AssetType.CHARACTER) as CharacterAsset[],
  scenes: assets.filter(a => a.type === AssetType.SCENE),
});
```

**问题**：加载资产时**没有按scriptId过滤**，导致所有剧本的角色/场景混在一起

## 根本问题总结

1. **重复名称检查过于严格**：没有考虑scriptId，不同剧本的同名资产被视为重复
2. **资产展示没有区分剧本**：所有剧本的资产混在一起显示，造成混淆
3. **分镜关联时没有剧本隔离**：分镜可能关联到错误剧本的同名角色/场景

## 解决方案

### 方案A：允许不同剧本同名（推荐）

**核心思想**：不同剧本的资产完全隔离，允许同名

**实施内容**：

1. **修改重复名称检查逻辑**
   - 检查重复时同时考虑`type`、`name`和`scriptId`
   - 不同剧本的同名资产不视为重复

2. **资产展示增加剧本隔离**
   - 在角色/场景列表中显示所属剧本信息
   - 可以按剧本筛选资产

3. **分镜关联时限定当前剧本**
   - 分镜只能关联当前剧本的角色/场景
   - 避免跨剧本关联错误

### 方案B：全局唯一名称（强制区分）

**核心思想**：强制要求所有剧本间的角色/场景名称全局唯一

**实施内容**：

1. **自动重命名**
   - 当检测到同名时，自动添加剧本后缀（如："张三（剧本A）"）

2. **显示完整路径**
   - 在角色/场景名称后显示所属剧本

3. **创建时提示**
   - 明确告知用户名称冲突，要求修改

## 推荐方案：方案A（允许不同剧本同名）

理由：

- 符合用户直觉（不同剧本的角色应该是独立的）
- 不需要强制修改用户数据
- 系统已有scriptId字段支持

## 详细实施计划

### 阶段1：修复重复名称检查

**文件**：views/ProjectDetail.tsx 第316-321行

**修改前**：

```typescript
const exists = assets.some(
  a => a.type === updatedAsset.type && a.name === updatedAsset.name && a.id !== updatedAsset.id
);
```

**修改后**：

```typescript
const exists = assets.some(
  a =>
    a.type === updatedAsset.type &&
    a.name === updatedAsset.name &&
    a.scriptId === updatedAsset.scriptId && // 同剧本才视为重复
    a.id !== updatedAsset.id
);
```

### 阶段2：资产展示增加剧本标识

**文件**：components/ScriptParser/CharacterMapping.tsx
**文件**：components/ScriptParser/SceneMapping.tsx

修改内容：

1. 在角色/场景卡片上显示所属剧本名称
2. 添加剧本筛选功能（可选）

### 阶段3：分镜关联限定当前剧本

**文件**：components/ScriptParser/ShotList.tsx

修改内容：

1. 加载资产时按当前scriptId过滤
2. 只显示当前剧本的角色和场景

### 阶段4：验证和测试

1. 测试不同剧本创建同名角色
2. 测试分镜正确关联到当前剧本的角色
3. 测试编辑时不会跨剧本冲突

## 预期效果

- 不同剧本可以创建同名角色/场景，不会提示"名称已存在"
- 分镜制作时只能看到当前剧本的角色/场景，避免混淆
- 资产列表清晰显示所属剧本，便于区分
- 系统逻辑清晰，剧本间完全隔离
