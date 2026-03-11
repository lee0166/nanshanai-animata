# Tasks

## 阶段一：基础架构（核心功能，必须完成）

### Task 1: 新增类型定义

**描述**: 在 types.ts 中新增关键帧模板相关的类型定义
**优先级**: P0
**风险**: 极低
**依赖**: 无

**实施步骤**:

1. 新增 FrameTemplate 接口
2. 新增 KeyframeTemplate 接口
3. 新增 CharacterKeyframeConstraint 接口
4. 新增 VideoTransitionConfig 接口
5. 新增 KeyframeEditorState 接口

**修改文件**:

- types.ts (~80行新增)

**向后兼容**: 是，纯新增类型

**回退方案**: 删除新增类型定义

---

### Task 2: 实现关键帧模板系统

**描述**: 创建预设模板和模板选择逻辑
**优先级**: P0
**风险**: 低
**依赖**: Task 1

**实施步骤**:

1. 新建 services/keyframe/KeyframeTemplates.ts
2. 实现 DIALOGUE_TEMPLATE（对话镜头模板）
3. 实现 ACTION_TEMPLATE（动作镜头模板）
4. 实现 PUSH_TEMPLATE（推镜头模板）
5. 实现 PULL_TEMPLATE（拉镜头模板）
6. 实现 PAN_TEMPLATE（摇镜头模板）
7. 实现 TRACK_TEMPLATE（移镜头模板）
8. 实现模板匹配函数（根据 shotType 和 cameraMovement 推荐模板）

**修改文件**:

- 新增: services/keyframe/KeyframeTemplates.ts (~200行)

**向后兼容**: 是，模板系统为可选功能

**回退方案**: 使用原有自由生成模式

---

### Task 3: 重构 KeyframeEngine 提示词构建

**描述**: 支持模板和运镜感知的提示词构建
**优先级**: P0
**风险**: 中
**依赖**: Task 1, Task 2

**实施步骤**:

1. 修改 KeyframeEngine.buildSplitPrompt 方法
2. 添加模板感知逻辑（如果提供了模板，使用模板定义）
3. 添加运镜感知逻辑（根据 cameraMovement 添加特定指导）
4. 添加角色约束逻辑（强化外观锁定）
5. 添加图生视频优化逻辑（姿态变化限制提示）
6. 保持向后兼容（模板参数为可选）

**修改文件**:

- services/keyframe/KeyframeEngine.ts (~150行修改)

**向后兼容**: 是，模板参数为可选

**回退方案**: 使用原有简单提示词构建逻辑

---

### Task 4: 实现角色特征锁定

**描述**: 强化角色一致性约束
**优先级**: P0
**风险**: 低
**依赖**: Task 1

**实施步骤**:

1. 修改 CharacterAsset 类型（添加 appearance、expressionRange、poseConstraints 字段）
2. 修改 KeyframeEngine，在提示词中包含角色约束
3. 修改 KeyframeService，传递角色约束信息

**修改文件**:

- types.ts (~30行修改)
- services/keyframe/KeyframeEngine.ts (~50行修改)
- services/keyframe/KeyframeService.ts (~30行修改)

**向后兼容**: 是，新增字段为可选

**回退方案**: 忽略角色约束，使用原有逻辑

---

## 阶段二：导演工作流（UI功能）

### Task 5: 实现模板选择UI

**描述**: 在 ShotList 中添加模板选择功能
**优先级**: P1
**风险**: 低
**依赖**: Task 2

**实施步骤**:

1. 在 ShotList.tsx 中添加模板选择下拉框
2. 实现模板推荐逻辑（根据 shot 自动推荐）
3. 添加模板预览说明（显示每个帧的描述）
4. 保持原有自由生成选项

**修改文件**:

- components/ScriptParser/ShotList.tsx (~100行新增)

**向后兼容**: 是，UI为新增功能

**回退方案**: 隐藏模板选择，使用原有界面

---

### Task 6: 实现故事板预览

**描述**: 添加关键帧故事板预览功能
**优先级**: P1
**风险**: 低
**依赖**: 无

**实施步骤**:

