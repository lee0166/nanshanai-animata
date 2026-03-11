# 修复角色剧本关联显示问题 Spec

## Why

用户反馈：新创建的角色在角色列表中显示"未知剧本"，但日志显示 `scriptId` 已正确保存到资产数据中。需要彻底排查并修复角色剧本关联的显示问题。

## What Changes

### 问题分析

从日志分析发现：

1. ✅ 创建角色时 `scriptId` 正确保存：`"scriptId": "script_1771159033945_3evyhc020"`
2. ✅ 加载资产时 `scriptId` 存在：原始资产数据包含 `scriptId`
3. ❌ 但角色列表显示"未知剧本"

### 根本原因

需要排查以下可能：

1. **时序问题** - 剧本列表加载顺序
2. **数据匹配问题** - `scripts.find()` 匹配失败
3. **渲染问题** - React 渲染时机
4. **数据类型问题** - ID 类型不匹配（string vs number）

## Impact

### 受影响的文件

- `components/ProjectDetail/CharacterSidebar.tsx` - 角色列表组件
- 可能涉及 `services/storage.ts` - 如果存在数据序列化问题

### 向后兼容性

- ✅ 不影响现有功能
- ✅ 只修复显示问题

## ADDED Requirements

### Requirement: 角色剧本关联正确显示

The system SHALL correctly display the script name for characters in the character list.

#### Scenario: 新创建角色显示剧本名称

- **GIVEN** 用户从剧本解析页面创建新角色
- **WHEN** 角色保存并显示在角色列表中
- **THEN** 角色卡片应显示正确的剧本名称，而不是"未知剧本"

#### Scenario: 剧本筛选器正常工作

- **GIVEN** 角色已正确关联剧本
- **WHEN** 用户使用剧本筛选器筛选角色
- **THEN** 筛选结果应正确显示对应剧本的角色

## Technical Notes

### 调试发现

```
[CharacterSidebar] 原始资产数据: [
  { "name": "李叔叔", "scriptId": "script_1771159033945_3evyhc020", ... },
  ...
]
```

资产数据正确，问题在显示逻辑。

### 需要验证的点

1. `scripts` 数组是否正确加载
2. `scripts.find(s => s.id === scriptId)` 是否能匹配到
3. 是否存在 ID 类型不匹配（如 string vs number）
4. React 渲染时机问题
