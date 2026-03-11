# 修复关键帧生图布局问题 Spec

## Why

在实际的测试过程当中，关键帧生图数量过多的时候，左侧的预览区跟缩略图整个区域似乎在挤压右边的生图参数区域。用户反馈没有看到缩略图过多时有左右滑动的按钮。

## What Changes

1. **修复左侧区域挤压右侧区域的问题**
   - 左侧区域（图片预览+历史缩略图+描述）应该固定宽度或最大宽度
   - 右侧区域（生图参数）应该保持最小宽度，不被挤压
   - 使用 `minmax()` 或 `flex-shrink-0` 防止挤压

2. **添加缩略图左右滑动按钮**
   - 当缩略图数量超出容器宽度时，显示左右滑动按钮
   - 点击按钮可以左右滚动查看隐藏的缩略图
   - 参考角色管理模块的历史图片滑动交互

3. **优化历史缩略图区域布局**
   - 确保横向滚动正常工作
   - 添加滚动指示器或按钮

## Impact

- Affected code: `views/ShotManager.tsx`
- Affected UI: 关键帧生图页面的左右分栏布局

## ADDED Requirements

### Requirement: 左侧区域不挤压右侧区域

The system SHALL ensure the left panel (image preview + thumbnails) does not squeeze the right panel (generation parameters).

#### Scenario: 生图数量过多

- **WHEN** 用户生成了大量图片（历史缩略图很多）
- **THEN** 左侧区域应该保持合理宽度
- **AND** 右侧生图参数区域保持完整显示，不被挤压

### Requirement: 缩略图左右滑动按钮

The system SHALL provide left/right scroll buttons for thumbnail navigation when thumbnails overflow.

#### Scenario: 缩略图超出容器宽度

- **WHEN** 历史缩略图数量超出容器可视区域
- **THEN** 显示左右滑动按钮
- **AND** 点击按钮可以平滑滚动查看隐藏的缩略图

## 参考设计

之前的设计要求：

- 历史缩略图改为横向滑动
- 缩略图大小为 64x64 (w-16 h-16)
- 添加删除功能（已完成）
- 需要左右滑动按钮（缺失）
