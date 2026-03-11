# Tasks

## 阶段一：修复参考图传递问题

- [x] Task 1: 添加诊断日志
  - [x] SubTask 1.1: 在 ShotManager.tsx handleGenerateImage 中添加 referenceImages 生成日志
  - [x] SubTask 1.2: 在 queue.ts executeKeyframeGenerationJob 中添加 job.params 日志
  - [x] SubTask 1.3: 在 VolcengineProvider.ts generateImage 中添加参数接收日志
  - [x] SubTask 1.4: 在 VolcengineProvider.ts 中添加 loadedImages 处理日志

- [x] Task 2: 运行测试并定位问题
  - [x] SubTask 2.1: 用户运行关键帧生图并收集日志
  - [x] SubTask 2.2: 分析日志确定问题所在环节
  - [x] SubTask 2.3: 识别是资产查找失败还是参数传递失败

- [x] Task 3: 修复参考图传递问题
  - [x] SubTask 3.1: 如果是资产查找问题，修复查找逻辑（可能需要用 id 匹配）
  - [x] SubTask 3.2: 如果是参数传递问题，修复传递逻辑
  - [x] SubTask 3.3: 验证修复后 API 请求包含 image 字段

## 阶段二：双面板设计重构

- [x] Task 4: 添加生图模式状态管理
  - [x] SubTask 4.1: 在 ShotManager.tsx 添加 generationMode 状态（'text-to-image' | 'reference-to-image'）
  - [x] SubTask 4.2: 添加模式切换处理函数
  - [x] SubTask 4.3: 默认选择参考图生图模式（如果关键帧有关联资产）

- [x] Task 5: 实现生图模式切换标签
  - [x] SubTask 5.1: 在生图面板顶部添加 Tabs 组件
  - [x] SubTask 5.2: 实现"文生图"标签
  - [x] SubTask 5.3: 实现"参考图生图"标签
  - [x] SubTask 5.4: 添加标签切换动画效果

- [x] Task 6: 实现文生图面板
  - [x] SubTask 6.1: 创建文生图模型选择下拉框（过滤 supportsReferenceImage: false 的模型）
  - [x] SubTask 6.2: 添加提示词编辑区域
  - [x] SubTask 6.3: 添加分辨率/宽高比选择
  - [x] SubTask 6.4: 添加生成按钮

- [x] Task 7: 实现参考图生图面板
  - [x] SubTask 7.1: 创建参考图模型选择下拉框（过滤 supportsReferenceImage: true 的模型）
  - [x] SubTask 7.2: 创建参考图管理区域
  - [x] SubTask 7.3: 显示角色图缩略图（带删除按钮）
  - [x] SubTask 7.4: 显示场景图缩略图（带删除按钮）
  - [x] SubTask 7.5: 添加提示词编辑区域（显示自动追加的参考图信息）
  - [x] SubTask 7.6: 添加分辨率/宽高比选择
  - [x] SubTask 7.7: 添加生成按钮

- [x] Task 8: 实现模型过滤逻辑
  - [x] SubTask 8.1: 创建模型过滤函数
  - [x] SubTask 8.2: 根据当前模式动态过滤可用模型
  - [x] SubTask 8.3: 切换模式时自动选择第一个可用模型

- [x] Task 9: 实现参考图管理功能
  - [x] SubTask 9.1: 实现删除角色参考图功能
  - [x] SubTask 9.2: 实现删除场景参考图功能
  - [x] SubTask 9.3: 更新提示词中的参考图信息
  - [x] SubTask 9.4: 确保删除后重新生成时使用更新后的参考图

- [x] Task 10: 集成测试与验证
  - [x] SubTask 10.1: 测试文生图模式完整流程
  - [x] SubTask 10.2: 测试参考图生图模式完整流程
  - [x] SubTask 10.3: 测试模式切换时状态正确重置
  - [x] SubTask 10.4: 测试删除参考图后生成正确

# Task Dependencies

- Task 2 depends on Task 1（需要日志才能定位问题）
- Task 3 depends on Task 2（需要定位问题才能修复）
- Task 5 depends on Task 4（需要状态管理才能切换）
- Task 6 depends on Task 5（需要标签切换才能显示面板）
- Task 7 depends on Task 5（需要标签切换才能显示面板）
- Task 8 depends on Task 6, Task 7（需要面板才能过滤模型）
- Task 9 depends on Task 7（需要参考图区域才能管理）
- Task 10 depends on Task 3, Task 8, Task 9（需要所有功能完成才能测试）

# Phase Dependencies

- 阶段二（Task 4-10）depends on 阶段一（Task 1-3）
- 建议先完成阶段一再开始阶段二
