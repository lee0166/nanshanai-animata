# 修复场景和物品剧本关联问题 Spec

## Why

用户反馈：角色、场景、物品都是在剧本解析页面创建的，但角色能正常关联剧本，而场景和物品不能正常关联。

经过深度代码分析，发现：

- CharacterMapping 组件接收 `scriptId` prop，创建角色时正确关联剧本
- SceneMapping 和 ItemMapping 组件**没有接收 `scriptId` prop**，创建时无法关联剧本

## What Changes

### 修复内容

1. **SceneMapping.tsx** - 添加 `scriptId` prop，创建场景时传入
2. **ItemMapping.tsx** - 添加 `scriptId` prop，创建物品时传入
3. **ScriptParser 父组件** - 传递 `scriptId` 给 SceneMapping 和 ItemMapping

### 代码对比

**CharacterMapping.tsx（正确）**:

```typescript
interface CharacterMappingProps {
  projectId: string;
  scriptId: string;  // ✅ 有 scriptId
  ...
}

const newCharacter: CharacterAsset = {
  ...
  scriptId,  // ✅ 传入 scriptId
  ...
};
```

**SceneMapping.tsx（错误）**:

```typescript
interface SceneMappingProps {
  projectId: string;
  // ❌ 缺少 scriptId
  ...
}

const newScene: SceneAsset = {
  ...
  // ❌ 没有传入 scriptId
  ...
};
```

**ItemMapping.tsx（错误）**:

```typescript
interface ItemMappingProps {
  projectId: string;
  // ❌ 缺少 scriptId
  ...
}

const newItem: ItemAsset = {
  ...
  // ❌ 没有传入 scriptId
  ...
};
```

## Impact

### 受影响的文件

- `components/ScriptParser/SceneMapping.tsx`
- `components/ScriptParser/ItemMapping.tsx`
- `components/ScriptParser/index.tsx`（或父组件）

### 向后兼容性

- ✅ 修复后新创建的场景/物品会正确关联剧本
- ✅ 老数据（无 scriptId）保持现状，可在"未分类"中查看

## ADDED Requirements

### Requirement: 场景创建时关联剧本

The system SHALL associate the current script when creating a scene from the script parser.

#### Scenario: 从剧本解析页面创建场景

- **GIVEN** 用户在剧本解析页面的场景标签
- **WHEN** 用户点击"创建场景"
- **THEN** 新创建的场景应自动关联当前剧本ID

### Requirement: 物品创建时关联剧本

The system SHALL associate the current script when creating an item from the script parser.

#### Scenario: 从剧本解析页面创建物品

- **GIVEN** 用户在剧本解析页面的物品标签
- **WHEN** 用户点击"创建物品"
- **THEN** 新创建的物品应自动关联当前剧本ID
