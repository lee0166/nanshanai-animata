# 分镜关键帧拆分工作流程优化 Spec

## Why

当前分镜关键帧拆分流程存在以下核心问题，导致无法真正适配影视作品制作：

1. **关键帧选取过于自由** - LLM自由决定关键帧内容，导演无法干预，缺乏"起-承-转-合"的叙事节奏控制
2. **运镜信息被忽略** - 推/拉/摇/移等运镜类型没有差异化处理，关键帧与镜头语言脱节
3. **角色/场景一致性保障不足** - 仅靠参考图保证一致性，服装、发型、光线等容易前后不一致
4. **图生视频适配性差** - 关键帧生成时不考虑视频过渡需求，姿态变化可能过大导致"瞬移"
5. **缺乏导演工作流支持** - 无法预览关键帧序列、单帧调整、增删关键帧

## What Changes

### 新增功能

1. **智能关键帧模板系统**
   - 根据镜头类型（对话、动作、运镜）提供预设模板
   - 导演可选择模板、自定义模板或AI自由生成
   - 模板定义每个关键帧的名称、描述、时长占比、姿态类型

2. **运镜感知的关键帧生成**
   - 根据cameraMovement类型生成特定的关键帧指导
   - 推镜头：体现景别从大到小的变化
   - 摇镜头：体现画面内容的水平移动
   - 移镜头：体现空间位置的变化

3. **角色特征锁定机制**
   - 强化角色外观锁定（服装、发型、配饰）
   - 表情范围约束（最小表情到最大表情）
   - 姿态约束（禁止的姿态列表）

4. **图生视频前置优化**
   - 姿态变化幅度限制（防止瞬移）
   - 中间过渡姿态自动生成
   - 角色在画面中的位置追踪

5. **导演工作流优化**
   - 故事板模式预览所有关键帧
   - 单帧重新生成功能
   - 增删关键帧功能
   - 关键帧顺序调整功能
   - 版本管理（保存多个方案）

6. **批量处理系统**
   - 批量选择分镜
   - 批量应用模板
   - 队列管理和进度跟踪

### 修改内容

1. **types.ts** - 新增KeyframeTemplate、FrameTemplate、CharacterKeyframeConstraint等类型
2. **KeyframeEngine.ts** - 重构提示词构建逻辑，支持模板和运镜感知
3. **KeyframeService.ts** - 新增批量处理、版本管理功能
4. **ShotManager.tsx** - 新增故事板预览、单帧编辑UI
5. **ShotList.tsx** - 新增模板选择、批量操作UI

### 保持不变的参数

- Shot类型定义不变
- Keyframe类型定义不变（只新增可选字段）
- 现有LLM调用接口不变
- 现有图生图API调用方式不变
- 前端整体布局样式不变

## Impact

### Affected specs

- fix-keyframe-layout-issues（已完成，布局相关）
- fix-keyframe-reference-image（已完成，参考图相关）

### Affected code

- services/keyframe/KeyframeEngine.ts（核心修改）
- services/keyframe/KeyframeService.ts（功能扩展）
- views/ShotManager.tsx（UI扩展）
- components/ScriptParser/ShotList.tsx（UI扩展）
- types.ts（类型扩展）

## ADDED Requirements

### Requirement: 智能关键帧模板系统

The system SHALL provide preset keyframe templates based on shot type.

#### Scenario: 对话镜头

- **GIVEN** 用户选择了一个对话类型的分镜
- **WHEN** 系统推荐模板时
- **THEN** 应该提供"标准对话"模板，包含：说话者动作、听者反应、对话结束三个关键帧

#### Scenario: 动作镜头

- **GIVEN** 用户选择了一个动作类型的分镜
- **WHEN** 系统推荐模板时
- **THEN** 应该提供"动态动作"模板，包含：预备动作、动作顶点、动作结束三个关键帧

#### Scenario: 运镜镜头

- **GIVEN** 用户选择了一个推镜头
- **WHEN** 系统推荐模板时
- **THEN** 应该提供"推镜头"模板，包含：起始景别、中间过渡、终点特写三个关键帧

### Requirement: 运镜感知生成

The system SHALL generate movement-aware guidance in prompts.

#### Scenario: 推镜头

- **GIVEN** shot.cameraMovement = 'push'
- **WHEN** 构建提示词时
- **THEN** 应该包含"关键帧应该体现景别从大到小的变化"的指导