1. 在 ShotManager.tsx 中添加故事板预览按钮
2. 创建故事板预览 Modal
3. 以网格形式显示所有关键帧
4. 显示关键帧序号、描述、时长
5. 支持点击关键帧查看详情

**修改文件**:

- views/ShotManager.tsx (~150行新增)

**向后兼容**: 是，纯新增功能

**回退方案**: 隐藏预览按钮

---

### Task 7: 实现单帧调整功能

**描述**: 支持单帧重新生成和编辑
**优先级**: P1
**风险**: 中
**依赖**: Task 6

**实施步骤**:

1. 在故事板预览中添加"重新生成"按钮
2. 实现单帧重新生成逻辑（调用 KeyframeEngine）
3. 添加提示词编辑功能
4. 添加时长调整功能
5. 更新关键帧后刷新预览

**修改文件**:

- views/ShotManager.tsx (~100行新增)
- services/keyframe/KeyframeService.ts (~50行新增)

**向后兼容**: 是，纯新增功能

**回退方案**: 禁用单帧调整，只能整体重新生成

---

### Task 8: 实现增删关键帧功能

**描述**: 支持添加和删除关键帧
**优先级**: P1
**风险**: 中
**依赖**: Task 6

**实施步骤**:

1. 在故事板预览中添加"添加关键帧"按钮
2. 实现插入新关键帧逻辑（在指定位置插入）
3. 实现删除关键帧逻辑
4. 重新分配关键帧序号和时长
5. 更新UI显示

**修改文件**:

- views/ShotManager.tsx (~80行新增)
- services/keyframe/KeyframeService.ts (~80行新增)

**向后兼容**: 是，纯新增功能

**回退方案**: 禁用增删功能

---

## 阶段三：高级功能（可选）

### Task 9: 实现批量处理系统

**描述**: 支持批量选择和处理多个分镜
**优先级**: P2
**风险**: 中
**依赖**: Task 2, Task 5

**实施步骤**:

1. 在 ShotList.tsx 中添加批量选择功能（复选框）
2. 添加批量操作工具栏
3. 新建 services/keyframe/BatchKeyframeService.ts
4. 实现批量任务队列
5. 实现进度跟踪和显示

**修改文件**:

- 新增: services/keyframe/BatchKeyframeService.ts (~200行)
- components/ScriptParser/ShotList.tsx (~100行新增)

**向后兼容**: 是，纯新增功能

**回退方案**: 使用原有逐个处理模式

---

### Task 10: 实现版本管理

**描述**: 支持保存和切换多个关键帧方案
**优先级**: P2
**风险**: 中
**依赖**: Task 6

**实施步骤**:

1. 在 Shot 类型中添加 keyframeVersions 字段
2. 在故事板预览中添加"保存版本"按钮
3. 实现版本保存逻辑
4. 实现版本列表和切换功能
5. 实现版本对比功能

**修改文件**:

- types.ts (~20行修改)
- views/ShotManager.tsx (~100行新增)
- services/keyframe/KeyframeService.ts (~50行新增)

**向后兼容**: 是，新增字段为可选

**回退方案**: 禁用版本管理

---

## Task Dependencies

```
Task 1 (类型定义)
  ├── Task 2 (模板系统)
  │     ├── Task 3 (提示词重构)
  │     └── Task 5 (模板选择UI)
  │           └── Task 9 (批量处理)
  ├── Task 4 (角色锁定)
  │     └── Task 3 (提示词重构)
  └── Task 6 (故事板预览)
        ├── Task 7 (单帧调整)
        ├── Task 8 (增删关键帧)
        └── Task 10 (版本管理)
```

## Phase Dependencies

- 阶段二（Task 5-8）depends on 阶段一（Task 1-4）
- 阶段三（Task 9-10）depends on 阶段二（Task 5-8）
- 建议按阶段顺序实施，每阶段完成后进行测试

## 实施建议

### 最小可行产品（MVP）

如果资源有限，建议优先完成：

1. Task 1（类型定义）
2. Task 2（模板系统）
3. Task 3（提示词重构）
4. Task 5（模板选择UI）

这样即可实现核心的"模板化关键帧生成"功能。

### 完整功能

如果需要完整功能，按阶段顺序完成所有 Task。
