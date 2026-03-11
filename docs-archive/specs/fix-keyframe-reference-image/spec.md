# 关键帧生图参考图问题修复与双面板重构 Spec

## Why

### 问题1：参考图未正确传递给生图模型

从日志分析发现，关键帧生图时参考图（角色图和场景图）没有正确传递给火山引擎生图模型：

```json
[VolcengineProvider] Request body: {
  "model": "doubao-seedream-4-0-250828",
  "prompt": "...",
  "size": "2560x1440",
  "response_format": "url",
  "watermark": false
}
```

**问题：** 请求体中没有 `image` 字段，说明参考图没有被传递。

### 问题2：用户体验不佳

当前所有生图模型（文生图和参考图生图）混合在一个下拉框中，用户难以区分：

- 哪些模型支持参考图生图
- 当前选择的模型是否使用了参考图
- 无法直观地看到和管理已选的参考图

## What Changes

### 阶段一：修复参考图传递问题（紧急修复）

1. **添加诊断日志**
   - 在 ShotManager.tsx 添加 referenceImages 生成日志
   - 在 queue.ts 添加 job.params 日志
   - 在 VolcengineProvider.ts 添加参数接收日志

2. **定位问题根因**
   - 检查 `kf.references.character/scene` 是否正确关联
   - 检查资产查找逻辑是否匹配
   - 检查 base64 转换是否成功

3. **修复参考图传递**
   - 修复资产查找逻辑（可能需要用 id 而不是 name 匹配）
   - 确保 referenceImages 数组正确传递到 API 请求

### 阶段二：双面板设计重构（用户体验优化）

1. **新增生图模式切换标签**
   - 文生图模式
   - 参考图生图模式

2. **文生图面板**
   - 模型选择（仅显示不支持参考图的模型）
   - 提示词编辑
   - 分辨率/宽高比选择
   - 生成按钮

3. **参考图生图面板**
   - 模型选择（仅显示支持参考图的模型）
   - 参考图管理区域：
     - 显示已选角色图缩略图（可删除）
     - 显示已选场景图缩略图（可删除）
     - 添加参考图按钮
   - 提示词编辑（自动包含参考图信息）
   - 分辨率/宽高比选择
   - 生成按钮

4. **智能提示词处理**
   - 参考图模式下，自动将参考图信息追加到提示词
   - 用户可编辑最终提示词

## Impact

### 受影响的功能

- **关键帧生图面板** (`views/ShotManager.tsx`)
  - 生图模型选择逻辑
  - 参考图获取和传递逻辑
  - UI 布局重构

- **任务队列** (`services/queue.ts`)
  - 可能需要调整 referenceImages 处理

- **AI 提供商** (`services/ai/providers/`)
  - VolcengineProvider 的参考图处理
  - ModelscopeProvider 的参考图处理

### 向后兼容性

- 已生成的关键帧数据格式保持不变
- 已保存的脚本数据格式保持不变
- 用户已配置的模型设置保持不变

## ADDED Requirements

### Requirement: 参考图正确传递给生图模型

The system SHALL correctly pass reference images (character and scene) to the image generation API.

#### Scenario: 成功传递参考图

- **GIVEN** 关键帧已关联角色和场景资产
- **AND** 角色和场景资产已有生成的图片
- **WHEN** 用户点击"生成图片"
- **THEN** API 请求体中包含 `image` 字段
- **AND** `image` 字段包含角色图和场景图的 base64 数据

#### Scenario: 资产未找到

- **GIVEN** 关键帧关联的资产不存在或无图片
- **WHEN** 用户点击"生成图片"
- **THEN** 系统提示"未找到角色/场景图片，将使用文生图模式"
- **AND** 继续生成但不传递参考图

### Requirement: 生图模式切换

The system SHALL provide two distinct image generation modes: Text-to-Image and Reference-to-Image.

#### Scenario: 切换到文生图模式

- **WHEN** 用户点击"文生图"标签
- **THEN** 显示文生图面板
- **AND** 模型选择仅显示不支持参考图的模型
- **AND** 不显示参考图管理区域

#### Scenario: 切换到参考图生图模式

- **WHEN** 用户点击"参考图生图"标签
- **THEN** 显示参考图生图面板
- **AND** 模型选择仅显示支持参考图的模型
- **AND** 显示参考图管理区域