#### Scenario: 摇镜头

- **GIVEN** shot.cameraMovement = 'pan'
- **WHEN** 构建提示词时
- **THEN** 应该包含"关键帧应该体现画面内容的水平移动"的指导

### Requirement: 角色特征锁定

The system SHALL enforce character consistency across keyframes.

#### Scenario: 外观锁定

- **GIVEN** 角色有定义服装、发型、配饰
- **WHEN** 生成关键帧提示词时
- **THEN** 每个关键帧的prompt必须包含这些外观特征

#### Scenario: 表情范围

- **GIVEN** 角色定义了表情范围（平静到愤怒）
- **WHEN** 生成特定关键帧时
- **THEN** 该帧的表情必须在范围内

### Requirement: 图生视频优化

The system SHALL optimize keyframes for video generation.

#### Scenario: 姿态变化限制

- **GIVEN** 配置maxPoseChange = 30%
- **WHEN** 生成关键帧时
- **THEN** 相邻关键帧的姿态变化不应超过30%

#### Scenario: 位置追踪

- **GIVEN** 关键帧1角色在画面左侧
- **WHEN** 生成关键帧2时
- **THEN** 如果角色移动到右侧，应该有关键帧显示中间过渡位置

### Requirement: 导演工作流

The system SHALL provide director-friendly workflow.

#### Scenario: 故事板预览

- **GIVEN** 分镜已拆分关键帧
- **WHEN** 用户点击"预览"按钮
- **THEN** 应该以故事板形式显示所有关键帧，像连环画一样

#### Scenario: 单帧调整

- **GIVEN** 用户对某个关键帧不满意
- **WHEN** 用户点击"重新生成"按钮
- **THEN** 应该只重新生成该关键帧，不影响其他帧

#### Scenario: 增删关键帧

- **GIVEN** 分镜有3个关键帧
- **WHEN** 用户点击"添加关键帧"按钮
- **THEN** 应该在指定位置插入新关键帧，并重新分配时长

### Requirement: 批量处理

The system SHALL support batch processing of multiple shots.

#### Scenario: 批量选择

- **GIVEN** 列表中有多个分镜
- **WHEN** 用户选择多个分镜并点击"批量拆分"
- **THEN** 应该为每个选中的分镜应用相同模板并生成关键帧

#### Scenario: 进度跟踪

- **GIVEN** 批量任务正在执行
- **WHEN** 用户查看进度时
- **THEN** 应该显示已完成数量和总数量

## MODIFIED Requirements

### Requirement: 关键帧拆分提示词

**原实现**: 简单的字符串拼接，只包含基础分镜信息

**修改后**:

- 包含运镜指导
- 包含模板定义的关键帧要求
- 包含角色一致性约束
- 包含图生视频优化要求

## REMOVED Requirements

无移除功能，所有修改都是向后兼容的扩展。

## 新增参数说明

### KeyframeTemplate 类型（新增）

```typescript
export interface KeyframeTemplate {
  id: string;
  name: string;
  description: string;
  shotTypes: ShotType[];
  cameraMovement: CameraMovement[];
  frames: FrameTemplate[];
}

export interface FrameTemplate {
  sequence: number;
  name: string;
  description: string;
  durationRatio: number;
  poseType: 'start' | 'peak' | 'end' | 'transition';
}
```

### CharacterKeyframeConstraint 类型（新增）

```typescript
export interface CharacterKeyframeConstraint {
  id: string;
  name: string;
  appearance: {
    clothing: string;
    hairstyle: string;
    accessories: string[];
  };
  expressionRange: {
    min: string;
    max: string;
  };
  poseConstraints: {
    canStand: boolean;
    canSit: boolean;
    canMove: boolean;
    forbiddenPoses: string[];
  };
}
```

### VideoTransitionConfig 类型（新增）

```typescript
export interface VideoTransitionConfig {
  mode: 'first_last' | 'first_middle_last';
  maxPoseChange: number;
  requireMidPose: boolean;
  motionBlur: boolean;
}
```

## 前端样式约束

- 保持现有ShotManager和ShotList的整体布局
- 新增功能使用现有UI组件（Button、Card、Modal等）
- 保持现有的配色方案和字体样式
- 新增面板使用现有Tabs组件进行切换
