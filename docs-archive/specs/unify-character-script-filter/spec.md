# 统一角色剧本筛选功能 Spec

## Why

当前剧本筛选器只在右侧角色列表中，用户希望：

1. 筛选器位置更直观（移到"角色管理"标题旁）
2. 左侧角色卡片区域也能根据剧本筛选显示
3. 实现统一的筛选体验

## What Changes

### 功能变更

1. **移动筛选器位置**：从 `CharacterSidebar` 移到 `AssetList` 头部
2. **统一筛选逻辑**：左侧角色卡片和右侧角色列表共用同一个筛选状态
3. **保持现有功能**：右侧角色列表保持现有显示和交互

### 技术方案

**方案：状态提升到父组件（推荐）**

```
ProjectDetail.tsx
    ↓ 管理筛选状态
AssetList (左侧卡片区域) ← 接收筛选状态
CharacterSidebar (右侧列表) ← 接收筛选状态
```

**优点：**

- 两个组件共享同一个筛选状态
- 代码清晰，易于维护
- 不会破坏现有布局结构

## Impact

### 受影响的文件

- `views/ProjectDetail.tsx` - 添加筛选状态管理
- `components/AssetList.tsx` - 添加剧本筛选器，按剧本过滤角色
- `components/ProjectDetail/CharacterSidebar.tsx` - 移除筛选器，接收外部筛选状态

### 向后兼容性

- ✅ 不影响其他资产类型（场景、物品等）
- ✅ 只在角色管理页面生效
- ✅ 现有功能保持不变

## ADDED Requirements

### Requirement: 统一角色剧本筛选

The system SHALL provide a unified script filter for character management that controls both the card view and list view.

#### Scenario: 用户选择剧本筛选

- **GIVEN** 用户在角色管理页面
- **WHEN** 用户从筛选器选择一个剧本
- **THEN** 左侧角色卡片区域只显示该剧本的角色
- **AND** 右侧角色列表同步更新显示该剧本的角色

#### Scenario: 用户选择"全部剧本"

- **GIVEN** 用户在角色管理页面
- **WHEN** 用户选择"全部剧本"
- **THEN** 显示项目中所有角色（左侧卡片 + 右侧列表）

#### Scenario: 用户选择"未分类"

- **GIVEN** 用户在角色管理页面
- **WHEN** 用户选择"未分类"
- **THEN** 只显示没有剧本关联的角色（老角色）

## UI 设计

### 筛选器位置

```
┌─────────────────────────────────────────────────────────────┐
│  角色管理    [剧本筛选 ▼]                        [新建角色]   │  ← 筛选器移到标题旁
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                        │
│  │ 角色A   │ │ 角色B   │ │ 角色C   │   ← 左侧卡片区域        │
│  └─────────┘ └─────────┘ └─────────┘                        │
│                                                             │
├──────────────────────────┬──────────────────────────────────┤
│                          │  角色列表                          │
│                          │  ┌──────────────┐                 │
│                          │  │ 角色A        │   ← 右侧列表    │
│                          │  └──────────────┘                 │
└──────────────────────────┴──────────────────────────────────┘
```

### 筛选器选项

- **全部剧本** - 显示所有角色
- **未分类** - 显示没有剧本关联的角色
- **剧本A** - 显示特定剧本的角色
- **剧本B** - 显示特定剧本的角色

## Technical Notes

### 状态管理

```typescript
// ProjectDetail.tsx
const [characterScriptFilter, setCharacterScriptFilter] = useState<string>('all');
```

### 数据流

1. `ProjectDetail` 管理 `characterScriptFilter` 状态
2. 传递给 `AssetList` 和 `CharacterSidebar`
3. 两个组件根据 `characterScriptFilter` 过滤显示角色

### 筛选逻辑

```typescript
const filteredCharacters = characters.filter(char => {
  if (selectedScriptId === 'all') return true;
  if (selectedScriptId === 'uncategorized') return !char.scriptId;
  return char.scriptId === selectedScriptId;
});
```
