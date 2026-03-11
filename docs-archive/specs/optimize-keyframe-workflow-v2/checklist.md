# Checklist

## 实施前检查

- [ ] 已备份原始 KeyframeEngine.ts 文件
- [ ] 已确认当前测试用例可以正常运行
- [ ] 已确认 types.ts 中 CameraMovement 类型定义

## Task 1 验收检查点

- [ ] getMovementGuidance 私有方法已添加到 KeyframeEngine 类
- [ ] 方法参数类型为 CameraMovement
- [ ] 方法返回类型为 string
- [ ] 包含 static 类型的指导文本
- [ ] 包含 push 类型的指导文本
- [ ] 包含 pull 类型的指导文本
- [ ] 包含 pan 类型的指导文本
- [ ] 包含 tilt 类型的指导文本
- [ ] 包含 track 类型的指导文本
- [ ] 包含 crane 类型的指导文本
- [ ] 有默认回退逻辑（返回 static 的指导文本）

## Task 2 验收检查点

- [ ] getNarrativeStructure 私有方法已添加到 KeyframeEngine 类
- [ ] 方法参数 count 类型为 number
- [ ] 方法参数 duration 类型为 number
- [ ] 方法返回类型为 string
- [ ] 支持 count = 2 的叙事结构
- [ ] 支持 count = 3 的叙事结构
- [ ] 支持 count = 4 的叙事结构
- [ ] 时长计算正确（使用 Math.ceil(duration \* ratio)）
- [ ] 其他 count 值返回空字符串

## Task 3 验收检查点

- [ ] buildSplitPrompt 方法已修改
- [ ] 方法签名不变（参数和返回值类型相同）
- [ ] 调用了 getMovementGuidance 方法
- [ ] 调用了 getNarrativeStructure 方法
- [ ] 提示词包含【运镜指导】段落
- [ ] 提示词包含【叙事结构】段落
- [ ] 提示词包含【连贯性要求】段落
- [ ] 【连贯性要求】包含"相邻关键帧的角色姿态变化应该是渐进的"
- [ ] 原有变量（sceneDesc、characterDesc等）替换逻辑正常
- [ ] 原有【分镜信息】【画面描述】【拆分要求】【输出格式】段落保留
- [ ] TypeScript 编译无错误

## Task 4 验收检查点

- [ ] 运行 npm test -- KeyframeEngine 所有测试通过
- [ ] 没有引入新的测试失败
- [ ] 手动测试：推镜头（push）场景
  - [ ] 生成的提示词包含"景别从大到小"
  - [ ] 生成的提示词包含"第1帧用较大景别"
  - [ ] 生成的提示词包含"第3帧特写"
- [ ] 手动测试：拉镜头（pull）场景
  - [ ] 生成的提示词包含"景别从小到大"
  - [ ] 生成的提示词包含"第1帧特写"
  - [ ] 生成的提示词包含"第3帧较大景别"
- [ ] 手动测试：固定镜头（static）场景
  - [ ] 生成的提示词包含"保持画面构图稳定"
- [ ] 手动测试：3个关键帧场景
  - [ ] 生成的提示词包含"动作起点"
  - [ ] 生成的提示词包含"动作顶点/转折"
  - [ ] 生成的提示词包含"动作终点"
- [ ] 手动测试：4个关键帧场景
  - [ ] 生成的提示词包含"动作起点"
  - [ ] 生成的提示词包含"动作发展"
  - [ ] 生成的提示词包含"动作顶点"
  - [ ] 生成的提示词包含"动作终点"

## 兼容性检查

- [ ] KeyframeSplitParams 接口未修改
- [ ] KeyframeSplitResult 接口未修改
- [ ] splitKeyframes 方法签名未修改
- [ ] parseKeyframesFromResponse 方法未修改
- [ ] generateDefaultKeyframes 方法未修改
- [ ] 前端 ShotList.tsx 无需修改
- [ ] 前端 ShotManager.tsx 无需修改
- [ ] types.ts 中 Shot 类型未修改
- [ ] types.ts 中 Keyframe 类型未修改

## 回退准备

- [ ] 已保存原始 buildSplitPrompt 方法的代码片段
- [ ] 知道如何快速回退（恢复原始方法实现）

## 最终验收

- [ ] 所有 Task 已完成
- [ ] 所有 Checklist 已勾选
- [ ] 代码可以正常编译
- [ ] 测试全部通过
- [ ] 效果符合预期（推镜头体现景别变化、关键帧有叙事逻辑）
