# Tasks

## Task 1: 新增运镜感知方法

**描述**: 在 KeyframeEngine 中添加 getMovementGuidance 私有方法
**优先级**: P0
**风险**: 极低
**依赖**: 无

**实施步骤**:

1. 在 KeyframeEngine 类中添加 getMovementGuidance 私有方法
2. 实现所有 CameraMovement 类型的指导文本
3. 确保方法返回正确的字符串

**修改文件**:

- services/keyframe/KeyframeEngine.ts (~20行新增)

**向后兼容**: 是，纯新增私有方法

**回退方案**: 删除新增方法

---

## Task 2: 新增叙事结构方法

**描述**: 在 KeyframeEngine 中添加 getNarrativeStructure 私有方法
**优先级**: P0
**风险**: 极低
**依赖**: 无

**实施步骤**:

1. 在 KeyframeEngine 类中添加 getNarrativeStructure 私有方法
2. 实现 2/3/4 个关键帧的叙事结构指导
3. 根据 duration 计算每帧的时长

**修改文件**:

- services/keyframe/KeyframeEngine.ts (~25行新增)

**向后兼容**: 是，纯新增私有方法

**回退方案**: 删除新增方法

---

## Task 3: 重构 buildSplitPrompt 方法

**描述**: 修改 buildSplitPrompt 方法，集成运镜指导和叙事结构
**优先级**: P0
**风险**: 低
**依赖**: Task 1, Task 2

**实施步骤**:

1. 在 buildSplitPrompt 方法中调用 getMovementGuidance
2. 在 buildSplitPrompt 方法中调用 getNarrativeStructure
3. 重构提示词模板，添加【运镜指导】【叙事结构】【连贯性要求】三个新段落
4. 保持原有变量替换逻辑不变
5. 确保向后兼容（方法签名不变）

**修改文件**:

- services/keyframe/KeyframeEngine.ts (~30行修改)

**向后兼容**: 是，方法签名和返回值不变

**回退方案**: 恢复原始 buildSplitPrompt 实现

---

## Task 4: 运行测试验证

**描述**: 运行现有测试，确保修改不破坏原有功能
**优先级**: P0
**风险**: 低
**依赖**: Task 3

**实施步骤**:

1. 运行 KeyframeEngine 相关测试
2. 验证所有测试用例通过
3. 手动测试几个典型场景（推镜头、拉镜头、固定镜头）

**测试命令**:

```bash
npm test -- KeyframeEngine
```

**向后兼容**: 是，纯验证步骤

---

## Task Dependencies

```
Task 1 (运镜感知方法) ──┐
                        ├── Task 3 (重构提示词) ── Task 4 (测试验证)
Task 2 (叙事结构方法) ──┘
```

## 实施建议

### 最小可行产品（MVP）

按顺序完成 Task 1 → Task 2 → Task 3 → Task 4，即可完成核心优化。

### 实施时间预估

- Task 1: 10分钟
- Task 2: 15分钟
- Task 3: 20分钟
- Task 4: 10分钟

**总计**: 约55分钟

## 验收检查点

### Task 1 验收

- [ ] getMovementGuidance 方法已添加
- [ ] 所有 CameraMovement 类型都有对应的指导文本
- [ ] 方法返回非空字符串

### Task 2 验收

- [ ] getNarrativeStructure 方法已添加
- [ ] 支持 2/3/4 个关键帧的叙事结构
- [ ] 时长计算正确

### Task 3 验收

- [ ] buildSplitPrompt 方法已修改
- [ ] 提示词包含【运镜指导】段落
- [ ] 提示词包含【叙事结构】段落
- [ ] 提示词包含【连贯性要求】段落
- [ ] 原有变量替换逻辑正常

### Task 4 验收

- [ ] 所有现有测试通过
- [ ] 手动测试推镜头场景
- [ ] 手动测试拉镜头场景
- [ ] 手动测试固定镜头场景