### Requirement: 参考图可视化

The system SHALL display selected reference images with thumbnails in the Reference-to-Image panel.

#### Scenario: 显示已选参考图

- **GIVEN** 关键帧已关联角色和场景
- **WHEN** 用户切换到参考图生图模式
- **THEN** 显示角色图缩略图（如果存在）
- **AND** 显示场景图缩略图（如果存在）

#### Scenario: 删除参考图

- **GIVEN** 参考图生图模式已激活
- **WHEN** 用户点击参考图缩略图的删除按钮
- **THEN** 该参考图从生成参数中移除
- **AND** 缩略图从显示区域消失

### Requirement: 智能模型过滤

The system SHALL filter available models based on the selected generation mode.

#### Scenario: 文生图模式模型过滤

- **GIVEN** 用户处于文生图模式
- **WHEN** 打开模型选择下拉框
- **THEN** 仅显示 `supportsReferenceImage: false` 的模型

#### Scenario: 参考图生图模式模型过滤

- **GIVEN** 用户处于参考图生图模式
- **WHEN** 打开模型选择下拉框
- **THEN** 仅显示 `supportsReferenceImage: true` 的模型

## MODIFIED Requirements

### Requirement: 关键帧生图流程

**原有流程：**

1. 选择模型（所有模型混合）
2. 点击生成
3. 系统自动获取关联资产图作为参考

**新流程：**

1. 选择生图模式（文生图/参考图生图）
2. 根据模式显示对应面板
3. 参考图模式下可查看/管理参考图
4. 点击生成
5. 系统根据面板设置传递参数

## Technical Notes

### 模型能力标识

根据 `config/models.ts` 中的配置：

- **支持参考图的模型：**
  - `volc-img-seedream-4.5` (supportsReferenceImage: true, maxReferenceImages: 10)
  - `volc-img-seedream-4.0` (supportsReferenceImage: true, maxReferenceImages: 10)
  - `vidu-img-q2` (supportsReferenceImage: true, maxReferenceImages: 7)
  - `vidu-img-q1` (supportsReferenceImage: true, maxReferenceImages: 7)
  - `modelscope-z-image` (supportsReferenceImage: true, maxReferenceImages: 5)

- **不支持参考图的模型：**
  - `volc-img-seedream-3.0-t2i` (supportsReferenceImage: false)

### 参考图数据结构

```typescript
// 关键帧中的参考信息
interface Keyframe {
  references: {
    character?: { id: string; name: string };
    scene?: { id: string; name: string };
  };
}

// 传递到 API 的数据
interface GenerationJob {
  referenceImages: string[]; // base64 data URLs
}
```

### 潜在风险与缓解措施

| 风险                                   | 影响           | 缓解措施                       |
| -------------------------------------- | -------------- | ------------------------------ |
| 资产查找失败                           | 参考图无法获取 | 添加详细日志，失败时提示用户   |
| base64 转换失败                        | 图片无法传递   | 添加错误处理，跳过失败图片     |
| 模型不支持参考图但用户选择了参考图模式 | API 调用失败   | 前端过滤模型，只显示支持的模型 |
| 参考图过多超出模型限制                 | API 报错       | 前端限制最大选择数量           |

## Implementation Strategy

### 阶段一（紧急修复）

1. 添加诊断日志（不修改业务逻辑，安全）
2. 运行测试，查看日志定位问题
3. 修复具体问题（资产查找或参数传递）
4. 验证修复

### 阶段二（UI 重构）

1. 添加生图模式状态管理
2. 实现双面板切换
3. 实现模型过滤逻辑
4. 实现参考图可视化区域
5. 集成测试

## Success Criteria

### 阶段一成功标准

- [ ] 日志显示 referenceImages 数组非空且包含有效 base64 数据
- [ ] API 请求体包含 `image` 字段
- [ ] 生成的图片受到参考图影响（风格/人物一致）

### 阶段二成功标准

- [ ] 文生图模式只显示文生图模型
- [ ] 参考图生图模式只显示支持参考图的模型
- [ ] 参考图缩略图正确显示
- [ ] 删除参考图功能正常
- [ ] 用户界面清晰区分两种模式
