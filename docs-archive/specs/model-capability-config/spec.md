# 生图模型能力配置 Spec

## Why

目前项目中的生图模型没有明确区分文生图和参考图生图能力，导致：

1. 用户无法知道哪些模型支持参考图生图
2. 关键帧生图面板的模型过滤功能无法正常工作
3. 新增模型时无法配置其能力

## What Changes

### 1. 新增模型能力配置界面

在模型设置页面（Settings.tsx）中：

- **添加模型时**：增加"支持参考图生图"开关，让用户自行配置
- **编辑现有模型**：增加能力编辑功能，让用户可以修改已配置模型的能力
- **模型列表显示**：显示每个模型是否支持参考图生图

### 2. 数据结构调整

在 `ModelConfig` 类型中确保 `capabilities` 字段包含：

```typescript
interface ModelCapabilities {
  supportsReferenceImage?: boolean; // 是否支持参考图生图
  maxReferenceImages?: number; // 最大参考图数量
  maxBatchSize?: number; // 最大批处理数量
  supportsStreaming?: boolean; // 是否支持流式输出（LLM）
  maxContextLength?: number; // 最大上下文长度（LLM）
}
```

### 3. 向后兼容

- 现有模型如果没有配置 `supportsReferenceImage`，默认设为 `true`（支持参考图）
- 不影响现有功能

## Impact

### 受影响的文件

- `views/Settings.tsx` - 模型设置页面，增加能力配置UI
- `types.ts` - 确保 ModelCapabilities 类型定义完整
- `views/ShotManager.tsx` - 使用模型能力进行过滤（已部分实现）

### 向后兼容性

- ✅ 现有模型可以继续使用
- ✅ 未配置能力的模型默认支持参考图
- ✅ 用户可以随时编辑现有模型的能力

## ADDED Requirements

### Requirement: 新增模型时配置能力

The system SHALL allow users to configure model capabilities when adding a new model.

#### Scenario: 添加自定义生图模型

- **WHEN** 用户选择添加自定义生图模型
- **THEN** 显示"支持参考图生图"开关
- **AND** 用户可以自由开启或关闭
- **AND** 保存时该配置写入模型数据

#### Scenario: 添加预设生图模型

- **WHEN** 用户选择添加预设生图模型
- **THEN** 自动从 DEFAULT_MODELS 复制 capabilities
- **AND** 用户可以预览但不可修改（或可以修改）

### Requirement: 编辑现有模型能力

The system SHALL allow users to edit capabilities of existing models.

#### Scenario: 编辑模型能力

- **GIVEN** 用户已有一个配置好的生图模型
- **WHEN** 用户点击编辑按钮
- **THEN** 显示能力编辑选项
- **AND** 用户可以修改"支持参考图生图"设置
- **AND** 保存后更新模型配置

### Requirement: 模型列表显示能力

The system SHALL display model capabilities in the model list.

#### Scenario: 查看模型能力

- **WHEN** 用户查看模型列表
- **THEN** 每个生图模型显示是否支持参考图生图的标识
- **AND** 使用清晰的视觉元素（如标签、图标）

## MODIFIED Requirements

### Requirement: 关键帧生图面板模型过滤

**原有逻辑：** 基于 DEFAULT_MODELS 匹配判断模型能力
**新逻辑：** 直接读取模型配置中的 `capabilities.supportsReferenceImage`

## Technical Notes

### 数据流

```
用户配置 → settings.models[].capabilities → ShotManager 过滤 → UI 显示
```

### 默认值策略

- `supportsReferenceImage`: true（为了兼容性，默认支持参考图）
- `maxReferenceImages`: 5

### UI 设计

- 使用 Switch 组件控制"支持参考图生图"
- 使用 Number Input 控制"最大参考图数量"（仅在开启时显示）
- 使用 Chip 或图标在列表中显示能力

## Implementation Strategy

1. **修改 types.ts** - 确保 ModelCapabilities 类型完整
2. **修改 Settings.tsx** - 添加能力配置UI
3. **测试验证** - 验证新增、编辑、显示功能正常
