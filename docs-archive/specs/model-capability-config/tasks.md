# Tasks

- [ ] Task 1: 检查并完善 types.ts 中的 ModelCapabilities 类型定义
  - [ ] SubTask 1.1: 确认 ModelCapabilities 接口包含所有必要字段
  - [ ] SubTask 1.2: 确保 ModelConfig 类型正确引用 ModelCapabilities

- [ ] Task 2: 修改 Settings.tsx 添加模型能力配置UI
  - [ ] SubTask 2.1: 在自定义模型表单中添加"支持参考图生图" Switch
  - [ ] SubTask 2.2: 添加"最大参考图数量" Number Input（条件显示）
  - [ ] SubTask 2.3: 修改 handleAddCustomModel 保存能力配置
  - [ ] SubTask 2.4: 在编辑模型对话框中添加能力编辑选项
  - [ ] SubTask 2.5: 修改 handleSaveEdit 保存能力配置

- [ ] Task 3: 模型列表显示能力标识
  - [ ] SubTask 3.1: 在模型列表表格中添加"能力"列
  - [ ] SubTask 3.2: 使用 Chip 显示是否支持参考图生图
  - [ ] SubTask 3.3: 添加相关图标或颜色区分

- [ ] Task 4: 修改 ShotManager.tsx 使用模型配置的能力
  - [ ] SubTask 4.1: 修改 getModelCapabilities 直接读取 model.capabilities
  - [ ] SubTask 4.2: 移除对 DEFAULT_MODELS 的依赖
  - [ ] SubTask 4.3: 测试模型过滤功能

- [ ] Task 5: 测试验证
  - [ ] SubTask 5.1: 测试添加自定义模型时配置能力
  - [ ] SubTask 5.2: 测试编辑现有模型能力
  - [ ] SubTask 5.3: 测试模型列表显示能力
  - [ ] SubTask 5.4: 测试关键帧生图面板模型过滤

# Task Dependencies

- Task 2 depends on Task 1（需要类型定义正确）
- Task 3 depends on Task 2（需要配置功能完成）
- Task 4 depends on Task 2（需要配置数据正确保存）
- Task 5 depends on Task 3, Task 4（需要所有功能完成）
